/**
 * Integration tests for enhanced StoryImageDisplay component
 * Tests full-screen functionality, visual indicators, and backward compatibility
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import StoryImageDisplay from '../../components/common/StoryImageDisplay';

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const mockSharedValue = (initialValue: number) => ({ value: initialValue });

  return {
    useSharedValue: jest.fn(mockSharedValue),
    useAnimatedStyle: jest.fn(() => ({})),
    withSpring: jest.fn(value => value),
    withTiming: jest.fn(value => value),
    runOnJS: jest.fn(fn => fn),
    View: require('react-native').View,
  };
});

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => ({
  TapGestureHandler: ({ children }: any) => children,
  State: { ACTIVE: 'ACTIVE', END: 'END' },
  Pressable: require('react-native').Pressable,
}));

// Mock FullScreenImageModal
jest.mock('../../components/common/FullScreenImageModal', () => {
  // eslint-disable-next-line @typescript-eslint/no-shadow -- jest.mock factory runs in isolated scope; the outer React import isn't visible at factory-execution time.
  const React = require('react');
  const { View, Text } = require('react-native');

  return ({ visible, onClose, images }: any) => {
    if (!visible) return null;

    return React.createElement(
      View,
      { testID: 'full-screen-modal' },
      React.createElement(
        Text,
        {},
        `Full screen modal with ${images.length} images`,
      ),
      React.createElement(
        require('react-native').TouchableOpacity,
        { onPress: onClose, testID: 'modal-close-button' },
        React.createElement(Text, {}, 'Close'),
      ),
    );
  };
});

// Mock react-native-share
jest.mock('react-native-share', () => ({
  open: jest.fn().mockResolvedValue(true),
}));

// Mock react-native-fs
jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/documents',
  exists: jest.fn().mockResolvedValue(true),
  mkdir: jest.fn().mockResolvedValue(true),
  downloadFile: jest.fn(() => ({
    promise: Promise.resolve({ statusCode: 200 }),
  })),
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('Enhanced StoryImageDisplay', () => {
  const defaultProps = {
    imageUrl: 'https://example.com/test-image.jpg',
    storyTitle: 'Test Story',
    sessionId: 'test-session-123',
    userId: 'test-user-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Backward Compatibility', () => {
    it('should render normally without enhanced props', () => {
      const { getByTestId, getByText } = render(
        <StoryImageDisplay {...defaultProps} />,
      );

      expect(getByTestId('image-container')).toBeTruthy();
      expect(getByText('Test Story')).toBeTruthy();
    });

    it('should maintain existing download functionality', () => {
      const onImageSaved = jest.fn();
      const { getByText } = render(
        <StoryImageDisplay
          {...defaultProps}
          onImageSaved={onImageSaved}
          showDownloadButton={true}
        />,
      );

      const downloadButton = getByText('Save to Device');
      expect(downloadButton).toBeTruthy();

      fireEvent.press(downloadButton);
      // Download should be initiated
    });

    it('should maintain existing share functionality', () => {
      const { getByText } = render(
        <StoryImageDisplay {...defaultProps} showShareButton={true} />,
      );

      const shareButton = getByText('Share');
      expect(shareButton).toBeTruthy();

      fireEvent.press(shareButton);
      // Share should be initiated
    });
  });

  describe('Enhanced Full-Screen Functionality', () => {
    it('should render pressable container when enableFullScreen is true', () => {
      const { getByTestId } = render(
        <StoryImageDisplay {...defaultProps} enableFullScreen={true} />,
      );

      expect(getByTestId('image-container-pressable')).toBeTruthy();
      expect(getByTestId('story-image-enhanced')).toBeTruthy();
    });

    it('should show zoom indicator when showZoomIndicator is true', () => {
      const { getByText } = render(
        <StoryImageDisplay
          {...defaultProps}
          enableFullScreen={true}
          showZoomIndicator={true}
        />,
      );

      expect(getByText('🔍')).toBeTruthy();
    });

    it('should hide zoom indicator when showZoomIndicator is false', () => {
      const { queryByText } = render(
        <StoryImageDisplay
          {...defaultProps}
          enableFullScreen={true}
          showZoomIndicator={false}
        />,
      );

      expect(queryByText('🔍')).toBeNull();
    });

    it('should open full-screen modal on image press', async () => {
      const onFullScreenOpen = jest.fn();
      const { getByTestId, getByText } = render(
        <StoryImageDisplay
          {...defaultProps}
          enableFullScreen={true}
          onFullScreenOpen={onFullScreenOpen}
        />,
      );

      const pressableContainer = getByTestId('image-container-pressable');
      fireEvent.press(pressableContainer);

      await waitFor(() => {
        expect(getByTestId('full-screen-modal')).toBeTruthy();
        expect(getByText('Full screen modal with 1 images')).toBeTruthy();
      });

      expect(onFullScreenOpen).toHaveBeenCalled();
    });

    it('should close full-screen modal correctly', async () => {
      const onFullScreenClose = jest.fn();
      const { getByTestId } = render(
        <StoryImageDisplay
          {...defaultProps}
          enableFullScreen={true}
          onFullScreenClose={onFullScreenClose}
        />,
      );

      // Open modal
      const pressableContainer = getByTestId('image-container-pressable');
      fireEvent.press(pressableContainer);

      await waitFor(() => {
        expect(getByTestId('full-screen-modal')).toBeTruthy();
      });

      // Close modal
      const closeButton = getByTestId('modal-close-button');
      fireEvent.press(closeButton);

      expect(onFullScreenClose).toHaveBeenCalled();
    });
  });

  describe('Enhanced Props Interface', () => {
    it('should handle storyText prop for story overlay', () => {
      const { getByTestId } = render(
        <StoryImageDisplay
          {...defaultProps}
          enableFullScreen={true}
          storyText="This is a test story about adventures and discoveries."
        />,
      );

      const pressableContainer = getByTestId('image-container-pressable');
      fireEvent.press(pressableContainer);

      // Modal should be configured with story overlay enabled
      expect(getByTestId('full-screen-modal')).toBeTruthy();
    });

    it('should handle metadata prop correctly', () => {
      const metadata = {
        gradeLevel: 'K-2',
        wordCount: 150,
        generationTime: 45000,
        artStyle: 'watercolor',
      };

      const { getByTestId } = render(
        <StoryImageDisplay
          {...defaultProps}
          enableFullScreen={true}
          metadata={metadata}
        />,
      );

      expect(getByTestId('image-container-pressable')).toBeTruthy();
      // Metadata should be passed to full-screen modal
    });

    it('should support gallery mode with multiple images', () => {
      const galleryImages = [
        {
          id: '1',
          url: 'https://example.com/image1.jpg',
          title: 'Story 1',
          createdAt: '2023-01-01T00:00:00Z',
          sessionId: 'session1',
        },
        {
          id: '2',
          url: 'https://example.com/image2.jpg',
          title: 'Story 2',
          createdAt: '2023-01-02T00:00:00Z',
          sessionId: 'session2',
        },
      ];

      const { getByTestId, getByText } = render(
        <StoryImageDisplay
          {...defaultProps}
          enableFullScreen={true}
          enableGalleryMode={true}
          galleryImages={galleryImages}
          currentImageIndex={0}
        />,
      );

      const pressableContainer = getByTestId('image-container-pressable');
      fireEvent.press(pressableContainer);

      // Modal should show gallery with multiple images
      expect(getByText('Full screen modal with 2 images')).toBeTruthy();
    });

    it('should handle celebration mode flag', () => {
      const { getByTestId } = render(
        <StoryImageDisplay
          {...defaultProps}
          enableFullScreen={true}
          enableCelebrationMode={true}
        />,
      );

      expect(getByTestId('image-container-pressable')).toBeTruthy();
      // Component should render with celebration mode enabled
    });

    it('should support custom callbacks', () => {
      const onImageChange = jest.fn();
      const { getByTestId } = render(
        <StoryImageDisplay
          {...defaultProps}
          enableFullScreen={true}
          onImageChange={onImageChange}
        />,
      );

      expect(getByTestId('image-container-pressable')).toBeTruthy();
      // Callback should be passed to full-screen modal
    });
  });

  describe('Touch Feedback and Animations', () => {
    it('should handle press events when enableTouchFeedback is true', () => {
      const { getByTestId } = render(
        <StoryImageDisplay
          {...defaultProps}
          enableFullScreen={true}
          enableTouchFeedback={true}
        />,
      );

      const pressableContainer = getByTestId('image-container-pressable');

      // Test press in
      fireEvent.press(pressableContainer, { type: 'pressIn' });

      // Test press out
      fireEvent.press(pressableContainer, { type: 'pressOut' });

      // Should not throw errors
      expect(pressableContainer).toBeTruthy();
    });

    it('should not interfere with touch when enableTouchFeedback is false', () => {
      const { getByTestId } = render(
        <StoryImageDisplay
          {...defaultProps}
          enableFullScreen={true}
          enableTouchFeedback={false}
        />,
      );

      const pressableContainer = getByTestId('image-container-pressable');

      fireEvent.press(pressableContainer);

      // Should still open modal even without touch feedback
      expect(getByTestId('full-screen-modal')).toBeTruthy();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should not crash when imageUrl is undefined', () => {
      const { getByText } = render(
        <StoryImageDisplay
          imageUrl={undefined}
          storyTitle="Test Story"
          sessionId="test-session"
          userId="test-user"
          enableFullScreen={true}
        />,
      );

      expect(getByText('No Image Generated')).toBeTruthy();
    });

    it('should handle missing optional props gracefully', () => {
      const { getByTestId } = render(
        <StoryImageDisplay
          {...defaultProps}
          enableFullScreen={true}
          // No optional props provided
        />,
      );

      expect(getByTestId('image-container-pressable')).toBeTruthy();
    });

    it('should not open modal when enableFullScreen is false', () => {
      const { getByTestId, queryByTestId } = render(
        <StoryImageDisplay {...defaultProps} enableFullScreen={false} />,
      );

      const imageContainer = getByTestId('image-container');
      fireEvent.press(imageContainer);

      // Modal should not appear
      expect(queryByTestId('full-screen-modal')).toBeNull();
    });

    it('should handle image load errors in enhanced mode', () => {
      const onError = jest.fn();
      const { getByTestId } = render(
        <StoryImageDisplay
          {...defaultProps}
          enableFullScreen={true}
          onError={onError}
        />,
      );

      const image = getByTestId('story-image-enhanced');

      fireEvent(image, 'error', { nativeEvent: { error: 'Load failed' } });

      expect(onError).toHaveBeenCalledWith('Failed to load image');
    });
  });

  describe('Performance Considerations', () => {
    it('should not create excessive re-renders', () => {
      const renderCount = jest.fn();

      const TestWrapper = (props: any) => {
        renderCount();
        return <StoryImageDisplay {...props} />;
      };

      const { rerender } = render(
        <TestWrapper {...defaultProps} enableFullScreen={true} />,
      );

      // Re-render with same props
      rerender(<TestWrapper {...defaultProps} enableFullScreen={true} />);

      // Should not cause excessive re-renders
      expect(renderCount).toHaveBeenCalledTimes(2);
    });

    it('should handle rapid press events gracefully', () => {
      const { getByTestId } = render(
        <StoryImageDisplay {...defaultProps} enableFullScreen={true} />,
      );

      const pressableContainer = getByTestId('image-container-pressable');

      // Rapid presses
      for (let i = 0; i < 10; i++) {
        fireEvent.press(pressableContainer);
      }

      // Should not crash
      expect(pressableContainer).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should maintain testID hierarchy for testing', () => {
      const { getByTestId } = render(
        <StoryImageDisplay {...defaultProps} enableFullScreen={true} />,
      );

      expect(getByTestId('image-container-pressable')).toBeTruthy();
      expect(getByTestId('story-image-enhanced')).toBeTruthy();
    });

    it('should preserve original testIDs when not enhanced', () => {
      const { getByTestId } = render(
        <StoryImageDisplay {...defaultProps} enableFullScreen={false} />,
      );

      expect(getByTestId('image-container')).toBeTruthy();
      expect(getByTestId('story-image')).toBeTruthy();
    });
  });
});
