import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import storageService from '../services/storage.service';
import File from '../models/File';
import { v4 as uuidv4 } from 'uuid';
import { successResponse, errorResponse } from '../utils/response';

class UploadController {
  /**
   * Upload a file
   */
  async uploadFile(req: AuthRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user._id;
      const file = req.file;

      // Generate unique filename with validation
      const fileNameParts = file.originalname.split('.');
      const fileExtension = fileNameParts.length > 1 ? fileNameParts.pop() : null;

      if (!fileExtension) {
        return res.status(400).json({
          error: 'File must have a valid extension'
        });
      }

      const uniqueFileName = `${userId}/${uuidv4()}.${fileExtension}`;

      console.log(`📤 Uploading file: ${file.originalname} (${file.size} bytes)`);

      // Upload to MinIO
      const fileKey = await storageService.uploadFile(
        file.buffer,
        uniqueFileName,
        file.mimetype
      );

      // Determine file type
      const fileType = this.getFileType(file.mimetype);

      // Save metadata to database
      const fileDoc = await File.create({
        userId,
        filename: uniqueFileName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        fileKey,
        fileType,
        uploadStatus: 'completed',
        metadata: {
          duration: undefined,
          width: undefined,
          height: undefined,
          pages: undefined,
        },
      });

      console.log(`✅ File uploaded successfully: ${fileKey}`);

      res.json(successResponse({
        fileId: fileDoc._id,
        fileKey,
        fileName: uniqueFileName,
        originalName: file.originalname,
        size: file.size,
        fileType,
        mimeType: file.mimetype,
      }, 'File uploaded successfully'));
    } catch (error: any) {
      console.error('❌ Upload error:', error);
      res.status(500).json(errorResponse('Upload failed'));
    }
  }

  /**
   * Get file info
   */
  async getFile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const { fileId } = req.params;
      const userId = req.user._id;

      const file = await File.findOne({ _id: fileId, userId });

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      res.json(successResponse(file, 'File retrieved'));
    } catch (error: any) {
      console.error('❌ Error getting file:', error);
      res.status(500).json(errorResponse('Failed to get file'));
    }
  }

  /**
   * Get file download URL
   */
  async getFileUrl(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const { fileId } = req.params;
      const userId = req.user._id;

      const file = await File.findOne({ _id: fileId, userId });

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Generate presigned URL (valid for 1 hour)
      const url = await storageService.getFileUrl(file.fileKey, 3600);

      res.json(successResponse({
        url,
        expiresIn: 3600,
        fileName: file.originalName,
      }, 'File URL generated'));
    } catch (error: any) {
      console.error('❌ Error generating file URL:', error);
      res.status(500).json(errorResponse('Failed to generate file URL'));
    }
  }

  /**
   * Delete file
   */
  async deleteFile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const { fileId } = req.params;
      const userId = req.user._id;

      const file = await File.findOne({ _id: fileId, userId });

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Delete from storage
      await storageService.deleteFile(file.fileKey);

      // Delete from database
      await file.deleteOne();

      console.log(`✅ File deleted: ${file.fileKey}`);

      res.json(successResponse(null, 'File deleted successfully'));
    } catch (error: any) {
      console.error('❌ Error deleting file:', error);
      res.status(500).json(errorResponse('Failed to delete file'));
    }
  }

  /**
   * List user files
   */
  async listFiles(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const userId = req.user._id;
      const { fileType, page = 1, limit = 20 } = req.query;

      // Validate pagination
      const pageNum = Math.max(1, Number(page));
      const limitNum = Math.min(100, Math.max(1, Number(limit)));
      const skip = (pageNum - 1) * limitNum;

      const query: any = { userId };

      if (fileType) {
        query.fileType = fileType;
      }

      const [files, total] = await Promise.all([
        File.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        File.countDocuments(query),
      ]);

      res.json(successResponse({
        files,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      }, 'Files retrieved'));
    } catch (error: any) {
      console.error('❌ Error listing files:', error);
      res.status(500).json(errorResponse('Failed to list files'));
    }
  }

  /**
   * Upload image and perform OCR
   */
  async uploadImageWithOCR(req: AuthRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      console.log('🔐 Upload request - User:', req.user ? { id: req.user._id, email: req.user.email } : 'No user');

      if (!req.user || !req.user._id) {
        console.error('❌ No user in request');
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user._id;
      const file = req.file;

      console.log('👤 User ID:', userId);

      // Verify it's an image
      if (!file.mimetype.startsWith('image/')) {
        return res.status(400).json({ error: 'File must be an image' });
      }

      // Generate unique filename
      const fileExtension = file.originalname.split('.').pop();
      const uniqueFileName = `${userId}/${uuidv4()}.${fileExtension}`;

      console.log(`📤 Uploading image with OCR: ${file.originalname} (${file.size} bytes)`);

      // Upload to MinIO
      const fileKey = await storageService.uploadFile(
        file.buffer,
        uniqueFileName,
        file.mimetype
      );

      // Save metadata to database
      const fileDoc = await File.create({
        userId,
        filename: uniqueFileName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        fileKey,
        fileType: 'image',
        uploadStatus: 'processing',
        metadata: {
          duration: undefined,
          width: undefined,
          height: undefined,
          pages: undefined,
        },
      });

      console.log(`✅ File uploaded: ${fileKey}, extracting text with OCR...`);

      // ===== PERFORM OCR SYNCHRONOUSLY (AWAIT) =====
      try {
        const ocrService = (await import('../services/ocr.service')).default;

        // Extract text from image synchronously
        const ocrResult = await ocrService.extractTextFromImage(fileKey);

        // Update file document with OCR results
        fileDoc.uploadStatus = 'completed';
        fileDoc.metadata = {
          ...fileDoc.metadata,
          ocrText: ocrResult.text,
          ocrConfidence: ocrResult.confidence,
        };
        await fileDoc.save();

        console.log(`✅ OCR completed with ${ocrResult.confidence}% confidence`);

        // Return response with OCR results
        res.json(successResponse({
          fileId: fileDoc._id,
          fileKey,
          fileName: uniqueFileName,
          originalName: file.originalname,
          size: file.size,
          fileType: 'image',
          mimeType: file.mimetype,
          ocrResult: {
            text: ocrResult.text,
            confidence: ocrResult.confidence,
          },
          status: 'completed',
          message: 'Image uploaded and OCR extracted successfully',
        }, 'OCR extraction completed'));

      } catch (ocrError: any) {
        console.error('❌ OCR extraction error:', ocrError);

        // Mark as failed
        fileDoc.uploadStatus = 'failed';
        fileDoc.metadata = {
          ...fileDoc.metadata,
          extractionError: ocrError.message,
        };
        await fileDoc.save();

        throw ocrError;
      }
      // ===== END OCR =====
    } catch (error: any) {
      console.error('❌ Upload error:', error);
      res.status(500).json(errorResponse('Upload failed'));
    }
  }

  /**
   * Get image OCR extraction status
   */
  async getImageOCRStatus(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { fileId } = req.params;
      const userId = req.user._id;

      const fileDoc = await File.findOne({ _id: fileId, userId });

      if (!fileDoc) {
        return res.status(404).json({ error: 'File not found' });
      }

      res.json(successResponse({
        fileId: fileDoc._id,
        status: fileDoc.uploadStatus,
        ocrConfidence: fileDoc.metadata?.ocrConfidence,
        extractedTextPreview: fileDoc.metadata?.ocrText ? fileDoc.metadata.ocrText.substring(0, 200) + '...' : null,
        error: fileDoc.metadata?.extractionError,
      }, 'OCR status retrieved'));

    } catch (error: any) {
      console.error('❌ Error getting OCR status:', error);
      res.status(500).json(errorResponse('Failed to get OCR status'));
    }
  }


  /**
   * Upload PDF and extract text
   */
  async uploadPDFWithExtraction(req: AuthRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      console.log('🔐 Upload PDF request - User:', req.user ? { id: req.user._id, email: req.user.email } : 'No user');

      if (!req.user || !req.user._id) {
        console.error('❌ No user in request');
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user._id;
      const file = req.file;

      console.log('👤 User ID:', userId);

      // Verify it's a PDF file
      if (file.mimetype !== 'application/pdf') {
        return res.status(400).json({ error: 'File must be a PDF' });
      }

      // Generate unique filename
      const fileExtension = file.originalname.split('.').pop();
      const uniqueFileName = `${userId}/${uuidv4()}.${fileExtension}`;

      console.log(`📤 Uploading PDF with text extraction: ${file.originalname} (${file.size} bytes)`);

      // Upload to MinIO
      const fileKey = await storageService.uploadFile(
        file.buffer,
        uniqueFileName,
        file.mimetype
      );

      // Save metadata to database
      const fileDoc = await File.create({
        userId,
        filename: uniqueFileName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        fileKey,
        fileType: 'pdf',
        uploadStatus: 'processing',
        metadata: {
          duration: undefined,
          width: undefined,
          height: undefined,
          pages: undefined,
          pdfType: undefined,
          textExtractability: undefined,
        },
      });

      console.log(`✅ PDF uploaded: ${fileKey}, queuing text extraction...`);

      // Return immediately - extraction will happen in background
      res.json(successResponse({
        fileId: fileDoc._id,
        fileKey,
        fileName: uniqueFileName,
        originalName: file.originalname,
        size: file.size,
        fileType: 'pdf',
        mimeType: file.mimetype,
        status: 'processing',
        message: 'PDF uploaded. Text extraction in progress...',
      }, 'PDF uploaded successfully'));

      // ===== EXTRACT TEXT IN BACKGROUND (NO AWAIT) =====
      // This prevents the request from blocking while extraction happens
      (async () => {
        try {
          const pdfService = (await import('../services/pdf.service')).default;

          // Extract with progress tracking
          const extractionResult = await pdfService.extractText(fileKey, (progress) => {
            // Log progress (you could emit this via WebSocket for real-time UI updates)
            console.log(`📊 PDF extraction progress: ${progress}%`);
          });

          // Detect if PDF is scanned
          const isScanned = extractionResult.pdfType === 'scanned';

          // Update file document with extraction results
          fileDoc.uploadStatus = 'completed';
          fileDoc.metadata = {
            ...fileDoc.metadata,
            pages: extractionResult.pages,
            ocrText: extractionResult.text,
            ocrConfidence: 100,
            title: extractionResult.metadata.title,
            author: extractionResult.metadata.author,
            pdfType: extractionResult.pdfType,
            textExtractability: extractionResult.textExtractability,
            isScanned: isScanned,
          };
          await fileDoc.save();

          console.log(`✅ PDF text extraction completed: ${extractionResult.pages} pages (${extractionResult.pdfType})`);
          console.log(`📝 Extracted text length: ${extractionResult.text.length} characters`);

          if (isScanned && extractionResult.text.length === 0) {
            console.warn('⚠️ PDF is scanned - text extraction returned 0 chars. User should use OCR or provide text-based PDF.');
          }

        } catch (backgroundError: any) {
          console.error('❌ Background PDF extraction failed:', backgroundError);

          // Update file status to failed
          fileDoc.uploadStatus = 'failed';
          fileDoc.metadata = {
            ...fileDoc.metadata,
            extractionError: backgroundError.message,
          };
          await fileDoc.save();
        }
      })();
      // ===== END BACKGROUND EXTRACTION =====
    } catch (error: any) {
      console.error('❌ Upload error:', error);
      res.status(500).json(errorResponse('Upload failed'));
    }
  }

  /**
   * NEW: Get PDF extraction status and progress
   */
  async getPDFExtractionStatus(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { fileId } = req.params;
      const userId = req.user._id;

      const fileDoc = await File.findOne({ _id: fileId, userId });

      if (!fileDoc) {
        return res.status(404).json({ error: 'File not found' });
      }

      res.json(successResponse({
        fileId: fileDoc._id,
        status: fileDoc.uploadStatus,
        pdfType: fileDoc.metadata?.pdfType,
        textExtractability: fileDoc.metadata?.textExtractability,
        isScanned: fileDoc.metadata?.isScanned,
        extractedTextPreview: fileDoc.metadata?.ocrText ? fileDoc.metadata.ocrText.substring(0, 200) + '...' : null,
        pageCount: fileDoc.metadata?.pages,
        error: fileDoc.metadata?.extractionError,
      }, 'PDF status retrieved'));

    } catch (error: any) {
      console.error('❌ Error getting PDF status:', error);
      res.status(500).json(errorResponse('Failed to get PDF status'));
    }
  }

  /**
   * Upload audio and perform transcription
   */
  async uploadAudioWithTranscription(req: AuthRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      console.log('🔐 Upload audio request - User:', req.user ? { id: req.user._id, email: req.user.email } : 'No user');

      if (!req.user || !req.user._id) {
        console.error('❌ No user in request');
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user._id;
      const file = req.file;

      console.log('👤 User ID:', userId);

      // Verify it's an audio file
      if (!file.mimetype.startsWith('audio/')) {
        return res.status(400).json({ error: 'File must be an audio file' });
      }

      // Generate unique filename
      const fileExtension = file.originalname.split('.').pop();
      const uniqueFileName = `${userId}/${uuidv4()}.${fileExtension}`;

      console.log(`📤 Uploading audio with transcription: ${file.originalname} (${file.size} bytes)`);

      // Upload to MinIO
      const fileKey = await storageService.uploadFile(
        file.buffer,
        uniqueFileName,
        file.mimetype
      );

      // Save metadata to database
      const fileDoc = await File.create({
        userId,
        filename: uniqueFileName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        fileKey,
        fileType: 'audio',
        uploadStatus: 'processing',
        metadata: {
          duration: undefined,
          width: undefined,
          height: undefined,
          pages: undefined,
        },
      });

      console.log(`✅ Audio uploaded: ${fileKey}, queuing transcription...`);

      // Return immediately - transcription will happen in background
      res.json(successResponse({
        fileId: fileDoc._id,
        fileKey,
        fileName: uniqueFileName,
        originalName: file.originalname,
        size: file.size,
        fileType: 'audio',
        mimeType: file.mimetype,
        status: 'processing',
        message: 'Audio uploaded. Transcription in progress...',
      }, 'Audio uploaded successfully'));

      // ===== PERFORM TRANSCRIPTION IN BACKGROUND (NO AWAIT) =====
      (async () => {
        try {
          const transcriptionService = (await import('../services/transcription.service')).default;

          // Check if transcription service is available
          const isAvailable = await transcriptionService.isAvailable();
          if (!isAvailable) {
            fileDoc.uploadStatus = 'failed';
            fileDoc.metadata = {
              ...fileDoc.metadata,
              extractionError: 'Transcription service is not configured. Please contact support.',
            };
            await fileDoc.save();
            return;
          }

          // Transcribe audio
          const transcriptionResult = await transcriptionService.transcribeWithAutoDetect(fileKey);

          // Update file document with transcription results
          fileDoc.uploadStatus = 'completed';
          fileDoc.metadata = {
            ...fileDoc.metadata,
            // Store transcription in ocrText for consistency
            ocrText: transcriptionResult.text,
            ocrConfidence: transcriptionResult.language ? 100 : 0,
            language: transcriptionResult.language,
            duration: transcriptionResult.duration,
          };
          await fileDoc.save();

          console.log(`✅ Transcription completed`);
          console.log(`📝 Transcribed text length: ${transcriptionResult.text.length} characters`);

        } catch (transcriptionError: any) {
          console.error('❌ Background transcription error:', transcriptionError);

          // Mark as failed
          fileDoc.uploadStatus = 'failed';
          fileDoc.metadata = {
            ...fileDoc.metadata,
            extractionError: transcriptionError.message,
          };
          await fileDoc.save();
        }
      })();
      // ===== END BACKGROUND TRANSCRIPTION =====
    } catch (error: any) {
      console.error('❌ Upload error:', error);
      res.status(500).json(errorResponse('Upload failed'));
    }
  }

  /**
   * Get audio transcription status
   */
  async getAudioTranscriptionStatus(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { fileId } = req.params;
      const userId = req.user._id;

      const fileDoc = await File.findOne({ _id: fileId, userId });

      if (!fileDoc) {
        return res.status(404).json({ error: 'File not found' });
      }

      res.json(successResponse({
        fileId: fileDoc._id,
        status: fileDoc.uploadStatus,
        language: fileDoc.metadata?.language,
        duration: fileDoc.metadata?.duration,
        extractedTextPreview: fileDoc.metadata?.ocrText ? fileDoc.metadata.ocrText.substring(0, 200) + '...' : null,
        error: fileDoc.metadata?.extractionError,
      }, 'Transcription status retrieved'));

    } catch (error: any) {
      console.error('❌ Error getting transcription status:', error);
      res.status(500).json(errorResponse('Failed to get transcription status'));
    }
  }

  /**
   * Extract YouTube transcript
   */
  async extractYouTubeTranscript(req: AuthRequest, res: Response) {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ error: 'YouTube URL is required' });
      }

      console.log('🔐 YouTube transcript request - User:', req.user ? { id: req.user._id, email: req.user.email } : 'No user');

      if (!req.user || !req.user._id) {
        console.error('❌ No user in request');
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user._id;

      console.log('👤 User ID:', userId);
      console.log(`📺 Fetching YouTube transcript for URL: ${url}`);

      // Import YouTube service
      const youtubeService = (await import('../services/youtube.service')).default;

      // Validate URL
      if (!youtubeService.isValidYouTubeUrl(url)) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
      }

      try {
        const transcriptResult = await youtubeService.getTranscript(url);

        console.log(`✅ YouTube transcript fetched successfully`);
        console.log(`📝 Transcript length: ${transcriptResult.transcript.length} characters`);

        // Optionally fetch video info
        let videoInfo = null;
        try {
          videoInfo = await youtubeService.getVideoInfo(url);
        } catch (error) {
          console.warn('⚠️ Could not fetch video info, continuing without it');
        }

        res.json(successResponse({
          videoId: transcriptResult.videoId,
          transcript: transcriptResult.transcript,
          duration: transcriptResult.duration,
          segments: transcriptResult.segments,
          videoInfo,
        }, 'YouTube transcript fetched successfully'));
      } catch (transcriptError: any) {
        console.error('❌ YouTube transcript error:', transcriptError);

        res.status(400).json(errorResponse('YouTube transcript extraction failed'));
      }
    } catch (error: any) {
      console.error('❌ YouTube transcript request error:', error);
      res.status(500).json(errorResponse('Request failed'));
    }
  }

  /**
   * Get file type from MIME type
   */
  private getFileType(mimeType: string): 'audio' | 'video' | 'pdf' | 'image' | 'document' {
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.startsWith('image/')) return 'image';
    return 'document';
  }
}

export default new UploadController();
