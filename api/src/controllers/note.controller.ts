import { Request, Response } from 'express';
import os from 'os';
import fs from 'fs';
import nodePath from 'path';
import { randomUUID } from 'crypto';
import * as NoteService from '../services/note.service';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { successResponse, errorResponse, ERROR_CODES } from '../utils/response';
import { createJob, updateJob, getJobForUser } from '../services/job.service';
import { checkQuota, incrementQuota, QuotaExceededError } from '../services/quota.service';
import { User } from '../models/User';
import notificationService from '../services/notification.service';
import { getNoteSourceText } from '../utils/noteSource';

const DOC_MIME_TYPES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function generateDefaultTitle(sourceType: string): string {
  const date = new Date().toLocaleDateString();
  const labels: Record<string, string> = {
    audio: 'Audio Note', video: 'Video Note', text: 'Text Note',
    pdf: 'PDF Note', image: 'Image Note', youtube: 'YouTube Note',
  };
  return `${labels[sourceType] ?? 'Note'} - ${date}`;
}

// Zod Schema for creating a note
const CreateNoteSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  content: z.string().optional(),
  folderId: z.string().optional(),
  sourceType: z.enum(['audio', 'video', 'text', 'pdf', 'image', 'youtube']),
});

// Zod Schema for updating a note
const UpdateNoteSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty.').optional(),
  content: z.string().optional(),
  folderId: z.string().optional(),
});

// Zod Schema for translating a note
const TranslateNoteSchema = z.object({
  targetLanguage: z.string().min(2, 'Target language code is required.').max(10),
  sourceLanguage: z.string().min(2).max(10).optional(),
});

/**
 * @description Controller to handle creation of a new note.
 */
export const createNote = async (req: AuthRequest, res: Response) => {
  try {
    const noteData = CreateNoteSchema.parse(req.body);
    const userId = req.user!._id;

    try {
      checkQuota(req.user!, 'notes');
    } catch (e) {
      if (e instanceof QuotaExceededError) {
        return res.status(402).json({ success: false, quotaExceeded: true, feature: e.feature, message: e.message });
      }
      throw e;
    }

    const note = await NoteService.createNote({ ...noteData, userId });
    incrementQuota(userId.toString(), 'notes');
    res.status(201).json(successResponse(note, 'Note created successfully'));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse('Validation error', ERROR_CODES.VALIDATION_ERROR));
    }
    res.status(500).json(errorResponse(error.message || 'Error creating note', ERROR_CODES.SERVER_ERROR));
  }
};

/**
 * @description Controller to get all notes for the authenticated user.
 * Org students and org_admins also receive notes tagged with their org.
 */
export const getNotes = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const { folderId, sourceType } = req.query;
    const orgId = req.user!.orgId;

    const filters: { folderId?: string; sourceType?: string } = {};
    if (folderId && typeof folderId === 'string') filters.folderId = folderId;
    if (sourceType && typeof sourceType === 'string') filters.sourceType = sourceType;

    const notes = await NoteService.getNotes(userId, filters, orgId);
    res.status(200).json(successResponse(notes, 'Notes retrieved successfully'));
  } catch (error: any) {
    res.status(500).json(errorResponse(error.message || 'Error fetching notes', ERROR_CODES.SERVER_ERROR));
  }
};

/**
 * @description Controller to get a single note by ID.
 * Org students may read teacher-uploaded notes in their org.
 */
export const getNoteById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const { noteId } = req.params;
    const orgId = req.user!.orgId;

    const note = await NoteService.getNoteById(userId, noteId, orgId);
    if (!note) {
      return res.status(404).json(errorResponse('Note not found', ERROR_CODES.NOT_FOUND));
    }
    res.status(200).json(successResponse(note, 'Note retrieved successfully'));
  } catch (error: any) {
    res.status(500).json(errorResponse(error.message || 'Error fetching note', ERROR_CODES.SERVER_ERROR));
  }
};

/**
 * @description Controller to update a note.
 */
export const updateNote = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const { noteId } = req.params;
    const updateData = UpdateNoteSchema.parse(req.body);

    const updatedNote = await NoteService.updateNote(userId, noteId, updateData);
    if (!updatedNote) {
      return res.status(404).json(errorResponse('Note not found', ERROR_CODES.NOT_FOUND));
    }
    res.status(200).json(successResponse(updatedNote, 'Note updated successfully'));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse('Validation error', ERROR_CODES.VALIDATION_ERROR));
    }
    res.status(500).json(errorResponse(error.message || 'Error updating note', ERROR_CODES.SERVER_ERROR));
  }
};

/**
 * @description Controller to delete a note.
 */
