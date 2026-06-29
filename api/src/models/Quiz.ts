import mongoose, { Document, Schema } from 'mongoose';

interface IQuizQuestion {
  questionText: string;
  questionType: 'multiple-choice' | 'true-false' | 'fill-blank';
  options: string[];
  correctAnswer: number | string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface IQuiz extends Document {
  userId: mongoose.Types.ObjectId;
  noteId: mongoose.Types.ObjectId;
  orgId?: mongoose.Types.ObjectId;
  title: string;
  questions: IQuizQuestion[];
  totalQuestions: number;
  createdAt: Date;
  updatedAt: Date;
}

const QuizQuestionSchema = new Schema<IQuizQuestion>({
  questionText: {
    type: String,
    required: true,
  },
  questionType: {
    type: String,
    enum: ['multiple-choice', 'true-false', 'fill-blank'],
    default: 'multiple-choice',
  },
  options: {
    type: [String],
    required: true,
  },
  correctAnswer: {
    type: Schema.Types.Mixed,
    required: true,
  },
  explanation: {
    type: String,
    required: true,
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },
}, { _id: false });

const QuizSchema = new Schema<IQuiz>(
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
    questions: {
      type: [QuizQuestionSchema],
      required: true,
    },
    totalQuestions: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
QuizSchema.index({ userId: 1, createdAt: -1 });
QuizSchema.index({ userId: 1, noteId: 1 });

export default mongoose.model<IQuiz>('Quiz', QuizSchema);
