import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';

interface SearchResult {
  text: string;
  score: number;
  chunkIndex: number;
  metadata?: any;
}

class VectorDbService {
  private client!: QdrantClient;
  private collectionName = 'documents';
  private initializePromise: Promise<void>;

  constructor() {
    try {
      this.client = new QdrantClient({
        url: process.env.QDRANT_URL || 'http://localhost:6333',
        apiKey: process.env.QDRANT_API_KEY,
      });

      // Store the initialization promise so it can be awaited if needed
      this.initializePromise = this.ensureCollectionExists()
        .then(() => {
          console.log('✅ Vector database service initialized');
        })
        .catch((error) => {
          console.error('❌ Error initializing vector database:', error);
          throw error;
        });
    } catch (error) {
      console.error('❌ Error initializing vector database:', error);
      this.initializePromise = Promise.reject(error);
    }
  }

  /**
   * Wait for initialization to complete
   */
  async waitForInitialization(): Promise<void> {
    await this.initializePromise;
  }

  /**
   * Ensure collection exists, create if it doesn't
   */
  private async ensureCollectionExists() {
    try {
      await this.client.getCollection(this.collectionName);
      console.log(`✅ Collection '${this.collectionName}' exists`);
    } catch (error) {
      // Collection doesn't exist, create it
      console.log(`📦 Creating collection '${this.collectionName}'...`);

      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: 768, // text-embedding-004 dimension
          distance: 'Cosine',
        },
      });

      console.log(`✅ Collection '${this.collectionName}' created`);
    }
  }

  /**
   * Store embeddings for a session
   */
  async storeEmbeddings(
    sessionId: string,
    chunks: string[],
    embeddings: number[][],
    metadata: any = {}
  ): Promise<void> {
    try {
      console.log(`💾 Storing ${chunks.length} embeddings for session ${sessionId}...`);

      const points = chunks.map((chunk, i) => ({
        id: uuidv4(),
        vector: embeddings[i],
        payload: {
          text: chunk,
          sessionId,
          chunkIndex: i,
          ...metadata,
        },
      }));

      await this.client.upsert(this.collectionName, {
        wait: true,
        points,
      });

      console.log(`✅ Stored ${points.length} embeddings`);
    } catch (error: any) {
      console.error('❌ Error storing embeddings:', error);
      throw new Error(`Failed to store embeddings: ${error.message}`);
    }
  }

  /**
   * Search for similar chunks
   */
  async searchSimilar(
    queryEmbedding: number[],
    sessionId: string,
    limit: number = 5,
    scoreThreshold: number = 0.5
  ): Promise<SearchResult[]> {
    try {
      console.log(`🔍 Searching for similar chunks in session ${sessionId}...`);

      const results = await this.client.search(this.collectionName, {
        vector: queryEmbedding,
        filter: {
          must: [{ key: 'sessionId', match: { value: sessionId } }],
        },
        limit,
        with_payload: true,
        score_threshold: scoreThreshold,
      });

      const searchResults = results
        .filter(result => result.payload?.text) // Filter out results without text
        .map(result => ({
          text: (result.payload?.text as string) || '',
          score: result.score || 0,
          chunkIndex: typeof result.payload?.chunkIndex === 'number'
            ? result.payload.chunkIndex
            : 0,
          metadata: result.payload || {},
        }));

      console.log(`✅ Found ${searchResults.length} similar chunks`);

      return searchResults;
    } catch (error: any) {
      console.error('❌ Error searching embeddings:', error);
      throw new Error(`Failed to search embeddings: ${error.message}`);
    }
  }

  /**
   * Delete all embeddings for a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      console.log(`🗑️ Deleting embeddings for session ${sessionId}...`);

      await this.client.delete(this.collectionName, {
        filter: {
          must: [{ key: 'sessionId', match: { value: sessionId } }],
        },
      });

      console.log(`✅ Deleted embeddings for session ${sessionId}`);
    } catch (error: any) {
      console.error('❌ Error deleting session:', error);
      throw new Error(`Failed to delete session: ${error.message}`);
    }
  }

  /**
   * Get collection info
   */
  async getCollectionInfo() {
    try {
      const info = await this.client.getCollection(this.collectionName);
      return {
        pointsCount: info.points_count,
        vectorsCount: (info as any).vectors_count || info.points_count,
        status: info.status,
      };
    } catch (error: any) {
      console.error('❌ Error getting collection info:', error);
      throw new Error(`Failed to get collection info: ${error.message}`);
    }
  }

  /**
   * Count points for a session
   */
  async countSessionPoints(sessionId: string): Promise<number> {
    try {
      const result = await this.client.count(this.collectionName, {
        filter: {
          must: [{ key: 'sessionId', match: { value: sessionId } }],
        },
      });

      return result.count || 0;
    } catch (error: any) {
      console.error('❌ Error counting points:', error);
      throw new Error(`Failed to count points: ${error.message}`);
    }
  }

  /**
   * Check if vector database is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.client.getCollections();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all collections
   */
  async getCollections() {
    try {
      const collections = await this.client.getCollections();
      return collections.collections;
    } catch (error: any) {
      console.error('❌ Error getting collections:', error);
      throw new Error(`Failed to get collections: ${error.message}`);
    }
  }
}

export default new VectorDbService();
