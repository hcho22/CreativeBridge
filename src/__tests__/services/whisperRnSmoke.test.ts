// US-001 smoke test: verifies whisper.rn is importable in the test
// environment and exposes the JS-side interface the rest of the on-device
// transcription PRD will depend on. This catches the most common integration
// failure mode (mock missing, jest config wrong, library exports drift)
// before more substantive tests in US-005 depend on the same import.
//
// The native module is mocked at src/__tests__/__mocks__/whisper.rn.ts,
// wired in via jest.config.js moduleNameMapper.
//
// Pass condition per PRD US-001 validation test: this file's assertions
// pass in Jest.

import {
  initWhisper,
  initWhisperVad,
  WhisperContext,
  WhisperVadContext,
  releaseAllWhisper,
  AudioSessionIos,
} from 'whisper.rn';

describe('whisper.rn — JS-side smoke test (US-001)', () => {
  it('exports initWhisper as a callable function', () => {
    expect(typeof initWhisper).toBe('function');
  });

  it('exports initWhisperVad as a callable function', () => {
    expect(typeof initWhisperVad).toBe('function');
  });

  it('exports WhisperContext as a class', () => {
    expect(typeof WhisperContext).toBe('function');
  });

  it('exports WhisperVadContext as a class', () => {
    expect(typeof WhisperVadContext).toBe('function');
  });

  it('exports releaseAllWhisper as a callable function', () => {
    expect(typeof releaseAllWhisper).toBe('function');
  });

  it('exports AudioSessionIos as an object with iOS constants', () => {
    expect(typeof AudioSessionIos).toBe('object');
    expect(AudioSessionIos).not.toBeNull();
  });

  it('initWhisper resolves to a context exposing transcribe and release', async () => {
    const ctx = await initWhisper({ filePath: '/mock/model.bin' });
    expect(typeof ctx.transcribe).toBe('function');
    expect(typeof ctx.release).toBe('function');
  });

  it('transcribe returns an object with stop fn and promise (push-to-talk shape)', async () => {
    const ctx = await initWhisper({ filePath: '/mock/model.bin' });
    const result = ctx.transcribe('/mock/audio.wav');
    expect(typeof result.stop).toBe('function');
    expect(result.promise).toBeInstanceOf(Promise);
  });

  it('initWhisperVad resolves to a context exposing release', async () => {
    const vadCtx = await initWhisperVad({ filePath: '/mock/vad-model.bin' });
    expect(typeof vadCtx.release).toBe('function');
  });
});