export const deleteNote = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const { noteId } = req.params;

    const result = await NoteService.deleteNote(userId, noteId);
    res.status(200).json(successResponse(result, 'Note deleted successfully'));
  } catch (error: any) {
    if (error.message === 'Note not found') {
      return res.status(404).json(errorResponse(error.message, ERROR_CODES.NOT_FOUND));
    }
    res.status(500).json(errorResponse(error.message || 'Error deleting note', ERROR_CODES.SERVER_ERROR));
  }
};

/**
 * @description Controller to toggle the sharing status of a note.
 */
export const toggleNoteSharing = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const { noteId } = req.params;

    const note = await NoteService.toggleSharing(userId, noteId);

    // Build the shareable URL and return the token separately for deep linking
    const responseData = {
      isShared: note.isShared,
      shareableLink: note.isShared ? note.shareableLink : undefined,
      url: note.isShared && note.shareableLink
        ? `${req.protocol}://${req.get('host')}/api/v1/notes/shared/${note.shareableLink}`
        : undefined
    };

    res.status(200).json(successResponse(responseData, note.isShared ? 'Note shared successfully' : 'Note unshared successfully'));
  } catch (error: any) {
    if (error.message === 'Note not found') {
      return res.status(404).json(errorResponse(error.message, ERROR_CODES.NOT_FOUND));
    }
    res.status(500).json(errorResponse(error.message || 'Error updating note sharing status', ERROR_CODES.SERVER_ERROR));
  }
};

/**
 * @description Controller to export a note in various formats.
 */
export const exportNote = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const { noteId } = req.params;
    const { exportType = 'full' } = req.body;

    const note = await NoteService.getNoteById(userId, noteId, req.user!.orgId);
    if (!note) {
      return res.status(404).json(errorResponse('Note not found', ERROR_CODES.NOT_FOUND));
    }

    const { htmlToPlainText } = await import('../utils/htmlToPlainText');

    // Build HTML content based on export type
    const summaryHtml = (note as any).summary || '';
    const contentHtml = note.content || '';
    const transcriptRaw = (note as any).transcriptText || (note as any).extractedContent || '';

    let htmlContent = '';
    if (exportType === 'transcript') {
      if (transcriptRaw) {
        htmlContent = `<p>${transcriptRaw.replace(/\n/g, '</p><p>')}</p>`;
      } else {
        // No transcript stored — export full note content
        if (summaryHtml) htmlContent += summaryHtml;
        if (contentHtml) htmlContent += contentHtml;
      }
    } else {
      // 'summary' or any other type — export everything visible in the note
      if (summaryHtml) htmlContent += summaryHtml;
      if (contentHtml) htmlContent += contentHtml;
    }

    const textContent = htmlToPlainText(htmlContent);
    const filename = note.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50) || 'note';

    res.status(200).json(successResponse({
      title: note.title,
      textContent,
      htmlContent,
      filename,
    }, 'Note export content ready'));
  } catch (error: any) {
    res.status(500).json(errorResponse(error.message || 'Error exporting note', ERROR_CODES.SERVER_ERROR));
  }
};

/**
 * @description Controller to get a shared note by its link. This is a public endpoint.
 */
export const getSharedNote = async (req: Request, res: Response) => {
  try {
    const { shareableLink } = req.params;
    const note = await NoteService.getSharedNote(shareableLink);

    if (!note) {
      return res.status(404).json(errorResponse('Shared note not found', ERROR_CODES.NOT_FOUND));
    }

    // Return a public-facing version of the note
    const publicNote = {
      title: note.title,
      content: note.content,
      sourceType: note.sourceType,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt
    };
    res.status(200).json(successResponse(publicNote, 'Shared note retrieved successfully'));
  } catch (error: any) {
    res.status(500).json(errorResponse(error.message || 'Error fetching shared note', ERROR_CODES.SERVER_ERROR));
  }
};

/**
 * @description Save a shared note to the current user's library (clone it).
 */
export const saveSharedNote = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const { shareableLink } = req.params;

    const sharedNote = await NoteService.getSharedNote(shareableLink);
    if (!sharedNote) {
      return res.status(404).json(errorResponse('Shared note not found', ERROR_CODES.NOT_FOUND));
    }

    const savedNote = await NoteService.createNote({
      userId,
      title: sharedNote.title,
      content: sharedNote.content ?? '',
      sourceType: sharedNote.sourceType as any,
    } as any);

    res.status(201).json(successResponse(savedNote, 'Note saved to your library'));
  } catch (error: any) {
    res.status(500).json(errorResponse(error.message || 'Error saving shared note', ERROR_CODES.SERVER_ERROR));
  }
};

/**
 * @description Controller to search notes with full-text search and filters.
 */
export const searchNotes = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const { q, sourceType, folderId, tags } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Search query (q) is required',
      });
    }

    const filters: any = {};
    if (sourceType && typeof sourceType === 'string') {
      filters.sourceType = sourceType;
    }
    if (folderId && typeof folderId === 'string') {
      filters.folderId = folderId;
    }
    if (tags) {
      filters.tags = typeof tags === 'string' ? [tags] : tags;
    }

    const notes = await NoteService.searchNotes(userId, q, filters, req.user!.orgId);

    res.status(200).json({
      success: true,
      data: notes,
      count: notes.length,
    });
  } catch (error: any) {
    console.error('Search notes error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching notes',
      error: error.message,
    });
  }
};

