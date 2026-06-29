// api/src/routes/upload.routes.ts

import { Router } from 'express';
import uploadController from '../controllers/upload.controller';
import { authenticate } from '../middleware/auth';
import upload, { uploadSingle } from '../middleware/uploadMiddleware';


const router = Router();



// Upload file
router.post('/', authenticate, upload.single('file'), uploadController.uploadFile);

// Upload image with OCR
router.post('/image-ocr', authenticate, upload.single('file'), uploadController.uploadImageWithOCR);

// Get image OCR status (polling endpoint)
router.get('/image-ocr/:fileId/status', authenticate, uploadController.getImageOCRStatus);

// Upload audio with transcription — uploadSingle includes validateFileSize for plan-based limits
router.post('/audio-transcribe', authenticate, ...uploadSingle('file'), uploadController.uploadAudioWithTranscription);

// Get audio transcription status (polling endpoint)
router.get('/audio/:fileId/status', authenticate, uploadController.getAudioTranscriptionStatus);

// Upload PDF with text extraction
router.post('/pdf-extract', authenticate, upload.single('file'), uploadController.uploadPDFWithExtraction);

// Get PDF extraction status (polling endpoint)
router.get('/pdf/:fileId/status', authenticate, uploadController.getPDFExtractionStatus);

// Extract YouTube transcript (no file upload needed)
router.post('/youtube-transcript', authenticate, uploadController.extractYouTubeTranscript);

// Get file info
router.get('/:fileId', authenticate, uploadController.getFile);

// Get file download URL
router.get('/:fileId/url', authenticate, uploadController.getFileUrl);

// Delete file
router.delete('/:fileId', authenticate, uploadController.deleteFile);

// List files
router.get('/', authenticate, uploadController.listFiles);

export default router;
