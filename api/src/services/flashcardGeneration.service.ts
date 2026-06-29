import geminiService from './gemini.service';

interface FlashcardData {
  front: string;
  back: string;
  type: 'concept' | 'definition' | 'example' | 'application';
  color?: string;
}

interface FlashcardGenerationOptions {
  cardCount?: number;
  focusTopics?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  includeExamples?: boolean;
  targetLanguage?: string;
}

class FlashcardGenerationService {
  /**
   * Generate flashcards from note content
   */
  async generateFlashcards(
    noteContent: string,
    noteTitle: string,
    options: FlashcardGenerationOptions = {}
  ): Promise<FlashcardData[]> {
    try {
      const {
        cardCount = 20,
        focusTopics = [],
        difficulty = 'medium',
        includeExamples = true,
        targetLanguage,
      } = options;

      const prompt = this.buildFlashcardPrompt(
        noteContent,
        noteTitle,
        cardCount,
        focusTopics,
        difficulty,
        includeExamples,
        targetLanguage
      );

      // Generate flashcards using Gemini
      const flashcardData = await geminiService.generateJSON(prompt);

      // Validate and format flashcards
      const formattedCards = this.validateAndFormatFlashcards(flashcardData);

      return formattedCards;
    } catch (error: any) {
      console.error('❌ Error generating flashcards:', error);
      throw new Error(`Flashcard generation failed: ${error.message}`);
    }
  }

  /**
   * Build flashcard generation prompt
   */
  private buildFlashcardPrompt(
    noteContent: string,
    noteTitle: string,
    cardCount: number,
    focusTopics: string[],
    difficulty: string,
    includeExamples: boolean,
    targetLanguage?: string
  ): string {
    const difficultyInstruction =
      difficulty === 'easy'
        ? 'Focus on basic concepts and simple definitions'
        : difficulty === 'hard'
        ? 'Include advanced concepts, relationships, and detailed explanations'
        : 'Balance between fundamental and advanced concepts';

    const focusInstruction =
      focusTopics.length > 0
        ? `\nFocus specifically on these topics: ${focusTopics.join(', ')}`
        : '';

    const exampleInstruction = includeExamples
      ? '\n- Include practical examples and applications'
      : '';

    const languageInstruction = targetLanguage
      ? `\n- Generate all flashcard content (front, back) in ${targetLanguage}. Use that language for all questions, answers, and explanations.`
      : '';

    return `You are an expert educator creating flashcards for active recall and spaced repetition learning.

Create ${cardCount} high-quality flashcard pairs from these study notes:

Title: ${noteTitle}

Notes:
${noteContent}

Requirements:
- ${difficultyInstruction}
- Cover the most important concepts systematically
- Front side: Clear, specific question or term (keep it focused on ONE thing)
- Back side: Concise answer or definition (2-3 sentences maximum)
- Use active recall principles (test understanding, not just memorization)
- Avoid yes/no questions${focusInstruction}${exampleInstruction}${languageInstruction}

Card types to include:
- "definition": Key terms and their meanings
- "concept": Understanding of important ideas
- "example": Practical applications and real-world examples
- "application": How to use or apply the knowledge

Return ONLY a JSON object in this exact format (no markdown, no code blocks):
{
  "cards": [
    {
      "front": "What is photosynthesis?",
      "back": "The process by which plants convert light energy into chemical energy (glucose) using carbon dioxide and water.",
      "type": "definition"
    },
    {
      "front": "Explain how photosynthesis helps the environment",
      "back": "Photosynthesis removes CO2 from the atmosphere and releases O2, helping maintain atmospheric balance and providing oxygen for aerobic organisms.",
      "type": "concept"
    },
    {
      "front": "Give an example of a non-plant organism that performs photosynthesis",
      "back": "Cyanobacteria are prokaryotes that perform photosynthesis, contributing significantly to ocean oxygen production.",
      "type": "example"
    }
  ]
}

Notes:
- Each card should test ONE specific piece of knowledge
- Answers should be concise but complete
- Avoid ambiguous questions
- Ensure proper JSON formatting`;
  }

  /**
   * Validate and format flashcard data from AI
   */
  private validateAndFormatFlashcards(flashcardData: any): FlashcardData[] {
    // Validate structure
    if (!flashcardData.cards || !Array.isArray(flashcardData.cards)) {
      throw new Error('Invalid flashcard format: missing cards array');
    }

    const cards: FlashcardData[] = [];
    const validTypes = ['concept', 'definition', 'example', 'application'];

    for (const card of flashcardData.cards) {
      // Validate required fields
      if (!card.front || !card.back) {
        console.warn('Skipping invalid card:', card);
        continue;
      }

      // Validate type
      const cardType = validTypes.includes(card.type) ? card.type : 'concept';

      // Format card
      cards.push({
        front: card.front.trim(),
        back: card.back.trim(),
        type: cardType,
        color: this.getColorForType(cardType),
      });
    }

    if (cards.length === 0) {
      throw new Error('No valid flashcards generated');
    }

    return cards;
  }

  /**
   * Get color for flashcard based on type
   */
  private getColorForType(type: string): string {
    const colors = {
      definition: '#007AFF', // Blue
      concept: '#34C759', // Green
      example: '#FF9500', // Orange
      application: '#AF52DE', // Purple
    };

    return colors[type as keyof typeof colors] || '#007AFF';
  }

  /**
   * Generate practice flashcards (fewer, easier)
   */
  async generatePracticeFlashcards(
    noteContent: string,
    noteTitle: string
  ): Promise<FlashcardData[]> {
    return this.generateFlashcards(noteContent, noteTitle, {
      cardCount: 10,
      difficulty: 'easy',
      includeExamples: false,
    });
  }

  /**
   * Generate comprehensive flashcards (more, mixed difficulty)
   */
  async generateComprehensiveFlashcards(
    noteContent: string,
    noteTitle: string
  ): Promise<FlashcardData[]> {
    return this.generateFlashcards(noteContent, noteTitle, {
      cardCount: 30,
      difficulty: 'medium',
      includeExamples: true,
    });
  }

  /**
   * Generate topic-focused flashcards
   */
  async generateTopicFlashcards(
    noteContent: string,
    noteTitle: string,
    topics: string[]
  ): Promise<FlashcardData[]> {
    return this.generateFlashcards(noteContent, noteTitle, {
      cardCount: 15,
      focusTopics: topics,
      difficulty: 'medium',
    });
  }

  /**
   * Update flashcard color
   */
  updateFlashcardColor(card: FlashcardData, color: string): FlashcardData {
    return {
      ...card,
      color,
    };
  }
}

export default new FlashcardGenerationService();