/**
 * @description Controller to enhance a note's content using AI.
 */
export const enhanceNoteContent = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const { noteId } = req.params;

    if (!noteId) {
      return res.status(400).json({
        success: false,
        message: 'Note ID is required',
      });
    }

    const NoteModel = (await import('../models/Note')).default;
    const note = await NoteModel.findOne({
      _id: noteId,
      userId,
    });

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found',
      });
    }

    if (!note.content) {
      return res.status(400).json({
        success: false,
        message: 'Note has no content to enhance',
      });
    }

    const noteGenerationService = (await import('../services/noteGeneration.service')).default;
    const enhancedNote = await noteGenerationService.generateNote(
      note.content,
      note.sourceType || 'text',
      { goals: (req.user as any)?.goals || [] }
    );

    note.content = enhancedNote.content;
    if (enhancedNote.title) {
      note.title = enhancedNote.title;
    }
    await note.save();

    res.status(200).json({
      success: true,
      message: 'Note enhanced successfully',
      data: note,
    });
  } catch (error: any) {
    console.error('Enhance note error:', error);
    if (error.message === 'Note not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    if (error.message === 'Note has no content to enhance') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error enhancing note',
      error: error.message,
    });
  }
};

/**
 * @description Controller to move a note to a different folder.
 */
export const moveToFolder = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const { noteId } = req.params;
    const { folderId } = req.body;

    if (!noteId) {
      return res.status(400).json(errorResponse('Note ID is required', ERROR_CODES.VALIDATION_ERROR));
    }

    // folderId can be null to move to root
    const targetFolderId = folderId === null || folderId === undefined || folderId === '' ? null : folderId;

    const updatedNote = await NoteService.moveNoteToFolder(userId, noteId, targetFolderId);

    res.status(200).json(successResponse(
      updatedNote,
      targetFolderId ? 'Note moved to folder successfully' : 'Note moved to root successfully'
    ));
  } catch (error: any) {
    console.error('Move note error:', error);
    if (error.message === 'Note not found' || error.message === 'Target folder not found') {
      return res.status(404).json(errorResponse(error.message, ERROR_CODES.NOT_FOUND));
    }
    res.status(500).json(errorResponse(error.message || 'Error moving note', ERROR_CODES.SERVER_ERROR));
  }
};

/**
 * @description Generate a note from file upload or text content.
 * ALL source types return 202 + jobId immediately. Generation runs in an async IIFE.
 * File buffers are written to a temp file before the 202 is sent so the multer
 * buffer is not held in a closure across the full generation lifetime.
 * Quota deduction fires ONLY after the note is successfully persisted.
 */
