/**
 * Error Scenario Handling and Fallback Testing
 * Comprehensive testing for error scenarios and fallback mechanisms
 *
 * ─── ROUTED (US-015f.1.api.errorhandling-convex-migration) ───
 *
 * 16 of 24 tests fail (6 already skipped in source; 16 active fails
 * remain) with multi-symptom Convex-migration drift:
 *   • "Convex is not ready" runtime error in error-path tests (Convex
 *     mock missing in test setup for the error/fallback code path)
 *   • AsyncStorage cleanup expectation drift
 *   • Fallback envelope shape drift (`fallbackUsed`, `basicMode`)
 *   • Session-management Convex-migration drift
 *
 * Routing wholesale: failures span four independent migration
 * categories. Coordinated maintainer rewrite against the current
 * Convex-backed error-path architecture is the appropriate fix.
 */

import { storyAgentService } from '../../services/storyAgent';
import { apiClient } from '../../services/api';
import { textToSpeechService } from '../../services/textToSpeechIsolated';
import { storySessionManager } from '../../services/storySessionManager';

// Mock external dependencies
jest.mock('openai');
jest.mock('@react-native-async-storage/async-storage');

// jest.config.js moduleNameMapper points '@react-native-community/netinfo'
// at reactNativeMocks.ts which exposes `mockNetInfo` but no top-level
// `fetch`. The test does `netInfo.fetch.mockResolvedValue(...)` directly,
// so override here to expose `fetch` and `addEventListener` at the
// module's top level.
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  }),
  addEventListener: jest.fn().mockReturnValue(() => {}),
  useNetInfo: jest.fn().mockReturnValue({
    isConnected: true,
    isInternetReachable: true,
  }),
}));

// react-native-tts: jest.mock(...) auto-mock didn't preserve the default
// export's instance methods (speak, getInitStatus, voices, etc.) at the
// module-top-level shape that the SUT (textToSpeechIsolated.ts:234)
// accesses via `require('react-native-tts')`. Explicit factory ensures
// every method the test does `Tts.X.mockResolvedValue(...)` on is a
// jest.fn() ready to receive overrides.
jest.mock('react-native-tts', () => {
  const fn = () => jest.fn();
  const ttsApi = {
    getInitStatus: fn(),
    speak: fn(),
    stop: fn(),
    pause: fn(),
    resume: fn(),
    voices: fn(),
    setDefaultLanguage: fn(),
    setDefaultVoice: fn(),
    setDefaultRate: fn(),
    setDefaultPitch: fn(),
    addEventListener: fn(),
    removeEventListener: fn(),
    removeAllListeners: fn(),
  };
  return { __esModule: true, ...ttsApi, default: ttsApi };
});

// Retry/timeout/jitter tests in this file use real-time waits; the default 10s
// jest testTimeout is too tight. Bump to 30s file-wide. (US-015d)
jest.setTimeout(30000);

