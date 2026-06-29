import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import embeddingService from './embedding.vertexai.service';
import vectorDbService from './vectorDb.service';
import geminiService from './gemini.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  response: string;
  sources: Array<{
    text: string;
    score: number;
    title?: string;
    sourceType?: string;
    url?: string;
  }>;
}

class ChatService {
  /**
   * Embed document for RAG chat
   */
  async embedDocument(
    documentText: string,
    sessionId: string,
    metadata: any = {}
  ): Promise<{
    chunksCount: number;
    sessionId: string;
  }> {
    try {
      console.log(`📄 Embedding document for session ${sessionId}...`);

      // Split document into larger chunks for better semantic coherence
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1500, // Increased from 1000 for better context
        chunkOverlap: 300, // Increased from 200 for better continuity
        separators: ['\n\n', '\n', '. ', ' ', ''],
      });

      const chunks = await textSplitter.splitText(documentText);
      console.log(`✂️ Split document into ${chunks.length} chunks (1500 char size, 300 overlap)`);

      // Generate embeddings for all chunks
      const embeddings = await embeddingService.generateEmbeddings(chunks);
      console.log(`✅ Generated ${embeddings.length} embeddings`);

      // Store in vector database
      await vectorDbService.storeEmbeddings(sessionId, chunks, embeddings, metadata);

