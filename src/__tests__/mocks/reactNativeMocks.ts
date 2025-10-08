// React Native mocks for testing
import { jest } from '@jest/globals';

// Mock AsyncStorage
export const mockAsyncStorage = {
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiGet: jest.fn().mockResolvedValue([]),
  multiSet: jest.fn().mockResolvedValue(undefined),
  multiRemove: jest.fn().mockResolvedValue(undefined),
};

// Mock Platform
export const mockPlatform = {
  OS: 'ios' as const,
  Version: '15.0',
  select: jest.fn().mockImplementation(obj => obj.ios || obj.default),
  isPad: false,
  isTVOS: false,
  isTV: false,
  constants: {
    forceTouchAvailable: false,
    interfaceIdiom: 'phone',
    isTesting: true,
    osVersion: '15.0',
    reactNativeVersion: { major: 0, minor: 70, patch: 0 },
    systemName: 'iOS',
  },
};

// Mock Dimensions
export const mockDimensions = {
  get: jest.fn().mockReturnValue({
    width: 375,
    height: 812,
    scale: 3,
    fontScale: 1,
  }),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  set: jest.fn(),
};

// Mock Alert
export const mockAlert = {
  alert: jest.fn(),
  prompt: jest.fn(),
};

// Mock Linking
export const mockLinking = {
  openURL: jest.fn().mockResolvedValue(true),
  canOpenURL: jest.fn().mockResolvedValue(true),
  getInitialURL: jest.fn().mockResolvedValue(null),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

// Mock Keyboard
export const mockKeyboard = {
  addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  dismiss: jest.fn(),
  scheduleLayoutAnimation: jest.fn(),
};

// Mock DevSettings
export const mockDevSettings = {
  addMenuItem: jest.fn(),
  reload: jest.fn(),
};

// Mock NativeModules
export const mockNativeModules = {
  DevSettings: mockDevSettings,
  StatusBarManager: {
    HEIGHT: 20,
    getHeight: jest.fn().mockReturnValue(20),
  },
  PlatformConstants: {
    forceTouchAvailable: false,
    interfaceIdiom: 'phone',
    isTesting: true,
    osVersion: '15.0',
    reactNativeVersion: { major: 0, minor: 70, patch: 0 },
    systemName: 'iOS',
  },
};

// Mock AppState
export const mockAppState = {
  currentState: 'active',
  addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  removeEventListener: jest.fn(),
  isAvailable: true,
};

// Mock NetInfo
export const mockNetInfo = {
  fetch: jest.fn().mockResolvedValue({
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
    details: {
      isConnectionExpensive: false,
      ssid: 'TestWiFi',
      bssid: '00:00:00:00:00:00',
      strength: 99,
      ipAddress: '192.168.1.100',
      subnet: '255.255.255.0',
      frequency: 2437,
    },
  }),
  addEventListener: jest.fn().mockReturnValue(() => {}),
  useNetInfo: jest.fn().mockReturnValue({
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
  }),
};

// Mock react-native-vector-icons
export const mockVectorIcons = {
  createIconSet: jest.fn().mockReturnValue(jest.fn()),
  createIconSetFromFontello: jest.fn().mockReturnValue(jest.fn()),
  createIconSetFromIcoMoon: jest.fn().mockReturnValue(jest.fn()),
};

// Mock Animated API
export const mockAnimated = {
  View: 'View',
  Text: 'Text',
  ScrollView: 'ScrollView',
  Image: 'Image',
  Value: jest.fn().mockImplementation(value => ({
    setValue: jest.fn(),
    setOffset: jest.fn(),
    flattenOffset: jest.fn(),
    extractOffset: jest.fn(),
    addListener: jest.fn().mockReturnValue('listener-id'),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    stopAnimation: jest.fn(),
    resetAnimation: jest.fn(),
    interpolate: jest.fn().mockReturnValue({ interpolate: jest.fn() }),
    animate: jest.fn(),
    stopTracking: jest.fn(),
    track: jest.fn(),
    _value: value,
  })),
  timing: jest.fn().mockReturnValue({
    start: jest
      .fn()
      .mockImplementation(callback => callback?.({ finished: true })),
    stop: jest.fn(),
    reset: jest.fn(),
  }),
  spring: jest.fn().mockReturnValue({
    start: jest
      .fn()
      .mockImplementation(callback => callback?.({ finished: true })),
    stop: jest.fn(),
    reset: jest.fn(),
  }),
  decay: jest.fn().mockReturnValue({
    start: jest
      .fn()
      .mockImplementation(callback => callback?.({ finished: true })),
    stop: jest.fn(),
    reset: jest.fn(),
  }),
  sequence: jest.fn().mockReturnValue({
    start: jest
      .fn()
      .mockImplementation(callback => callback?.({ finished: true })),
    stop: jest.fn(),
    reset: jest.fn(),
  }),
  parallel: jest.fn().mockReturnValue({
    start: jest
      .fn()
      .mockImplementation(callback => callback?.({ finished: true })),
    stop: jest.fn(),
    reset: jest.fn(),
  }),
  stagger: jest.fn().mockReturnValue({
    start: jest
      .fn()
      .mockImplementation(callback => callback?.({ finished: true })),
    stop: jest.fn(),
    reset: jest.fn(),
  }),
  loop: jest.fn().mockReturnValue({
    start: jest
      .fn()
      .mockImplementation(callback => callback?.({ finished: true })),
    stop: jest.fn(),
    reset: jest.fn(),
  }),
};

// Export all mocks
export const reactNativeMocks = {
  AsyncStorage: mockAsyncStorage,
  Platform: mockPlatform,
  Dimensions: mockDimensions,
  Alert: mockAlert,
  Linking: mockLinking,
  Keyboard: mockKeyboard,
  DevSettings: mockDevSettings,
  NativeModules: mockNativeModules,
  AppState: mockAppState,
  NetInfo: mockNetInfo,
  VectorIcons: mockVectorIcons,
  Animated: mockAnimated,
};

// Export individual mocks for specific imports
export default mockAsyncStorage;
export { mockNetInfo };
