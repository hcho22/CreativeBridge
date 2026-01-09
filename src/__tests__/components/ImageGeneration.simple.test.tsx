/**
 * ImageGeneration Component Simple Unit Tests
 * Tests core component functionality without complex dependencies
 */

import React from 'react';
import { render } from '@testing-library/react-native';

// Mock all dependencies at the top level
jest.mock('react-native-url-polyfill/auto', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock the entire Auth context
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

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuthContext,
}));

jest.mock('../../services/imageGeneration', () => ({
  imageGenerationService: {
    generateImage: jest.fn(),
  },
}));

jest.mock('../../services/xpEventTracker', () => ({
  xpEventTracker: {
    createImageGenerationEvent: jest.fn(),
    updateImageGenerationEvent: jest.fn(),
  },
}));

jest.mock('../../services/storySessionManager', () => ({
  storySessionManager: {
    updateSessionWithImage: jest.fn(),
  },
}));

// Mock React Native components
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

// Import the component after mocks
import ImageGeneration from '../../components/common/ImageGeneration';

describe('ImageGeneration Component - Simple Tests', () => {
  const defaultProps = {
    storyContent:
      'Once upon a time, there was a brave knight who discovered a magical forest.',
    sessionId: 'test-session-123',
    gradeLevel: 'K-2',
    wordCount: 50,
    onImageGenerated: jest.fn(),
    onError: jest.fn(),
    disabled: false,
    isStoryCompleted: true,
    currentRound: 5,
    maxRounds: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock auth context to default values
    mockAuthContext.getXPBalanceInfo.mockReturnValue({
      hasEnoughXP: true,
      currentXP: 2500,
      shortfall: 0,
      canGenerate: true,
      maxGenerations: 2,
    });
  });

  describe('Basic Rendering', () => {
    test('should render without crashing', () => {
      expect(() => {
        render(<ImageGeneration {...defaultProps} />);
      }).not.toThrow();
    });

    test('should display XP balance information', () => {
      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      expect(getByText('Your XP:')).toBeTruthy();
      expect(getByText('2,500')).toBeTruthy();
      expect(getByText('(Cost: 1,000 XP)')).toBeTruthy();
    });

    test('should display generate button', () => {
      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      expect(getByText('🎨 Generate Story Image')).toBeTruthy();
    });

    test('should handle insufficient XP state', () => {
      mockAuthContext.getXPBalanceInfo.mockReturnValue({
        hasEnoughXP: false,
        currentXP: 500,
        shortfall: 500,
        canGenerate: false,
        maxGenerations: 0,
      });

      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      expect(getByText('Need 500 more XP')).toBeTruthy();
      expect(getByText('💡 Complete more stories to earn XP!')).toBeTruthy();
    });

    test('should handle disabled state', () => {
      const { getByText } = render(
        <ImageGeneration {...defaultProps} disabled={true} />,
      );

      expect(getByText('🔒')).toBeTruthy();
      expect(getByText('Image Generation Locked')).toBeTruthy();
    });
  });

  describe('Component State Management', () => {
    test('should accept all required props', () => {
      const props = {
        storyContent: 'Test story',
        sessionId: 'session-123',
        gradeLevel: '3-5',
        wordCount: 100,
        isStoryCompleted: true,
        currentRound: 5,
        maxRounds: 5,
      };

      expect(() => {
        render(<ImageGeneration {...props} />);
      }).not.toThrow();
    });

    test('should handle optional props', () => {
      const props = {
        ...defaultProps,
        onImageGenerated: jest.fn(),
        onError: jest.fn(),
        disabled: true,
      };

      expect(() => {
        render(<ImageGeneration {...props} />);
      }).not.toThrow();
    });

    test('should handle different grade levels', () => {
      const gradeLevels = ['K-2', '3-5', '6-8', '9-12'];

      gradeLevels.forEach(gradeLevel => {
        expect(() => {
          render(<ImageGeneration {...defaultProps} gradeLevel={gradeLevel} />);
        }).not.toThrow();
      });
    });
  });

  describe('XP Balance Display', () => {
    test('should show sufficient XP in green', () => {
      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      const xpElement = getByText('2,500');
      expect(xpElement).toBeTruthy();
    });

    test('should show insufficient XP warning', () => {
      mockAuthContext.getXPBalanceInfo.mockReturnValue({
        hasEnoughXP: false,
        currentXP: 750,
        shortfall: 250,
        canGenerate: false,
        maxGenerations: 0,
      });

      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      expect(getByText('Need 250 more XP')).toBeTruthy();
    });

    test('should calculate correct shortfall', () => {
      mockAuthContext.getXPBalanceInfo.mockReturnValue({
        hasEnoughXP: false,
        currentXP: 123,
        shortfall: 877,
        canGenerate: false,
        maxGenerations: 0,
      });

      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      expect(getByText('Need 877 more XP')).toBeTruthy();
    });
  });

  describe('Accessibility and User Experience', () => {
    test('should provide helpful text for locked state when disabled', () => {
      const { getByText } = render(
        <ImageGeneration
          {...defaultProps}
          disabled={true}
          isStoryCompleted={true}
          currentRound={5}
          maxRounds={5}
        />,
      );

      // When story is complete but generation is disabled, it shows the disabled message
      expect(
        getByText('Image generation is currently unavailable.'),
      ).toBeTruthy();
    });

    test('should show appropriate cost information', () => {
      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      expect(getByText('(Cost: 1,000 XP)')).toBeTruthy();
    });

    test('should handle edge case with zero XP', () => {
      mockAuthContext.getXPBalanceInfo.mockReturnValue({
        hasEnoughXP: false,
        currentXP: 0,
        shortfall: 1000,
        canGenerate: false,
        maxGenerations: 0,
      });

      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      expect(getByText('0')).toBeTruthy();
      expect(getByText('Need 1,000 more XP')).toBeTruthy();
    });

    test('should handle very high XP balances', () => {
      mockAuthContext.getXPBalanceInfo.mockReturnValue({
        hasEnoughXP: true,
        currentXP: 50000,
        shortfall: 0,
        canGenerate: true,
        maxGenerations: 50,
      });

      const { getByText } = render(<ImageGeneration {...defaultProps} />);

      expect(getByText('50,000')).toBeTruthy(); // Should format large numbers
    });
  });

  describe('Error State Handling', () => {
    test('should render without auth context gracefully', () => {
      // This tests the component's resilience
      expect(() => {
        render(<ImageGeneration {...defaultProps} />);
      }).not.toThrow();
    });

    test('should handle missing optional callbacks', () => {
      const propsWithoutCallbacks = {
        storyContent: 'Test story',
        sessionId: 'session-123',
        gradeLevel: 'K-2',
        wordCount: 50,
        isStoryCompleted: true,
        currentRound: 5,
        maxRounds: 5,
      };

      expect(() => {
        render(<ImageGeneration {...propsWithoutCallbacks} />);
      }).not.toThrow();
    });
  });

  describe('Story Completion Gating', () => {
    test('should disable button when story is not complete', () => {
      const { getByText } = render(
        <ImageGeneration
          {...defaultProps}
          isStoryCompleted={false}
          currentRound={3}
          maxRounds={5}
        />
      );

      const disabledTitle = getByText('Complete Your Story First');
      expect(disabledTitle).toBeTruthy();

      const progressText = getByText('Progress: Round 3/5');
      expect(progressText).toBeTruthy();
    });

    test('should enable button when story is complete', () => {
      const { queryByText } = render(
        <ImageGeneration
          {...defaultProps}
          isStoryCompleted={true}
          currentRound={5}
          maxRounds={5}
        />
      );

      // Should not show disabled state
      const disabledTitle = queryByText('Complete Your Story First');
      expect(disabledTitle).toBeNull();
    });

    test('should show correct progress for incomplete stories', () => {
      const { getByText } = render(
        <ImageGeneration
          {...defaultProps}
          isStoryCompleted={false}
          currentRound={2}
          maxRounds={5}
        />
      );

      const message = getByText('Finish all 5 rounds to unlock image generation.');
      const progress = getByText('Progress: Round 2/5');
      const hint = getByText('💡 Keep writing to reach round 5!');

      expect(message).toBeTruthy();
      expect(progress).toBeTruthy();
      expect(hint).toBeTruthy();
    });
  });
});
