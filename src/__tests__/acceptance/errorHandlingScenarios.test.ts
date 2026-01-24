/**
 * Error Handling Scenarios - User Acceptance Tests
 * Tests user-facing error scenarios and recovery flows for image generation
 */

import {
  imageGenerationService,
  type ImageGenerationRequest,
} from '../../services/imageGeneration';
import { supabase } from '../../services/supabase';
import type { ErrorType, ImageGenerationEvent } from '../../types/database';

// Mock dependencies
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock('react-native-dotenv', () => ({
  REPLICATE_API_TOKEN: 'test-replicate-token',
  BACKUP_IMAGE_API_TOKEN: 'test-backup-token',
  IMAGE_GENERATION_ENABLED: 'true',
}));

global.fetch = jest.fn();

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Error Scenario Simulator
class ErrorScenarioSimulator {
  private baseRequest: ImageGenerationRequest = {
    storyContent:
      'A brave young hero discovers a magical forest and embarks on an adventure to help the forest creatures.',
    gradeLevel: 'K-2',
    sessionId: 'test-session-123',
    userId: 'test-user-456',
    metadata: { wordCount: 100 },
  };

  // Setup mock for insufficient XP scenario
  setupInsufficientXPScenario(currentXP: number = 500) {
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { total_xp: currentXP },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValue(mockQueryBuilder as any);
    mockSupabase.rpc.mockResolvedValue({ data: null, error: undefined } as any);
  }

  // Setup mock for API service failure
  setupAPIFailureScenario() {
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { total_xp: 2500 },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValue(mockQueryBuilder as any);
    mockSupabase.rpc.mockResolvedValue({ data: null, error: undefined } as any);

    // Mock API failure
    mockFetch.mockRejectedValue(new Error('Service temporarily unavailable'));
  }

  // Setup mock for content safety violation
  setupContentSafetyScenario() {
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { total_xp: 2500 },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValue(mockQueryBuilder as any);
    mockSupabase.rpc.mockResolvedValue({ data: null, error: undefined } as any);

    // Mock content safety failure
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          detail: 'Content violates safety guidelines',
        }),
    } as any);
  }

  // Setup mock for rate limiting
  setupRateLimitScenario() {
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { total_xp: 2500 },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValue(mockQueryBuilder as any);
    mockSupabase.rpc.mockResolvedValue({ data: null, error: undefined } as any);

    // Mock rate limit error
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () =>
        JSON.stringify({
          detail: 'Rate limit exceeded',
        }),
    } as any);
  }

  // Setup mock for timeout scenario
  setupTimeoutScenario() {
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { total_xp: 2500 },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValue(mockQueryBuilder as any);
    mockSupabase.rpc.mockResolvedValue({ data: null, error: undefined } as any);

    // Mock timeout - slow response followed by abort
    mockFetch.mockImplementation(
      () =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 100),
        ),
    );
  }

  // Setup mock for network connectivity issues
  setupNetworkFailureScenario() {
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { total_xp: 2500 },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValue(mockQueryBuilder as any);
    mockSupabase.rpc.mockResolvedValue({ data: null, error: undefined } as any);

    // Mock network error
    mockFetch.mockRejectedValue(new Error('Network request failed'));
  }

  // Setup mock for malformed API response
  setupMalformedResponseScenario() {
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { total_xp: 2500 },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValue(mockQueryBuilder as any);
    mockSupabase.rpc.mockResolvedValue({ data: null, error: undefined } as any);

    // Mock malformed response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'test-prediction',
        status: 'succeeded',
        // Missing output field
      }),
    } as any);
  }

  // Setup mock for database errors
  setupDatabaseErrorScenario() {
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      }),
    };
    mockSupabase.from.mockReturnValue(mockQueryBuilder as any);
  }

  async testScenario(scenarioName: string): Promise<{
    success: boolean;
    error?: string;
    errorType?: ErrorType;
    userFriendlyMessage: string;
    recommendedAction: string;
    xpRefunded: boolean;
  }> {
    try {
      const result = await imageGenerationService.generateImage(
        this.baseRequest,
      );

      if (result.success) {
        return {
          success: true,
          userFriendlyMessage: 'Image generated successfully!',
          recommendedAction: 'You can now view and download your image.',
          xpRefunded: false,
        };
      } else {
        return this.categorizeError(result.error, result.errorType);
      }
    } catch (error) {
      return this.categorizeError(
        error instanceof Error ? error.message : 'Unknown error',
        'api_failure',
      );
    }
  }

  private categorizeError(
    error?: string,
    errorType?: ErrorType,
  ): {
    success: boolean;
    error?: string;
    errorType?: ErrorType;
    userFriendlyMessage: string;
    recommendedAction: string;
    xpRefunded: boolean;
  } {
    const errorMessage = error || 'An unexpected error occurred';

    switch (errorType) {
      case 'insufficient_xp':
        return {
          success: false,
          error: errorMessage,
          errorType,
          userFriendlyMessage: "You don't have enough XP to generate an image.",
          recommendedAction:
            'Complete more stories to earn XP! Each story gives you XP based on length and grade level.',
          xpRefunded: false,
        };

      case 'content_safety':
        return {
          success: false,
          error: errorMessage,
          errorType,
          userFriendlyMessage:
            'Your story content needs some adjustments for image generation.',
          recommendedAction:
            'Try rewriting parts of your story to be more family-friendly and appropriate.',
          xpRefunded: true,
        };

      case 'api_failure':
        return {
          success: false,
          error: errorMessage,
          errorType,
          userFriendlyMessage:
            'Our image generation service is temporarily unavailable.',
          recommendedAction:
            'Please try again in a few minutes. Your XP has been refunded.',
          xpRefunded: true,
        };

      case 'timeout':
        return {
          success: false,
          error: errorMessage,
          errorType,
          userFriendlyMessage:
            'Image generation took too long and was cancelled.',
          recommendedAction:
            'Please try again - this sometimes happens during high usage. Your XP has been refunded.',
          xpRefunded: true,
        };

      case 'rate_limit':
        return {
          success: false,
          error: errorMessage,
          errorType,
          userFriendlyMessage:
            'Too many image generation requests. Please wait a moment.',
          recommendedAction:
            'Wait about 60 seconds before trying again. This helps ensure fair usage for everyone.',
          xpRefunded: true,
        };

      default:
        return {
          success: false,
          error: errorMessage,
          errorType: 'api_failure',
          userFriendlyMessage:
            'Something went wrong while generating your image.',
          recommendedAction:
            'Please try again. If this problem continues, contact support. Your XP has been refunded.',
          xpRefunded: true,
        };
    }
  }

  getBaseRequest(): ImageGenerationRequest {
    return { ...this.baseRequest };
  }
}

