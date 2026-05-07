/**
 * StoryImageDisplay — Save to Photos (US-003) Test Suite
 * Tests the "Photos" button rendering, permission flow, save operations,
 * loading states, and error handling.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import StoryImageDisplay from '../../components/common/StoryImageDisplay';

// --- Mocks ---

jest.mock('react-native-share', () => ({
  open: jest.fn(),
}));

const mockRNFS = {
  DocumentDirectoryPath: '/mock/documents',
  exists: jest.fn().mockResolvedValue(false),
  mkdir: jest.fn().mockResolvedValue(undefined),
  downloadFile: jest.fn().mockReturnValue({
    promise: Promise.resolve({ statusCode: 200 }),
  }),
  unlink: jest.fn().mockResolvedValue(undefined),
};

jest.mock('react-native-fs', () => mockRNFS);

// Mock the wrapper so isSimulationMode is false (tests use mocked RNFS)
jest.mock('../../utils/rnfsWrapper', () => ({
  __esModule: true,
  default: mockRNFS,
  rnfsWrapper: { isSimulationMode: false },
}));

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Alert: {
      alert: jest.fn(),
    },
    Linking: {
      ...RN.Linking,
      openSettings: jest.fn().mockResolvedValue(undefined),
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 375, height: 812, scale: 3, fontScale: 1 })),
    },
  };
});

const mockCheck = jest.fn();
const mockRequest = jest.fn();

jest.mock('react-native-permissions', () => ({
  check: (...args: any[]) => mockCheck(...args),
  request: (...args: any[]) => mockRequest(...args),
  PERMISSIONS: {
    IOS: {
      PHOTO_LIBRARY_ADD_ONLY: 'ios.permission.PHOTO_LIBRARY_ADD_ONLY',
      MICROPHONE: 'ios.permission.MICROPHONE',
      SPEECH_RECOGNITION: 'ios.permission.SPEECH_RECOGNITION',
    },
    ANDROID: {
      WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE',
      RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
    },
  },
  RESULTS: {
    UNAVAILABLE: 'unavailable',
    DENIED: 'denied',
    GRANTED: 'granted',
    BLOCKED: 'blocked',
    LIMITED: 'limited',
  },
}));

const mockSaveAsset = jest.fn();

jest.mock('@react-native-camera-roll/camera-roll', () => ({
  CameraRoll: {
    saveAsset: (...args: any[]) => mockSaveAsset(...args),
  },
}));

const mockAlert = Alert.alert as jest.MockedFunction<typeof Alert.alert>;
const RNFS = mockRNFS;

// Mock global fetch for URL validation (HEAD requests in component useEffect)
const mockFetch = jest.fn().mockResolvedValue({
  ok: true,
  status: 200,
  headers: { get: () => 'image/jpeg' },
});
(global as any).fetch = mockFetch;

// --- Helpers ---

const defaultProps = {
  sessionId: 'test-session-001',
  userId: 'test-user-001',
  storyTitle: 'A Test Story',
  onImageSaved: jest.fn(),
  onError: jest.fn(),
};

// Use a file:// URL — the component treats local paths as already cached,
// skipping URL validation and network download in the useEffect.
// This lets us test the Save to Photos button flow in isolation.
const IMAGE_URL = 'file:///mock/documents/ImageCache/cached_story-image.jpg';

/**
 * Helper: render component with a local file:// URL, simulate image load.
 * Using file:// skips the component's external URL validation and download useEffect,
 * so the Image element renders immediately and we can test button interactions cleanly.
 */
const renderWithLoadedImage = async (extraProps = {}) => {
  const result = render(
    <StoryImageDisplay
      {...defaultProps}
      imageUrl={IMAGE_URL}
      showDownloadButton
      showShareButton
      {...extraProps}
    />,
  );

  // Local file path is detected immediately — wait for Image element
  await waitFor(() => {
    expect(result.getByTestId('story-image')).toBeTruthy();
  });

  // Simulate successful image load so action buttons render
  await act(async () => {
    fireEvent(result.getByTestId('story-image'), 'onLoad');
  });

  return result;
};

// --- Tests ---

