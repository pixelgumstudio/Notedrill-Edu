// api/src/middleware/uploadMiddleware.ts

import multer from 'multer';
import { Request } from 'express';

// File size limits by category (in bytes)
const FILE_SIZE_LIMITS = {
  IMAGE: 10 * 1024 * 1024, // 10MB
  AUDIO: 100 * 1024 * 1024, // 100MB — outer multer cap; real enforcement is plan-based below
  VIDEO: 500 * 1024 * 1024, // 500MB
  DOCUMENT: 50 * 1024 * 1024, // 50MB
};

// Plan-based audio limits — enforced after multer buffers the file
const AUDIO_SIZE_LIMITS = {
  FREE: 100 * 1024 * 1024, // 100MB — large files are chunked by ffmpeg before Whisper
  PRO:  100 * 1024 * 1024, // 100MB
};

// Allowed MIME types by category
const ALLOWED_MIME_TYPES = {
  IMAGE: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg+xml',
    'image/heic',
    'image/heif',
  ],
  AUDIO: [
    'audio/mpeg',
    'audio/wav',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/webm',
    'audio/ogg',
    'audio/flac',
    'audio/aac',
  ],
  VIDEO: [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'video/avi',
    'video/mpeg',
  ],
  DOCUMENT: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
};

// Flatten all allowed types
const ALL_ALLOWED_TYPES = [
  ...ALLOWED_MIME_TYPES.IMAGE,
  ...ALLOWED_MIME_TYPES.AUDIO,
  ...ALLOWED_MIME_TYPES.VIDEO,
  ...ALLOWED_MIME_TYPES.DOCUMENT,
];

/**
 * Get file category from MIME type
 */
function getFileCategory(mimetype: string): keyof typeof FILE_SIZE_LIMITS | null {
  if (ALLOWED_MIME_TYPES.IMAGE.includes(mimetype)) return 'IMAGE';
  if (ALLOWED_MIME_TYPES.AUDIO.includes(mimetype)) return 'AUDIO';
  if (ALLOWED_MIME_TYPES.VIDEO.includes(mimetype)) return 'VIDEO';
  if (ALLOWED_MIME_TYPES.DOCUMENT.includes(mimetype)) return 'DOCUMENT';
  return null;
}

/**
 * Get human-readable file size
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Validate file extension matches MIME type
 */
function validateFileExtension(filename: string, mimetype: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return false;

  const extensionMimeMap: { [key: string]: string[] } = {
    jpg: ['image/jpeg', 'image/jpg'],
    jpeg: ['image/jpeg', 'image/jpg'],
    png: ['image/png'],
    gif: ['image/gif'],
    webp: ['image/webp'],
    bmp: ['image/bmp'],
    svg: ['image/svg+xml'],
    heic: ['image/heic'],
    heif: ['image/heif'],
    mp3: ['audio/mpeg'],
    wav: ['audio/wav'],
    m4a: ['audio/m4a', 'audio/x-m4a', 'audio/mp4'],
    ogg: ['audio/ogg'],
    flac: ['audio/flac'],
    mp4: ['video/mp4', 'audio/mp4'],
    webm: ['video/webm', 'audio/webm'],
    mov: ['video/quicktime'],
    avi: ['video/x-msvideo', 'video/avi'],
    pdf: ['application/pdf'],
    doc: ['application/msword'],
    docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    txt: ['text/plain'],
  };

  const allowedMimes = extensionMimeMap[ext];
  return allowedMimes ? allowedMimes.includes(mimetype) : false;
}

