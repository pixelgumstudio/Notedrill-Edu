import Note, { INote } from '../models/Note';
import Folder from '../models/Folder';
import mongoose from 'mongoose';
import crypto from 'crypto';

// Define the shape of the data for creating a note
export interface CreateNoteDTO {
  userId: string;
  title: string;
  content?: string;
  folderId?: string;
  /** Set when an org_admin uploads a file so it appears in org students' libraries. */
  orgId?: string;
  // Using 'any' for sourceType to avoid duplicating the extensive enum from the model
  sourceType: any;
}

// Define the shape of the data for updating a note
export interface UpdateNoteDTO {
  title?: string;
  content?: string;
  folderId?: string;
}

/**
 * @description Create a new note for a user.
 * @param {CreateNoteDTO} noteData - The data for the new note.
 * @returns {Promise<INote>} - The newly created note.
 */
export const createNote = async (noteData: CreateNoteDTO): Promise<INote> => {
  const { userId, folderId } = noteData;

  // If a folderId is provided, verify it belongs to the user
  if (folderId) {
    const folder = await Folder.findOne({ _id: folderId, userId, deletedAt: null });
    if (!folder) {
      throw new Error('Folder not found or access denied.');
    }
  }

  const note = new Note(noteData);
  await note.save();
  return note;
};

/**
 * @description Get all non-deleted notes for a user.
 * When orgId is supplied (org students and org_admins) the query is widened to
 * also return notes uploaded by teachers in that org (notes where orgId matches),
 * in addition to the user's own notes.  Standard mobile users receive only their
 * own notes — the default B2C behaviour is unchanged.
 */
export const getNotes = async (
  userId: string,
  filters?: { folderId?: string; sourceType?: string },
  orgId?: string
): Promise<INote[]> => {
  const query: any = { deletedAt: null };

  if (orgId) {
    query.$or = [
      { userId: new mongoose.Types.ObjectId(userId) },
      { orgId: new mongoose.Types.ObjectId(orgId) },
    ];
  } else {
    query.userId = userId;
  }

  if (filters?.folderId) query.folderId = filters.folderId;
  if (filters?.sourceType) query.sourceType = filters.sourceType;
  return Note.find(query).sort({ createdAt: -1 });
};

/**
 * @description Get a single note by its ID.
 * Org students may read teacher-uploaded notes in their org (orgId match).
 * Mutation endpoints (update/delete) always enforce strict userId ownership — this
 * wider read is intentional and read-only.
 */
export const getNoteById = async (
  userId: string,
  noteId: string,
  orgId?: string
): Promise<INote | null> => {
  if (orgId) {
    return Note.findOne({
      _id: noteId,
      deletedAt: null,
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { orgId: new mongoose.Types.ObjectId(orgId) },
      ],
    });
  }
  return Note.findOne({ _id: noteId, userId, deletedAt: null });
};

/**
 * @description Update a note's details.
 * @param {string} userId - The ID of the user.
 * @param {string} noteId - The ID of the note to update.
 * @param {UpdateNoteDTO} updateData - The data to update.
 * @returns {Promise<INote | null>} - The updated note.
 */
export const updateNote = async (
  userId: string,
  noteId: string,
  updateData: UpdateNoteDTO
): Promise<INote | null> => {
  const { folderId } = updateData;

  // If a new folderId is being assigned, verify it belongs to the user
  if (folderId) {
    const folder = await Folder.findOne({ _id: folderId, userId, deletedAt: null });
    if (!folder) {
      throw new Error('Folder not found or access denied.');
    }
  }

  const note = await Note.findOneAndUpdate(
    { _id: noteId, userId, deletedAt: null },
    { $set: updateData },
    { new: true }
  );

  return note;
};

/**
 * @description Soft delete a note.
 * @param {string} userId - The ID of the user.
 * @param {string} noteId - The ID of the note to delete.
 * @returns {Promise<{message: string}>} - A confirmation message.
 */
export const deleteNote = async (
  userId: string,
  noteId: string
): Promise<{ message: string }> => {
  const note = await Note.findOne({ _id: noteId, userId, deletedAt: null });

  if (!note) {
    throw new Error('Note not found.');
  }

  note.deletedAt = new Date();
  await note.save();

  return { message: 'Note successfully deleted.' };
};

/**
 * @description Toggles the sharing status of a note.
 * @param {string} userId - The ID of the user.
 * @param {string} noteId - The ID of the note to share/unshare.
 * @returns {Promise<INote>} - The updated note with its new sharing status.
 */
export const toggleSharing = async (userId: string, noteId: string): Promise<INote> => {
  const note = await Note.findOne({ _id: noteId, userId, deletedAt: null });

  if (!note) {
    throw new Error('Note not found.');
  }

  if (note.isShared) {
    // If already shared, unshare it
    note.isShared = false;
    note.shareableLink = undefined;
    note.sharedAt = undefined;
  } else {
    // If not shared, share it
    note.isShared = true;
    note.shareableLink = crypto.randomBytes(16).toString('hex');
    note.sharedAt = new Date();
  }

  await note.save();
  return note;
};

/**
 * @description Retrieves a shared note using its unique link.
 * @param {string} shareableLink - The unique link for the shared note.
 * @returns {Promise<INote | null>} - The shared note, or null if not found or not shared.
 */
export const getSharedNote = async (shareableLink: string): Promise<INote | null> => {
  return Note.findOne({ shareableLink, isShared: true, deletedAt: null });
};

/**
 * @description Search notes using full-text search with filters.
 * @param {string} userId - The ID of the user.
 * @param {string} query - The search query string.
 * @param {object} filters - Optional filters (sourceType, folderId, tags).
 * @returns {Promise<INote[]>} - Array of matching notes.
 */
