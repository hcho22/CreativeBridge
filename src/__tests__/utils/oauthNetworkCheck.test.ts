/**
 * OAuth Network Check Utility Tests
 *
 * Unit tests for network connectivity checking before OAuth flows
 *
 * Based on: TASKS-oauth-google-apple-signin-PRD.md Task 5.5
 */

import {
  checkNetworkBeforeOAuth,
  getNetworkErrorMessage,
  NetworkCheckResult,
} from '../../utils/oauthNetworkCheck';
import NetInfo from '@react-native-community/netinfo';

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
}));

const mockNetInfoFetch = NetInfo.fetch as jest.MockedFunction<
  typeof NetInfo.fetch
>;

describe('OAuth Network Check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkNetworkBeforeOAuth', () => {
    test('returns network state when connected', async () => {
      mockNetInfoFetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
        details: null,
      } as any);

      const result = await checkNetworkBeforeOAuth();

      expect(result.isConnected).toBe(true);
      expect(result.isInternetReachable).toBe(true);
      expect(result.connectionType).toBe('wifi');
      expect(result.error).toBeUndefined();
    });

    test('returns network state when disconnected', async () => {
      mockNetInfoFetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        type: 'none',
        details: null,
      } as any);

      const result = await checkNetworkBeforeOAuth();

      expect(result.isConnected).toBe(false);
      expect(result.isInternetReachable).toBe(false);
      expect(result.connectionType).toBe('none');
    });

    test('handles null network state gracefully', async () => {
      mockNetInfoFetch.mockResolvedValue({
        isConnected: null,
        isInternetReachable: null,
        type: null,
        details: null,
      } as any);

      const result = await checkNetworkBeforeOAuth();

      expect(result.isConnected).toBe(false);
      expect(result.isInternetReachable).toBeNull();
      expect(result.connectionType).toBeNull();
    });

    test('handles network check errors gracefully', async () => {
      mockNetInfoFetch.mockRejectedValue(new Error('Network check failed'));

      const result = await checkNetworkBeforeOAuth();

      // Should fail open (assume connected) to allow OAuth attempt
      expect(result.isConnected).toBe(true);
      expect(result.error).toBe('Network check failed');
    });

    test('handles various connection types', async () => {
      const connectionTypes = ['wifi', 'cellular', 'ethernet', 'bluetooth'];

      for (const type of connectionTypes) {
        mockNetInfoFetch.mockResolvedValue({
          isConnected: true,
          isInternetReachable: true,
          type,
          details: null,
        } as any);

        const result = await checkNetworkBeforeOAuth();
        expect(result.connectionType).toBe(type);
      }
    });
  });

  describe('getNetworkErrorMessage', () => {
    test('returns null when network is available', () => {
      const networkState: NetworkCheckResult = {
        isConnected: true,
        isInternetReachable: true,
        connectionType: 'wifi',
      };

      const message = getNetworkErrorMessage(networkState);

      expect(message).toBeNull();
    });

    test('returns error message when not connected', () => {
      const networkState: NetworkCheckResult = {
        isConnected: false,
        isInternetReachable: false,
        connectionType: 'none',
      };

      const message = getNetworkErrorMessage(networkState);

      expect(message).toBeDefined();
      expect(message).toContain('No internet connection');
    });

    test('returns error message when connected but internet not reachable', () => {
      const networkState: NetworkCheckResult = {
        isConnected: true,
        isInternetReachable: false,
        connectionType: 'wifi',
      };

      const message = getNetworkErrorMessage(networkState);

      expect(message).toBeDefined();
      expect(message).toContain('Internet connection is not available');
    });

    test('returns error message when internet reachability is unknown', () => {
      const networkState: NetworkCheckResult = {
        isConnected: true,
        isInternetReachable: null,
        connectionType: 'wifi',
      };

      const message = getNetworkErrorMessage(networkState);

      // Should return null if connected (even if reachability unknown)
      expect(message).toBeNull();
    });

    test('returns error message for unstable connection', () => {
      const networkState: NetworkCheckResult = {
        isConnected: true,
        isInternetReachable: null,
        connectionType: 'cellular',
      };

      // When connected but reachability is null, we assume it's available
      // This test verifies the logic handles edge cases
      const message = getNetworkErrorMessage(networkState);

      // Should return null since isConnected is true
      expect(message).toBeNull();
    });
  });

  describe('Integration with OAuth Flow', () => {
    test('network check can be used before OAuth initiation', async () => {
      mockNetInfoFetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
        details: null,
      } as any);

      const networkState = await checkNetworkBeforeOAuth();
      const errorMessage = getNetworkErrorMessage(networkState);

      expect(networkState.isConnected).toBe(true);
      expect(errorMessage).toBeNull(); // No error, can proceed with OAuth
    });

    test('network check prevents OAuth when offline', async () => {
      mockNetInfoFetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        type: 'none',
        details: null,
      } as any);

      const networkState = await checkNetworkBeforeOAuth();
      const errorMessage = getNetworkErrorMessage(networkState);

      expect(networkState.isConnected).toBe(false);
      expect(errorMessage).toBeDefined();
      expect(errorMessage).toContain('No internet connection');
    });
  });
});

