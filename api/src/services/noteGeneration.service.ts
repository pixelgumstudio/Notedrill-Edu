// api/src/services/noteGeneration.service.ts
import geminiService from './gemini.service';

class NoteGenerationService {
  /**
   * Generate note from content (transcript, text, PDF, etc.)
   */
  async generateNote(
    content: string,
    contentType: string,
    userPreferences?: any
  ): Promise<{ title: string; summary?: string; content: string }> {
    try {
      const goals = userPreferences?.goals?.join(', ') || 'general learning';
      const noteStyle = userPreferences?.noteStyle || 'balanced';

      const prompt = this.buildNotePrompt(content, contentType, goals, noteStyle);

      const parsed = await geminiService.generateJSON(prompt);

      let title = '';
      let noteContent = '';
      try {
        title = String(parsed.title || '').trim().substring(0, 50);
        noteContent = String(parsed.content || '');
        if (!noteContent) throw new Error('content field is empty');
      } catch (parseError: any) {
        throw new Error(`Malformed AI response: ${parseError.message}`);
      }

      // Refusal detection outside the parse try/catch so the error propagates cleanly
      const REFUSAL_PATTERNS = ['no material was provided', 'no content was provided', 'nothing to summarize', 'no source material'];
      const isRefusal = REFUSAL_PATTERNS.some(p => noteContent.toLowerCase().includes(p));
      if (isRefusal) {
        throw new Error('AI_REFUSAL: Extracted content was insufficient to generate meaningful notes');
      }

      return {
        title,
        summary: 'Study notes generated from ' + contentType,
        content: noteContent,
      };
    } catch (error: any) {
      console.error('❌ Error generating note:', error);
      throw new Error(`Note generation failed: ${error.message}`);
    }
  }

  /**
   * Build intelligent note generation prompt that adapts based on content type
   */
  private buildNotePrompt(
    content: string,
    contentType: string,
    goals: string,
    noteStyle: string
  ): string {
    const detectedType = this.detectContentType(content);
    const typeGuidance = this.getTypeSpecificGuidance(detectedType);

    // Scale note length to content length
    const wordCount = content.trim().split(/\s+/).length;
    const lengthInstruction =
      wordCount < 100
        ? 'The source is very short. Keep your notes brief — 1 to 2 short sections maximum.'
        : wordCount < 300
        ? 'The source is short. Keep your notes concise — only cover what is explicitly in the material.'
        : wordCount < 800
        ? 'Write notes proportional to the content — do not pad or expand beyond what is in the source.'
        : 'Cover the material thoroughly but stay within what the source contains.';

    return `You are a note-taking assistant. Your job is to analyze the provided material and create organized, structured notes that capture the key information.

Respond with a single JSON object matching this exact schema:
{
  "title": "string (max 50 characters — a concise, descriptive title for the notes)",
  "content": "string (HTML-formatted notes body)"
}

CRITICAL RULES:
1. Use ONLY information that is explicitly stated in the source material below.
2. Do NOT add examples, context, explanations, or facts that are not in the source.
3. Do NOT expand on topics beyond what the source covers.
4. ${lengthInstruction}
5. Use simple HTML formatting for the content field — no markdown symbols (**, ##, --, etc).
6. CRITICAL JSON RULES:
   - Output pure JSON only
   - All double quotes INSIDE string values (including inside HTML content) MUST be escaped as \"
   - All newlines INSIDE string values MUST be written as \\n (the literal two-character sequence)
   - Do NOT use actual line breaks inside any JSON string value
   - For HTML attributes, use single quotes: <p class='main'> NOT <p class="main">

HTML formatting rules for the content field:
- <h3> for section headings
- <p> for paragraphs
- <ul><li> for bullet lists
- <b> or <strong> for emphasis
- No markdown, only HTML tags

Content type: ${detectedType.toUpperCase()}
Focus: ${typeGuidance}

IMPORTANT: Adapt your note-taking style to the content:
- For educational/textbook material: Create concept-based study notes with clear explanations
- For financial/transaction documents: Summarize key figures, totals, patterns, and important transactions
- For reports/articles: Extract main points, conclusions, and significant findings
- For other documents: Organize the most important information in a clear, logical structure

--- SOURCE MATERIAL ---
${content}
--- END OF SOURCE MATERIAL ---

Structure the content value like this (omit sections if the source doesn't have enough material for them):

<h3>Overview</h3>
<p>[1-2 sentences summarising what this material is about, using only what is stated in the source]</p>

<h3>Key Points</h3>
[The main ideas from the source, in clear language]

<h3>Details</h3>
[Specific facts, steps, or details from the source — only if the source contains them]

<h3>Summary</h3>
[The most important takeaways from the source — no new information]

Return ONLY the JSON object. No markdown code blocks, no surrounding text.`;
  }

