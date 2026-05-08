/* eslint-env jest */
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

// Mock SafeAreaContext
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  SafeAreaProvider: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// Mock react-native-share
jest.mock('react-native-share', () => ({
  default: {
    open: jest.fn(() => Promise.resolve()),
  },
}));

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

// Mock Clerk
jest.mock('@clerk/clerk-expo', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: jest.fn(() => ({
    isSignedIn: false,
    userId: null,
    sessionId: null,
    signIn: jest.fn(),
    signOut: jest.fn(),
    getToken: jest.fn(() => Promise.resolve(null)),
  })),
  useUser: jest.fn(() => ({
    user: null,
    isLoaded: true,
  })),
  useSSO: jest.fn(() => ({
    startSSOFlow: jest.fn(() =>
      Promise.resolve({ createdSessionId: null, signIn: null, signUp: null }),
    ),
  })),
  useSignIn: jest.fn(() => ({
    signIn: { create: jest.fn() },
    setActive: jest.fn(),
    isLoaded: true,
  })),
  useSignUp: jest.fn(() => ({
    signUp: { create: jest.fn() },
    setActive: jest.fn(),
    isLoaded: true,
  })),
}));

// Mock expo-web-browser
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(() => Promise.resolve({ type: 'cancel' })),
  dismissBrowser: jest.fn(),
}));

// Mock expo-linking
jest.mock('expo-linking', () => ({
  openURL: jest.fn(() => Promise.resolve(true)),
  parse: jest.fn((url: string) => ({
    scheme: url.split('://')[0],
    path: url.split('://')[1]?.split('?')[0],
    queryParams: {},
  })),
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
}));

