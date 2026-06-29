import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import Quiz from '../models/Quiz';
import Note from '../models/Note';
import { User } from '../models/User';
import quizGenerationService from '../services/quizGeneration.service';
import { checkQuota, incrementQuota, QuotaExceededError } from '../services/quota.service';

class QuizController {
  /**
   * Generate quiz from note
   * POST /api/v1/quizzes/generate
   */
  async generateQuiz(req: AuthRequest, res: Response) {
    try {
      // ✅ Ensure user is authenticated and has _id
      if (!req.user?._id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const {
        noteId,
        questionCount = 10,
        difficulty = 'medium',
        questionTypes = ['multiple-choice'],
        quizType = 'standard',
        targetLanguage,
      } = req.body;

      // Validation
      if (!noteId) {
        return res.status(400).json({
          success: false,
          message: 'Note ID is required',
        });
      }

      // ✅ Use consistent _id reference
      const userId = req.user._id;
      const orgId = req.user.orgId;

      try {
        checkQuota(req.user, 'quizzes');
      } catch (e) {
        if (e instanceof QuotaExceededError) {
          return res.status(402).json({ success: false, quotaExceeded: true, feature: e.feature, message: e.message });
        }
        throw e;
      }

      // Get note — org students can access notes uploaded by their org admin
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

      // Check if note has content
      if (!note.content || note.content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Note must have content to generate a quiz',
        });
      }

      // Resolve effective target language: provided → note override → user preference → user UI language → English
      const effectiveLanguage = targetLanguage || note.studyLanguage || req.user.studyLanguage || req.user.preferredLanguage || 'en';

      // Generate quiz based on type
      console.log(`🎯 Generating ${quizType} quiz for note: ${note.title}`);
      console.log(`   Settings: ${questionCount} questions, ${difficulty} difficulty, language: ${effectiveLanguage}`);

      let quizData;

      if (quizType === 'practice') {
        quizData = await quizGenerationService.generatePracticeQuiz(
          note.content,
          note.title
        );
      } else if (quizType === 'comprehensive') {
        quizData = await quizGenerationService.generateComprehensiveQuiz(
          note.content,
          note.title
        );
      } else {
        quizData = await quizGenerationService.generateQuiz(
          note.content,
          note.title,
          {
            questionCount,
            difficulty,
            questionTypes,
            targetLanguage: effectiveLanguage,
          }
        );
      }

      console.log(`✅ Quiz generated successfully:`);
      console.log(`   Title: ${quizData.title}`);
      console.log(`   Questions: ${quizData.questions.length}`);
      console.log(`   First question: ${quizData.questions[0]?.questionText?.substring(0, 60)}...`);

      // Validate quiz data
      if (!quizData || !quizData.questions || quizData.questions.length === 0) {
        throw new Error('Quiz generation returned no questions');
      }

      // Create quiz in database with STRING ARRAYS (don't transform yet!)
      const quiz = await Quiz.create({
        userId,  // ✅ Use consistent _id
        noteId: note._id,
        title: quizData.title,
        questions: quizData.questions, // Save as-is with string array options
        totalQuestions: quizData.questions.length,
      });
      incrementQuota(userId.toString(), 'quizzes');

      // Transform for response ONLY (don't save this to DB)
      const transformedQuiz = {
        ...quiz.toObject(),
        questions: quiz.questions.map((question: any, qIndex: number) => ({
          id: `question-${qIndex}`,
          question: question.questionText,
          questionText: question.questionText, // Keep both for compatibility
          questionType: question.questionType,
          options: question.options.map((optionText: string, index: number) => ({
            id: `option-${index}`,
            text: optionText,
          })),
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          difficulty: question.difficulty,
        })),
      };

      return res.status(201).json({
        success: true,
        message: 'Quiz generated successfully',
        data: transformedQuiz,
      });
    } catch (error: any) {
      console.error(`[${req.correlationId}] Error generating quiz:`, error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate quiz',
        error: error.message,
      });
    }
  }

  /**
   * Get all user quizzes
   * GET /api/v1/quizzes
   * Org admins may pass ?studentId= to read all quizzes for a specific student.
   */
  async getQuizzes(req: AuthRequest, res: Response) {
    try {
      if (!req.user?._id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      // Org admin RBAC: allow reading another student's quiz list
      let targetUserId: string = req.user._id;
      const { studentId } = req.query;

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

      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

      // ✅ Validate pagination
      const pageNum = Math.max(1, Number(page));
      const limitNum = Math.min(100, Math.max(1, Number(limit)));
      const skip = (pageNum - 1) * limitNum;

      const [quizzes, total] = await Promise.all([
        Quiz.find({ userId: targetUserId })
          .sort({ [sortBy as string]: sortOrder === 'desc' ? -1 : 1 })
          .skip(skip)
          .limit(limitNum)
          .populate('noteId', 'title')
          .lean(),
        Quiz.countDocuments({ userId: targetUserId }),
      ]);

      // Transform questions to ensure options have id and text format
      const transformedQuizzes = quizzes.map((quiz: any) => ({
        ...quiz,
        questions: quiz.questions.map((question: any) => ({
          ...question,
          options: Array.isArray(question.options) && typeof question.options[0] === 'string'
            ? question.options.map((optionText: string, index: number) => ({
                id: `option-${index}`,
                text: optionText,
              }))
            : question.options, // Already in correct format
        })),
      }));

      return res.json({
        success: true,
        data: transformedQuizzes,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      console.error(`[${req.correlationId}] Error fetching quizzes:`, error);
      return res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message,
      });
    }
  }

  /**
   * Get quizzes for a specific note
   * GET /api/v1/quizzes/note/:noteId
   * Org admins may pass ?studentId= to read a student's quiz history for this note.
   */
  async getQuizzesByNote(req: AuthRequest, res: Response) {
    try {
      if (!req.user?._id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      if (!req.params.noteId) {
        return res.status(400).json({
          success: false,
          message: 'Note ID is required',
        });
      }

      // Org admin RBAC: allow reading another student's quiz history
      let targetUserId: string = req.user._id;
      const { studentId } = req.query;

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

      const quizzes = await Quiz.find({
        userId: targetUserId,
        noteId: req.params.noteId,
      })
        .sort({ createdAt: -1 })
        .lean();

      // Transform questions to ensure options have id and text format
      const transformedQuizzes = quizzes.map((quiz: any) => ({
        ...quiz,
        questions: quiz.questions.map((question: any) => ({
          ...question,
          options: Array.isArray(question.options) && typeof question.options[0] === 'string'
            ? question.options.map((optionText: string, index: number) => ({
                id: `option-${index}`,
                text: optionText,
              }))
            : question.options, // Already in correct format
        })),
      }));

      return res.json({
        success: true,
        data: transformedQuizzes,
      });
    } catch (error: any) {
      console.error(`[${req.correlationId}] Error fetching quizzes:`, error);
      return res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message,
      });
    }
  }

  /**
   * Get single quiz
   * GET /api/v1/quizzes/:id
   */
  async getQuizById(req: AuthRequest, res: Response) {
    try {
      if (!req.user?._id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const quiz = await Quiz.findOne({
        _id: req.params.id,
        userId: req.user._id,  // ✅ Use _id
      }).populate('noteId', 'title');

      if (!quiz) {
        return res.status(404).json({
          success: false,
          message: 'Quiz not found',
        });
      }

      // Transform questions for frontend format
      const transformedQuiz = quiz.toObject();
      transformedQuiz.questions = transformedQuiz.questions.map((question: any, qIndex: number) => {
        // Ensure options are in {id, text} format
        const formattedOptions = Array.isArray(question.options)
          ? question.options.map((opt: any, index: number) => {
              if (typeof opt === 'string') {
                return { id: `option-${index}`, text: opt };
              }
              return opt; // Already in correct format
            })
          : [];

        return {
          id: `question-${qIndex}`,
          question: question.questionText,
          questionText: question.questionText,
          questionType: question.questionType,
          options: formattedOptions,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          difficulty: question.difficulty,
        };
      });

      return res.json({
        success: true,
        data: transformedQuiz,
      });
    } catch (error: any) {
      console.error(`[${req.correlationId}] Error fetching quiz:`, error);
      return res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message,
      });
    }
  }

  /**
   * Submit quiz answers
   * POST /api/v1/quizzes/:id/submit
   */
  async submitQuiz(req: AuthRequest, res: Response) {
    try {
      if (!req.user?._id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { answers } = req.body;

      // Validation
      if (!answers || !Array.isArray(answers)) {
        return res.status(400).json({
          success: false,
          message: 'Answers array is required',
        });
      }

      const quiz = await Quiz.findOne({
        _id: req.params.id,
        userId: req.user._id,  // ✅ Use _id
      });

      if (!quiz) {
        return res.status(404).json({
          success: false,
          message: 'Quiz not found',
        });
      }

      // Grade quiz
      let correctCount = 0;
      const results = quiz.questions.map((question, index) => {
        const userAnswer = answers[index];
        const isCorrect =
          userAnswer !== undefined &&
          userAnswer.toString() === question.correctAnswer.toString();

        if (isCorrect) correctCount++;

        return {
          questionIndex: index,
          questionText: question.questionText,
          userAnswer,
          correctAnswer: question.correctAnswer,
          isCorrect,
          explanation: question.explanation,
        };
      });

      const score = Math.round((correctCount / quiz.totalQuestions) * 100);

      // Update quiz stats
      (quiz as any).completionCount = ((quiz as any).completionCount || 0) + 1;
      (quiz as any).averageScore =
        (quiz as any).averageScore === 0
          ? score
          : Math.round(((quiz as any).averageScore + score) / 2);
      (quiz as any).lastAttemptAt = new Date();

      await quiz.save();

      return res.json({
        success: true,
        data: {
          score,
          correctCount,
          totalQuestions: quiz.totalQuestions,
          percentage: score,
          results,
        },
      });
    } catch (error: any) {
      console.error(`[${req.correlationId}] Error submitting quiz:`, error);
      return res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message,
      });
    }
  }

  /**
   * Delete quiz
   * DELETE /api/v1/quizzes/:id
   */
  async deleteQuiz(req: AuthRequest, res: Response) {
    try {
      if (!req.user?._id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const quiz = await Quiz.findOneAndDelete({
        _id: req.params.id,
        userId: req.user._id,  // ✅ Use _id
      });

      if (!quiz) {
        return res.status(404).json({
          success: false,
          message: 'Quiz not found',
        });
      }

      return res.json({
        success: true,
        message: 'Quiz deleted successfully',
      });
    } catch (error: any) {
      console.error(`[${req.correlationId}] Error deleting quiz:`, error);
      return res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message,
      });
    }
  }

  /**
   * Export quiz questions
   * GET /api/v1/quizzes/:quizId/export/questions?format=pdf|txt
   */
  async exportQuestions(req: AuthRequest, res: Response) {
    try {
      if (!req.user?._id) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { quizId } = req.params;
      const { format = 'pdf' } = req.query;

      // Validate format
      if (!['pdf', 'txt', 'docx'].includes(format as string)) {
        return res.status(400).json({ success: false, message: 'Invalid format. Use pdf, txt, or docx' });
      }

      // Get quiz
      const quiz = await Quiz.findOne({
        _id: quizId,
        userId: req.user._id,
      });

      if (!quiz) {
        return res.status(404).json({ success: false, message: 'Quiz not found' });
      }

      let content: Buffer | string;
      let filename: string;

      if (format === 'docx') {
        const quizExportDOCXService = (await import('../services/quizExportDOCX.service')).default;
        content = await quizExportDOCXService.exportQuestionsToDOCX(quiz);
        filename = quizExportDOCXService.getExportFilename(quiz.title, false, 'docx');
      } else {
        const quizExportService = (await import('../services/quizExport.service')).default;
        content = await quizExportService.exportQuestions(quiz, format as 'pdf' | 'txt');
        filename = quizExportService.getExportFilename(quiz.title, false, format as 'pdf' | 'txt');
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
      console.error(`[${req.correlationId}] Error exporting quiz questions:`, error);
      return res.status(500).json({
        success: false,
        message: 'Failed to export quiz questions',
        error: error.message,
      });
    }
  }

  /**
   * Export quiz answers & explanations
   * GET /api/v1/quizzes/:quizId/export/answers?format=pdf|txt|docx
   */
  async exportAnswers(req: AuthRequest, res: Response) {
    try {
      if (!req.user?._id) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { quizId } = req.params;
      const { format = 'pdf' } = req.query;

      // Validate format
      if (!['pdf', 'txt', 'docx'].includes(format as string)) {
        return res.status(400).json({ success: false, message: 'Invalid format. Use pdf, txt, or docx' });
      }

      // Get quiz
      const quiz = await Quiz.findOne({
        _id: quizId,
        userId: req.user._id,
      });

      if (!quiz) {
        return res.status(404).json({ success: false, message: 'Quiz not found' });
      }

      let content: Buffer | string;
      let filename: string;

      if (format === 'docx') {
        const quizExportDOCXService = (await import('../services/quizExportDOCX.service')).default;
        content = await quizExportDOCXService.exportAnswersToDOCX(quiz);
        filename = quizExportDOCXService.getExportFilename(quiz.title, true, 'docx');
      } else {
        const quizExportService = (await import('../services/quizExport.service')).default;
        content = await quizExportService.exportAnswers(quiz, format as 'pdf' | 'txt');
        filename = quizExportService.getExportFilename(quiz.title, true, format as 'pdf' | 'txt');
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
      console.error(`[${req.correlationId}] Error exporting quiz answers:`, error);
      return res.status(500).json({
        success: false,
        message: 'Failed to export quiz answers',
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
  /**
   * Update a single quiz question by its 0-based index.
   * PATCH /api/v1/quizzes/:quizId/questions/:questionIndex
   * Body: { questionText?, options?: string[], correctAnswer?, explanation? }
   */
  async updateQuestion(req: AuthRequest, res: Response) {
    try {
      if (!req.user?._id) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const userId = req.user._id;
      const { quizId, questionIndex } = req.params;
      const idx = parseInt(questionIndex, 10);

      if (isNaN(idx) || idx < 0) {
        return res.status(400).json({ success: false, message: 'Invalid question index' });
      }

      const quiz = await Quiz.findOne({ _id: quizId, userId });
      if (!quiz) {
        return res.status(404).json({ success: false, message: 'Quiz not found' });
      }

      if (idx >= quiz.questions.length) {
        return res.status(400).json({ success: false, message: 'Question index out of range' });
      }

      const { questionText, options, correctAnswer, explanation } = req.body;
      const q = quiz.questions[idx] as any;

      if (questionText !== undefined) q.questionText = questionText;
      if (options !== undefined) q.options = options;
      if (correctAnswer !== undefined) q.correctAnswer = correctAnswer;
      if (explanation !== undefined) q.explanation = explanation;

      quiz.markModified('questions');
      await quiz.save();

      return res.json({
        success: true,
        message: 'Question updated',
        data: {
          index: idx,
          question: {
            id: `question-${idx}`,
            question: q.questionText,
            options: q.options.map((text: string, i: number) => ({ id: `option-${i}`, text })),
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
          },
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: 'Failed to update question', error: error.message });
    }
  }
}

export default new QuizController();
