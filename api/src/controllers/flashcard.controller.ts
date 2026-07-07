import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import FlashcardSet from '../models/FlashcardSet';
import Note from '../models/Note';
import { User } from '../models/User';
import flashcardGenerationService from '../services/flashcardGeneration.service';
import { checkQuota, incrementQuota, QuotaExceededError } from '../services/quota.service';
import { getNoteSourceText } from '../utils/noteSource';

class FlashcardController {
  /**
   * Generate flashcards from note
   */
  async generateFlashcards(req: AuthRequest, res: Response) {
    try {
      if (!req.user?._id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const userId = req.user._id;
      const orgId = req.user.orgId;
      const { noteId, cardCount = 20, difficulty = 'medium', focusTopics = [], targetLanguage } = req.body;

      try {
        checkQuota(req.user, 'flashcards');
      } catch (e) {
        if (e instanceof QuotaExceededError) {
          return res.status(402).json({ success: false, quotaExceeded: true, feature: e.feature, message: e.message });
        }
        throw e;
      }

      // Validate noteId
      if (!noteId) {
        return res.status(400).json({
          success: false,
          message: 'Note ID is required',
        });
      }

      // Validate card count
      if (cardCount < 1 || cardCount > 100) {
        return res.status(400).json({
          success: false,
          message: 'Card count must be between 1 and 100',
        });
      }

      // Validate difficulty
      if (!['easy', 'medium', 'hard'].includes(difficulty)) {
        return res.status(400).json({
          success: false,
          message: 'Difficulty must be easy, medium, or hard',
        });
      }

      // Validate note exists — org students can access notes uploaded by their org admin
      const noteQuery: any = { _id: noteId };
      if (orgId) {
        noteQuery.$or = [{ userId }, { orgId }];
      } else {
        noteQuery.userId = userId;
      }
      const note = await Note.findOne(noteQuery);

      if (!note) {
        return res.status(404).json({
          success: false,
          message: 'Note not found',
        });
      }

      // Prefer the raw extracted/transcribed source text over the AI summary
      // in note.content — richer, less lossy material to generate cards from.
      const sourceText = getNoteSourceText(note);
      if (sourceText.length < 100) {
        return res.status(400).json({
          success: false,
          message: 'Note content is too short to generate flashcards. Minimum 100 characters required.',
        });
      }

      console.log(`[${req.correlationId}] 🃏 Generating flashcards for note ${noteId}...`);

      // Resolve effective target language: note override → user preference → user UI language → English
      const effectiveLanguage = targetLanguage || note.studyLanguage || req.user.studyLanguage || req.user.preferredLanguage || 'en';

      // Generate flashcards
      const flashcards = await flashcardGenerationService.generateFlashcards(
        sourceText,
        note.title,
        {
          cardCount,
          difficulty,
          focusTopics,
          targetLanguage: effectiveLanguage,
        }
      );

      // Create flashcard set
      const flashcardSet = await FlashcardSet.create({
        userId,
        noteId,
        title: `${note.title} - Flashcards`,
        cards: flashcards.map(card => ({
          front: card.front,
          back: card.back,
          color: card.color,
          mastered: false,
          reviewCount: 0,
        })),
        totalCards: flashcards.length,
        masteredCards: 0,
      });
      incrementQuota(userId.toString(), 'flashcards');

      console.log(`[${req.correlationId}] ✅ Generated ${flashcards.length} flashcards`);

      return res.status(201).json({
        success: true,
        message: 'Flashcards generated successfully',
        data: flashcardSet,
      });
    } catch (error: any) {
      console.error(`[${req.correlationId}] ❌ Error generating flashcards:`, error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate flashcards',
        error: error.message,
      });
    }
  }

