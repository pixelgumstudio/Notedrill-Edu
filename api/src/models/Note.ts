import mongoose, { Document, Schema } from 'mongoose';

export interface INote extends Document {
  userId: mongoose.Types.ObjectId;
  orgId?: mongoose.Types.ObjectId;
  title: string;
  content: string;
  summary: string;
  extractedContent?: string;
  sourceType: 'audio' | 'video' | 'text' | 'pdf' | 'image' | 'youtube';
  sourceFileUrl?: string;
  sourceFileName?: string;
  transcriptText?: string;
  transcriptFileUrl?: string;
  folderId?: mongoose.Types.ObjectId;
  tags: string[];
  metadata: {
    duration?: number;
    fileSize?: number;
    originalFilename?: string;
    youtubeVideoId?: string;
    youtubeTitle?: string;
    youtubeThumbnail?: string;
  };
  processingStatus: 'pending' | 'audio_extraction' | 'processing_transcription' | 'transcribing' | 'generating' | 'completed' | 'failed';
  processingProgress: number;
  error?: string;
  deletedAt?: Date | null;
  isShared: boolean;
  shareableLink?: string;
  sharedAt?: Date | null;
  studyLanguage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const NoteSchema = new Schema<INote>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Org',
      sparse: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      default: '',
    },
    summary: {
      type: String,
      default: '',
    },
    extractedContent: {
      type: String,
      default: '', // Raw extracted content used for RAG (before AI enhancement)
    },
    sourceType: {
      type: String,
      enum: ['audio', 'video', 'text', 'pdf', 'image', 'youtube'],
      required: true,
    },
    sourceFileUrl: {
      type: String,
    },
    sourceFileName: {
      type: String,
    },
    transcriptText: {
      type: String,
    },
    transcriptFileUrl: {
      type: String,
    },
    folderId: {
      type: Schema.Types.ObjectId,
      ref: 'Folder',
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    metadata: {
      duration: Number,
      fileSize: Number,
      originalFilename: String,
      youtubeVideoId: String,
      youtubeTitle: String,
      youtubeThumbnail: String,
    },
    processingStatus: {
      type: String,
      enum: ['pending', 'audio_extraction', 'processing_transcription', 'transcribing', 'generating', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    processingProgress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    error: {
      type: String,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    isShared: {
      type: Boolean,
      default: false,
    },
    shareableLink: {
      type: String,
      unique: true,
      sparse: true,
    },
    sharedAt: {
      type: Date,
      default: null,
    },
    studyLanguage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
NoteSchema.index({ userId: 1, createdAt: -1 });
NoteSchema.index({ userId: 1, folderId: 1 });
NoteSchema.index({ deletedAt: 1 }); // For soft delete queries
NoteSchema.index({ userId: 1, sourceType: 1 });
NoteSchema.index({ userId: 1, processingStatus: 1 });
NoteSchema.index({ shareableLink: 1 }); // For shared note lookups

// Text search index
NoteSchema.index({ title: 'text', content: 'text', transcriptText: 'text' });

export default mongoose.model<INote>('Note', NoteSchema);
