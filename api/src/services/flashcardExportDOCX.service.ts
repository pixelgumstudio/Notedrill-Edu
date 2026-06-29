import { IFlashcardSet } from '../models/FlashcardSet';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';

class FlashcardExportDOCXService {
  /**
   * Export flashcard questions to DOCX (front side only)
   */
  async exportQuestionsToDOCX(set: IFlashcardSet): Promise<Buffer> {
    const paragraphs: Paragraph[] = [];

    // Title
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: set.title,
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
        text: 'Flashcards - Questions Only',
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );

    // Set info
    const createdDate = new Date(set.createdAt).toLocaleDateString();
    paragraphs.push(
      new Paragraph({
        text: `Total Cards: ${set.totalCards}`,
        spacing: { after: 100 },
      })
    );

    paragraphs.push(
      new Paragraph({
        text: `Mastered: ${set.masteredCards}`,
        spacing: { after: 100 },
      })
    );

    paragraphs.push(
      new Paragraph({
        text: `Created: ${createdDate}`,
        spacing: { after: 300 },
      })
    );

    // Cards
    set.cards.forEach((card, index) => {
      // Card number
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Card ${index + 1}:`,
              bold: true,
            }),
          ],
          spacing: { after: 100 },
        })
      );

      // Card front
      paragraphs.push(
        new Paragraph({
          text: card.front,
          spacing: { after: 100 },
        })
      );

      // Status
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Status: ${card.mastered ? '✓ Mastered' : 'Learning'}`,
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
   * Export flashcard answers to DOCX (with back side)
   */
  async exportAnswersToDOCX(set: IFlashcardSet): Promise<Buffer> {
    const paragraphs: Paragraph[] = [];

    // Title
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: set.title,
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
        text: 'Flashcards - Questions & Answers',
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );

    // Set info
    const createdDate = new Date(set.createdAt).toLocaleDateString();
    paragraphs.push(
      new Paragraph({
        text: `Total Cards: ${set.totalCards}`,
        spacing: { after: 100 },
      })
    );

    paragraphs.push(
      new Paragraph({
        text: `Mastered: ${set.masteredCards}`,
        spacing: { after: 100 },
      })
    );

    paragraphs.push(
      new Paragraph({
        text: `Created: ${createdDate}`,
        spacing: { after: 300 },
      })
    );

    // Cards
    set.cards.forEach((card, index) => {
      // Card number
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Card ${index + 1}:`,
              bold: true,
            }),
          ],
          spacing: { after: 100 },
        })
      );

      // Card front (question)
      paragraphs.push(
        new Paragraph({
          text: `Q: ${card.front}`,
          spacing: { after: 100 },
        })
      );

      // Card back (answer) in green
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `A: ${card.back}`,
              color: '22c55e',
              bold: true,
            }),
          ],
          spacing: { after: 100 },
        })
      );

      // Status
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Status: ${card.mastered ? '✓ Mastered' : 'Learning'}`,
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
  getExportFilename(setTitle: string, includeAnswers: boolean, format: 'docx'): string {
    const sanitized = setTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const type = includeAnswers ? 'answers' : 'questions';
    const ext = format === 'docx' ? 'docx' : 'docx';
    return `${sanitized}_${type}.${ext}`;
  }
}

export default new FlashcardExportDOCXService();
