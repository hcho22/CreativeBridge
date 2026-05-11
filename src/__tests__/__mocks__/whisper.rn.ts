// Global Jest mock for whisper.rn.
//
// Required because whisper.rn declares an "exports" field in its package.json
// without a "." entry, so Node's CommonJS resolver fails with
// ERR_PACKAGE_PATH_NOT_EXPORTED when test code does `import 'whisper.rn'`.
// Metro/React Native's bundler resolves it fine in app code, but Jest runs
// in plain Node. This mock is wired in via jest.config.js moduleNameMapper.
//
// The library also ships its own internal jest mock at
// `whisper.rn/lib/commonjs/jest-mock.js` which patches NativeModules.RNWhisper,
// but that only helps tests that import whisper.rn through the real package
// — which we can't do in Node. So we provide a top-level JS-side mock here.
//
// Tests can override per-test behavior via the standard mock APIs:
//
//   import { initWhisper } from 'whisper.rn';
//   (initWhisper as jest.Mock).mockResolvedValue({ ... });

const transcribe = jest.fn().mockReturnValue({
  stop: jest.fn(),
  promise: Promise.resolve({
    result: '',
    segments: [],
    isAborted: false,
  }),
});

const release = jest.fn().mockResolvedValue(undefined);

const initWhisper = jest.fn().mockResolvedValue({
  id: 1,
  transcribe,
  release,
});

const initWhisperVad = jest.fn().mockResolvedValue({
  id: 2,
  release,
});

class WhisperContext {
  id = 1;
  transcribe = transcribe;
  release = release;
}

class WhisperVadContext {
  id = 2;
  release = release;
}

const releaseAllWhisper = jest.fn().mockResolvedValue(undefined);
const releaseAllWhisperVad = jest.fn().mockResolvedValue(undefined);
const toggleNativeLog = jest.fn().mockResolvedValue(undefined);
const addNativeLogListener = jest.fn().mockReturnValue({ remove: jest.fn() });

const AudioSessionIos = {
  Category: {},
  CategoryOption: {},
  Mode: {},
};

module.exports = {
  __esModule: true,
  initWhisper,
  initWhisperVad,
  releaseAllWhisper,
  releaseAllWhisperVad,
  toggleNativeLog,
  addNativeLogListener,
  WhisperContext,
  WhisperVadContext,
  AudioSessionIos,
  libVersion: 'mocked',
  isUseCoreML: false,
  isCoreMLAllowFallback: false,
};
