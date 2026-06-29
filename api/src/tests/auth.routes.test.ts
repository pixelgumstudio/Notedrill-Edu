import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../server';
import { User } from '../models/User';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { issueAndStoreTokens, hashToken } from '../services/auth.service';

const { MongoMemoryServer } = require('mongodb-memory-server');

// Test utilities
let mongod: any;

describe('Authentication API Endpoints', () => {
  beforeAll(async () => {
    // Set up in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri, { dbName: 'test' });
  });

  afterAll(async () => {
    // Clean up
    await User.deleteMany({});
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  afterEach(async () => {
    // Clean up users between tests
    await User.deleteMany({});
  });

  describe('POST /api/v1/auth/register', () => {
    it('(a) should successfully register a new user with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'user@example.com',
          password: 'Test123!',
          name: 'John Doe',
          username: 'johndoe',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.id).toBeDefined();
      expect(response.body.data.user.email).toBe('user@example.com');
      expect(response.body.data.user.username).toBe('johndoe');
      expect(response.body.data.user.subscription).toBe('FREE');
      expect(response.body.data.isNewUser).toBe(true);
    });

    it('(b) should reject duplicate email with 400 status', async () => {
      // Register first user
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'Test123!',
          name: 'First User',
          username: 'firstuser',
        });

      // Try to register with same email
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'Test456!',
          name: 'Second User',
          username: 'seconduser',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Email already registered');
    });

    it('(c) should reject duplicate username with 400 status', async () => {
      // Register first user
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'user1@example.com',
          password: 'Test123!',
          name: 'User One',
          username: 'sameusername',
        });

      // Try to register with same username
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'user2@example.com',
          password: 'Test123!',
          name: 'User Two',
          username: 'sameusername',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Username already taken');
    });

    it('(d) should reject invalid email format with 400 status', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'notanemail',
          password: 'Test123!',
          name: 'John Doe',
          username: 'johndoe',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('(e) should reject username with spaces with 400 status', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'user@example.com',
          password: 'Test123!',
          name: 'John Doe',
          username: 'john doe',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      const user = new User({
        email: 'test@example.com',
        password: 'Test123!',
        name: 'Test User',
        username: 'testuser',
        authProvider: 'local',
      });
      await user.save();
    });

    it('(a) should successfully login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.user.username).toBe('testuser');
      // Verify password is not in response
      expect(response.body.data.user.password).toBeUndefined();
      expect(response.body.data.isNewUser).toBe(false);
    });

    it('(b) should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid email or password');
    });

    it('(c) should reject login with nonexistent email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Test123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid email or password');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    let testUser: any;
    let validRefreshToken: string;

    beforeEach(async () => {
      // Create a test user and generate tokens for refresh tests
      testUser = new User({
        email: 'refresh@example.com',
        password: 'Test123!',
        name: 'Refresh Test User',
        username: 'refreshuser',
        authProvider: 'local',
      });
      await testUser.save();

      // Issue and store tokens using the same method as the app
      const tokens = await issueAndStoreTokens(testUser);
      validRefreshToken = tokens.refreshToken;
    });

    it('(a) should successfully refresh token pair with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: validRefreshToken,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
      // Verify tokens are valid JWT strings and different from the original request token
      expect(typeof response.body.data.tokens.accessToken).toBe('string');
      expect(typeof response.body.data.tokens.refreshToken).toBe('string');
      expect(response.body.data.tokens.accessToken.split('.').length).toBe(3); // JWT format
      expect(response.body.data.tokens.refreshToken.split('.').length).toBe(3); // JWT format
    });

    it('(b) should reject tampered/invalid refresh token', async () => {
      // Tamper with the token by modifying a character
      const tamperedToken = validRefreshToken.slice(0, -5) + 'XXXXX';

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: tamperedToken,
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid refresh token');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let testUser: any;
    let validAccessToken: string;

    beforeEach(async () => {
      // Create a test user and generate access token for me tests
      testUser = new User({
        email: 'me@example.com',
        password: 'Test123!',
        name: 'Me Test User',
        username: 'meuser',
        authProvider: 'local',
      });
      await testUser.save();

      // Generate access token
      validAccessToken = generateAccessToken({
        userId: testUser._id.toString(),
        email: testUser.email,
        username: testUser.username,
        subscription: testUser.subscription,
      });
    });

    it('(a) should return current user with valid Bearer token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('me@example.com');
      expect(response.body.data.user.username).toBe('meuser');
      // Verify password is not in response
      expect(response.body.data.user.password).toBeUndefined();
      expect(response.body.data.user.id).toBeDefined();
    });

    it('(b) should reject request without authentication token', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No token provided. Please authenticate.');
    });
  });
});
