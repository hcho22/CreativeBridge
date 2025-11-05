/**
 * Network Monitor Service (Task 2.4)
 * Monitors network connectivity and manages offline download queue
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { enhancedErrorHandling } from './enhancedErrorHandling';

export interface NetworkStatus {
  isConnected: boolean;
  connectionType: string;
  isInternetReachable: boolean;
  strength: 'poor' | 'fair' | 'good' | 'excellent' | 'unknown';
}

export class NetworkMonitorService {
  private listeners: Array<(status: NetworkStatus) => void> = [];
  private currentStatus: NetworkStatus = {
    isConnected: false,
    connectionType: 'unknown',
    isInternetReachable: false,
    strength: 'unknown'
  };
  private unsubscribeNetInfo?: () => void;

  /**
   * Initialize network monitoring
   */
  initialize(): void {
    this.unsubscribeNetInfo = NetInfo.addEventListener(this.handleNetworkChange.bind(this));
    
    // Get initial network state
    NetInfo.fetch().then(this.handleNetworkChange.bind(this));
  }

  /**
   * Cleanup network monitoring
   */
  cleanup(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
    this.listeners = [];
  }

  /**
   * Add network status listener
   */
  addListener(callback: (status: NetworkStatus) => void): () => void {
    this.listeners.push(callback);
    
    // Immediately call with current status
    callback(this.currentStatus);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get current network status
   */
  getCurrentStatus(): NetworkStatus {
    return { ...this.currentStatus };
  }

  /**
   * Check if network is suitable for downloads
   */
  isDownloadReady(): boolean {
    return this.currentStatus.isConnected && 
           this.currentStatus.isInternetReachable && 
           this.currentStatus.strength !== 'poor';
  }

  /**
   * Wait for network connection with timeout
   */
  async waitForConnection(timeoutMs: number = 30000): Promise<boolean> {
    if (this.isDownloadReady()) {
      return true;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        resolve(false);
      }, timeoutMs);

      const unsubscribe = this.addListener((status) => {
        if (status.isConnected && status.isInternetReachable) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(true);
        }
      });
    });
  }

  private handleNetworkChange(state: NetInfoState): void {
    const previousStatus = { ...this.currentStatus };
    
    this.currentStatus = {
      isConnected: state.isConnected ?? false,
      connectionType: state.type,
      isInternetReachable: state.isInternetReachable ?? false,
      strength: this.evaluateConnectionStrength(state)
    };

    console.log('📶 Network status changed:', this.currentStatus);

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(this.currentStatus);
      } catch (error) {
        console.error('❌ Network listener error:', error);
      }
    });

    // Handle connection restoration
    if (!previousStatus.isConnected && this.currentStatus.isConnected) {
      this.handleConnectionRestored();
    }

    // Handle connection loss
    if (previousStatus.isConnected && !this.currentStatus.isConnected) {
      this.handleConnectionLost();
    }
  }

  private evaluateConnectionStrength(state: NetInfoState): NetworkStatus['strength'] {
    if (!state.isConnected) {
      return 'unknown';
    }

    // For cellular connections, use signal strength if available
    if (state.type === 'cellular' && state.details && 'strength' in state.details) {
      const strength = (state.details as any).strength;
      if (strength >= 80) return 'excellent';
      if (strength >= 60) return 'good';
      if (strength >= 40) return 'fair';
      return 'poor';
    }

    // For WiFi, assume good connection unless specified otherwise
    if (state.type === 'wifi') {
      if (state.details && 'strength' in state.details) {
        const strength = (state.details as any).strength;
        if (strength >= -50) return 'excellent';
        if (strength >= -60) return 'good';
        if (strength >= -70) return 'fair';
        return 'poor';
      }
      return 'good'; // Default for WiFi
    }

    return 'fair'; // Default for other connection types
  }

  private async handleConnectionRestored(): Promise<void> {
    console.log('🔗 Connection restored - processing download queue');
    
    try {
      // Give the connection a moment to stabilize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (this.isDownloadReady()) {
        const result = await enhancedErrorHandling.processDownloadQueue();
        console.log('📊 Queue processing result:', result);
        
        if (result.processed > 0) {
          console.log(`✅ Successfully processed ${result.processed} queued downloads`);
        }
      }
    } catch (error) {
      console.error('❌ Failed to process queue on connection restore:', error);
    }
  }

  private handleConnectionLost(): void {
    console.log('📵 Connection lost - downloads will be queued');
  }
}

// Export singleton instance
export const networkMonitor = new NetworkMonitorService();
export default networkMonitor;