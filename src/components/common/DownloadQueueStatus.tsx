/**
 * Download Queue Status Component (Task 2.4)
 * Shows status of queued downloads and network connectivity
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import {
  enhancedErrorHandling,
  QueuedDownload,
} from '../../services/enhancedErrorHandling';
import { networkMonitor, NetworkStatus } from '../../services/networkMonitor';

interface DownloadQueueStatusProps {
  onPress?: () => void;
  style?: any;
}

export const DownloadQueueStatus: React.FC<DownloadQueueStatusProps> = ({
  onPress,
  style,
}) => {
  const [queuedDownloads, setQueuedDownloads] = useState<QueuedDownload[]>([]);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: false,
    connectionType: 'unknown',
    isInternetReachable: false,
    strength: 'unknown',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    loadQueueStatus();

    // Set up network monitoring
    const unsubscribeNetwork = networkMonitor.addListener(setNetworkStatus);

    // Refresh queue status periodically
    const interval = setInterval(loadQueueStatus, 10000); // Every 10 seconds

    return () => {
      unsubscribeNetwork();
      clearInterval(interval);
    };
  }, []);

  const loadQueueStatus = async () => {
    try {
      const queue = await enhancedErrorHandling.getDownloadQueue();
      setQueuedDownloads(queue);
    } catch (error) {
      console.error('❌ Failed to load queue status:', error);
    }
  };

  const handleRetryQueue = async () => {
    if (isProcessing || !networkStatus.isConnected) return;

    setIsProcessing(true);
    try {
      const result = await enhancedErrorHandling.processDownloadQueue();
      console.log('📊 Queue retry result:', result);

      // Refresh queue status
      await loadQueueStatus();

      if (result.processed > 0) {
        // Animate success
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0.5,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } catch (error) {
      console.error('❌ Failed to retry queue:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusText = (): string => {
    if (queuedDownloads.length === 0) {
      return 'No queued downloads';
    }

    const pendingCount = queuedDownloads.length;
    const failedCount = queuedDownloads.filter(d => d.lastError).length;

    if (!networkStatus.isConnected) {
      return `${pendingCount} download${
        pendingCount !== 1 ? 's' : ''
      } waiting for connection`;
    }

    if (isProcessing) {
      return 'Processing downloads...';
    }

    if (failedCount > 0) {
      return `${pendingCount} download${
        pendingCount !== 1 ? 's' : ''
      } queued (${failedCount} failed)`;
    }

    return `${pendingCount} download${pendingCount !== 1 ? 's' : ''} queued`;
  };

  const getStatusColor = (): string => {
    if (queuedDownloads.length === 0) {
      return '#9e9e9e';
    }

    if (!networkStatus.isConnected) {
      return '#ff9800';
    }

    const failedCount = queuedDownloads.filter(d => d.lastError).length;
    if (failedCount > 0) {
      return '#f44336';
    }

    return '#4CAF50';
  };

  const getNetworkIcon = (): string => {
    if (!networkStatus.isConnected) {
      return '📵';
    }

    switch (networkStatus.strength) {
      case 'excellent':
        return '📶';
      case 'good':
        return '📶';
      case 'fair':
        return '📶';
      case 'poor':
        return '📶';
      default:
        return '📶';
    }
  };

  const shouldShowStatus = (): boolean => {
    return queuedDownloads.length > 0 || !networkStatus.isConnected;
  };

  if (!shouldShowStatus()) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, style, { opacity: fadeAnim }]}>
      <TouchableOpacity
        style={[styles.statusBar, { backgroundColor: getStatusColor() }]}
        onPress={onPress || handleRetryQueue}
        disabled={isProcessing}
        accessibilityLabel={`Download queue status: ${getStatusText()}`}
        accessibilityHint={
          networkStatus.isConnected
            ? 'Tap to retry queued downloads'
            : 'Waiting for network connection'
        }
      >
        <View style={styles.iconContainer}>
          {isProcessing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.networkIcon}>{getNetworkIcon()}</Text>
          )}
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.statusText}>{getStatusText()}</Text>

          {!networkStatus.isConnected && (
            <Text style={styles.subText}>
              Offline - downloads will resume when connected
            </Text>
          )}

          {networkStatus.isConnected &&
            queuedDownloads.length > 0 &&
            !isProcessing && (
              <Text style={styles.subText}>Tap to retry now</Text>
            )}
        </View>

        <View style={styles.chevronContainer}>
          <Text style={styles.chevron}>›</Text>
        </View>
      </TouchableOpacity>

      {queuedDownloads.length > 0 && (
        <View style={styles.queueDetails}>
          {queuedDownloads.slice(0, 3).map((download, _index) => (
            <View key={download.id} style={styles.queueItem}>
              <Text style={styles.queueItemText} numberOfLines={1}>
                {download.fileName}
              </Text>
              {download.lastError && (
                <View style={styles.errorIndicator}>
                  <Text style={styles.errorText}>!</Text>
                </View>
              )}
            </View>
          ))}

          {queuedDownloads.length > 3 && (
            <Text style={styles.moreText}>
              +{queuedDownloads.length - 3} more
            </Text>
          )}
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    minHeight: 60,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  networkIcon: {
    fontSize: 18,
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  subText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  chevronContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevron: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: 'bold',
  },
  queueDetails: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: 12,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  queueItemText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    flex: 1,
  },
  errorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ff5722',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  moreText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontStyle: 'italic',
    marginTop: 4,
  },
});

export default DownloadQueueStatus;
