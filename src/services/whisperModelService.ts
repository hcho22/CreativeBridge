/**
 * Whisper Model Service (US-002, extended in US-003)
 *
 * Owns the lifecycle of the on-device Whisper transcription context. At load
 * time, picks the best available model variant:
 *
 *   1. **base.en-q5_1** (~60 MB) if it's been downloaded into the app's
 *      documents directory by `whisperModelDownloader` (US-003) — higher
 *      quality, preferred when present.
 *   2. **tiny.en-q5_1** (~32 MB) bundled with the iOS app — always
 *      available, used on first launch and whenever base hasn't been
 *      downloaded (cellular-only users, offline-installs, etc).
 *
 * The bundled model is `require()`'d so Metro registers it as an asset;
 * `expo-asset` resolves the asset to a real `file://` URI at runtime that
 * `whisper.rn`'s `initWhisper` can read. The downloaded base model lives at
 * a known path in the documents directory and is loaded by direct file URI.
 *
 * Lifecycle:
 *   - Model is NOT loaded at import time (a ~32 MB read + native init on the
 *     app's startup path would be wasted work for users who never dictate).
 *   - First call to `getContext()` triggers load; subsequent calls return the
 *     cached context.
 *   - Concurrent first-callers share a single in-flight load Promise so we
 *     never double-init the native context.
 *   - `release()` tears down the native resources; the next `getContext()`
 *     re-loads on demand — which is also how a freshly downloaded base
 *     model gets picked up (release the cached tiny context after the
 *     download completes; the next dictation loads base).
 *
 * Notes on rationale:
 *   - We pick `tiny.en-q5_1` (32 MB) over full-precision `tiny.en` (78 MB) to
 *     satisfy the PRD bundle budget. Quality delta is <1% WER for typical
 *     K-2 indoor utterances per whisper.cpp benchmarks.
 *   - Lazy load also means the first dictation pays a small latency tax
 *     (~hundreds of ms on iPhone 12+); subsequent dictations are warm.
 *     US-005's latency budget assumes the warm path; we surface the load
 *     latency separately via `getLoadLatencyMs()` for telemetry attribution.
 *   - `getActiveModelName()` exposes which variant is loaded so telemetry
 *     and US-005 can record `{ model: 'tiny' | 'base' }` without reaching
 *     into private state.
 */

import { Asset } from 'expo-asset';
import { initWhisper, type WhisperContext } from 'whisper.rn';
import { whisperModelDownloader } from './whisperModelDownloader';

const MODEL_ASSET_MODULE = require('../../assets/models/ggml-tiny.en-q5_1.bin');

export type WhisperModelName = 'tiny' | 'base';

export class WhisperModelLoadError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'WhisperModelLoadError';
  }
}

export class WhisperModelService {
  private context: WhisperContext | null = null;
  private loadingPromise: Promise<WhisperContext> | null = null;
  private lastLoadLatencyMs: number | null = null;
  private activeModelName: WhisperModelName | null = null;

  public async getContext(): Promise<WhisperContext> {
    if (this.context) {
      return this.context;
    }
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this.loadModel().finally(() => {
      this.loadingPromise = null;
    });

    try {
      this.context = await this.loadingPromise;
      return this.context;
    } catch (err) {
      this.context = null;
      throw err;
    }
  }

  public async release(): Promise<void> {
    if (!this.context) {
      return;
    }
    const ctx = this.context;
    this.context = null;
    this.activeModelName = null;
    await ctx.release();
  }

  public getLoadLatencyMs(): number | null {
    return this.lastLoadLatencyMs;
  }

  public getActiveModelName(): WhisperModelName | null {
    return this.activeModelName;
  }

  public isLoaded(): boolean {
    return this.context !== null;
  }

  private async loadModel(): Promise<WhisperContext> {
    const startedAt = Date.now();
    const { uri, modelName } = await this.resolveBestAvailableModelUri();

    try {
      const context = await initWhisper({ filePath: uri });
      this.lastLoadLatencyMs = Date.now() - startedAt;
      this.activeModelName = modelName;
      return context;
    } catch (err) {
      throw new WhisperModelLoadError(
        `whisper.rn initWhisper failed for filePath=${uri} (model=${modelName})`,
        err,
      );
    }
  }

  private async resolveBestAvailableModelUri(): Promise<{
    uri: string;
    modelName: WhisperModelName;
  }> {
    // Prefer downloaded base model when present.
    try {
      if (await whisperModelDownloader.isBaseModelDownloaded()) {
        return {
          uri: whisperModelDownloader.getBaseModelUri(),
          modelName: 'base',
        };
      }
    } catch {
      // Downloader probe failing is non-fatal — fall through to bundled tiny.
    }

    // Fall back to the bundled tiny model.
    try {
      const asset = Asset.fromModule(MODEL_ASSET_MODULE);
      await asset.downloadAsync();
      if (!asset.localUri) {
        throw new WhisperModelLoadError(
          'expo-asset resolved the bundled Whisper model but localUri was empty',
        );
      }
      return { uri: asset.localUri, modelName: 'tiny' };
    } catch (err) {
      throw new WhisperModelLoadError(
        'Failed to resolve bundled Whisper model asset',
        err,
      );
    }
  }
}

export const whisperModelService = new WhisperModelService();
