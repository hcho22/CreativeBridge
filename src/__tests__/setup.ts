// Global test setup
import 'react-native-gesture-handler/jestSetup';

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

// Mock react-native-voice
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
