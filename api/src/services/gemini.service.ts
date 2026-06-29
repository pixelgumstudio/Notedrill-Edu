// apps/api/src/services/gemini.service.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { safeParseJSON } from '../utils/jsonParser';

class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;

  private initializeGenAI(): GoogleGenerativeAI {
    if (this.genAI) {
      return this.genAI;
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.trim() === '') {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    console.log('✅ Gemini service initialized');
    return this.genAI;
  }

  async generateText(prompt: string): Promise<string> {
    try {
      const genAI = this.initializeGenAI();
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",  // Verified available model
        generationConfig: {
          maxOutputTokens: 8192 // 🚀 Added to prevent long text cutoffs
        }
      });

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      const finalText = String(text || '').trim();

      if (!finalText) {
        throw new Error('Empty response from Gemini API');
      }

      console.log('✅ Generated text successfully, length:', finalText.length);
      return finalText;

    } catch (error: any) {
      console.error('❌ Gemini API Error:', {
        message: error.message,
        status: error.status
      });

      throw new Error(`AI generation failed: ${error.message}`);
    }
  }

  async generateJSON(prompt: string): Promise<any> {
    try {
      const genAI = this.initializeGenAI();
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",  // Verified available model
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 8192 // 🚀 Force a massive limit to prevent mid-JSON cutoff
        }
      });

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      const finalText = String(text || '').trim();

      if (!finalText) {
        throw new Error('Empty response from Gemini API');
      }

      let cleanText: string;
      const fenceMatch = finalText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) {
        cleanText = fenceMatch[1].trim();
      } else {
        const jsonMatch = finalText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        cleanText = jsonMatch ? jsonMatch[1] : finalText;
      }

      let jsonData: any;
      try {
        jsonData = safeParseJSON<any>(cleanText);
      } catch (parseError: any) {
        console.error('Malformed JSON from Gemini:', cleanText.substring(0, 500));
        throw new Error(`Failed to parse JSON response: ${parseError.message}`);
      }

      console.log('✅ Generated JSON successfully');
      return jsonData;

    } catch (error: any) {
      console.error('❌ Gemini API Error:', {
        message: error.message,
        status: error.status
      });

      throw new Error(`AI generation failed: ${error.message}`);
    }
  }

  async extractTextFromImage(imageBuffer: Buffer, mimeType: string = 'image/jpeg'): Promise<string> {
    try {
      const genAI = this.initializeGenAI();
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const result = await model.generateContent([
        {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType,
          },
        },
        'Extract ALL text from this image exactly as it appears. Preserve the original wording, order, and structure. Do NOT summarize, interpret, or add anything. Return only the raw text found in the image.',
      ]);

      const text = result.response.text().trim();
      console.log('✅ Gemini Vision OCR completed, length:', text.length);
      return text;
    } catch (error: any) {
      console.error('❌ Gemini Vision OCR Error:', error.message);
      throw new Error(`Image text extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract all text from a PDF buffer using Gemini's native PDF understanding.
   * Supports scanned/image-based PDFs that pdf-parse cannot handle.
   * Inline limit: ~20 MB. Throws for oversized files so callers can decide.
   */
  async extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
    const MAX_INLINE_BYTES = 19 * 1024 * 1024; // 19 MB — safe margin under 20 MB API cap
    if (pdfBuffer.length > MAX_INLINE_BYTES) {
      throw new Error(
        `PDF is ${(pdfBuffer.length / 1024 / 1024).toFixed(1)} MB — exceeds Gemini's 19 MB inline limit. ` +
        `Please compress or split the PDF and try again.`
      );
    }

    console.log(
      `🔍 Gemini PDF Vision OCR — ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB PDF`
    );

    try {
      const genAI = this.initializeGenAI();
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { maxOutputTokens: 8192 },
      });

      const result = await model.generateContent([
        {
          inlineData: {
            data: pdfBuffer.toString('base64'),
            mimeType: 'application/pdf',
          },
        },
        'Extract ALL text from this PDF document exactly as it appears. Preserve paragraphs, headings, and structure. Do NOT summarize or interpret — return only the raw extracted text.',
      ]);

      const text = result.response.text().trim();
      console.log(`✅ Gemini PDF Vision OCR complete — ${text.length} chars extracted`);
      return text;
    } catch (error: any) {
      console.error('❌ Gemini PDF Vision OCR Error:', {
        message: error.message,
        status: error.status,
        details: error.errorDetails,
      });
      throw new Error(`Gemini PDF extraction failed: ${error.message}`);
    }
  }

  async chat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemInstruction?: string
  ): Promise<string> {
    try {
      const genAI = this.initializeGenAI();
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: systemInstruction || undefined,
        generationConfig: {
          maxOutputTokens: 8192
        }
      });

      const history = messages.slice(0, -1).map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      const lastMessage = messages[messages.length - 1];

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(lastMessage.content);
      const text = result.response.text();

      const finalText = String(text || '').trim();

      if (!finalText) {
        throw new Error('Empty response from Gemini API');
      }

      console.log('✅ Generated chat response successfully, length:', finalText.length);
      return finalText;

    } catch (error: any) {
      console.error('❌ Gemini Chat API Error:', {
        message: error.message,
        status: error.status
      });

      throw new Error(`Chat generation failed: ${error.message}`);
    }
  }

  async chatWithSearch(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemInstruction?: string
  ): Promise<string> {
    try {
      const genAI = this.initializeGenAI();
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: systemInstruction || undefined,
        tools: [{ googleSearch: {} }as any],
        generationConfig: {
          maxOutputTokens: 8192
        }
      });

      const contents = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      const result = await model.generateContent({ contents });
      const text = result.response.text();
      const finalText = String(text || '').trim();

      if (!finalText) {
        throw new Error('Empty response from Gemini API');
      }

      console.log('✅ Search-grounded chat response, length:', finalText.length);
      return finalText;

    } catch (error: any) {
      console.error('❌ Gemini Search Chat Error:', error.message);
      throw new Error(`Search-grounded chat failed: ${error.message}`);
    }
  }
}

export default new GeminiService();