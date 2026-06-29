import { TranslationServiceClient } from '@google-cloud/translate';

interface TranslationResult {
  translatedText: string;
  detectedLanguageCode?: string;
}

// Google Cloud Translation API limits
const CHAR_LIMIT_PER_REQUEST = 500000; // 500KB per request
const CHUNK_SIZE = 5000; // Split into ~5KB chunks to be safe

class TranslationService {
  private client: TranslationServiceClient;
  private projectId: string;
  private location: string;

  constructor() {
    // Validate environment variables
    const projectId = process.env.GOOGLE_PROJECT_ID;
    const location = process.env.GOOGLE_LOCATION || 'us-central1';
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!projectId) {
      throw new Error('GOOGLE_PROJECT_ID environment variable is not set');
    }
    if (!credentials) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set');
    }

    this.projectId = projectId;
    this.location = location;
    this.client = new TranslationServiceClient();
    console.log('✅ Translation service initialized');
  }

  /**
   * Translate text to target language
   * @param text - Text to translate
   * @param targetLanguageCode - Target language (e.g., 'es', 'fr', 'de')
   * @param sourceLanguageCode - Optional source language (auto-detected if not provided)
   */
  async translateText(
    text: string,
    targetLanguageCode: string,
    sourceLanguageCode?: string
  ): Promise<TranslationResult> {
    try {
      if (!text || text.trim() === '') {
        throw new Error('Text to translate cannot be empty');
      }

      // Handle long texts by chunking
      const chunks = this.chunkText(text);
      
      if (chunks.length > 1) {
        console.log(`🌐 Translating large text (${text.length} chars) in ${chunks.length} chunks to ${targetLanguageCode}...`);
        
        // Translate all chunks
        const translatedChunks: string[] = [];
        for (let ci = 0; ci < chunks.length; ci++) {
          const chunk = chunks[ci];
          const parent = `projects/${this.projectId}/locations/${this.location}`;
          const request: any = {
            parent,
            contents: [chunk],
            targetLanguageCode,
            mimeType: 'text/plain',
          };

          if (sourceLanguageCode) {
            request.sourceLanguageCode = sourceLanguageCode;
          }

          const [response] = await this.client.translateText(request);
          const translation = response.translations?.[0];

          if (!translation?.translatedText) {
            console.error(`⚠️ Empty translation for chunk ${ci} (original ${chunk.length} chars)`);
            throw new Error('Translation API returned empty result for chunk');
          }

          // Log chunk sizes for debugging
          console.log(`   [translateText] chunk ${ci + 1}/${chunks.length}: original=${chunk.length} chars, translated=${String(translation.translatedText).length} chars`);

          translatedChunks.push(translation.translatedText);
        }

        const combinedText = translatedChunks.join(' ').trim();
        console.log('✅ Translation successful (combined from chunks)');

        return {
          translatedText: combinedText,
          detectedLanguageCode: undefined, // Unable to detect from chunks
        };
      } else {
        // Single chunk translation
        const parent = `projects/${this.projectId}/locations/${this.location}`;

        const request: any = {
          parent,
          contents: [text],
          targetLanguageCode,
          mimeType: 'text/plain',
        };

        // Only add source language if provided
        if (sourceLanguageCode) {
          request.sourceLanguageCode = sourceLanguageCode;
        }

        console.log(`🌐 Translating text to ${targetLanguageCode}...`);
        const [response] = await this.client.translateText(request);

        const translation = response.translations?.[0];

        if (!translation?.translatedText) {
          throw new Error('Translation API returned empty result');
        }

        console.log('✅ Translation successful');

        return {
          translatedText: translation.translatedText,
          detectedLanguageCode: translation.detectedLanguageCode || undefined,
        };
      }
    } catch (error: any) {
      console.error('❌ Translation API Error:', {
        message: error.message,
        code: error.code,
      });

      // Provide user-friendly error messages
      if (error.code === 7 || error.code === 'PERMISSION_DENIED') {
        throw new Error('Translation API not enabled. Please enable Cloud Translation API in Google Cloud Console.');
      }
      if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
        if (error.message?.includes('Text is too long')) {
          throw new Error('Text is too long to translate. Please split into smaller sections.');
        }
        throw new Error(`Invalid language code or request: ${error.message}`);
      }

      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  /**
   * Split text into chunks that respect API limits
   */
  private chunkText(text: string, chunkSize: number = CHUNK_SIZE): string[] {
    if (text.length <= chunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      // Try to find a sentence boundary (. ! ?) within the chunk
      const endIndex = Math.min(startIndex + chunkSize, text.length);
      let actualEnd = endIndex;

      if (endIndex < text.length) {
        // Look backwards for sentence boundary
        for (let i = endIndex; i > startIndex; i--) {
          if (['.', '!', '?', '\n'].includes(text[i])) {
            actualEnd = i + 1;
            break;
          }
        }
        // If no sentence boundary found, use space boundary
        if (actualEnd === endIndex) {
          for (let i = endIndex; i > startIndex; i--) {
            if (text[i] === ' ') {
              actualEnd = i;
              break;
            }
          }
        }
      }

      const chunk = text.substring(startIndex, actualEnd).trim();
      if (chunk) {
        chunks.push(chunk);
      }
      startIndex = actualEnd;
    }

    return chunks;
  }

  /**
   * Batch translate multiple texts
   */
  async translateBatch(
    texts: string[],
    targetLanguageCode: string,
    sourceLanguageCode?: string
  ): Promise<TranslationResult[]> {
    try {
      // Chunk texts that are too long
      const chunkedTexts: string[] = [];
      const textMapping: { originalIndex: number; chunkIndex: number }[] = [];

      texts.forEach((text, idx) => {
        const chunks = this.chunkText(text);
        chunks.forEach((chunk, chunkIdx) => {
          chunkedTexts.push(chunk);
          textMapping.push({ originalIndex: idx, chunkIndex: chunkIdx });
        });
      });

      console.log(`🌐 Batch translating ${texts.length} texts (${chunkedTexts.length} chunks) to ${targetLanguageCode}...`);

      // Translate chunks in batches of 50 to avoid API limits
      const BATCH_SIZE = 50;
      const allTranslations: any[] = [];

      for (let i = 0; i < chunkedTexts.length; i += BATCH_SIZE) {
        const batchChunks = chunkedTexts.slice(i, i + BATCH_SIZE);
        console.log(`   Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunkedTexts.length / BATCH_SIZE)} (${batchChunks.length} chunks)...`);

        const parent = `projects/${this.projectId}/locations/${this.location}`;

        const request: any = {
          parent,
          contents: batchChunks,
          targetLanguageCode,
          mimeType: 'text/plain',
        };

        if (sourceLanguageCode) {
          request.sourceLanguageCode = sourceLanguageCode;
        }

        const [response] = await this.client.translateText(request);

        if (!response.translations || response.translations.length === 0) {
          throw new Error(`Translation API returned no results for batch at offset ${i}`);
        }

        console.log(`   [translateBatch] batch ${Math.floor(i / BATCH_SIZE) + 1} returned ${response.translations.length} translations`);
        response.translations.forEach((t: any, idx: number) => {
          console.log(`      → translation ${idx + 1}: ${String(t.translatedText || '').length} chars`);
        });

        allTranslations.push(...response.translations);
      }

      // Reconstruct original texts from chunks
      const translatedTexts: TranslationResult[] = [];
      const chunksByOriginal: { [key: number]: string[] } = {};

      // Build a map of which chunks belong to which original text
      for (let i = 0; i < textMapping.length; i++) {
        const mapping = textMapping[i];
        if (i < allTranslations.length) {
          if (!chunksByOriginal[mapping.originalIndex]) {
            chunksByOriginal[mapping.originalIndex] = [];
          }
          chunksByOriginal[mapping.originalIndex][mapping.chunkIndex] = allTranslations[i].translatedText || '';
        }
      }

      console.log(`   Reconstructing ${texts.length} original texts from chunks...`);

      // Combine chunks back into original text order
      for (let i = 0; i < texts.length; i++) {
        const chunks = chunksByOriginal[i] || [];
        console.log(`   Text ${i+1}: ${chunks.length} chunks, original size: ${texts[i].length} chars`);
        const reconstructed = chunks.join(' ').trim();
        console.log(`   Text ${i+1}: reconstructed size: ${reconstructed.length} chars`);
        translatedTexts.push({
          translatedText: reconstructed,
          detectedLanguageCode: allTranslations[0]?.detectedLanguageCode || undefined,
        });
      }

      console.log('✅ Batch translation successful');
      return translatedTexts;
    } catch (error: any) {
      console.error('❌ Batch Translation Error:', {
        message: error.message,
        code: error.code,
      });

      // Provide user-friendly error messages
      if (error.code === 7 || error.code === 'PERMISSION_DENIED') {
        throw new Error('Translation API not enabled. Please enable Cloud Translation API in Google Cloud Console.');
      }
      if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
        // Check if it's a text length issue
        if (error.message.includes('Text is too long')) {
          throw new Error('Note content is too long to translate. Please try with shorter content.');
        }
        throw new Error(`Invalid language code or request: ${error.message}`);
      }

      throw new Error(`Batch translation failed: ${error.message}`);
    }
  }
}

// Export singleton instance
export default new TranslationService();
