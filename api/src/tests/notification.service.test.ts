/**
 * Notification Service Unit Tests
 * Tests FCM integration, device token management, notification delivery
 */

import notificationService from '../services/notification.service';
import { User } from '../models/User';
import Notification from '../models/Notification';
import admin from 'firebase-admin';

const mockSend = jest.fn();
const mockMessagingInstance = { send: mockSend };

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  apps: [{}], // Non-empty array so Firebase is considered initialized
  initializeApp: jest.fn(),
  messaging: jest.fn(() => mockMessagingInstance),
}));

describe('NotificationService', () => {
  const mockUserId = 'user123';
  const mockJobId = 'job456';
  const mockDeviceToken = 'device_token_xyz';

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockReset();
  });

  describe('sendJobCompletionNotification', () => {
    it('should send notification to user with registered device tokens', async () => {
      // Arrange
      const mockUser = {
        _id: mockUserId,
        deviceTokens: [
          { token: mockDeviceToken, platform: 'ios', registeredAt: new Date() },
        ],
      };

      jest.spyOn(User, 'findById').mockResolvedValue(mockUser as any);
      mockSend.mockResolvedValue('message-id-123');

      // Act
      const result = await notificationService.sendJobCompletionNotification(
        mockUserId,
        mockJobId,
        'note',
        'completed'
      );

      // Assert
      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          notification: expect.objectContaining({
            title: expect.stringContaining('✅'),
            body: expect.stringContaining('Note'),
          }),
          data: expect.objectContaining({
            jobId: mockJobId,
            jobType: 'note',
            status: 'completed',
          }),
          token: mockDeviceToken,
        })
      );
    });

    it('should return false if user has no device tokens', async () => {
      // Arrange
      const mockUser = {
        _id: mockUserId,
        deviceTokens: [],
      };

      jest.spyOn(User, 'findById').mockResolvedValue(mockUser as any);

      // Act
      const result = await notificationService.sendJobCompletionNotification(
        mockUserId,
        mockJobId,
        'note',
        'completed'
      );

      // Assert
      expect(result).toBe(false);
    });

    it('should return false if user not found', async () => {
      // Arrange
      jest.spyOn(User, 'findById').mockResolvedValue(null);

      // Act
      const result = await notificationService.sendJobCompletionNotification(
        mockUserId,
        mockJobId,
        'note',
        'completed'
      );

      // Assert
      expect(result).toBe(false);
    });

    it('should send failure notification with correct message', async () => {
      // Arrange
      const mockUser = {
        _id: mockUserId,
        deviceTokens: [
          { token: mockDeviceToken, platform: 'ios', registeredAt: new Date() },
        ],
      };

      jest.spyOn(User, 'findById').mockResolvedValue(mockUser as any);
      mockSend.mockResolvedValue('message-id-123');

      // Act
      await notificationService.sendJobCompletionNotification(
        mockUserId,
        mockJobId,
        'note',
        'failed'
      );

      // Assert
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          notification: expect.objectContaining({
            title: expect.stringContaining('❌'),
          }),
        })
      );
    });

    it('should handle multiple device tokens', async () => {
      // Arrange
      const deviceToken1 = 'device_token_1';
      const deviceToken2 = 'device_token_2';
      const mockUser = {
        _id: mockUserId,
        deviceTokens: [
          { token: deviceToken1, platform: 'ios', registeredAt: new Date() },
          { token: deviceToken2, platform: 'android', registeredAt: new Date() },
        ],
      };

      jest.spyOn(User, 'findById').mockResolvedValue(mockUser as any);
      mockSend.mockResolvedValue('message-id');

      // Act
      const result = await notificationService.sendJobCompletionNotification(
        mockUserId,
        mockJobId,
        'chat',
        'completed'
      );

      // Assert
      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should use correct job label for different job types', async () => {
      // Arrange
      const mockUser = {
        _id: mockUserId,
        deviceTokens: [
          { token: mockDeviceToken, platform: 'ios', registeredAt: new Date() },
        ],
      };

      jest.spyOn(User, 'findById').mockResolvedValue(mockUser as any);
      mockSend.mockResolvedValue('message-id');

      const jobTypes: Array<'note' | 'chat' | 'quiz' | 'flashcard' | 'youtube'> = [
        'note',
        'chat',
        'quiz',
        'flashcard',
        'youtube',
      ];

      for (const jobType of jobTypes) {
        mockSend.mockClear();
        jest.spyOn(User, 'findById').mockResolvedValue(mockUser as any);
        mockSend.mockResolvedValue('message-id');

        // Act
        await notificationService.sendJobCompletionNotification(
          mockUserId,
          mockJobId,
          jobType,
          'completed'
        );

        // Assert
        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            notification: expect.objectContaining({
              body: expect.stringContaining(
                jobType === 'youtube' ? 'YouTube note' : jobType.charAt(0).toUpperCase() + jobType.slice(1)
              ),
            }),
          })
        );
      }
    });

    it('should persist notification to database', async () => {
      // Arrange
      const mockUser = {
        _id: mockUserId,
        deviceTokens: [
          { token: mockDeviceToken, platform: 'ios', registeredAt: new Date() },
        ],
      };

      jest.spyOn(User, 'findById').mockResolvedValue(mockUser as any);
      mockSend.mockResolvedValue('message-id');
      jest.spyOn(Notification, 'create').mockResolvedValue({} as any);

      // Act
      await notificationService.sendJobCompletionNotification(
        mockUserId,
        mockJobId,
        'note',
        'completed'
      );

      // Assert
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          jobId: mockJobId,
          jobType: 'note',
          status: 'completed',
          deliveryStatus: 'sent',
        })
      );
    });

    it('should handle FCM send failure gracefully', async () => {
      // Arrange
      const mockUser = {
        _id: mockUserId,
        deviceTokens: [
          { token: mockDeviceToken, platform: 'ios', registeredAt: new Date() },
        ],
      };

      jest.spyOn(User, 'findById').mockResolvedValue(mockUser as any);
      mockSend.mockRejectedValue(new Error('FCM error'));

      // Act
      const result = await notificationService.sendJobCompletionNotification(
        mockUserId,
        mockJobId,
        'note',
        'completed'
      );

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getNotificationStats', () => {
    it('should return notification statistics for user', async () => {
      // Arrange
      jest.spyOn(Notification, 'countDocuments')
        .mockResolvedValueOnce(5)  // total
        .mockResolvedValueOnce(3)  // sent
        .mockResolvedValueOnce(1)  // failed
        .mockResolvedValueOnce(1); // pending

      // Act
      const stats = await notificationService.getNotificationStats(mockUserId);

      // Assert
      expect(stats).toEqual({
        total: 5,
        sent: 3,
        failed: 1,
        pending: 1,
      });
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      jest.spyOn(Notification, 'countDocuments').mockRejectedValue(new Error('DB error'));

      // Act
      const stats = await notificationService.getNotificationStats(mockUserId);

      // Assert
      expect(stats).toEqual({
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0,
      });
    });
  });

  describe('retryFailedNotifications', () => {
    it('should retry failed notifications from last 24 hours', async () => {
      // Arrange
      const mockNotification = {
        _id: 'notif-123',
        userId: mockUserId,
        jobId: mockJobId,
        jobType: 'note',
        title: 'Test',
        body: 'Test body',
        deliveryStatus: 'failed',
        save: jest.fn(),
      };

      jest.spyOn(Notification, 'find').mockResolvedValue([mockNotification] as any);
      const mockUser = {
        _id: mockUserId,
        deviceTokens: [
          { token: mockDeviceToken, platform: 'ios', registeredAt: new Date() },
        ],
      };
      jest.spyOn(User, 'findById').mockResolvedValue(mockUser as any);
      mockSend.mockResolvedValue('message-id');

      // Act
      await notificationService.retryFailedNotifications();

      // Assert
      expect(Notification.find).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryStatus: 'failed',
        })
      );
      expect(mockNotification.save).toHaveBeenCalled();
    });
  });
});
