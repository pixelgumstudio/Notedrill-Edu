export const FREE_TIER_LIMITS = {
  notes: 10_000,
  quizzes: 10_000,
  flashcards: 10_000,
  chats: 10_000,
} as const;

export type QuotaFeature = 'notes' | 'quizzes' | 'flashcards' | 'chats';
