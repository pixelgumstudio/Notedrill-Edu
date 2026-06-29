import mongoose, { Document, Schema } from 'mongoose';

interface IChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface IChatSession extends Document {
  userId: mongoose.Types.ObjectId;
  noteId?: mongoose.Types.ObjectId;
  fileId?: mongoose.Types.ObjectId;
  folderId?: mongoose.Types.ObjectId;
  title: string;
  sourceType: 'note' | 'image' | 'document' | 'pdf';
  sourceContent?: string;
  messages: IChatMessage[];
  embeddingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  embeddingProgress: number;
  metadata: {
    chunksCount?: number;
    totalTokens?: number;
    modelUsed?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const ChatSessionSchema = new Schema<IChatSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    noteId: {
      type: Schema.Types.ObjectId,
      ref: 'Note',
      index: true,
    },
    fileId: {
      type: Schema.Types.ObjectId,
      ref: 'File',
      index: true,
    },
    folderId: {
      type: Schema.Types.ObjectId,
      ref: 'Folder',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    sourceType: {
      type: String,
      enum: ['note', 'image', 'document', 'pdf'],
      required: true,
    },
    sourceContent: {
      type: String,
    },
    messages: {
      type: [ChatMessageSchema],
      default: [],
    },
    embeddingStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    embeddingProgress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    metadata: {
      chunksCount: Number,
      totalTokens: Number,
      modelUsed: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ChatSessionSchema.index({ userId: 1, createdAt: -1 });
ChatSessionSchema.index({ userId: 1, sourceType: 1 });
ChatSessionSchema.index({ userId: 1, embeddingStatus: 1 });
ChatSessionSchema.index({ userId: 1, folderId: 1 });

export default mongoose.model<IChatSession>('ChatSession', ChatSessionSchema);
