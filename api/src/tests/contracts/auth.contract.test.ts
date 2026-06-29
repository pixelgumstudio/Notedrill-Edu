import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../server';
import { User } from '../../models/User';
import { generateAccessToken } from '../../utils/jwt';

const { MongoMemoryServer } = require('mongodb-memory-server');

// ============================================================================
// HELPER FUNCTIONS FOR CONTRACT VALIDATION
// ============================================================================

/**
 * Validates that a user object matches the expected contract shape
 * Checks for required fields and correct types, but NOT business logic
 */
function assertUserShape(user: any, context: string = 'User object') {
  // Check that user is an object
  expect(user).toBeDefined();
  expect(typeof user).toBe('object');

  // Verify all required fields are present
  expect(user).toHaveProperty('id');
  expect(user).toHaveProperty('email');
  expect(user).toHaveProperty('username');
  expect(user).toHaveProperty('name');
  expect(user).toHaveProperty('subscription');
  expect(user).toHaveProperty('createdAt');

  // Verify types
  expect(typeof user.id).toBe('string');
  expect(typeof user.email).toBe('string');
  expect(typeof user.username).toBe('string');
  expect(typeof user.name).toBe('string');
  expect(typeof user.subscription).toBe('string');
  expect(['FREE', 'PRO']).toContain(user.subscription);

  // Verify createdAt is ISO date string
  expect(typeof user.createdAt).toBe('string');
  expect(() => new Date(user.createdAt)).not.toThrow();

  // Password should NEVER be in response
  expect(user.password).toBeUndefined();

  console.log(`✓ ${context} matches contract shape`);
}

/**
 * Validates that tokens match the expected contract shape
 */