export const generateNote = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const { title, sourceType, content, folderId } = req.body;
    const file = req.file;

    // ── Synchronous validation ──────────────────────────────────────
    if (!sourceType) {
      return res.status(400).json({ message: 'sourceType is required' });
    }

    // Quota CHECK stays synchronous; deduction moves into the async job.
    try {
      checkQuota(req.user!, 'notes');
    } catch (e) {
      if (e instanceof QuotaExceededError) {
        return res.status(402).json({ success: false, quotaExceeded: true, feature: e.feature, message: e.message });
      }
      throw e;
    }

    if (file) {
      if (sourceType === 'audio' && !file.mimetype.startsWith('audio/')) {
        return res.status(400).json({ message: 'Unsupported file type for sourceType: audio' });
      }
      if (sourceType === 'pdf' && file.mimetype !== 'application/pdf' && !DOC_MIME_TYPES.includes(file.mimetype)) {
        return res.status(400).json({ message: 'Unsupported file type for sourceType: pdf' });
      }
      if (sourceType === 'image' && !file.mimetype.startsWith('image/')) {
        return res.status(400).json({ message: 'Unsupported file type for sourceType: image' });
      }
      if (sourceType !== 'audio' && sourceType !== 'pdf' && sourceType !== 'image') {
        return res.status(400).json({ message: 'Unsupported file type for sourceType: ' + sourceType });
      }
    } else if (!content) {
      return res.status(400).json({ message: 'Either file upload or content is required' });
    }

    // ── For simple text generation, handle synchronously ──────────────
    if (!file && sourceType === 'text') {
      try {
        const note = await NoteService.createNote({
          userId,
          title: title || 'Untitled Note',
          content: content || '',
          summary: '',
          sourceType: sourceType,
          folderId: folderId,
          orgId: req.user!.orgId,
          metadata: {},
          processingStatus: 'completed',
          extractedContent: content || '',
        } as any);

        // Quota deduction: after successful note creation
        await incrementQuota(userId.toString(), 'notes');
        await User.findByIdAndUpdate(userId, { $inc: { notesCount: 1 } });

        const noteResult = note.toObject ? note.toObject() : note;

        // Send notification for synchronous completion
        const noteId = noteResult._id?.toString() || noteResult.id;
        await notificationService.sendJobCompletionNotification(
          userId.toString(),
          noteId,
          'note',
          'completed'
        ).catch(err => console.error('Failed to send notification:', err));

        return res.status(201).json(successResponse(noteResult, 'Note created successfully'));
      } catch (error: any) {
        console.error('Error creating note:', error);
        return res.status(500).json({ success: false, message: 'Error creating note' });
      }
    }

    // ── Write buffer to disk before releasing request memory ───────
    // The async IIFE must NOT close over file.buffer. Writing synchronously
    // here (per spec) ensures the data is on disk before we send 202.
    let tempFilePath: string | null = null;
    if (file) {
      const ext = nodePath.extname(file.originalname) || (sourceType === 'audio' ? '.audio' : '.bin');
      tempFilePath = nodePath.join(os.tmpdir(), `notedrill-${Date.now()}-${randomUUID()}${ext}`);
      fs.writeFileSync(tempFilePath, file.buffer);
    }

    // ── Create persisted job, then respond 202 ────────────────────
    const jobId = await createJob(userId.toString(), 'note_generation');

    res.status(202).json({
      success: true,
      message: 'Note generation started',
      data: { jobId },
    });

    // ── Capture all req-derived values; req object must not be used inside IIFE ──
    const userGoals: string[] = (req.user as any)?.goals || [];
    const capturedTitle: string | undefined = title;
    const capturedSourceType: string = sourceType;
    const capturedContent: string | undefined = content;
    const capturedFolderId: string | undefined = folderId;
    // Stamp orgId on notes created by org_admins so students can see them.
    const capturedOrgId: string | undefined = req.user!.orgId;
    const capturedFileOriginalname: string | undefined = file?.originalname;
    const capturedFileMimetype: string | undefined = file?.mimetype;
    const capturedTempFilePath: string | null = tempFilePath;

    // ── Async generation (fires after 202) ────────────────────────
    (async () => {
      let noteResult: any = null;
      let noteContent = capturedContent || '';
      let noteTitle = capturedTitle || 'Untitled Note';
      let noteSummary = '';
      let metadata: any = {};
      // True raw extracted/source text (OCR, PDF/doc parse, or pasted text) —
      // captured BEFORE noteContent gets overwritten by the AI-generated note,
      // so quiz/flashcard generation can work from the source, not the summary.
      let rawSourceText = capturedContent || '';

      try {
        if (capturedTempFilePath) {
          if (capturedSourceType === 'audio') {
            // ── Audio: upload → create pending note → full transcription pipeline ──
            const transcriptionService = (await import('../services/transcription.service')).default;
            const storageService = (await import('../services/storage.service')).default;

            const isAvailable = await transcriptionService.isAvailable();
            if (!isAvailable) throw new Error('Transcription service is not configured');

            const audioBuffer = await fs.promises.readFile(capturedTempFilePath);

            let fileKey: string = '';
            try {
              fileKey = await storageService.uploadFile(
                audioBuffer,
                `audio/${userId}/${Date.now()}-${capturedFileOriginalname}`,
                capturedFileMimetype!
              );
            } catch (uploadError: any) {
              console.warn('⚠️ MinIO upload failed (non-fatal for audio), continuing:', uploadError.message);
              // Continue without MinIO — transcription doesn't need the file key
            }

            // 🧠 Audio Title Interceptor
            const isGenericAudioName = !capturedTitle ||
                                       capturedTitle === 'Untitled Note' ||
                                       /\.(mp3|m4a|wav|ogg|flac|aac|webm)$/i.test(capturedTitle);

            const pendingNote = await NoteService.createNote({
              userId,
              // Give it a temporary status title instead of "audio.mp3"
              title: isGenericAudioName ? 'Transcribing Audio...' : capturedTitle,
              content: '',
              summary: '',
              sourceType: 'audio',
              folderId: capturedFolderId,
              orgId: capturedOrgId,
              metadata: { originalFileName: capturedFileOriginalname, fileKey: fileKey || null } as any,
              processingStatus: 'transcribing',
              processingProgress: 5,
            } as any);

            const { processAudioNote } = await import('../services/transcription.service');
            await processAudioNote(
              pendingNote._id.toString(),
              audioBuffer,
              capturedFileOriginalname!,
              capturedFileMimetype!
            );

            const NoteModel = (await import('../models/Note')).default;
            const finalNote = await NoteModel.findById(pendingNote._id);

            if (!finalNote || finalNote.processingStatus === 'failed') {
              throw new Error((finalNote as any)?.error || 'Audio transcription and generation failed');
            }
            noteResult = finalNote.toObject();

          } else if (capturedSourceType === 'image') {
            // ── Image: upload to storage → OCR extract text → AI generation ──
            const ocrService = (await import('../services/ocr.service')).default;
            const storageService = (await import('../services/storage.service')).default;
            const noteGenerationService = (await import('../services/noteGeneration.service')).default;

            const imageBuffer = await fs.promises.readFile(capturedTempFilePath);

            const fileKey = await storageService.uploadFile(
              imageBuffer,
              `images/${userId}/${Date.now()}-${capturedFileOriginalname}`,
              capturedFileMimetype!
            );

            const ocrResult = await ocrService.extractTextFromImage(fileKey);

            const words = ocrResult.text.trim().split(/\s+/).filter((w) => w.length > 2);
            if (words.length < 5) {
              throw Object.assign(
                new Error('Could not extract enough readable text from this image. Please try a clearer photo.'),
                { code: 'IMAGE_QUALITY' }
              );
            }

            noteContent = ocrResult.text;
            rawSourceText = ocrResult.text;
            metadata = { originalFileName: capturedFileOriginalname, fileKey, ocrConfidence: ocrResult.confidence };

            const generatedNote = await noteGenerationService.generateNote(
              noteContent, capturedSourceType, { goals: userGoals }
            );
            noteContent = generatedNote.content;
            noteSummary = generatedNote.summary || '';
            const isGenericFilename = !capturedTitle ||
                                      capturedTitle === 'Untitled Note' ||
                                      /^IMG_/i.test(capturedTitle) ||
                                      /\.(pdf|png|jpe?g|txt|docx?)$/i.test(capturedTitle);

            if (isGenericFilename) {
              noteTitle = generatedNote.title || generateDefaultTitle(capturedSourceType);
            } else {
              noteTitle = capturedTitle;
            }

          } else if (capturedFileMimetype && DOC_MIME_TYPES.includes(capturedFileMimetype)) {
            // ── Word doc (.doc/.docx): extract text from disk → upload to storage → AI generation ──
            const docxService = (await import('../services/docx.service')).default;
            const storageService = (await import('../services/storage.service')).default;
            const noteGenerationService = (await import('../services/noteGeneration.service')).default;

            const fileBuffer = await fs.promises.readFile(capturedTempFilePath);

            const docResult = await docxService.extractTextFromBuffer(fileBuffer);

            const words = docResult.text.trim().split(/\s+/).filter(w => w.length > 2);
            if (words.length < 50) {
              throw Object.assign(
                new Error('Could not extract enough readable text from this document. The file may be empty, corrupted, or contain mostly images.'),
                { code: 'PDF_QUALITY' }
              );
            }
            noteContent = docResult.text;
            rawSourceText = docResult.text;
            metadata = { originalFileName: capturedFileOriginalname };

            let fileKey: string = '';
            try {
              fileKey = await storageService.uploadFile(
                fileBuffer,
                `documents/${userId}/${Date.now()}-${capturedFileOriginalname}`,
                capturedFileMimetype!
              );
              metadata.fileKey = fileKey;
            } catch (uploadError: any) {
              console.warn('⚠️ MinIO upload failed (non-fatal for document), continuing:', uploadError.message);
              // Continue without MinIO — extraction already succeeded
            }

            const generatedNote = await noteGenerationService.generateNote(
              noteContent, capturedSourceType, { goals: userGoals }
            );
            noteContent = generatedNote.content;
            noteSummary = generatedNote.summary || '';
            const isGenericFilename = !capturedTitle ||
                                      capturedTitle === 'Untitled Note' ||
                                      /^IMG_/i.test(capturedTitle) ||
                                      /\.(pdf|png|jpe?g|txt|docx?)$/i.test(capturedTitle);

            if (isGenericFilename) {
              noteTitle = generatedNote.title || generateDefaultTitle(capturedSourceType);
            } else {
              noteTitle = capturedTitle;
            }

          } else {
            // ── PDF: extract text from disk → upload to storage → AI generation ──
            const pdfService = (await import('../services/pdf.service')).default;
            const storageService = (await import('../services/storage.service')).default;
            const noteGenerationService = (await import('../services/noteGeneration.service')).default;

            const fileBuffer = await fs.promises.readFile(capturedTempFilePath);

            const pdfResult = await pdfService.extractTextFromBuffer(fileBuffer);

            // Guard: word-count quality check (not just character count)
            const words = pdfResult.text.trim().split(/\s+/).filter(w => w.length > 2);
            if (words.length < 50) {
              // ── OCR Fallback: pass PDF directly to Gemini Vision ──────────────
              console.log(
                `⚠️ [PDF] Low text yield (${words.length} words, type: ${pdfResult.pdfType}) — ` +
                `attempting Gemini Vision OCR fallback`
              );
              const geminiService = (await import('../services/gemini.service')).default;
              let ocrText = '';
              try {
                ocrText = await geminiService.extractTextFromPdf(fileBuffer);
              } catch (ocrErr: any) {
                console.error('❌ [PDF] Gemini Vision OCR fallback error:', ocrErr.message);
                // Fall through to the quality-error throw below
              }

              const ocrWords = ocrText.trim().split(/\s+/).filter(w => w.length > 2);
              if (ocrWords.length >= 50) {
                console.log(`✅ [PDF] OCR fallback succeeded — ${ocrWords.length} words extracted`);
                noteContent = ocrText;
                rawSourceText = ocrText;
              } else {
                // Both methods failed — surface a user-friendly error
                const reason = pdfResult.pdfType === 'scanned'
                  ? 'This appears to be a scanned (image-based) PDF. Our AI OCR could not extract enough text. Please try a clearer scan or a text-based PDF.'
                  : 'Could not extract enough readable text from this PDF. The file may be corrupted, password-protected, or image-only.';
                throw Object.assign(new Error(reason), { code: 'PDF_QUALITY' });
              }
              // ── End OCR Fallback ───────────────────────────────────────────────
            } else {
              noteContent = pdfResult.text;
              rawSourceText = pdfResult.text;
            }
            metadata = { pages: pdfResult.pages, originalFileName: capturedFileOriginalname };

            let fileKey: string = '';
            try {
              fileKey = await storageService.uploadFile(
                fileBuffer,
                `pdfs/${userId}/${Date.now()}-${capturedFileOriginalname}`,
                capturedFileMimetype!
              );
              metadata.fileKey = fileKey;
            } catch (uploadError: any) {
              console.warn('⚠️ MinIO upload failed (non-fatal for PDF), continuing:', uploadError.message);
              // Continue without MinIO — extraction already succeeded
            }

            const generatedNote = await noteGenerationService.generateNote(
              noteContent, capturedSourceType, { goals: userGoals }
            );
            noteContent = generatedNote.content;
            noteSummary = generatedNote.summary || '';
            const isGenericFilename = !capturedTitle || 
                                      capturedTitle === 'Untitled Note' || 
                                      /^IMG_/i.test(capturedTitle) ||
                                      /\.(pdf|png|jpe?g|txt|docx?)$/i.test(capturedTitle);

            if (isGenericFilename) {
              // 🗑️ Throw away the ugly filename completely!
              // Use the AI title. If the AI didn't make one, use a clean fallback.
              noteTitle = generatedNote.title || generateDefaultTitle(capturedSourceType);
            } else {
              // ✅ It's a real, custom title typed by the user. Keep it!
              noteTitle = capturedTitle;
            }
          }
        } else {
          // ── Text / image-OCR text / YouTube ──
          const noteGenerationService = (await import('../services/noteGeneration.service')).default;

          if (capturedSourceType === 'youtube') {
            // ── YouTube: fetch real transcript → AI generation ──
            // noteContent currently holds the raw URL the user pasted, not a
            // transcript — fetch the actual captions before generating.
            const youtubeService = (await import('../services/youtube.service')).default;
            const youtubeUrl = noteContent;

            if (!youtubeService.isValidYouTubeUrl(youtubeUrl)) {
              throw Object.assign(
                new Error('That doesn\'t look like a valid YouTube URL. Please check the link and try again.'),
                { code: 'YOUTUBE_INVALID_URL' }
              );
            }

            let transcriptResult;
            try {
              transcriptResult = await youtubeService.getTranscript(youtubeUrl);
            } catch (transcriptErr: any) {
              console.error('❌ [YouTube] Transcript fetch failed:', transcriptErr.message);
              throw Object.assign(
                new Error('Could not fetch a transcript for this video. It may have captions disabled — try a different video.'),
                { code: 'YOUTUBE_TRANSCRIPT_UNAVAILABLE' }
              );
            }

            const words = transcriptResult.transcript.trim().split(/\s+/).filter(w => w.length > 2);
            if (words.length < 20) {
              throw Object.assign(
                new Error('This video\'s transcript is too short to generate useful notes from.'),
                { code: 'YOUTUBE_TRANSCRIPT_UNAVAILABLE' }
              );
            }

            const videoInfo = await youtubeService.getVideoInfo(youtubeUrl).catch(() => null);
            const videoTitle = capturedTitle || videoInfo?.title || 'YouTube Video Note';

            rawSourceText = transcriptResult.transcript;
            metadata = {
              youtubeVideoId: transcriptResult.videoId,
              youtubeTitle: videoInfo?.title,
              youtubeThumbnail: videoInfo?.thumbnail,
            };

            const generatedNote = await noteGenerationService.generateNoteFromYouTube(
              rawSourceText, videoTitle, { goals: userGoals }
            );
            noteContent = generatedNote.content;
            noteSummary = generatedNote.summary || '';
            noteTitle = generatedNote.title || videoTitle;
          } else {
            const generatedNote = await noteGenerationService.generateNote(
              noteContent, capturedSourceType, { goals: userGoals }
            );
            noteContent = generatedNote.content;
            noteSummary = generatedNote.summary || '';
            if (!capturedTitle) {
              noteTitle = generatedNote.title || generateDefaultTitle(capturedSourceType);
            }
          }
        }

        // ── Persist note (non-audio paths — audio already persisted above) ──
        if (capturedSourceType !== 'audio') {
          const note = await NoteService.createNote({
            userId,
            title: noteTitle,
            content: noteContent,
            summary: noteSummary,
            sourceType: capturedSourceType,
            folderId: capturedFolderId,
            orgId: capturedOrgId,
            metadata,
            processingStatus: 'completed',
            extractedContent: rawSourceText || noteContent,
          } as any);
          noteResult = note.toObject ? note.toObject() : note;
        }

        // ── Quota deduction: ONLY after successful note creation ───
        await incrementQuota(userId.toString(), 'notes');
        await User.findByIdAndUpdate(userId, { $inc: { notesCount: 1 } });

        // Normalize result to include backward-compat id keys alongside noteId
        const _noteIdStr = noteResult?._id?.toString() ?? null;
        const normalizedResult = _noteIdStr
          ? { ...noteResult, _id: _noteIdStr, id: _noteIdStr, noteId: _noteIdStr }
          : noteResult;
        await updateJob(jobId, { status: 'completed', result: normalizedResult });
        console.log('✅ Note created via job:', { jobId, noteId: _noteIdStr });

        // Send notification for async job completion
        if (_noteIdStr) {
          await notificationService.sendJobCompletionNotification(
            userId.toString(),
            _noteIdStr,
            'note',
            'completed'
          ).catch(err => console.error('Failed to send completion notification:', err));
        }

      } catch (error: any) {
        console.error(`❌ Async note generation error (job ${jobId}):`, error);

        let userMessage = 'Note generation failed. Please check your file and try again.';
        if (error.code === 'PDF_QUALITY') {
          userMessage = 'We couldn\'t extract enough readable text from this PDF. Try a text-based PDF with clear content, or copy-paste the text instead.';
        } else if (error.code === 'IMAGE_QUALITY') {
          userMessage = 'We couldn\'t extract enough readable text from this image. Try a clearer, well-lit photo of the text.';
        } else if (error.code === 'YOUTUBE_INVALID_URL' || error.code === 'YOUTUBE_TRANSCRIPT_UNAVAILABLE') {
          userMessage = error.message;
        } else if (error.message?.includes('AI_REFUSAL')) {
          userMessage = 'The extracted content wasn\'t suitable for note generation. Please try a different document.';
        }

        await updateJob(jobId, {
          status: 'failed',
          error: error.message || 'Note generation failed',
          userMessage,
        }).catch(() => {});

        // Send notification for job failure
        await notificationService.sendJobCompletionNotification(
          userId.toString(),
          jobId,
          'note',
          'failed'
        ).catch(err => console.error('Failed to send failure notification:', err));
      } finally {
        // Always remove the temp file — even if generation or job update fails.
        if (capturedTempFilePath) {
          fs.unlink(capturedTempFilePath, (err) => {
            if (err) console.error('Failed to delete temp file:', capturedTempFilePath, err);
          });
        }
      }
    })();

  } catch (error: any) {
    console.error('Generate note error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating note',
      error: error.message,
    });
  }
};