      return {
        chunksCount: chunks.length,
        sessionId,
      };
    } catch (error: any) {
      console.error('❌ Error embedding document:', error);
      throw new Error(`Document embedding failed: ${error.message}`);
    }
  }

  /**
   * Chat with document using RAG
   */
  async chat(
    sessionId: string,
    userMessage: string,
    chatHistory: ChatMessage[] = [],
    deepResearch = false
  ): Promise<ChatResponse> {
    try {
      console.log(`💬 Processing chat message for session ${sessionId}...`);

      // Generate embedding for user question
      const queryEmbedding = await embeddingService.generateQueryEmbedding(userMessage);

      // Search for relevant chunks in vector database with improved thresholds
      // Retrieve top 10 chunks with lower similarity threshold for better recall
      const relevantChunks = await vectorDbService.searchSimilar(
        queryEmbedding,
        sessionId,
        10, // Increased from 5 to get more context
        0.15 // Lowered from 0.25 for better recall (more lenient matching)
      );

      if (relevantChunks.length === 0) {
        // Fallback: Try with even lower threshold
        const fallbackChunks = await vectorDbService.searchSimilar(
          queryEmbedding,
          sessionId,
          5,
          0.05 // Very low threshold as fallback
        );

        if (fallbackChunks.length === 0) {
          return {
            response: "I couldn't find relevant information in this document to answer your question. Could you rephrase your question or ask about something else in the document?",
            sources: [],
          };
        }

        // Use fallback chunks if found
        relevantChunks.push(...fallbackChunks);
      }

      // Filter chunks by quality and remove duplicates
      const uniqueChunks = relevantChunks
        .filter(chunk => chunk.score && chunk.score > 0.05)
        .filter((chunk, index, self) =>
          index === self.findIndex(c => c.text.substring(0, 100) === chunk.text.substring(0, 100))
        );

      const contextChunks = uniqueChunks.slice(0, 8);

      // Build numbered context from local chunks only
      const context = contextChunks
        .map((chunk, i) => {
          // Use note title if available, otherwise generate smart fallback
          let title = chunk.metadata?.noteTitle || chunk.metadata?.title;
          if (!title) {
            // Generate context-aware title based on available metadata
            const sourceType = chunk.metadata?.sourceType || 'text';
            title = `${sourceType.charAt(0).toUpperCase() + sourceType.slice(1)} Passage ${i + 1}`;
          }
          const sourceType = chunk.metadata?.sourceType ? ` [${chunk.metadata.sourceType}]` : '';
          return `[${i + 1}] "${title}"${sourceType} (Relevance: ${(chunk.score * 100).toFixed(0)}%)\n${chunk.text}`;
        })
        .join('\n\n---\n\n');

      const systemInstruction = deepResearch
        ? `You are a knowledgeable tutor. You have access to Google Search — use it to find up-to-date information to supplement the user's local study material.

FORMAT YOUR ANSWER AS HTML:
- Use <p>, <b>, <h3>, <ul><li>, <ol><li>, <strong>

CRITICAL INSTRUCTIONS:
- Do NOT use inline citations (e.g., do not write "[1]", "[2]", or "(Source)").
- Do NOT output a bibliography, reference list, or "Sources" section at the end of your response.
- Do NOT output any markdown links for Google Search results.
- Weave the information naturally into your HTML answer without explicitly referencing where you got it from.

Answer in simple, conversational language. Combine Google Search and local material. Use examples and analogies.

Local study material:
${context}`: `You are a friendly and helpful tutor. Explain things naturally, like you're talking to a friend. Be warm and conversational, not stiff or robotic.

FORMAT YOUR ANSWER AS HTML:
- Use <p>, <b>, <h3>, <ul><li>, <ol><li>, <strong>

How to answer:
- Use simple, everyday language
- Only use information from the material below
- If you don't know from the material, say "I don't see that in the material"
- Break complex ideas into simple pieces; use examples and analogies
- Do NOT use inline citations (e.g., do not write "[1]", "[2]", or "(Source)").
- Do NOT output a bibliography, reference list, or "Sources" section at the end of your response.

Material to answer from:
${context}`;

      const messages = [
        ...chatHistory,
        { role: 'user' as const, content: userMessage },
      ];

      const response = deepResearch
        ? await geminiService.chatWithSearch(messages, systemInstruction)
        : await geminiService.chat(messages, systemInstruction);

      console.log(`✅ Generated chat response (${response.length} chars) using ${uniqueChunks.length} local chunks${deepResearch ? ' + native Google Search' : ''}`);

      // const sources = uniqueChunks.slice(0, 5).map(chunk => ({
      //   text: chunk.text.substring(0, 200) + '...',
      //   score: chunk.score,
      //   title: chunk.metadata?.noteTitle || chunk.metadata?.title,
      //   sourceType: chunk.metadata?.sourceType,
      // }));

      return {
        response,
        sources: [],
      };
    } catch (error: any) {
      console.error('❌ Error in chat:', error);
      throw new Error(`Chat failed: ${error.message}`);
    }
  }

  /**
   * Chat without RAG (simple conversation)
   */
  async simpleChat(
    userMessage: string,
    chatHistory: ChatMessage[] = []
  ): Promise<string> {
    try {
      const systemInstruction = `You are a helpful AI tutor assistant. Help users with their learning questions in a friendly, clear, and educational way.`;

      const messages = [
        ...chatHistory,
        { role: 'user' as const, content: userMessage },
      ];

      const response = await geminiService.chat(messages, systemInstruction);

      return response;
    } catch (error: any) {
      console.error('❌ Error in simple chat:', error);
      throw new Error(`Chat failed: ${error.message}`);
    }
  }

  /**
   * Summarize chat history
   */
  async summarizeChat(messages: ChatMessage[]): Promise<string> {
    try {
      const conversationText = messages
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n\n');

      const prompt = `Summarize this conversation in 2-3 sentences, focusing on the main topics discussed and key takeaways:

${conversationText}`;

      const summary = await geminiService.generateText(prompt);

      return summary;
    } catch (error: any) {
      console.error('❌ Error summarizing chat:', error);
      throw new Error(`Chat summarization failed: ${error.message}`);
    }
  }

  /**
   * Generate suggested follow-up questions
   */
  async generateFollowUpQuestions(
    sessionId: string,
    chatHistory: ChatMessage[]
  ): Promise<string[]> {
    try {
      const lastMessages = chatHistory.slice(-4);
      const conversationText = lastMessages
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n\n');

      const prompt = `Based on this conversation, suggest 3 relevant follow-up questions the user might want to ask:

${conversationText}

Return ONLY a JSON array of questions (no markdown):
["Question 1?", "Question 2?", "Question 3?"]`;

      const questions = await geminiService.generateJSON(prompt);

      return Array.isArray(questions) ? questions : [];
    } catch (error: any) {
      console.error('❌ Error generating follow-up questions:', error);
      return [];
    }
  }

  /**
   * Delete chat session and associated embeddings
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      await vectorDbService.deleteSession(sessionId);
      console.log(`✅ Deleted chat session ${sessionId}`);
    } catch (error: any) {
      console.error('❌ Error deleting session:', error);
      throw new Error(`Session deletion failed: ${error.message}`);
    }
  }

  /**
   * Check if session has embeddings
   */
  async hasEmbeddings(sessionId: string): Promise<boolean> {
    try {
      const count = await vectorDbService.countSessionPoints(sessionId);
      return count > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get session info
   */
  async getSessionInfo(sessionId: string) {
    try {
      const chunksCount = await vectorDbService.countSessionPoints(sessionId);

      return {
        sessionId,
        chunksCount,
        hasEmbeddings: chunksCount > 0,
      };
    } catch (error: any) {
      console.error('❌ Error getting session info:', error);
      throw new Error(`Failed to get session info: ${error.message}`);
    }
  }

  /**
   * Embed document from stored note (uses extractedContent for RAG)
   */
  async embedNoteDocument(
    noteId: string,
    sessionId: string
  ): Promise<{
    chunksCount: number;
    sessionId: string;
  }> {
    try {
      // Import Note model dynamically to avoid circular dependencies
      const NoteModel = (await import('../models/Note')).default;
      
      // Retrieve note from database
      const note = await NoteModel.findById(noteId);
      
      if (!note) {
        throw new Error(`Note not found: ${noteId}`);
      }

      // Use extractedContent if available (raw content before AI enhancement)
      // Falls back to content if extractedContent not set
      const contentToEmbed = note.extractedContent || note.transcriptText || note.content;
      
      if (!contentToEmbed) {
        throw new Error('No content available for embedding');
      }

      console.log(`📄 Embedding note ${noteId} for session ${sessionId} (extracted content: ${contentToEmbed.length} chars)`);

      // Use existing embedDocument method with retrieved content
      return await this.embedDocument(contentToEmbed, sessionId, {
        noteId: noteId.toString(),
        noteTitle: note.title,
        sourceType: note.sourceType,
      });
    } catch (error: any) {
      console.error('❌ Error embedding note document:', error);
      throw new Error(`Note embedding failed: ${error.message}`);
    }
  }
}

export default new ChatService();
