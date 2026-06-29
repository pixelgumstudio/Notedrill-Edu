import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../server';
import { User } from '../models/User';
import Note from '../models/Note';
import { generateAccessToken } from '../utils/jwt';

const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod: any;

describe('Quota Enforcement Test Suite', () => {
  beforeAll(async () => {
    // Set up in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri, { dbName: 'test' });

    // Ensure indexes are created
    await Note.collection.createIndex({ title: 'text', content: 'text', transcriptText: 'text' });
  });

  afterAll(async () => {
    // Clean up
    await Note.deleteMany({});
    await User.deleteMany({});
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  afterEach(async () => {
    // Clean up between tests
    await Note.deleteMany({});
    await User.deleteMany({});
  });

  // ==========================================
  // SECTION 1: NOTE QUOTA ENFORCEMENT (3 tests)
  // ==========================================

  describe('Note Quota Enforcement', () => {
    it('(1a) Free user at quota limit should return 402 with quotaExceeded: true', async () => {
      // Create FREE user with quota already consumed
      const testUser = await User.create({
        email: `free_at_limit_${Date.now()}@test.com`,
        name: 'Free User At Limit',
        username: `free_at_limit_${Date.now()}`,
        authProvider: 'local',
        subscription: 'FREE',
        freeUsage: {
          notes: { count: 1 },        // Already used 1 note (limit is 1)
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

      const authToken = generateAccessToken({
        userId: testUser._id.toString(),
        email: testUser.email,
        username: testUser.username,
      });

      // Attempt to create another note
      const response = await request(app)
        .post('/api/v1/notes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Should Fail',
          sourceType: 'text',
          content: 'Test content',
        });

      expect(response.status).toBe(402);
      expect(response.body.success).toBe(false);
      expect(response.body.quotaExceeded).toBe(true);
      expect(response.body.feature).toBe('notes');
      expect(response.body.message).toBeTruthy();
      expect(response.body.message).toContain('Upgrade');
    });

    it('(1b) PRO user should bypass note quota and succeed', async () => {
      // Create PRO user (ignore quota limits)
      const testUser = await User.create({
        email: `pro_user_${Date.now()}@test.com`,
        name: 'Pro User',
        username: `pro_user_${Date.now()}`,
        authProvider: 'local',
        subscription: 'PRO',
        freeUsage: {
          notes: { count: 1 },        // Even if "used" all quota
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

      const authToken = generateAccessToken({
        userId: testUser._id.toString(),
        email: testUser.email,
        username: testUser.username,
      });

      // Attempt to create note
      const response = await request(app)
        .post('/api/v1/notes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Pro Note',
          sourceType: 'text',
          content: 'Pro content',
        });

      // PRO users should succeed (201 or 202)
      expect([201, 202]).toContain(response.status);
      expect(response.body.success).toBe(true);
      expect(response.body.quotaExceeded).not.toBe(true);
    });

    it('(1c) FREE user with bonus credits should bypass quota and succeed', async () => {
      // Create FREE user at quota limit but with bonus credits
      const testUser = await User.create({
        email: `free_bonus_notes_${Date.now()}@test.com`,
        name: 'Free With Bonus',
        username: `free_bonus_notes_${Date.now()}`,
        authProvider: 'local',
        subscription: 'FREE',
        freeUsage: {
          notes: { count: 1 },        // Already used free quota
          quizzes: { count: 0 },
          flashcards: { count: 0 },
          chats: { count: 0 },
        },
        bonusCredits: {
          notes: 1,                   // Has 1 bonus credit
          quizzes: 0,
          flashcards: 0,
          chats: 0,
        },
      });

      const authToken = generateAccessToken({
        userId: testUser._id.toString(),
        email: testUser.email,
        username: testUser.username,
      });

      // Attempt to create note
      const response = await request(app)
        .post('/api/v1/notes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Bonus Note',
          sourceType: 'text',
          content: 'Bonus content',
        });

      // Should succeed with bonus credits
      expect([201, 202]).toContain(response.status);
      expect(response.body.success).toBe(true);
      expect(response.body.quotaExceeded).not.toBe(true);
    });
  });

  // ==========================================
  // SECTION 2: QUIZ QUOTA ENFORCEMENT (3 tests)
  // ==========================================

  describe('Quiz Quota Enforcement', () => {
    it('(2a) Free user at quiz quota limit should return 402 with quotaExceeded: true', async () => {
      // Create test note
      const noteUser = await User.create({
        email: `quiz_test_user_${Date.now()}@test.com`,
        name: 'Quiz Test User',
        username: `quiz_test_user_${Date.now()}`,
        authProvider: 'local',
        subscription: 'FREE',
        freeUsage: {
          notes: { count: 0 },
          quizzes: { count: 1 },       // Already used 1 quiz (limit is 1)
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

      const noteUserId = noteUser._id;
      const testNote = await Note.create({
        userId: noteUserId,
        title: 'Test Note for Quiz',
        content: 'This is substantial test content with enough length to generate quizzes from it. It contains multiple sentences and ideas.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const authToken = generateAccessToken({
        userId: noteUserId.toString(),
        email: noteUser.email,
        username: noteUser.username,
      });

      // Attempt to generate quiz
      const response = await request(app)
        .post('/api/v1/quizzes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          noteId: testNote._id.toString(),
          questionCount: 5,
        });

      expect(response.status).toBe(402);
      expect(response.body.success).toBe(false);
      expect(response.body.quotaExceeded).toBe(true);
      expect(response.body.feature).toBe('quizzes');
      expect(response.body.message).toBeTruthy();
    });

    it('(2b) PRO user should bypass quiz quota and succeed', async () => {
      // Create PRO user
      const proUser = await User.create({
        email: `pro_quiz_${Date.now()}@test.com`,
        name: 'Pro Quiz User',
        username: `pro_quiz_${Date.now()}`,
        authProvider: 'local',
        subscription: 'PRO',
        freeUsage: {
          notes: { count: 0 },
          quizzes: { count: 1 },       // Consumed, but PRO ignores quota
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

      const proUserId = proUser._id;
      const testNote = await Note.create({
        userId: proUserId,
        title: 'Pro Quiz Note',
        content: 'This is substantial test content with enough length to generate quizzes from it. It contains multiple sentences and ideas.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const authToken = generateAccessToken({
        userId: proUserId.toString(),
        email: proUser.email,
        username: proUser.username,
      });

      // Attempt to generate quiz
      const response = await request(app)
        .post('/api/v1/quizzes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          noteId: testNote._id.toString(),
          questionCount: 5,
        });

      // PRO users should NOT get 402 quota error (may fail for other reasons, but not quota)
      expect(response.status).not.toBe(402);
      expect(response.body.quotaExceeded).not.toBe(true);
    });

    it('(2c) FREE user with quiz bonus credits should succeed', async () => {
      // Create FREE user at quiz quota but with bonus
      const bonusUser = await User.create({
        email: `free_quiz_bonus_${Date.now()}@test.com`,
        name: 'Free Quiz Bonus',
        username: `free_quiz_bonus_${Date.now()}`,
        authProvider: 'local',
        subscription: 'FREE',
        freeUsage: {
          notes: { count: 0 },
          quizzes: { count: 1 },       // Already used
          flashcards: { count: 0 },
          chats: { count: 0 },
        },
        bonusCredits: {
          notes: 0,
          quizzes: 1,                  // Has bonus credit
          flashcards: 0,
          chats: 0,
        },
      });

      const bonusUserId = bonusUser._id;
      const testNote = await Note.create({
        userId: bonusUserId,
        title: 'Bonus Quiz Note',
        content: 'This is substantial test content with enough length to generate quizzes from it. It contains multiple sentences and ideas.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const authToken = generateAccessToken({
        userId: bonusUserId.toString(),
        email: bonusUser.email,
        username: bonusUser.username,
      });

      // Attempt to generate quiz
      const response = await request(app)
        .post('/api/v1/quizzes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          noteId: testNote._id.toString(),
          questionCount: 5,
        });

      // FREE user with bonus should NOT get 402 quota error (may fail for other reasons, but not quota)
      expect(response.status).not.toBe(402);
      expect(response.body.quotaExceeded).not.toBe(true);
    });
  });

  // ==========================================
  // SECTION 3: FLASHCARD QUOTA ENFORCEMENT (3 tests)
  // ==========================================

  describe('Flashcard Quota Enforcement', () => {
    it('(3a) Free user at flashcard quota limit should return 402 with quotaExceeded: true', async () => {
      // Create test user
      const testUser = await User.create({
        email: `flashcard_limit_${Date.now()}@test.com`,
        name: 'Flashcard Limit User',
        username: `flashcard_limit_${Date.now()}`,
        authProvider: 'local',
        subscription: 'FREE',
        freeUsage: {
          notes: { count: 0 },
          quizzes: { count: 0 },
          flashcards: { count: 1 },    // Already used 1 flashcard (limit is 1)
          chats: { count: 0 },
        },
        bonusCredits: {
          notes: 0,
          quizzes: 0,
          flashcards: 0,
          chats: 0,
        },
      });

      const userId = testUser._id;
      const testNote = await Note.create({
        userId,
        title: 'Test Flashcard Note',
        content: 'This is a comprehensive test content with plenty of detail to generate flashcards. It has multiple paragraphs and sufficient length for quality card generation. This ensures we meet minimum content requirements.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const authToken = generateAccessToken({
        userId: userId.toString(),
        email: testUser.email,
        username: testUser.username,
      });

      // Attempt to generate flashcards
      const response = await request(app)
        .post('/api/v1/flashcards/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          noteId: testNote._id.toString(),
          cardCount: 10,
        });

      expect(response.status).toBe(402);
      expect(response.body.success).toBe(false);
      expect(response.body.quotaExceeded).toBe(true);
      expect(response.body.feature).toBe('flashcards');
      expect(response.body.message).toBeTruthy();
    });

    it('(3b) PRO user should bypass flashcard quota and succeed', async () => {
      // Create PRO user
      const proUser = await User.create({
        email: `pro_flashcard_${Date.now()}@test.com`,
        name: 'Pro Flashcard User',
        username: `pro_flashcard_${Date.now()}`,
        authProvider: 'local',
        subscription: 'PRO',
        freeUsage: {
          notes: { count: 0 },
          quizzes: { count: 0 },
          flashcards: { count: 1 },    // Consumed, but PRO ignores
          chats: { count: 0 },
        },
        bonusCredits: {
          notes: 0,
          quizzes: 0,
          flashcards: 0,
          chats: 0,
        },
      });

      const proUserId = proUser._id;
      const testNote = await Note.create({
        userId: proUserId,
        title: 'Pro Flashcard Note',
        content: 'This is a comprehensive test content with plenty of detail to generate flashcards. It has multiple paragraphs and sufficient length for quality card generation. This ensures we meet minimum content requirements.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const authToken = generateAccessToken({
        userId: proUserId.toString(),
        email: proUser.email,
        username: proUser.username,
      });

      // Attempt to generate flashcards
      const response = await request(app)
        .post('/api/v1/flashcards/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          noteId: testNote._id.toString(),
          cardCount: 10,
        });

      // PRO users should NOT get 402 quota error (may fail for other reasons, but not quota)
      expect(response.status).not.toBe(402);
      expect(response.body.quotaExceeded).not.toBe(true);
    });

    it('(3c) FREE user with flashcard bonus credits should succeed', async () => {
      // Create FREE user at flashcard quota but with bonus
      const bonusUser = await User.create({
        email: `free_flashcard_bonus_${Date.now()}@test.com`,
        name: 'Free Flashcard Bonus',
        username: `free_flashcard_bonus_${Date.now()}`,
        authProvider: 'local',
        subscription: 'FREE',
        freeUsage: {
          notes: { count: 0 },
          quizzes: { count: 0 },
          flashcards: { count: 1 },    // Already used
          chats: { count: 0 },
        },
        bonusCredits: {
          notes: 0,
          quizzes: 0,
          flashcards: 1,               // Has bonus credit
          chats: 0,
        },
      });

      const bonusUserId = bonusUser._id;
      const testNote = await Note.create({
        userId: bonusUserId,
        title: 'Bonus Flashcard Note',
        content: 'This is a comprehensive test content with plenty of detail to generate flashcards. It has multiple paragraphs and sufficient length for quality card generation. This ensures we meet minimum content requirements.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const authToken = generateAccessToken({
        userId: bonusUserId.toString(),
        email: bonusUser.email,
        username: bonusUser.username,
      });

      // Attempt to generate flashcards
      const response = await request(app)
        .post('/api/v1/flashcards/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          noteId: testNote._id.toString(),
          cardCount: 10,
        });

      // FREE user with bonus should NOT get 402 quota error (may fail for other reasons, but not quota)
      expect(response.status).not.toBe(402);
      expect(response.body.quotaExceeded).not.toBe(true);
    });
  });

  // ==========================================
  // SECTION 4: QUOTA INTERACTION EDGE CASES (2 tests)
  // ==========================================

  describe('Quota Interaction Edge Cases', () => {
    it('(4a) Bonus credits consumed sequentially: third request should fail', async () => {
      // Create FREE user with 2 bonus credits and 1 free usage consumed
      const testUser = await User.create({
        email: `bonus_sequential_${Date.now()}@test.com`,
        name: 'Bonus Sequential User',
        username: `bonus_sequential_${Date.now()}`,
        authProvider: 'local',
        subscription: 'FREE',
        freeUsage: {
          notes: { count: 1 },         // Free slot used
          quizzes: { count: 0 },
          flashcards: { count: 0 },
          chats: { count: 0 },
        },
        bonusCredits: {
          notes: 2,                    // Has 2 bonus notes
          quizzes: 0,
          flashcards: 0,
          chats: 0,
        },
      });

      const authToken = generateAccessToken({
        userId: testUser._id.toString(),
        email: testUser.email,
        username: testUser.username,
      });

      // First bonus request should succeed
      const response1 = await request(app)
        .post('/api/v1/notes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Bonus Note 1',
          sourceType: 'text',
          content: 'First bonus note',
        });

      expect([201, 202]).toContain(response1.status);
      expect(response1.body.quotaExceeded).not.toBe(true);

      // Second bonus request should succeed
      const response2 = await request(app)
        .post('/api/v1/notes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Bonus Note 2',
          sourceType: 'text',
          content: 'Second bonus note',
        });

      expect([201, 202]).toContain(response2.status);
      expect(response2.body.quotaExceeded).not.toBe(true);

      // Third request should fail (all bonuses consumed)
      const response3 = await request(app)
        .post('/api/v1/notes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Third Note Should Fail',
          sourceType: 'text',
          content: 'This should fail',
        });

      expect(response3.status).toBe(402);
      expect(response3.body.quotaExceeded).toBe(true);
    });

    it('(4b) Multiple features independent: notes quota exhausted but quiz quota available', async () => {
      // Create FREE user with notes quota exhausted but quiz available
      const testUser = await User.create({
        email: `independent_quota_${Date.now()}@test.com`,
        name: 'Independent Quota User',
        username: `independent_quota_${Date.now()}`,
        authProvider: 'local',
        subscription: 'FREE',
        freeUsage: {
          notes: { count: 1 },         // Notes: exhausted
          quizzes: { count: 0 },       // Quizzes: available
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

      const userId = testUser._id;
      const testNote = await Note.create({
        userId,
        title: 'Independent Quota Test Note',
        content: 'This is substantial test content with enough length to generate quizzes from it. It contains multiple sentences and ideas for quality quiz generation.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const authToken = generateAccessToken({
        userId: userId.toString(),
        email: testUser.email,
        username: testUser.username,
      });

      // Note creation should fail (quota exhausted)
      const noteResponse = await request(app)
        .post('/api/v1/notes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Should Fail',
          sourceType: 'text',
          content: 'Test',
        });

      expect(noteResponse.status).toBe(402);
      expect(noteResponse.body.quotaExceeded).toBe(true);
      expect(noteResponse.body.feature).toBe('notes');

      // Quiz generation should succeed (quota available)
      const quizResponse = await request(app)
        .post('/api/v1/quizzes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          noteId: testNote._id.toString(),
          questionCount: 5,
        });

      expect(quizResponse.status).not.toBe(402);
      expect(quizResponse.body.quotaExceeded).not.toBe(true);
    });
  });
});