/**
 * @description Controller to translate a note to a target language.
 */
export const translateNote = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const { noteId } = req.params;
    const { targetLanguage, sourceLanguage } = TranslateNoteSchema.parse(req.body);

    if (!noteId) {
      return res.status(400).json({
        success: false,
        message: 'Note ID is required',
      });
    }

    const translatedNote = await NoteService.translateNote(
      userId,
      noteId,
      targetLanguage,
      sourceLanguage
    );

    res.status(200).json({
      success: true,
      message: 'Note translated successfully',
      data: translatedNote,
    });
  } catch (error: any) {
    console.error('Translate note error:', error);

    if (error.message === 'Note not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    if (error.message === 'Note has no content to translate') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error translating note',
      error: error.message,
    });
  }
};

/**
 * @description Append more AI-generated questions or flashcards to an existing set.
 * POST /notes/:noteId/generate-more
 * Body: { type: 'quiz'|'flashcards', count: number, quizId?: string, flashcardSetId?: string }
 * Returns the new items in the same shape as generateAdminQuiz / generateAdminFlashcards.
 */
export const generateMore = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const { noteId } = req.params;
    const { type, count = 5, quizId, flashcardSetId } = req.body;

    if (!type || !['quiz', 'flashcards'].includes(type)) {
      return res.status(400).json({ success: false, message: "type must be 'quiz' or 'flashcards'" });
    }

    const note = await (await import('../models/Note')).default.findOne({
      _id: noteId,
      deletedAt: null,
      $or: [{ userId }, ...(req.user!.orgId ? [{ orgId: req.user!.orgId }] : [])],
    });

    const sourceText = note ? getNoteSourceText(note) : '';
    if (!note || !sourceText) {
      return res.status(404).json({ success: false, message: 'Note not found or has no content' });
    }

    if (type === 'quiz') {
      const quizGenerationService = (await import('../services/quizGeneration.service')).default;
      const quizData = await quizGenerationService.generateQuiz(sourceText, note.title, {
        questionCount: Math.min(count, 20),
        difficulty: 'medium',
        questionTypes: ['multiple-choice'],
      });

      // Append to existing Quiz document if ID supplied
      if (quizId) {
        const Quiz = (await import('../models/Quiz')).default;
        await Quiz.findOneAndUpdate(
          { _id: quizId, userId },
          {
            $push: { questions: { $each: quizData.questions } },
            $inc: { totalQuestions: quizData.questions.length },
          },
        );
      }

      const newQuestions = quizData.questions.map((q: any, i: number) => ({
        id: `question-extra-${Date.now()}-${i}`,
        question: q.questionText,
        questionText: q.questionText,
        options: q.options.map((text: string, j: number) => ({ id: `option-${j}`, text })),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
      }));

      return res.status(200).json(successResponse({ type: 'quiz', quizId: quizId ?? null, questions: newQuestions }, 'Additional questions generated'));
    }

    // flashcards
    const flashcardGenerationService = (await import('../services/flashcardGeneration.service')).default;
    const cards = await flashcardGenerationService.generateFlashcards(sourceText, note.title, {
      cardCount: Math.min(count, 20),
      difficulty: 'medium',
    });

    if (flashcardSetId) {
      const FlashcardSet = (await import('../models/FlashcardSet')).default;
      const newCards = cards.map((c: any) => ({ front: c.front, back: c.back, color: c.color, mastered: false, reviewCount: 0 }));
      await FlashcardSet.findOneAndUpdate(
        { _id: flashcardSetId, userId },
        {
          $push: { cards: { $each: newCards } },
          $inc: { totalCards: cards.length },
        },
      );
    }

    return res.status(200).json(successResponse(
      { type: 'flashcards', flashcardSetId: flashcardSetId ?? null, cards },
      'Additional flashcards generated',
    ));
  } catch (error: any) {
    res.status(500).json(errorResponse(error.message || 'Error generating more content', ERROR_CODES.SERVER_ERROR));
  }
};

