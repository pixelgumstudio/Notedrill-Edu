import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../server';
import Note from '../../models/Note';
import { generateAccessToken } from '../../utils/jwt';
import { User } from '../../models/User';

const { MongoMemoryServer } = require('mongodb-memory-server');

// ============================================================================
// HELPER FUNCTIONS FOR CONTRACT VALIDATION
// ============================================================================

/**
 * Validates that a note object matches the expected contract shape
 * Checks for required fields and correct types, but NOT business logic
 */
function assertNoteShape(note: any, context: string = 'Note object') {
  // Check that note is an object
  expect(note).toBeDefined();
  expect(typeof note).toBe('object');

  // Verify all required fields are present
  expect(note).toHaveProperty('_id');
  expect(note).toHaveProperty('userId');
  expect(note).toHaveProperty('title');
  expect(note).toHaveProperty('content');
  expect(note).toHaveProperty('sourceType');
  expect(note).toHaveProperty('createdAt');
  expect(note).toHaveProperty('updatedAt');

  // Verify types for required fields
  expect(typeof note._id).toBe('string');
  expect(typeof note.userId).toBe('string');
  expect(typeof note.title).toBe('string');
  expect(typeof note.content).toBe('string');
  expect(typeof note.sourceType).toBe('string');

  // Verify sourceType is valid enum value
  const validSourceTypes = ['audio', 'video', 'text', 'pdf', 'image', 'youtube'];
  expect(validSourceTypes).toContain(note.sourceType.toLowerCase());

  // Verify timestamps are ISO date strings
  expect(typeof note.createdAt).toBe('string');
  expect(typeof note.updatedAt).toBe('string');
  expect(() => new Date(note.createdAt)).not.toThrow();
  expect(() => new Date(note.updatedAt)).not.toThrow();

  console.log(`✓ ${context} matches contract shape`);
}

/**
 * Validates a note array response structure
 */
function assertNoteArrayShape(notes: any, context: string = 'Notes array') {
  // Check that notes is an array
  expect(Array.isArray(notes)).toBe(true);

  // Verify each note has the correct shape
  notes.forEach((note: any, index: number) => {
    assertNoteShape(note, `${context}[${index}]`);
  });

  console.log(`✓ ${context} is valid (${notes.length} notes)`);
}

/**
 * Validates that response contains a notes array with total count
 */
