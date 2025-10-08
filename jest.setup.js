// Mock AsyncStorage
jest.mock('react-native-async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => {
  return {
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      dispatch: jest.fn(),
      setOptions: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
    }),
    useFocusEffect: jest.fn(),
  };
});

// Mock Vector Icons
jest.mock('react-native-vector-icons/MaterialIcons', () => {
  const { Text } = require('react-native');
  return function MockIcon(props) {
    return Text(props.name);
  };
});

// Mock Voice Recognition
jest.mock('@react-native-voice/voice', () => ({
  onSpeechStart: jest.fn(),
  onSpeechEnd: jest.fn(),
  onSpeechResults: jest.fn(),
  onSpeechError: jest.fn(),
  onSpeechPartialResults: jest.fn(),
  start: jest.fn(() => Promise.resolve()),
  stop: jest.fn(() => Promise.resolve()),
  destroy: jest.fn(() => Promise.resolve()),
  removeAllListeners: jest.fn(),
}));

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(() =>
        Promise.resolve({
          data: { user: null },
          error: null,
        }),
      ),
      signInWithPassword: jest.fn(() =>
        Promise.resolve({
          data: { user: null },
          error: null,
        }),
      ),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() =>
            Promise.resolve({
              data: null,
              error: null,
            }),
          ),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() =>
            Promise.resolve({
              data: null,
              error: null,
            }),
          ),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: null,
                error: null,
              }),
            ),
          })),
        })),
      })),
    })),
  })),
}));

// Mock fetch for API calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        success: true,
        data: {},
      }),
  }),
);

// Mock React Native modules individually
jest.mock('react-native', () => ({
  StyleSheet: {
    create: jest.fn(styles => styles),
    absoluteFill: {},
    absoluteFillObject: {},
    flatten: jest.fn(style => style),
    compose: jest.fn((style1, style2) => [style1, style2]),
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 667 })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  Alert: {
    alert: jest.fn(),
  },
  Platform: {
    OS: 'ios',
    select: jest.fn(config => config.ios || config.default),
  },
  PermissionsAndroid: {
    check: jest.fn(() => Promise.resolve(true)),
    request: jest.fn(() => Promise.resolve('granted')),
    PERMISSIONS: {
      RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      NEVER_ASK_AGAIN: 'never_ask_again',
    },
  },
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
  Button: 'Button',
  SafeAreaView: 'SafeAreaView',
  Animated: {
    Value: jest.fn().mockImplementation(() => ({
      setValue: jest.fn(),
      stopAnimation: jest.fn(),
      interpolate: jest.fn(() => ({
        interpolate: jest.fn(),
      })),
    })),
    View: 'Animated.View',
    Text: 'Animated.Text',
    ScrollView: 'Animated.ScrollView',
    loop: jest.fn(_animation => ({
      start: jest.fn(),
    })),
    timing: jest.fn(() => ({
      start: jest.fn(),
    })),
    sequence: jest.fn(() => ({
      start: jest.fn(),
    })),
    createAnimatedComponent: jest.fn(Component => Component),
    decay: jest.fn(() => ({ start: jest.fn() })),
    spring: jest.fn(() => ({ start: jest.fn() })),
    add: jest.fn(),
    divide: jest.fn(),
    multiply: jest.fn(),
    modulo: jest.fn(),
    diffClamp: jest.fn(),
    event: jest.fn(),
    parallel: jest.fn(() => ({ start: jest.fn() })),
    stagger: jest.fn(() => ({ start: jest.fn() })),
    delay: jest.fn(() => ({ start: jest.fn() })),
  },
  Easing: {
    linear: jest.fn(),
    bezier: jest.fn(),
    ease: jest.fn(),
    quad: jest.fn(),
    cubic: jest.fn(),
    in: jest.fn(),
    out: jest.fn(),
    inOut: jest.fn(),
    bounce: jest.fn(),
    back: jest.fn(),
    elastic: jest.fn(),
    sin: jest.fn(),
    circle: jest.fn(),
    exp: jest.fn(),
    poly: jest.fn(),
  },
}));

// Silence console warnings in tests
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning: React.createElement: type is invalid')
  ) {
    return;
  }
  originalConsoleWarn(...args);
};

// Global test setup
beforeEach(() => {
  jest.clearAllMocks();
});

// Add custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});