export const searchNotes = async (
  userId: string,
  query: string,
  filters?: {
    sourceType?: string;
    folderId?: string;
    tags?: string[];
  },
  orgId?: string
): Promise<INote[]> => {
  const searchCriteria: any = { deletedAt: null };

  if (orgId) {
    searchCriteria.$or = [
      { userId: new mongoose.Types.ObjectId(userId) },
      { orgId: new mongoose.Types.ObjectId(orgId) },
    ];
  } else {
    searchCriteria.userId = userId;
  }

  // Add full-text search if query provided
  if (query && query.trim()) {
    searchCriteria.$text = { $search: query };
  }

  // Add filters
  if (filters?.sourceType) {
    searchCriteria.sourceType = filters.sourceType;
  }

  if (filters?.folderId) {
    searchCriteria.folderId = filters.folderId;
  }

  if (filters?.tags && filters.tags.length > 0) {
    searchCriteria.tags = { $in: filters.tags };
  }

  // Execute search with text score sorting if text search is used
  if (query && query.trim()) {
    return Note.find(searchCriteria, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
      .limit(50);
  }

  // Without text search, just sort by date
  return Note.find(searchCriteria)
    .sort({ createdAt: -1 })
    .limit(50);
};

/**
 * @description Enhance a note's content using AI.
 * @param {string} userId - The ID of the user.
 * @param {string} noteId - The ID of the note to enhance.
 * @returns {Promise<INote>} - The enhanced note.
 */
export const enhanceNote = async (userId: string, noteId: string): Promise<INote> => {
  const note = await Note.findOne({ _id: noteId, userId, deletedAt: null });

  if (!note) {
    throw new Error('Note not found');
  }

  if (!note.content || note.content.trim().length === 0) {
    throw new Error('Note has no content to enhance');
  }

  // Import note generation service dynamically
  const noteGenerationService = (await import('./noteGeneration.service')).default;

  // Enhance the note content
  const enhancedContent = await noteGenerationService.enhanceNote(note.content);

  // Update note with enhanced content
  note.content = enhancedContent;
  note.processingStatus = 'completed';
  await note.save();

  return note;
};

/**
 * @description Move a note to a different folder.
 * @param {string} userId - The ID of the user.
 * @param {string} noteId - The ID of the note to move.
 * @param {string | null} targetFolderId - The target folder ID, or null for root.
 * @returns {Promise<INote>} - The updated note.
 */
export const moveNoteToFolder = async (
  userId: string,
  noteId: string,
  targetFolderId: string | null
): Promise<INote> => {
  const note = await Note.findOne({ _id: noteId, userId, deletedAt: null });

  if (!note) {
    throw new Error('Note not found');
  }

  // If moving to a folder, verify it exists and belongs to the user
  if (targetFolderId) {
    const folder = await Folder.findOne({
      _id: targetFolderId,
      userId,
      deletedAt: null,
    });

    if (!folder) {
      throw new Error('Target folder not found');
    }

    note.folderId = new mongoose.Types.ObjectId(targetFolderId);
  } else {
    // Moving to root (no folder)
    note.folderId = undefined;
  }

  await note.save();
  return note;
};

/**
 * @description Translate a note's content to a target language
 * @param {string} userId - The ID of the user
 * @param {string} noteId - The ID of the note to translate
 * @param {string} targetLanguageCode - Target language code (e.g., 'es', 'fr', 'de')
 * @param {string} sourceLanguageCode - Optional source language code
 * @returns {Promise<INote>} - The translated note
 */
export const translateNote = async (
  userId: string,
  noteId: string,
  targetLanguageCode: string,
  sourceLanguageCode?: string
): Promise<INote> => {
  const note = await Note.findOne({ _id: noteId, userId, deletedAt: null });

  if (!note) {
    throw new Error('Note not found');
  }

  // Import translation service dynamically
  const translationService = (await import('./translation.service')).default;

  // Collect texts to translate
  const textsToTranslate: string[] = [];
  const hasTitle = note.title && note.title.trim().length > 0;
  const hasContent = note.content && note.content.trim().length > 0;
  const hasSummary = note.summary && note.summary.trim().length > 0;

  if (!hasTitle && !hasContent && !hasSummary) {
    throw new Error('Note has no content to translate');
  }

  // Build array in order: title, content, summary
  if (hasTitle) textsToTranslate.push(note.title);
  if (hasContent) textsToTranslate.push(note.content);
  if (hasSummary) textsToTranslate.push(note.summary);

  try {
    // Prefer per-field translation which handles large texts via chunking reliably
    if (hasTitle) {
      const t = await translationService.translateText(note.title, targetLanguageCode, sourceLanguageCode);
      note.title = t.translatedText;
    }

    if (hasContent) {
      const t = await translationService.translateText(note.content, targetLanguageCode, sourceLanguageCode);
      note.content = t.translatedText;
    }

    if (hasSummary) {
      const t = await translationService.translateText(note.summary, targetLanguageCode, sourceLanguageCode);
      note.summary = t.translatedText;
    }
  } catch (err) {
    // Fallback to batch translation for performance or if something unexpected fails
    console.warn('Per-field translation failed, falling back to batch translation:', (err as any)?.message || err);
    const translations = await translationService.translateBatch(
      textsToTranslate,
      targetLanguageCode,
      sourceLanguageCode
    );

    // Apply translations in order
    let translationIndex = 0;
    if (hasTitle) {
      note.title = translations[translationIndex].translatedText;
      translationIndex++;
    }
    if (hasContent) {
      note.content = translations[translationIndex].translatedText;
      translationIndex++;
    }
    if (hasSummary) {
      note.summary = translations[translationIndex].translatedText;
      translationIndex++;
    }
  }

  // Save the translated note
  await note.save();

  return note;
};
