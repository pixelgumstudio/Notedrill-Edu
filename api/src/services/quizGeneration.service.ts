import geminiService from './gemini.service';

interface QuizQuestion {
  questionText: string;
  questionType: 'multiple-choice' | 'true-false' | 'fill-blank';
  options: string[];
  correctAnswer: number | string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface QuizGenerationOptions {
  questionCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  questionTypes?: Array<'multiple-choice' | 'true-false' | 'fill-blank'>;
  focusTopics?: string[];
  targetLanguage?: string;
}

class QuizGenerationService {
  /**
   * Generate quiz from note content
   */
  async generateQuiz(
    noteContent: string,
    noteTitle: string,
    options: QuizGenerationOptions = {}
  ): Promise<{
    title: string;
    questions: QuizQuestion[];
  }> {
    try {
      const {
        questionCount = 10,
        difficulty = 'mixed',
        questionTypes = ['multiple-choice', 'true-false'],
        focusTopics = [],
        targetLanguage,
      } = options;

      const prompt = this.buildQuizPrompt(
        noteContent,
        noteTitle,
        questionCount,
        difficulty,
        questionTypes,
        focusTopics,
        targetLanguage
      );

      // Generate quiz using Gemini
      const quizData = await geminiService.generateJSON(prompt);

      // Validate and format quiz data
      const formattedQuiz = this.validateAndFormatQuiz(quizData, noteTitle);

      return formattedQuiz;
    } catch (error: any) {
      console.error('❌ Error generating quiz:', error);
      throw new Error(`Quiz generation failed: ${error.message}`);
    }
  }

  /**
   * Build quiz generation prompt
   */
  private buildQuizPrompt(
    noteContent: string,
    noteTitle: string,
    questionCount: number,
    difficulty: string,
    questionTypes: string[],
    focusTopics: string[],
    targetLanguage?: string
  ): string {
    const difficultyInstruction =
      difficulty === 'mixed'
        ? 'Include a mix of easy, medium, and hard questions'
        : `Make all questions ${difficulty} difficulty`;

    const typesInstruction = questionTypes.join(', ');

    const focusInstruction =
      focusTopics.length > 0
        ? `\nFocus specifically on these topics: ${focusTopics.join(', ')}`
        : '';

    const languageInstruction = targetLanguage
      ? `\n- Generate all quiz content (questions, options, explanations, title) in ${targetLanguage}. Use that language throughout.`
      : '';

    return `You are an expert educator creating a comprehensive quiz from study notes.

Generate a ${questionCount}-question quiz from these notes:

Title: ${noteTitle}

Notes:
${noteContent}

Requirements:
- ${difficultyInstruction}
- Question types: ${typesInstruction}
- Cover the most important concepts
- Questions should test understanding, not just memorization
- Provide clear, educational explanations for each answer${focusInstruction}${languageInstruction}

CRITICAL FORMATTING RULES:
1. Return ONLY valid JSON (no markdown, no code blocks, no extra text)
2. The "options" field MUST be an array of strings, NOT objects
3. Ensure all JSON is properly formatted and valid

Return in this EXACT format:
{
  "title": "Quiz title based on the note topic",
  "questions": [
    {
      "questionText": "Clear, specific question that tests understanding",
      "questionType": "multiple-choice",
      "options": ["First option text", "Second option text", "Third option text", "Fourth option text"],
      "correctAnswer": 0,
      "explanation": "Detailed explanation of why this answer is correct and why the other options are incorrect",
      "difficulty": "easy"
    },
    {
      "questionText": "True or false question about a key concept",
      "questionType": "true-false",
      "options": ["True", "False"],
      "correctAnswer": 1,
      "explanation": "Clear explanation of the correct answer with supporting details",
      "difficulty": "medium"
    }
  ]
}

IMPORTANT RULES:
- For multiple-choice questions:
  * Provide exactly 4 options as an array of STRINGS
  * correctAnswer is the index (0-3) of the correct option
  * All options should be plausible to test understanding
  * Example: "options": ["Carbon dioxide", "Oxygen", "Nitrogen", "Hydrogen"]

- For true-false questions:
  * options must be exactly ["True", "False"] (strings, not objects)
  * correctAnswer is 0 for True or 1 for False
  * Question should be clear and unambiguous

- For fill-blank questions:
  * questionText should include _____ where the answer goes
  * correctAnswer is the exact string that fills the blank
  * Example: "questionText": "The capital of France is _____", "correctAnswer": "Paris"

- Explanations should:
  * Be 2-3 sentences long
  * Explain WHY the correct answer is right
  * Mention why other options are incorrect (for multiple-choice)
  * Reference specific information from the notes

- Difficulty levels:
  * easy: Basic recall and understanding
  * medium: Application and analysis
  * hard: Synthesis and evaluation

VALIDATION CHECKLIST BEFORE RETURNING:
✓ Is it valid JSON? (no trailing commas, proper quotes)
✓ Are all "options" arrays containing ONLY strings?
✓ Are correctAnswer values valid indices or strings?
✓ Does each question have all required fields?
✓ Are explanations educational and detailed?

Return the JSON now:`;
  }

