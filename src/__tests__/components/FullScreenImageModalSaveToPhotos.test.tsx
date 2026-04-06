/**
 * US-004: Save to Photos Action in FullScreenImageModal
 * Tests for the 📸 button prop, rendering, and callback behavior.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import FullScreenImageModal, {
  FullScreenImageModalProps,
  StoryImage,
} from '../../components/common/FullScreenImageModal';

// ─── Mocks (matching FullScreenImageModal.test.tsx patterns) ─────

jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
  return {
    default: {
      View,
      Text: require('react-native').Text,
      ScrollView: require('react-native').ScrollView,
    },
    useSharedValue: jest.fn(() => ({ value: 0 })),
    useAnimatedStyle: jest.fn(() => ({})),
    useAnimatedGestureHandler: jest.fn(() => jest.fn()),
    withSpring: jest.fn(value => value),
    withTiming: jest.fn(value => value),
    runOnJS: jest.fn(fn => fn),
    interpolate: jest.fn(),
    Extrapolate: { CLAMP: 'clamp' },
    View,
  };
});

jest.mock('react-native-gesture-handler', () => ({
  PanGestureHandler: ({ children }: any) => children,
  PinchGestureHandler: ({ children }: any) => children,
  TapGestureHandler: ({ children }: any) => children,
  State: {
    BEGAN: 'BEGAN',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
    ACTIVE: 'ACTIVE',
    END: 'END',
  },
}));

jest.mock('react-native-image-zoom-viewer', () => {
  const MockImageViewer = ({ imageUrls }: any) => {
    const RN = require('react-native');
    return require('react').createElement(
      RN.View,
      { testID: 'image-viewer' },
      require('react').createElement(
        RN.Text,
        null,
        `Image: ${imageUrls[0]?.url || 'No URL'}`,
      ),
    );
  };
  return MockImageViewer;
});

// ─── Test Data ──────────────────────────────────────────────────

const sampleImages: StoryImage[] = [
  {
    id: '1',
    url: 'https://example.com/image1.jpg',
    title: 'Test Story 1',
    storyText: 'A tale of adventure.',
    createdAt: '2023-01-01T10:00:00Z',
    sessionId: 'session-1',
    metadata: { gradeLevel: 'K-2', wordCount: 150, artStyle: 'watercolor' },
  },
  {
    id: '2',
    url: 'https://example.com/image2.jpg',
    title: 'Test Story 2',
    storyText: 'A tale of discovery.',
    createdAt: '2023-01-02T11:00:00Z',
    sessionId: 'session-2',
    metadata: { gradeLevel: '3-5', wordCount: 200, artStyle: 'digital' },
  },
];

const defaultProps: FullScreenImageModalProps = {
  visible: false,
  onClose: jest.fn(),
  images: sampleImages,
  initialIndex: 0,
};

// ─── Tests ──────────────────────────────────────────────────────

describe('US-004: FullScreenImageModal Save to Photos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Conditional Rendering ─────────────────────────────────────

  it('renders 📸 button when onSaveToPhotos prop is provided', () => {
    const onSaveToPhotos = jest.fn();
    const { getByText } = render(
      <FullScreenImageModal
        {...defaultProps}
        visible={true}
        onSaveToPhotos={onSaveToPhotos}
      />,
    );

    expect(getByText('📸')).toBeTruthy();
  });

  it('does NOT render 📸 button when onSaveToPhotos prop is omitted', () => {
    const { queryByText } = render(
      <FullScreenImageModal {...defaultProps} visible={true} />,
    );

    expect(queryByText('📸')).toBeNull();
  });

  // ── Callback Behavior ─────────────────────────────────────────

  it('calls onSaveToPhotos with the current image when 📸 is tapped', () => {
    const onSaveToPhotos = jest.fn();
    const { getByText } = render(
      <FullScreenImageModal
        {...defaultProps}
        visible={true}
        onSaveToPhotos={onSaveToPhotos}
      />,
    );

    fireEvent.press(getByText('📸'));

    expect(onSaveToPhotos).toHaveBeenCalledTimes(1);
    expect(onSaveToPhotos).toHaveBeenCalledWith(sampleImages[0]);
  });

  // ── Coexistence with Sibling Buttons ──────────────────────────

  it('renders alongside Share and Download buttons without conflicts', () => {
    const onShare = jest.fn();
    const onDownload = jest.fn();
    const onSaveToPhotos = jest.fn();

    const { getByText } = render(
      <FullScreenImageModal
        {...defaultProps}
        visible={true}
        onShare={onShare}
        onDownload={onDownload}
        onSaveToPhotos={onSaveToPhotos}
      />,
    );

    // All three buttons should render
    expect(getByText('📤')).toBeTruthy();
    expect(getByText('💾')).toBeTruthy();
    expect(getByText('📸')).toBeTruthy();
  });

  // ── Integration: all three actions fire independently ─────────

  it('fires correct callback for each action button independently', () => {
    const onShare = jest.fn();
    const onDownload = jest.fn();
    const onSaveToPhotos = jest.fn();

    const { getByText } = render(
      <FullScreenImageModal
        {...defaultProps}
        visible={true}
        onShare={onShare}
        onDownload={onDownload}
        onSaveToPhotos={onSaveToPhotos}
      />,
    );

    // Tap each button
    fireEvent.press(getByText('📤'));
    fireEvent.press(getByText('💾'));
    fireEvent.press(getByText('📸'));

    // Each callback should be called exactly once with the first image
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledWith(sampleImages[0]);

    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onDownload).toHaveBeenCalledWith(sampleImages[0]);

    expect(onSaveToPhotos).toHaveBeenCalledTimes(1);
    expect(onSaveToPhotos).toHaveBeenCalledWith(sampleImages[0]);
  });
});
