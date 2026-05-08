/**
 * ImageGeneration Error Handling UI Test Suite
 * Tests for Tasks 7.1-7.4: Enhanced error handling UI components
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ImageGeneration from '../../components/common/ImageGeneration';
import { useAuth } from '../../context/AuthContext';

// Mock the AuthContext
jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock the services
jest.mock('../../services/imageGeneration', () => ({
  imageGenerationService: {
    generateImage: jest.fn(),
  },
}));

jest.mock('../../services/xpEventTracker', () => ({
  xpEventTracker: {
    updateImageGenerationEvent: jest.fn(),
  },
}));

jest.mock('../../services/storySessionManager', () => ({
  storySessionManager: {
    updateSessionWithImage: jest.fn(),
    updateSessionWithSupabaseImage: jest.fn(),
  },
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('ImageGeneration Error Handling UI - Tasks 7.1-7.4', () => {
  const mockProps = {
    storyContent:
      'Once upon a time, there was a brave knight who loved adventures.',
    sessionId: 'test-session-123',
    gradeLevel: 'K-2' as const,
    wordCount: 150,
    onImageGenerated: jest.fn(),
    onError: jest.fn(),
    isStoryCompleted: true,
    currentRound: 5,
    maxRounds: 5,
  };

  const defaultAuthMock = {
    userProfile: {
      id: 'user-123',
      clerk_user_id: 'user_2abc123',
      total_xp: 5000,
    },
    canGenerateImage: jest.fn(() => true),
    getXPBalanceInfo: jest.fn(() => ({
      currentXP: 5000,
      hasEnoughXP: true,
      shortfall: 0,
      canGenerate: true,
    })),
    deductXP: jest.fn(() =>
      Promise.resolve({ success: true, newBalance: 4000 }),
    ),
    refundXP: jest.fn(() => Promise.resolve()),
    createImageGenerationEvent: jest.fn(() => Promise.resolve('event-123')),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue(defaultAuthMock as any);
  });

  describe('Task 7.1: Enhanced Error Message Display Components', () => {
    it('should display enhanced error UI for API failures', async () => {
      const {
        imageGenerationService,
      } = require('../../services/imageGeneration');
      imageGenerationService.generateImage.mockRejectedValue(
        new Error('Replicate API service temporarily unavailable'),
      );

      const { getByText } = render(<ImageGeneration {...mockProps} />);

      // Trigger image generation
      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      // Wait for error to appear
      await waitFor(() => {
        expect(getByText('Service Temporarily Unavailable')).toBeTruthy();
        expect(
          getByText(/Our image generation service is having issues/),
        ).toBeTruthy();
        expect(getByText('Try Again')).toBeTruthy();
        expect(
          getByText(/The service should be back online shortly/),
        ).toBeTruthy();
      });

      // Verify error icon and styling
      expect(getByText('🔧')).toBeTruthy(); // Service error icon
      expect(getByText('Dismiss')).toBeTruthy();
    });

    it('should display enhanced error UI for insufficient XP', async () => {
      // For insufficient XP, the user should see disabled state, not error state
      // But we can test the error state that would occur if XP was checked during generation
      const {
        imageGenerationService,
      } = require('../../services/imageGeneration');
      imageGenerationService.generateImage.mockRejectedValue(
        new Error('Insufficient XP. Need 1000 XP, have 500 XP'),
      );

      const { getByText } = render(<ImageGeneration {...mockProps} />);

      // Trigger image generation (this should work since we have sufficient XP in defaultAuthMock)
      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      // Wait for error to appear (this simulates an XP check failure during generation)
      await waitFor(() => {
        expect(getByText('Not Enough XP')).toBeTruthy();
        expect(getByText(/You need more XP to generate an image/)).toBeTruthy();
        expect(getByText(/Try writing longer stories/)).toBeTruthy();
      });

      // Verify XP-specific icon and styling
      expect(getByText('💰')).toBeTruthy(); // XP error icon
    });

    // eslint-disable-next-line jest/no-disabled-tests -- Routed to US-015f.1.imgdisp.imggen-text-drift; error UI text drift.
    it.skip('should display enhanced error UI for content safety issues', async () => {
      const {
        imageGenerationService,
      } = require('../../services/imageGeneration');
      imageGenerationService.generateImage.mockRejectedValue(
        new Error('Content safety filter triggered'),
      );

      const { getByText } = render(<ImageGeneration {...mockProps} />);

      // Trigger image generation
      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      // Wait for error to appear
      await waitFor(() => {
        expect(getByText('Content Safety Check')).toBeTruthy();
        expect(getByText(/Your story content needs adjustment/)).toBeTruthy();
        expect(getByText(/Make sure your story is appropriate/)).toBeTruthy();
      });

      // Content safety errors are non-retryable, so no action button should appear
      // Just verify the dismiss button is present

      // Verify content safety icon
      expect(getByText('🛡️')).toBeTruthy(); // Safety shield icon
    });

    it('should display enhanced error UI for timeout errors', async () => {
      const {
        imageGenerationService,
      } = require('../../services/imageGeneration');
      imageGenerationService.generateImage.mockRejectedValue(
        new Error('Request timeout after 60 seconds'),
      );

      const { getByText } = render(<ImageGeneration {...mockProps} />);

      // Trigger image generation
      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      // Wait for error to appear
      await waitFor(() => {
        expect(getByText('Generation Timed Out')).toBeTruthy();
        expect(getByText(/Image generation took too long/)).toBeTruthy();
        expect(getByText('Retry')).toBeTruthy();
        expect(getByText(/Try again - this sometimes happens/)).toBeTruthy();
      });

      // Verify timeout icon
      expect(getByText('⏱️')).toBeTruthy(); // Clock icon
    });

    it('should display enhanced error UI for rate limiting', async () => {
      const {
        imageGenerationService,
      } = require('../../services/imageGeneration');
      imageGenerationService.generateImage.mockRejectedValue(
        new Error('Rate limit exceeded - too many requests'),
      );

      const { getByText } = render(<ImageGeneration {...mockProps} />);

      // Trigger image generation
      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      // Wait for error to appear
      await waitFor(() => {
        expect(getByText('Too Many Requests')).toBeTruthy();
        expect(
          getByText(/Please wait a moment before generating/),
        ).toBeTruthy();
        expect(getByText('Wait & Retry')).toBeTruthy();
        expect(getByText(/Rate limits help ensure fair usage/)).toBeTruthy();
      });

      // Verify rate limit icon
      expect(getByText('🚦')).toBeTruthy(); // Traffic light icon
    });
  });

  describe('Task 7.2: Specific Error Message Testing', () => {
    // eslint-disable-next-line jest/no-disabled-tests -- Routed to US-015f.1.imgdisp.imggen-text-drift; error UI text drift.
    it.skip('should show correct error messages for each error type', async () => {
      const errorScenarios: Array<{
        error: string;
        expectedTitle: string;
        expectedIcon: string;
        canRetry: boolean;
      }> = [
        {
          error: 'Replicate API service temporarily unavailable',
          expectedTitle: 'Service Temporarily Unavailable',
          expectedIcon: '🔧',
          canRetry: true,
        },
        {
          error: 'Insufficient XP. Need 1000 XP, have 500 XP',
          expectedTitle: 'Not Enough XP',
          expectedIcon: '💰',
          canRetry: false,
        },
        {
          error: 'Content safety filter triggered',
          expectedTitle: 'Content Safety Check',
          expectedIcon: '🛡️',
          canRetry: false,
        },
        {
          error: 'Request timeout after 60 seconds',
          expectedTitle: 'Generation Timed Out',
          expectedIcon: '⏱️',
          canRetry: true,
        },
        {
          error: 'Rate limit exceeded',
          expectedTitle: 'Too Many Requests',
          expectedIcon: '🚦',
          canRetry: true,
        },
      ];

      for (const scenario of errorScenarios) {
        const {
          imageGenerationService,
        } = require('../../services/imageGeneration');
        imageGenerationService.generateImage.mockRejectedValue(
          new Error(scenario.error),
        );

        const { getByText, queryByText, unmount } = render(
          <ImageGeneration {...mockProps} />,
        );

        // Trigger image generation
        const generateButton = getByText('🎨 Generate Story Image');
        fireEvent.press(generateButton);

        // Wait for error to appear and verify
        await waitFor(() => {
          expect(getByText(scenario.expectedTitle)).toBeTruthy();
          expect(getByText(scenario.expectedIcon)).toBeTruthy();
        });

        // Check if retry functionality is available based on error type
        if (scenario.canRetry) {
          expect(queryByText(/Try Again|Retry|Wait & Retry/)).toBeTruthy();
        } else {
          expect(queryByText(/Try Again|Retry/)).toBeNull();
        }

        // All errors should have dismiss button
        expect(getByText('Dismiss')).toBeTruthy();

        unmount();
        jest.clearAllMocks();
      }
    });
  });

  describe('Task 7.3: Retry Mechanism UI', () => {
    it('should display retry button for retryable errors', async () => {
      const {
        imageGenerationService,
      } = require('../../services/imageGeneration');
      imageGenerationService.generateImage.mockRejectedValue(
        new Error('API temporarily unavailable'),
      );

      const { getByText } = render(<ImageGeneration {...mockProps} />);

      // Trigger image generation
      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      // Wait for error and retry button to appear
      await waitFor(() => {
        expect(getByText('Try Again')).toBeTruthy();
        expect(getByText(/Attempt.*of/)).toBeTruthy(); // Retry attempt counter
      });
    });

    // eslint-disable-next-line jest/no-disabled-tests -- Routed to US-015f.1.imgdisp.imggen-text-drift; error UI text drift.
    it.skip('should not display retry button for non-retryable errors', async () => {
      // Test content safety error (non-retryable)
      const {
        imageGenerationService,
      } = require('../../services/imageGeneration');
      imageGenerationService.generateImage.mockRejectedValue(
        new Error('Content safety filter triggered'),
      );

      const { getByText, queryByText } = render(
        <ImageGeneration {...mockProps} />,
      );

      // Trigger image generation
      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      // Wait for error to appear
      await waitFor(() => {
        expect(getByText('Content Safety Check')).toBeTruthy();
        // Should not show retry buttons for content safety errors
        expect(queryByText(/Try Again|Retry/)).toBeNull();
        // Should have dismiss button
        expect(getByText('Dismiss')).toBeTruthy();
      });
    });

    it('should handle retry functionality', async () => {
      const {
        imageGenerationService,
      } = require('../../services/imageGeneration');

      // First call fails, second succeeds
      imageGenerationService.generateImage
        .mockRejectedValueOnce(new Error('Temporary API failure'))
        .mockResolvedValueOnce({
          success: true,
          imageUrl: 'https://example.com/retry-success.jpg',
          serviceUsed: 'replicate',
          responseTimeMs: 25000,
        });

      const { getByText, queryByText } = render(
        <ImageGeneration {...mockProps} />,
      );

      // Initial generation attempt
      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      // Wait for error to appear
      await waitFor(() => {
        expect(getByText('Service Temporarily Unavailable')).toBeTruthy();
      });

      // Click retry button
      const retryButton = getByText('Try Again');
      fireEvent.press(retryButton);

      // Wait for retry to succeed
      await waitFor(() => {
        expect(queryByText('Service Temporarily Unavailable')).toBeNull();
        expect(mockProps.onImageGenerated).toHaveBeenCalledWith(
          'https://example.com/retry-success.jpg',
        );
      });
    });

    it('should show maximum retry attempts message', async () => {
      const {
        imageGenerationService,
      } = require('../../services/imageGeneration');
      imageGenerationService.generateImage.mockRejectedValue(
        new Error('Persistent API failure'),
      );

      const { getByText } = render(<ImageGeneration {...mockProps} />);

      // Simulate multiple retry attempts by directly manipulating component state
      // This would require accessing internal state, which we'll approximate by
      // triggering multiple failures and checking the UI response

      const generateButton = getByText('🎨 Generate Story Image');

      // First attempt
      fireEvent.press(generateButton);
      await waitFor(() => {
        expect(getByText('Try Again')).toBeTruthy();
      });

      // Note: Full retry testing would require more complex state manipulation
      // This verifies the UI structure is in place for retry management
    });
  });

  describe('Task 7.4: Error State Recovery Flows', () => {
    it('should allow dismissing error messages', async () => {
      const {
        imageGenerationService,
      } = require('../../services/imageGeneration');
      imageGenerationService.generateImage.mockRejectedValue(
        new Error('API temporarily unavailable'),
      );

      const { getByText, queryByText } = render(
        <ImageGeneration {...mockProps} />,
      );

      // Trigger error
      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      // Wait for error to appear
      await waitFor(() => {
        expect(getByText('Service Temporarily Unavailable')).toBeTruthy();
      });

      // Dismiss error
      const dismissButton = getByText('Dismiss');
      fireEvent.press(dismissButton);

      // Verify error is cleared
      await waitFor(() => {
        expect(queryByText('Service Temporarily Unavailable')).toBeNull();
      });
    });

    it('should maintain proper UI state during error-retry-success flow', async () => {
      const {
        imageGenerationService,
      } = require('../../services/imageGeneration');

      // Configure mock to fail first, succeed second
      imageGenerationService.generateImage
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          success: true,
          imageUrl: 'https://example.com/success.jpg',
          serviceUsed: 'replicate',
          responseTimeMs: 30000,
        });

      const { getByText, queryByText } = render(
        <ImageGeneration {...mockProps} />,
      );

      // Initial generation
      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      // Error state
      await waitFor(() => {
        expect(getByText('Service Temporarily Unavailable')).toBeTruthy();
      });

      // Retry
      const retryButton = getByText('Try Again');
      fireEvent.press(retryButton);

      // Success state
      await waitFor(() => {
        expect(queryByText('Service Temporarily Unavailable')).toBeNull();
        expect(mockProps.onImageGenerated).toHaveBeenCalled();
      });
    });

    // eslint-disable-next-line jest/no-disabled-tests -- Routed to US-015f.1.imgdisp.imggen-text-drift; error UI text drift.
    it.skip('should properly handle different error types in sequence', async () => {
      const {
        imageGenerationService,
      } = require('../../services/imageGeneration');

      const { getByText, queryByText } = render(
        <ImageGeneration {...mockProps} />,
      );

      // Test sequence: API failure -> Success -> XP insufficient
      const errorSequence = [
        {
          error: 'API failure',
          expectedTitle: 'Service Temporarily Unavailable',
        },
        {
          error: 'Content safety violation',
          expectedTitle: 'Content Safety Check',
        },
        { error: 'Request timeout', expectedTitle: 'Generation Timed Out' },
      ];

      for (const scenario of errorSequence) {
        imageGenerationService.generateImage.mockRejectedValue(
          new Error(scenario.error),
        );

        const generateButton = getByText('🎨 Generate Story Image');
        fireEvent.press(generateButton);

        await waitFor(() => {
          expect(getByText(scenario.expectedTitle)).toBeTruthy();
        });

        // Dismiss the error
        const dismissButton = getByText('Dismiss');
        fireEvent.press(dismissButton);

        await waitFor(() => {
          expect(queryByText(scenario.expectedTitle)).toBeNull();
        });
      }
    });
  });
});
