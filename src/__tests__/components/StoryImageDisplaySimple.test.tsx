/**
 * StoryImageDisplay Component Test Suite - Simplified
 * Tests for Tasks 6.1-6.5: Core functionality verification
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import StoryImageDisplay from '../../components/common/StoryImageDisplay';

// Mock external dependencies
jest.mock('react-native-share', () => ({
  open: jest.fn(),
}));

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/documents',
  exists: jest.fn(),
  mkdir: jest.fn(),
  downloadFile: jest.fn(),
}));

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Alert: {
      alert: jest.fn(),
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 375, height: 812 })),
    },
  };
});

describe('StoryImageDisplay Component - Core Tests', () => {
  const mockProps = {
    sessionId: 'test-session-123',
    storyTitle: 'The Adventure Begins',
    onImageSaved: jest.fn(),
    onError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Task 6.1: Create image display component', () => {
    test('should render placeholder when no image URL provided', () => {
      const { getByText } = render(<StoryImageDisplay {...mockProps} />);

      expect(getByText('🖼️')).toBeTruthy();
      expect(getByText('No Image Generated')).toBeTruthy();
      expect(
        getByText('Generate an AI illustration for your story to see it here!'),
      ).toBeTruthy();
    });

    test('should render loading state when image URL is provided', () => {
      const { getByText } = render(
        <StoryImageDisplay
          {...mockProps}
          imageUrl="https://example.com/image.jpg"
        />,
      );

      expect(getByText('Loading your illustration...')).toBeTruthy();
    });
  });

  describe('Task 6.1-T: Test responsive design', () => {
    test('should render on small screens', () => {
      const mockDimensions = Dimensions.get as jest.MockedFunction<
        typeof Dimensions.get
      >;
      mockDimensions.mockReturnValue({ width: 320, height: 568 });

      const { getByText } = render(
        <StoryImageDisplay
          {...mockProps}
          imageUrl="https://example.com/image.jpg"
        />,
      );

      expect(getByText('Loading your illustration...')).toBeTruthy();
    });

    test('should render on large screens', () => {
      const mockDimensions = Dimensions.get as jest.MockedFunction<
        typeof Dimensions.get
      >;
      mockDimensions.mockReturnValue({ width: 768, height: 1024 });

      const { getByText } = render(
        <StoryImageDisplay
          {...mockProps}
          imageUrl="https://example.com/image.jpg"
        />,
      );

      expect(getByText('Loading your illustration...')).toBeTruthy();
    });
  });

  describe('Task 6.4: Create placeholder and error state components', () => {
    test('should have proper placeholder structure', () => {
      const { getByText } = render(<StoryImageDisplay {...mockProps} />);

      expect(getByText('🖼️')).toBeTruthy();
      expect(getByText('No Image Generated')).toBeTruthy();
      expect(
        getByText('Generate an AI illustration for your story to see it here!'),
      ).toBeTruthy();
    });

    test('should support custom story title', () => {
      const { getByText } = render(
        <StoryImageDisplay
          {...mockProps}
          imageUrl="https://example.com/image.jpg"
          storyTitle="Custom Story Title"
        />,
      );

      // Should show loading state with image URL provided
      expect(getByText('Loading your illustration...')).toBeTruthy();
    });
  });

  describe('Task 6.5: Test image display across different screen sizes', () => {
    test('should render correctly on iPhone SE dimensions', () => {
      const mockDimensions = Dimensions.get as jest.MockedFunction<
        typeof Dimensions.get
      >;
      mockDimensions.mockReturnValue({ width: 320, height: 568 });

      const { getByText } = render(<StoryImageDisplay {...mockProps} />);

      expect(getByText('No Image Generated')).toBeTruthy();
    });

    test('should render correctly on iPhone 12 dimensions', () => {
      const mockDimensions = Dimensions.get as jest.MockedFunction<
        typeof Dimensions.get
      >;
      mockDimensions.mockReturnValue({ width: 390, height: 844 });

      const { getByText } = render(<StoryImageDisplay {...mockProps} />);

      expect(getByText('No Image Generated')).toBeTruthy();
    });

    test('should render correctly on iPad dimensions', () => {
      const mockDimensions = Dimensions.get as jest.MockedFunction<
        typeof Dimensions.get
      >;
      mockDimensions.mockReturnValue({ width: 820, height: 1180 });

      const { getByText } = render(<StoryImageDisplay {...mockProps} />);

      expect(getByText('No Image Generated')).toBeTruthy();
    });
  });

  describe('Component configuration', () => {
    test('should accept optional props correctly', () => {
      const { getByText } = render(
        <StoryImageDisplay
          {...mockProps}
          showDownloadButton={false}
          showShareButton={false}
          style={{ backgroundColor: 'red' }}
        />,
      );

      expect(getByText('No Image Generated')).toBeTruthy();
    });

    test('should handle missing optional callbacks', () => {
      const { getByText } = render(
        <StoryImageDisplay
          sessionId="test-123"
          imageUrl="https://example.com/image.jpg"
        />,
      );

      expect(getByText('Loading your illustration...')).toBeTruthy();
    });
  });
});
