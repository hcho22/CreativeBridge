// US-003 validation: WhisperModelDownloader gates the lazy base-model
// download on Wi-Fi connectivity, retries with exponential backoff on
// failure, verifies the downloaded byte count against the expected size,
// and exposes progress to subscribers.
//
// The PRD-required three-branch validation is captured by the first three
// `it` blocks: Wi-Fi → download, cellular → skip, offline → skip. The
// remaining assertions cover retry behavior, size guard, idempotence, and
// progress observation.
//
// Both `expo-file-system/legacy` and `@react-native-community/netinfo`
// are mocked locally to this test (with `jest.mock`) so the test doesn't
// pick up either the global netinfo mock or the real legacy file-system
// implementation.

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/documents/',
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  createDownloadResumable: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(),
  },
}));

import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';
import {
  WhisperModelDownloader,
  WhisperModelDownloadError,
  type ModelDownloadProgress,
} from '../../services/whisperModelDownloader';

const EXPECTED_BASE_BYTES = 59721011;
const EXPECTED_BASE_URI = 'file:///mock/documents/ggml-base.en-q5_1.bin';

type FetchMock = jest.Mock<Promise<unknown>, []>;

const netInfoFetch = (NetInfo as unknown as { fetch: FetchMock }).fetch;
const getInfoAsync = FileSystem.getInfoAsync as jest.Mock;
const deleteAsync = FileSystem.deleteAsync as jest.Mock;
const createDownloadResumable = FileSystem.createDownloadResumable as jest.Mock;

const setNetwork = (state: { type: string; isConnected: boolean }) => {
  netInfoFetch.mockResolvedValue(state);
};

const fileMissing = () => {
  getInfoAsync.mockResolvedValue({ exists: false });
};

const filePresent = (size: number) => {
  getInfoAsync.mockResolvedValue({
    exists: true,
    size,
    uri: EXPECTED_BASE_URI,
  });
};

const stubResumableDownload = (
  opts: {
    resolveWith?: { uri: string; size: number };
    rejectWith?: unknown;
    emitProgress?: Array<{ written: number; total: number }>;
  } = {},
) => {
  createDownloadResumable.mockImplementation(
    (
      _url: string,
      _target: string,
      _options: unknown,
      onProgress?: (data: {
        totalBytesWritten: number;
        totalBytesExpectedToWrite: number;
      }) => void,
    ) => ({
      downloadAsync: jest.fn().mockImplementation(async () => {
        if (opts.emitProgress && onProgress) {
          for (const tick of opts.emitProgress) {
            onProgress({
              totalBytesWritten: tick.written,
              totalBytesExpectedToWrite: tick.total,
            });
          }
        }
        if (opts.rejectWith) {
          throw opts.rejectWith;
        }
        return opts.resolveWith ?? { uri: EXPECTED_BASE_URI, status: 200 };
      }),
    }),
  );
};

