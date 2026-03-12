import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ImageDisplayModal } from '../../components/common/ImageDisplayModal';

// Mock StoryImageDisplay to avoid its heavy dependency tree
jest.mock('../../components/common/StoryImageDisplay', () => {
  const RN = require('react-native');
  const R = require('react');
  const h = R.createElement;
  const MockStoryImageDisplay = (props: any) =>
    h(
      RN.View,
      { testID: 'story-image-display' },
      h(RN.Text, { testID: 'sid-storyTitle' }, props.storyTitle),
      h(RN.Text, { testID: 'sid-sessionId' }, props.sessionId),
      h(RN.Text, { testID: 'sid-userId' }, props.userId),
      h(RN.Text, { testID: 'sid-replicateUrl' }, props.replicateUrl || ''),
      h(RN.Text, { testID: 'sid-supabaseUrl' }, props.supabaseUrl || ''),
      h(RN.Text, { testID: 'sid-uploadStatus' }, props.uploadStatus || ''),
      h(
        RN.Text,
        { testID: 'sid-showBackButton' },
        String(props.showBackButton),
      ),
      h(RN.Text, { testID: 'sid-displayMode' }, props.displayMode),
      h(
        RN.Text,
        { testID: 'sid-enableFullScreen' },
        String(props.enableFullScreen),
      ),
      props.onBackToOptions
        ? h(
            RN.Text,
            { testID: 'sid-backToOptions', onPress: props.onBackToOptions },
            'Back to Options',
          )
        : null,
    );
  MockStoryImageDisplay.displayName = 'StoryImageDisplay';
  return { __esModule: true, default: MockStoryImageDisplay };
});

// Mock AdaptiveGlassBackground to a simple View
jest.mock('../../components/common/AdaptiveGlassBackground', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    AdaptiveGlassBackground: (props: any) =>
      R.createElement(RN.View, { testID: 'glass-background', ...props }),
  };
});

// Mock react-native-share (transitive dependency)
jest.mock('react-native-share', () => ({ open: jest.fn() }));

// Mock react-native-fs (transitive dependency)
jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/documents',
  exists: jest.fn(),
  mkdir: jest.fn(),
  downloadFile: jest.fn(),
}));

describe('ImageDisplayModal', () => {
  const baseProps = {
    visible: true,
    onClose: jest.fn(),
    onBackToOptions: jest.fn(),
    storyTitle: 'The Magic Forest',
    sessionId: 'session-abc-123',
    userId: 'user-xyz-789',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('visibility', () => {
    it('renders null when visible is false', () => {
      const { toJSON } = render(
        <ImageDisplayModal {...baseProps} visible={false} />,
      );
      expect(toJSON()).toBeNull();
    });

    it('renders content when visible is true', () => {
      const { getByTestId } = render(<ImageDisplayModal {...baseProps} />);
      expect(getByTestId('story-image-display')).toBeTruthy();
    });
  });

  describe('StoryImageDisplay props', () => {
    it('passes required props to StoryImageDisplay', () => {
      const { getByTestId } = render(<ImageDisplayModal {...baseProps} />);

      expect(getByTestId('sid-storyTitle').props.children).toBe(
        'The Magic Forest',
      );
      expect(getByTestId('sid-sessionId').props.children).toBe(
        'session-abc-123',
      );
      expect(getByTestId('sid-userId').props.children).toBe('user-xyz-789');
    });

    it('passes image URLs and upload status', () => {
      const { getByTestId } = render(
        <ImageDisplayModal
          {...baseProps}
          replicateUrl="https://replicate.delivery/img.png"
          supabaseUrl="https://storage.supabase.co/img.png"
          uploadStatus="uploaded"
        />,
      );

      expect(getByTestId('sid-replicateUrl').props.children).toBe(
        'https://replicate.delivery/img.png',
      );
      expect(getByTestId('sid-supabaseUrl').props.children).toBe(
        'https://storage.supabase.co/img.png',
      );
      expect(getByTestId('sid-uploadStatus').props.children).toBe('uploaded');
    });

    it('sets showBackButton=true, displayMode=responsive, enableFullScreen=false', () => {
      const { getByTestId } = render(<ImageDisplayModal {...baseProps} />);

      expect(getByTestId('sid-showBackButton').props.children).toBe('true');
      expect(getByTestId('sid-displayMode').props.children).toBe('responsive');
      expect(getByTestId('sid-enableFullScreen').props.children).toBe('false');
    });

    it('wires onBackToOptions to StoryImageDisplay', () => {
      const mockBackToOptions = jest.fn();
      const { getByTestId } = render(
        <ImageDisplayModal
          {...baseProps}
          onBackToOptions={mockBackToOptions}
        />,
      );

      fireEvent.press(getByTestId('sid-backToOptions'));
      expect(mockBackToOptions).toHaveBeenCalledTimes(1);
    });
  });

  describe('backdrop dismissal', () => {
    it('calls onClose when backdrop is pressed', () => {
      const mockClose = jest.fn();
      const { getByTestId } = render(
        <ImageDisplayModal {...baseProps} onClose={mockClose} />,
      );

      // The outer Pressable is the backdrop — find it via the glass background's parent
      const glassBackground = getByTestId('glass-background');
      const backdrop = glassBackground.parent;
      if (backdrop) {
        fireEvent.press(backdrop);
      }
      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when inner content area is pressed', () => {
      const mockClose = jest.fn();
      const { getByTestId } = render(
        <ImageDisplayModal {...baseProps} onClose={mockClose} />,
      );

      // Pressing the StoryImageDisplay area should not dismiss
      fireEvent.press(getByTestId('story-image-display'));
      expect(mockClose).not.toHaveBeenCalled();
    });
  });

  describe('glass background', () => {
    it('renders AdaptiveGlassBackground', () => {
      const { getByTestId } = render(<ImageDisplayModal {...baseProps} />);
      expect(getByTestId('glass-background')).toBeTruthy();
    });
  });
});
