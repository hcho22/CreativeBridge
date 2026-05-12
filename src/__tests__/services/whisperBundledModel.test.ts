// US-002 + US-003 validation: WhisperModelService loads the best
// available Whisper model — preferring a downloaded base.en-q5_1 from the
// documents directory (US-003) when present, falling back to the bundled
// tiny.en-q5_1 (US-002). The real load is a native iOS path
// (Asset.fromModule → file:// in app bundle → whisper.rn initWhisper);
// in Jest we mock the asset, downloader, and whisper.rn layers so the
// service's *lifecycle and model-selection logic* is validated without
// needing an iOS runtime.
//
// Per the PRD, the release-build smoke test ("transcribes the fixture to
// a string containing 'hello'") is a separate manual step on a real device
// — those assertions cannot run in Jest because the GGML model loader
// needs the native whisper.cpp binary.

jest.mock('expo-asset', () => {
  return {
    Asset: {
      fromModule: jest.fn(),
    },
  };
});

jest.mock('../../services/whisperModelDownloader', () => ({
  whisperModelDownloader: {
    isBaseModelDownloaded: jest.fn(),
    getBaseModelUri: jest.fn(),
  },
}));

import { Asset } from 'expo-asset';
import { initWhisper } from 'whisper.rn';
import {
  WhisperModelLoadError,
  WhisperModelService,
} from '../../services/whisperModelService';
import { whisperModelDownloader } from '../../services/whisperModelDownloader';

type WhisperContextMock = {
  id: number;
  transcribe: jest.Mock;
  release: jest.Mock;
};

const MOCK_MODEL_URI =
  'file:///mock/app/bundle/assets/models/ggml-tiny.en-q5_1.bin';

const makeMockAsset = (localUri: string | null = MOCK_MODEL_URI) => ({
  localUri,
  downloadAsync: jest.fn().mockResolvedValue(undefined),
});

const makeMockContext = (id = 1): WhisperContextMock => ({
  id,
  transcribe: jest.fn(),
  release: jest.fn().mockResolvedValue(undefined),
});

const isBaseModelDownloaded =
  whisperModelDownloader.isBaseModelDownloaded as jest.Mock;
const getBaseModelUri = whisperModelDownloader.getBaseModelUri as jest.Mock;

