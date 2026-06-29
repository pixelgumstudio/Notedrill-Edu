import { IFlashcardSet } from '../models/FlashcardSet';
import PDFDocument from 'pdfkit';

class FlashcardExportService {
  /**
   * Export flashcard questions to PDF or TXT
   */
  async exportQuestions(set: IFlashcardSet, format: 'pdf' | 'txt'): Promise<Buffer | string> {
    if (format === 'pdf') {
      return await this.exportQuestionsToPDF(set);
    } else {
      return this.exportQuestionsToTXT(set);
    }
  }

  /**
   * Export flashcard answers to PDF or TXT
   */
  async exportAnswers(set: IFlashcardSet, format: 'pdf' | 'txt'): Promise<Buffer | string> {
    if (format === 'pdf') {
      return await this.exportAnswersToPDF(set);
    } else {
      return this.exportAnswersToTXT(set);
    }
  }

  /**
   * Export questions (front side only) as PDF
   */
  private exportQuestionsToPDF(set: IFlashcardSet): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ bufferPages: true });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text(`${set.title}`, { align: 'center' });
        doc.fontSize(12).font('Helvetica').text(`Flashcards - Questions Only`, { align: 'center' });
        doc.moveDown();

        // Set info
        const createdDate = new Date(set.createdAt).toLocaleDateString();
        doc.fontSize(10).text(`Total Cards: ${set.totalCards}`, { align: 'left' });
        doc.fontSize(10).text(`Mastered: ${set.masteredCards}`, { align: 'left' });
        doc.fontSize(10).text(`Created: ${createdDate}`, { align: 'left' });
        doc.moveDown();

        // Cards
        set.cards.forEach((card, index) => {
          doc.fontSize(12).font('Helvetica-Bold').text(`Card ${index + 1}:`, {
            width: 500,
            align: 'left',
          });
          doc.fontSize(11).font('Helvetica').text(`${card.front}`, {
            width: 500,
            align: 'left',
          });

          doc.fontSize(9).fillColor('#999999').text(`Status: ${card.mastered ? '✓ Mastered' : 'Learning'}`, {
            align: 'left',
          });
          doc.fillColor('#000000');
          doc.moveDown(0.5);
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Export questions (front side only) as TXT
   */
  private exportQuestionsToTXT(set: IFlashcardSet): string {
    const lines: string[] = [];

    lines.push(`${set.title}`);
    lines.push(`Flashcards - Questions Only`);
    lines.push('='.repeat(50));
    lines.push('');

    const createdDate = new Date(set.createdAt).toLocaleDateString();
    lines.push(`Total Cards: ${set.totalCards}`);
    lines.push(`Mastered: ${set.masteredCards}`);
    lines.push(`Created: ${createdDate}`);
    lines.push('');
    lines.push('='.repeat(50));
    lines.push('');

    set.cards.forEach((card, index) => {
      lines.push(`Card ${index + 1}:`);
      lines.push(`${card.front}`);
      lines.push(`Status: ${card.mastered ? '✓ Mastered' : 'Learning'}`);
      lines.push('');
      lines.push('-'.repeat(50));
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Export answers (back side with questions) as PDF
   */
  private exportAnswersToPDF(set: IFlashcardSet): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ bufferPages: true });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text(`${set.title}`, { align: 'center' });
        doc.fontSize(12).font('Helvetica').text(`Flashcards - Questions & Answers`, { align: 'center' });
        doc.moveDown();

        // Set info
        const createdDate = new Date(set.createdAt).toLocaleDateString();
        doc.fontSize(10).text(`Total Cards: ${set.totalCards}`, { align: 'left' });
        doc.fontSize(10).text(`Mastered: ${set.masteredCards}`, { align: 'left' });
        doc.fontSize(10).text(`Created: ${createdDate}`, { align: 'left' });
        doc.moveDown();

        // Cards
        set.cards.forEach((card, index) => {
          doc.fontSize(12).font('Helvetica-Bold').text(`Card ${index + 1}:`, {
            width: 500,
            align: 'left',
          });

          doc.fontSize(11).font('Helvetica').text(`Q: ${card.front}`, {
            width: 500,
            align: 'left',
          });
          doc.moveDown(0.3);

          doc.fontSize(11).font('Helvetica').fillColor('#22c55e').text(`A: ${card.back}`, {
            width: 500,
            align: 'left',
          });
          doc.fillColor('#000000');

          doc.fontSize(9).text(`Status: ${card.mastered ? '✓ Mastered' : 'Learning'}`, {
            align: 'left',
          });
          doc.moveDown(0.5);
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Export answers (back side with questions) as TXT
   */
  private exportAnswersToTXT(set: IFlashcardSet): string {
    const lines: string[] = [];

    lines.push(`${set.title}`);
    lines.push(`Flashcards - Questions & Answers`);
    lines.push('='.repeat(50));
    lines.push('');

    const createdDate = new Date(set.createdAt).toLocaleDateString();
    lines.push(`Total Cards: ${set.totalCards}`);
    lines.push(`Mastered: ${set.masteredCards}`);
    lines.push(`Created: ${createdDate}`);
    lines.push('');
    lines.push('='.repeat(50));
    lines.push('');

    set.cards.forEach((card, index) => {
      lines.push(`Card ${index + 1}:`);
      lines.push(`Q: ${card.front}`);
      lines.push(`✓ A: ${card.back}`);
      lines.push(`Status: ${card.mastered ? '✓ Mastered' : 'Learning'}`);
      lines.push('');
      lines.push('-'.repeat(50));
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Get filename for export
   */
  getExportFilename(setTitle: string, includeAnswers: boolean, format: 'pdf' | 'txt'): string {
    const sanitized = setTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const type = includeAnswers ? 'answers' : 'questions';
    const ext = format === 'pdf' ? 'pdf' : 'txt';
    return `${sanitized}_${type}.${ext}`;
  }
}

export default new FlashcardExportService();
