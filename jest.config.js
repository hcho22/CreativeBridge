module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/src/__tests__/setupAfterEnv.ts',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-vector-icons|@react-native-voice|@supabase|react-native-device-info|@react-native-async-storage|@react-native-community|react-native-url-polyfill|@clerk|expo|expo-.*|@expo|@expo/.*)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/styles/**',
    '!src/types/**',
    '!src/__tests__/**',
    '!src/**/index.{js,ts}',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  testMatch: [
    '<rootDir>/__tests__/**/*.(test|spec).{ts,tsx}',
    '<rootDir>/src/**/__tests__/**/*.(test|spec).{ts,tsx}',
    '<rootDir>/src/**/*.(test|spec).{ts,tsx}',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native-device-info$':
      '<rootDir>/src/__tests__/__mocks__/react-native-device-info',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/src/__tests__/__mocks__/@react-native-async-storage/async-storage',
    '^react-native-keychain$':
      '<rootDir>/src/__tests__/__mocks__/react-native-keychain',
    '^react-native-fs$': '<rootDir>/src/__tests__/__mocks__/react-native-fs',
    '^react-native-svg$': '<rootDir>/src/__tests__/__mocks__/react-native-svg',
    '^@react-native-community/netinfo$':
      '<rootDir>/src/__tests__/mocks/reactNativeMocks',
    '^react-native-url-polyfill/auto$': 'identity-obj-proxy',
    '^@env$': '<rootDir>/src/__tests__/__mocks__/@env',
    // whisper.rn cannot be resolved by Node in test context because its
    // package.json "exports" field has no "." entry — see the mock file
    // header for the full explanation.
    '^whisper\\.rn$': '<rootDir>/src/__tests__/__mocks__/whisper.rn',
    // Binary asset imports (Whisper GGML model files) are picked up by
    // Metro as numeric asset IDs at runtime; in Jest there is no Metro,
    // so stub them to a number that Asset.fromModule mocks can accept.
    '\\.bin$': '<rootDir>/src/__tests__/__mocks__/binaryAsset.js',
  },
  testTimeout: 10000,
  // Recycle a jest worker once it crosses the threshold so the 37-test
  // StoryPreviewEdit.test.tsx (and any other heavy render-tree suite) can finish
  // without SIGTERM from RSS exhaustion. Only matters when many tests in one file
  // accumulate state beyond what afterEach cleanup releases.
  workerIdleMemoryLimit: '512MB',
  // Global setup for security tests
  globals: {
    __DEV__: true,
  },
};