describe('WhisperModelDownloader — US-003 lazy base-model download', () => {
  let originalSetTimeout: typeof setTimeout;

  beforeEach(() => {
    // Use mockReset (not clearAllMocks) so queued mockResolvedValueOnce
    // values from prior tests don't leak — clearAllMocks only clears call
    // history, not the implementation/return-value queue.
    netInfoFetch.mockReset();
    getInfoAsync.mockReset();
    deleteAsync.mockReset().mockResolvedValue(undefined);
    createDownloadResumable.mockReset();

    // Make backoff timers fire immediately so retry tests don't take seconds.
    // (Per the PRD: 3 attempts × 1s+2s+4s = up to 7s of real wait otherwise.)
    originalSetTimeout = global.setTimeout;
    (global as unknown as { setTimeout: typeof setTimeout }).setTimeout = ((
      fn: () => void,
    ) => {
      Promise.resolve().then(fn);
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout;
  });

  afterEach(() => {
    (global as unknown as { setTimeout: typeof setTimeout }).setTimeout =
      originalSetTimeout;
  });

  describe('PRD three-branch network gating', () => {
    it('downloads when on Wi-Fi and file is absent', async () => {
      fileMissing();
      setNetwork({ type: 'wifi', isConnected: true });
      stubResumableDownload();
      // After the download, getInfoAsync is called again for size verification.
      getInfoAsync.mockResolvedValueOnce({ exists: false });
      getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: EXPECTED_BASE_BYTES,
        uri: EXPECTED_BASE_URI,
      });

      const downloader = new WhisperModelDownloader();
      const result = await downloader.ensureBaseModelDownloaded();

      expect(result).not.toBeNull();
      expect(result!.uri).toBe(EXPECTED_BASE_URI);
      expect(result!.bytesDownloaded).toBe(EXPECTED_BASE_BYTES);
      expect(createDownloadResumable).toHaveBeenCalledTimes(1);
    });

    it('skips download on cellular', async () => {
      fileMissing();
      setNetwork({ type: 'cellular', isConnected: true });

      const downloader = new WhisperModelDownloader();
      const result = await downloader.ensureBaseModelDownloaded();

      expect(result).toBeNull();
      expect(createDownloadResumable).not.toHaveBeenCalled();
    });

    it('skips download when offline', async () => {
      fileMissing();
      setNetwork({ type: 'none', isConnected: false });

      const downloader = new WhisperModelDownloader();
      const result = await downloader.ensureBaseModelDownloaded();

      expect(result).toBeNull();
      expect(createDownloadResumable).not.toHaveBeenCalled();
    });
  });

  describe('idempotence', () => {
    it('returns null immediately if base model is already downloaded at correct size', async () => {
      filePresent(EXPECTED_BASE_BYTES);
      setNetwork({ type: 'wifi', isConnected: true });

      const downloader = new WhisperModelDownloader();
      const result = await downloader.ensureBaseModelDownloaded();

      expect(result).toBeNull();
      expect(createDownloadResumable).not.toHaveBeenCalled();
      expect(netInfoFetch).not.toHaveBeenCalled();
    });

    it('re-downloads if existing file is the wrong size (partial/corrupt)', async () => {
      // Initial check: file exists but wrong size.
      getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: 100,
        uri: EXPECTED_BASE_URI,
      });
      setNetwork({ type: 'wifi', isConnected: true });
      stubResumableDownload();
      // Post-download verification: correct size.
      getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: EXPECTED_BASE_BYTES,
        uri: EXPECTED_BASE_URI,
      });

      const downloader = new WhisperModelDownloader();
      const result = await downloader.ensureBaseModelDownloaded();

      expect(result).not.toBeNull();
      expect(createDownloadResumable).toHaveBeenCalledTimes(1);
    });

    it('shares a single in-flight download across concurrent callers', async () => {
      fileMissing();
      setNetwork({ type: 'wifi', isConnected: true });

      // Pre-create the deferred so the test can resolve the download from
      // outside the mock, regardless of when downloadAsync runs.
      let resolveDownload!: (value: { uri: string }) => void;
      const downloadDeferred = new Promise<{ uri: string }>(resolve => {
        resolveDownload = resolve;
      });
      createDownloadResumable.mockImplementation(() => ({
        downloadAsync: () => downloadDeferred,
      }));
      getInfoAsync.mockResolvedValueOnce({ exists: false });
      getInfoAsync.mockResolvedValueOnce({ exists: false });
      getInfoAsync.mockResolvedValueOnce({ exists: false });
      getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: EXPECTED_BASE_BYTES,
        uri: EXPECTED_BASE_URI,
      });

      const downloader = new WhisperModelDownloader();
      const p1 = downloader.ensureBaseModelDownloaded();
      const p2 = downloader.ensureBaseModelDownloaded();
      const p3 = downloader.ensureBaseModelDownloaded();

      // Let microtasks settle so the download promise is in-flight before
      // we resolve it — otherwise the deferred resolves before the mock
      // has even been called and the test reports a flaky failure.
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
      }
      resolveDownload({ uri: EXPECTED_BASE_URI });
      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

      expect(r1).not.toBeNull();
      expect(r2).toBe(r1);
      expect(r3).toBe(r1);
      expect(createDownloadResumable).toHaveBeenCalledTimes(1);
    });
  });

  describe('retry and error handling', () => {
    it('retries with exponential backoff up to 3 attempts and succeeds on the third', async () => {
      fileMissing();
      setNetwork({ type: 'wifi', isConnected: true });

      let callCount = 0;
      createDownloadResumable.mockImplementation(() => ({
        downloadAsync: jest.fn().mockImplementation(async () => {
          callCount += 1;
          if (callCount < 3) {
            throw new Error(`transient failure ${callCount}`);
          }
          return { uri: EXPECTED_BASE_URI };
        }),
      }));
      // getInfoAsync called: initial probe + 3 post-download verifications
      // (one per attempt). For attempt 3, succeeds with correct size.
      getInfoAsync.mockResolvedValueOnce({ exists: false }); // initial probe
      // attempts 1 and 2 throw before reaching post-download getInfoAsync
      // attempt 3 succeeds → verification call
      getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: EXPECTED_BASE_BYTES,
      });

      const downloader = new WhisperModelDownloader();
      const result = await downloader.ensureBaseModelDownloaded();

      expect(result).not.toBeNull();
      expect(callCount).toBe(3);
    });

    it('throws WhisperModelDownloadError after all 3 attempts fail', async () => {
      fileMissing();
      setNetwork({ type: 'wifi', isConnected: true });
      createDownloadResumable.mockImplementation(() => ({
        downloadAsync: jest.fn().mockRejectedValue(new Error('network')),
      }));

      const downloader = new WhisperModelDownloader();

      await expect(
        downloader.ensureBaseModelDownloaded(),
      ).rejects.toBeInstanceOf(WhisperModelDownloadError);
      // Ensure exactly 3 attempts before giving up
      expect(createDownloadResumable).toHaveBeenCalledTimes(3);
    });

    it('deletes the file and retries when downloaded size does not match expected', async () => {
      fileMissing();
      setNetwork({ type: 'wifi', isConnected: true });
      stubResumableDownload();
      // Initial probe + 3 size-verify calls (all wrong size, triggers retry).
      getInfoAsync.mockResolvedValueOnce({ exists: false });
      getInfoAsync.mockResolvedValue({
        exists: true,
        size: EXPECTED_BASE_BYTES - 100,
      });

      const downloader = new WhisperModelDownloader();

      await expect(
        downloader.ensureBaseModelDownloaded(),
      ).rejects.toBeInstanceOf(WhisperModelDownloadError);
      // Each failed verification triggers a delete + retry.
      expect(deleteAsync).toHaveBeenCalled();
    });
  });

  describe('progress observability', () => {
    it('forwards progress updates to subscribers', async () => {
      fileMissing();
      setNetwork({ type: 'wifi', isConnected: true });
      stubResumableDownload({
        emitProgress: [
          { written: 10_000_000, total: EXPECTED_BASE_BYTES },
          { written: 30_000_000, total: EXPECTED_BASE_BYTES },
          { written: EXPECTED_BASE_BYTES, total: EXPECTED_BASE_BYTES },
        ],
      });
      getInfoAsync.mockResolvedValueOnce({ exists: false });
      getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: EXPECTED_BASE_BYTES,
      });

      const downloader = new WhisperModelDownloader();
      const received: ModelDownloadProgress[] = [];
      const unsubscribe = downloader.onProgress(p => received.push(p));

      await downloader.ensureBaseModelDownloaded();
      unsubscribe();

      expect(received).toHaveLength(3);
      expect(received[0].percent).toBeCloseTo(
        (10_000_000 / EXPECTED_BASE_BYTES) * 100,
        1,
      );
      expect(received[2].percent).toBeCloseTo(100, 1);
      expect(downloader.getProgress()).toEqual(received[2]);
    });

    it('unsubscribe stops further progress callbacks', async () => {
      fileMissing();
      setNetwork({ type: 'wifi', isConnected: true });
      stubResumableDownload({
        emitProgress: [
          { written: 1_000_000, total: EXPECTED_BASE_BYTES },
          { written: 2_000_000, total: EXPECTED_BASE_BYTES },
        ],
      });
      getInfoAsync.mockResolvedValueOnce({ exists: false });
      getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: EXPECTED_BASE_BYTES,
      });

      const downloader = new WhisperModelDownloader();
      const received: ModelDownloadProgress[] = [];
      const unsubscribe = downloader.onProgress(p => {
        received.push(p);
        if (received.length === 1) unsubscribe();
      });

      await downloader.ensureBaseModelDownloaded();

      expect(received).toHaveLength(1);
    });
  });

  it('getBaseModelUri returns the documents-directory path', () => {
    const downloader = new WhisperModelDownloader();
    expect(downloader.getBaseModelUri()).toBe(EXPECTED_BASE_URI);
  });
});
