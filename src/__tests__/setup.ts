// Global test setup
import 'react-native-gesture-handler/jestSetup';

// `expo-modules-core` reads `globalThis.expo.{EventEmitter,NativeModule,SharedRef,SharedObject}`
// at module-init time. On native these are installed by the expo-modules JSI bridge;
// in jest they don't exist, so any import chain that touches expo-modules-core
// (expo-secure-store, expo-haptics, expo-clipboard, etc.) explodes with
// `TypeError: Cannot read properties of undefined (reading 'EventEmitter')`.
// Stub the global with no-op classes so module-init succeeds — actual native
// behaviour is mocked separately at the per-package level when tests need it.
class StubExpoEventEmitter {
  addListener() {
    return { remove: () => {} };
  }
  removeListener() {}
  removeAllListeners() {}
  removeSubscription() {}
  emit() {}
  listenerCount() {
    return 0;
  }
}
class StubExpoNativeModule {}
class StubExpoSharedRef {}
class StubExpoSharedObject {}
(globalThis as any).expo = (globalThis as any).expo || {
  EventEmitter: StubExpoEventEmitter,
  NativeModule: StubExpoNativeModule,
  SharedRef: StubExpoSharedRef,
  SharedObject: StubExpoSharedObject,
  modules: {},
};

// Mock react-native modules
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: {
      OS: 'ios',
      Version: '15.0',
      select: jest.fn(obj => obj.ios || obj.default),
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 375, height: 812 })),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    Alert: {
      alert: jest.fn(),
    },
    AppState: {
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      removeEventListener: jest.fn(),
      currentState: 'active',
    },
    Keyboard: {
      addListener: jest.fn(() => ({ remove: jest.fn() })),
      removeListener: jest.fn(),
      dismiss: jest.fn(),
    },
    NativeModules: {
      ...RN.NativeModules,
      DevSettings: {
        addMenuItem: jest.fn(),
        reload: jest.fn(),
      },
    },
    // @react-navigation/elements probes UIManager.getViewManagerConfig at module-init
    // to decide whether to render the native MaskedView. Under jest the property is
    // undefined and reading it throws; return null so the elements module falls back
    // to the JS implementation cleanly.
    UIManager: {
      ...(RN.UIManager || {}),
      getViewManagerConfig: jest.fn(() => null),
      hasViewManagerConfig: jest.fn(() => false),
      getConstants: jest.fn(() => ({})),
    },
  };
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock react-native-device-info
jest.mock(
  'react-native-device-info',
  () => require('./mocks/deviceInfoMock').mockDeviceInfo,
);

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/MaterialIcons', () => 'MaterialIcons');
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');

// Mock react-navigation
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      dispatch: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
    }),
    useFocusEffect: jest.fn(),
  };
});

// Mock react-native-voice (legacy — VoiceInput no longer uses it directly
// as of 2026-04-14 Whisper migration, but older tests and imports may still
// pull it in transitively).
jest.mock('@react-native-voice/voice', () => ({
  default: {
    start: jest.fn(),
    stop: jest.fn(),
    destroy: jest.fn(),
    removeAllListeners: jest.fn(),
    onSpeechStart: jest.fn(),
    onSpeechEnd: jest.fn(),
    onSpeechResults: jest.fn(),
    onSpeechError: jest.fn(),
  },
}));

// Mock expo-av (Whisper recording backend). The tests need recording to be
// a no-op — they shouldn't actually try to access the simulator mic.
jest.mock('expo-av', () => ({
  Audio: {
    Recording: jest.fn().mockImplementation(() => ({
      prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
      startAsync: jest.fn().mockResolvedValue(undefined),
      stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
      getURI: jest.fn().mockReturnValue('file:///mock/recording.m4a'),
      setOnRecordingStatusUpdate: jest.fn(),
      setProgressUpdateInterval: jest.fn(),
    })),
    RecordingOptionsPresets: {
      HIGH_QUALITY: {},
    },
    getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock expo-file-system/legacy (used by whisperTranscriptionService to
// base64-encode the recorded audio file before upload).
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn().mockResolvedValue('bW9jay1iYXNlNjQ='),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: {
    Base64: 'base64',
    UTF8: 'utf8',
  },
}));

// Mock expo-secure-store (used by sensitiveStorage; native bridge unavailable
// under jest, so module-init crashes with `Cannot find native module 'ExpoSecureStore'`).
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
  ALWAYS: 'ALWAYS',
  ALWAYS_THIS_DEVICE_ONLY: 'ALWAYS_THIS_DEVICE_ONLY',
}));

// Mock expo-haptics (UI feedback API; native bridge unavailable under jest)
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Mock react-native-permissions (used by saveToPhotos utility)
jest.mock('react-native-permissions', () => ({
  check: jest.fn().mockResolvedValue('granted'),
  request: jest.fn().mockResolvedValue('granted'),
  PERMISSIONS: {
    IOS: {
      PHOTO_LIBRARY_ADD_ONLY: 'ios.permission.PHOTO_LIBRARY_ADD_ONLY',
      MICROPHONE: 'ios.permission.MICROPHONE',
      SPEECH_RECOGNITION: 'ios.permission.SPEECH_RECOGNITION',
    },
    ANDROID: {
      RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
      WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE',
    },
  },
  RESULTS: {
    UNAVAILABLE: 'unavailable',
    DENIED: 'denied',
    GRANTED: 'granted',
    BLOCKED: 'blocked',
    LIMITED: 'limited',
  },
}));

// Mock @react-native-camera-roll/camera-roll (used by saveToPhotos utility)
jest.mock('@react-native-camera-roll/camera-roll', () => ({
  CameraRoll: {
    saveAsset: jest.fn().mockResolvedValue({ uri: 'ph://mock-asset' }),
  },
}));

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set up global test variables
(global as any).__DEV__ = true;

// Global error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
