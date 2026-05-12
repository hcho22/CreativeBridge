// Minimal whisper.rn type shim — the upstream package ships types at
// `lib/typescript/index.d.ts`, but its `package.json` `exports` field
// declares only a `./*` subpath mapping with no `.` entry, which under
// TypeScript's `moduleResolution: "bundler"` makes the bare module
// specifier `whisper.rn` unresolvable.
//
// This is the TypeScript-side mirror of the same runtime resolution bug
// that `react-native.config.js` works around for the iOS autolinker — see
// https://github.com/mybigday/whisper.rn/issues/301.
//
// Scope: only the symbols actually used by this codebase are declared.
// If we adopt more of the whisper.rn API later (RealtimeTranscriber, VAD
// streaming, etc.), extend this file rather than reaching into subpath
// imports. Drop this file entirely when whisper.rn ships a fixed
// `exports` field (or the `.` entry is added upstream).
declare module 'whisper.rn' {
  export interface TranscribeFileOptions {
    language?: string;
    translate?: boolean;
    maxLen?: number;
    [key: string]: unknown;
  }

  export interface TranscribeSegment {
    text: string;
    t0: number;
    t1: number;
  }

  export interface TranscribeResult {
    result: string;
    segments: TranscribeSegment[];
    isAborted: boolean;
  }

  export interface TranscribeHandle {
    stop: () => void;
    promise: Promise<TranscribeResult>;
  }

  export interface WhisperContext {
    id: number;
    transcribe: (
      audioPath: string,
      options?: TranscribeFileOptions,
    ) => TranscribeHandle;
    release: () => Promise<void>;
  }

  export interface InitWhisperOptions {
    filePath: string;
  }

  export function initWhisper(
    options: InitWhisperOptions,
  ): Promise<WhisperContext>;

  export interface WhisperVadContext {
    id: number;
    release: () => Promise<void>;
  }

  export function initWhisperVad(
    options: InitWhisperOptions,
  ): Promise<WhisperVadContext>;

  export function releaseAllWhisper(): Promise<void>;
  export function releaseAllWhisperVad(): Promise<void>;

  export const AudioSessionIos: {
    Category: Record<string, string>;
    CategoryOption: Record<string, string>;
    Mode: Record<string, string>;
  };

  export const libVersion: string;
  export const isUseCoreML: boolean;
  export const isCoreMLAllowFallback: boolean;
}
