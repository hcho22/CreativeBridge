/**
 * saveToPhotos Utility Test Suite (US-002)
 * Tests for permission handling, CameraRoll save, and simulation mode
 */

import { Alert, Linking, Platform } from 'react-native';
import { check, request, RESULTS } from 'react-native-permissions';

// ─── Mocks ───────────────────────────────────────────────────────────

// Mock react-native-permissions
jest.mock('react-native-permissions', () => ({
  check: jest.fn(),
  request: jest.fn(),
  PERMISSIONS: {
    IOS: { PHOTO_LIBRARY_ADD_ONLY: 'ios.permission.PHOTO_LIBRARY_ADD_ONLY' },
    ANDROID: {
      WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE',
    },
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
    UNAVAILABLE: 'unavailable',
    LIMITED: 'limited',
  },
}));

// Mock CameraRoll — default to available; individual tests override via jest.mock reset
const mockSaveAsset = jest.fn().mockResolvedValue({ uri: 'ph://asset-id' });

jest.mock('@react-native-camera-roll/camera-roll', () => ({
  CameraRoll: {
    saveAsset: mockSaveAsset,
  },
}));

const mockCheck = check as jest.MockedFunction<typeof check>;
const mockRequest = request as jest.MockedFunction<typeof request>;
const mockAlert = Alert.alert as jest.MockedFunction<typeof Alert.alert>;

// Linking.openSettings is not included in the global RN mock — patch it onto the mock
const mockOpenSettings = jest.fn().mockResolvedValue(undefined);
Linking.openSettings = mockOpenSettings;

// ─── Import module under test AFTER mocks ────────────────────────────

// We need fresh imports per describe block for simulation mode tests,
// but for the main tests we import once.
let requestPhotoLibraryPermission: typeof import('../../utils/saveToPhotos').requestPhotoLibraryPermission;
let saveImageToPhotos: typeof import('../../utils/saveToPhotos').saveImageToPhotos;

beforeAll(() => {
  const mod = require('../../utils/saveToPhotos');
  requestPhotoLibraryPermission = mod.requestPhotoLibraryPermission;
  saveImageToPhotos = mod.saveImageToPhotos;
});

// ─── Tests ───────────────────────────────────────────────────────────

