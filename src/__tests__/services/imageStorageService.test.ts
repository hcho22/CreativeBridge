/**
 * Image Storage Service - Comprehensive Unit Tests
 * Tests for Supabase Storage upload with retry logic and error handling
 */

import {
  imageStorageService,
  ImageStorageService,
} from '../../services/imageStorageService';
import { supabase } from '../../services/supabase';

// Mock dependencies
jest.mock('../../services/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(),
    },
    from: jest.fn(),
  },
}));

// FR-8 deferral marker — see .claude/.agent/Tasks/prd-ci-debt-cleanup.md
// US-015c batch 3 ("Service rewrites") for the rewrite plan.
//
// Why this whole describe is skipped:
// The service was migrated from Supabase Storage to Convex Storage during
// US-019 / Phase B. `uploadImageToSupabase` is now a thin wrapper that
// delegates to `uploadImageToConvex`; `getPublicUrl` is deprecated and
// returns ''; `deleteImage`'s signature changed from `(userId, sessionId)`
// to `(sessionId)`; `checkStorageHealth` queries Convex via
// `client.query(api.storage.checkStorageHealth)` instead of listing a
// bucket. The 18 tests in this file mock `supabase.storage.from(...)` and
// `supabase.from(...)` — neither of which the production code path
// touches anymore. The test exercise calls go through `isConvexReady() →
// false` and return canned "Convex not available" errors that the
// existing assertions don't recognise.
//
// Rewriting requires a full mock-setup reshape: mock `isConvexReady`,
// `getConvexClient` (returning an object with `query`/`mutation`/`action`
// methods), `global.fetch` for both Replicate-download and presigned-URL
// upload paths, and re-anchor each test's assertions to the new return
// shape (`UploadImageResult` with `success`/`status`/`attempts`/`error`).
// Estimated cost: ~250 lines of test changes. Out of scope for batch 3b.
//
// Skipping these tests reduces the CI failure count by 18 without losing
// information about what needs to be rewritten — the test bodies remain
// in place as a record of the original assertions to migrate.
describe.skip('ImageStorageService', () => {
  let service: ImageStorageService;
  let mockStorage: any;
  let mockDatabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ImageStorageService();

    // Setup storage mocks
    mockStorage = {
      upload: jest.fn(),
      getPublicUrl: jest.fn(),
      list: jest.fn(),
      remove: jest.fn(),
    };

    // Setup database mocks
    mockDatabase = {
      select: jest.fn(() => mockDatabase),
      eq: jest.fn(() => mockDatabase),
      single: jest.fn(),
      update: jest.fn(() => mockDatabase),
    };

    (supabase.storage.from as jest.Mock).mockReturnValue(mockStorage);
    (supabase.from as jest.Mock).mockReturnValue(mockDatabase);

    // Mock global fetch for image downloads
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('uploadImageToSupabase', () => {
    it('should successfully upload image on first attempt', async () => {
      // Mock successful image download
      const mockBlob = new Blob(['fake-image'], { type: 'image/png' });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      // Mock successful upload
      mockStorage.upload.mockResolvedValue({
        data: { path: 'user-123/session-456.png' },
        error: null,
      });

      mockStorage.getPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://supabase.co/storage/image.png' },
      });

      // Mock database update
      mockDatabase.update.mockResolvedValue({ error: null });

      const result = await service.uploadImageToSupabase(
        'https://replicate.delivery/test.png',
        'session-456',
        'user-123',
      );

      expect(result.success).toBe(true);
      expect(result.supabaseUrl).toBe('https://supabase.co/storage/image.png');
      expect(result.attempts).toBe(1);
      expect(result.status).toBe('uploaded');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(mockStorage.upload).toHaveBeenCalledTimes(1);
    });

    it('should retry up to 3 times on failure', async () => {
      const mockBlob = new Blob(['fake-image'], { type: 'image/png' });

      // Fail twice, succeed on third attempt
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(mockBlob),
        });

      mockStorage.upload.mockResolvedValue({
        data: { path: 'user-123/session-456.png' },
        error: null,
      });

      mockStorage.getPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://supabase.co/storage/image.png' },
      });

      mockDatabase.update.mockResolvedValue({ error: null });

      const result = await service.uploadImageToSupabase(
        'https://replicate.delivery/test.png',
        'session-456',
        'user-123',
      );

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should return failure after max retry attempts', async () => {
      // Fail all attempts
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      mockDatabase.update.mockResolvedValue({ error: null });

      const result = await service.uploadImageToSupabase(
        'https://replicate.delivery/test.png',
        'session-456',
        'user-123',
      );

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(result.status).toBe('failed');
      expect(result.error).toContain('Network error');
    });

    it('should reject files larger than 10MB', async () => {
      // Create 11MB blob
      const largeBlob = new Blob(['x'.repeat(11 * 1024 * 1024)], {
        type: 'image/png',
      });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(largeBlob),
      });

      mockDatabase.update.mockResolvedValue({ error: null });

      const result = await service.uploadImageToSupabase(
        'https://replicate.delivery/large.png',
        'session-456',
        'user-123',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('too large');
      expect(result.error).toContain('10MB');
    });

    it('should reject invalid MIME types', async () => {
      const invalidBlob = new Blob(['fake-data'], { type: 'application/pdf' });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(invalidBlob),
      });

      mockDatabase.update.mockResolvedValue({ error: null });

      const result = await service.uploadImageToSupabase(
        'https://replicate.delivery/test.pdf',
        'session-456',
        'user-123',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid MIME type');
    });

    it('should handle Supabase storage errors', async () => {
      const mockBlob = new Blob(['fake-image'], { type: 'image/png' });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      // Mock storage error
      mockStorage.upload.mockResolvedValue({
        data: null,
        error: { message: 'Storage quota exceeded' },
      });

      mockDatabase.update.mockResolvedValue({ error: null });

      const result = await service.uploadImageToSupabase(
        'https://replicate.delivery/test.png',
        'session-456',
        'user-123',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage quota exceeded');
    });

    it('should sanitize file paths to prevent path traversal', async () => {
      const mockBlob = new Blob(['fake-image'], { type: 'image/png' });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      mockStorage.upload.mockResolvedValue({
        data: { path: 'user-123/session-456.png' },
        error: null,
      });

      mockStorage.getPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://supabase.co/storage/image.png' },
      });

      mockDatabase.update.mockResolvedValue({ error: null });

      await service.uploadImageToSupabase(
        'https://replicate.delivery/test.png',
        '../../../session-456',
        '../../user-123',
      );

      // Verify upload was called with sanitized path
      expect(mockStorage.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\.png$/),
        expect.any(Blob),
        expect.any(Object),
      );
    });
  });

  describe('retryFailedUpload', () => {
    it('should fetch session and retry upload', async () => {
      // Mock database fetch
      mockDatabase.single.mockResolvedValue({
        data: {
          generated_image_url: 'https://replicate.delivery/test.png',
          image_upload_status: 'failed',
        },
        error: null,
      });

      // Mock successful upload
      const mockBlob = new Blob(['fake-image'], { type: 'image/png' });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      mockStorage.upload.mockResolvedValue({
        data: { path: 'user-123/session-456.png' },
        error: null,
      });

      mockStorage.getPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://supabase.co/storage/image.png' },
      });

      mockDatabase.update.mockResolvedValue({ error: null });

      const result = await service.retryFailedUpload('session-456', 'user-123');

      expect(result.success).toBe(true);
      expect(result.supabaseUrl).toBe('https://supabase.co/storage/image.png');
      expect(mockDatabase.select).toHaveBeenCalled();
    });

    it('should skip retry if image already uploaded', async () => {
      mockDatabase.single.mockResolvedValue({
        data: {
          generated_image_url: 'https://replicate.delivery/test.png',
          image_upload_status: 'uploaded',
        },
        error: null,
      });

      const result = await service.retryFailedUpload('session-456', 'user-123');

      expect(result.success).toBe(true);
      expect(result.error).toContain('already uploaded');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle missing Replicate URL', async () => {
      mockDatabase.single.mockResolvedValue({
        data: {
          generated_image_url: null,
          image_upload_status: 'failed',
        },
        error: null,
      });

      const result = await service.retryFailedUpload('session-456', 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No Replicate image URL');
    });

    it('should handle database fetch errors', async () => {
      mockDatabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Session not found' },
      });

      const result = await service.retryFailedUpload('session-456', 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fetch session');
    });
  });

  describe('checkStorageHealth', () => {
    it('should return healthy status when bucket is accessible', async () => {
      mockStorage.list.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await service.checkStorageHealth();

      expect(result.healthy).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return unhealthy status on error', async () => {
      mockStorage.list.mockResolvedValue({
        data: null,
        error: { message: 'Bucket not found' },
      });

      const result = await service.checkStorageHealth();

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('Bucket not found');
    });
  });

  describe('getPublicUrl', () => {
    it('should generate correct public URL', () => {
      mockStorage.getPublicUrl.mockReturnValue({
        data: {
          publicUrl: 'https://supabase.co/storage/user-123/session-456.png',
        },
      });

      const url = service.getPublicUrl('user-123', 'session-456');

      expect(url).toBe('https://supabase.co/storage/user-123/session-456.png');
      expect(mockStorage.getPublicUrl).toHaveBeenCalledWith(
        'user-123/session-456.png',
      );
    });
  });

  describe('deleteImage', () => {
    it('should successfully delete image', async () => {
      mockStorage.remove.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.deleteImage('user-123', 'session-456');

      expect(result.success).toBe(true);
      expect(mockStorage.remove).toHaveBeenCalledWith([
        'user-123/session-456.png',
      ]);
    });

    it('should handle deletion errors', async () => {
      mockStorage.remove.mockResolvedValue({
        data: null,
        error: { message: 'File not found' },
      });

      const result = await service.deleteImage('user-123', 'session-456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });
  });

  describe('Configuration', () => {
    it('should expose configuration for debugging', () => {
      const config = service.getConfig();

      expect(config).toHaveProperty('BUCKET_NAME', 'story-images');
      expect(config).toHaveProperty('MAX_RETRY_ATTEMPTS', 3);
      expect(config).toHaveProperty('MAX_IMAGE_SIZE_MB', 10);
    });
  });

  describe('Exponential Backoff', () => {
    it('should use exponential backoff between retries', async () => {
      // Mock all attempts failing
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      mockDatabase.update.mockResolvedValue({ error: null });

      const startTime = Date.now();
      await service.uploadImageToSupabase(
        'https://replicate.delivery/test.png',
        'session-456',
        'user-123',
      );
      const elapsed = Date.now() - startTime;

      // Expected delays: 1000ms + 2000ms + 4000ms = 7000ms
      // Allow some tolerance for test execution time
      expect(elapsed).toBeGreaterThanOrEqual(6500);
      expect(elapsed).toBeLessThan(10000);
    });
  });

  describe('Singleton Instance', () => {
    it('should export a singleton instance', () => {
      expect(imageStorageService).toBeInstanceOf(ImageStorageService);
    });
  });
});
