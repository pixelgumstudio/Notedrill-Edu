// Mock Gemini service for tests
const mockGenerateJSON = jest.fn().mockImplementation((prompt: string) => {
  if (prompt.includes('quiz') || prompt.includes('Quiz')) {
    return Promise.resolve({
      title: 'Generated Quiz Title',
      questions: [
        {
          questionText: 'Test question?',
          questionType: 'multiple-choice',
          options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
          correctAnswer: 0,
          explanation: 'This is the correct answer',
          difficulty: 'medium',
        },
      ],
    });
  }
  if (prompt.includes('flashcard') || prompt.includes('Flashcard')) {
    return Promise.resolve({
      cards: [
        {
          front: 'Sample question?',
          back: 'Sample answer',
          type: 'concept',
          color: '#FF6B6B',
        },
      ],
    });
  }
  return Promise.resolve({
    title: 'Generated Title',
    content: 'Generated content',
    summary: 'Generated summary',
  });
});

export default {
  generateText: jest.fn().mockResolvedValue('Mocked enhanced content'),
  generateJSON: mockGenerateJSON,
  extractTextFromImage: jest.fn().mockResolvedValue('Mocked text from image'),
  chat: jest.fn().mockResolvedValue('Mocked chat response'),
  chatWithSearch: jest.fn().mockResolvedValue('Mocked search response'),
};
