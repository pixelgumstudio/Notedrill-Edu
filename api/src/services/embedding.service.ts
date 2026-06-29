import { PredictionServiceClient } from '@google-cloud/aiplatform';
import { google } from '@google-cloud/aiplatform/build/protos/protos';

class EmbeddingService {
  private client: PredictionServiceClient;
  private endpoint: string;

  constructor() {
    try {
      const project = process.env.GOOGLE_PROJECT_ID;
      if (!project) {
        throw new Error('GOOGLE_PROJECT_ID environment variable is required for embedding service');
      }

      this.client = new PredictionServiceClient({
        apiEndpoint: 'us-central1-aiplatform.googleapis.com',
      });

      const location = process.env.GOOGLE_LOCATION || 'us-central1';

      this.endpoint = `projects/${project}/locations/${location}/publishers/google/models/text-embedding-004`;

      console.log('✅ Embedding service initialized');
    } catch (error) {
      console.error('❌ Error initializing embedding service:', error);
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

      const instance = {
        content: truncatedText,
        task_type: 'RETRIEVAL_DOCUMENT',
      };

      const request = {
        endpoint: this.endpoint,
        instances: [instance],
      };

      const response = await (this.client as any).predict(request);

      if (!response.predictions || response.predictions.length === 0) {
        throw new Error('No predictions returned from embedding service');
      }

      const prediction = response.predictions[0];
      const predictionObj = prediction.structValue?.fields;
      const embeddingsField = predictionObj?.embeddings?.structValue?.fields;
      const valuesField = embeddingsField?.values?.listValue?.values;

      if (!valuesField) {
        throw new Error('Invalid response structure from embedding service');
      }

      const embedding = valuesField.map((v: any) => v.numberValue);

      return embedding;
    } catch (error: any) {
      console.error('❌ Error generating embedding:', error);

      if (error.message?.includes('404') || error.message?.includes('NOT_FOUND')) {
        throw new Error('Embedding model not available. Please check your Google Cloud setup.');
      } else if (error.message?.includes('403') || error.message?.includes('PERMISSION_DENIED')) {
        throw new Error('Vertex AI API access denied. Please check your credentials.');
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

      // Process in batches to avoid API limits
      const batchSize = 5;
      const embeddings: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);

        // Truncate each text
        const truncatedBatch = batch.map(text => text.substring(0, 80000));

        const instances = truncatedBatch.map(text => ({
          content: text,
          task_type: 'RETRIEVAL_DOCUMENT',
        }));

        const request = {
          endpoint: this.endpoint,
          instances: instances as any,
        };

        const response = await (this.client as any).predict(request);

        if (!response.predictions || response.predictions.length === 0) {
          throw new Error('No predictions returned from embedding service');
        }

        for (const prediction of response.predictions) {
          const predictionObj = prediction.structValue?.fields;
          const embeddingsField = predictionObj?.embeddings?.structValue?.fields;
          const valuesField = embeddingsField?.values?.listValue?.values;

          if (!valuesField) {
            throw new Error('Invalid response structure from embedding service');
          }

          const embedding = valuesField.map((v: any) => v.numberValue);
          embeddings.push(embedding);
        }

        // Add small delay between batches to respect rate limits
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
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
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    try {
      const truncatedQuery = query.substring(0, 80000);

      const instance = {
        content: truncatedQuery,
        task_type: 'RETRIEVAL_QUERY',
      };

      const request = {
        endpoint: this.endpoint,
        instances: [instance as any],
      };

      const response = await (this.client as any).predict(request);

      if (!response.predictions || response.predictions.length === 0) {
        throw new Error('No predictions returned from embedding service');
      }

      const prediction = response.predictions[0];
      const predictionObj = prediction.structValue?.fields;
      const embeddingsField = predictionObj?.embeddings?.structValue?.fields;
      const valuesField = embeddingsField?.values?.listValue?.values;

      if (!valuesField) {
        throw new Error('Invalid response structure from embedding service');
      }

      const embedding = valuesField.map((v: any) => v.numberValue);

      return embedding;
    } catch (error: any) {
      console.error('❌ Error generating query embedding:', error);
      throw new Error(`Query embedding generation failed: ${error.message}`);
    }
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

export default new EmbeddingService();
