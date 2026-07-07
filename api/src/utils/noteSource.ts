// api/src/utils/noteSource.ts
// Resolves the best available source text for AI generation (quiz, flashcards,
// "generate more"). Prefers the raw extracted/transcribed text over the AI
// summary in `content`, since generating from a summary compounds lossiness —
// notes without a distinct source (e.g. plain text) just have content === source.

interface NoteLike {
  transcriptText?: string;
  extractedContent?: string;
  content?: string;
}

export function getNoteSourceText(note: NoteLike): string {
  return note.transcriptText?.trim() || note.extractedContent?.trim() || note.content?.trim() || '';
}
