/**
 * ImageGeneration Component Unit Tests
 * Tests the React component logic, state management, and user interactions
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ImageGeneration from '../../components/common/ImageGeneration';
import * as AuthContext from '../../context/AuthContext';
import { imageGenerationService } from '../../services/imageGeneration';

// Mock dependencies
jest.mock('react-native-url-polyfill/auto', () => {});
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));
jest.mock('../../context/AuthContext');
jest.mock('../../services/imageGeneration');
jest.mock('../../services/xpEventTracker');
jest.mock('../../services/storySessionManager');

// Mock React Native modules
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Alert: {
      alert: jest.fn(),
    },
    Animated: {
      ...RN.Animated,
      Value: jest.fn(() => ({
        setValue: jest.fn(),
        stopAnimation: jest.fn(),
      })),
      loop: jest.fn(() => ({ start: jest.fn() })),
      sequence: jest.fn(() => ({ start: jest.fn() })),
      timing: jest.fn(() => ({ start: jest.fn() })),
    },
  };
});

const mockUseAuth = AuthContext.useAuth as jest.MockedFunction<
  typeof AuthContext.useAuth
>;
const mockImageGenerationService = imageGenerationService as jest.Mocked<
  typeof imageGenerationService
>;
const mockAlert = Alert.alert as jest.MockedFunction<typeof Alert.alert>;

describe('ImageGeneration Component - Unit Tests', () => {
  const defaultProps = {
    storyContent:
      'Once upon a time, there was a brave knight who discovered a magical forest.',
    sessionId: 'test-session-123',
    gradeLevel: 'K-2',
    wordCount: 50,
    onImageGenerated: jest.fn(),
    onError: jest.fn(),
    disabled: false,
  };

  const mockAuthContext = {
    userProfile: {
      id: 'test-user-123',
      username: 'testuser',
      total_xp: 2500,
    },
    canGenerateImage: jest.fn(() => true),
    getXPBalanceInfo: jest.fn(() => ({
      hasEnoughXP: true,
      currentXP: 2500,
      shortfall: 0,
      canGenerate: true,
      maxGenerations: 2,
    })),
    deductXP: jest.fn(),
    refundXP: jest.fn(),
    createImageGenerationEvent: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue(mockAuthContext as any);
    mockImageGenerationService.generateImage.mockResolvedValue({
      success: true,
      imageUrl: 'https://example.com/generated-image.jpg',
      serviceUsed: 'replicate',
      responseTimeMs: 30000,
    });
  });

  describe('Component Rendering', () => {
    test('should render XP balance display correctly', () => {
      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      expect(getByText('Your XP:')).toBeTruthy();
      expect(getByText('2,500')).toBeTruthy();
      expect(getByText('(Cost: 1,000 XP)')).toBeTruthy();
    });

    test('should render generation button when user has sufficient XP', () => {
      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      const generateButton = getByText('🎨 Generate Story Image');
      expect(generateButton).toBeTruthy();
    });

    test('should render insufficient XP warning when balance is low', () => {
      mockAuthContext.getXPBalanceInfo.mockReturnValue({
        hasEnoughXP: false,
        currentXP: 500,
        shortfall: 500,
        canGenerate: false,
        maxGenerations: 0,
      });

      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      expect(getByText('Need 500 more XP')).toBeTruthy();
    });

    test('should render disabled state when component is disabled', () => {
      const { getByText } = render(
        <ImageGeneration {...defaultProps} disabled={true} />,
      );

      expect(getByText('Image Generation Locked')).toBeTruthy();
      expect(
        getByText('Image generation is currently unavailable.'),
      ).toBeTruthy();
    });

    test('should display loading state during image generation', () => {
      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      expect(getByText('Generating...')).toBeTruthy();
      expect(getByText('Creating Your Illustration')).toBeTruthy();
    });
  });

  describe('User Interactions', () => {
    test('should handle generate button press correctly', async () => {
      mockAuthContext.createImageGenerationEvent.mockResolvedValue('event-123');
      mockAuthContext.deductXP.mockResolvedValue({
        success: true,
        newBalance: 1500,
      });

      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      await waitFor(() => {
        expect(mockAuthContext.createImageGenerationEvent).toHaveBeenCalledWith(
          'test-session-123',
          'K-2',
          50,
        );
        expect(mockAuthContext.deductXP).toHaveBeenCalledWith(
          1000,
          'AI story illustration generation',
        );
      });
    });

    test('should prevent multiple simultaneous generations', () => {
      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      const generateButton = getByText('🎨 Generate Story Image');

      // Press button multiple times rapidly
      fireEvent.press(generateButton);
      fireEvent.press(generateButton);
      fireEvent.press(generateButton);

      // Should only call once
      expect(mockAuthContext.createImageGenerationEvent).toHaveBeenCalledTimes(
        1,
      );
    });

    test('should disable button when user lacks sufficient XP', () => {
      mockAuthContext.getXPBalanceInfo.mockReturnValue({
        hasEnoughXP: false,
        currentXP: 500,
        shortfall: 500,
        canGenerate: false,
        maxGenerations: 0,
      });

      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      const generateButton = getByText('🎨 Generate Story Image');

      // Button should be disabled (pressing should not trigger generation)
      fireEvent.press(generateButton);
      expect(mockAuthContext.createImageGenerationEvent).not.toHaveBeenCalled();
    });

    test('should handle successful image generation', async () => {
      mockAuthContext.createImageGenerationEvent.mockResolvedValue('event-123');
      mockAuthContext.deductXP.mockResolvedValue({
        success: true,
        newBalance: 1500,
      });

      const onImageGenerated = jest.fn();
      const { getByText } = render(
        <ImageGeneration
          {...defaultProps}
          onImageGenerated={onImageGenerated}
        />,
      );

      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      await waitFor(() => {
        expect(mockImageGenerationService.generateImage).toHaveBeenCalledWith({
          storyContent: defaultProps.storyContent,
          gradeLevel: 'K-2',
          sessionId: 'test-session-123',
          userId: 'test-user-123',
          metadata: {
            wordCount: 50,
          },
        });
      });

      await waitFor(() => {
        expect(onImageGenerated).toHaveBeenCalledWith(
          'https://example.com/generated-image.jpg',
        );
        expect(mockAlert).toHaveBeenCalledWith(
          '🎨 Image Generated!',
          expect.stringContaining('successfully'),
          [{ text: 'Amazing!', style: 'default' }],
        );
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle image generation failure', async () => {
      mockImageGenerationService.generateImage.mockResolvedValue({
        success: false,
        error: 'API service temporarily unavailable',
        errorType: 'api_failure',
        serviceUsed: 'replicate',
        responseTimeMs: 5000,
      });

      mockAuthContext.createImageGenerationEvent.mockResolvedValue('event-123');
      mockAuthContext.deductXP.mockResolvedValue({
        success: true,
        newBalance: 1500,
      });
      mockAuthContext.refundXP.mockResolvedValue({
        success: true,
        newBalance: 2500,
      });

      const onError = jest.fn();
      const { getByText } = render(
        <ImageGeneration {...defaultProps} onError={onError} />,
      );

      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          'API service temporarily unavailable',
        );
      });
    });

    test('should display error message with retry option', async () => {
      mockImageGenerationService.generateImage.mockRejectedValue(
        new Error('Network timeout'),
      );
      mockAuthContext.createImageGenerationEvent.mockResolvedValue('event-123');
      mockAuthContext.deductXP.mockResolvedValue({
        success: true,
        newBalance: 1500,
      });

      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      await waitFor(() => {
        expect(getByText('Generation Timed Out')).toBeTruthy();
        expect(getByText('Retry')).toBeTruthy();
      });
    });

    test('should handle XP deduction failure', async () => {
      mockAuthContext.createImageGenerationEvent.mockResolvedValue('event-123');
      mockAuthContext.deductXP.mockResolvedValue({
        success: false,
        error: 'Insufficient XP balance',
      });

      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      await waitFor(() => {
        expect(mockImageGenerationService.generateImage).not.toHaveBeenCalled();
      });
    });

    test('should handle content safety errors', async () => {
      mockImageGenerationService.generateImage.mockResolvedValue({
        success: false,
        error: 'Content violates safety guidelines',
        errorType: 'content_safety',
        serviceUsed: 'replicate',
        responseTimeMs: 2000,
      });

      mockAuthContext.createImageGenerationEvent.mockResolvedValue('event-123');
      mockAuthContext.deductXP.mockResolvedValue({
        success: true,
        newBalance: 1500,
      });

      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      await waitFor(() => {
        expect(getByText('Content Safety Check')).toBeTruthy();
        expect(getByText(/content needs adjustment/)).toBeTruthy();
      });
    });

    test('should handle rate limit errors', async () => {
      mockImageGenerationService.generateImage.mockResolvedValue({
        success: false,
        error: 'Rate limit exceeded',
        errorType: 'rate_limit',
        serviceUsed: 'replicate',
        responseTimeMs: 1000,
      });

      mockAuthContext.createImageGenerationEvent.mockResolvedValue('event-123');
      mockAuthContext.deductXP.mockResolvedValue({
        success: true,
        newBalance: 1500,
      });

      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      await waitFor(() => {
        expect(getByText('Too Many Requests')).toBeTruthy();
        expect(getByText('Wait & Retry')).toBeTruthy();
      });
    });

    test('should limit retry attempts', async () => {
      mockImageGenerationService.generateImage.mockRejectedValue(
        new Error('Service error'),
      );
      mockAuthContext.createImageGenerationEvent.mockResolvedValue('event-123');
      mockAuthContext.deductXP.mockResolvedValue({
        success: true,
        newBalance: 1500,
      });

      const { getByText, queryByText } = render(
        <ImageGeneration {...defaultProps} />,
      );

      const generateButton = getByText('🎨 Generate Story Image');

      // Attempt generation multiple times to reach retry limit
      for (let i = 0; i < 4; i++) {
        fireEvent.press(generateButton);
        await waitFor(() => {
          if (queryByText('Try Again')) {
            fireEvent.press(getByText('Try Again'));
          }
        });
      }

      await waitFor(() => {
        expect(getByText('Maximum retry attempts reached')).toBeTruthy();
      });
    });

    test('should dismiss error messages', async () => {
      mockImageGenerationService.generateImage.mockRejectedValue(
        new Error('Test error'),
      );
      mockAuthContext.createImageGenerationEvent.mockResolvedValue('event-123');
      mockAuthContext.deductXP.mockResolvedValue({
        success: true,
        newBalance: 1500,
      });

      const { getByText, queryByText } = render(
        <ImageGeneration {...defaultProps} />,
      );

      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      await waitFor(() => {
        expect(getByText('Generation Failed')).toBeTruthy();
      });

      const dismissButton = getByText('Dismiss');
      fireEvent.press(dismissButton);

      await waitFor(() => {
        expect(queryByText('Generation Failed')).toBeNull();
      });
    });
  });

  describe('Progress Tracking', () => {
    test('should show progress during generation', async () => {
      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      expect(getByText('Creating Your Illustration')).toBeTruthy();
      expect(getByText('⏱️ Estimated time: 30-45 seconds')).toBeTruthy();
    });

    test('should simulate progress steps', async () => {
      jest.useFakeTimers();

      const { getByText, queryByText } = render(
        <ImageGeneration {...defaultProps} />,
      );

      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      // Fast-forward through progress steps
      jest.advanceTimersByTime(5000);
      expect(queryByText('Analyzing your story...')).toBeTruthy();

      jest.advanceTimersByTime(5000);
      expect(queryByText('Extracting key elements...')).toBeTruthy();

      jest.useRealTimers();
    });
  });

  describe('Accessibility and UX', () => {
    test('should provide clear XP balance information', () => {
      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      expect(getByText('Your XP:')).toBeTruthy();
      expect(getByText('2,500')).toBeTruthy();
      expect(getByText('(Cost: 1,000 XP)')).toBeTruthy();
    });

    test('should show helpful hints for insufficient XP', () => {
      mockAuthContext.getXPBalanceInfo.mockReturnValue({
        hasEnoughXP: false,
        currentXP: 500,
        shortfall: 500,
        canGenerate: false,
        maxGenerations: 0,
      });

      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      expect(getByText('💡 Complete more stories to earn XP!')).toBeTruthy();
    });

    test('should display appropriate button states', () => {
      const { rerender, getByText } = render(
        <ImageGeneration {...defaultProps} />,
      );

      // Enabled state
      let generateButton = getByText('🎨 Generate Story Image');
      expect(generateButton).toBeTruthy();

      // Disabled state
      rerender(<ImageGeneration {...defaultProps} disabled={true} />);
      expect(getByText('🔒')).toBeTruthy();
      expect(getByText('Image Generation Locked')).toBeTruthy();
    });

    test('should handle different grade levels appropriately', () => {
      const gradeLevels = ['K-2', '3-5', '6-8', '9-12'];

      gradeLevels.forEach(gradeLevel => {
        const { getByText } = render(
          <ImageGeneration {...defaultProps} gradeLevel={gradeLevel} />,
        );

        expect(getByText('🎨 Generate Story Image')).toBeTruthy();
      });
    });
  });

  describe('Integration with Services', () => {
    test('should call image generation service with correct parameters', async () => {
      mockAuthContext.createImageGenerationEvent.mockResolvedValue('event-123');
      mockAuthContext.deductXP.mockResolvedValue({
        success: true,
        newBalance: 1500,
      });

      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      await waitFor(() => {
        expect(mockImageGenerationService.generateImage).toHaveBeenCalledWith({
          storyContent: defaultProps.storyContent,
          gradeLevel: 'K-2',
          sessionId: 'test-session-123',
          userId: 'test-user-123',
          metadata: {
            wordCount: 50,
          },
        });
      });
    });

    test('should create event tracking for analytics', async () => {
      mockAuthContext.createImageGenerationEvent.mockResolvedValue('event-123');
      mockAuthContext.deductXP.mockResolvedValue({
        success: true,
        newBalance: 1500,
      });

      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      await waitFor(() => {
        expect(mockAuthContext.createImageGenerationEvent).toHaveBeenCalledWith(
          'test-session-123',
          'K-2',
          50,
        );
      });
    });

    test('should handle callback functions correctly', async () => {
      const onImageGenerated = jest.fn();
      const onError = jest.fn();

      mockAuthContext.createImageGenerationEvent.mockResolvedValue('event-123');
      mockAuthContext.deductXP.mockResolvedValue({
        success: true,
        newBalance: 1500,
      });

      const { getByText } = render(
        <ImageGeneration
          {...defaultProps}
          onImageGenerated={onImageGenerated}
          onError={onError}
        />,
      );

      const generateButton = getByText('🎨 Generate Story Image');
      fireEvent.press(generateButton);

      await waitFor(() => {
        expect(onImageGenerated).toHaveBeenCalledWith(
          'https://example.com/generated-image.jpg',
        );
        expect(onError).not.toHaveBeenCalled();
      });
    });
  });
});
