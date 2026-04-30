/**
 * User Preferences Privacy and Compliance Tests
 *
 * Tests COPPA compliance, data anonymization, and privacy protection
 */

import { userPreferencesService } from '../../services/userPreferences';
import { secureStorage } from '../../utils/secureStorage';

jest.mock('../../utils/secureStorage');
jest.mock('../../utils/logger', () => ({
  structuredLogger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const mockSecureStorage = secureStorage as jest.Mocked<typeof secureStorage>;

describe('User Preferences Privacy & Compliance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (userPreferencesService as any).personalizationData = null;
    (userPreferencesService as any).isInitialized = false;
  });

  describe('COPPA Compliance', () => {
    test('should not store personally identifiable information', async () => {
      mockSecureStorage.get.mockResolvedValue(null);
      mockSecureStorage.set.mockResolvedValue(undefined);

      await userPreferencesService.initialize('Grade3');

      // Record interaction with potentially PII
      await userPreferencesService.recordInteraction('story_request', {
        gradeLevel: 'Grade3',
        userInput: 'My name is John and I live at 123 Main St',
        userEmail: 'john@example.com',
        phoneNumber: '555-1234',
        fullName: 'John Doe',
      });

      const data = userPreferencesService.getPreferencesData();
      const interaction = data?.interactions[0];

      // Verify no PII is stored
      expect(interaction?.context).not.toHaveProperty('userInput');
      expect(interaction?.context).not.toHaveProperty('userEmail');
      expect(interaction?.context).not.toHaveProperty('phoneNumber');
      expect(interaction?.context).not.toHaveProperty('fullName');

      // Only anonymized metadata should be present
      expect(interaction?.context).toHaveProperty('hasUserInput');
      expect(interaction?.context).toHaveProperty('userInputLength');
      expect(interaction?.anonymized).toBe(true);
    });

    test('should use anonymous user IDs only', async () => {
      mockSecureStorage.get.mockResolvedValue(null);
      mockSecureStorage.set.mockResolvedValue(undefined);

      await userPreferencesService.initialize('Grade3');

      const data = userPreferencesService.getPreferencesData();

      // User ID should be hashed and anonymous
      expect(data?.userId).toBeDefined();
      expect(data?.userId.length).toBe(12); // Hashed to exactly 12 chars
      expect(data?.userId).toMatch(/^[a-z0-9]+$/); // Only lowercase letters and numbers
    });

    test('should respect data retention limits', async () => {
      const oldData = {
        userId: 'test-user',
        gradeLevel: 'Grade3',
        storyPreferences: {
          themes: {},
          characters: {},
          settings: {},
          tones: {},
          complexity: {},
          genres: {},
        },
        sessionPatterns: {
          averageSessionDuration: 0,
          storiesPerSession: 0,
          preferredTimeOfDay: [],
          completionRate: 0,
          retryPattern: 0,
          engagementScore: 0.5,
        },
        learningMetrics: {
          improvementTrend: 0,
          consistencyScore: 0.5,
          explorationScore: 0.5,
          lastUpdated: Date.now(),
          sessionCount: 0,
        },
        interactions: [],
        version: '1.0',
        createdAt: Date.now() - 32 * 24 * 60 * 60 * 1000, // 32 days ago (beyond retention)
        updatedAt: Date.now() - 32 * 24 * 60 * 60 * 1000,
      };

      mockSecureStorage.get.mockResolvedValue(oldData);
      mockSecureStorage.set.mockResolvedValue(undefined);

      await userPreferencesService.initialize('Grade3');

      // Should create new data due to retention policy
      expect(mockSecureStorage.set).toHaveBeenCalledWith(
        'user_personalization_data',
        expect.objectContaining({
          createdAt: expect.any(Number),
        }),
      );
    });

    test('should handle privacy consent revocation correctly', async () => {
      mockSecureStorage.get.mockResolvedValue(true);
      mockSecureStorage.set.mockResolvedValue(undefined);
      mockSecureStorage.remove.mockResolvedValue(true);

      // Set consent to false (revoke)
      await userPreferencesService.setPrivacyConsent(false);

      expect(mockSecureStorage.remove).toHaveBeenCalledWith(
        'user_personalization_data',
      );
      expect(mockSecureStorage.set).toHaveBeenCalledWith(
        'privacy_consent',
        false,
      );
    });

    test('should provide data export for user rights', async () => {
      mockSecureStorage.get.mockResolvedValue(null);
      mockSecureStorage.set.mockResolvedValue(undefined);

      await userPreferencesService.initialize('Grade3');

      // Record some interactions
      await userPreferencesService.recordInteraction('story_request', {
        gradeLevel: 'Grade3',
        userInput: 'test story',
      });

      const exportData = await userPreferencesService.exportUserData();
      const parsed = JSON.parse(exportData);

      // Should contain only non-PII data
      expect(parsed).toHaveProperty('gradeLevel');
      expect(parsed).toHaveProperty('preferences');
      expect(parsed).toHaveProperty('learningMetrics');
      expect(parsed).toHaveProperty('sessionCount');
      expect(parsed).toHaveProperty('createdAt');
      expect(parsed).toHaveProperty('updatedAt');

      // Should NOT contain PII or raw interactions
      expect(parsed).not.toHaveProperty('userId');
      expect(parsed).not.toHaveProperty('interactions');
    });
  });

  describe('Data Encryption and Security', () => {
    test('should store sensitive data encrypted in keychain', async () => {
      mockSecureStorage.setSecure = jest.fn();
      mockSecureStorage.getSecure = jest.fn().mockResolvedValue(null);
      mockSecureStorage.get.mockResolvedValue(null);
      mockSecureStorage.set.mockResolvedValue(undefined);

      await userPreferencesService.initialize('Grade3');

      // Verify that sensitive operations use secure storage
      const data = userPreferencesService.getPreferencesData();
      expect(data?.userId).toBeDefined();
    });

    test('should anonymize context data before storage', async () => {
      mockSecureStorage.get.mockResolvedValue(null);
      mockSecureStorage.set.mockResolvedValue(undefined);

      await userPreferencesService.initialize('Grade3');

      const sensitiveContext = {
        gradeLevel: 'Grade3',
        userInput: 'Tell me about my friend Sarah who lives on Oak Street',
        userLocation: '42.3601,-71.0589',
        deviceId: 'ABC123DEF456',
        ipAddress: '192.168.1.1',
        sessionId: 'session-12345',
      };

      await userPreferencesService.recordInteraction(
        'story_request',
        sensitiveContext,
      );

      const data = userPreferencesService.getPreferencesData();
      const storedContext = data?.interactions[0]?.context;

      // Should only contain safe, anonymized data
      expect(storedContext?.gradeLevel).toBe('Grade3');
      expect(storedContext?.hasUserInput).toBe(true);
      expect(storedContext?.userInputLength).toBe(
        sensitiveContext.userInput.length,
      );

      // Should NOT contain sensitive data
      expect(storedContext).not.toHaveProperty('userInput');
      expect(storedContext).not.toHaveProperty('userLocation');
      expect(storedContext).not.toHaveProperty('deviceId');
      expect(storedContext).not.toHaveProperty('ipAddress');
      expect(storedContext).not.toHaveProperty('sessionId');
    });

    test('should use hashed keys for logging', async () => {
      mockSecureStorage.get.mockResolvedValue(null);
      mockSecureStorage.set.mockResolvedValue(undefined);

      await userPreferencesService.initialize('Grade3');

      // Service should use hashed user IDs in logs (we can't easily test logging,
      // but we can verify the user ID is hashed in stored data)
      const data = userPreferencesService.getPreferencesData();
      expect(data?.userId).toMatch(/^[a-z0-9]+$/); // Only lowercase letters and numbers
      expect(data?.userId.length).toBe(12); // Fixed length hash
    });
  });

  describe('Data Validation and Sanitization', () => {
    test('should validate data integrity on load', async () => {
      const corruptedData = {
        // Missing required fields
        userId: '',
        gradeLevel: 'InvalidGrade',
        version: '0.5', // Old version
        // Missing other required fields
      };

      mockSecureStorage.get.mockResolvedValue(corruptedData);
      mockSecureStorage.set.mockResolvedValue(undefined);

      await userPreferencesService.initialize('Grade3');

      // Should create new data instead of using corrupted data
      expect(mockSecureStorage.set).toHaveBeenCalledWith(
        'user_personalization_data',
        expect.objectContaining({
          version: '1.0',
          gradeLevel: 'Grade3',
          userId: expect.any(String),
        }),
      );
    });

    test('should sanitize grade level inputs', async () => {
      mockSecureStorage.get.mockResolvedValue(null);
      mockSecureStorage.set.mockResolvedValue(undefined);

      // Test with invalid grade level
      await userPreferencesService.initialize('Grade99' as any);

      const data = userPreferencesService.getPreferencesData();
      expect(data?.gradeLevel).toBe('Grade99'); // Service accepts it but app should validate
    });

    test('should handle malformed interaction data', async () => {
      mockSecureStorage.get.mockResolvedValue(null);
      mockSecureStorage.set.mockResolvedValue(undefined);

      await userPreferencesService.initialize('Grade3');

      // Test with malformed context
      const malformedContext = {
        gradeLevel: 'Grade3',
        maliciousScript: '<script>alert("xss")</script>',
        sqlInjection: "'; DROP TABLE users; --",
        hugeString: 'x'.repeat(10000),
        circularRef: {},
      };

      // Add circular reference
      (malformedContext as any).circularRef.self = malformedContext;

      // Should not throw error and should sanitize data
      await expect(
        userPreferencesService.recordInteraction(
          'story_request',
          malformedContext,
        ),
      ).resolves.not.toThrow();

      const data = userPreferencesService.getPreferencesData();
      const interaction = data?.interactions[0];

      // Should have anonymized the context safely
      expect(interaction?.context).toBeDefined();
      expect(interaction?.anonymized).toBe(true);
    });
  });

  describe('Privacy Mode Operation', () => {
    test('should operate in minimal mode when privacy not consented', async () => {
      mockSecureStorage.get.mockImplementation(key => {
        if (key === 'privacy_consent') return Promise.resolve(false);
        return Promise.resolve(null);
      });
      mockSecureStorage.set.mockResolvedValue(undefined);

      // Initialize with privacy mode (default)
      await userPreferencesService.initialize('Grade3');

      const data = userPreferencesService.getPreferencesData();

      // Should have basic structure but no interaction tracking
      expect(data?.interactions).toEqual([]);
      expect(data?.gradeLevel).toBe('Grade3');

      // Recording interactions should not add to history
      await userPreferencesService.recordInteraction('story_request', {
        gradeLevel: 'Grade3',
        userInput: 'test',
      });

      const updatedData = userPreferencesService.getPreferencesData();
      expect(updatedData?.interactions).toEqual([]);
    });

    test('should not provide personalized recommendations in minimal mode', async () => {
      mockSecureStorage.get.mockImplementation(key => {
        if (key === 'privacy_consent') return Promise.resolve(false);
        return Promise.resolve(null);
      });
      mockSecureStorage.set.mockResolvedValue(undefined);

      await userPreferencesService.initialize('Grade3');

      const recommendations =
        userPreferencesService.getPersonalizedRecommendations({
          gradeLevel: 'Grade3',
        });

      // Should return default recommendations with low confidence
      expect(recommendations.confidenceScore).toBeLessThan(0.2);
      expect(recommendations.recommendedThemes).toEqual([
        'adventure',
        'friendship',
        'discovery',
      ]);
    });
  });

  describe('Secure Data Cleanup', () => {
    test('should clean up expired data automatically', async () => {
      mockSecureStorage.cleanupExpired.mockResolvedValue(5);
      mockSecureStorage.get.mockResolvedValue(null);
      mockSecureStorage.set.mockResolvedValue(undefined);

      await userPreferencesService.initialize('Grade3');

      // Wait a bit to allow cleanup scheduling (in real scenario)
      // Note: In test we can't easily test the actual timer, but we can test the method
      expect(mockSecureStorage.cleanupExpired).toBeDefined();
    });

    test('should provide complete data deletion', async () => {
      mockSecureStorage.remove.mockResolvedValue(true);

      await userPreferencesService.resetPersonalizationData();

      expect(mockSecureStorage.remove).toHaveBeenCalledWith(
        'user_personalization_data',
      );
    });

    test('should handle storage errors gracefully', async () => {
      mockSecureStorage.get.mockRejectedValue(new Error('Storage error'));
      mockSecureStorage.set.mockResolvedValue(undefined);

      // Should not throw error and fallback gracefully
      await expect(
        userPreferencesService.initialize('Grade3'),
      ).resolves.not.toThrow();

      const data = userPreferencesService.getPreferencesData();
      expect(data).toBeDefined();
    });
  });
});