describe('saveToPhotos Utility (US-002)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── requestPhotoLibraryPermission ────────────────────────────────

  describe('requestPhotoLibraryPermission', () => {
    describe('iOS', () => {
      beforeEach(() => {
        (Platform as any).OS = 'ios';
      });

      it('returns true when permission is GRANTED', async () => {
        mockCheck.mockResolvedValue(RESULTS.GRANTED);

        const result = await requestPhotoLibraryPermission();

        expect(result).toBe(true);
        expect(mockCheck).toHaveBeenCalled();
        expect(mockRequest).not.toHaveBeenCalled();
      });

      it('returns true when permission is LIMITED', async () => {
        mockCheck.mockResolvedValue(RESULTS.LIMITED);

        const result = await requestPhotoLibraryPermission();

        expect(result).toBe(true);
      });

      it('calls request() when status is DENIED and returns true on grant', async () => {
        mockCheck.mockResolvedValue(RESULTS.DENIED);
        mockRequest.mockResolvedValue(RESULTS.GRANTED);

        const result = await requestPhotoLibraryPermission();

        expect(result).toBe(true);
        expect(mockRequest).toHaveBeenCalled();
      });

      it('calls request() when DENIED and returns false if still denied', async () => {
        mockCheck.mockResolvedValue(RESULTS.DENIED);
        mockRequest.mockResolvedValue(RESULTS.DENIED);

        const result = await requestPhotoLibraryPermission();

        expect(result).toBe(false);
      });

      it('returns false when status is BLOCKED and does not call request()', async () => {
        mockCheck.mockResolvedValue(RESULTS.BLOCKED);

        const result = await requestPhotoLibraryPermission();

        expect(result).toBe(false);
        expect(mockRequest).not.toHaveBeenCalled();
      });

      it('shows Settings alert when BLOCKED', async () => {
        mockCheck.mockResolvedValue(RESULTS.BLOCKED);

        await requestPhotoLibraryPermission();

        expect(mockAlert).toHaveBeenCalledWith(
          'Photo Library Access Required',
          expect.any(String),
          expect.arrayContaining([
            expect.objectContaining({ text: 'Cancel' }),
            expect.objectContaining({ text: 'Open Settings' }),
          ]),
        );

        // Simulate pressing "Open Settings"
        const alertButtons = mockAlert.mock.calls[0][2] as any[];
        const openSettingsButton = alertButtons.find(
          (b: any) => b.text === 'Open Settings',
        );
        openSettingsButton?.onPress?.();

        expect(mockOpenSettings).toHaveBeenCalled();
      });

      it('returns false when status is UNAVAILABLE', async () => {
        mockCheck.mockResolvedValue(RESULTS.UNAVAILABLE);

        const result = await requestPhotoLibraryPermission();

        expect(result).toBe(false);
      });

      it('returns false when check() throws an error', async () => {
        mockCheck.mockRejectedValue(new Error('Permission check failed'));

        const result = await requestPhotoLibraryPermission();

        expect(result).toBe(false);
      });
    });

    describe('Android', () => {
      it('returns true without checking permissions on API 33+ (scoped storage)', async () => {
        (Platform as any).OS = 'android';
        (Platform as any).Version = 33;

        const result = await requestPhotoLibraryPermission();

        expect(result).toBe(true);
        expect(mockCheck).not.toHaveBeenCalled();
      });

      it('checks WRITE_EXTERNAL_STORAGE on API < 33', async () => {
        (Platform as any).OS = 'android';
        (Platform as any).Version = 30;
        mockCheck.mockResolvedValue(RESULTS.GRANTED);

        const result = await requestPhotoLibraryPermission();

        expect(result).toBe(true);
        expect(mockCheck).toHaveBeenCalled();
      });

      it('requests WRITE_EXTERNAL_STORAGE when DENIED on API < 33', async () => {
        (Platform as any).OS = 'android';
        (Platform as any).Version = 29;
        mockCheck.mockResolvedValue(RESULTS.DENIED);
        mockRequest.mockResolvedValue(RESULTS.GRANTED);

        const result = await requestPhotoLibraryPermission();

        expect(result).toBe(true);
        expect(mockRequest).toHaveBeenCalled();
      });
    });

    afterAll(() => {
      // Reset Platform back to iOS for remaining tests
      (Platform as any).OS = 'ios';
    });
  });

  // ── saveImageToPhotos ────────────────────────────────────────────

  describe('saveImageToPhotos', () => {
    it('calls CameraRoll.saveAsset with the correct file path', async () => {
      await saveImageToPhotos('/path/to/image.jpg');

      expect(mockSaveAsset).toHaveBeenCalledWith('/path/to/image.jpg', {
        type: 'photo',
      });
    });

    it('returns { success: true } on successful save', async () => {
      mockSaveAsset.mockResolvedValue({ uri: 'ph://saved' });

      const result = await saveImageToPhotos('/path/to/image.jpg');

      expect(result).toEqual({ success: true });
    });

    it('returns { success: false, error: "..." } when CameraRoll throws', async () => {
      mockSaveAsset.mockRejectedValue(new Error('Disk full'));

      const result = await saveImageToPhotos('/path/to/image.jpg');

      expect(result).toEqual({
        success: false,
        error: 'Disk full',
      });
    });

    it('handles non-Error thrown values', async () => {
      mockSaveAsset.mockRejectedValue('unexpected string error');

      const result = await saveImageToPhotos('/path/to/image.jpg');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ── Integration: end-to-end permission + save flow ───────────────

  describe('Integration: permission flow → save', () => {
    beforeEach(() => {
      (Platform as any).OS = 'ios';
    });

    it('DENIED → request → GRANTED → saveAsset → success', async () => {
      // Step 1: Permission starts as DENIED, then granted after request
      mockCheck.mockResolvedValue(RESULTS.DENIED);
      mockRequest.mockResolvedValue(RESULTS.GRANTED);

      const permissionGranted = await requestPhotoLibraryPermission();
      expect(permissionGranted).toBe(true);

      // Step 2: Save the image
      mockSaveAsset.mockResolvedValue({ uri: 'ph://saved' });
      const result = await saveImageToPhotos('/cache/story-image.jpg');

      expect(result).toEqual({ success: true });
      expect(mockSaveAsset).toHaveBeenCalledWith('/cache/story-image.jpg', {
        type: 'photo',
      });
    });

    it('BLOCKED → returns false without attempting save', async () => {
      mockCheck.mockResolvedValue(RESULTS.BLOCKED);

      const permissionGranted = await requestPhotoLibraryPermission();
      expect(permissionGranted).toBe(false);

      // Save should NOT be called when permission is blocked
      expect(mockSaveAsset).not.toHaveBeenCalled();
    });
  });
});

// ── Simulation Mode Tests ──────────────────────────────────────────

describe('saveToPhotos Simulation Mode', () => {
  let simModule: typeof import('../../utils/saveToPhotos');

  beforeAll(() => {
    // Clear the module cache and make CameraRoll unavailable
    jest.resetModules();

    // Re-mock dependencies (resetModules clears them)
    jest.mock('react-native-permissions', () => ({
      check: jest.fn(),
      request: jest.fn(),
      PERMISSIONS: {
        IOS: {
          PHOTO_LIBRARY_ADD_ONLY: 'ios.permission.PHOTO_LIBRARY_ADD_ONLY',
        },
        ANDROID: {
          WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE',
        },
      },
      RESULTS: {
        GRANTED: 'granted',
        DENIED: 'denied',
        BLOCKED: 'blocked',
        UNAVAILABLE: 'unavailable',
        LIMITED: 'limited',
      },
    }));

    // Make CameraRoll throw on require — simulates missing native module
    jest.mock('@react-native-camera-roll/camera-roll', () => {
      throw new Error('Cannot find native module');
    });

    simModule = require('../../utils/saveToPhotos');
  });

  it('detects simulation mode when CameraRoll is unavailable', () => {
    expect(simModule.isSimulationMode()).toBe(true);
  });

  it('returns { success: false } without calling CameraRoll', async () => {
    const result = await simModule.saveImageToPhotos('/path/to/image.jpg');

    expect(result).toEqual({
      success: false,
      error: 'Native module not available',
    });
  });
});
