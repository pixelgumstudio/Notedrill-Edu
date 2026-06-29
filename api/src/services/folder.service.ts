import Folder, { IFolder } from '../models/Folder';
import Note from '../models/Note';
import mongoose from 'mongoose';

/**
 * @description Create a new folder for a user.
 * @param {string} userId - The ID of the user.
 * @param {string} name - The name of the folder.
 * @param {string} [color] - The color of the folder.
 * @returns {Promise<IFolder>} - The newly created folder.
 */
export const createFolder = async (
  userId: string,
  name: string,
  color?: string,
  folderType: 'note' | 'chat' = 'note'
): Promise<IFolder> => {
  const folder = new Folder({ userId, name, color, folderType });
  await folder.save();
  return folder;
};

/**
 * @description Get all non-deleted folders for a user.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<IFolder[]>} - A list of folders.
 */
export const getFolders = async (userId: string, folderType?: 'note' | 'chat'): Promise<any[]> => {
  const userObjectId = new mongoose.Types.ObjectId(userId as string);
  const matchFilter: Record<string, any> = { userId: userObjectId, deletedAt: null };
  if (folderType) {
    matchFilter.folderType = folderType;
  }

  return Folder.aggregate([
    { $match: matchFilter },
    {
      $lookup: {
        from: 'notes',
        let: { folderId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$folderId', '$$folderId'] },
              deletedAt: null,
            },
          },
        ],
        as: 'notesList',
      },
    },
    { $addFields: { itemCount: { $size: '$notesList' } } },
    { $project: { notesList: 0 } },
    { $sort: { createdAt: -1 } },
  ]);
};

/**
 * @description Update a folder's name or color.
 * @param {string} userId - The ID of the user.
 * @param {string} folderId - The ID of the folder to update.
 * @param {object} updates - Object containing name and/or color to update.
 * @returns {Promise<IFolder>} - The updated folder.
 */
export const updateFolder = async (
  userId: string,
  folderId: string,
  updates: { name?: string; color?: string }
): Promise<IFolder> => {
  const folder = await Folder.findOne({
    _id: folderId,
    userId,
    deletedAt: null,
  });

  if (!folder) {
    throw new Error('Folder not found');
  }

  // Update fields if provided
  if (updates.name !== undefined) {
    folder.name = updates.name;
  }
  if (updates.color !== undefined) {
    folder.color = updates.color;
  }

  await folder.save();
  return folder;
};

/**
 * @description Soft delete a folder and move its notes to the root.
 * @param {string} userId - The ID of the user.
 * @param {string} folderId - The ID of the folder to delete.
 * @returns {Promise<{message: string}>} - A confirmation message.
 */
export const deleteFolder = async (
  userId: string,
  folderId: string
): Promise<{ message: string }> => {
  const folder = await Folder.findOne({
    _id: folderId,
    userId,
    deletedAt: null,
  });

  if (!folder) {
    throw new Error('Folder not found');
  }

  // Start a session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Move notes from this folder to the root (unset folderId)
    await Note.updateMany(
      { userId, folderId },
      { $unset: { folderId: '' } },
      { session }
    );

    // 2. Soft delete the folder
    folder.deletedAt = new Date();
    await folder.save({ session });

    await session.commitTransaction();
    session.endSession();

    return { message: 'Folder deleted and notes moved to root.' };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};