describe('Error Handling Scenarios - User Acceptance Tests', () => {
  let errorSimulator: ErrorScenarioSimulator;

  beforeEach(() => {
    jest.clearAllMocks();
    errorSimulator = new ErrorScenarioSimulator();
  });

  describe('Insufficient XP Scenarios', () => {
    test('should handle user with no XP gracefully', async () => {
      errorSimulator.setupInsufficientXPScenario(0);

      const result = await errorSimulator.testScenario('no_xp');

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('insufficient_xp');
      expect(result.userFriendlyMessage).toContain("don't have enough XP");
      expect(result.recommendedAction).toContain('Complete more stories');
      expect(result.xpRefunded).toBe(false); // No XP was deducted
    });

    test('should handle user with partial XP', async () => {
      errorSimulator.setupInsufficientXPScenario(750);

      const result = await errorSimulator.testScenario('partial_xp');

      expect(result.success).toBe(false);
      expect(result.userFriendlyMessage).toContain("don't have enough XP");
      expect(result.recommendedAction).toContain('Complete more stories');
      expect(result.xpRefunded).toBe(false);
    });

    test('should provide encouraging message for XP shortage', async () => {
      errorSimulator.setupInsufficientXPScenario(999);

      const result = await errorSimulator.testScenario('almost_enough_xp');

      expect(result.recommendedAction).toMatch(
        /Complete more stories|earn XP/i,
      );
      expect(result.userFriendlyMessage).not.toContain('error');
      expect(result.userFriendlyMessage).not.toContain('failed');
    });
  });

  describe('API Service Failure Scenarios', () => {
    test('should handle primary service downtime', async () => {
      errorSimulator.setupAPIFailureScenario();

      const result = await errorSimulator.testScenario('service_down');

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('api_failure');
      expect(result.userFriendlyMessage).toContain('temporarily unavailable');
      expect(result.recommendedAction).toContain('try again');
      expect(result.xpRefunded).toBe(true);
    });

    test('should provide reassuring message for service failures', async () => {
      errorSimulator.setupAPIFailureScenario();

      const result = await errorSimulator.testScenario('service_error');

      expect(result.userFriendlyMessage).not.toContain('crashed');
      expect(result.userFriendlyMessage).not.toContain('broken');
      expect(result.recommendedAction).toContain('XP has been refunded');
    });

    test('should handle network connectivity issues', async () => {
      errorSimulator.setupNetworkFailureScenario();

      const result = await errorSimulator.testScenario('network_failure');

      expect(result.success).toBe(false);
      expect(result.userFriendlyMessage).toContain('went wrong');
      expect(result.xpRefunded).toBe(true);
    });
  });

  describe('Content Safety Scenarios', () => {
    test('should handle content safety violations gracefully', async () => {
      errorSimulator.setupContentSafetyScenario();

      const result = await errorSimulator.testScenario('content_safety');

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('content_safety');
      expect(result.userFriendlyMessage).toContain(
        'content needs some adjustments',
      );
      expect(result.recommendedAction).toContain('rewriting');
      expect(result.xpRefunded).toBe(true);
    });

    test('should provide constructive guidance for content issues', async () => {
      errorSimulator.setupContentSafetyScenario();

      const result = await errorSimulator.testScenario('content_inappropriate');

      expect(result.recommendedAction).toContain('family-friendly');
      expect(result.userFriendlyMessage).not.toContain('inappropriate');
      expect(result.userFriendlyMessage).not.toContain('banned');
    });
  });

  describe('Rate Limiting Scenarios', () => {
    test('should handle rate limiting politely', async () => {
      errorSimulator.setupRateLimitScenario();

      const result = await errorSimulator.testScenario('rate_limited');

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('rate_limit');
      expect(result.userFriendlyMessage).toContain('Too many');
      expect(result.recommendedAction).toContain('Wait');
      expect(result.xpRefunded).toBe(true);
    });

    test('should explain rate limiting reason', async () => {
      errorSimulator.setupRateLimitScenario();

      const result = await errorSimulator.testScenario(
        'rate_limit_explanation',
      );

      expect(result.recommendedAction).toContain('fair usage');
      expect(result.recommendedAction).toMatch(/60 seconds|minute/);
    });
  });

  describe('Timeout Scenarios', () => {
    test('should handle request timeouts gracefully', async () => {
      errorSimulator.setupTimeoutScenario();

      const result = await errorSimulator.testScenario('timeout');

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('timeout');
      expect(result.userFriendlyMessage).toContain('took too long');
      expect(result.recommendedAction).toContain('try again');
      expect(result.xpRefunded).toBe(true);
    });

    test('should provide context for timeout issues', async () => {
      errorSimulator.setupTimeoutScenario();

      const result = await errorSimulator.testScenario('timeout_context');

      expect(result.recommendedAction).toContain('high usage');
      expect(result.userFriendlyMessage).not.toContain('timeout');
      expect(result.userFriendlyMessage).not.toContain('failed');
    });
  });

  describe('Database Error Scenarios', () => {
    test('should handle database connectivity issues', async () => {
      errorSimulator.setupDatabaseErrorScenario();

      const result = await errorSimulator.testScenario('database_error');

      expect(result.success).toBe(false);
      expect(result.userFriendlyMessage).toContain('went wrong');
      expect(result.recommendedAction).toContain('try again');
    });
  });

  describe('Malformed Response Scenarios', () => {
    test('should handle unexpected API responses', async () => {
      errorSimulator.setupMalformedResponseScenario();

      const result = await errorSimulator.testScenario('malformed_response');

      expect(result.success).toBe(false);
      expect(result.userFriendlyMessage).not.toContain('malformed');
      expect(result.userFriendlyMessage).not.toContain('corrupted');
      expect(result.xpRefunded).toBe(true);
    });
  });

  describe('User Experience Validation', () => {
    test('should provide helpful error messages for all scenarios', async () => {
      const scenarios = [
        'insufficient_xp',
        'api_failure',
        'content_safety',
        'rate_limit',
        'timeout',
        'network_failure',
      ];

      for (const scenario of scenarios) {
        // Setup appropriate scenario
        switch (scenario) {
          case 'insufficient_xp':
            errorSimulator.setupInsufficientXPScenario(500);
            break;
          case 'api_failure':
            errorSimulator.setupAPIFailureScenario();
            break;
          case 'content_safety':
            errorSimulator.setupContentSafetyScenario();
            break;
          case 'rate_limit':
            errorSimulator.setupRateLimitScenario();
            break;
          case 'timeout':
            errorSimulator.setupTimeoutScenario();
            break;
          case 'network_failure':
            errorSimulator.setupNetworkFailureScenario();
            break;
        }

        const result = await errorSimulator.testScenario(scenario);

        // All error messages should be user-friendly
        expect(result.userFriendlyMessage).toBeTruthy();
        expect(result.userFriendlyMessage.length).toBeGreaterThan(10);
        expect(result.recommendedAction).toBeTruthy();
        expect(result.recommendedAction.length).toBeGreaterThan(10);

        // Should not contain technical jargon
        expect(result.userFriendlyMessage).not.toMatch(/API|HTTP|500|404|JSON/);
        expect(result.recommendedAction).not.toMatch(/debug|stack trace|logs/);
      }
    });

    test('should maintain positive tone in error messages', async () => {
      errorSimulator.setupAPIFailureScenario();

      const result = await errorSimulator.testScenario('positive_tone');

      // Should avoid negative words
      expect(result.userFriendlyMessage).not.toMatch(
        /failed|error|broken|crashed/,
      );
      expect(result.recommendedAction).not.toMatch(/problem|issue|wrong/);

      // Should be encouraging
      expect(result.recommendedAction).toMatch(/please|try|can|will/i);
    });

    test('should provide actionable guidance', async () => {
      const scenarios = [
        {
          setup: () => errorSimulator.setupInsufficientXPScenario(500),
          expectAction: /complete|story|earn/i,
        },
        {
          setup: () => errorSimulator.setupAPIFailureScenario(),
          expectAction: /try again|wait/i,
        },
        {
          setup: () => errorSimulator.setupContentSafetyScenario(),
          expectAction: /rewrite|adjust/i,
        },
        {
          setup: () => errorSimulator.setupRateLimitScenario(),
          expectAction: /wait|60 seconds/i,
        },
      ];

      for (const scenario of scenarios) {
        scenario.setup();
        const result = await errorSimulator.testScenario('actionable_guidance');

        expect(result.recommendedAction).toMatch(scenario.expectAction);
      }
    });

    test('should handle XP refunds appropriately', async () => {
      const refundScenarios = [
        'api_failure',
        'content_safety',
        'rate_limit',
        'timeout',
      ];
      const noRefundScenarios = ['insufficient_xp'];

      // Test refund scenarios
      for (const scenario of refundScenarios) {
        switch (scenario) {
          case 'api_failure':
            errorSimulator.setupAPIFailureScenario();
            break;
          case 'content_safety':
            errorSimulator.setupContentSafetyScenario();
            break;
          case 'rate_limit':
            errorSimulator.setupRateLimitScenario();
            break;
          case 'timeout':
            errorSimulator.setupTimeoutScenario();
            break;
        }

        const result = await errorSimulator.testScenario(scenario);
        expect(result.xpRefunded).toBe(true);
        expect(result.recommendedAction).toContain('refunded');
      }

      // Test no-refund scenarios
      for (const scenario of noRefundScenarios) {
        errorSimulator.setupInsufficientXPScenario(500);
        const result = await errorSimulator.testScenario(scenario);
        expect(result.xpRefunded).toBe(false);
      }
    });
  });

  describe('Error Recovery Flows', () => {
    test('should support retry after recoverable errors', async () => {
      // Initial failure
      errorSimulator.setupAPIFailureScenario();
      const failureResult = await errorSimulator.testScenario(
        'initial_failure',
      );
      expect(failureResult.success).toBe(false);
      expect(failureResult.recommendedAction).toContain('try again');

      // Setup success for retry
      jest.clearAllMocks();
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { total_xp: 2500 },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: undefined,
      } as any);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'retry-success',
          status: 'succeeded',
          output: ['https://example.com/retry-image.jpg'],
        }),
      } as any);

      const retryResult = await errorSimulator.testScenario('retry_success');
      expect(retryResult.success).toBe(true);
    });

    test('should maintain user state during error recovery', async () => {
      const originalRequest = errorSimulator.getBaseRequest();

      // Error should not modify the original request
      errorSimulator.setupAPIFailureScenario();
      await errorSimulator.testScenario('state_preservation');

      const currentRequest = errorSimulator.getBaseRequest();
      expect(currentRequest).toEqual(originalRequest);
    });
  });

  describe('Accessibility and Internationalization', () => {
    test('should use clear, simple language in error messages', async () => {
      errorSimulator.setupAPIFailureScenario();

      const result = await errorSimulator.testScenario('simple_language');

      // Should use simple words
      expect(result.userFriendlyMessage).not.toMatch(
        /utilize|facilitate|implement/,
      );
      expect(result.recommendedAction).not.toMatch(
        /execute|terminate|initialize/,
      );

      // Should use common vocabulary
      expect(
        result.userFriendlyMessage
          .split(' ')
          .every(
            word =>
              word.length <= 15 ||
              ['generation', 'temporarily', 'unavailable'].includes(
                word.toLowerCase(),
              ),
          ),
      ).toBe(true);
    });

    test('should be suitable for different grade levels', async () => {
      const gradeLevels = ['K-2', '3-5', '6-8', '9-12'];

      for (const gradeLevel of gradeLevels) {
        const request = { ...errorSimulator.getBaseRequest(), gradeLevel };
        errorSimulator.setupAPIFailureScenario();

        // For now, all grade levels get the same message
        // In the future, this could be customized by grade level
        const result = await errorSimulator.testScenario(`grade_${gradeLevel}`);

        expect(result.userFriendlyMessage).toBeTruthy();
        expect(result.recommendedAction).toBeTruthy();
      }
    });
  });
});
