import mongoose, { Document, Schema } from 'mongoose';

interface IFlashcard {
  front: string;
  back: string;
  color?: string;
  mastered: boolean;
  reviewCount: number;
  lastReviewedAt?: Date;
}

export interface IFlashcardSet extends Document {
  userId: mongoose.Types.ObjectId;
  noteId: mongoose.Types.ObjectId;
  orgId?: mongoose.Types.ObjectId;
  title: string;
  cards: IFlashcard[];
  totalCards: number;
  masteredCards: number;
  createdAt: Date;
  updatedAt: Date;
}

const FlashcardSchema = new Schema<IFlashcard>({
  front: {
    type: String,
    required: true,
  },
  back: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    default: '#007AFF',
  },
  mastered: {
    type: Boolean,
    default: false,
  },
  reviewCount: {
    type: Number,
    default: 0,
  },
  lastReviewedAt: {
    type: Date,
  },
}, { _id: true });

const FlashcardSetSchema = new Schema<IFlashcardSet>(
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
    cards: {
      type: [FlashcardSchema],
      required: true,
    },
    totalCards: {
      type: Number,
      required: true,
    },
    masteredCards: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
FlashcardSetSchema.index({ userId: 1, createdAt: -1 });
FlashcardSetSchema.index({ userId: 1, noteId: 1 });

export default mongoose.model<IFlashcardSet>('FlashcardSet', FlashcardSetSchema);
