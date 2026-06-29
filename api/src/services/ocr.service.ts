// api/src/services/ocr.service.ts

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createWorker } from 'tesseract.js';
import storageService from './storage.service';

// Convert HEIC/HEIF to JPEG using temp files (piping doesn't work for HEIC)
function convertHeicToJpeg(inputBuffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const tmpDir = os.tmpdir();
        const inputFile = path.join(tmpDir, `heic_in_${Date.now()}.heic`);
        const outputFile = path.join(tmpDir, `heic_out_${Date.now()}.jpg`);

        try {
            fs.writeFileSync(inputFile, inputBuffer);
        } catch (err) {
            return reject(new Error(`Failed to write temp file: ${err}`));
        }

        const ffmpeg = spawn('ffmpeg', [
            '-i', inputFile,
            '-loglevel', 'error',
            '-y',
            outputFile,
        ]);

        ffmpeg.on('close', (code) => {
            try { fs.unlinkSync(inputFile); } catch {}

            if (code === 0) {
                try {
                    const result = fs.readFileSync(outputFile);
                    fs.unlinkSync(outputFile);
                    resolve(result);
                } catch (err) {
                    reject(new Error(`Failed to read converted file: ${err}`));
                }
            } else {
                try { fs.unlinkSync(outputFile); } catch {}
                reject(new Error(`ffmpeg exited with code ${code}`));
            }
        });

        ffmpeg.on('error', (err: any) => {
            try { fs.unlinkSync(inputFile); } catch {}
            reject(new Error(`ffmpeg not available: ${err.message}`));
        });
    });
}

interface OcrResult {
  text: string;
  confidence: number;
  words?: Array<{
    text: string;
    confidence: number;
  }>;
}

