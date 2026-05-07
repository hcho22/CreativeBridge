/**
 * Network Monitor Service Tests (Task 2.4)
 * Tests for network connectivity monitoring and automatic queue processing
 */

import { NetworkMonitorService } from '../../services/networkMonitor';
import NetInfo from '@react-native-community/netinfo';

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn(),
}));

// Mock enhanced error handling
jest.mock('../../services/enhancedErrorHandling', () => ({
  enhancedErrorHandling: {
    processDownloadQueue: jest.fn(),
  },
}));

import { enhancedErrorHandling } from '../../services/enhancedErrorHandling';

describe('NetworkMonitorService', () => {
  let networkMonitorInstance: NetworkMonitorService;
  let mockUnsubscribe: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUnsubscribe = jest.fn();

    (NetInfo.addEventListener as jest.Mock).mockReturnValue(mockUnsubscribe);
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      type: 'wifi',
      isInternetReachable: true,
    });

    networkMonitorInstance = new NetworkMonitorService();
  });

  afterEach(() => {
    networkMonitorInstance.cleanup();
  });

  describe('Initialization and Cleanup', () => {
    it('should initialize network monitoring', () => {
      networkMonitorInstance.initialize();

      expect(NetInfo.addEventListener).toHaveBeenCalledWith(
        expect.any(Function),
      );
      expect(NetInfo.fetch).toHaveBeenCalled();
    });

    it('should cleanup network monitoring', () => {
      networkMonitorInstance.initialize();
      networkMonitorInstance.cleanup();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should handle cleanup when not initialized', () => {
      expect(() => networkMonitorInstance.cleanup()).not.toThrow();
    });
  });

  describe('Network Status Tracking', () => {
    it('should return initial network status', () => {
      const status = networkMonitorInstance.getCurrentStatus();

      expect(status).toEqual({
        isConnected: false,
        connectionType: 'unknown',
        isInternetReachable: false,
        strength: 'unknown',
      });
    });

    it('should update network status when connection changes', () => {
      const mockNetInfoState = {
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
        details: { strength: -50 },
      };

      networkMonitorInstance.initialize();

      // Simulate network state change
      const networkChangeHandler = (NetInfo.addEventListener as jest.Mock).mock
        .calls[0][0];
      networkChangeHandler(mockNetInfoState);

      const status = networkMonitorInstance.getCurrentStatus();

      expect(status.isConnected).toBe(true);
      expect(status.connectionType).toBe('wifi');
      expect(status.isInternetReachable).toBe(true);
      expect(status.strength).toBe('excellent');
    });

    it('should evaluate cellular connection strength correctly', () => {
      const testCases = [
        { strength: 90, expected: 'excellent' },
        { strength: 70, expected: 'good' },
        { strength: 50, expected: 'fair' },
        { strength: 30, expected: 'poor' },
      ];

      networkMonitorInstance.initialize();
      const networkChangeHandler = (NetInfo.addEventListener as jest.Mock).mock
        .calls[0][0];

      testCases.forEach(({ strength, expected }) => {
        const mockState = {
          isConnected: true,
          type: 'cellular',
          isInternetReachable: true,
          details: { strength },
        };

        networkChangeHandler(mockState);
        const status = networkMonitorInstance.getCurrentStatus();
        expect(status.strength).toBe(expected);
      });
    });

    it('should evaluate WiFi connection strength correctly', () => {
      const testCases = [
        { strength: -40, expected: 'excellent' },
        { strength: -55, expected: 'good' },
        { strength: -65, expected: 'fair' },
        { strength: -75, expected: 'poor' },
      ];

      networkMonitorInstance.initialize();
      const networkChangeHandler = (NetInfo.addEventListener as jest.Mock).mock
        .calls[0][0];

      testCases.forEach(({ strength, expected }) => {
        const mockState = {
          isConnected: true,
          type: 'wifi',
          isInternetReachable: true,
          details: { strength },
        };

        networkChangeHandler(mockState);
        const status = networkMonitorInstance.getCurrentStatus();
        expect(status.strength).toBe(expected);
      });
    });

    it('should default to good strength for WiFi without details', () => {
      const mockState = {
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
        details: {},
      };

      networkMonitorInstance.initialize();
      const networkChangeHandler = (NetInfo.addEventListener as jest.Mock).mock
        .calls[0][0];
      networkChangeHandler(mockState);

      const status = networkMonitorInstance.getCurrentStatus();
      expect(status.strength).toBe('good');
    });
  });

  describe('Listener Management', () => {
    it('should add and notify listeners', () => {
      networkMonitorInstance.initialize();

      const listener = jest.fn();
      const unsubscribe = networkMonitorInstance.addListener(listener);

      // Should immediately call with current status
      expect(listener).toHaveBeenCalledWith({
        isConnected: false,
        connectionType: 'unknown',
        isInternetReachable: false,
        strength: 'unknown',
      });

      // Simulate network change
      const networkChangeHandler = (NetInfo.addEventListener as jest.Mock).mock
        .calls[0][0];
      networkChangeHandler({
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
      });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          isConnected: true,
          connectionType: 'wifi',
          isInternetReachable: true,
        }),
      );

      unsubscribe();
    });

    it('should remove listeners correctly', () => {
      networkMonitorInstance.initialize();

      const listener = jest.fn();
      const unsubscribe = networkMonitorInstance.addListener(listener);

      unsubscribe();

      // Simulate network change after unsubscribe
      const networkChangeHandler = (NetInfo.addEventListener as jest.Mock).mock
        .calls[0][0];
      networkChangeHandler({
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
      });

      // Should only have been called once (initial call)
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should handle listener errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      networkMonitorInstance.initialize();

      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });

      networkMonitorInstance.addListener(errorListener);

      const networkChangeHandler = (NetInfo.addEventListener as jest.Mock).mock
        .calls[0][0];

      expect(() => {
        networkChangeHandler({
          isConnected: true,
          type: 'wifi',
          isInternetReachable: true,
        });
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Network listener error:'),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Download Readiness Assessment', () => {
    it('should return true when ready for downloads', () => {
      networkMonitorInstance.initialize();

      const networkChangeHandler = (NetInfo.addEventListener as jest.Mock).mock
        .calls[0][0];
      networkChangeHandler({
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
        details: { strength: -50 },
      });

      expect(networkMonitorInstance.isDownloadReady()).toBe(true);
    });

    it('should return false when not connected', () => {
      networkMonitorInstance.initialize();

      const networkChangeHandler = (NetInfo.addEventListener as jest.Mock).mock
        .calls[0][0];
      networkChangeHandler({
        isConnected: false,
        type: 'none',
        isInternetReachable: false,
      });

      expect(networkMonitorInstance.isDownloadReady()).toBe(false);
    });

    it('should return false when internet not reachable', () => {
      networkMonitorInstance.initialize();

      const networkChangeHandler = (NetInfo.addEventListener as jest.Mock).mock
        .calls[0][0];
      networkChangeHandler({
        isConnected: true,
        type: 'wifi',
        isInternetReachable: false,
      });

      expect(networkMonitorInstance.isDownloadReady()).toBe(false);
    });

    it('should return false when connection strength is poor', () => {
      networkMonitorInstance.initialize();

      const networkChangeHandler = (NetInfo.addEventListener as jest.Mock).mock
        .calls[0][0];
      networkChangeHandler({
        isConnected: true,
        type: 'cellular',
        isInternetReachable: true,
        details: { strength: 30 }, // Poor strength
      });

      expect(networkMonitorInstance.isDownloadReady()).toBe(false);
    });
  });

  describe('Connection Waiting', () => {
    it('should resolve immediately if already connected', async () => {
      networkMonitorInstance.initialize();

      const networkChangeHandler = (NetInfo.addEventListener as jest.Mock).mock
        .calls[0][0];
      networkChangeHandler({
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
      });

      const startTime = Date.now();
      const result = await networkMonitorInstance.waitForConnection(5000);
      const duration = Date.now() - startTime;

      expect(result).toBe(true);
      expect(duration).toBeLessThan(100); // Should be immediate
    });

    it('should wait for connection and resolve when connected', async () => {
      networkMonitorInstance.initialize();

      // Start waiting for connection
      const connectionPromise = networkMonitorInstance.waitForConnection(5000);

      // Simulate connection after a delay
      setTimeout(() => {
        const networkChangeHandler = (NetInfo.addEventListener as jest.Mock)
          .mock.calls[0][0];
        networkChangeHandler({
          isConnected: true,
          type: 'wifi',
          isInternetReachable: true,
        });
      }, 100);

      const result = await connectionPromise;
      expect(result).toBe(true);
    });

    it('should timeout and return false if connection not established', async () => {
      networkMonitorInstance.initialize();

      const startTime = Date.now();
      const result = await networkMonitorInstance.waitForConnection(100); // Short timeout
      const duration = Date.now() - startTime;

      expect(result).toBe(false);
      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Automatic Queue Processing', () => {
    it('should process download queue when connection is restored', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      (
        enhancedErrorHandling.processDownloadQueue as jest.Mock
      ).mockResolvedValue({
        processed: 2,
        failed: 0,
        total: 2,
      });

      networkMonitorInstance.initialize();
      const networkChangeHandler = (NetInfo.addEventListener as jest.Mock).mock
        .calls[0][0];

      // Simulate initial disconnected state
      networkChangeHandler({
        isConnected: false,
        type: 'none',
        isInternetReachable: false,
      });

      // Simulate connection restoration
      networkChangeHandler({
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
      });

      // Wait for the connection stabilization delay (2 seconds)
      await new Promise(resolve => setTimeout(resolve, 2100));

      expect(enhancedErrorHandling.processDownloadQueue).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '🔗 Connection restored - processing download queue',
        ),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Successfully processed 2 queued downloads'),
      );

      consoleSpy.mockRestore();
    });

    it('should handle queue processing errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (
        enhancedErrorHandling.processDownloadQueue as jest.Mock
      ).mockRejectedValue(new Error('Queue processing failed'));

      networkMonitorInstance.initialize();
      const networkChangeHandler = (NetInfo.addEventListener as jest.Mock).mock
        .calls[0][0];

      // Simulate connection restoration
      networkChangeHandler({
        isConnected: false,
        type: 'none',
        isInternetReachable: false,
      });

      networkChangeHandler({
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2100));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '❌ Failed to process queue on connection restore:',
        ),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it('should not process queue if not download ready', async () => {
      networkMonitorInstance.initialize();
      const networkChangeHandler = (NetInfo.addEventListener as jest.Mock).mock
        .calls[0][0];

      // Simulate connection but poor quality
      networkChangeHandler({
        isConnected: false,
        type: 'none',
        isInternetReachable: false,
      });

      networkChangeHandler({
        isConnected: true,
        type: 'cellular',
        isInternetReachable: true,
        details: { strength: 20 }, // Poor strength
      });

      // Wait for processing attempt
      await new Promise(resolve => setTimeout(resolve, 2100));

      expect(enhancedErrorHandling.processDownloadQueue).not.toHaveBeenCalled();
    });

    it('should log connection loss events', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      networkMonitorInstance.initialize();
      const networkChangeHandler = (NetInfo.addEventListener as jest.Mock).mock
        .calls[0][0];

      // Simulate connected state
      networkChangeHandler({
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
      });

      // Simulate connection loss
      networkChangeHandler({
        isConnected: false,
        type: 'none',
        isInternetReachable: false,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '📵 Connection lost - downloads will be queued',
        ),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null network state values', () => {
      networkMonitorInstance.initialize();
      const networkChangeHandler = (NetInfo.addEventListener as jest.Mock).mock
        .calls[0][0];

      const mockState = {
        isConnected: null,
        type: 'unknown',
        isInternetReachable: null,
      };

      expect(() => networkChangeHandler(mockState)).not.toThrow();

      const status = networkMonitorInstance.getCurrentStatus();
      expect(status.isConnected).toBe(false);
      expect(status.isInternetReachable).toBe(false);
    });

    it('should handle missing connection details', () => {
      networkMonitorInstance.initialize();
      const networkChangeHandler = (NetInfo.addEventListener as jest.Mock).mock
        .calls[0][0];

      const mockState = {
        isConnected: true,
        type: 'cellular',
        isInternetReachable: true,
        // No details property
      };

      expect(() => networkChangeHandler(mockState)).not.toThrow();

      const status = networkMonitorInstance.getCurrentStatus();
      expect(status.strength).toBe('fair'); // Default for cellular without details
    });
  });
});
