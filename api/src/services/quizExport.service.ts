import { IQuiz } from '../models/Quiz';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

interface ExportOptions {
  format: 'pdf' | 'txt';
  includeAnswers: boolean;
}

class QuizExportService {
  /**
   * Export quiz questions to PDF or TXT
   */
  async exportQuestions(quiz: IQuiz, format: 'pdf' | 'txt'): Promise<Buffer | string> {
    if (format === 'pdf') {
      return await this.exportQuestionsToPDF(quiz);
    } else {
      return this.exportQuestionsToTXT(quiz);
    }
  }

  /**
   * Export quiz answers to PDF or TXT
   */
  async exportAnswers(quiz: IQuiz, format: 'pdf' | 'txt'): Promise<Buffer | string> {
    if (format === 'pdf') {
      return await this.exportAnswersToPDF(quiz);
    } else {
      return this.exportAnswersToTXT(quiz);
    }
  }

  /**
   * Export questions as PDF
   */
  private exportQuestionsToPDF(quiz: IQuiz): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ bufferPages: true });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text(`${quiz.title}`, { align: 'center' });
        doc.fontSize(12).font('Helvetica').text(`Questions Only`, { align: 'center' });
        doc.moveDown();

        // Quiz info
        const createdDate = new Date(quiz.createdAt).toLocaleDateString();
        doc.fontSize(10).text(`Total Questions: ${quiz.totalQuestions}`, { align: 'left' });
        doc.fontSize(10).text(`Created: ${createdDate}`, { align: 'left' });
        doc.moveDown();

        // Questions
        quiz.questions.forEach((q, index) => {
          doc.fontSize(12).font('Helvetica-Bold').text(`Q${index + 1}: ${q.questionText}`, {
            width: 500,
            align: 'left',
          });
          doc.fontSize(10).font('Helvetica');

          if (q.questionType === 'multiple-choice') {
            q.options.forEach((opt, i) => {
              const letter = String.fromCharCode(65 + i); // A, B, C, D...
              doc.text(`  ${letter}) ${opt}`);
            });
          } else if (q.questionType === 'true-false') {
            doc.text(`  A) True`);
            doc.text(`  B) False`);
          } else {
            doc.text(`  [Fill in the blank]`);
          }

          doc.fontSize(9).fillColor('#999999').text(`Difficulty: ${q.difficulty}`, { align: 'left' });
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
   * Export questions as TXT
   */
  private exportQuestionsToTXT(quiz: IQuiz): string {
    const lines: string[] = [];

    lines.push(`${quiz.title}`);
    lines.push(`Questions Only`);
    lines.push('='.repeat(50));
    lines.push('');

    const createdDate = new Date(quiz.createdAt).toLocaleDateString();
    lines.push(`Total Questions: ${quiz.totalQuestions}`);
    lines.push(`Created: ${createdDate}`);
    lines.push('');
    lines.push('='.repeat(50));
    lines.push('');

    quiz.questions.forEach((q, index) => {
      lines.push(`Q${index + 1}: ${q.questionText}`);
      lines.push('');

      if (q.questionType === 'multiple-choice') {
        q.options.forEach((opt, i) => {
          const letter = String.fromCharCode(65 + i);
          lines.push(`  ${letter}) ${opt}`);
        });
      } else if (q.questionType === 'true-false') {
        lines.push(`  A) True`);
        lines.push(`  B) False`);
      } else {
        lines.push(`  [Fill in the blank]`);
      }

      lines.push(`Difficulty: ${q.difficulty}`);
      lines.push('');
      lines.push('-'.repeat(50));
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Export answers as PDF
   */
  private exportAnswersToPDF(quiz: IQuiz): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ bufferPages: true });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text(`${quiz.title}`, { align: 'center' });
        doc.fontSize(12).font('Helvetica').text(`Answers & Explanations`, { align: 'center' });
        doc.moveDown();

        // Quiz info
        const createdDate = new Date(quiz.createdAt).toLocaleDateString();
        doc.fontSize(10).text(`Total Questions: ${quiz.totalQuestions}`, { align: 'left' });
        doc.fontSize(10).text(`Created: ${createdDate}`, { align: 'left' });
        doc.moveDown();

        // Answers
        quiz.questions.forEach((q, index) => {
          doc.fontSize(12).font('Helvetica-Bold').text(`Q${index + 1}: ${q.questionText}`, {
            width: 500,
            align: 'left',
          });
          doc.fontSize(10).font('Helvetica');

          // Get answer label
          let answerLabel = '';
          if (q.questionType === 'multiple-choice') {
            const answerIndex = typeof q.correctAnswer === 'number' ? q.correctAnswer : 0;
            const safeIndex = Math.min(Math.max(answerIndex, 0), q.options.length - 1);
            answerLabel = String.fromCharCode(65 + safeIndex);
            doc.fillColor('#22c55e').text(`Answer: ${answerLabel}) ${q.options[safeIndex]}`);
          } else if (q.questionType === 'true-false') {
            answerLabel = q.correctAnswer === 0 || q.correctAnswer === 'true' ? 'A) True' : 'B) False';
            doc.fillColor('#22c55e').text(`Answer: ${answerLabel}`);
          } else {
            doc.fillColor('#22c55e').text(`Answer: ${q.correctAnswer}`);
          }

          // Explanation
          doc.fontSize(9).fillColor('#666666').text(`Explanation: ${q.explanation}`, {
            width: 500,
            align: 'left',
          });
          doc.fillColor('#000000');

          doc.fontSize(9).text(`Difficulty: ${q.difficulty}`, { align: 'left' });
          doc.moveDown(0.5);
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Export answers as TXT
   */
  private exportAnswersToTXT(quiz: IQuiz): string {
    const lines: string[] = [];

    lines.push(`${quiz.title}`);
    lines.push(`Answers & Explanations`);
    lines.push('='.repeat(50));
    lines.push('');

    const createdDate = new Date(quiz.createdAt).toLocaleDateString();
    lines.push(`Total Questions: ${quiz.totalQuestions}`);
    lines.push(`Created: ${createdDate}`);
    lines.push('');
    lines.push('='.repeat(50));
    lines.push('');

    quiz.questions.forEach((q, index) => {
      lines.push(`Q${index + 1}: ${q.questionText}`);
      lines.push('');

      // Get answer label
      if (q.questionType === 'multiple-choice') {
        const answerIndex = typeof q.correctAnswer === 'number' ? q.correctAnswer : 0;
        const safeIndex = Math.min(Math.max(answerIndex, 0), q.options.length - 1);
        const answerLabel = String.fromCharCode(65 + safeIndex);
        lines.push(`✓ Answer: ${answerLabel}) ${q.options[safeIndex]}`);
      } else if (q.questionType === 'true-false') {
        const answerLabel = q.correctAnswer === 0 || q.correctAnswer === 'true' ? 'A) True' : 'B) False';
        lines.push(`✓ Answer: ${answerLabel}`);
      } else {
        lines.push(`✓ Answer: ${q.correctAnswer}`);
      }

      lines.push('');
      lines.push(`Explanation: ${q.explanation}`);
      lines.push(`Difficulty: ${q.difficulty}`);
      lines.push('');
      lines.push('-'.repeat(50));
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Get filename for export
   */
  getExportFilename(quizTitle: string, includeAnswers: boolean, format: 'pdf' | 'txt'): string {
    const sanitized = quizTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const type = includeAnswers ? 'answers' : 'questions';
    const ext = format === 'pdf' ? 'pdf' : 'txt';
    return `${sanitized}_${type}.${ext}`;
  }
}

export default new QuizExportService();