describe('WhisperModelService — US-002 bundled model lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no downloaded base model. Each US-003 test below overrides
    // this when it wants to exercise the "base available" branch.
    isBaseModelDownloaded.mockResolvedValue(false);
  });

  it('lazy-loads the bundled model on first getContext() call', async () => {
    const asset = makeMockAsset();
    (Asset.fromModule as jest.Mock).mockReturnValue(asset);
    const ctx = makeMockContext();
    (initWhisper as jest.Mock).mockResolvedValue(ctx);

    const service = new WhisperModelService();
    expect(service.isLoaded()).toBe(false);
    expect(initWhisper).not.toHaveBeenCalled();

    const result = await service.getContext();

    expect(asset.downloadAsync).toHaveBeenCalledTimes(1);
    expect(initWhisper).toHaveBeenCalledWith({ filePath: MOCK_MODEL_URI });
    expect(result).toBe(ctx);
    expect(service.isLoaded()).toBe(true);
  });

  it('caches the context across subsequent getContext() calls', async () => {
    (Asset.fromModule as jest.Mock).mockReturnValue(makeMockAsset());
    const ctx = makeMockContext();
    (initWhisper as jest.Mock).mockResolvedValue(ctx);

    const service = new WhisperModelService();
    const first = await service.getContext();
    const second = await service.getContext();
    const third = await service.getContext();

    expect(first).toBe(ctx);
    expect(second).toBe(ctx);
    expect(third).toBe(ctx);
    expect(initWhisper).toHaveBeenCalledTimes(1);
  });

  it('shares a single in-flight load across concurrent first-callers', async () => {
    (Asset.fromModule as jest.Mock).mockReturnValue(makeMockAsset());
    let resolveInit!: (ctx: WhisperContextMock) => void;
    const ctx = makeMockContext();
    (initWhisper as jest.Mock).mockReturnValue(
      new Promise(resolve => {
        resolveInit = resolve;
      }),
    );

    const service = new WhisperModelService();
    const p1 = service.getContext();
    const p2 = service.getContext();
    const p3 = service.getContext();

    resolveInit(ctx);
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(r1).toBe(ctx);
    expect(r2).toBe(ctx);
    expect(r3).toBe(ctx);
    expect(initWhisper).toHaveBeenCalledTimes(1);
  });

  it('records a non-null load latency after a successful load', async () => {
    (Asset.fromModule as jest.Mock).mockReturnValue(makeMockAsset());
    (initWhisper as jest.Mock).mockResolvedValue(makeMockContext());

    const service = new WhisperModelService();
    expect(service.getLoadLatencyMs()).toBeNull();

    await service.getContext();

    const latency = service.getLoadLatencyMs();
    expect(latency).not.toBeNull();
    expect(typeof latency).toBe('number');
    expect(latency!).toBeGreaterThanOrEqual(0);
  });

  it('throws WhisperModelLoadError with cause when initWhisper rejects', async () => {
    (Asset.fromModule as jest.Mock).mockReturnValue(makeMockAsset());
    const nativeErr = new Error('native init failed');
    (initWhisper as jest.Mock).mockRejectedValue(nativeErr);

    const service = new WhisperModelService();

    await expect(service.getContext()).rejects.toBeInstanceOf(
      WhisperModelLoadError,
    );
    expect(service.isLoaded()).toBe(false);
  });

  it('throws WhisperModelLoadError when expo-asset returns no localUri', async () => {
    (Asset.fromModule as jest.Mock).mockReturnValue(makeMockAsset(null));
    (initWhisper as jest.Mock).mockResolvedValue(makeMockContext());

    const service = new WhisperModelService();

    await expect(service.getContext()).rejects.toBeInstanceOf(
      WhisperModelLoadError,
    );
    expect(initWhisper).not.toHaveBeenCalled();
  });

  it('retries the load after a previous failure', async () => {
    (Asset.fromModule as jest.Mock).mockReturnValue(makeMockAsset());
    (initWhisper as jest.Mock)
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce(makeMockContext(2));

    const service = new WhisperModelService();

    await expect(service.getContext()).rejects.toBeInstanceOf(
      WhisperModelLoadError,
    );
    const ctx = await service.getContext();

    expect(ctx.id).toBe(2);
    expect(initWhisper).toHaveBeenCalledTimes(2);
  });

  it('release() tears down the context and forces re-load on next getContext()', async () => {
    (Asset.fromModule as jest.Mock).mockReturnValue(makeMockAsset());
    const ctx1 = makeMockContext(1);
    const ctx2 = makeMockContext(2);
    (initWhisper as jest.Mock)
      .mockResolvedValueOnce(ctx1)
      .mockResolvedValueOnce(ctx2);

    const service = new WhisperModelService();
    await service.getContext();
    await service.release();

    expect(ctx1.release).toHaveBeenCalledTimes(1);
    expect(service.isLoaded()).toBe(false);

    const reloaded = await service.getContext();
    expect(reloaded).toBe(ctx2);
    expect(initWhisper).toHaveBeenCalledTimes(2);
  });

  it('release() is a no-op when no context has been loaded', async () => {
    const service = new WhisperModelService();
    await expect(service.release()).resolves.toBeUndefined();
  });

  describe('US-003: model preference (base over tiny)', () => {
    const BASE_URI = 'file:///mock/documents/ggml-base.en-q5_1.bin';

    it('loads downloaded base model when available, skipping the bundled asset path', async () => {
      isBaseModelDownloaded.mockResolvedValue(true);
      getBaseModelUri.mockReturnValue(BASE_URI);
      const ctx = makeMockContext();
      (initWhisper as jest.Mock).mockResolvedValue(ctx);

      const service = new WhisperModelService();
      const result = await service.getContext();

      expect(initWhisper).toHaveBeenCalledWith({ filePath: BASE_URI });
      expect(Asset.fromModule).not.toHaveBeenCalled();
      expect(service.getActiveModelName()).toBe('base');
      expect(result).toBe(ctx);
    });

    it('falls back to bundled tiny when no base is downloaded', async () => {
      isBaseModelDownloaded.mockResolvedValue(false);
      (Asset.fromModule as jest.Mock).mockReturnValue(makeMockAsset());
      (initWhisper as jest.Mock).mockResolvedValue(makeMockContext());

      const service = new WhisperModelService();
      await service.getContext();

      expect(initWhisper).toHaveBeenCalledWith({ filePath: MOCK_MODEL_URI });
      expect(service.getActiveModelName()).toBe('tiny');
    });

    it('falls back to bundled tiny if the downloader probe throws', async () => {
      isBaseModelDownloaded.mockRejectedValue(new Error('FS probe failed'));
      (Asset.fromModule as jest.Mock).mockReturnValue(makeMockAsset());
      (initWhisper as jest.Mock).mockResolvedValue(makeMockContext());

      const service = new WhisperModelService();
      await service.getContext();

      expect(initWhisper).toHaveBeenCalledWith({ filePath: MOCK_MODEL_URI });
      expect(service.getActiveModelName()).toBe('tiny');
    });

    it('getActiveModelName starts null and resets to null after release()', async () => {
      isBaseModelDownloaded.mockResolvedValue(false);
      (Asset.fromModule as jest.Mock).mockReturnValue(makeMockAsset());
      (initWhisper as jest.Mock).mockResolvedValue(makeMockContext());

      const service = new WhisperModelService();
      expect(service.getActiveModelName()).toBeNull();

      await service.getContext();
      expect(service.getActiveModelName()).toBe('tiny');

      await service.release();
      expect(service.getActiveModelName()).toBeNull();
    });

    it('after release(), next getContext() re-checks downloader and picks base if newly available', async () => {
      // First load: no base, falls back to tiny.
      isBaseModelDownloaded.mockResolvedValueOnce(false);
      (Asset.fromModule as jest.Mock).mockReturnValue(makeMockAsset());
      const tinyCtx = makeMockContext(1);
      const baseCtx = makeMockContext(2);
      (initWhisper as jest.Mock)
        .mockResolvedValueOnce(tinyCtx)
        .mockResolvedValueOnce(baseCtx);

      const service = new WhisperModelService();
      await service.getContext();
      expect(service.getActiveModelName()).toBe('tiny');

      // Simulate the downloader completing in the background, then app
      // releasing the context (e.g., on logout or memory pressure).
      isBaseModelDownloaded.mockResolvedValueOnce(true);
      getBaseModelUri.mockReturnValue(BASE_URI);
      await service.release();

      const reloaded = await service.getContext();
      expect(reloaded).toBe(baseCtx);
      expect(service.getActiveModelName()).toBe('base');
      expect(initWhisper).toHaveBeenLastCalledWith({ filePath: BASE_URI });
    });
  });
});