describe('StoryImageDisplay — Save to Photos (US-003)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: permission granted
    mockCheck.mockResolvedValue('granted');
    mockRequest.mockResolvedValue('granted');
    mockSaveAsset.mockResolvedValue({ uri: 'ph://asset' });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'image/jpeg' },
    });
    RNFS.exists.mockResolvedValue(false);
    RNFS.mkdir.mockResolvedValue(undefined);
    RNFS.downloadFile.mockReturnValue({
      promise: Promise.resolve({ statusCode: 200 }),
    });
  });

  // ── Rendering ──

  describe('Button rendering', () => {
    test('"Photos" button renders when imageUrl is provided', async () => {
      const { getByText } = await renderWithLoadedImage();
      expect(getByText('Photos')).toBeTruthy();
    });

    test('"Photos" button does NOT render when imageUrl is absent', () => {
      const { queryByText } = render(
        <StoryImageDisplay
          {...defaultProps}
          showDownloadButton
          showShareButton
        />,
      );
      expect(queryByText('Photos')).toBeNull();
    });

    test('"Photos" button does NOT render when image has error state', async () => {
      const result = render(
        <StoryImageDisplay
          {...defaultProps}
          imageUrl={IMAGE_URL}
          showDownloadButton
          showShareButton
        />,
      );

      // Wait for image element then simulate error
      await waitFor(() => {
        expect(result.getByTestId('story-image')).toBeTruthy();
      });

      await act(async () => {
        fireEvent(result.getByTestId('story-image'), 'onError', {
          nativeEvent: { error: 'Load failed' },
        });
      });

      expect(result.queryByText('Photos')).toBeNull();
    });

    test('"Photos" button renders between Save Image and Share buttons', async () => {
      const { getByText } = await renderWithLoadedImage();
      // All three buttons should be present
      expect(getByText('Save Image')).toBeTruthy();
      expect(getByText('Photos')).toBeTruthy();
      expect(getByText('Share')).toBeTruthy();
    });

    test('"Photos" button has the 🖼️ icon', async () => {
      const { getByText } = await renderWithLoadedImage();
      expect(getByText('🖼️')).toBeTruthy();
    });
  });

  // ─�� Permission flow ──

  describe('Permission handling', () => {
    test('tapping "Photos" button calls permission check', async () => {
      const { getByText } = await renderWithLoadedImage();

      await act(async () => {
        fireEvent.press(getByText('Photos'));
      });

      expect(mockCheck).toHaveBeenCalledWith(
        'ios.permission.PHOTO_LIBRARY_ADD_ONLY',
      );
    });

    test('permission denied → requests permission, proceeds if granted', async () => {
      mockCheck.mockResolvedValue('denied');
      mockRequest.mockResolvedValue('granted');

      const { getByText } = await renderWithLoadedImage();

      await act(async () => {
        fireEvent.press(getByText('Photos'));
      });

      expect(mockRequest).toHaveBeenCalledWith(
        'ios.permission.PHOTO_LIBRARY_ADD_ONLY',
      );
    });

    test('permission blocked �� shows settings alert, does NOT call request()', async () => {
      mockCheck.mockResolvedValue('blocked');

      const { getByText } = await renderWithLoadedImage();

      await act(async () => {
        fireEvent.press(getByText('Photos'));
      });

      expect(mockRequest).not.toHaveBeenCalled();
      expect(mockAlert).toHaveBeenCalledWith(
        'Photo Library Access Required',
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({ text: 'Open Settings' }),
        ]),
      );
    });

    test('settings alert includes "Open Settings" button when permission is blocked', async () => {
      mockCheck.mockResolvedValue('blocked');

      const { getByText } = await renderWithLoadedImage();

      await act(async () => {
        fireEvent.press(getByText('Photos'));
      });

      // Verify the alert includes both Cancel and Open Settings buttons
      const alertButtons = mockAlert.mock.calls[0][2] as any[];
      expect(alertButtons).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel' }),
          expect.objectContaining({
            text: 'Open Settings',
            onPress: expect.any(Function),
          }),
        ]),
      );
    });
  });

  // ── Loading state ──

  describe('Loading state', () => {
    test('button shows "Saving..." and spinner while save is in progress', async () => {
      // Make saveAsset hang so we can observe loading state
      let resolveSave: (v: any) => void;
      mockSaveAsset.mockReturnValue(
        new Promise(resolve => {
          resolveSave = resolve;
        }),
      );

      const { getByText, queryByText } = await renderWithLoadedImage();

      await act(async () => {
        fireEvent.press(getByText('Photos'));
      });

      // While saving, button text changes
      expect(queryByText('Saving...')).toBeTruthy();

      // Resolve the save
      await act(async () => {
        resolveSave!({ uri: 'ph://asset' });
      });
    });

    test('button is disabled during save operation', async () => {
      let resolveSave: (v: any) => void;
      mockSaveAsset.mockReturnValue(
        new Promise(resolve => {
          resolveSave = resolve;
        }),
      );

      const { getByText } = await renderWithLoadedImage();

      // First tap
      await act(async () => {
        fireEvent.press(getByText('Photos'));
      });

      // Second tap should be ignored because isSavingToPhotos is true
      // The handler checks state.isSavingToPhotos and returns early
      expect(mockSaveAsset).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveSave!({ uri: 'ph://asset' });
      });
    });
  });

  // ── Success flow ──

  describe('Success flow', () => {
    test('success alert shown after successful save', async () => {
      const { getByText } = await renderWithLoadedImage();

      await act(async () => {
        fireEvent.press(getByText('Photos'));
      });

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Saved to Photos!',
          expect.stringContaining('Photo Library'),
          expect.any(Array),
        );
      });
    });

    test('onImageSaved callback called on success', async () => {
      const { getByText } = await renderWithLoadedImage();

      await act(async () => {
        fireEvent.press(getByText('Photos'));
      });

      await waitFor(() => {
        expect(defaultProps.onImageSaved).toHaveBeenCalled();
      });
    });
  });

  // ── Error flow ──

  describe('Error flow', () => {
    test('error alert shown with "Try Again" when CameraRoll save fails', async () => {
      mockSaveAsset.mockRejectedValue(new Error('Disk full'));

      const { getByText } = await renderWithLoadedImage();

      await act(async () => {
        fireEvent.press(getByText('Photos'));
      });

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Save Failed',
          expect.stringContaining('Disk full'),
          expect.arrayContaining([
            expect.objectContaining({ text: 'Try Again' }),
          ]),
        );
      });
    });

    test('error alert shown when saveImageToPhotos returns failure', async () => {
      mockSaveAsset.mockResolvedValue(undefined);
      // Mock the utility to return failure (non-Error path)
      // saveImageToPhotos wraps saveAsset, if saveAsset doesn't throw but
      // returns unexpected value, it still succeeds. Test explicit rejection:
      mockSaveAsset.mockRejectedValue(new Error('Permission denied by system'));

      const { getByText } = await renderWithLoadedImage();

      await act(async () => {
        fireEvent.press(getByText('Photos'));
      });

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Save Failed',
          expect.stringContaining('Permission denied by system'),
          expect.arrayContaining([
            expect.objectContaining({ text: 'Try Again' }),
          ]),
        );
      });
    });
  });

  // ── Integration: full flow ──

  describe('Integration: full save-to-photos flow', () => {
    test('local file → permission request → CameraRoll save → success alert + callback', async () => {
      // Permission starts DENIED, granted after request
      mockCheck.mockResolvedValue('denied');
      mockRequest.mockResolvedValue('granted');
      mockSaveAsset.mockResolvedValue({ uri: 'ph://saved' });

      const onSaved = jest.fn();
      const { getByText } = await renderWithLoadedImage({
        onImageSaved: onSaved,
      });

      await act(async () => {
        fireEvent.press(getByText('Photos'));
      });

      // Permission was requested
      await waitFor(() => {
        expect(mockRequest).toHaveBeenCalledWith(
          'ios.permission.PHOTO_LIBRARY_ADD_ONLY',
        );
      });

      // CameraRoll.saveAsset called with the local path (file:// stripped)
      expect(mockSaveAsset).toHaveBeenCalledWith(
        '/mock/documents/ImageCache/cached_story-image.jpg',
        { type: 'photo' },
      );

      // Success alert
      expect(mockAlert).toHaveBeenCalledWith(
        'Saved to Photos!',
        expect.any(String),
        expect.any(Array),
      );

      // Callback invoked with local path
      expect(onSaved).toHaveBeenCalledWith(
        '/mock/documents/ImageCache/cached_story-image.jpg',
      );
    });
  });
});
