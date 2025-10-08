// Setup after test environment initialization
import { cleanup } from '@testing-library/react-native';

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Custom matchers for security testing
expect.extend({
  toBeAuditLogged(received, eventType, userId?) {
    const auditLogs = received;
    const found = auditLogs.some(
      (log: any) =>
        log.event_type === eventType &&
        (userId ? log.user_id === userId : true),
    );

    return {
      message: () =>
        found
          ? `Expected audit log with event type ${eventType} not to be logged`
          : `Expected audit log with event type ${eventType} to be logged`,
      pass: found,
    };
  },

  toBeRateLimited(received, identifier, actionType) {
    const { allowed, isBlocked } = received;
    const pass = !allowed && isBlocked;

    return {
      message: () =>
        pass
          ? `Expected ${identifier} not to be rate limited for ${actionType}`
          : `Expected ${identifier} to be rate limited for ${actionType}`,
      pass,
    };
  },

  toHaveSecurityHeaders(received) {
    const requiredHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
    ];

    const missingHeaders = requiredHeaders.filter(
      header => !received.headers || !received.headers[header],
    );

    const pass = missingHeaders.length === 0;

    return {
      message: () =>
        pass
          ? 'Expected response not to have security headers'
          : `Expected response to have security headers. Missing: ${missingHeaders.join(
              ', ',
            )}`,
      pass,
    };
  },

  toBeValidDeviceFingerprint(received) {
    const requiredFields = [
      'deviceId',
      'deviceName',
      'deviceType',
      'osName',
      'osVersion',
      'appVersion',
    ];

    const missingFields = requiredFields.filter(
      field => !received || received[field] === undefined,
    );

    const pass = missingFields.length === 0;

    return {
      message: () =>
        pass
          ? 'Expected not to be a valid device fingerprint'
          : `Expected to be a valid device fingerprint. Missing: ${missingFields.join(
              ', ',
            )}`,
      pass,
    };
  },
});

// Security test utilities
(global as any).securityTestUtils = {
  // Generate test IP addresses
  generateTestIP: () => `192.168.1.${Math.floor(Math.random() * 254) + 1}`,

  // Generate test user agents
  generateTestUserAgent: (platform = 'iOS') =>
    `CreativeBridge/1.0.0 (${platform} ${
      platform === 'iOS' ? '15.0' : '11.0'
    })`,

  // Generate test device fingerprints
  generateTestDeviceFingerprint: (overrides = {}) => ({
    deviceId: `test-device-${Math.random().toString(36).substr(2, 9)}`,
    deviceName: 'Test Device',
    deviceType: 'MOBILE',
    osName: 'iOS',
    osVersion: '15.0',
    appVersion: '1.0.0',
    screenDimensions: { width: 375, height: 812 },
    timezone: 'UTC',
    locale: 'en-US',
    ...overrides,
  }),

  // Wait for async operations
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock network conditions
  mockNetworkConditions: {
    offline: () => {
      jest.doMock('@react-native-community/netinfo', () => ({
        fetch: jest.fn().mockResolvedValue({
          type: 'none',
          isConnected: false,
          isInternetReachable: false,
        }),
      }));
    },

    slow: () => {
      jest.doMock('@react-native-community/netinfo', () => ({
        fetch: jest.fn().mockResolvedValue({
          type: 'cellular',
          isConnected: true,
          isInternetReachable: true,
          details: {
            isConnectionExpensive: true,
            effectiveType: '2g',
          },
        }),
      }));
    },

    normal: () => {
      jest.doMock('@react-native-community/netinfo', () => ({
        fetch: jest.fn().mockResolvedValue({
          type: 'wifi',
          isConnected: true,
          isInternetReachable: true,
        }),
      }));
    },
  },
};

// Silence specific warnings in tests
const originalWarn = console.warn;
console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning: ReactDOM.render is no longer supported') ||
      args[0].includes('Warning: componentWillReceiveProps') ||
      args[0].includes('Warning: componentWillMount'))
  ) {
    return;
  }
  originalWarn.call(console, ...args);
};
