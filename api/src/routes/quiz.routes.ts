import { Router } from 'express';
import quizController from '../controllers/quiz.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/quizzes/generate
 * @route   POST /api/v1/quizzes
 * @desc    Generate quiz from note
 * @access  Private
 */
router.post('/generate', quizController.generateQuiz);
router.post('/', quizController.generateQuiz);

/**
 * @route   GET /api/v1/quizzes
 * @desc    Get all user quizzes
 * @access  Private
 */
router.get('/', quizController.getQuizzes);

/**
 * @route   GET /api/v1/quizzes/note/:noteId
 * @desc    Get quizzes for a specific note
 * @access  Private
 */
router.get('/note', (req, res) => res.status(400).json({ success: false, message: 'Note ID is required' }));
router.get('/note/:noteId', quizController.getQuizzesByNote);

/**
 * @route   GET /api/v1/quizzes/:id
 * @desc    Get single quiz
 * @access  Private
 */
router.get('/:id', quizController.getQuizById);

/**
 * @route   POST /api/v1/quizzes/:id/submit
 * @desc    Submit quiz answers
 * @access  Private
 */
router.post('/:id/submit', quizController.submitQuiz);

/**
 * @route   GET /api/v1/quizzes/:quizId/export/questions
 * @desc    Export quiz questions as PDF or TXT
 * @access  Private
 */
router.get('/:quizId/export/questions', quizController.exportQuestions.bind(quizController));

/**
 * @route   GET /api/v1/quizzes/:quizId/export/answers
 * @desc    Export quiz answers & explanations as PDF or TXT
 * @access  Private
 */
router.get('/:quizId/export/answers', quizController.exportAnswers.bind(quizController));

/**
 * @route   PATCH /api/v1/quizzes/:quizId/questions/:questionIndex
 * @desc    Update a single question by 0-based index (teacher edit)
 * @access  Private
 */
router.patch('/:quizId/questions/:questionIndex', quizController.updateQuestion.bind(quizController));

/**
 * @route   DELETE /api/v1/quizzes/:id
 * @desc    Delete quiz
 * @access  Private
 */
router.delete('/:id', quizController.deleteQuiz);

export default router;
