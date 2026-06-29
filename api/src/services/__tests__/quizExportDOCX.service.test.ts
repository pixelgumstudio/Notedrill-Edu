import { IQuiz } from '../../models/Quiz';
import quizExportDOCXService from '../quizExportDOCX.service';
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

describe('quizExportDOCX.service', () => {
  let mockQuiz: IQuiz;

  beforeEach(() => {
    mockQuiz = {
      _id: new ObjectId(),
      userId: new ObjectId(),
      noteId: new ObjectId(),
      title: 'Math Quiz',
      questions: [
        {
          questionText: 'What is 2+2?',
          questionType: 'multiple-choice',
          options: ['3', '4', '5', '6'],
          correctAnswer: 1,
          explanation: 'Basic arithmetic: 2+2=4',
          difficulty: 'easy',
        },
        {
          questionText: 'Is the Earth round?',
          questionType: 'true-false',
          options: ['true', 'false'],
          correctAnswer: 0,
          explanation: 'The Earth is spherical',
          difficulty: 'easy',
        },
      ],
      totalQuestions: 2,
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
    } as unknown as IQuiz;
  });

  describe('exportQuestionsToDOCX', () => {
    test('returns a valid Buffer', async () => {
      const buffer = await quizExportDOCXService.exportQuestionsToDOCX(mockQuiz);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('exported DOCX contains quiz title', async () => {
      const buffer = await quizExportDOCXService.exportQuestionsToDOCX(mockQuiz);
      const docText = await extractDocxText(buffer);
      expect(docText.toLowerCase()).toContain('math');
    });

    test('exported DOCX contains question count metadata', async () => {
      const buffer = await quizExportDOCXService.exportQuestionsToDOCX(mockQuiz);
      const docText = await extractDocxText(buffer);
      expect(docText).toContain('Total Questions');
    });

    test('handles empty questions array', async () => {
      const quizWithNoQuestions = {
        ...mockQuiz,
        questions: [],
        totalQuestions: 0,
      };

      const buffer = await quizExportDOCXService.exportQuestionsToDOCX(
        quizWithNoQuestions as unknown as IQuiz
      );
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('handles multiple-choice questions correctly', async () => {
      const quizWithMC = {
        ...mockQuiz,
        questions: [
          {
            questionText: 'What is the capital of France?',
            questionType: 'multiple-choice',
            options: ['London', 'Paris', 'Berlin', 'Madrid'],
            correctAnswer: 1,
            explanation: 'Paris is the capital of France',
            difficulty: 'easy',
          },
        ],
        totalQuestions: 1,
      };

      const buffer = await quizExportDOCXService.exportQuestionsToDOCX(
        quizWithMC as unknown as IQuiz
      );
      const docText = await extractDocxText(buffer);
      expect(docText).toContain('Questions Only');
    });

    test('handles true-false questions correctly', async () => {
      const quizWithTF = {
        ...mockQuiz,
        questions: [
          {
            questionText: 'Water boils at 100 degrees Celsius',
            questionType: 'true-false',
            options: ['true', 'false'],
            correctAnswer: 0,
            explanation: 'At standard atmospheric pressure',
            difficulty: 'medium',
          },
        ],
        totalQuestions: 1,
      };

      const buffer = await quizExportDOCXService.exportQuestionsToDOCX(
        quizWithTF as unknown as IQuiz
      );
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('includes difficulty levels', async () => {
      const buffer = await quizExportDOCXService.exportQuestionsToDOCX(mockQuiz);
      const docText = await extractDocxText(buffer);
      expect(docText).toContain('easy');
    });
  });

  describe('exportAnswersToDOCX', () => {
    test('returns a valid Buffer', async () => {
      const buffer = await quizExportDOCXService.exportAnswersToDOCX(mockQuiz);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('exported DOCX contains quiz title', async () => {
      const buffer = await quizExportDOCXService.exportAnswersToDOCX(mockQuiz);
      const docText = await extractDocxText(buffer);
      expect(docText.toLowerCase()).toContain('math');
    });

    test('includes answer content', async () => {
      const buffer = await quizExportDOCXService.exportAnswersToDOCX(mockQuiz);
      const docText = await extractDocxText(buffer);
      expect(docText).toContain('Answer');
      expect(docText).toContain('Explanation');
    });

    test('marks document as "Answers & Explanations"', async () => {
      const buffer = await quizExportDOCXService.exportAnswersToDOCX(mockQuiz);
      const docText = await extractDocxText(buffer);
      expect(docText).toContain('Answers');
    });

    test('handles multiple-choice correct answer format', async () => {
      const quizWithMC = {
        ...mockQuiz,
        questions: [
          {
            questionText: 'What is 5 * 4?',
            questionType: 'multiple-choice',
            options: ['15', '20', '25', '30'],
            correctAnswer: 1,
            explanation: '5 multiplied by 4 equals 20',
            difficulty: 'easy',
          },
        ],
        totalQuestions: 1,
      };

      const buffer = await quizExportDOCXService.exportAnswersToDOCX(
        quizWithMC as unknown as IQuiz
      );
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('handles true-false correct answer format', async () => {
      const quizWithTF = {
        ...mockQuiz,
        questions: [
          {
            questionText: 'The sky is blue',
            questionType: 'true-false',
            options: ['true', 'false'],
            correctAnswer: 0,
            explanation: 'Due to Rayleigh scattering',
            difficulty: 'medium',
          },
        ],
        totalQuestions: 1,
      };

      const buffer = await quizExportDOCXService.exportAnswersToDOCX(
        quizWithTF as unknown as IQuiz
      );
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('includes explanations for all questions', async () => {
      const buffer = await quizExportDOCXService.exportAnswersToDOCX(mockQuiz);
      const docText = await extractDocxText(buffer);
      expect(docText).toContain('Basic arithmetic');
      expect(docText).toContain('spherical');
    });
  });

  describe('getExportFilename', () => {
    test('generates correct filename for questions export', () => {
      const filename = quizExportDOCXService.getExportFilename('My Math Quiz', false, 'docx');
      expect(filename).toMatch(/\.docx$/);
      expect(filename).toContain('questions');
      expect(filename).toContain('my_math_quiz');
    });

    test('generates correct filename for answers export', () => {
      const filename = quizExportDOCXService.getExportFilename('My Math Quiz', true, 'docx');
      expect(filename).toMatch(/\.docx$/);
      expect(filename).toContain('answers');
      expect(filename).toContain('my_math_quiz');
    });

    test('sanitizes special characters in title', () => {
      const filename = quizExportDOCXService.getExportFilename(
        'Quiz!@#$%^&*() with Spaces & Symbols',
        false,
        'docx'
      );
      expect(filename).toMatch(/^[a-z0-9_]+\.docx$/);
      expect(filename).not.toContain('!');
      expect(filename).not.toContain('@');
      expect(filename).not.toContain('&');
    });

    test('converts to lowercase', () => {
      const filename = quizExportDOCXService.getExportFilename('UPPERCASE QUIZ', false, 'docx');
      expect(filename).toBe(filename.toLowerCase());
    });

    test('handles unicode characters', () => {
      const filename = quizExportDOCXService.getExportFilename('Quiz 中文 Español', false, 'docx');
      expect(filename).toMatch(/\.docx$/);
      // Should not throw, should sanitize non-ASCII
      expect(filename.length).toBeGreaterThan(0);
    });

    test('handles very long titles', () => {
      const longTitle = 'A'.repeat(100);
      const filename = quizExportDOCXService.getExportFilename(longTitle, false, 'docx');
      expect(filename).toMatch(/\.docx$/);
      expect(filename.length).toBeLessThan(300); // Should not be excessively long
    });
  });

  describe('edge cases', () => {
    test('handles quiz with single question', async () => {
      const singleQuestionQuiz = {
        ...mockQuiz,
        questions: [mockQuiz.questions[0]],
        totalQuestions: 1,
      };

      const buffer = await quizExportDOCXService.exportQuestionsToDOCX(
        singleQuestionQuiz as unknown as IQuiz
      );
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('handles quiz with many questions', async () => {
      const manyQuestions = Array.from({ length: 50 }, (_, i) => ({
        questionText: `Question ${i + 1}?`,
        questionType: 'multiple-choice',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0,
        explanation: `Explanation ${i + 1}`,
        difficulty: 'medium',
      }));

      const largeQuiz = {
        ...mockQuiz,
        questions: manyQuestions,
        totalQuestions: 50,
      };

      const buffer = await quizExportDOCXService.exportQuestionsToDOCX(
        largeQuiz as unknown as IQuiz
      );
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('handles questions with very long text', async () => {
      const longTextQuestion = {
        ...mockQuiz,
        questions: [
          {
            questionText: 'A'.repeat(500),
            questionType: 'multiple-choice',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 0,
            explanation: 'B'.repeat(500),
            difficulty: 'hard',
          },
        ],
        totalQuestions: 1,
      };

      const buffer = await quizExportDOCXService.exportQuestionsToDOCX(
        longTextQuestion as unknown as IQuiz
      );
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('handles empty option strings', async () => {
      const quizWithEmptyOptions = {
        ...mockQuiz,
        questions: [
          {
            questionText: 'Test?',
            questionType: 'multiple-choice',
            options: ['', '', '', ''],
            correctAnswer: 0,
            explanation: 'Test',
            difficulty: 'easy',
          },
        ],
        totalQuestions: 1,
      };

      const buffer = await quizExportDOCXService.exportQuestionsToDOCX(
        quizWithEmptyOptions as unknown as IQuiz
      );
      expect(buffer).toBeInstanceOf(Buffer);
    });

    test('handles null or undefined explanation', async () => {
      const quizWithNoExplanation = {
        ...mockQuiz,
        questions: [
          {
            questionText: 'Test?',
            questionType: 'multiple-choice',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 0,
            explanation: '',
            difficulty: 'easy',
          },
        ],
        totalQuestions: 1,
      };

      const buffer = await quizExportDOCXService.exportAnswersToDOCX(
        quizWithNoExplanation as unknown as IQuiz
      );
      expect(buffer).toBeInstanceOf(Buffer);
    });
  });
});
