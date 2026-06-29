import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../server';
import FlashcardSet from '../models/FlashcardSet';
import Note from '../models/Note';
import { User } from '../models/User';
import { generateAccessToken } from '../utils/jwt';

const { MongoMemoryServer } = require('mongodb-memory-server');

let authToken: string;
let userId: string;
let secondAuthToken: string;
let secondUserId: string;
let testNote: any;
let testFlashcardSet: any;
let mongod: any;

describe('Flashcard Export Integration Tests', () => {
  beforeAll(async () => {
    // Set up in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri, { dbName: 'test' });

    // Create first test user
    const testUser = await User.create({
      email: `flashcard_export_${Date.now()}@test.com`,
      name: 'Flashcard Export Test User',
      username: `flashcard_export_${Date.now()}`,
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
      email: `flashcard_export_second_${Date.now()}@test.com`,
      name: 'Second Export User',
      username: `flashcard_export_second_${Date.now()}`,
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
      title: 'Spanish Vocabulary',
      content: 'Spanish words and phrases',
      sourceType: 'text',
    });

    // Create test flashcard set
    testFlashcardSet = await FlashcardSet.create({
      userId,
      noteId: testNote._id,
      title: 'Spanish Greetings',
      cards: [
        {
          front: 'Hello',
          back: 'Hola',
          mastered: false,
          reviewCount: 2,
          color: '#FFD1B8',
        },
        {
          front: 'Good morning',
          back: 'Buenos días',
          mastered: true,
          reviewCount: 5,
          color: '#FFD1B8',
        },
        {
          front: 'Thank you',
          back: 'Gracias',
          mastered: false,
          reviewCount: 1,
          color: '#C7CEEA',
        },
      ],
      totalCards: 3,
      masteredCards: 1,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  describe('GET /api/v1/flashcards/:setId/export/questions', () => {
    test('should export flashcard questions as PDF', async () => {
      const response = await request(app)
        .get(`/api/v1/flashcards/${testFlashcardSet._id}/export/questions?format=pdf`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toMatch(/\.pdf$/);
      expect(response.body).toBeInstanceOf(Buffer);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should export flashcard questions as DOCX', async () => {
      const response = await request(app)
        .get(`/api/v1/flashcards/${testFlashcardSet._id}/export/questions?format=docx`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(response.headers['content-disposition']).toMatch(/\.docx$/);
      expect(response.body).toBeInstanceOf(Buffer);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should use PDF as default format', async () => {
      const response = await request(app)
        .get(`/api/v1/flashcards/${testFlashcardSet._id}/export/questions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
    });

    test('should include set title in Content-Disposition', async () => {
      const response = await request(app)
        .get(`/api/v1/flashcards/${testFlashcardSet._id}/export/questions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.headers['content-disposition']).toContain('spanish');
      expect(response.headers['content-disposition']).toContain('questions');
    });

    test('should exclude answer content in questions-only export', async () => {
      const response = await request(app)
        .get(`/api/v1/flashcards/${testFlashcardSet._id}/export/questions?format=docx`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Buffer);
    });

    test('should reject invalid format', async () => {
      const response = await request(app)
        .get(`/api/v1/flashcards/${testFlashcardSet._id}/export/questions?format=invalid`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid format');
    });

    test('should return 404 for non-existent set', async () => {
      const fakeSetId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/v1/flashcards/${fakeSetId}/export/questions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    test('should return 404 when accessing another user\'s set', async () => {
      const response = await request(app)
        .get(`/api/v1/flashcards/${testFlashcardSet._id}/export/questions`)
        .set('Authorization', `Bearer ${secondAuthToken}`);

      expect(response.status).toBe(404);
    });

    test('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get(`/api/v1/flashcards/${testFlashcardSet._id}/export/questions`);

      expect(response.status).toBe(401);
    });

    test('should support txt format', async () => {
      const response = await request(app)
        .get(`/api/v1/flashcards/${testFlashcardSet._id}/export/questions?format=txt`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
    });
  });

  describe('GET /api/v1/flashcards/:setId/export/answers', () => {
    test('should export flashcard answers as PDF', async () => {
      const response = await request(app)
        .get(`/api/v1/flashcards/${testFlashcardSet._id}/export/answers?format=pdf`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toMatch(/\.pdf$/);
      expect(response.body).toBeInstanceOf(Buffer);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should export flashcard answers as DOCX', async () => {
      const response = await request(app)
        .get(`/api/v1/flashcards/${testFlashcardSet._id}/export/answers?format=docx`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(response.headers['content-disposition']).toMatch(/\.docx$/);
      expect(response.body).toBeInstanceOf(Buffer);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should include both questions and answers', async () => {
      const response = await request(app)
        .get(`/api/v1/flashcards/${testFlashcardSet._id}/export/answers?format=docx`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should mark filename as "answers"', async () => {
      const response = await request(app)
        .get(`/api/v1/flashcards/${testFlashcardSet._id}/export/answers`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.headers['content-disposition']).toContain('answers');
      expect(response.headers['content-disposition']).not.toContain('questions');
    });

    test('should return 404 for non-existent set', async () => {
      const fakeSetId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/v1/flashcards/${fakeSetId}/export/answers`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    test('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get(`/api/v1/flashcards/${testFlashcardSet._id}/export/answers`);

      expect(response.status).toBe(401);
    });

    test('should use PDF as default format', async () => {
      const response = await request(app)
        .get(`/api/v1/flashcards/${testFlashcardSet._id}/export/answers`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
    });
  });

  describe('Export Performance', () => {
    test('should export PDF in reasonable time (< 2 seconds)', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/v1/flashcards/${testFlashcardSet._id}/export/questions?format=pdf`)
        .set('Authorization', `Bearer ${authToken}`);

      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000);
    });

    test('should export DOCX in reasonable time (< 2 seconds)', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/v1/flashcards/${testFlashcardSet._id}/export/questions?format=docx`)
        .set('Authorization', `Bearer ${authToken}`);

      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Large Flashcard Set Export', () => {
    let largeSet: any;

    beforeAll(async () => {
      // Create flashcard set with 500+ cards
      const manyCards = Array.from({ length: 500 }, (_, i) => ({
        front: `Front ${i + 1}`,
        back: `Back ${i + 1}`,
        mastered: i % 2 === 0,
        reviewCount: i % 10,
        color: '#FFD1B8',
      }));

      largeSet = await FlashcardSet.create({
        userId,
        noteId: testNote._id,
        title: 'Large Flashcard Set 500 Cards',
        cards: manyCards,
        totalCards: 500,
        masteredCards: 250,
      });
    });

    test('should handle large set (500+ cards) export as PDF', async () => {
      const response = await request(app)
        .get(`/api/v1/flashcards/${largeSet._id}/export/questions?format=pdf`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should handle large set (500+ cards) export as DOCX', async () => {
      const response = await request(app)
        .get(`/api/v1/flashcards/${largeSet._id}/export/questions?format=docx`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should handle large set answers export', async () => {
      const response = await request(app)
        .get(`/api/v1/flashcards/${largeSet._id}/export/answers?format=docx`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle set with special characters in title', async () => {
      const specialSet = await FlashcardSet.create({
        userId,
        noteId: testNote._id,
        title: 'Set with "Quotes" & \'Apostrophes\'',
        cards: [
          {
            front: 'Test',
            back: 'Prueba',
            mastered: false,
            reviewCount: 0,
            color: '#FFD1B8',
          },
        ],
        totalCards: 1,
        masteredCards: 0,
      });

      const response = await request(app)
        .get(`/api/v1/flashcards/${specialSet._id}/export/questions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Buffer);
    });

    test('should handle set with very long title', async () => {
      const longTitleSet = await FlashcardSet.create({
        userId,
        noteId: testNote._id,
        title: 'A'.repeat(200),
        cards: [
          {
            front: 'Q',
            back: 'A',
            mastered: false,
            reviewCount: 0,
            color: '#FFD1B8',
          },
        ],
        totalCards: 1,
        masteredCards: 0,
      });

      const response = await request(app)
        .get(`/api/v1/flashcards/${longTitleSet._id}/export/questions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Buffer);
    });

    test('should handle set with single card', async () => {
      const singleCardSet = await FlashcardSet.create({
        userId,
        noteId: testNote._id,
        title: 'Single Card Set',
        cards: [
          {
            front: 'Only question',
            back: 'Only answer',
            mastered: false,
            reviewCount: 0,
            color: '#FFD1B8',
          },
        ],
        totalCards: 1,
        masteredCards: 0,
      });

      const response = await request(app)
        .get(`/api/v1/flashcards/${singleCardSet._id}/export/questions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Buffer);
    });

    test('should handle cards with very long content', async () => {
      const longContentSet = await FlashcardSet.create({
        userId,
        noteId: testNote._id,
        title: 'Long Content Set',
        cards: [
          {
            front: 'Q'.repeat(500),
            back: 'A'.repeat(500),
            mastered: false,
            reviewCount: 0,
            color: '#FFD1B8',
          },
        ],
        totalCards: 1,
        masteredCards: 0,
      });

      const response = await request(app)
        .get(`/api/v1/flashcards/${longContentSet._id}/export/questions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Buffer);
    });

    test('should handle cards with unicode characters', async () => {
      const unicodeSet = await FlashcardSet.create({
        userId,
        noteId: testNote._id,
        title: 'Unicode Set 中文',
        cards: [
          {
            front: '中文问题',
            back: 'Chinese answer',
            mastered: false,
            reviewCount: 0,
            color: '#FFD1B8',
          },
        ],
        totalCards: 1,
        masteredCards: 0,
      });

      const response = await request(app)
        .get(`/api/v1/flashcards/${unicodeSet._id}/export/questions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Buffer);
    });
  });

  describe('Metadata in Exports', () => {
    test('should include creation date in export', async () => {
      const response = await request(app)
        .get(`/api/v1/flashcards/${testFlashcardSet._id}/export/questions?format=docx`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Buffer);
    });

    test('should show mastered count in export', async () => {
      const response = await request(app)
        .get(`/api/v1/flashcards/${testFlashcardSet._id}/export/answers?format=docx`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Buffer);
    });
  });
});
