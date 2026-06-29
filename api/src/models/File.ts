import mongoose, { Document, Schema } from 'mongoose';

export interface IFile extends Document {
  userId: mongoose.Types.ObjectId;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  fileKey: string;
  fileType: 'audio' | 'video' | 'pdf' | 'image' | 'document';
  uploadStatus: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  metadata: {
    duration?: number;
    width?: number;
    height?: number;
    pages?: number;
    ocrText?: string;
    ocrConfidence?: number;
    title?: string;
    author?: string;
    extractionError?: string;
    language?: string;
    pdfType?: 'pure_text' | 'scanned' | 'hybrid';
    isScanned?: boolean;
    textExtractability?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const FileSchema = new Schema<IFile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    fileKey: {
      type: String,
      required: true,
      unique: true,
    },
    fileType: {
      type: String,
      enum: ['audio', 'video', 'pdf', 'image', 'document'],
      required: true,
    },
    uploadStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    error: {
      type: String,
    },
    metadata: {
      duration: Number,
      width: Number,
      height: Number,
      pages: Number,
      ocrText: String,
      ocrConfidence: Number,
      title: String,
      author: String,
      extractionError: String,
      language: String,
      pdfType: String,
      isScanned: Boolean,
      textExtractability: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
FileSchema.index({ userId: 1, createdAt: -1 });
FileSchema.index({ userId: 1, fileType: 1 });
FileSchema.index({ fileKey: 1 });

export default mongoose.model<IFile>('File', FileSchema);
