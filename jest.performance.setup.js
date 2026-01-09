/**
 * Jest Setup for Performance Tests
 *
 * Sets up mocks and utilities for performance testing
 */

// Mock React Native modules
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: {
      OS: 'ios',
      select: jest.fn(obj => obj.ios),
    },
    Alert: {
      alert: jest.fn(),
    },
  };
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Add performance.now() for Node environment
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
  };
}

// Console formatting for performance results
const originalLog = console.log;
console.log = (...args) => {
  const msg = args.join(' ');
  if (msg.startsWith('✓')) {
    // Performance results in green
    originalLog('\x1b[32m%s\x1b[0m', ...args);
  } else {
    originalLog(...args);
  }
};

// Global test utilities
global.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Cleanup after all tests
afterAll(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});
