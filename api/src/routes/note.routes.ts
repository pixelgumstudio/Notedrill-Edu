import { Router } from 'express';
import * as NoteController from '../controllers/note.controller';
import { authenticate } from '../middleware/auth';
import upload, { validateFileSize } from '../middleware/uploadMiddleware';

const router = Router();

/**
 * @route   GET /api/v1/notes/shared/:shareableLink
 * @desc    Get a shared note by its public link.
 * @access  Public
 */
router.get('/shared/:shareableLink', NoteController.getSharedNote);

/**
 * @route   POST /api/v1/notes/shared/:shareableLink/save
 * @desc    Clone a shared note into the current user's library.
 * @access  Private
 */
router.post('/shared/:shareableLink/save', authenticate, NoteController.saveSharedNote);

// All subsequent routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/notes/generate
 * @desc    Generate a note from file upload or text content.
 * @access  Private
 */
router.post('/generate', upload.single('file'), validateFileSize, NoteController.generateNote);

/**
 * @route   GET /api/v1/notes/search
 * @desc    Search notes with full-text search and filters.
 * @access  Private
 */
router.get('/search', NoteController.searchNotes);

/**
 * @route   GET /api/v1/notes/jobs/:jobId
 * @desc    Poll the status of a background note-generation job.
 * @access  Private
 */
router.get('/jobs/:jobId', NoteController.getJobStatus);

/**
 * @route   POST /api/v1/notes/:noteId/generate-more
 * @desc    Append more AI-generated questions or flashcards to an existing set.
 * @access  Private
 */
router.post('/:noteId/generate-more', NoteController.generateMore);

/**
 * @route   POST /api/v1/notes
 * @desc    Create a new note.
 * @access  Private
 */
router.post('/', NoteController.createNote);

/**
 * @route   GET /api/v1/notes
 * @desc    Get all user notes.
 * @access  Private
 */
router.get('/', NoteController.getNotes);

/**
 * @route   GET /api/v1/notes/:noteId
 * @desc    Get a single note by its ID.
 * @access  Private
 */
router.get('/:noteId', NoteController.getNoteById);

/**
 * @route   PUT /api/v1/notes/:noteId
 * @desc    Update a note.
 * @access  Private
 */
router.put('/:noteId', NoteController.updateNote);

/**
 * @route   PUT /api/v1/notes/:noteId/enhance
 * @desc    Enhance a note's content using AI.
 * @access  Private
 */
router.put('/:noteId/enhance', NoteController.enhanceNoteContent);

/**
 * @route   PUT /api/v1/notes/:noteId/translate
 * @desc    Translate a note to a target language.
 * @access  Private
 */
router.put('/:noteId/translate', NoteController.translateNote);

/**
 * @route   PUT /api/v1/notes/:noteId/retranscribe
 * @desc    Re-transcribe an audio note.
 * @access  Private
 */
router.put('/:noteId/retranscribe', NoteController.retranscribeNote);

/**
 * @route   POST /api/v1/notes/:noteId/move
 * @desc    Move a note to a different folder.
 * @access  Private
 */
router.post('/:noteId/move', NoteController.moveToFolder);

/**
 * @route   DELETE /api/v1/notes/:noteId
 * @desc    Delete a note.
 * @access  Private
 */
router.delete('/:noteId', NoteController.deleteNote);

/**
 * @route   POST /api/v1/notes/:noteId/share
 * @desc    Toggle the sharing status of a note.
 * @access  Private
 */
router.post('/:noteId/share', NoteController.toggleNoteSharing);

/**
 * @route   POST /api/v1/notes/:noteId/export
 * @desc    Export a note in various formats.
 * @access  Private
 */
router.post('/:noteId/export', NoteController.exportNote);

export default router;

