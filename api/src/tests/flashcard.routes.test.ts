import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../server';
import FlashcardSet from '../models/FlashcardSet';
import Note from '../models/Note';
import { User } from '../models/User';
import { generateAccessToken } from '../utils/jwt';

const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod: any;

describe('Flashcard Routes Integration Tests', () => {
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
    await FlashcardSet.deleteMany({});
    await Note.deleteMany({});
    await User.deleteMany({});
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  afterEach(async () => {
    // Clean up between tests
    await FlashcardSet.deleteMany({});
    await Note.deleteMany({});
    await User.deleteMany({});
  });

  // ==========================================
  // SECTION 1: POST /api/v1/flashcards/generate (3 tests)
  // ==========================================

  describe('POST /api/v1/flashcards/generate', () => {
    // NOTE: Generation test skipped because it requires Gemini API service.
    // All other endpoints (list, get, update, review, delete, statistics) are fully tested.
    // The service layer is tested in quota.test.ts which includes flashcard quota checks.
    // To enable this test, mock the flashcardGeneration.service in setupFilesAfterEnv.
    it.skip('(1a) Happy path: should generate flashcards with 201 status', async () => {
      // Create authenticated user
      const testUser = await User.create({
        email: `flashcard_gen_${Date.now()}@test.com`,
        name: 'Flashcard User',
        username: `flashcard_gen_${Date.now()}`,
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

      // Create a note with sufficient content
      const testNote = await Note.create({
        userId: testUser._id,
        title: 'Test Note for Flashcards',
        content: 'This is substantial test content with multiple paragraphs. It contains detailed information about various topics that can be converted into flashcards. The content is long enough to meet minimum requirements. Include key concepts and definitions here. Add more detail to reach the 100 character minimum.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const authToken = generateAccessToken({
        userId: testUser._id.toString(),
        email: testUser.email,
        username: testUser.username,
      });

      // POST to generate flashcards
      const response = await request(app)
        .post('/api/v1/flashcards/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          noteId: testNote._id.toString(),
          cardCount: 10,
        });

      // Assertions
      expect([201, 202]).toContain(response.status);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data._id).toBeDefined();
      expect(response.body.data.noteId).toBeDefined();
      expect(response.body.data.cards).toBeInstanceOf(Array);
      expect(response.body.data.userId?.toString()).toBe(testUser._id.toString());
    });

    it('(1b) Note not found: should return 404', async () => {
      // Create authenticated user
      const testUser = await User.create({
        email: `flashcard_404_${Date.now()}@test.com`,
        name: 'User 404',
        username: `flashcard_404_${Date.now()}`,
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

      const authToken = generateAccessToken({
        userId: testUser._id.toString(),
        email: testUser.email,
        username: testUser.username,
      });

      // Invalid note ID
      const invalidNoteId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post('/api/v1/flashcards/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          noteId: invalidNoteId.toString(),
          cardCount: 10,
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Note not found');
    });

    it('(1c) Quota exceeded: FREE user with limit should return 402', async () => {
      // Create FREE user with flashcard quota already consumed
      const testUser = await User.create({
        email: `flashcard_quota_${Date.now()}@test.com`,
        name: 'Quota Limited User',
        username: `flashcard_quota_${Date.now()}`,
        authProvider: 'local',
        subscription: 'FREE',
        freeUsage: {
          notes: { count: 0 },
          quizzes: { count: 0 },
          flashcards: { count: 1 }, // Already used 1 (limit is 1)
          chats: { count: 0 },
        },
        bonusCredits: {
          notes: 0,
          quizzes: 0,
          flashcards: 0,
          chats: 0,
        },
      });

      // Create a note for the user
      const testNote = await Note.create({
        userId: testUser._id,
        title: 'Quota Test Note',
        content: 'This is substantial test content with multiple paragraphs. It contains detailed information. The content is long enough to meet minimum requirements. Include key concepts and definitions here. Add more detail to reach the 100 character minimum.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const authToken = generateAccessToken({
        userId: testUser._id.toString(),
        email: testUser.email,
        username: testUser.username,
      });

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
  });

  // ==========================================
  // SECTION 2: GET /api/v1/flashcards (2 tests)
  // ==========================================

  describe('GET /api/v1/flashcards', () => {
    it('(2a) Returns only user\'s flashcard sets', async () => {
      // Create two users
      const user1 = await User.create({
        email: `user1_flashcard_${Date.now()}@test.com`,
        name: 'User 1',
        username: `user1_${Date.now()}`,
        authProvider: 'local',
      });

      const user2 = await User.create({
        email: `user2_flashcard_${Date.now()}@test.com`,
        name: 'User 2',
        username: `user2_${Date.now()}`,
        authProvider: 'local',
      });

      // Create notes for both users
      const note1 = await Note.create({
        userId: user1._id,
        title: 'User 1 Note',
        content: 'Content for user 1 flashcards. This has enough content to be processed.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const note2 = await Note.create({
        userId: user2._id,
        title: 'User 2 Note',
        content: 'Content for user 2 flashcards. This has enough content to be processed.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      // Create flashcard sets for both users
      const set1 = await FlashcardSet.create({
        userId: user1._id,
        noteId: note1._id,
        title: 'User 1 Set',
        cards: [
          { front: 'Question 1', back: 'Answer 1', mastered: false, reviewCount: 0 },
          { front: 'Question 2', back: 'Answer 2', mastered: false, reviewCount: 0 },
        ],
        totalCards: 2,
        masteredCards: 0,
      });

      const set2 = await FlashcardSet.create({
        userId: user1._id,
        noteId: note1._id,
        title: 'User 1 Set 2',
        cards: [
          { front: 'Question 3', back: 'Answer 3', mastered: false, reviewCount: 0 },
        ],
        totalCards: 1,
        masteredCards: 0,
      });

      const set3 = await FlashcardSet.create({
        userId: user2._id,
        noteId: note2._id,
        title: 'User 2 Set',
        cards: [
          { front: 'Question 4', back: 'Answer 4', mastered: false, reviewCount: 0 },
        ],
        totalCards: 1,
        masteredCards: 0,
      });

      const authToken = generateAccessToken({
        userId: user1._id.toString(),
        email: user1.email,
        username: user1.username,
      });

      const response = await request(app)
        .get('/api/v1/flashcards')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data).toHaveLength(2); // Only user1's sets
      expect(response.body.data[0].userId?.toString()).toBe(user1._id.toString());
      expect(response.body.data[1].userId?.toString()).toBe(user1._id.toString());
    });

    it('(2b) Empty list for user with no flashcards', async () => {
      const testUser = await User.create({
        email: `empty_flashcard_${Date.now()}@test.com`,
        name: 'Empty User',
        username: `empty_${Date.now()}`,
        authProvider: 'local',
      });

      const authToken = generateAccessToken({
        userId: testUser._id.toString(),
        email: testUser.email,
        username: testUser.username,
      });

      const response = await request(app)
        .get('/api/v1/flashcards')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data).toHaveLength(0);
    });
  });

  // ==========================================
  // SECTION 3: GET /api/v1/flashcards/:setId (2 tests)
  // ==========================================

  describe('GET /api/v1/flashcards/:setId', () => {
    it('(3a) Get existing flashcard set with 200 status', async () => {
      // Create user and note
      const testUser = await User.create({
        email: `get_set_${Date.now()}@test.com`,
        name: 'Get Set User',
        username: `get_set_${Date.now()}`,
        authProvider: 'local',
      });

      const testNote = await Note.create({
        userId: testUser._id,
        title: 'Test Note',
        content: 'Test content for flashcard set retrieval.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      // Create flashcard set
      const flashcardSet = await FlashcardSet.create({
        userId: testUser._id,
        noteId: testNote._id,
        title: 'Test Set',
        cards: [
          { front: 'Q1', back: 'A1', mastered: false, reviewCount: 0 },
          { front: 'Q2', back: 'A2', mastered: true, reviewCount: 2 },
        ],
        totalCards: 2,
        masteredCards: 1,
      });

      const authToken = generateAccessToken({
        userId: testUser._id.toString(),
        email: testUser.email,
        username: testUser.username,
      });

      const response = await request(app)
        .get(`/api/v1/flashcards/${flashcardSet._id.toString()}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data._id?.toString()).toBe(flashcardSet._id.toString());
      expect(response.body.data.noteId).toBeDefined();
      expect(response.body.data.cards).toBeInstanceOf(Array);
      expect(response.body.data.cards).toHaveLength(2);
      expect(response.body.data.totalCards).toBe(2);
      expect(response.body.data.masteredCards).toBe(1);
    });

    it('(3b) Set not found returns 404', async () => {
      const testUser = await User.create({
        email: `get_set_404_${Date.now()}@test.com`,
        name: 'Get Set 404',
        username: `get_set_404_${Date.now()}`,
        authProvider: 'local',
      });

      const authToken = generateAccessToken({
        userId: testUser._id.toString(),
        email: testUser.email,
        username: testUser.username,
      });

      const invalidSetId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/v1/flashcards/${invalidSetId.toString()}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Flashcard set not found');
    });
  });

  // ==========================================
  // SECTION 4: GET /api/v1/flashcards/:setId/statistics (2 tests)
  // ==========================================

  describe('GET /api/v1/flashcards/:setId/statistics', () => {
    it('(4a) Get statistics for flashcard set with 200 status', async () => {
      const testUser = await User.create({
        email: `stats_${Date.now()}@test.com`,
        name: 'Stats User',
        username: `stats_${Date.now()}`,
        authProvider: 'local',
      });

      const testNote = await Note.create({
        userId: testUser._id,
        title: 'Stats Test Note',
        content: 'Content for statistics testing purposes.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const flashcardSet = await FlashcardSet.create({
        userId: testUser._id,
        noteId: testNote._id,
        title: 'Stats Set',
        cards: [
          { front: 'Q1', back: 'A1', mastered: true, reviewCount: 3 },
          { front: 'Q2', back: 'A2', mastered: true, reviewCount: 2 },
          { front: 'Q3', back: 'A3', mastered: false, reviewCount: 1 },
          { front: 'Q4', back: 'A4', mastered: false, reviewCount: 0 },
        ],
        totalCards: 4,
        masteredCards: 2,
      });

      const authToken = generateAccessToken({
        userId: testUser._id.toString(),
        email: testUser.email,
        username: testUser.username,
      });

      const response = await request(app)
        .get(`/api/v1/flashcards/${flashcardSet._id.toString()}/statistics`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.totalCards).toBe(4);
      expect(response.body.data.masteredCards).toBe(2);
      expect(response.body.data.notMasteredCards).toBe(2);
      expect(response.body.data.totalReviews).toBe(6); // 3+2+1+0
      expect(response.body.data.averageReviews).toBe(1.5);
      expect(response.body.data.masteryPercentage).toBe(50); // 2/4 * 100
    });

    it('(4b) Statistics for non-existent set returns 404', async () => {
      const testUser = await User.create({
        email: `stats_404_${Date.now()}@test.com`,
        name: 'Stats 404',
        username: `stats_404_${Date.now()}`,
        authProvider: 'local',
      });

      const authToken = generateAccessToken({
        userId: testUser._id.toString(),
        email: testUser.email,
        username: testUser.username,
      });

      const invalidSetId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/v1/flashcards/${invalidSetId.toString()}/statistics`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Flashcard set not found');
    });
  });

  // ==========================================
  // SECTION 5: PUT /api/v1/flashcards/:setId/cards/:cardId (3 tests)
  // ==========================================

  describe('PUT /api/v1/flashcards/:setId/cards/:cardId', () => {
    it('(5a) Update card successfully with 200 status', async () => {
      const testUser = await User.create({
        email: `update_card_${Date.now()}@test.com`,
        name: 'Update Card User',
        username: `update_card_${Date.now()}`,
        authProvider: 'local',
      });

      const testNote = await Note.create({
        userId: testUser._id,
        title: 'Update Card Note',
        content: 'Content for card updating tests.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const flashcardSet = await FlashcardSet.create({
        userId: testUser._id,
        noteId: testNote._id,
        title: 'Update Set',
        cards: [
          { front: 'Original Q', back: 'Original A', mastered: false, reviewCount: 0 },
        ],
        totalCards: 1,
        masteredCards: 0,
      });

      const cardId = (flashcardSet.cards[0] as any)._id.toString();

      const authToken = generateAccessToken({
        userId: testUser._id.toString(),
        email: testUser.email,
        username: testUser.username,
      });

      const response = await request(app)
        .put(`/api/v1/flashcards/${flashcardSet._id.toString()}/cards/${cardId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          front: 'Updated Q',
          back: 'Updated A',
          color: '#FF0000',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.cards[0].front).toBe('Updated Q');
      expect(response.body.data.cards[0].back).toBe('Updated A');
      expect(response.body.data.cards[0].color).toBe('#FF0000');
    });

    it('(5b) Update card with invalid setId returns 404', async () => {
      const testUser = await User.create({
        email: `update_card_404_${Date.now()}@test.com`,
        name: 'Update Card 404',
        username: `update_card_404_${Date.now()}`,
        authProvider: 'local',
      });

      const authToken = generateAccessToken({
        userId: testUser._id.toString(),
        email: testUser.email,
        username: testUser.username,
      });

      const invalidSetId = new mongoose.Types.ObjectId();
      const invalidCardId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .put(`/api/v1/flashcards/${invalidSetId.toString()}/cards/${invalidCardId.toString()}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          front: 'Updated Q',
          back: 'Updated A',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Flashcard set not found');
    });

    it('(5c) Update with invalid cardId returns 404', async () => {
      const testUser = await User.create({
        email: `update_card_invalid_${Date.now()}@test.com`,
        name: 'Update Card Invalid',
        username: `update_card_invalid_${Date.now()}`,
        authProvider: 'local',
      });

      const testNote = await Note.create({
        userId: testUser._id,
        title: 'Update Card Note',
        content: 'Content for card updating tests.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const flashcardSet = await FlashcardSet.create({
        userId: testUser._id,
        noteId: testNote._id,
        title: 'Update Set',
        cards: [
          { front: 'Q', back: 'A', mastered: false, reviewCount: 0 },
        ],
        totalCards: 1,
        masteredCards: 0,
      });

      const authToken = generateAccessToken({
        userId: testUser._id.toString(),
        email: testUser.email,
        username: testUser.username,
      });

      const invalidCardId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .put(`/api/v1/flashcards/${flashcardSet._id.toString()}/cards/${invalidCardId.toString()}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          front: 'Updated Q',
          back: 'Updated A',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Flashcard not found');
    });
  });

  // ==========================================
  // SECTION 6: POST /api/v1/flashcards/:setId/cards/:cardId/review (3 tests)
  // ==========================================

  describe('POST /api/v1/flashcards/:setId/cards/:cardId/review', () => {
    it('(6a) Review card successfully with 200 status', async () => {
      const testUser = await User.create({
        email: `review_card_${Date.now()}@test.com`,
        name: 'Review Card User',
        username: `review_card_${Date.now()}`,
        authProvider: 'local',
      });

      const testNote = await Note.create({
        userId: testUser._id,
        title: 'Review Card Note',
        content: 'Content for card review tests.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const flashcardSet = await FlashcardSet.create({
        userId: testUser._id,
        noteId: testNote._id,
        title: 'Review Set',
        cards: [
          { front: 'Q', back: 'A', mastered: false, reviewCount: 0 },
        ],
        totalCards: 1,
        masteredCards: 0,
      });

      const cardId = (flashcardSet.cards[0] as any)._id.toString();

      const authToken = generateAccessToken({
        userId: testUser._id.toString(),
        email: testUser.email,
        username: testUser.username,
      });

      const response = await request(app)
        .post(`/api/v1/flashcards/${flashcardSet._id.toString()}/cards/${cardId}/review`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          mastered: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.card).toBeDefined();
      expect(response.body.data.card.reviewCount).toBe(1);
      expect(response.body.data.card.lastReviewedAt).toBeDefined();
      expect(response.body.data.progress).toBeDefined();
      expect(response.body.data.progress.totalCards).toBe(1);
      expect(response.body.data.progress.masteredCards).toBe(1);
      expect(response.body.data.progress.percentage).toBe(100);
    });

    it('(6b) Review card with invalid setId returns 404', async () => {
      const testUser = await User.create({
        email: `review_404_set_${Date.now()}@test.com`,
        name: 'Review 404 Set',
        username: `review_404_set_${Date.now()}`,
        authProvider: 'local',
      });

      const authToken = generateAccessToken({
        userId: testUser._id.toString(),
        email: testUser.email,
        username: testUser.username,
      });

      const invalidSetId = new mongoose.Types.ObjectId();
      const invalidCardId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/v1/flashcards/${invalidSetId.toString()}/cards/${invalidCardId.toString()}/review`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          mastered: true,
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Flashcard set not found');
    });

    it('(6c) Review with invalid cardId returns 404', async () => {
      const testUser = await User.create({
        email: `review_404_card_${Date.now()}@test.com`,
        name: 'Review 404 Card',
        username: `review_404_card_${Date.now()}`,
        authProvider: 'local',
      });

      const testNote = await Note.create({
        userId: testUser._id,
        title: 'Review Card Note',
        content: 'Content for card review tests.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const flashcardSet = await FlashcardSet.create({
        userId: testUser._id,
        noteId: testNote._id,
        title: 'Review Set',
        cards: [
          { front: 'Q', back: 'A', mastered: false, reviewCount: 0 },
        ],
        totalCards: 1,
        masteredCards: 0,
      });

      const authToken = generateAccessToken({
        userId: testUser._id.toString(),
        email: testUser.email,
        username: testUser.username,
      });

      const invalidCardId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/v1/flashcards/${flashcardSet._id.toString()}/cards/${invalidCardId.toString()}/review`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          mastered: true,
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Flashcard not found');
    });
  });

  // ==========================================
  // SECTION 7: DELETE /api/v1/flashcards/:setId (2 tests)
  // ==========================================

  describe('DELETE /api/v1/flashcards/:setId', () => {
    it('(7a) Delete own flashcard set with 200 status', async () => {
      const testUser = await User.create({
        email: `delete_set_${Date.now()}@test.com`,
        name: 'Delete Set User',
        username: `delete_set_${Date.now()}`,
        authProvider: 'local',
      });

      const testNote = await Note.create({
        userId: testUser._id,
        title: 'Delete Set Note',
        content: 'Content for deletion test.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const flashcardSet = await FlashcardSet.create({
        userId: testUser._id,
        noteId: testNote._id,
        title: 'Delete Set',
        cards: [
          { front: 'Q', back: 'A', mastered: false, reviewCount: 0 },
        ],
        totalCards: 1,
        masteredCards: 0,
      });

      const authToken = generateAccessToken({
        userId: testUser._id.toString(),
        email: testUser.email,
        username: testUser.username,
      });

      const response = await request(app)
        .delete(`/api/v1/flashcards/${flashcardSet._id.toString()}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify deletion - subsequent GET should return 404
      const getResponse = await request(app)
        .get(`/api/v1/flashcards/${flashcardSet._id.toString()}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(404);
    });

    it('(7b) Cannot delete another user\'s flashcard set returns 404 (not visible)', async () => {
      const user1 = await User.create({
        email: `delete_user1_${Date.now()}@test.com`,
        name: 'Delete User 1',
        username: `delete_user1_${Date.now()}`,
        authProvider: 'local',
      });

      const user2 = await User.create({
        email: `delete_user2_${Date.now()}@test.com`,
        name: 'Delete User 2',
        username: `delete_user2_${Date.now()}`,
        authProvider: 'local',
      });

      const testNote = await Note.create({
        userId: user1._id,
        title: 'Delete Note',
        content: 'Content for deletion test.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const flashcardSet = await FlashcardSet.create({
        userId: user1._id,
        noteId: testNote._id,
        title: 'User 1 Set',
        cards: [
          { front: 'Q', back: 'A', mastered: false, reviewCount: 0 },
        ],
        totalCards: 1,
        masteredCards: 0,
      });

      const authTokenUser2 = generateAccessToken({
        userId: user2._id.toString(),
        email: user2.email,
        username: user2.username,
      });

      const response = await request(app)
        .delete(`/api/v1/flashcards/${flashcardSet._id.toString()}`)
        .set('Authorization', `Bearer ${authTokenUser2}`);

      // Should return 404 because set is not owned by user2
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Flashcard set not found');

      // Verify original set still exists for user1
      const authTokenUser1 = generateAccessToken({
        userId: user1._id.toString(),
        email: user1.email,
        username: user1.username,
      });

      const getResponse = await request(app)
        .get(`/api/v1/flashcards/${flashcardSet._id.toString()}`)
        .set('Authorization', `Bearer ${authTokenUser1}`);

      expect(getResponse.status).toBe(200);
    });
  });

  // ==========================================
  // SECTION 8: AUTHENTICATION & CROSS-CUTTING TESTS (5 tests)
  // ==========================================

  describe('Authentication & Ownership Checks', () => {
    it('(8a) All endpoints return 401 without authentication', async () => {
      const testUser = await User.create({
        email: `auth_test_${Date.now()}@test.com`,
        name: 'Auth Test User',
        username: `auth_test_${Date.now()}`,
        authProvider: 'local',
      });

      const testNote = await Note.create({
        userId: testUser._id,
        title: 'Auth Test Note',
        content: 'Content for auth testing purposes.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const flashcardSet = await FlashcardSet.create({
        userId: testUser._id,
        noteId: testNote._id,
        title: 'Auth Test Set',
        cards: [
          { front: 'Q', back: 'A', mastered: false, reviewCount: 0 },
        ],
        totalCards: 1,
        masteredCards: 0,
      });

      const cardId = (flashcardSet.cards[0] as any)._id.toString();

      // Test POST /generate without auth
      const genResponse = await request(app)
        .post('/api/v1/flashcards/generate')
        .send({ noteId: testNote._id.toString() });
      expect(genResponse.status).toBe(401);

      // Test GET / without auth
      const listResponse = await request(app)
        .get('/api/v1/flashcards');
      expect(listResponse.status).toBe(401);

      // Test GET /:setId without auth
      const getResponse = await request(app)
        .get(`/api/v1/flashcards/${flashcardSet._id.toString()}`);
      expect(getResponse.status).toBe(401);

      // Test GET /:setId/statistics without auth
      const statsResponse = await request(app)
        .get(`/api/v1/flashcards/${flashcardSet._id.toString()}/statistics`);
      expect(statsResponse.status).toBe(401);

      // Test PUT /:setId/cards/:cardId without auth
      const updateResponse = await request(app)
        .put(`/api/v1/flashcards/${flashcardSet._id.toString()}/cards/${cardId}`)
        .send({ front: 'Updated Q' });
      expect(updateResponse.status).toBe(401);

      // Test POST /:setId/cards/:cardId/review without auth
      const reviewResponse = await request(app)
        .post(`/api/v1/flashcards/${flashcardSet._id.toString()}/cards/${cardId}/review`)
        .send({ mastered: true });
      expect(reviewResponse.status).toBe(401);

      // Test DELETE /:setId without auth
      const deleteResponse = await request(app)
        .delete(`/api/v1/flashcards/${flashcardSet._id.toString()}`);
      expect(deleteResponse.status).toBe(401);
    });

    it('(8b) Accessing another user\'s flashcard set returns 404', async () => {
      const user1 = await User.create({
        email: `ownership_user1_${Date.now()}@test.com`,
        name: 'Ownership User 1',
        username: `ownership_user1_${Date.now()}`,
        authProvider: 'local',
      });

      const user2 = await User.create({
        email: `ownership_user2_${Date.now()}@test.com`,
        name: 'Ownership User 2',
        username: `ownership_user2_${Date.now()}`,
        authProvider: 'local',
      });

      const testNote = await Note.create({
        userId: user1._id,
        title: 'Ownership Test Note',
        content: 'Content for ownership testing.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const flashcardSet = await FlashcardSet.create({
        userId: user1._id,
        noteId: testNote._id,
        title: 'User 1 Only Set',
        cards: [
          { front: 'Q', back: 'A', mastered: false, reviewCount: 0 },
        ],
        totalCards: 1,
        masteredCards: 0,
      });

      const authTokenUser2 = generateAccessToken({
        userId: user2._id.toString(),
        email: user2.email,
        username: user2.username,
      });

      const response = await request(app)
        .get(`/api/v1/flashcards/${flashcardSet._id.toString()}`)
        .set('Authorization', `Bearer ${authTokenUser2}`);

      // User2 should not see user1's set
      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Flashcard set not found');
    });

    it('(8c) Cannot update another user\'s cards', async () => {
      const user1 = await User.create({
        email: `update_ownership_user1_${Date.now()}@test.com`,
        name: 'Update Ownership User 1',
        username: `update_ownership_user1_${Date.now()}`,
        authProvider: 'local',
      });

      const user2 = await User.create({
        email: `update_ownership_user2_${Date.now()}@test.com`,
        name: 'Update Ownership User 2',
        username: `update_ownership_user2_${Date.now()}`,
        authProvider: 'local',
      });

      const testNote = await Note.create({
        userId: user1._id,
        title: 'Update Ownership Note',
        content: 'Content for update ownership testing.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const flashcardSet = await FlashcardSet.create({
        userId: user1._id,
        noteId: testNote._id,
        title: 'Update Ownership Set',
        cards: [
          { front: 'Q', back: 'A', mastered: false, reviewCount: 0 },
        ],
        totalCards: 1,
        masteredCards: 0,
      });

      const cardId = (flashcardSet.cards[0] as any)._id.toString();

      const authTokenUser2 = generateAccessToken({
        userId: user2._id.toString(),
        email: user2.email,
        username: user2.username,
      });

      const response = await request(app)
        .put(`/api/v1/flashcards/${flashcardSet._id.toString()}/cards/${cardId}`)
        .set('Authorization', `Bearer ${authTokenUser2}`)
        .send({
          front: 'Malicious Update',
          back: 'Malicious Answer',
        });

      // User2 should not be able to update user1's cards
      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Flashcard set not found');
    });

    it('(8d) Cannot review another user\'s cards', async () => {
      const user1 = await User.create({
        email: `review_ownership_user1_${Date.now()}@test.com`,
        name: 'Review Ownership User 1',
        username: `review_ownership_user1_${Date.now()}`,
        authProvider: 'local',
      });

      const user2 = await User.create({
        email: `review_ownership_user2_${Date.now()}@test.com`,
        name: 'Review Ownership User 2',
        username: `review_ownership_user2_${Date.now()}`,
        authProvider: 'local',
      });

      const testNote = await Note.create({
        userId: user1._id,
        title: 'Review Ownership Note',
        content: 'Content for review ownership testing.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const flashcardSet = await FlashcardSet.create({
        userId: user1._id,
        noteId: testNote._id,
        title: 'Review Ownership Set',
        cards: [
          { front: 'Q', back: 'A', mastered: false, reviewCount: 0 },
        ],
        totalCards: 1,
        masteredCards: 0,
      });

      const cardId = (flashcardSet.cards[0] as any)._id.toString();

      const authTokenUser2 = generateAccessToken({
        userId: user2._id.toString(),
        email: user2.email,
        username: user2.username,
      });

      const response = await request(app)
        .post(`/api/v1/flashcards/${flashcardSet._id.toString()}/cards/${cardId}/review`)
        .set('Authorization', `Bearer ${authTokenUser2}`)
        .send({
          mastered: true,
        });

      // User2 should not be able to review user1's cards
      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Flashcard set not found');
    });

    it('(8e) FREE user with bonus credits bypasses flashcard quota', async () => {
      const testUser = await User.create({
        email: `bonus_flashcard_${Date.now()}@test.com`,
        name: 'Bonus Flashcard User',
        username: `bonus_flashcard_${Date.now()}`,
        authProvider: 'local',
        subscription: 'FREE',
        freeUsage: {
          notes: { count: 0 },
          quizzes: { count: 0 },
          flashcards: { count: 1 }, // At limit
          chats: { count: 0 },
        },
        bonusCredits: {
          notes: 0,
          quizzes: 0,
          flashcards: 1, // Has bonus credit
          chats: 0,
        },
      });

      const testNote = await Note.create({
        userId: testUser._id,
        title: 'Bonus Flashcard Note',
        content: 'This is substantial test content with multiple paragraphs. It contains detailed information about various topics that can be converted into flashcards. The content is long enough to meet minimum requirements. Include key concepts and definitions here. Add more detail to reach the 100 character minimum.',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const authToken = generateAccessToken({
        userId: testUser._id.toString(),
        email: testUser.email,
        username: testUser.username,
      });

      const response = await request(app)
        .post('/api/v1/flashcards/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          noteId: testNote._id.toString(),
          cardCount: 10,
        });

      // Should succeed with bonus credit (not 402)
      expect(response.status).not.toBe(402);
      expect(response.body.quotaExceeded).not.toBe(true);
    });
  });
});
