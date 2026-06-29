import mongoose, { Document, Schema } from 'mongoose';

export interface IFolder extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  color: string;
  folderType: 'note' | 'chat';
  icon?: string;
  parentFolderId?: mongoose.Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const FolderSchema = new Schema<IFolder>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      required: true,
      default: '#007AFF',
    },
    folderType: {
      type: String,
      enum: ['note', 'chat'],
      default: 'note',
      required: true,
    },
    icon: {
      type: String,
    },
    parentFolderId: {
      type: Schema.Types.ObjectId,
      ref: 'Folder',
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
FolderSchema.index({ userId: 1, createdAt: -1 });
FolderSchema.index({ userId: 1, parentFolderId: 1 });
FolderSchema.index({ deletedAt: 1 }); // For soft delete queries

// Virtual for note count
FolderSchema.virtual('noteCount', {
  ref: 'Note',
  localField: '_id',
  foreignField: 'folderId',
  count: true,
});

export default mongoose.model<IFolder>('Folder', FolderSchema);
