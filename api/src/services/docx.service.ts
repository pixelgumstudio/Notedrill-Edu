// api/src/services/docx.service.ts
// Text extraction for legacy .doc (OLE) and modern .docx (ECMA-376) Word files.

// No @types package exists for word-extractor — require it as untyped, same
// pattern used for pdf-parse in pdf.service.ts.
const WordExtractor = require('word-extractor');

interface DocExtractionResult {
  text: string;
}

class DocxService {
  async extractTextFromBuffer(buffer: Buffer): Promise<DocExtractionResult> {
    try {
      console.log(`📃 Word doc processing from buffer (${buffer.length} bytes)`);

      const extractor = new WordExtractor();
      const doc = await extractor.extract(buffer);
      const text = (doc.getBody() || '').trim();

      console.log(`✅ Extracted ${text.length} chars from Word document`);

      return { text };
    } catch (error: any) {
      console.error('❌ Word doc extraction error:', error);
      throw new Error(`Word document processing failed: ${error.message}`);
    }
  }
}

export default new DocxService();