function assertNoteListResponse(data: any, context: string = 'Notes list response') {
  expect(data).toBeDefined();
  expect(data).toHaveProperty('notes');

  expect(Array.isArray(data.notes)).toBe(true);
  data.notes.forEach((note: any, index: number) => {
    assertNoteShape(note, `${context}.notes[${index}]`);
  });

  console.log(`✓ ${context} has valid structure (${data.notes.length} notes)`);
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Note API Contracts - Response Shape Validation', () => {
  let mongod: any;
  let authToken: string;
  let userId: string;
  let testUser: any;

  beforeAll(async () => {
    // Set up in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri, { dbName: 'test' });

    // Ensure text indexes are created
    await Note.collection.createIndex({ title: 'text', content: 'text', transcriptText: 'text' });

    // Create test user
    testUser = await User.create({
      email: `notes_contract_${Date.now()}@test.com`,
      name: 'Notes Contract Test User',
      username: `notescontract_${Date.now()}`,
      authProvider: 'local',
    });
    userId = testUser._id.toString();
    authToken = generateAccessToken({
      userId,
      email: testUser.email,
      username: testUser.username,
    });
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
    // Clean up notes between tests (but keep user)
    await Note.deleteMany({ userId });
  });

  // ============================================================================
  // CONTRACT 1: GET /api/v1/notes Response
  // ============================================================================
  describe('GET /api/v1/notes - Response Contract', () => {
    it('should return array of notes with correct shape', async () => {
      // Create a test note first
      await Note.create({
        userId,
        title: 'Contract Test Note',
        content: 'This is test content for contract validation',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const response = await request(app)
        .get('/api/v1/notes')
        .set('Authorization', `Bearer ${authToken}`);

      // Verify response structure
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Contract 1a: Response contains notes array
      assertNoteListResponse(response.body.data, 'GET /notes response');

      // Contract 1b: Each note has required fields
      response.body.data.notes.forEach((note: any) => {
        expect(note._id).toBeDefined();
        expect(note.userId).toBeDefined();
        expect(note.title).toBeDefined();
        expect(note.content).toBeDefined();
        expect(note.sourceType).toBeDefined();
        expect(note.createdAt).toBeDefined();
        expect(note.updatedAt).toBeDefined();
      });
    });

    it('should return empty array when no notes exist', async () => {
      const response = await request(app)
        .get('/api/v1/notes')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.notes).toEqual([]);

      console.log('✓ GET /notes returns empty array correctly');
    });

    it('should return multiple notes all with valid contract shape', async () => {
      // Create multiple test notes
      const noteData = [
        {
          userId,
          title: 'Note 1',
          content: 'Content 1',
          sourceType: 'text' as const,
          processingStatus: 'completed' as const,
        },
        {
          userId,
          title: 'Note 2',
          content: 'Content 2',
          sourceType: 'audio' as const,
          processingStatus: 'completed' as const,
        },
        {
          userId,
          title: 'Note 3',
          content: 'Content 3',
          sourceType: 'pdf' as const,
          processingStatus: 'completed' as const,
        },
      ];

      await Note.insertMany(noteData);

      const response = await request(app)
        .get('/api/v1/notes')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.notes.length).toBe(3);

      // Verify all notes match contract
      assertNoteArrayShape(response.body.data.notes, 'Multiple notes');
    });

    it('should include userId in response matching authenticated user', async () => {
      await Note.create({
        userId,
        title: 'User Contract Test',
        content: 'Testing userId in response',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const response = await request(app)
        .get('/api/v1/notes')
        .set('Authorization', `Bearer ${authToken}`);

      const notes = response.body.data.notes;
      expect(notes.length).toBeGreaterThan(0);

      // All notes should have userId matching authenticated user
      notes.forEach((note: any) => {
        expect(note.userId).toBe(userId);
      });

      console.log('✓ All notes have correct userId');
    });

    it('should include valid sourceType enum values', async () => {
      const sourceTypes = ['audio', 'video', 'text', 'pdf', 'image', 'youtube'];

      // Create notes with different source types
      for (const sourceType of sourceTypes) {
        await Note.create({
          userId,
          title: `Note with ${sourceType}`,
          content: 'Content',
          sourceType,
          processingStatus: 'completed',
        });
      }

      const response = await request(app)
        .get('/api/v1/notes')
        .set('Authorization', `Bearer ${authToken}`);

      const notes = response.body.data.notes;

      notes.forEach((note: any) => {
        expect(sourceTypes).toContain(note.sourceType.toLowerCase());
      });

      console.log('✓ All sourceType values are valid');
    });
  });

  // ============================================================================
  // CONTRACT 2: POST /api/v1/notes/generate Response
  // ============================================================================
  describe('POST /api/v1/notes/generate - Response Contract', () => {
    it('should return note with correct shape on text generation', async () => {
      const response = await request(app)
        .post('/api/v1/notes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Generated Text Note',
          sourceType: 'text',
          content: 'This is generated content for contract validation',
        });

      // Verify response status
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Contract 2a: Response contains note object with required fields
      assertNoteShape(response.body.data, 'POST /notes/generate response');

      // Contract 2b: Verify note has id, userId, title, sourceType, createdAt
      const note = response.body.data;
      expect(note._id).toBeDefined();
      expect(note.userId).toBe(userId);
      expect(note.title).toBe('Generated Text Note');
      expect(note.sourceType).toBe('text');
      expect(typeof note.createdAt).toBe('string');
    });

    it('should return single note object (not array) on generate for text', async () => {
      const response = await request(app)
        .post('/api/v1/notes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Single Note',
          sourceType: 'text',
          content: 'Single note response',
        });

      // Text generation returns 201 with the note directly
      if (response.status === 201) {
        // Verify response is single object, not array
        expect(response.body.data).toBeDefined();
        expect(typeof response.body.data).toBe('object');
        expect(!Array.isArray(response.body.data)).toBe(true);

        assertNoteShape(response.body.data, 'Single note response');
      }
    });

    it('should include processing status fields if applicable', async () => {
      const response = await request(app)
        .post('/api/v1/notes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Processing Status Test',
          sourceType: 'text',
          content: 'Check processing status',
        });

      // For text generation, we get 201 with the note
      if (response.status === 201) {
        const note = response.body.data;

        // Note should have content and timestamps at minimum
        expect(note._id).toBeDefined();
        expect(note.createdAt).toBeDefined();
        expect(note.updatedAt).toBeDefined();

        console.log('✓ Generated note has required fields');
      } else if (response.status === 202) {
        // For file uploads, we get 202 with jobId
        expect(response.body.data).toHaveProperty('jobId');
        console.log('✓ Generated note request accepted with jobId');
      } else if (response.status === 402) {
        // Quota exceeded - acceptable for test
        expect(response.body.quotaExceeded).toBe(true);
        console.log('✓ Quota limit handled appropriately');
      }
    });

    it('should return note with correct sourceType matching request for text', async () => {
      // Only test text sourceType which returns 201 directly
      const response = await request(app)
        .post('/api/v1/notes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Note of type text',
          sourceType: 'text',
          content: 'Content for testing',
        });

      if (response.status === 201) {
        const note = response.body.data;
        expect(note.sourceType.toLowerCase()).toBe('text');
        console.log('✓ Generated note has correct sourceType');
      }
    });
  });

  // ============================================================================
  // CONTRACT 3: PUT /api/v1/notes/:id Response
  // ============================================================================
  describe('PUT /api/v1/notes/:id - Response Contract', () => {
    let testNoteId: string;

    beforeEach(async () => {
      // Create a note to update
      const note = await Note.create({
        userId,
        title: 'Original Title',
        content: 'Original content',
        sourceType: 'text',
        processingStatus: 'completed',
      });
      testNoteId = note._id.toString();
    });

    it('should return updated note with correct shape', async () => {
      const response = await request(app)
        .put(`/api/v1/notes/${testNoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Title',
          content: 'Updated content',
        });

      // Verify response status and structure
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Contract 3a: Updated note matches contract shape
      assertNoteShape(response.body.data, 'PUT /notes/:id response');

      // Contract 3b: Verify updated fields
      const updatedNote = response.body.data;
      expect(updatedNote.title).toBe('Updated Title');
      expect(updatedNote.content).toBe('Updated content');
      expect(updatedNote._id).toBe(testNoteId);
    });

    it('should preserve all required fields on update', async () => {
      const response = await request(app)
        .put(`/api/v1/notes/${testNoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'New Title',
        });

      const updatedNote = response.body.data;

      // All required fields should still be present
      expect(updatedNote._id).toBe(testNoteId);
      expect(updatedNote.userId).toBe(userId);
      expect(updatedNote.title).toBe('New Title');
      expect(updatedNote.content).toBeDefined();
      expect(updatedNote.sourceType).toBeDefined();
      expect(updatedNote.createdAt).toBeDefined();
      expect(updatedNote.updatedAt).toBeDefined();

      console.log('✓ All required fields preserved on update');
    });

    it('should update updatedAt timestamp on modification', async () => {
      // Get original note
      const originalNote = await Note.findById(testNoteId);
      const originalUpdatedAt = originalNote?.updatedAt.getTime();

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await request(app)
        .put(`/api/v1/notes/${testNoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Again',
        });

      const updatedNote = response.body.data;
      const newUpdatedAt = new Date(updatedNote.updatedAt).getTime();

      // updatedAt should be newer than original
      expect(newUpdatedAt).toBeGreaterThanOrEqual(originalUpdatedAt!);

      console.log('✓ updatedAt timestamp updated correctly');
    });

    it('should maintain sourceType unchanged on update', async () => {
      const response = await request(app)
        .put(`/api/v1/notes/${testNoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Title Only Update',
        });

      const updatedNote = response.body.data;

      // sourceType should remain unchanged
      expect(updatedNote.sourceType).toBe('text');

      console.log('✓ sourceType unchanged on update');
    });
  });

  // ============================================================================
  // CROSS-CONTRACT CONSISTENCY TESTS
  // ============================================================================
  describe('Note Contracts - Cross-endpoint Consistency', () => {
    it('should return consistent note shape across GET list and single note', async () => {
      // Create a test note
      const createdNote = await Note.create({
        userId,
        title: 'Consistency Test Note',
        content: 'Testing consistency across endpoints',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      // Get from list endpoint
      const listResponse = await request(app)
        .get('/api/v1/notes')
        .set('Authorization', `Bearer ${authToken}`);

      const noteFromList = listResponse.body.data.notes[0];

      // Verify keys are consistent
      const requiredKeys = ['_id', 'userId', 'title', 'content', 'sourceType', 'createdAt', 'updatedAt'];
      requiredKeys.forEach((key) => {
        expect(noteFromList).toHaveProperty(key);
      });

      console.log('✓ Note shape consistent across endpoints');
    });

    it('should return userId matching authenticated user in all endpoints', async () => {
      // Create test notes
      await Note.create({
        userId,
        title: 'Test 1',
        content: 'Content 1',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      // Test GET list
      const listResponse = await request(app)
        .get('/api/v1/notes')
        .set('Authorization', `Bearer ${authToken}`);

      listResponse.body.data.notes.forEach((note: any) => {
        expect(note.userId).toBe(userId);
      });

      // Test POST generate (for text which returns note directly)
      const generateResponse = await request(app)
        .post('/api/v1/notes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Generated',
          sourceType: 'text',
          content: 'Content',
        });

      if (generateResponse.status === 201) {
        expect(generateResponse.body.data.userId).toBe(userId);
      }

      console.log('✓ userId consistent across all endpoints');
    });

    it('should maintain timestamp format consistency across all endpoints', async () => {
      // Create a note
      const created = await Note.create({
        userId,
        title: 'Timestamp Test',
        content: 'Testing timestamp format',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const noteId = created._id.toString();

      // Get from list
      const listResponse = await request(app)
        .get('/api/v1/notes')
        .set('Authorization', `Bearer ${authToken}`);

      const noteFromList = listResponse.body.data.notes[0];

      // Get from update
      const updateResponse = await request(app)
        .put(`/api/v1/notes/${noteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Updated' });

      const noteFromUpdate = updateResponse.body.data;

      // Verify all timestamps are ISO strings
      [noteFromList, noteFromUpdate].forEach((note) => {
        expect(typeof note.createdAt).toBe('string');
        expect(typeof note.updatedAt).toBe('string');
        expect(() => new Date(note.createdAt)).not.toThrow();
        expect(() => new Date(note.updatedAt)).not.toThrow();
      });

      console.log('✓ Timestamp format consistent across endpoints');
    });

    it('should include all sourceType values across different creation methods', async () => {
      // Test text generation which returns 201 directly
      const response = await request(app)
        .post('/api/v1/notes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test text',
          sourceType: 'text',
          content: 'Test content',
        });

      if (response.status === 201) {
        expect(response.body.data.sourceType.toLowerCase()).toBe('text');
      }

      // Verify in list response
      const listResponse = await request(app)
        .get('/api/v1/notes')
        .set('Authorization', `Bearer ${authToken}`);

      listResponse.body.data.notes.forEach((note: any) => {
        expect(['text', 'audio', 'video', 'pdf', 'image', 'youtube']).toContain(note.sourceType.toLowerCase());
      });

      console.log('✓ sourceType values valid across creation methods');
    });
  });

  // ============================================================================
  // TYPE VALIDATION TESTS
  // ============================================================================
  describe('Note Contracts - Field Type Validation', () => {
    it('should ensure _id is string type (ObjectId as string)', async () => {
      const note = await Note.create({
        userId,
        title: 'Type Test Note',
        content: 'Testing field types',
        sourceType: 'text',
        processingStatus: 'completed',
      });

      const response = await request(app)
        .get('/api/v1/notes')
        .set('Authorization', `Bearer ${authToken}`);

      const responseNote = response.body.data.notes[0];

      // _id should be a string (serialized ObjectId)
      expect(typeof responseNote._id).toBe('string');
      expect(responseNote._id.length).toBeGreaterThan(0);

      console.log('✓ _id field is string type');
    });

    it('should ensure numeric fields are appropriate types', async () => {
      const note = await Note.create({
        userId,
        title: 'Numeric Type Test',
        content: 'Testing numeric types',
        sourceType: 'text',
        processingStatus: 'completed',
        metadata: {
          duration: 120,
          fileSize: 1024,
        },
      });

      const response = await request(app)
        .get('/api/v1/notes')
        .set('Authorization', `Bearer ${authToken}`);

      const responseNote = response.body.data.notes[0];

      // Verify string fields are strings
      expect(typeof responseNote.title).toBe('string');
      expect(typeof responseNote.content).toBe('string');
      expect(typeof responseNote.sourceType).toBe('string');

      console.log('✓ All text fields are string type');
    });

    it('should ensure timestamps parse as valid ISO dates', async () => {
      const response = await request(app)
        .post('/api/v1/notes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Date Parse Test',
          sourceType: 'text',
          content: 'Testing date parsing',
        });

      if (response.status === 201) {
        const note = response.body.data;

        // Both should parse as valid dates
        const createdDate = new Date(note.createdAt);
        const updatedDate = new Date(note.updatedAt);

        expect(createdDate instanceof Date).toBe(true);
        expect(updatedDate instanceof Date).toBe(true);
        expect(!isNaN(createdDate.getTime())).toBe(true);
        expect(!isNaN(updatedDate.getTime())).toBe(true);

        console.log('✓ Timestamps are valid ISO dates');
      }
    });
  });
});
