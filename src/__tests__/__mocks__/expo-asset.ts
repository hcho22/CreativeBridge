/**
 * Jest mock for `expo-asset` — used by `whisperModelService.ts` to resolve
 * the bundled Whisper GGML binary to a `file://` URI inside the iOS app
 * bundle (US-002). The native ExpoAsset module is unavailable in the Jest
 * runtime, so any test that transitively imports `whisperModelService`
 * (e.g. via `VoiceInput`) would fail to load with
 * "Cannot find native module 'ExpoAsset'" without this stub.
 *
 * The default returns a benign mock asset with a placeholder `localUri`
 * and a no-op `downloadAsync`. Tests that need to assert on or override
 * this behavior can still call `jest.mock('expo-asset', () => ...)`
 * locally — that takes precedence over this module-mapper-resolved file.
 */

export const Asset = {
  fromModule: jest.fn(() => ({
    localUri: 'file:///mock/app/bundle/asset',
    downloadAsync: jest.fn().mockResolvedValue(undefined),
  })),
};
