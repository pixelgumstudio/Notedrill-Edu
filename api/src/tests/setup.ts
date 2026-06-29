// Test setup file
// This runs before all tests

// Set test environment variables (FIRST - before any modules load)
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key';
process.env.MONGODB_URI_TEST = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/notedrill-test';
process.env.GEMINI_API_KEY = 'test-gemini-api-key'; // Required for service initialization

// Increase timeout for async operations
jest.setTimeout(30000);

// === MOCK GEMINI SERVICE FIRST (before any modules that use it are loaded) ===
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
          explanation: 'This is the correct answer because...',
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

jest.mock('../services/gemini.service', () => {
  return {
    default: {
      generateText: jest.fn().mockResolvedValue('Mocked enhanced content'),
      generateJSON: mockGenerateJSON,
    },
  };
});

jest.mock('../services/storage.service', () => ({
  default: {
    uploadFile: jest.fn().mockResolvedValue('test-file-key'),
    getFile: jest.fn().mockResolvedValue(Buffer.from('test')),
    deleteFile: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../services/pdf.service', () => ({
  default: {
    extractText: jest.fn().mockResolvedValue({
      text: 'Extracted PDF text',
      pages: 1,
      info: {},
      metadata: {},
    }),
    extractTextFromBuffer: jest.fn().mockResolvedValue({
      text: 'Extracted PDF text from buffer',
      pages: 1,
      info: {},
      metadata: {
        title: undefined,
        author: undefined,
        subject: undefined,
        keywords: undefined,
        creationDate: undefined,
        modificationDate: undefined,
      },
    }),
    extractTextFromPages: jest.fn().mockResolvedValue('Extracted pages'),
    getMetadata: jest.fn().mockResolvedValue({
      title: undefined,
      author: undefined,
    }),
  },
}));

jest.mock('../services/transcription.service', () => ({
  default: {
    transcribeAudio: jest.fn().mockResolvedValue({
      text: 'Transcribed audio text',
      duration: 120,
      language: 'en',
    }),
    transcribeAudioBuffer: jest.fn().mockResolvedValue({
      text: 'Transcribed audio text from buffer',
      duration: 120,
      language: 'en',
    }),
    transcribeWithAutoDetect: jest.fn().mockResolvedValue({
      text: 'Auto-detected transcribed audio',
      language: 'en',
    }),
    transcribeWithLanguage: jest.fn().mockResolvedValue({
      text: 'Language-specific transcription',
      language: 'es',
    }),
    isAvailable: jest.fn().mockResolvedValue(true),
  },
}));

// === NOW set up console mocking (after all service mocks) ===
// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error for debugging
  error: console.error,
};

// Cleanup after all tests
afterAll(() => {
  jest.clearAllMocks();
});
