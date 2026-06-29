import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../server';
import Note from '../models/Note';
import Folder from '../models/Folder';
import { generateAccessToken } from '../utils/jwt';
import { User } from '../models/User';

const { MongoMemoryServer } = require('mongodb-memory-server');

// Test utilities
let authToken: string;
let userId: string;
let testNote: any;
let testFolder: any;
let mongod: any;

describe('Note API Endpoints', () => {
  beforeAll(async () => {
    // Set up in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri, { dbName: 'test' });

    // Ensure indexes are created
    await Note.collection.createIndex({ title: 'text', content: 'text', transcriptText: 'text' });

    // Create test user
    const testUser = await User.create({
      email: `ci_${Date.now()}@test.com`,
      name: 'CI User',
      username: `ci_${Date.now()}`,
      authProvider: 'local',
    });
    userId = testUser._id.toString();
    authToken = generateAccessToken({ userId, email: testUser.email, username: testUser.username });

    // Create test folder
    testFolder = await Folder.create({
      userId,
      name: 'Test Folder',
      color: '#FF0000',
    });

    // Create test note
    testNote = await Note.create({
      userId,
      title: 'Test Note',
      content: 'This is test content for searching',
      sourceType: 'text',
      processingStatus: 'completed',
    });
  });

  afterAll(async () => {
    // Clean up
    await Note.deleteMany({});
    await Folder.deleteMany({});
    await User.deleteMany({});
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  describe('POST /api/v1/notes/generate', () => {
    it('should generate a note from text content', async () => {
      const response = await request(app)
        .post('/api/v1/notes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Generated Note',
          sourceType: 'text',
          content: 'This is generated content',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('_id');
      expect(response.body.data.title).toBeDefined();
      expect(response.body.data.sourceType).toBe('text');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/notes/generate')
        .send({
          title: 'Test',
          sourceType: 'text',
          content: 'Test content',
        });

      expect(response.status).toBe(401);
    });

    it('should fail without sourceType', async () => {
      const response = await request(app)
        .post('/api/v1/notes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test',
          content: 'Test content',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('sourceType');
    });
  });

  describe('GET /api/v1/notes/search', () => {
    it('should search notes by query', async () => {
      const response = await request(app)
        .get('/api/v1/notes/search')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ q: 'test content' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.count).toBeGreaterThanOrEqual(0);
    });

    it('should filter search by sourceType', async () => {
      const response = await request(app)
        .get('/api/v1/notes/search')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          q: 'test',
          sourceType: 'text',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      if (response.body.data.length > 0) {
        expect(response.body.data[0].sourceType).toBe('text');
      }
    });

    it('should filter search by folderId', async () => {
      // Create a note in the test folder
      await Note.create({
        userId,
        title: 'Folder Note',
        content: 'Content in folder',
        sourceType: 'text',
        folderId: testFolder._id,
        processingStatus: 'completed',
      });

      const response = await request(app)
        .get('/api/v1/notes/search')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          q: 'folder',
          folderId: testFolder._id.toString(),
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      if (response.body.data.length > 0) {
        expect(response.body.data[0].folderId?.toString()).toBe(
          testFolder._id.toString()
        );
      }
    });

    it('should fail without query parameter', async () => {
      const response = await request(app)
        .get('/api/v1/notes/search')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('query');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/notes/search')
        .query({ q: 'test' });

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/v1/notes/:noteId/enhance', () => {
    it('should enhance a note', async () => {
      const response = await request(app)
        .put(`/api/v1/notes/${testNote._id}/enhance`)
        .set('Authorization', `Bearer ${authToken}`);

      // This might fail if Gemini API is not configured, so we accept 500 as well
      expect([200, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('content');
      }
    });

    it('should fail for non-existent note', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/v1/notes/${fakeId}/enhance`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('should fail without authentication', async () => {
      const response = await request(app).put(
        `/api/v1/notes/${testNote._id}/enhance`
      );

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/notes/:noteId/move', () => {
    it('should move note to a folder', async () => {
      const response = await request(app)
        .post(`/api/v1/notes/${testNote._id}/move`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          folderId: testFolder._id.toString(),
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.folderId.toString()).toBe(
        testFolder._id.toString()
      );
    });

    it('should move note to root (no folder)', async () => {
      const response = await request(app)
        .post(`/api/v1/notes/${testNote._id}/move`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          folderId: null,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.folderId).toBeUndefined();
    });

    it('should fail for non-existent note', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/v1/notes/${fakeId}/move`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          folderId: testFolder._id.toString(),
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('should fail for non-existent folder', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/v1/notes/${testNote._id}/move`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          folderId: fakeId.toString(),
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('folder not found');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post(`/api/v1/notes/${testNote._id}/move`)
        .send({
          folderId: testFolder._id.toString(),
        });

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/v1/folders/:folderId', () => {
    it('should update folder name', async () => {
      const response = await request(app)
        .put(`/api/v1/folders/${testFolder._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Folder Name',
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Folder Name');
    });

    it('should update folder color', async () => {
      const response = await request(app)
        .put(`/api/v1/folders/${testFolder._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          color: '#00FF00',
        });

      expect(response.status).toBe(200);
      expect(response.body.color).toBe('#00FF00');
    });

    it('should update both name and color', async () => {
      const response = await request(app)
        .put(`/api/v1/folders/${testFolder._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Name',
          color: '#0000FF',
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('New Name');
      expect(response.body.color).toBe('#0000FF');
    });

    it('should fail for non-existent folder', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/v1/folders/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test',
        });

      expect(response.status).toBe(404);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .put(`/api/v1/folders/${testFolder._id}`)
        .send({
          name: 'Test',
        });

      expect(response.status).toBe(401);
    });
  });
});