  /**
   * Get flashcard set
   */
  async getFlashcardSet(req: AuthRequest, res: Response) {
    try {
      if (!req.user?._id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const userId = req.user._id;
      const { setId } = req.params;

      const flashcardSet = await FlashcardSet.findOne({ _id: setId, userId })
        .populate('noteId', 'title');

      if (!flashcardSet) {
        return res.status(404).json({
          success: false,
          message: 'Flashcard set not found',
        });
      }

      return res.json({
        success: true,
        data: flashcardSet,
      });
    } catch (error: any) {
      console.error(`[${req.correlationId}] ❌ Error getting flashcard set:`, error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get flashcard set',
        error: error.message,
      });
    }
  }

  /**
   * List flashcard sets
   * GET /api/v1/flashcards[?noteId=...][&studentId=...  (org_admin only)]
   * Org admins may pass ?studentId= to read a student's flashcard sets.
   */
  async listFlashcardSets(req: AuthRequest, res: Response) {
    try {
      if (!req.user?._id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      // Org admin RBAC: allow reading another student's flashcard sets
      let targetUserId: string = req.user._id;
      const { noteId, studentId } = req.query;

      if (req.user.role === 'org_admin' && typeof studentId === 'string' && studentId) {
        if (!req.user.orgId) {
          return res.status(403).json({ success: false, message: 'Admin has no associated organisation.' });
        }
        const student = await User.findOne({
          _id: studentId,
          orgId: new mongoose.Types.ObjectId(req.user.orgId),
        }).lean();
        if (!student) {
          return res.status(403).json({ success: false, message: 'Student not found in your organisation.' });
        }
        targetUserId = studentId;
      }

      const query: any = { userId: targetUserId };
      if (noteId) {
        query.noteId = noteId;
      }

      const flashcardSets = await FlashcardSet.find(query)
        .sort({ createdAt: -1 })
        .populate('noteId', 'title');

      return res.json({
        success: true,
        data: flashcardSets,
      });
    } catch (error: any) {
      console.error(`[${req.correlationId}] ❌ Error listing flashcard sets:`, error);
      return res.status(500).json({
        success: false,
        message: 'Failed to list flashcard sets',
        error: error.message,
      });
    }
  }

  /**
   * Update flashcard
   */
  async updateFlashcard(req: AuthRequest, res: Response) {
    try {
      if (!req.user?._id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const userId = req.user._id;
      const { setId, cardId } = req.params;
      const { front, back, color, mastered } = req.body;

      const flashcardSet = await FlashcardSet.findOne({ _id: setId, userId });

      if (!flashcardSet) {
        return res.status(404).json({
          success: false,
          message: 'Flashcard set not found',
        });
      }

      const card = (flashcardSet.cards as any).id(cardId);

      if (!card) {
        return res.status(404).json({
          success: false,
          message: 'Flashcard not found',
        });
      }

      // Update card fields
      if (front !== undefined) card.front = front;
      if (back !== undefined) card.back = back;
      if (color !== undefined) card.color = color;
      if (mastered !== undefined) {
        card.mastered = mastered;

        // Update mastered count
        const masteredCount = flashcardSet.cards.filter(c => c.mastered).length;
        flashcardSet.masteredCards = masteredCount;
      }

      await flashcardSet.save();

      return res.json({
        success: true,
        message: 'Flashcard updated',
        data: flashcardSet,
      });
    } catch (error: any) {
      console.error(`[${req.correlationId}] ❌ Error updating flashcard:`, error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update flashcard',
        error: error.message,
      });
    }
  }

  /**
   * Mark flashcard as reviewed
   */
  async reviewFlashcard(req: AuthRequest, res: Response) {
    try {
      if (!req.user?._id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const userId = req.user._id;
      const { setId, cardId } = req.params;
      const { mastered } = req.body;

      const flashcardSet = await FlashcardSet.findOne({ _id: setId, userId });

      if (!flashcardSet) {
        return res.status(404).json({
          success: false,
          message: 'Flashcard set not found',
        });
      }

      const card = (flashcardSet.cards as any).id(cardId);

      if (!card) {
        return res.status(404).json({
          success: false,
          message: 'Flashcard not found',
        });
      }

      // Update review data
      card.reviewCount += 1;
      card.lastReviewedAt = new Date();

      if (mastered !== undefined) {
        card.mastered = mastered;
      }

      // Update mastered count
      const masteredCount = flashcardSet.cards.filter(c => c.mastered).length;
      flashcardSet.masteredCards = masteredCount;

      await flashcardSet.save();

      return res.json({
        success: true,
        message: 'Flashcard reviewed successfully',
        data: {
          card,
          progress: {
            totalCards: flashcardSet.totalCards,
            masteredCards: flashcardSet.masteredCards,
            percentage: Math.round((flashcardSet.masteredCards / flashcardSet.totalCards) * 100),
          },
        },
      });
    } catch (error: any) {
      console.error(`[${req.correlationId}] ❌ Error reviewing flashcard:`, error);
      return res.status(500).json({
        success: false,
        message: 'Failed to review flashcard',
        error: error.message,
      });
    }
  }

  /**
   * Delete flashcard set
   */
  async deleteFlashcardSet(req: AuthRequest, res: Response) {
    try {
      if (!req.user?._id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const userId = req.user._id;
      const { setId } = req.params;

      const flashcardSet = await FlashcardSet.findOneAndDelete({
        _id: setId,
        userId,
      });

      if (!flashcardSet) {
        return res.status(404).json({
          success: false,
          message: 'Flashcard set not found',
        });
      }

      return res.json({
        success: true,
        message: 'Flashcard set deleted',
      });
    } catch (error: any) {
      console.error(`[${req.correlationId}] ❌ Error deleting flashcard set:`, error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete flashcard set',
        error: error.message,
      });
    }
  }

  /**
   * Get flashcard set statistics
   */
  async getStatistics(req: AuthRequest, res: Response) {
    try {
      if (!req.user?._id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const userId = req.user._id;
      const { setId } = req.params;

      const flashcardSet = await FlashcardSet.findOne({ _id: setId, userId });

      if (!flashcardSet) {
        return res.status(404).json({
          success: false,
          message: 'Flashcard set not found',
        });
      }

      const totalReviews = flashcardSet.cards.reduce((sum, card) => sum + card.reviewCount, 0);
      const averageReviews = totalReviews / flashcardSet.totalCards;

      return res.json({
        success: true,
        data: {
          totalCards: flashcardSet.totalCards,
          masteredCards: flashcardSet.masteredCards,
          notMasteredCards: flashcardSet.totalCards - flashcardSet.masteredCards,
          totalReviews,
          averageReviews: Math.round(averageReviews * 10) / 10,
          masteryPercentage: Math.round((flashcardSet.masteredCards / flashcardSet.totalCards) * 100),
        },
      });
    } catch (error: any) {
      console.error(`[${req.correlationId}] ❌ Error getting statistics:`, error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get statistics',
        error: error.message,
      });
    }
  }

  /**
   * Export flashcard set questions
   * GET /api/v1/flashcards/:setId/export/questions?format=pdf|txt
   */
  async exportQuestions(req: AuthRequest, res: Response) {
    try {
      if (!req.user?._id) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { setId } = req.params;
      const { format = 'pdf' } = req.query;

      // Validate format
      if (!['pdf', 'txt', 'docx'].includes(format as string)) {
        return res.status(400).json({ success: false, message: 'Invalid format. Use pdf, txt, or docx' });
      }

      const FlashcardSet = (await import('../models/FlashcardSet')).default;

      // Get flashcard set
      const set = await FlashcardSet.findOne({
        _id: setId,
        userId: req.user._id,
      });

      if (!set) {
        return res.status(404).json({ success: false, message: 'Flashcard set not found' });
      }

      let content: Buffer | string;
      let filename: string;

      if (format === 'docx') {
        const flashcardExportDOCXService = (await import('../services/flashcardExportDOCX.service')).default;
        content = await flashcardExportDOCXService.exportQuestionsToDOCX(set);
        filename = flashcardExportDOCXService.getExportFilename(set.title, false, 'docx');
      } else {
        const flashcardExportService = (await import('../services/flashcardExport.service')).default;
        content = await flashcardExportService.exportQuestions(set, format as 'pdf' | 'txt');
        filename = flashcardExportService.getExportFilename(set.title, false, format as 'pdf' | 'txt');
      }

      // Set response headers for file download
      const buffer = typeof content === 'string' ? Buffer.from(content) : content;
      const mimeType = format === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : format === 'pdf'
        ? 'application/pdf'
        : 'text/plain';

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.setHeader('Content-Length', buffer.length);

      return res.send(buffer);
    } catch (error: any) {
      console.error(`[${req.correlationId}] Error exporting flashcard questions:`, error);
      return res.status(500).json({
        success: false,
        message: 'Failed to export flashcard questions',
        error: error.message,
      });
    }
  }

  /**
   * Export flashcard set answers
   * GET /api/v1/flashcards/:setId/export/answers?format=pdf|txt|docx
   */
  async exportAnswers(req: AuthRequest, res: Response) {
    try {
      if (!req.user?._id) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { setId } = req.params;
      const { format = 'pdf' } = req.query;

      // Validate format
      if (!['pdf', 'txt', 'docx'].includes(format as string)) {
        return res.status(400).json({ success: false, message: 'Invalid format. Use pdf, txt, or docx' });
      }

      const FlashcardSet = (await import('../models/FlashcardSet')).default;

      // Get flashcard set
      const set = await FlashcardSet.findOne({
        _id: setId,
        userId: req.user._id,
      });

      if (!set) {
        return res.status(404).json({ success: false, message: 'Flashcard set not found' });
      }

      let content: Buffer | string;
      let filename: string;

      if (format === 'docx') {
        const flashcardExportDOCXService = (await import('../services/flashcardExportDOCX.service')).default;
        content = await flashcardExportDOCXService.exportAnswersToDOCX(set);
        filename = flashcardExportDOCXService.getExportFilename(set.title, true, 'docx');
      } else {
        const flashcardExportService = (await import('../services/flashcardExport.service')).default;
        content = await flashcardExportService.exportAnswers(set, format as 'pdf' | 'txt');
        filename = flashcardExportService.getExportFilename(set.title, true, format as 'pdf' | 'txt');
      }

      // Set response headers for file download
      const buffer = typeof content === 'string' ? Buffer.from(content) : content;
      const mimeType = format === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : format === 'pdf'
        ? 'application/pdf'
        : 'text/plain';

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.setHeader('Content-Length', buffer.length);

      return res.send(buffer);
    } catch (error: any) {
      console.error(`[${req.correlationId}] Error exporting flashcard answers:`, error);
      return res.status(500).json({
        success: false,
        message: 'Failed to export flashcard answers',
        error: error.message,
      });
    }
  }

  /**
   * Helper: Encode export content (PDF to base64, TXT as-is)
   */
  private encodeExportContent(content: Buffer | string, format: 'pdf' | 'txt'): {
    encodedContent: string;
    encoding: 'base64' | 'utf8';
    mimeType: string;
  } {
    if (format === 'pdf') {
      // Convert Buffer to base64
      const base64Content = Buffer.isBuffer(content) ? content.toString('base64') : Buffer.from(content).toString('base64');
      return {
        encodedContent: base64Content,
        encoding: 'base64',
        mimeType: 'application/pdf'
      };
    } else {
      // TXT is already a string
      const textContent = Buffer.isBuffer(content) ? content.toString('utf8') : content;
      return {
        encodedContent: textContent,
        encoding: 'utf8',
        mimeType: 'text/plain'
      };
    }
  }
}

export default new FlashcardController();