function assertTokenShape(tokens: any, context: string = 'Tokens object') {
  expect(tokens).toBeDefined();
  expect(typeof tokens).toBe('object');

  expect(tokens).toHaveProperty('accessToken');
  expect(tokens).toHaveProperty('refreshToken');

  expect(typeof tokens.accessToken).toBe('string');
  expect(typeof tokens.refreshToken).toBe('string');

  // Verify tokens are non-empty
  expect(tokens.accessToken.length).toBeGreaterThan(0);
  expect(tokens.refreshToken.length).toBeGreaterThan(0);

  // Verify JWT format (3 parts separated by dots)
  expect(tokens.accessToken.split('.').length).toBe(3);
  expect(tokens.refreshToken.split('.').length).toBe(3);

  console.log(`✓ ${context} matches contract shape`);
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Auth API Contracts - Response Shape Validation', () => {
  let mongod: any;

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

  // ============================================================================
  // CONTRACT 1: POST /api/v1/auth/register Response
  // ============================================================================
  describe('POST /api/v1/auth/register - Response Contract', () => {
    it('should return response with correct user shape (all required fields)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'contract-test@example.com',
          password: 'TestPassword123!',
          name: 'Contract Test User',
          username: 'contractuser1',
        });

      // Verify response structure
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.user).toBeDefined();

      // Contract 1a: User object has all required fields with correct types
      assertUserShape(response.body.data.user, 'Register response user object');

      // Contract 1b: User object contains no password field
      expect(response.body.data.user.password).toBeUndefined();

      // Contract 1c: Tokens present and valid
      expect(response.body.data.tokens).toBeDefined();
      assertTokenShape(response.body.data.tokens, 'Register response tokens');
    });

    it('should verify no sensitive fields leak in register response', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'secure@example.com',
          password: 'SecurePassword123!',
          name: 'Secure User',
          username: 'secureuser',
        });

      const user = response.body.data.user;

      // Verify no sensitive fields
      expect(user.password).toBeUndefined();
      expect(user.__v).toBeUndefined(); // No mongoose version field

      console.log('✓ No sensitive fields in register response');
    });

    it('should return tokens as distinct non-empty strings', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'tokens@example.com',
          password: 'TokenPassword123!',
          name: 'Token Test',
          username: 'tokenuser',
        });

      const { accessToken, refreshToken } = response.body.data.tokens;

      // Tokens should be different
      expect(accessToken).not.toBe(refreshToken);

      // Both should be non-empty
      expect(accessToken.length).toBeGreaterThan(0);
      expect(refreshToken.length).toBeGreaterThan(0);

      console.log('✓ Tokens are distinct and non-empty');
    });
  });

  // ============================================================================
  // CONTRACT 2: POST /api/v1/auth/login Response
  // ============================================================================
  describe('POST /api/v1/auth/login - Response Contract', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      const user = new User({
        email: 'login-test@example.com',
        password: 'LoginPassword123!',
        name: 'Login Test User',
        username: 'loginuser',
        authProvider: 'local',
      });
      await user.save();
    });

    it('should return response with correct user shape on successful login', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login-test@example.com',
          password: 'LoginPassword123!',
        });

      // Verify response structure
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.user).toBeDefined();

      // Contract 2a: User object matches shape
      assertUserShape(response.body.data.user, 'Login response user object');

      // Contract 2b: User object contains no password field
      expect(response.body.data.user.password).toBeUndefined();

      // Contract 2c: Tokens present and valid
      expect(response.body.data.tokens).toBeDefined();
      assertTokenShape(response.body.data.tokens, 'Login response tokens');
    });

    it('should return user email matching login credentials in response', async () => {
      const testEmail = 'login-test@example.com';
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: 'LoginPassword123!',
        });

      expect(response.body.data.user.email).toBe(testEmail);
      console.log('✓ Login response email matches request');
    });

    it('should return tokens with valid JWT structure on login', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login-test@example.com',
          password: 'LoginPassword123!',
        });

      const { accessToken, refreshToken } = response.body.data.tokens;

      // Verify JWT format (header.payload.signature)
      expect(accessToken.split('.').length).toBe(3);
      expect(refreshToken.split('.').length).toBe(3);

      // Verify tokens are different
      expect(accessToken).not.toBe(refreshToken);

      console.log('✓ Login tokens have valid JWT structure');
    });
  });

  // ============================================================================
  // CONTRACT 3: GET /api/v1/auth/me Response
  // ============================================================================
  describe('GET /api/v1/auth/me - Response Contract', () => {
    let testUser: any;
    let validAccessToken: string;

    beforeEach(async () => {
      // Create a test user for /me endpoint tests
      testUser = new User({
        email: 'me-test@example.com',
        password: 'MePassword123!',
        name: 'Me Test User',
        username: 'meuser',
        authProvider: 'local',
      });
      await testUser.save();

      // Generate valid access token
      validAccessToken = generateAccessToken({
        userId: testUser._id.toString(),
        email: testUser.email,
        username: testUser.username,
        subscription: testUser.subscription,
      });
    });

    it('should return response with correct user shape on /me', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`);

      // Verify response structure
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.user).toBeDefined();

      // Contract 3a: User object matches shape
      assertUserShape(response.body.data.user, 'GET /me response user object');
    });

    it('should verify /me response has required user identification fields', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`);

      const user = response.body.data.user;

      // Verify core identification fields
      expect(user.id).toBe(testUser._id.toString());
      expect(user.email).toBe('me-test@example.com');
      expect(user.username).toBe('meuser');

      console.log('✓ /me response has correct identification fields');
    });

    it('should verify /me response contains no password field', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`);

      const user = response.body.data.user;

      // Explicitly verify password is not present
      expect(user.password).toBeUndefined();
      expect(Object.keys(user)).not.toContain('password');

      console.log('✓ /me response contains no password field');
    });

    it('should verify /me response contains subscription field with valid enum', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`);

      const user = response.body.data.user;

      // Verify subscription is present and valid
      expect(user.subscription).toBeDefined();
      expect(['FREE', 'PRO']).toContain(user.subscription);

      console.log('✓ /me response has valid subscription field');
    });

    it('should verify /me response timestamps are ISO format strings', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`);

      const user = response.body.data.user;

      // Verify createdAt is ISO date string
      expect(typeof user.createdAt).toBe('string');
      expect(() => new Date(user.createdAt)).not.toThrow();

      console.log('✓ /me response timestamps are ISO format');
    });
  });

  // ============================================================================
  // CROSS-CONTRACT CONSISTENCY TESTS
  // ============================================================================
  describe('Auth Contracts - Cross-endpoint Consistency', () => {
    it('should return consistent required user shape across register and login', async () => {
      const email = 'consistency@example.com';
      const password = 'ConsistentPassword123!';
      const name = 'Consistency Test';
      const username = 'consistencyuser';

      // Register
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email,
          password,
          name,
          username,
        });

      const registerUser = registerResponse.body.data.user;

      // Login with the same user
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password });

      const loginUser = loginResponse.body.data.user;

      // Verify both responses have required fields (login may have additional optional fields)
      const requiredFields = ['id', 'email', 'username', 'name', 'subscription', 'createdAt'];
      requiredFields.forEach((field) => {
        expect(registerUser).toHaveProperty(field);
        expect(loginUser).toHaveProperty(field);
      });

      // Verify values match for core fields
      expect(registerUser.email).toBe(loginUser.email);
      expect(registerUser.username).toBe(loginUser.username);
      expect(registerUser.id).toBe(loginUser.id);

      console.log('✓ User shape is consistent across register and login (required fields)');
    });

    it('should return valid tokens from all auth endpoints', async () => {
      const testData = {
        email: 'tokentest@example.com',
        password: 'TokenTestPassword123!',
        name: 'Token Test',
        username: 'tokentest',
      };

      // Register - should return tokens
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(testData);

      assertTokenShape(registerResponse.body.data.tokens, 'Register tokens');

      // Login - should return tokens
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testData.email,
          password: testData.password,
        });

      assertTokenShape(loginResponse.body.data.tokens, 'Login tokens');

      console.log('✓ All auth endpoints return valid tokens');
    });
  });
});