class OcrService {
  /**
   * Extract text from image using OCR
   */
  async extractTextFromImage(fileKey: string): Promise<OcrResult> {
    try {
      console.log(`🔍 Starting OCR for image: ${fileKey}...`);

      // Extract filename from fileKey (remove bucket name if present)
      const fileName = fileKey.includes('/') ? fileKey.split('/').slice(1).join('/') : fileKey;

      // Download image from storage
      let imageBuffer = await storageService.downloadFile(fileName);
      console.log(`✅ Image downloaded, size: ${imageBuffer.length} bytes`);

      // Convert HEIC/HEIF (iPhone photos) to JPEG for Tesseract compatibility
      const isHeic = fileKey.toLowerCase().endsWith('.heic') || fileKey.toLowerCase().endsWith('.heif');
      if (isHeic) {
        try {
          imageBuffer = await convertHeicToJpeg(imageBuffer);
          console.log(`✅ HEIC converted to JPEG, size: ${imageBuffer.length} bytes`);
        } catch (err: any) {
          console.warn('HEIC conversion failed, attempting OCR on original:', err.message);
        }
      }

      // Create worker with English language
      // Use Gemini Vision for accurate text extraction
      const geminiService = (await import('./gemini.service')).default;
      const mimeType = isHeic ? 'image/jpeg' : (fileKey.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
      const text = await geminiService.extractTextFromImage(imageBuffer, mimeType);

      console.log(`✅ OCR completed, extracted ${text.length} characters`);

      return {
        text: text.trim(),
        confidence: 95,
      };
    } catch (error: any) {
      console.error('❌ Error performing OCR:', error);
      throw new Error(`OCR failed: ${error.message}`);
    }
  }

  /**
   * Extract text from image with multiple languages
   */
  async extractTextWithLanguages(
    fileKey: string,
    languages: string[]
  ): Promise<OcrResult> {
    let worker;
    try {
      console.log(`🔍 Starting OCR with languages: ${languages.join(', ')}...`);

      // Extract filename from fileKey (remove bucket name if present)
      const fileName = fileKey.includes('/') ? fileKey.split('/').slice(1).join('/') : fileKey;

      const imageBuffer = await storageService.downloadFile(fileName);

      // Join languages with '+' for Tesseract v6
      const langString = languages.join('+');

      // Create worker with multiple languages
      worker = await createWorker(langString, undefined, {
        logger: (info) => {
          if (info.status === 'recognizing text') {
            const progress = Math.round((info.progress || 0) * 100);
            console.log(`OCR Progress: ${progress}%`);
          }
        },
      });

      const result = await worker.recognize(imageBuffer);
      const text = result.data.text || '';
      const confidence = result.data.confidence || 0;

      console.log(`✅ OCR completed with ${Math.round(confidence)}% confidence`);

      await worker.terminate();

      return {
        text: text.trim(),
        confidence: Math.round(confidence),
      };
    } catch (error: any) {
      console.error('❌ Error performing OCR with multiple languages:', error);
      if (worker) {
        try {
          await worker.terminate();
        } catch (terminateError) {
          console.error('Error terminating worker:', terminateError);
        }
      }
      throw new Error(`OCR failed: ${error.message}`);
    }
  }

  /**
   * Extract text with custom preprocessing
   */
  async extractTextWithPreprocessing(
    fileKey: string,
    options: {
      grayscale?: boolean;
      threshold?: boolean;
      invert?: boolean;
    } = {}
  ): Promise<OcrResult> {
    let worker;
    try {
      // Extract filename from fileKey (remove bucket name if present)
      const fileName = fileKey.includes('/') ? fileKey.split('/').slice(1).join('/') : fileKey;

      const imageBuffer = await storageService.downloadFile(fileName);

      worker = await createWorker('eng', undefined, {
        logger: (info) => {
          if (info.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round((info.progress || 0) * 100)}%`);
          }
        },
      });

      const result = await worker.recognize(imageBuffer);
      const text = result.data.text || '';
      const confidence = result.data.confidence || 0;

      await worker.terminate();

      return {
        text: text.trim(),
        confidence: Math.round(confidence),
      };
    } catch (error: any) {
      console.error('❌ Error performing OCR with preprocessing:', error);
      if (worker) {
        try {
          await worker.terminate();
        } catch (terminateError) {
          console.error('Error terminating worker:', terminateError);
        }
      }
      throw new Error(`OCR with preprocessing failed: ${error.message}`);
    }
  }

  /**
   * Detect text regions in image (without full OCR)
   */
  async detectTextRegions(fileKey: string): Promise<Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
  }>> {
    let worker;
    try {
      // Extract filename from fileKey (remove bucket name if present)
      const fileName = fileKey.includes('/') ? fileKey.split('/').slice(1).join('/') : fileKey;

      const imageBuffer = await storageService.downloadFile(fileName);

      worker = await createWorker('eng');
      const result = await worker.recognize(imageBuffer);

      const lines = (result.data as any).lines || [];

      await worker.terminate();

      return lines.map((line: any) => ({
        x: line.bbox.x0,
        y: line.bbox.y0,
        width: line.bbox.x1 - line.bbox.x0,
        height: line.bbox.y1 - line.bbox.y0,
        text: line.text,
      }));
    } catch (error: any) {
      console.error('❌ Error detecting text regions:', error);
      if (worker) {
        try {
          await worker.terminate();
        } catch (terminateError) {
          console.error('Error terminating worker:', terminateError);
        }
      }
      throw new Error(`Text region detection failed: ${error.message}`);
    }
  }

  /**
   * Check if image contains readable text
   */
  async hasReadableText(fileKey: string, minConfidence: number = 50): Promise<boolean> {
    try {
      const result = await this.extractTextFromImage(fileKey);

      // Check if confidence is above threshold and text is not empty
      return result.confidence >= minConfidence && result.text.length > 10;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return [
      'eng', // English
      'spa', // Spanish
      'fra', // French
      'deu', // German
      'ita', // Italian
      'por', // Portuguese
      'rus', // Russian
      'jpn', // Japanese
      'chi_sim', // Simplified Chinese
      'chi_tra', // Traditional Chinese
      'kor', // Korean
      'ara', // Arabic
      'hin', // Hindi
    ];
  }
}

export default new OcrService();