  /**
   * Validate and format quiz data from AI
   */
  private validateAndFormatQuiz(
    quizData: any,
    fallbackTitle: string
  ): { title: string; questions: QuizQuestion[] } {
    // Validate structure
    if (!quizData.questions || !Array.isArray(quizData.questions)) {
      throw new Error('Invalid quiz format: missing questions array');
    }

    const title = quizData.title || `Quiz: ${fallbackTitle}`;
    const questions: QuizQuestion[] = [];

    for (const q of quizData.questions) {
      // Validate required fields
      if (!q.questionText || !q.questionType || !q.options || q.correctAnswer === undefined) {
        console.warn('Skipping invalid question:', q);
        continue;
      }

      // Validate question type
      const validTypes = ['multiple-choice', 'true-false', 'fill-blank'];
      if (!validTypes.includes(q.questionType)) {
        console.warn('Invalid question type:', q.questionType);
        continue;
      }

      // Validate difficulty
      const validDifficulties = ['easy', 'medium', 'hard'];
      const difficulty = validDifficulties.includes(q.difficulty)
        ? q.difficulty
        : 'medium';

      // Format options - handle both string arrays and object arrays
      let formattedOptions: string[] = [];
      if (Array.isArray(q.options)) {
        formattedOptions = q.options.map((option: any) => {
          // If option is an object with 'text' property, extract it
          if (typeof option === 'object' && option !== null && 'text' in option) {
            return String(option.text);
          }
          // If option is already a string, use it
          return String(option);
        });
      }

      // Validate we have options
      if (formattedOptions.length === 0) {
        console.warn('Question has no valid options:', q.questionText);
        continue;
      }

      // Format question
      questions.push({
        questionText: q.questionText.trim(),
        questionType: q.questionType,
        options: formattedOptions,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || 'No explanation provided',
        difficulty,
      });
    }

    if (questions.length === 0) {
      throw new Error('No valid questions generated');
    }

    return { title, questions };
  }

  /**
   * Generate practice quiz (shorter, easier)
   */
  async generatePracticeQuiz(
    noteContent: string,
    noteTitle: string
  ): Promise<{ title: string; questions: QuizQuestion[] }> {
    return this.generateQuiz(noteContent, noteTitle, {
      questionCount: 5,
      difficulty: 'easy',
      questionTypes: ['multiple-choice', 'true-false'],
    });
  }

  /**
   * Generate comprehensive quiz (longer, mixed difficulty)
   */
  async generateComprehensiveQuiz(
    noteContent: string,
    noteTitle: string
  ): Promise<{ title: string; questions: QuizQuestion[] }> {
    return this.generateQuiz(noteContent, noteTitle, {
      questionCount: 15,
      difficulty: 'mixed',
      questionTypes: ['multiple-choice', 'true-false', 'fill-blank'],
    });
  }

  /**
   * Generate quiz focused on specific topics
   */
  async generateTopicQuiz(
    noteContent: string,
    noteTitle: string,
    topics: string[]
  ): Promise<{ title: string; questions: QuizQuestion[] }> {
    return this.generateQuiz(noteContent, noteTitle, {
      questionCount: 10,
      difficulty: 'mixed',
      focusTopics: topics,
    });
  }
}

export default new QuizGenerationService();
