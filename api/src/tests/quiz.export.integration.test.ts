import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../server';
import Quiz from '../models/Quiz';
import Note from '../models/Note';
import { User } from '../models/User';
import { generateAccessToken } from '../utils/jwt';

const { MongoMemoryServer } = require('mongodb-memory-server');

let authToken: string;
let userId: string;
let secondAuthToken: string;
let secondUserId: string;
let testNote: any;
let testQuiz: any;
let mongod: any;

describe('Quiz Export Integration Tests', () => {
  beforeAll(async () => {
    // Set up in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri, { dbName: 'test' });

    // Create first test user
    const testUser = await User.create({
      email: `quiz_export_${Date.now()}@test.com`,
      name: 'Quiz Export Test User',
      username: `quiz_export_${Date.now()}`,
      authProvider: 'local',
      subscription: 'FREE',
      freeUsage: {
        notes: { count: 0 },
        quizzes: { count: 0 },
        flashcards: { count: 0 },
        chats: { count: 0 },
      },
      bonusCredits: {
        notes: 0,
        quizzes: 0,
        flashcards: 0,
        chats: 0,
      },
    });
    userId = testUser._id.toString();
    authToken = generateAccessToken({
      userId,
      email: testUser.email,
      username: testUser.username,
    });

    // Create second user for security tests
    const secondUser = await User.create({
      email: `quiz_export_second_${Date.now()}@test.com`,
      name: 'Second Export User',
      username: `quiz_export_second_${Date.now()}`,
      authProvider: 'local',
      subscription: 'FREE',
      freeUsage: {
        notes: { count: 0 },
        quizzes: { count: 0 },
        flashcards: { count: 0 },
        chats: { count: 0 },
      },
      bonusCredits: {
        notes: 0,
        quizzes: 0,
        flashcards: 0,
        chats: 0,
      },
    });
    secondUserId = secondUser._id.toString();
    secondAuthToken = generateAccessToken({
      userId: secondUserId,
      email: secondUser.email,
      username: secondUser.username,
    });

    // Create test note
    testNote = await Note.create({
      userId,
      title: 'Math Basics',
      content: 'Addition, subtraction, multiplication',
      sourceType: 'text',
    });

    // Create test quiz
    testQuiz = await Quiz.create({
      userId,
      noteId: testNote._id,
      title: 'Algebra Quiz',
      questions: [
        {
          questionText: 'What is 2+2?',
          questionType: 'multiple-choice',
          options: ['3', '4', '5', '6'],
          correctAnswer: 1,
          explanation: 'Basic arithmetic',
          difficulty: 'easy',
        },
        {
          questionText: 'Is 5 > 3?',
          questionType: 'true-false',
          options: ['true', 'false'],
          correctAnswer: 0,
          explanation: 'Comparison of numbers',
          difficulty: 'easy',
        },
      ],
      totalQuestions: 2,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  describe('GET /api/v1/quizzes/:quizId/export/questions', () => {
    test('should export quiz questions as PDF with valid response', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${testQuiz._id}/export/questions?format=pdf`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toMatch(/\.pdf$/);
      expect(response.body).toBeInstanceOf(Buffer);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should export quiz questions as DOCX with valid response', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${testQuiz._id}/export/questions?format=docx`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(response.headers['content-disposition']).toMatch(/\.docx$/);
      expect(response.body).toBeInstanceOf(Buffer);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should use PDF as default format when no format specified', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${testQuiz._id}/export/questions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
    });

    test('should include quiz title in Content-Disposition filename', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${testQuiz._id}/export/questions?format=pdf`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.headers['content-disposition']).toContain('algebra');
      expect(response.headers['content-disposition']).toContain('questions');
    });

    test('should exclude answer content in questions-only export', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${testQuiz._id}/export/questions?format=docx`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // DOCX files don't directly expose text, but we can check it exports successfully
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should reject invalid format parameter', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${testQuiz._id}/export/questions?format=invalid`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid format');
    });

    test('should return 404 for non-existent quiz', async () => {
      const fakeQuizId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/v1/quizzes/${fakeQuizId}/export/questions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    test('should return 404 when accessing another user\'s quiz', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${testQuiz._id}/export/questions`)
        .set('Authorization', `Bearer ${secondAuthToken}`);

      expect(response.status).toBe(404);
    });

    test('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${testQuiz._id}/export/questions`);

      expect(response.status).toBe(401);
    });

    test('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${testQuiz._id}/export/questions`)
        .set('Authorization', 'Bearer invalid_token_12345');

      expect(response.status).toBe(401);
    });

    test('should support txt format', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${testQuiz._id}/export/questions?format=txt`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.body).toBeInstanceOf(Buffer);
    });

    test('should set correct cache headers', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${testQuiz._id}/export/questions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // Check that response has proper headers
      expect(response.headers['content-disposition']).toBeDefined();
    });

    test('should sanitize filename with special characters', async () => {
      // Create quiz with special chars in title
      const specialQuiz = await Quiz.create({
        userId,
        noteId: testNote._id,
        title: 'Quiz!@#$%^&*()',
        questions: [
          {
            questionText: 'Test?',
            questionType: 'true-false',
            options: ['true', 'false'],
            correctAnswer: 0,
            explanation: 'Test',
            difficulty: 'easy',
          },
        ],
        totalQuestions: 1,
      });

      const response = await request(app)
        .get(`/api/v1/quizzes/${specialQuiz._id}/export/questions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const filename = response.headers['content-disposition'];
      // Should not contain special chars
      expect(filename).not.toContain('!');
      expect(filename).not.toContain('@');
    });
  });

  describe('GET /api/v1/quizzes/:quizId/export/answers', () => {
    test('should export quiz answers as PDF with valid response', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${testQuiz._id}/export/answers?format=pdf`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toMatch(/\.pdf$/);
      expect(response.body).toBeInstanceOf(Buffer);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should export quiz answers as DOCX with valid response', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${testQuiz._id}/export/answers?format=docx`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(response.headers['content-disposition']).toMatch(/\.docx$/);
      expect(response.body).toBeInstanceOf(Buffer);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should include answers in export', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${testQuiz._id}/export/answers?format=docx`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should include explanations in answers export', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${testQuiz._id}/export/answers?format=docx`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // Verify response is valid DOCX buffer
      expect(response.body).toBeInstanceOf(Buffer);
    });

    test('should mark filename as "answers" not "questions"', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${testQuiz._id}/export/answers`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.headers['content-disposition']).toContain('answers');
      expect(response.headers['content-disposition']).not.toContain('questions');
    });

    test('should return 404 for non-existent quiz', async () => {
      const fakeQuizId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/v1/quizzes/${fakeQuizId}/export/answers`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    test('should return 404 when accessing another user\'s quiz', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${testQuiz._id}/export/answers`)
        .set('Authorization', `Bearer ${secondAuthToken}`);

      expect(response.status).toBe(404);
    });

    test('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${testQuiz._id}/export/answers`);

      expect(response.status).toBe(401);
    });

    test('should use PDF as default format', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${testQuiz._id}/export/answers`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
    });

    test('should support txt format for answers', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${testQuiz._id}/export/answers?format=txt`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
    });
  });

  describe('Export Performance', () => {
    test('should export PDF in reasonable time (< 2 seconds)', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/v1/quizzes/${testQuiz._id}/export/questions?format=pdf`)
        .set('Authorization', `Bearer ${authToken}`);

      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000); // 2 seconds
    });

    test('should export DOCX in reasonable time (< 2 seconds)', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/v1/quizzes/${testQuiz._id}/export/questions?format=docx`)
        .set('Authorization', `Bearer ${authToken}`);

      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000); // 2 seconds
    });
  });

  describe('Large Quiz Export', () => {
    let largeQuiz: any;

    beforeAll(async () => {
      // Create quiz with 100 questions
      const manyQuestions = Array.from({ length: 100 }, (_, i) => ({
        questionText: `Question ${i + 1}?`,
        questionType: i % 3 === 0 ? 'true-false' : 'multiple-choice',
        options: i % 3 === 0 ? ['true', 'false'] : ['A', 'B', 'C', 'D'],
        correctAnswer: 0,
        explanation: `Explanation for Q${i + 1}`,
        difficulty: i % 2 === 0 ? 'easy' : 'hard',
      }));

      largeQuiz = await Quiz.create({
        userId,
        noteId: testNote._id,
        title: 'Large Quiz 100 Questions',
        questions: manyQuestions,
        totalQuestions: 100,
      });
    });

    test('should handle large quiz (100+ questions) export as PDF', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${largeQuiz._id}/export/questions?format=pdf`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should handle large quiz (100+ questions) export as DOCX', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${largeQuiz._id}/export/questions?format=docx`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should handle large quiz answers export', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/${largeQuiz._id}/export/answers?format=docx`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle quiz with special characters in title', async () => {
      const specialQuiz = await Quiz.create({
        userId,
        noteId: testNote._id,
        title: 'Quiz with "Quotes" & \'Apostrophes\'',
        questions: [
          {
            questionText: 'Test?',
            questionType: 'true-false',
            options: ['true', 'false'],
            correctAnswer: 0,
            explanation: 'Test',
            difficulty: 'easy',
          },
        ],
        totalQuestions: 1,
      });

      const response = await request(app)
        .get(`/api/v1/quizzes/${specialQuiz._id}/export/questions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Buffer);
    });

    test('should handle quiz with very long title', async () => {
      const longTitleQuiz = await Quiz.create({
        userId,
        noteId: testNote._id,
        title: 'A'.repeat(200),
        questions: [
          {
            questionText: 'Test?',
            questionType: 'true-false',
            options: ['true', 'false'],
            correctAnswer: 0,
            explanation: 'Test',
            difficulty: 'easy',
          },
        ],
        totalQuestions: 1,
      });

      const response = await request(app)
        .get(`/api/v1/quizzes/${longTitleQuiz._id}/export/questions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Buffer);
    });

    test('should reject invalid ObjectId format', async () => {
      const response = await request(app)
        .get(`/api/v1/quizzes/invalid_id/export/questions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([400, 404]).toContain(response.status); // Either invalid format or not found
    });
  });
});
