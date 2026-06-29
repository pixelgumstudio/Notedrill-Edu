import { IQuiz } from '../models/Quiz';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';

class QuizExportDOCXService {
  /**
   * Export quiz questions to DOCX
   */
  async exportQuestionsToDOCX(quiz: IQuiz): Promise<Buffer> {
    const paragraphs: Paragraph[] = [];

    // Title
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: quiz.title,
            bold: true,
            size: 28,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      })
    );

    // Subtitle
    paragraphs.push(
      new Paragraph({
        text: 'Questions Only',
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );

    // Quiz info
    const createdDate = new Date(quiz.createdAt).toLocaleDateString();
    paragraphs.push(
      new Paragraph({
        text: `Total Questions: ${quiz.totalQuestions}`,
        spacing: { after: 100 },
      })
    );

    paragraphs.push(
      new Paragraph({
        text: `Created: ${createdDate}`,
        spacing: { after: 300 },
      })
    );

    // Questions
    quiz.questions.forEach((q, index) => {
      // Question text
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Q${index + 1}: ${q.questionText}`,
              bold: true,
            }),
          ],
          spacing: { after: 100 },
        })
      );

      // Options
      if (q.questionType === 'multiple-choice') {
        q.options.forEach((opt, i) => {
          const letter = String.fromCharCode(65 + i); // A, B, C, D...
          paragraphs.push(
            new Paragraph({
              text: `  ${letter}) ${opt}`,
              spacing: { after: 50 },
            })
          );
        });
      } else if (q.questionType === 'true-false') {
        paragraphs.push(
          new Paragraph({
            text: '  A) True',
            spacing: { after: 50 },
          })
        );
        paragraphs.push(
          new Paragraph({
            text: '  B) False',
            spacing: { after: 100 },
          })
        );
      } else {
        paragraphs.push(
          new Paragraph({
            text: '  [Fill in the blank]',
            spacing: { after: 100 },
          })
        );
      }

      // Difficulty
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Difficulty: ${q.difficulty}`,
              italics: true,
            }),
          ],
          spacing: { after: 200 },
        })
      );
    });

    const doc = new Document({
      sections: [
        {
          children: paragraphs,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }

  /**
   * Export quiz answers to DOCX
   */
  async exportAnswersToDOCX(quiz: IQuiz): Promise<Buffer> {
    const paragraphs: Paragraph[] = [];

    // Title
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: quiz.title,
            bold: true,
            size: 28,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      })
    );

    // Subtitle
    paragraphs.push(
      new Paragraph({
        text: 'Answers & Explanations',
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );

    // Quiz info
    const createdDate = new Date(quiz.createdAt).toLocaleDateString();
    paragraphs.push(
      new Paragraph({
        text: `Total Questions: ${quiz.totalQuestions}`,
        spacing: { after: 100 },
      })
    );

    paragraphs.push(
      new Paragraph({
        text: `Created: ${createdDate}`,
        spacing: { after: 300 },
      })
    );

    // Answers
    quiz.questions.forEach((q, index) => {
      // Question text
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Q${index + 1}: ${q.questionText}`,
              bold: true,
            }),
          ],
          spacing: { after: 100 },
        })
      );

      // Get answer label and display in green
      let answerLabel = '';
      if (q.questionType === 'multiple-choice') {
        const answerIndex = typeof q.correctAnswer === 'number' ? q.correctAnswer : 0;
        answerLabel = String.fromCharCode(65 + answerIndex); // A, B, C, D...
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Answer: ${answerLabel}) ${q.options[answerIndex]}`,
                color: '22c55e',
                bold: true,
              }),
            ],
            spacing: { after: 100 },
          })
        );
      } else if (q.questionType === 'true-false') {
        answerLabel = q.correctAnswer === 0 || q.correctAnswer === 'true' ? 'A) True' : 'B) False';
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Answer: ${answerLabel}`,
                color: '22c55e',
                bold: true,
              }),
            ],
            spacing: { after: 100 },
          })
        );
      } else {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Answer: ${q.correctAnswer}`,
                color: '22c55e',
                bold: true,
              }),
            ],
            spacing: { after: 100 },
          })
        );
      }

      // Explanation
      paragraphs.push(
        new Paragraph({
          text: `Explanation: ${q.explanation}`,
          spacing: { after: 100 },
        })
      );

      // Difficulty
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Difficulty: ${q.difficulty}`,
              italics: true,
            }),
          ],
          spacing: { after: 200 },
        })
      );
    });

    const doc = new Document({
      sections: [
        {
          children: paragraphs,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }

  /**
   * Get filename for export
   */
  getExportFilename(quizTitle: string, includeAnswers: boolean, format: 'docx'): string {
    const sanitized = quizTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const type = includeAnswers ? 'answers' : 'questions';
    const ext = format === 'docx' ? 'docx' : 'docx';
    return `${sanitized}_${type}.${ext}`;
  }
}

export default new QuizExportDOCXService();
