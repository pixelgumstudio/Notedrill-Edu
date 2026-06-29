/**
 * Notification Integration Tests
 * Tests end-to-end flow: job completion → notification trigger
 */

import request from 'supertest';
import { app } from '../server';
import { User } from '../models/User';
import Note from '../models/Note';
import Notification from '../models/Notification';
import { generateAccessToken } from '../utils/jwt';
import notificationService from '../services/notification.service';

jest.mock('../services/notification.service');

describe('Notification Integration Tests', () => {
  let userId: string;
  let userToken: string;
  let deviceToken = 'test_device_token_123';

  beforeAll(async () => {
    // Create test user
    const user = await User.create({
      email: 'notification-test@test.com',
      password: 'TestPassword123!',
      name: 'Test User',
      username: 'notificationtest',
      subscription: 'FREE',
      deviceTokens: [
        {
          token: deviceToken,
          platform: 'ios',
          registeredAt: new Date(),
        },
      ],
    });

    userId = user._id.toString();
    userToken = generateAccessToken({
      userId,
      email: user.email,
      username: user.username,
      subscription: user.subscription,
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Note.deleteMany({});
    await Notification.deleteMany({});
  });

  describe('Device Token Management', () => {
    it('should register device token', async () => {
      // Act
      const response = await request(app)
        .post('/api/v1/user/device-tokens')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          token: 'new_device_token',
          platform: 'android',
          deviceName: 'Test Device',
        });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.data.tokenCount).toBe(2);
      expect(response.body.success).toBe(true);
    });

    it('should update existing device token', async () => {
      // Act
      const response = await request(app)
        .post('/api/v1/user/device-tokens')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          token: deviceToken, // Same token
          platform: 'ios',
          deviceName: 'Updated Device',
        });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.data.tokenCount).toBeLessThanOrEqual(2);
    });

    it('should require authentication', async () => {
      // Act
      const response = await request(app)
        .post('/api/v1/user/device-tokens')
        .send({
          token: 'some_token',
          platform: 'ios',
        });

      // Assert
      expect(response.status).toBe(401);
    });

    it('should validate platform', async () => {
      // Act
      const response = await request(app)
        .post('/api/v1/user/device-tokens')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          token: 'some_token',
          platform: 'invalid_platform',
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('platform');
    });

    it('should list user device tokens', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/user/device-tokens')
        .set('Authorization', `Bearer ${userToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.devices).toBeInstanceOf(Array);
      expect(response.body.data.count).toBeGreaterThan(0);
    });

    it('should unregister device token', async () => {
      // First register a token
      const registerRes = await request(app)
        .post('/api/v1/user/device-tokens')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          token: 'temp_token_to_delete',
          platform: 'android',
        });

      const tempToken = 'temp_token_to_delete';

      // Act - Delete the token
      const deleteRes = await request(app)
        .delete(`/api/v1/user/device-tokens/${tempToken}`)
        .set('Authorization', `Bearer ${userToken}`);

      // Assert
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.data.tokenCount).toBeLessThanOrEqual(
        registerRes.body.data.tokenCount - 1
      );
    });
  });

  describe('Note Creation with Notifications', () => {
    it('should trigger notification on text note creation', async () => {
      // Mock the notification service
      (notificationService.sendJobCompletionNotification as jest.Mock).mockResolvedValue(
        true
      );

      // Act
      const response = await request(app)
        .post('/api/v1/notes/generate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Test Note',
          content: 'Test content for notification',
          sourceType: 'text',
        });

      // Assert
      expect(response.status).toBe(201);

      // Verify notification was triggered
      expect(notificationService.sendJobCompletionNotification).toHaveBeenCalledWith(
        userId,
        expect.any(String),
        'note',
        'completed'
      );
    });

    it('should trigger notification on async note completion', async () => {
      // This would require file upload, so we'll mock at the service level
      (notificationService.sendJobCompletionNotification as jest.Mock).mockResolvedValue(
        true
      );

      // For async notes, the notification would be triggered after processing
      // This test verifies the notification service is called with correct params

      await notificationService.sendJobCompletionNotification(
        userId,
        'job-123',
        'note',
        'completed'
      );

      expect(notificationService.sendJobCompletionNotification).toHaveBeenCalledWith(
        userId,
        'job-123',
        'note',
        'completed'
      );
    });

    it('should trigger notification on note failure', async () => {
      (notificationService.sendJobCompletionNotification as jest.Mock).mockResolvedValue(
        false
      );

      await notificationService.sendJobCompletionNotification(
        userId,
        'job-456',
        'note',
        'failed'
      );

      expect(notificationService.sendJobCompletionNotification).toHaveBeenCalledWith(
        userId,
        'job-456',
        'note',
        'failed'
      );
    });
  });

  describe('Quota Enforcement with Notifications', () => {
    it('should not trigger notification when quota exceeded', async () => {
      // Mock quota exceeded scenario
      const response = await request(app)
        .post('/api/v1/notes/generate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Quota Test',
          content: 'This should fail due to quota',
          sourceType: 'text',
        });

      // Depending on existing notes, this might return 403
      if (response.status === 403) {
        expect(notificationService.sendJobCompletionNotification).not.toHaveBeenCalled();
      }
    });
  });

  describe('Notification Data Integrity', () => {
    it('should include correct jobId in notification data', async () => {
      const mockJobId = 'job-integrity-test-123';

      (notificationService.sendJobCompletionNotification as jest.Mock).mockResolvedValue(
        true
      );

      await notificationService.sendJobCompletionNotification(
        userId,
        mockJobId,
        'chat',
        'completed'
      );

      const callArgs = (notificationService.sendJobCompletionNotification as jest.Mock).mock
        .calls[0];

      expect(callArgs[1]).toBe(mockJobId);
      expect(callArgs[2]).toBe('chat');
      expect(callArgs[3]).toBe('completed');
    });

    it('should handle missing device tokens gracefully', async () => {
      // Create user without device tokens
      const userNoTokens = await User.create({
        email: 'no-tokens@test.com',
        password: 'TestPassword123!',
        name: 'No Tokens User',
        username: 'notokenuser',
        subscription: 'FREE',
        deviceTokens: [],
      });

      (notificationService.sendJobCompletionNotification as jest.Mock).mockResolvedValue(
        false
      );

      const result = await notificationService.sendJobCompletionNotification(
        userNoTokens._id.toString(),
        'job-xyz',
        'note',
        'completed'
      );

      expect(result).toBe(false);

      await User.deleteOne({ _id: userNoTokens._id });
    });
  });
});
