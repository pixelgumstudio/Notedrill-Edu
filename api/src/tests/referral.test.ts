import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../server';
import { User } from '../models/User';
import { ReferralPartner } from '../models/ReferralPartner';
import { generateAccessToken } from '../utils/jwt';

const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod: any;

describe('Referral System API Endpoints', () => {
  beforeAll(async () => {
    // Set up in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri, { dbName: 'test' });

    // Seed demo ReferralPartner codes
    await ReferralPartner.insertMany([
      {
        code: 'DEMO',
        name: 'Demo Code',
        description: 'Test referral code for development',
        is_active: true,
      },
      {
        code: 'PROMO',
        name: 'Promotional Code',
        description: 'Early access promotion code',
        is_active: true,
      },
      {
        code: 'TECHBRO',
        name: 'Tech Influencer',
        description: 'Referral partner from tech community',
        is_active: true,
      },
      {
        code: 'EARLY',
        name: 'Early Adopters',
        description: 'Early adopter program code',
        is_active: true,
      },
    ]);
  });

  afterAll(async () => {
    // Clean up
    await User.deleteMany({});
    await ReferralPartner.deleteMany({});
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  afterEach(async () => {
    // Clean up users between tests (but keep ReferralPartner seeded data)
    await User.deleteMany({});
  });

  // =====================================================
  // 1. POST /api/v1/referrals/validate - Partner Codes
  // =====================================================

  describe('POST /api/v1/referrals/validate - Partner Codes', () => {
    it('(1a) should validate a valid partner code (DEMO)', async () => {
      const response = await request(app)
        .post('/api/v1/referrals/validate')
        .send({ code: 'DEMO' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Referral code validated');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.type).toBe('partner');
    });

    it('(1b) should validate partner code case-insensitively (demo/DEMO/Demo)', async () => {
      // Test lowercase
      let response = await request(app)
        .post('/api/v1/referrals/validate')
        .send({ code: 'demo' });

      expect(response.status).toBe(200);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.type).toBe('partner');

      // Test mixed case
      response = await request(app)
        .post('/api/v1/referrals/validate')
        .send({ code: 'Demo' });

      expect(response.status).toBe(200);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.type).toBe('partner');

      // Test with spaces
      response = await request(app)
        .post('/api/v1/referrals/validate')
        .send({ code: '  DEMO  ' });

      expect(response.status).toBe(200);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.type).toBe('partner');
    });

    it('(1c) should return invalid for non-existent partner code', async () => {
      const response = await request(app)
        .post('/api/v1/referrals/validate')
        .send({ code: 'INVALID' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Referral code not found');
      expect(response.body.data.valid).toBe(false);
    });
  });

  // =====================================================
  // 2. POST /api/v1/referrals/validate - User Codes
  // =====================================================

  describe('POST /api/v1/referrals/validate - User Codes', () => {
    let userReferralCode: string;

    beforeEach(async () => {
      // Create a user with a known my_referral_code
      const testUser = await User.create({
        email: 'usercode@example.com',
        password: 'hashed_password',
        name: 'Test User',
        username: 'testuser123',
        my_referral_code: 'USERREF123',
        subscription: 'FREE',
        hasCompletedSignup: true,
      });
      userReferralCode = testUser.my_referral_code!;
    });

    it('(2a) should validate a valid user referral code', async () => {
      const response = await request(app)
        .post('/api/v1/referrals/validate')
        .send({ code: userReferralCode });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Referral code validated');
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.type).toBe('user');
    });

    it('(2b) should validate user code case-insensitively', async () => {
      // Test lowercase
      let response = await request(app)
        .post('/api/v1/referrals/validate')
        .send({ code: userReferralCode.toLowerCase() });

      expect(response.status).toBe(200);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.type).toBe('user');

      // Test mixed case
      response = await request(app)
        .post('/api/v1/referrals/validate')
        .send({ code: 'userref123' });

      expect(response.status).toBe(200);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.type).toBe('user');
    });

    it('(2c) should return invalid for non-existent user code', async () => {
      const response = await request(app)
        .post('/api/v1/referrals/validate')
        .send({ code: 'NONEXISTENT' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(false);
    });
  });

  // =====================================================
  // 3. POST /api/v1/referrals/apply - Partner Codes
  // =====================================================

  describe('POST /api/v1/referrals/apply - Partner Codes', () => {
    it('(3a) should apply a valid partner code to a user', async () => {
      // Register a new user
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'partneruser@example.com',
          password: 'Test123!',
          name: 'Partner User',
          username: 'partneruser',
        });

      expect(registerResponse.status).toBe(201);
      const accessToken = registerResponse.body.data.tokens.accessToken;
      const userId = registerResponse.body.data.user.id;

      // Apply partner code
      const applyResponse = await request(app)
        .post('/api/v1/referrals/apply')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: 'PROMO' });

      expect(applyResponse.status).toBe(200);
      expect(applyResponse.body.success).toBe(true);

      // Verify user was updated
      const updatedUser = await User.findById(userId);
      expect(updatedUser).toBeDefined();
      expect(updatedUser!.referral_code).toBe('PROMO');
      expect(updatedUser!.referred_by_partner).toBeDefined();

      // Verify referred_by_partner points to the correct partner
      const promoPartner = await ReferralPartner.findOne({ code: 'PROMO' });
      expect(updatedUser!.referred_by_partner?.toString()).toBe(promoPartner!._id.toString());
    });

    it('(3b) should not allow reapplying a code (idempotent guard)', async () => {
      // Register a user
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'reapply@example.com',
          password: 'Test123!',
          name: 'Reapply User',
          username: 'reapplyuser',
        });

      const accessToken = registerResponse.body.data.tokens.accessToken;
      const userId = registerResponse.body.data.user.id;

      // Apply first code
      const firstApply = await request(app)
        .post('/api/v1/referrals/apply')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: 'PROMO' });

      expect(firstApply.status).toBe(200);

      // Try to apply another code
      const secondApply = await request(app)
        .post('/api/v1/referrals/apply')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: 'TECHBRO' });

      expect(secondApply.status).toBe(200);

      // Verify user still has the first code (not updated)
      const finalUser = await User.findById(userId);
      expect(finalUser!.referral_code).toBe('PROMO'); // Should still be PROMO, not TECHBRO
    });
  });

  // =====================================================
  // 4. POST /api/v1/referrals/apply - User Codes
  // =====================================================

  describe('POST /api/v1/referrals/apply - User Codes', () => {
    it('(4a) should apply a user referral code (user A code as user B)', async () => {
      // Create User A with a referral code
      const userA = await User.create({
        email: 'userA@example.com',
        password: 'hashed_password',
        name: 'User A',
        username: 'userA',
        my_referral_code: 'USERA1234',
        subscription: 'FREE',
        hasCompletedSignup: true,
      });

      // Register User B
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'userB@example.com',
          password: 'Test123!',
          name: 'User B',
          username: 'userB',
        });

      expect(registerResponse.status).toBe(201);
      const accessToken = registerResponse.body.data.tokens.accessToken;
      const userBId = registerResponse.body.data.user.id;

      // User B applies User A's referral code
      const applyResponse = await request(app)
        .post('/api/v1/referrals/apply')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: 'USERA1234' });

      expect(applyResponse.status).toBe(200);
      expect(applyResponse.body.success).toBe(true);

      // Verify User B was updated with referred_by_user
      const updatedUserB = await User.findById(userBId);
      expect(updatedUserB!.referred_by_user).toBeDefined();
      expect(updatedUserB!.referred_by_user?.toString()).toBe(userA._id.toString());
    });

    it('(4b) should prevent self-referral', async () => {
      // Create a user with my_referral_code
      const selfReferralUser = await User.create({
        email: 'selfrefer@example.com',
        password: 'hashed_password',
        name: 'Self Refer User',
        username: 'selfrefuser',
        my_referral_code: 'SELFCODE123',
        subscription: 'FREE',
        hasCompletedSignup: true,
      });

      // Generate access token for this user with proper TokenPayload
      const accessToken = generateAccessToken({
        userId: selfReferralUser._id.toString(),
        email: selfReferralUser.email,
        username: selfReferralUser.username,
        subscription: selfReferralUser.subscription,
      });

      // Try to apply their own code
      const applyResponse = await request(app)
        .post('/api/v1/referrals/apply')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: 'SELFCODE123' });

      expect(applyResponse.status).toBe(400);
      expect(applyResponse.body.error).toBe('Cannot use your own code');

      // Verify user doesn't have referred_by_user set
      const userAfter = await User.findById(selfReferralUser._id);
      expect(userAfter!.referred_by_user).toBeUndefined();
    });
  });

  // =====================================================
  // 5. Error Handling
  // =====================================================

  describe('POST /api/v1/referrals/validate - Error Handling', () => {
    it('(5a) should return 400 when code is missing', async () => {
      const response = await request(app)
        .post('/api/v1/referrals/validate')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Code is required');
    });

    it('(5b) should return 400 when code is not a string', async () => {
      const response = await request(app)
        .post('/api/v1/referrals/validate')
        .send({ code: 12345 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Code is required');
    });
  });

  describe('POST /api/v1/referrals/apply - Error Handling', () => {
    it('(5c) should return 401 when not authenticated', async () => {
      const response = await request(app)
        .post('/api/v1/referrals/apply')
        .send({ code: 'DEMO' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('(5d) should return 400 when code is missing in apply', async () => {
      // Register a user first
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'applyerror@example.com',
          password: 'Test123!',
          name: 'Apply Error User',
          username: 'applyerroruser',
        });

      const accessToken = registerResponse.body.data.tokens.accessToken;

      const response = await request(app)
        .post('/api/v1/referrals/apply')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Code is required');
    });
  });

  // =====================================================
  // 6. Integration Tests
  // =====================================================

  describe('Referral System - Integration Tests', () => {
    it('(6a) should distinguish between partner and user codes', async () => {
      // Validate partner code
      const partnerResponse = await request(app)
        .post('/api/v1/referrals/validate')
        .send({ code: 'DEMO' });

      expect(partnerResponse.body.data.type).toBe('partner');

      // Create user with referral code
      const userWithCode = await User.create({
        email: 'integration@example.com',
        password: 'hashed_password',
        name: 'Integration User',
        username: 'integrationuser',
        my_referral_code: 'INTCODE123',
        subscription: 'FREE',
        hasCompletedSignup: true,
      });

      // Validate user code
      const userResponse = await request(app)
        .post('/api/v1/referrals/validate')
        .send({ code: 'INTCODE123' });

      expect(userResponse.body.data.type).toBe('user');

      // Both should be valid
      expect(partnerResponse.body.data.valid).toBe(true);
      expect(userResponse.body.data.valid).toBe(true);
    });

    it('(6b) should handle full user referral flow: validate -> apply', async () => {
      // Create referrer
      const referrer = await User.create({
        email: 'referrer@example.com',
        password: 'hashed_password',
        name: 'Referrer',
        username: 'referrer',
        my_referral_code: 'FLOW1234',
        subscription: 'FREE',
        hasCompletedSignup: true,
      });

      // Validate referral code
      const validateResponse = await request(app)
        .post('/api/v1/referrals/validate')
        .send({ code: 'FLOW1234' });

      expect(validateResponse.body.data.valid).toBe(true);
      expect(validateResponse.body.data.type).toBe('user');

      // Register referred user
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'referred@example.com',
          password: 'Test123!',
          name: 'Referred User',
          username: 'referreduser',
        });

      const accessToken = registerResponse.body.data.tokens.accessToken;
      const referredUserId = registerResponse.body.data.user.id;

      // Apply referral code
      const applyResponse = await request(app)
        .post('/api/v1/referrals/apply')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: 'FLOW1234' });

      expect(applyResponse.status).toBe(200);

      // Verify tracking
      const finalUser = await User.findById(referredUserId);
      expect(finalUser!.referred_by_user?.toString()).toBe(referrer._id.toString());
    });

    it('(6c) should handle full partner referral flow: validate -> apply', async () => {
      // Validate partner code
      const validateResponse = await request(app)
        .post('/api/v1/referrals/validate')
        .send({ code: 'EARLY' });

      expect(validateResponse.body.data.valid).toBe(true);
      expect(validateResponse.body.data.type).toBe('partner');

      // Register user
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'earlyuser@example.com',
          password: 'Test123!',
          name: 'Early User',
          username: 'earlyuser',
        });

      const accessToken = registerResponse.body.data.tokens.accessToken;
      const userId = registerResponse.body.data.user.id;

      // Apply partner code
      const applyResponse = await request(app)
        .post('/api/v1/referrals/apply')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: 'EARLY' });

      expect(applyResponse.status).toBe(200);

      // Verify tracking
      const finalUser = await User.findById(userId);
      const earlyPartner = await ReferralPartner.findOne({ code: 'EARLY' });
      expect(finalUser!.referral_code).toBe('EARLY');
      expect(finalUser!.referred_by_partner?.toString()).toBe(earlyPartner!._id.toString());
    });
  });
});