// Mock Supabase. The PostgREST query builder is chainable with many methods
// (.eq, .neq, .not, .order, .limit, .range, .single, .maybeSingle, etc.) and
// each returns the builder; only terminal methods resolve. To avoid brittle
// per-method nesting, the builder is a Proxy that responds to *any* method
// access by returning itself (chainable) and is `then`-able so `await
// supabase.from(...).select().eq(...)` resolves to { data: null, error: null }.
jest.mock('@supabase/supabase-js', () => {
  const makeChain = () => {
    const target = function () {};
    target.then = resolve => resolve({ data: null, error: null });
    target.catch = () => target;
    target.finally = () => target;
    return new Proxy(target, {
      get(t, prop) {
        if (prop === 'then' || prop === 'catch' || prop === 'finally') {
          return t[prop];
        }
        // any other prop returns a callable that returns the chain
        return jest.fn(() => makeChain());
      },
      apply() {
        return makeChain();
      },
    });
  };
  return {
    createClient: jest.fn(() => ({
      auth: {
        getUser: jest.fn(() =>
          Promise.resolve({ data: { user: null }, error: null }),
        ),
        signInWithPassword: jest.fn(() =>
          Promise.resolve({ data: { user: null }, error: null }),
        ),
        signOut: jest.fn(() => Promise.resolve({ error: null })),
      },
      from: jest.fn(() => makeChain()),
      rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
      storage: {
        from: jest.fn(() => ({
          upload: jest.fn(() =>
            Promise.resolve({ data: { path: 'mock/path' }, error: null }),
          ),
          update: jest.fn(() =>
            Promise.resolve({ data: { path: 'mock/path' }, error: null }),
          ),
          download: jest.fn(() => Promise.resolve({ data: null, error: null })),
          remove: jest.fn(() => Promise.resolve({ data: null, error: null })),
          list: jest.fn(() => Promise.resolve({ data: [], error: null })),
          getPublicUrl: jest.fn(() => ({
            data: { publicUrl: 'https://mock/file.png' },
          })),
          createSignedUrl: jest.fn(() =>
            Promise.resolve({
              data: { signedUrl: 'https://mock/signed.png' },
              error: null,
            }),
          ),
          createSignedUrls: jest.fn(() =>
            Promise.resolve({ data: [], error: null }),
          ),
          move: jest.fn(() => Promise.resolve({ data: null, error: null })),
          copy: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        listBuckets: jest.fn(() => Promise.resolve({ data: [], error: null })),
      },
    })),
  };
});

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

// US-009: Global mocks for external service SDKs. These prevent the real
// SDK constructors from running env / network probes on import, and give
// tests a deterministic stub when they touch these clients indirectly.
// Per-test jest.mock(...) calls in individual files still override these.

// Mock OpenAI SDK (used by storyAgent, embeddingGenerationService, etc.)
jest.mock('openai', () => {
  const chatResponse = {
    choices: [
      {
        message: {
          role: 'assistant',
          content: '{"ok": true}',
        },
        finish_reason: 'stop',
        index: 0,
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
  const embeddingResponse = {
    data: [{ embedding: new Array(1536).fill(0), index: 0 }],
    usage: { prompt_tokens: 1, total_tokens: 1 },
  };
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: {
      completions: { create: jest.fn().mockResolvedValue(chatResponse) },
    },
    embeddings: { create: jest.fn().mockResolvedValue(embeddingResponse) },
    images: {
      generate: jest
        .fn()
        .mockResolvedValue({ data: [{ url: 'https://mock/image.png' }] }),
    },
  }));
  return { __esModule: true, default: MockOpenAI, OpenAI: MockOpenAI };
});

// Mock Replicate SDK (used by imageGeneration service)
jest.mock('replicate', () => {
  const mockPrediction = {
    id: 'mock-pred-id',
    status: 'succeeded',
    output: ['https://mock/image.png'],
    error: null,
    created_at: '2026-01-01T00:00:00Z',
    completed_at: '2026-01-01T00:00:01Z',
  };
  const MockReplicate = jest.fn().mockImplementation(() => ({
    run: jest.fn().mockResolvedValue(['https://mock/image.png']),
    predictions: {
      create: jest.fn().mockResolvedValue(mockPrediction),
      get: jest.fn().mockResolvedValue(mockPrediction),
      cancel: jest.fn().mockResolvedValue(mockPrediction),
    },
  }));
  return { __esModule: true, default: MockReplicate };
});

// Mock convex/react hooks. Without this, any component test that renders a
// component using useQuery/useMutation throws because there's no
// ConvexProvider in the test tree. Tests that need different behavior can
// override per-file with jest.mock('convex/react', ...).
jest.mock('convex/react', () => ({
  useQuery: jest.fn(() => undefined),
  useMutation: jest.fn(() => jest.fn().mockResolvedValue(null)),
  useAction: jest.fn(() => jest.fn().mockResolvedValue(null)),
  useConvex: jest.fn(() => ({
    query: jest.fn().mockResolvedValue(null),
    mutation: jest.fn().mockResolvedValue(null),
    action: jest.fn().mockResolvedValue(null),
  })),
  useConvexAuth: jest.fn(() => ({ isLoading: false, isAuthenticated: false })),
  ConvexProvider: ({ children }) => children,
  ConvexReactClient: jest.fn().mockImplementation(() => ({
    setAuth: jest.fn(),
    clearAuth: jest.fn(),
    close: jest.fn(),
    mutation: jest.fn().mockResolvedValue(null),
    query: jest.fn().mockResolvedValue(null),
    action: jest.fn().mockResolvedValue(null),
  })),
  Authenticated: ({ children }) => children,
  Unauthenticated: ({ children }) => children,
  AuthLoading: ({ children }) => children,
}));

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
    Version: '15.0',
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
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    removeEventListener: jest.fn(),
    currentState: 'active',
  },
  // @react-navigation/elements probes UIManager.getViewManagerConfig at module-init
  // to decide whether to use native MaskedView. Return null so it falls back to JS.
  UIManager: {
    getViewManagerConfig: jest.fn(() => null),
    hasViewManagerConfig: jest.fn(() => false),
    getConstants: jest.fn(() => ({})),
  },
  NativeModules: {
    DevSettings: { addMenuItem: jest.fn(), reload: jest.fn() },
  },
  Keyboard: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeListener: jest.fn(),
    dismiss: jest.fn(),
  },
  AccessibilityInfo: {
    isScreenReaderEnabled: jest.fn(() => Promise.resolve(false)),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    removeEventListener: jest.fn(),
  },
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  Pressable: 'Pressable',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  Switch: 'Switch',
  ActivityIndicator: 'ActivityIndicator',
  Button: 'Button',
  SafeAreaView: 'SafeAreaView',
  Image: 'Image',
  ImageBackground: 'ImageBackground',
  Modal: 'Modal',
  FlatList: 'FlatList',
  SectionList: 'SectionList',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  RefreshControl: 'RefreshControl',
  StatusBar: 'StatusBar',
  Linking: {
    openURL: jest.fn(() => Promise.resolve(true)),
    canOpenURL: jest.fn(() => Promise.resolve(true)),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
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
    loop: jest.fn(() => ({
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
