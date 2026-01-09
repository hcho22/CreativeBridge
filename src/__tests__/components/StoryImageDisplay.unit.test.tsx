/**
 * StoryImageDisplay Component - Unit Tests
 * Tests for upload status badges, URL fallback logic, and image display
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import StoryImageDisplay from '../../components/common/StoryImageDisplay';

// Mock dependencies
jest.mock('react-native-url-polyfill/auto', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../../utils/shareWrapper', () => ({
  __esModule: true,
  default: {
    open: jest.fn(() => Promise.resolve({ success: true })),
  },
}));

jest.mock('../../utils/rnfsWrapper', () => ({
  rnfsWrapper: {
    isSimulationMode: true,
  },
  retryNativeModuleInitialization: jest.fn(),
  __esModule: true,
  default: {
    DocumentDirectoryPath: '/test/documents',
    exists: jest.fn(() => Promise.resolve(false)),
    mkdir: jest.fn(() => Promise.resolve()),
    downloadFile: jest.fn(() => ({
      promise: Promise.resolve({ statusCode: 200 }),
    })),
    unlink: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../../utils/folderPicker', () => ({
  __esModule: true,
  default: {
    saveToUserSelectedFolder: jest.fn(() => Promise.resolve({
      success: true,
      finalPath: '/test/saved/image.jpg',
      cancelled: false,
    })),
  },
}));

jest.mock('../../components/common/FullScreenImageModal', () => 'FullScreenImageModal');

describe('StoryImageDisplay Component - Unit Tests', () => {
  const defaultProps = {
    sessionId: 'test-session-123',
    userId: 'test-user-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('URL Priority System', () => {
    it('should prioritize Supabase URL over Replicate URL', () => {
      const { getByTestId } = render(
        <StoryImageDisplay
          {...defaultProps}
          supabaseUrl="https://supabase.co/storage/image.png"
          replicateUrl="https://replicate.delivery/image.png"
        />
      );

      const image = getByTestId('story-image');
      expect(image.props.source.uri).toContain('supabase.co');
    });

    it('should use Replicate URL when Supabase URL is not available', () => {
      const { getByTestId } = render(
        <StoryImageDisplay
          {...defaultProps}
          replicateUrl="https://replicate.delivery/image.png"
        />
      );

      const image = getByTestId('story-image');
      expect(image.props.source.uri).toContain('replicate.delivery');
    });

    it('should fall back to legacy imageUrl prop', () => {
      const { getByTestId } = render(
        <StoryImageDisplay
          {...defaultProps}
          imageUrl="https://legacy.com/image.png"
        />
      );

      const image = getByTestId('story-image');
      expect(image.props.source.uri).toContain('legacy.com');
    });
  });

  describe('Upload Status Badges', () => {
    it('should show pending badge during upload', () => {
      const { getByText, getByTestId } = render(
        <StoryImageDisplay
          {...defaultProps}
          replicateUrl="https://replicate.delivery/image.png"
          uploadStatus="pending"
        />
      );

      expect(getByText(/Backing up to permanent storage/i)).toBeTruthy();
      expect(getByTestId('upload-spinner')).toBeTruthy();
    });

    it('should show success badge when uploaded', () => {
      const { getByText } = render(
        <StoryImageDisplay
          {...defaultProps}
          supabaseUrl="https://supabase.co/storage/image.png"
          uploadStatus="uploaded"
        />
      );

      expect(getByText('✅')).toBeTruthy();
      expect(getByText(/Permanently saved/i)).toBeTruthy();
    });

    it('should show failed badge with retry button', () => {
      const onRetryUpload = jest.fn();
      const { getByText } = render(
        <StoryImageDisplay
          {...defaultProps}
          replicateUrl="https://replicate.delivery/image.png"
          uploadStatus="failed"
          onRetryUpload={onRetryUpload}
        />
      );

      expect(getByText(/Backup failed/i)).toBeTruthy();
      expect(getByText(/image still available/i)).toBeTruthy();

      const retryButton = getByText('Retry Backup');
      fireEvent.press(retryButton);

      expect(onRetryUpload).toHaveBeenCalledTimes(1);
    });

    it('should not show upload status badge when no image is displayed', () => {
      const { queryByText } = render(
        <StoryImageDisplay
          {...defaultProps}
          uploadStatus="pending"
          // No image URLs provided
        />
      );

      expect(queryByText(/Backing up to permanent storage/i)).toBeNull();
    });

    it('should not show upload status badge during error state', async () => {
      const { queryByText } = render(
        <StoryImageDisplay
          {...defaultProps}
          replicateUrl="https://invalid-url.com/image.png"
          uploadStatus="pending"
        />
      );

      // Wait for error state to appear
      await waitFor(() => {
        expect(queryByText(/Backing up to permanent storage/i)).toBeNull();
      });
    });
  });

  describe('Placeholder State', () => {
    it('should show placeholder when no image URL is provided', () => {
      const { getByText } = render(
        <StoryImageDisplay {...defaultProps} />
      );

      expect(getByText('🖼️')).toBeTruthy();
      expect(getByText('No Image Generated')).toBeTruthy();
      expect(getByText(/Generate an AI illustration/i)).toBeTruthy();
    });
  });

  describe('Retry Upload Functionality', () => {
    it('should call onRetryUpload when retry button is pressed', () => {
      const onRetryUpload = jest.fn();
      const { getByText } = render(
        <StoryImageDisplay
          {...defaultProps}
          replicateUrl="https://replicate.delivery/image.png"
          uploadStatus="failed"
          onRetryUpload={onRetryUpload}
        />
      );

      const retryButton = getByText('Retry Backup');
      fireEvent.press(retryButton);

      expect(onRetryUpload).toHaveBeenCalled();
    });

    it('should not show retry button when no callback provided', () => {
      const { queryByText } = render(
        <StoryImageDisplay
          {...defaultProps}
          replicateUrl="https://replicate.delivery/image.png"
          uploadStatus="failed"
        />
      );

      expect(queryByText('Retry Backup')).toBeNull();
    });
  });

  describe('Download and Share Buttons', () => {
    it('should show download button by default', () => {
      const { getByText } = render(
        <StoryImageDisplay
          {...defaultProps}
          replicateUrl="https://replicate.delivery/image.png"
        />
      );

      expect(getByText('Save Image')).toBeTruthy();
    });

    it('should show share button by default', () => {
      const { getByText } = render(
        <StoryImageDisplay
          {...defaultProps}
          replicateUrl="https://replicate.delivery/image.png"
        />
      );

      expect(getByText('Share')).toBeTruthy();
    });

    it('should hide download button when showDownloadButton is false', () => {
      const { queryByText } = render(
        <StoryImageDisplay
          {...defaultProps}
          replicateUrl="https://replicate.delivery/image.png"
          showDownloadButton={false}
        />
      );

      expect(queryByText('Save Image')).toBeNull();
    });

    it('should hide share button when showShareButton is false', () => {
      const { queryByText } = render(
        <StoryImageDisplay
          {...defaultProps}
          replicateUrl="https://replicate.delivery/image.png"
          showShareButton={false}
        />
      );

      expect(queryByText('Share')).toBeNull();
    });

    it('should hide action buttons during error state', async () => {
      const { queryByText } = render(
        <StoryImageDisplay
          {...defaultProps}
          replicateUrl="https://invalid.com/image.png"
        />
      );

      await waitFor(() => {
        expect(queryByText('Save Image')).toBeNull();
        expect(queryByText('Share')).toBeNull();
      });
    });
  });

  describe('Full Screen Mode', () => {
    it('should show zoom indicator when enableFullScreen is true', () => {
      const { getByText } = render(
        <StoryImageDisplay
          {...defaultProps}
          replicateUrl="https://replicate.delivery/image.png"
          enableFullScreen={true}
        />
      );

      expect(getByText('🔍')).toBeTruthy();
    });

    it('should not show zoom indicator when showZoomIndicator is false', () => {
      const { queryByText } = render(
        <StoryImageDisplay
          {...defaultProps}
          replicateUrl="https://replicate.delivery/image.png"
          enableFullScreen={true}
          showZoomIndicator={false}
        />
      );

      expect(queryByText('🔍')).toBeNull();
    });

    it('should make image pressable when enableFullScreen is true', () => {
      const { getByTestId } = render(
        <StoryImageDisplay
          {...defaultProps}
          replicateUrl="https://replicate.delivery/image.png"
          enableFullScreen={true}
        />
      );

      expect(getByTestId('image-container-pressable')).toBeTruthy();
    });

    it('should not make image pressable when enableFullScreen is false', () => {
      const { getByTestId, queryByTestId } = render(
        <StoryImageDisplay
          {...defaultProps}
          replicateUrl="https://replicate.delivery/image.png"
          enableFullScreen={false}
        />
      );

      expect(queryByTestId('image-container-pressable')).toBeNull();
      expect(getByTestId('image-container')).toBeTruthy();
    });

    it('should call onFullScreenOpen when image is pressed', () => {
      const onFullScreenOpen = jest.fn();
      const { getByTestId } = render(
        <StoryImageDisplay
          {...defaultProps}
          replicateUrl="https://replicate.delivery/image.png"
          enableFullScreen={true}
          onFullScreenOpen={onFullScreenOpen}
        />
      );

      const pressable = getByTestID('image-container-pressable');
      fireEvent.press(pressable);

      expect(onFullScreenOpen).toHaveBeenCalled();
    });
  });

  describe('Display Modes', () => {
    it('should use responsive display mode by default', () => {
      const { getByTestId } = render(
        <StoryImageDisplay
          {...defaultProps}
          replicateUrl="https://replicate.delivery/image.png"
        />
      );

      const image = getByTestId('story-image');
      // Check that image has responsive dimensions
      expect(image.props.style).toBeDefined();
    });

    it('should use full width display mode when specified', () => {
      const { getByTestId } = render(
        <StoryImageDisplay
          {...defaultProps}
          replicateUrl="https://replicate.delivery/image.png"
          displayMode="fullWidth"
        />
      );

      const image = getByTestId('story-image');
      expect(image.props.style).toBeDefined();
    });
  });

  describe('Props Validation', () => {
    it('should accept all required props without crashing', () => {
      expect(() => {
        render(
          <StoryImageDisplay
            sessionId="test-session"
            userId="test-user"
          />
        );
      }).not.toThrow();
    });

    it('should accept optional props without crashing', () => {
      expect(() => {
        render(
          <StoryImageDisplay
            {...defaultProps}
            storyTitle="Test Story"
            replicateUrl="https://replicate.delivery/image.png"
            supabaseUrl="https://supabase.co/storage/image.png"
            uploadStatus="uploaded"
            onRetryUpload={() => {}}
            onImageSaved={() => {}}
            onError={() => {}}
            onBackToOptions={() => {}}
            showDownloadButton={true}
            showShareButton={true}
            showBackButton={false}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Upload Status Transitions', () => {
    it('should update from pending to uploaded state', () => {
      const { rerender, getByText, queryByTestId } = render(
        <StoryImageDisplay
          {...defaultProps}
          replicateUrl="https://replicate.delivery/image.png"
          uploadStatus="pending"
        />
      );

      // Initially shows pending
      expect(getByText(/Backing up to permanent storage/i)).toBeTruthy();
      expect(queryByTestID('upload-spinner')).toBeTruthy();

      // Update to uploaded
      rerender(
        <StoryImageDisplay
          {...defaultProps}
          supabaseUrl="https://supabase.co/storage/image.png"
          uploadStatus="uploaded"
        />
      );

      // Now shows uploaded
      expect(getByText(/Permanently saved/i)).toBeTruthy();
      expect(queryByTestId('upload-spinner')).toBeNull();
    });

    it('should update from pending to failed state', () => {
      const { rerender, getByText, queryByTestId } = render(
        <StoryImageDisplay
          {...defaultProps}
          replicateUrl="https://replicate.delivery/image.png"
          uploadStatus="pending"
        />
      );

      // Initially shows pending
      expect(queryByTestId('upload-spinner')).toBeTruthy();

      // Update to failed
      rerender(
        <StoryImageDisplay
          {...defaultProps}
          replicateUrl="https://replicate.delivery/image.png"
          uploadStatus="failed"
          onRetryUpload={() => {}}
        />
      );

      // Now shows failed
      expect(getByText(/Backup failed/i)).toBeTruthy();
      expect(getByText('Retry Backup')).toBeTruthy();
    });
  });
});