/**
 * @description Poll the status of a background note-generation job.
 * Returns { jobId, status, result, error } — clients poll until status is 'completed' or 'failed'.
 */
export const getJobStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const { jobId } = req.params;

    const job = await getJobForUser(jobId, userId.toString());
    if (!job) {
      return res.status(404).json(errorResponse('Job not found', ERROR_CODES.NOT_FOUND));
    }

    res.status(200).json(successResponse({
      jobId: job.jobId,
      status: job.status,
      result: job.result ?? null,
      error: job.userMessage || job.error || null,
    }, 'Job status retrieved'));
  } catch (error: any) {
    res.status(500).json(errorResponse(error.message || 'Error fetching job status', ERROR_CODES.SERVER_ERROR));
  }
};

/**
 * Re-transcribe an audio note
 */
export const retranscribeNote = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const { noteId } = req.params;

    if (!noteId) {
      return res.status(400).json({
        success: false,
        message: 'Note ID is required',
      });
    }

    // Find the note
    const NoteModel = (await import('../models/Note')).default;
    const note = await NoteModel.findOne({
      _id: noteId,
      userId,
      deletedAt: null,
    });

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found',
      });
    }

    // Check if note was created from audio source
    if (note.sourceType !== 'audio' && note.sourceType !== 'video') {
      return res.status(400).json({
        success: false,
        message: 'Re-transcribe is only available for audio and video notes',
      });
    }

    // Check if source file URL exists
    if (!note.sourceFileUrl) {
      return res.status(400).json({
        success: false,
        message: 'Original audio file not available. Re-transcription requires the source file to be stored.',
      });
    }

    // TODO: Implement actual re-transcription
    // This requires:
    // 1. Fetching the audio file from sourceFileUrl
    // 2. Running it through the transcription service
    // 3. Updating the note with new transcript
    // 4. Optionally regenerating the summary

    res.status(501).json({
      success: false,
      message: 'Re-transcription feature is coming soon. Audio file storage is required for this feature.',
    });
  } catch (error: any) {
    console.error('Retranscribe note error:', error);

    res.status(500).json({
      success: false,
      message: 'Error re-transcribing note',
      error: error.message,
    });
  }
};