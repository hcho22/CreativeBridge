/**
 * Whisper Model Downloader (US-003)
 *
 * Lazy-downloads the higher-quality Whisper `base.en-q5_1` model (~60 MB)
 * into the iOS documents directory on first launch, but only over Wi-Fi.
 * The bundled `tiny.en-q5_1` (US-002) is always available as a fallback;
 * this service exists to *optionally* upgrade transcription quality when
 * cellular cost isn't a concern.
 *
 * Lifecycle:
 *   - `ensureBaseModelDownloaded()` is the single entry point. It is
 *     idempotent: if the file is already present at the expected size,
 *     it returns `null` immediately. If not on Wi-Fi, it also returns
 *     `null` (no error — "skipped" is a normal outcome).
 *   - Concurrent callers share the in-flight Promise so we never start
 *     two parallel downloads of the same model file.
 *   - Failures retry up to 3 times with 1s/2s/4s exponential backoff;
 *     after exhaustion, a `WhisperModelDownloadError` is thrown.
 *   - Progress is observable via `onProgress(cb)` — useful for a future
 *     US-003a "downloading…" UI but not currently rendered.
 *
 * Verifies the downloaded byte count matches the expected file size (per
 * D-3 in the PRD). A short-write would silently corrupt transcription
 * (GGML format is fragile), so the size guard deletes any partial file
 * and forces a retry instead of trusting a half-written model.
 *
 * Note on file-system API choice: SDK 54 ships both a new `File`-based
 * API and a `legacy` API. The legacy API is used here because its
 * `createDownloadResumable` exposes a progress callback; the new API's
 * `File.downloadFileAsync` does not. When/if the new API gains progress
 * support, this is the only file that needs updating.
 */

import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';

const BASE_MODEL_FILENAME = 'ggml-base.en-q5_1.bin';
const BASE_MODEL_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${BASE_MODEL_FILENAME}`;
const BASE_MODEL_EXPECTED_BYTES = 59721011;
const MAX_DOWNLOAD_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 1000;

export interface ModelDownloadProgress {
  bytesDownloaded: number;
  totalBytes: number;
  percent: number;
}

export interface ModelDownloadResult {
  uri: string;
  bytesDownloaded: number;
  durationMs: number;
}

export type ProgressListener = (progress: ModelDownloadProgress) => void;

export class WhisperModelDownloadError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'WhisperModelDownloadError';
  }
}

export class WhisperModelDownloader {
  private inFlight: Promise<ModelDownloadResult | null> | null = null;
  private lastProgress: ModelDownloadProgress | null = null;
  private subscribers = new Set<ProgressListener>();

  public getBaseModelUri(): string {
    return `${FileSystem.documentDirectory}${BASE_MODEL_FILENAME}`;
  }

  public async isBaseModelDownloaded(): Promise<boolean> {
    const info = await FileSystem.getInfoAsync(this.getBaseModelUri());
    return info.exists && info.size === BASE_MODEL_EXPECTED_BYTES;
  }

  public onProgress(listener: ProgressListener): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  public getProgress(): ModelDownloadProgress | null {
    return this.lastProgress;
  }

  /**
   * Resolves to:
   *   - `null` if the file is already downloaded, OR the device isn't on Wi-Fi
   *   - a `ModelDownloadResult` on successful download
   * Throws `WhisperModelDownloadError` only after exhausting retries.
   */
  public async ensureBaseModelDownloaded(): Promise<ModelDownloadResult | null> {
    if (await this.isBaseModelDownloaded()) {
      return null;
    }
    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = this.runDownloadIfWifi().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async runDownloadIfWifi(): Promise<ModelDownloadResult | null> {
    const netState: NetInfoState = await NetInfo.fetch();
    if (netState.type !== 'wifi' || !netState.isConnected) {
      return null;
    }
    return this.downloadWithRetry();
  }

  private async downloadWithRetry(): Promise<ModelDownloadResult> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt++) {
      try {
        return await this.downloadOnce();
      } catch (err) {
        lastError = err;
        if (attempt < MAX_DOWNLOAD_ATTEMPTS) {
          const delayMs = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    throw new WhisperModelDownloadError(
      `Failed to download base Whisper model after ${MAX_DOWNLOAD_ATTEMPTS} attempts`,
      lastError,
    );
  }

  private async downloadOnce(): Promise<ModelDownloadResult> {
    const startedAt = Date.now();
    const targetUri = this.getBaseModelUri();

    try {
      await FileSystem.deleteAsync(targetUri, { idempotent: true });
    } catch {
      // ignore — file may not exist; we just want a clean slot
    }

    const resumable = FileSystem.createDownloadResumable(
      BASE_MODEL_URL,
      targetUri,
      {},
      data => {
        const totalBytes =
          data.totalBytesExpectedToWrite || BASE_MODEL_EXPECTED_BYTES;
        const progress: ModelDownloadProgress = {
          bytesDownloaded: data.totalBytesWritten,
          totalBytes,
          percent:
            totalBytes > 0 ? (data.totalBytesWritten / totalBytes) * 100 : 0,
        };
        this.lastProgress = progress;
        for (const subscriber of this.subscribers) {
          subscriber(progress);
        }
      },
    );

    const downloadResult = await resumable.downloadAsync();
    if (!downloadResult) {
      throw new Error('Download produced no result');
    }

    const info = await FileSystem.getInfoAsync(targetUri);
    if (!info.exists) {
      throw new Error(
        `Downloaded file missing at ${targetUri}, expected ${BASE_MODEL_EXPECTED_BYTES} bytes`,
      );
    }
    if (info.size !== BASE_MODEL_EXPECTED_BYTES) {
      await FileSystem.deleteAsync(targetUri, { idempotent: true });
      throw new Error(
        `Downloaded size mismatch: got ${info.size}, expected ${BASE_MODEL_EXPECTED_BYTES}`,
      );
    }

    return {
      uri: targetUri,
      bytesDownloaded: info.size,
      durationMs: Date.now() - startedAt,
    };
  }
}

export const whisperModelDownloader = new WhisperModelDownloader();