// Configure multer with enhanced validation
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: FILE_SIZE_LIMITS.VIDEO, // Maximum possible size
    files: 1, // Only one file per request
    fieldSize: 10 * 1024 * 1024, // 10MB max field size
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    console.log(`📤 File upload attempt: ${file.originalname} (${file.mimetype})`);

    // Check if MIME type is allowed
    if (!ALL_ALLOWED_TYPES.includes(file.mimetype)) {
      const error = new Error(
        `File type '${file.mimetype}' is not supported. Allowed types: images, audio, video, PDFs.`
      );
      console.error(`❌ Unsupported file type: ${file.mimetype}`);
      return cb(error);
    }

    // Validate file extension matches MIME type (prevent spoofing)
    if (!validateFileExtension(file.originalname, file.mimetype)) {
      const error = new Error(
        `File extension does not match MIME type. Possible file spoofing detected.`
      );
      console.error(`❌ Extension/MIME mismatch: ${file.originalname} vs ${file.mimetype}`);
      return cb(error);
    }

    // Get file category for size validation
    const category = getFileCategory(file.mimetype);
    if (!category) {
      const error = new Error(`Unable to determine file category for ${file.mimetype}`);
      console.error(`❌ Unknown category: ${file.mimetype}`);
      return cb(error);
    }

    // Store category and size limit in request for later validation
    (req as any).fileCategory = category;
    (req as any).fileSizeLimit = FILE_SIZE_LIMITS[category];

    console.log(`✅ File accepted: ${file.originalname} (Category: ${category})`);
    cb(null, true);
  },
});

/**
 * Middleware to validate file size after upload.
 * For AUDIO files the limit is plan-based (FREE = 15 MB, PRO = 100 MB).
 * All other categories use the static limits in FILE_SIZE_LIMITS.
 * Must run after the `authenticate` middleware so req.user is populated.
 */
export const validateFileSize = (req: Request, res: any, next: any) => {
  if (!req.file) {
    return next();
  }

  const category = (req as any).fileCategory as string;
  const fileSize = req.file.size;

  if (category === 'AUDIO') {
    const user = (req as any).user;
    const isPro = user?.subscription === 'PRO';
    const limit = isPro ? AUDIO_SIZE_LIMITS.PRO : AUDIO_SIZE_LIMITS.FREE;

    if (fileSize > limit) {
      if (!isPro) {
        console.error(
          `❌ Audio too large for FREE user: ${formatFileSize(fileSize)} > ${formatFileSize(AUDIO_SIZE_LIMITS.FREE)}`
        );
        return res.status(413).json({
          error: `File exceeds ${formatFileSize(AUDIO_SIZE_LIMITS.FREE)} limit.`,
          code: 'AUDIO_FREE_LIMIT_EXCEEDED',
          limitBytes: AUDIO_SIZE_LIMITS.FREE,
          sizeBytes: fileSize,
        });
      }

      console.error(
        `❌ Audio too large for PRO user: ${formatFileSize(fileSize)} > ${formatFileSize(AUDIO_SIZE_LIMITS.PRO)}`
      );
      const error: any = new Error(
        `File size ${formatFileSize(fileSize)} exceeds the ${formatFileSize(AUDIO_SIZE_LIMITS.PRO)} PRO limit for audio files.`
      );
      error.statusCode = 413;
      return next(error);
    }

    console.log(
      `✅ Audio size validated: ${formatFileSize(fileSize)} (${isPro ? 'PRO' : 'FREE'} plan, limit: ${formatFileSize(limit)})`
    );
    return next();
  }

  // All other file categories use the static per-category limit
  const sizeLimit = (req as any).fileSizeLimit as number;
  if (fileSize > sizeLimit) {
    const error: any = new Error(
      `File size ${formatFileSize(fileSize)} exceeds the ${formatFileSize(sizeLimit)} limit for ${category} files.`
    );
    error.statusCode = 413;
    console.error(
      `❌ File too large: ${req.file.originalname} (${formatFileSize(fileSize)} > ${formatFileSize(sizeLimit)})`
    );
    return next(error);
  }

  console.log(`✅ File size validated: ${formatFileSize(fileSize)} (${category})`);
  next();
};

// Export individual upload configurations
export const uploadSingle = (fieldName: string = 'file') => [
  upload.single(fieldName),
  validateFileSize,
];

export const uploadMultiple = (fieldName: string = 'files', maxCount: number = 5) => [
  upload.array(fieldName, maxCount),
  validateFileSize,
];

export default upload;