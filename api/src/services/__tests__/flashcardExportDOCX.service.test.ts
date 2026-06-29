import { IFlashcardSet } from '../../models/FlashcardSet';
import flashcardExportDOCXService from '../flashcardExportDOCX.service';
import { ObjectId } from 'mongodb';
import JSZip from 'jszip';

async function extractDocxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml')!.async('string');
  let text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
  return text;
}

describe('flashcardExportDOCX.service', () => {
  let mockFlashcardSet: IFlashcardSet;

  beforeEach(() => {
    mockFlashcardSet = {
      _id: new ObjectId(),
      userId: new ObjectId(),
      noteId: new ObjectId(),
      title: 'Spanish Vocabulary',
      cards: [
        {
          front: 'Hello',
          back: 'Hola',
          mastered: false,
          reviewCount: 2,
          color: '#FFD1B8',
        },
        {
          front: 'Good morning',
          back: 'Buenos días',
          mastered: true,
          reviewCount: 5,
          color: '#FFD1B8',
        },
      ],
      totalCards: 2,
      masteredCards: 1,
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
    } as unknown as IFlashcardSet;
  });

  describe('exportQuestionsToDOCX', () => {
    test('returns a valid Buffer', async () => {
      const buffer = await flashcardExportDOCXService.exportQuestionsToDOCX(mockFlashcardSet);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('exported DOCX contains set title', async () => {
      const buffer = await flashcardExportDOCXService.exportQuestionsToDOCX(mockFlashcardSet);
      const docText = await extractDocxText(buffer);
      expect(docText.toLowerCase()).toContain('spanish');
    });

    test('exported DOCX contains "Questions Only" subtitle', async () => {
      const buffer = await flashcardExportDOCXService.exportQuestionsToDOCX(mockFlashcardSet);
      const docText = await extractDocxText(buffer);
      expect(docText).toContain('Questions Only');
    });

    test('includes total cards metadata', async () => {
      const buffer = await flashcardExportDOCXService.exportQuestionsToDOCX(mockFlashcardSet);
      const docText = await extractDocxText(buffer);
      expect(docText).toContain('Total Cards');
    });

    test('includes mastered cards count', async () => {
      const buffer = await flashcardExportDOCXService.exportQuestionsToDOCX(mockFlashcardSet);
      const docText = await extractDocxText(buffer);
      expect(docText).toContain('Mastered');
    });

    test('exports only front side of cards', async () => {
      const buffer = await flashcardExportDOCXService.exportQuestionsToDOCX(mockFlashcardSet);
      const docText = await extractDocxText(buffer);
      expect(docText).toContain('Hello');
      expect(docText).toContain('Good morning');
    });

    test('includes status (Learning/Mastered) for each card', async () => {
      const buffer = await flashcardExportDOCXService.exportQuestionsToDOCX(mockFlashcardSet);
      const docText = await extractDocxText(buffer);
      expect(docText).toContain('Status');
    });

    test('handles empty flashcard set', async () => {
      const emptySet = {
        ...mockFlashcardSet,
        cards: [],
        totalCards: 0,
        masteredCards: 0,
      };

      const buffer = await flashcardExportDOCXService.exportQuestionsToDOCX(
        emptySet as unknown as IFlashcardSet
      );
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('handles set with all cards mastered', async () => {
      const allMasteredSet = {
        ...mockFlashcardSet,
        cards: mockFlashcardSet.cards.map((card) => ({ ...card, mastered: true })),
        masteredCards: 2,
      };

      const buffer = await flashcardExportDOCXService.exportQuestionsToDOCX(
        allMasteredSet as unknown as IFlashcardSet
      );
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('handles set with no mastered cards', async () => {
      const noMasteredSet = {
        ...mockFlashcardSet,
        cards: mockFlashcardSet.cards.map((card) => ({ ...card, mastered: false })),
        masteredCards: 0,
      };

      const buffer = await flashcardExportDOCXService.exportQuestionsToDOCX(
        noMasteredSet as unknown as IFlashcardSet
      );
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('exportAnswersToDOCX', () => {
    test('returns a valid Buffer', async () => {
      const buffer = await flashcardExportDOCXService.exportAnswersToDOCX(mockFlashcardSet);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('exported DOCX contains set title', async () => {
      const buffer = await flashcardExportDOCXService.exportAnswersToDOCX(mockFlashcardSet);
      const docText = await extractDocxText(buffer);
      expect(docText.toLowerCase()).toContain('spanish');
    });

    test('exported DOCX contains "Questions & Answers" subtitle', async () => {
      const buffer = await flashcardExportDOCXService.exportAnswersToDOCX(mockFlashcardSet);
      const docText = await extractDocxText(buffer);
      expect(docText).toContain('Questions & Answers');
    });

    test('includes both front and back of each card', async () => {
      const buffer = await flashcardExportDOCXService.exportAnswersToDOCX(mockFlashcardSet);
      const docText = await extractDocxText(buffer);
      expect(docText).toContain('Hello');
      expect(docText).toContain('Hola');
      expect(docText).toContain('Good morning');
      expect(docText).toContain('Buenos');
    });

    test('includes total cards metadata', async () => {
      const buffer = await flashcardExportDOCXService.exportAnswersToDOCX(mockFlashcardSet);
      const docText = await extractDocxText(buffer);
      expect(docText).toContain('Total Cards');
    });

    test('includes mastered cards count', async () => {
      const buffer = await flashcardExportDOCXService.exportAnswersToDOCX(mockFlashcardSet);
      const docText = await extractDocxText(buffer);
      expect(docText).toContain('Mastered');
    });

    test('includes status for each card', async () => {
      const buffer = await flashcardExportDOCXService.exportAnswersToDOCX(mockFlashcardSet);
      const docText = await extractDocxText(buffer);
      expect(docText).toContain('Status');
    });

    test('handles empty flashcard set', async () => {
      const emptySet = {
        ...mockFlashcardSet,
        cards: [],
        totalCards: 0,
        masteredCards: 0,
      };

      const buffer = await flashcardExportDOCXService.exportAnswersToDOCX(
        emptySet as unknown as IFlashcardSet
      );
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('handles set with all cards mastered', async () => {
      const allMasteredSet = {
        ...mockFlashcardSet,
        cards: mockFlashcardSet.cards.map((card) => ({ ...card, mastered: true })),
        masteredCards: 2,
      };

      const buffer = await flashcardExportDOCXService.exportAnswersToDOCX(
        allMasteredSet as unknown as IFlashcardSet
      );
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('handles cards with long text content', async () => {
      const longTextSet = {
        ...mockFlashcardSet,
        cards: [
          {
            front: 'A'.repeat(200),
            back: 'B'.repeat(200),
            mastered: false,
            reviewCount: 1,
            color: '#FFD1B8',
          },
        ],
        totalCards: 1,
      };

      const buffer = await flashcardExportDOCXService.exportAnswersToDOCX(
        longTextSet as unknown as IFlashcardSet
      );
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('handles cards with special characters', async () => {
      const specialCharSet = {
        ...mockFlashcardSet,
        cards: [
          {
            front: 'What is ∑ (sigma)?',
            back: 'Summation symbol',
            mastered: false,
            reviewCount: 1,
            color: '#FFD1B8',
          },
        ],
        totalCards: 1,
      };

      const buffer = await flashcardExportDOCXService.exportAnswersToDOCX(
        specialCharSet as unknown as IFlashcardSet
      );
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('getExportFilename', () => {
    test('generates correct filename for questions export', () => {
      const filename = flashcardExportDOCXService.getExportFilename(
        'Spanish Vocabulary',
        false,
        'docx'
      );
      expect(filename).toMatch(/\.docx$/);
      expect(filename).toContain('questions');
      expect(filename).toContain('spanish');
    });

    test('generates correct filename for answers export', () => {
      const filename = flashcardExportDOCXService.getExportFilename(
        'Spanish Vocabulary',
        true,
        'docx'
      );
      expect(filename).toMatch(/\.docx$/);
      expect(filename).toContain('answers');
      expect(filename).toContain('spanish');
    });

    test('sanitizes special characters in title', () => {
      const filename = flashcardExportDOCXService.getExportFilename(
        'Set!@#$%^&*() with Spaces',
        false,
        'docx'
      );
      expect(filename).toMatch(/^[a-z0-9_]+\.docx$/);
      expect(filename).not.toContain('!');
      expect(filename).not.toContain('(');
      expect(filename).not.toContain(')');
    });

    test('converts to lowercase', () => {
      const filename = flashcardExportDOCXService.getExportFilename(
        'UPPERCASE SET',
        false,
        'docx'
      );
      expect(filename).toBe(filename.toLowerCase());
    });

    test('handles unicode characters', () => {
      const filename = flashcardExportDOCXService.getExportFilename(
        'Set 中文 العربية',
        false,
        'docx'
      );
      expect(filename).toMatch(/\.docx$/);
      expect(filename.length).toBeGreaterThan(0);
    });

    test('handles very long titles', () => {
      const longTitle = 'Very '.repeat(50);
      const filename = flashcardExportDOCXService.getExportFilename(longTitle, false, 'docx');
      expect(filename).toMatch(/\.docx$/);
      expect(filename.length).toBeLessThan(500);
    });
  });

  describe('edge cases', () => {
    test('handles single card set', async () => {
      const singleCardSet = {
        ...mockFlashcardSet,
        cards: [mockFlashcardSet.cards[0]],
        totalCards: 1,
        masteredCards: 0,
      };

      const buffer = await flashcardExportDOCXService.exportQuestionsToDOCX(
        singleCardSet as unknown as IFlashcardSet
      );
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('handles very large card set (500+ cards)', async () => {
      const manyCards = Array.from({ length: 500 }, (_, i) => ({
        front: `Front ${i + 1}`,
        back: `Back ${i + 1}`,
        mastered: i % 2 === 0,
        reviewCount: i,
        color: '#FFD1B8',
      }));

      const largeSet = {
        ...mockFlashcardSet,
        cards: manyCards,
        totalCards: 500,
        masteredCards: 250,
      };

      const buffer = await flashcardExportDOCXService.exportAnswersToDOCX(
        largeSet as unknown as IFlashcardSet
      );
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('handles cards with empty front or back', async () => {
      const incompleteSet = {
        ...mockFlashcardSet,
        cards: [
          {
            front: '',
            back: 'Answer',
            mastered: false,
            reviewCount: 0,
            color: '#FFD1B8',
          },
          {
            front: 'Question',
            back: '',
            mastered: false,
            reviewCount: 0,
            color: '#FFD1B8',
          },
        ],
        totalCards: 2,
        masteredCards: 0,
      };

      const buffer = await flashcardExportDOCXService.exportQuestionsToDOCX(
        incompleteSet as unknown as IFlashcardSet
      );
      expect(buffer).toBeInstanceOf(Buffer);
    });

    test('handles very long card content', async () => {
      const longContentSet = {
        ...mockFlashcardSet,
        cards: [
          {
            front: 'Q'.repeat(1000),
            back: 'A'.repeat(1000),
            mastered: false,
            reviewCount: 0,
            color: '#FFD1B8',
          },
        ],
        totalCards: 1,
      };

      const buffer = await flashcardExportDOCXService.exportAnswersToDOCX(
        longContentSet as unknown as IFlashcardSet
      );
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('handles cards with newlines and special formatting', async () => {
      const formattedSet = {
        ...mockFlashcardSet,
        cards: [
          {
            front: 'Line 1\nLine 2\nLine 3',
            back: 'Answer with\ttabs\tand\nnewlines',
            mastered: false,
            reviewCount: 0,
            color: '#FFD1B8',
          },
        ],
        totalCards: 1,
      };

      const buffer = await flashcardExportDOCXService.exportQuestionsToDOCX(
        formattedSet as unknown as IFlashcardSet
      );
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });
});