  /**
   * Detect content type from actual content
   */
  private detectContentType(content: string): string {
    const lowerContent = content.toLowerCase().substring(0, 2000);

    // Crime/Mystery
    if (
      /murder|crime|detective|suspect|investigation|criminal|accused|murder|detective|suspect/i.test(
        content
      )
    ) {
      return 'crime/mystery';
    }

    // Fiction/Literature
    if (
      /once upon|character|protagonist|dialogue|novel|chapter|story|fiction|plot|narrative|author/i.test(
        content
      )
    ) {
      return 'fiction/literature';
    }

    // Scientific/Educational
    if (
      /research|study|evidence|hypothesis|experiment|scientific|theory|data|analysis|method|conclusion/i.test(
        content
      )
    ) {
      return 'scientific/educational';
    }

    // Business/Economics
    if (
      /business|market|economics|profit|revenue|investment|company|strategy|management|finance/i.test(
        content
      )
    ) {
      return 'business/economics';
    }

    // History
    if (/historical|war|century|empire|revolution|dynasty|period|era|timeline|ancient/i.test(content)) {
      return 'history';
    }

    // Biography
    if (/born|life of|biography|achieved|contribution|career|accomplishment|legacy/i.test(content)) {
      return 'biography';
    }

    // Technology/Programming
    if (/code|software|algorithm|function|database|system|program|tech|digital|cyber/i.test(content)) {
      return 'technology/programming';
    }

    // Medical/Health
    if (/disease|patient|treatment|medical|health|symptom|diagnosis|therapy|doctor|clinical/i.test(content)) {
      return 'medical/health';
    }

    // Art/Culture
    if (/art|painting|sculpture|culture|music|aesthetic|artist|creative|style|movement/i.test(content)) {
      return 'art/culture';
    }

    return 'general knowledge';
  }

  /**
   * Get type-specific guidance for the AI
   */
  private getTypeSpecificGuidance(contentType: string): string {
    const guidance: { [key: string]: string } = {
      'crime/mystery':
        'Focus on: Plot timeline, suspects and motives, evidence and clues, investigative techniques, logical deductions, key revelations. Emphasize how evidence supports conclusions.',

      'fiction/literature':
        'Focus on: Characters and development, plot structure, themes and symbolism, literary devices, writing style, lessons and messages. Help readers understand motivations and emotional arcs.',

      'scientific/educational':
        'Focus on: Core theories and concepts, evidence and experimental support, step-by-step processes, practical applications, mathematical formulas if relevant. Make complex science accessible without losing accuracy.',

      'business/economics':
        'Focus on: Business models and strategies, market analysis, economic principles, financial insights, competitive landscape, practical takeaways. Explain economic concepts in business context.',

      'history':
        'Focus on: Timeline of events, key figures and roles, causes and consequences, political/social context, cultural significance, connections showing patterns and cause-effect relationships.',

      'biography':
        'Focus on: Life milestones and achievements, challenges overcome, contributions and legacy, historical era context, personal qualities and their impact. Show how their journey led to accomplishments.',

      'technology/programming':
        'Focus on: Concepts and principles, how systems work, practical applications, step-by-step guides if applicable, common patterns and best practices, real-world examples.',

      'medical/health':
        'Focus on: Medical concepts and terminology, causes and symptoms, treatment options, prevention strategies, relevant statistics and research, practical health information. Be accurate but accessible.',

      'art/culture':
        'Focus on: Historical and cultural context, artistic techniques and styles, cultural significance, major movements and periods, notable figures, impact on society and other art forms.',

      'general knowledge':
        'Create well-structured, comprehensive notes covering all major points. Ensure logical flow and clear explanations suitable for any subject.',
    };

    return guidance[contentType] || guidance['general knowledge'];
  }
 

  /**
   * Generate note from YouTube video
   */
  async generateNoteFromYouTube(
    transcript: string,
    videoTitle: string,
    userPreferences?: any
  ): Promise<{ title: string; summary?: string; content: string }> {
    try {
      const result = await this.generateNote(transcript, 'YouTube video', userPreferences);
      result.title = videoTitle;
      return result;
    } catch (error: any) {
      throw new Error(`YouTube note generation failed: ${error.message}`);
    }
  }

  /**
   * Enhance existing note
   */
  async enhanceNote(existingContent: string): Promise<string> {
    try {
      const prompt = `Enhance and improve these study notes. Make them clearer, better organized, and more comprehensive:

${existingContent}

Keep the same general structure but improve:
- Clarity and readability
- Organization and flow
- Add missing explanations
- Include helpful examples

Return the enhanced notes in standard HTML format using <h3>, <p>, <ul>, <li>, and <b>. Do not use markdown. Do not wrap in JSON.`;

      return await geminiService.generateText(prompt);
    } catch (error: any) {
      throw new Error(`Note enhancement failed: ${error.message}`);
    }
  }

  /**
   * Summarize note
   */
  async summarizeNote(noteContent: string, maxLength: number = 500): Promise<string> {
    try {
      const prompt = `Create a clear, informative summary of these study notes in ${maxLength} characters or less.

${noteContent}

Your summary should:
• Capture the main topic and why it matters
• Include the 3-5 most important concepts or takeaways
• Be written in clear, simple language
• Help students quickly understand what these notes cover
• Be engaging and make them want to read the full notes

Write in a friendly, conversational tone. Focus on what students NEED to know, not just listing topics.`;

      return await geminiService.generateText(prompt);
    } catch (error: any) {
      throw new Error(`Note summarization failed: ${error.message}`);
    }
  }
}

export default new NoteGenerationService();
