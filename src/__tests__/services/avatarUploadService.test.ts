/**
 * Avatar Upload Service - Unit Tests
 * Tests for pickAvatarImage() and uploadAvatarToConvex()
 *
 * @implements US-001 Validation Test (prd-profile-picture-upload.md)
 */

import {
  pickAvatarImage,
  uploadAvatarToConvex,
} from '../../services/avatarUploadService';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock react-native-image-picker
const mockLaunchImageLibrary = jest.fn();
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: (...args: any[]) => mockLaunchImageLibrary(...args),
}));

// Mock react-native (Alert, Linking, Platform)
jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Linking: { openSettings: jest.fn() },
  Platform: { OS: 'ios' },
}));

// Mock Convex client
const mockMutation = jest.fn();
const mockQuery = jest.fn();
const mockGetConvexClient = jest.fn();
const mockIsConvexReady = jest.fn();

jest.mock('../../services/convex', () => ({
  getConvexClient: () => mockGetConvexClient(),
  isConvexReady: () => mockIsConvexReady(),
}));

// Mock Convex generated API (just needs to be importable)
jest.mock('../../../convex/_generated/api', () => ({
  api: {
    storage: {
      generateUploadUrl: 'storage:generateUploadUrl',
      getImageUrl: 'storage:getImageUrl',
    },
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('avatarUploadService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: Convex is ready with a working client
    mockIsConvexReady.mockReturnValue(true);
    mockGetConvexClient.mockReturnValue({
      mutation: mockMutation,
      query: mockQuery,
    });
  });

  // ─── pickAvatarImage ─────────────────────────────────────────────────────

  describe('pickAvatarImage', () => {
    it('should return asset on successful selection', async () => {
      mockLaunchImageLibrary.mockResolvedValue({
        assets: [
          {
            uri: 'file:///photos/avatar.jpg',
            type: 'image/jpeg',
            fileName: 'avatar.jpg',
          },
        ],
      });

      const result = await pickAvatarImage();

      expect(result).toEqual({
        uri: 'file:///photos/avatar.jpg',
        type: 'image/jpeg',
        fileName: 'avatar.jpg',
      });
      expect(mockLaunchImageLibrary).toHaveBeenCalledWith({
        mediaType: 'photo',
        selectionLimit: 1,
        quality: 0.7,
        maxWidth: 400,
        maxHeight: 400,
      });
    });

    it('should return null when user cancels', async () => {
      mockLaunchImageLibrary.mockResolvedValue({ didCancel: true });

      const result = await pickAvatarImage();

      expect(result).toBeNull();
    });

    it('should return null on permission error and show settings alert', async () => {
      const { Alert } = require('react-native');
      mockLaunchImageLibrary.mockResolvedValue({
        errorCode: 'permission',
        errorMessage: 'Photo library access denied',
      });

      const result = await pickAvatarImage();

      expect(result).toBeNull();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Photo Access Required',
        expect.stringContaining('photo library access'),
        expect.any(Array),
      );
    });

    it('should return null on other error codes', async () => {
      mockLaunchImageLibrary.mockResolvedValue({
        errorCode: 'others',
        errorMessage: 'Something went wrong',
      });

      const result = await pickAvatarImage();

      expect(result).toBeNull();
    });

    it('should return null when assets array is empty', async () => {
      mockLaunchImageLibrary.mockResolvedValue({ assets: [] });

      const result = await pickAvatarImage();

      expect(result).toBeNull();
    });

    it('should return null when launchImageLibrary throws', async () => {
      mockLaunchImageLibrary.mockRejectedValue(new Error('Crash'));

      const result = await pickAvatarImage();

      expect(result).toBeNull();
    });

    it('should default type and fileName when asset omits them', async () => {
      mockLaunchImageLibrary.mockResolvedValue({
        assets: [{ uri: 'file:///photos/img.png' }],
      });

      const result = await pickAvatarImage();

      expect(result).toEqual({
        uri: 'file:///photos/img.png',
        type: 'image/jpeg',
        fileName: 'avatar.jpg',
      });
    });
  });

  // ─── uploadAvatarToConvex ────────────────────────────────────────────────

  describe('uploadAvatarToConvex', () => {
    const fakeBlob = new Blob(['fake-image']);

    beforeEach(() => {
      // Mock global fetch for local image fetch + presigned URL upload
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should upload successfully and return avatarUrl', async () => {
      // Step 1: fetch local image → blob
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ blob: () => Promise.resolve(fakeBlob) })
        // Step 3: POST blob to presigned URL
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ storageId: 'storage_abc123' }),
        });

      // Step 2: generateUploadUrl mutation
      mockMutation.mockResolvedValue('https://convex.cloud/upload/presigned');

      // Step 5: getImageUrl query
      mockQuery.mockResolvedValue(
        'https://convex.cloud/storage/permanent-avatar.jpg',
      );

      const result = await uploadAvatarToConvex(
        'file:///photos/avatar.jpg',
        'image/jpeg',
      );

      expect(result).toEqual({
        success: true,
        avatarUrl: 'https://convex.cloud/storage/permanent-avatar.jpg',
      });
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(mockMutation).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should return error when Convex is not ready', async () => {
      mockIsConvexReady.mockReturnValue(false);

      const result = await uploadAvatarToConvex(
        'file:///photos/avatar.jpg',
        'image/jpeg',
      );

      expect(result).toEqual({
        success: false,
        error: 'Convex is not available',
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return error on network failure during local fetch', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network request failed'),
      );

      const result = await uploadAvatarToConvex(
        'file:///photos/avatar.jpg',
        'image/jpeg',
      );

      expect(result).toEqual({
        success: false,
        error: 'Network request failed',
      });
    });

    it('should return error when presigned URL upload fails', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ blob: () => Promise.resolve(fakeBlob) })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

      mockMutation.mockResolvedValue('https://convex.cloud/upload/presigned');

      const result = await uploadAvatarToConvex(
        'file:///photos/avatar.jpg',
        'image/jpeg',
      );

      expect(result).toEqual({
        success: false,
        error: 'Upload failed: 500 Internal Server Error',
      });
    });

    it('should return error when getImageUrl returns null', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ blob: () => Promise.resolve(fakeBlob) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ storageId: 'storage_abc123' }),
        });

      mockMutation.mockResolvedValue('https://convex.cloud/upload/presigned');
      mockQuery.mockResolvedValue(null);

      const result = await uploadAvatarToConvex(
        'file:///photos/avatar.jpg',
        'image/jpeg',
      );

      expect(result).toEqual({
        success: false,
        error: 'Failed to resolve image URL from storage',
      });
    });

    it('should return error when generateUploadUrl mutation fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        blob: () => Promise.resolve(fakeBlob),
      });

      mockMutation.mockRejectedValue(new Error('Auth required'));

      const result = await uploadAvatarToConvex(
        'file:///photos/avatar.jpg',
        'image/jpeg',
      );

      expect(result).toEqual({
        success: false,
        error: 'Auth required',
      });
    });
  });
});
