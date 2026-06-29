import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Embedding service using Gemini API instead of Vertex AI
 * Simpler setup - only requires GEMINI_API_KEY
 */
class GeminiEmbeddingService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    try {
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey || apiKey.trim() === '') {
        throw new Error('GEMINI_API_KEY environment variable is required for embedding service');
      }

      this.genAI = new GoogleGenerativeAI(apiKey);
      // Use models/embedding-001 with full model name (required for Gemini API)
      this.model = this.genAI.getGenerativeModel({ model: 'models/embedding-001' });

      console.log('✅ Gemini Embedding service initialized (models/embedding-001)');
    } catch (error) {
      console.error('❌ Error initializing Gemini embedding service:', error);
      throw error;
    }
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Truncate text if too long (max 20K tokens ≈ 80K characters)
      const truncatedText = text.substring(0, 80000);

      const result = await this.model.embedContent(truncatedText);

      if (!result.embedding || !result.embedding.values) {
        throw new Error('No embedding values returned from Gemini API');
      }

      return result.embedding.values;
    } catch (error: any) {
      console.error('❌ Error generating embedding:', error);

      if (error.message?.includes('404') || error.message?.includes('NOT_FOUND')) {
        throw new Error('Embedding model not available. Please check your Gemini API setup.');
      } else if (error.message?.includes('403') || error.message?.includes('PERMISSION_DENIED')) {
        throw new Error('Gemini API access denied. Please check your API key.');
      }

      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      console.log(`📊 Generating embeddings for ${texts.length} texts...`);

      const embeddings: number[][] = [];

      // Process texts sequentially to avoid rate limits
      for (const text of texts) {
        const embedding = await this.generateEmbedding(text);
        embeddings.push(embedding);

        // Add small delay between requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`✅ Generated ${embeddings.length} embeddings`);
      return embeddings;
    } catch (error: any) {
      console.error('❌ Error generating embeddings:', error);
      throw new Error(`Batch embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Generate query embedding (optimized for search)
   * Note: Gemini API uses the same model for both documents and queries
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    return this.generateEmbedding(query);
  }

  /**
   * Check if embedding service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.generateEmbedding('test');
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default new GeminiEmbeddingService();