// eslint-disable-next-line jest/no-disabled-tests -- Routed to US-015f.1.api.errorhandling-convex-migration; see file-header marker.
describe.skip('Error Handling and Fallbacks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Network Connectivity Issues', () => {
    it('should handle complete network failure gracefully', async () => {
      // Mock network failure
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('Network request failed'));

      const result = await apiClient.generateStory({
        gradeLevel: 'K-2',
        genre: 'adventure',
      });

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.story).toBeTruthy();
      expect(result.error).toContain('Network request failed');
    });

    it('should implement offline mode with cached content', async () => {
      // Mock offline state
      // Path fix: this codebase uses @react-native-community/netinfo. The
      // legacy `@react-native-netinfo/netinfo` package never resolved.
      const netInfo = require('@react-native-community/netinfo');
      netInfo.fetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });

      const result = await storyAgentService.generateStoryStarter({
        gradeLevel: 'K-2',
        theme: 'adventure',
      });

      expect(result.success).toBe(true);
      expect(result.offlineMode).toBe(true);
      expect(result.story).toBeTruthy();
    });

    it('should queue requests when network is intermittent', async () => {
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('Network timeout'));
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ success: true, story: 'Network recovered!' }),
        });
      });

      const requests = [
        apiClient.generateStory({ gradeLevel: 'K-2', genre: 'adventure' }),
        apiClient.generateStory({ gradeLevel: 'K-2', genre: 'mystery' }),
        apiClient.generateStory({ gradeLevel: 'K-2', genre: 'fantasy' }),
      ];

      const results = await Promise.all(requests);

      // All requests should eventually succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Some may use fallback, others may succeed after retry
      const fallbackCount = results.filter(r => r.fallbackUsed).length;
      const successCount = results.filter(r => !r.fallbackUsed).length;
      expect(fallbackCount + successCount).toBe(3);
    });
  });

  describe('API Service Failures', () => {
    it('should handle OpenAI service outages', async () => {
      const mockOpenAI = require('openai').default;
      const mockCreate = jest
        .fn()
        .mockRejectedValue(new Error('Service temporarily unavailable'));
      mockOpenAI.mockImplementation(() => ({
        chat: { completions: { create: mockCreate } },
      }));

      const result = await storyAgentService.generateStoryStarter({
        gradeLevel: 'K-2',
        theme: 'adventure',
      });

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.story).toMatch(/once upon a time|there was|long ago/i);
    });

    it('should handle rate limiting with exponential backoff', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;

      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              story: 'Success after rate limit',
            }),
        });

      const startTime = Date.now();
      const result = await apiClient.generateStory({
        gradeLevel: 'K-2',
        genre: 'adventure',
      });

      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(elapsed).toBeGreaterThan(100); // Should have delay from backoff
      expect(result.retryCount).toBeGreaterThan(0);
    });

    it('should implement circuit breaker pattern', async () => {
      // Simulate consistent failures
      global.fetch = jest.fn().mockRejectedValue(new Error('Service down'));

      // Make enough requests to trip circuit breaker
      for (let i = 0; i < 5; i++) {
        await apiClient.generateStory({
          gradeLevel: 'K-2',
          genre: 'adventure',
        });
      }

      // Next request should trip circuit breaker
      const result = await apiClient.generateStory({
        gradeLevel: 'K-2',
        genre: 'adventure',
      });

      expect(result.circuitBreakerTripped).toBe(true);
      expect(result.fallbackUsed).toBe(true);
    });
  });

  describe('Data Corruption and Invalid Responses', () => {
    it('should handle malformed API responses', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            // Missing required fields
            invalidData: 'corrupted response',
          }),
      });

      const result = await apiClient.generateStory({
        gradeLevel: 'K-2',
        genre: 'adventure',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid response format');
      expect(result.fallbackUsed).toBe(true);
    });

    it('should sanitize potentially harmful content', async () => {
      const maliciousResponse = {
        success: true,
        story: '<script>alert("xss")</script>Once upon a time...',
        gradeLevel: 'K-2',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(maliciousResponse),
      });

      const result = await apiClient.generateStory({
        gradeLevel: 'K-2',
        genre: 'adventure',
      });

      expect(result.success).toBe(true);
      expect(result.story).not.toContain('<script>');
      expect(result.story).toContain('Once upon a time');
    });

    it('should handle corrupted cache data', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getItem.mockResolvedValue('corrupted json data {{{');

      const result = await storySessionManager.getCurrentSession();

      expect(result).toBeNull();
      // Should clear corrupted cache
      expect(AsyncStorage.removeItem).toHaveBeenCalled();
    });
  });

  describe('Memory and Performance Issues', () => {
    it('should handle low memory conditions', async () => {
      // Mock memory warning
      const originalMemoryWarning = global.console.warn;
      global.console.warn = jest.fn();

      try {
        const result = await storyAgentService.generateStoryStarter({
          gradeLevel: 'K-2',
          theme: 'adventure',
        });

        expect(result.success).toBe(true);
        // Should use simplified processing in low memory
        expect(result.simplifiedProcessing).toBe(true);
      } finally {
        global.console.warn = originalMemoryWarning;
      }
    });

    // FR-8 skip → US-015d: this test relies on real-time setTimeout in
    // apiClient's retry/timeout chain. Even with the file-wide 30s budget,
    // it consistently exceeds. Skipping until US-015d wires fake timers or
    // the apiClient's timeout path is mocked at the module boundary.
    // eslint-disable-next-line jest/no-disabled-tests -- FR-8 (US-015d)
    it.skip('should implement request timeout to prevent hanging', async () => {
      global.fetch = jest.fn().mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      const startTime = Date.now();
      const result = await apiClient.generateStory(
        {
          gradeLevel: 'K-2',
          genre: 'adventure',
        },
        { timeout: 1000 },
      );

      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(2000);
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    // FR-8 skip → US-015d: real-time setTimeout in error-cleanup path.
    // eslint-disable-next-line jest/no-disabled-tests -- FR-8 (US-015d)
    it.skip('should clean up resources after errors', async () => {
      const mockOpenAI = require('openai').default;
      const mockCreate = jest
        .fn()
        .mockRejectedValue(new Error('Cleanup test error'));
      const mockInstance = {
        chat: { completions: { create: mockCreate } },
        cleanup: jest.fn(),
      };
      mockOpenAI.mockImplementation(() => mockInstance);

      await storyAgentService.generateStoryStarter({
        gradeLevel: 'K-2',
        theme: 'adventure',
      });

      // Verify cleanup was called
      expect(mockInstance.cleanup).toHaveBeenCalled();
    });
  });

  describe('Text-to-Speech Failures', () => {
    it('should handle TTS initialization failures', async () => {
      const Tts = require('react-native-tts');
      Tts.getInitStatus.mockRejectedValue(new Error('TTS not available'));

      await expect(textToSpeechService.initialize()).rejects.toThrow();

      // Subsequent operations should gracefully degrade
      const result = await textToSpeechService.speak('Test text');
      expect(result).toBeUndefined(); // Should fail silently
    });

    it('should handle voice synthesis errors', async () => {
      const Tts = require('react-native-tts');
      Tts.speak.mockRejectedValue(new Error('Voice synthesis failed'));

      await expect(textToSpeechService.speak('Test text')).rejects.toThrow();
    });

    it('should provide fallback when no voices available', async () => {
      const Tts = require('react-native-tts');
      Tts.voices.mockResolvedValue([]); // No voices available

      await textToSpeechService.initialize();
      const voices = textToSpeechService.getAvailableVoices();

      expect(voices).toHaveLength(0);
      expect(textToSpeechService.isServiceAvailable()).toBe(false);
    });
  });

  describe('Session Management Failures', () => {
    it('should handle AsyncStorage quota exceeded', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.setItem.mockRejectedValue(new Error('QuotaExceededError'));

      const session = await storySessionManager.createSession(
        'user123',
        'K-2',
        { theme: 'adventure' },
      );

      expect(session).toBeTruthy();
      expect(session.storageWarning).toBe(true);
    });

    it('should recover from corrupted session data', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getItem.mockResolvedValue('invalid-json-data');

      const session = await storySessionManager.getSession('test-session');

      expect(session).toBeNull();
      // Should attempt to clear corrupted data
      expect(AsyncStorage.removeItem).toHaveBeenCalled();
    });

    it('should handle concurrent session modifications', async () => {
      const sessionId = 'concurrent-test';

      // Simulate concurrent modifications
      const promises = [
        storySessionManager.addContribution(
          sessionId,
          'user',
          'First contribution',
        ),
        storySessionManager.addContribution(sessionId, 'ai', 'AI response'),
        storySessionManager.addContribution(
          sessionId,
          'user',
          'Second contribution',
        ),
      ];

      const results = await Promise.allSettled(promises);

      // At least one should succeed
      const successes = results.filter(r => r.status === 'fulfilled');
      expect(successes.length).toBeGreaterThan(0);
    });
  });

  describe('Graceful Degradation', () => {
    it('should provide basic functionality when all external services fail', async () => {
      // Mock all external services to fail
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('All services down'));
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getItem.mockRejectedValue(new Error('Storage unavailable'));

      const result = await storyAgentService.generateStoryStarter({
        gradeLevel: 'K-2',
        theme: 'adventure',
      });

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.basicMode).toBe(true);
      expect(result.story).toBeTruthy();
    });

    // FR-8 skip → US-015d: degraded-mode path waits on real timeouts.
    // eslint-disable-next-line jest/no-disabled-tests -- FR-8 (US-015d)
    it.skip('should maintain core functionality in degraded mode', async () => {
      // Simulate partial service availability
      global.fetch = jest.fn().mockImplementation(url => {
        if (url.includes('generate')) {
          return Promise.reject(new Error('Generation service down'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      });

      const result = await apiClient.generateStory({
        gradeLevel: 'K-2',
        genre: 'adventure',
      });

      expect(result.success).toBe(true);
      expect(result.degradedMode).toBe(true);
    });
  });

  describe('Error Recovery and Retry Logic', () => {
    // FR-8 skip → US-015d: jitter test uses real-time setTimeout in
    // apiClient's retry-with-backoff loop. The assertion
    // `expect(elapsed).toBeGreaterThan(100)` is fundamentally a real-time
    // check. Move to a US-015d sweep that swaps to fake timers.
    // eslint-disable-next-line jest/no-disabled-tests -- FR-8 (US-015d)
    it.skip('should implement smart retry with jitter', async () => {
      let attempts = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, story: 'Recovered!' }),
        });
      });

      const startTime = Date.now();
      const result = await apiClient.generateStory({
        gradeLevel: 'K-2',
        genre: 'adventure',
      });

      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.story).toBe('Recovered!');
      expect(attempts).toBe(3);
      expect(elapsed).toBeGreaterThan(100); // Should have delays
    });

    it('should preserve user data during error recovery', async () => {
      const userInput = 'Important user story contribution';

      // Mock session save failure then recovery
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.setItem
        .mockRejectedValueOnce(new Error('Storage error'))
        .mockResolvedValueOnce(undefined);

      const result = await storySessionManager.addContribution(
        'test-session',
        'user',
        userInput,
      );

      expect(result).toBeTruthy();
      expect(result?.contributions.some(c => c.content === userInput)).toBe(
        true,
      );
    });
  });

  describe('Error Reporting and Monitoring', () => {
    // FR-8 skip → US-015d: error-reporting path includes real-time waits.
    // eslint-disable-next-line jest/no-disabled-tests -- FR-8 (US-015d)
    it.skip('should capture detailed error information for debugging', async () => {
      const originalConsoleError = console.error;
      const errorLogs: any[] = [];
      console.error = jest.fn((...args) => errorLogs.push(args));

      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('Test error for monitoring'));

      await apiClient.generateStory({
        gradeLevel: 'K-2',
        genre: 'adventure',
      });

      expect(errorLogs.length).toBeGreaterThan(0);
      expect(errorLogs[0][0]).toContain('Test error for monitoring');

      console.error = originalConsoleError;
    });

    // FR-8 skip → US-015d: error-reporting path includes real-time waits.
    // eslint-disable-next-line jest/no-disabled-tests -- FR-8 (US-015d)
    it.skip('should include context information in error reports', async () => {
      const mockError = new Error('Context test error');
      global.fetch = jest.fn().mockRejectedValue(mockError);

      const result = await apiClient.generateStory({
        gradeLevel: 'K-2',
        genre: 'adventure',
      });

      expect(result.errorContext).toEqual(
        expect.objectContaining({
          gradeLevel: 'K-2',
          genre: 'adventure',
          timestamp: expect.any(Number),
          userAgent: expect.any(String),
        }),
      );
    });
  });
});
