/**
 * Error Recovery Modal Component (Task 2.4)
 * Provides user-friendly error recovery interface
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  DownloadError,
  RecoveryOption,
  enhancedErrorHandling,
} from '../../services/enhancedErrorHandling';

interface ErrorRecoveryModalProps {
  visible: boolean;
  error: DownloadError | null;
  onClose: () => void;
  onRetry: () => void;
  onRetryWithOptions?: (options: any) => void;
}

export const ErrorRecoveryModal: React.FC<ErrorRecoveryModalProps> = ({
  visible,
  error,
  onClose,
  onRetry,
  onRetryWithOptions,
}) => {
  const [isExecutingRecovery, setIsExecutingRecovery] = useState(false);
  const [selectedOption, setSelectedOption] = useState<RecoveryOption | null>(
    null,
  );

  useEffect(() => {
    if (!visible) {
      setSelectedOption(null);
      setIsExecutingRecovery(false);
    }
  }, [visible]);

  const handleRecoveryAction = async (option: RecoveryOption) => {
    if (!error) return;

    setIsExecutingRecovery(true);
    setSelectedOption(option);

    try {
      const success = await enhancedErrorHandling.executeRecoveryAction(
        option,
        error,
      );

      if (success) {
        // Automatic recovery successful
        onRetry();
      } else {
        // Manual action required or recovery initiated
        if (option.action === 'retry') {
          onRetry();
        }
      }
    } catch (recoveryError) {
      console.error('❌ Recovery action failed:', recoveryError);
      Alert.alert(
        'Recovery Failed',
        'The recovery action could not be completed. Please try a different approach.',
        [{ text: 'OK' }],
      );
    } finally {
      setIsExecutingRecovery(false);
      setSelectedOption(null);
    }
  };

  const getErrorIcon = (errorType: DownloadError['type']): string => {
    switch (errorType) {
      case 'permission_denied':
        return '🔒';
      case 'storage_full':
        return '💾';
      case 'network_error':
        return '📶';
      case 'file_system_error':
        return '📁';
      case 'timeout':
        return '⏱️';
      case 'user_cancelled':
        return '🚫';
      default:
        return '⚠️';
    }
  };

  const getErrorTitle = (errorType: DownloadError['type']): string => {
    switch (errorType) {
      case 'permission_denied':
        return 'Permission Required';
      case 'storage_full':
        return 'Storage Full';
      case 'network_error':
        return 'Network Issue';
      case 'file_system_error':
        return 'File System Error';
      case 'timeout':
        return 'Download Timeout';
      case 'user_cancelled':
        return 'Download Cancelled';
      default:
        return 'Download Error';
    }
  };

  const getErrorDescription = (error: DownloadError): string => {
    switch (error.type) {
      case 'permission_denied':
        return 'The app needs permission to save files to your device. Please grant file access permissions in Settings.';
      case 'storage_full':
        return "Your device doesn't have enough storage space for this download. Free up some space and try again.";
      case 'network_error':
        return "There's a problem with your internet connection. Check your connection and try again.";
      case 'file_system_error':
        return 'There was a problem accessing the file system. This might be a temporary issue.';
      case 'timeout':
        return 'The download took too long to complete. This might be due to a slow connection or large file size.';
      case 'user_cancelled':
        return 'The download was cancelled. You can start a new download anytime.';
      default:
        return (
          error.message || 'An unexpected error occurred during the download.'
        );
    }
  };

  const getPriorityColor = (priority: RecoveryOption['priority']): string => {
    switch (priority) {
      case 'high':
        return '#4CAF50';
      case 'medium':
        return '#ff9800';
      case 'low':
        return '#9e9e9e';
      default:
        return '#4CAF50';
    }
  };

  if (!error) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.errorIconContainer}>
            <Text style={styles.errorIcon}>{getErrorIcon(error.type)}</Text>
          </View>
          <Text style={styles.errorTitle}>{getErrorTitle(error.type)}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.errorDetails}>
            <Text style={styles.errorDescription}>
              {getErrorDescription(error)}
            </Text>

            {error.context.fileName && (
              <View style={styles.contextInfo}>
                <Text style={styles.contextLabel}>File:</Text>
                <Text style={styles.contextValue}>
                  {error.context.fileName}
                </Text>
              </View>
            )}

            <View style={styles.contextInfo}>
              <Text style={styles.contextLabel}>Time:</Text>
              <Text style={styles.contextValue}>
                {new Date(error.timestamp).toLocaleString()}
              </Text>
            </View>

            {error.retryCount > 0 && (
              <View style={styles.contextInfo}>
                <Text style={styles.contextLabel}>Attempts:</Text>
                <Text style={styles.contextValue}>
                  {error.retryCount} of {error.maxRetries}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.recoverySection}>
            <Text style={styles.sectionTitle}>Recovery Options</Text>
            <Text style={styles.sectionSubtitle}>
              Choose an option to resolve this issue:
            </Text>

            {error.recoveryOptions.map(option => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.recoveryOption,
                  selectedOption?.id === option.id && styles.selectedOption,
                ]}
                onPress={() => handleRecoveryAction(option)}
                disabled={isExecutingRecovery}
                accessibilityLabel={`Recovery option: ${option.label}`}
                accessibilityHint={option.description}
              >
                <View style={styles.optionHeader}>
                  <View
                    style={[
                      styles.priorityIndicator,
                      { backgroundColor: getPriorityColor(option.priority) },
                    ]}
                  />
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  {option.automated && (
                    <View style={styles.automatedBadge}>
                      <Text style={styles.automatedText}>AUTO</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.optionDescription}>
                  {option.description}
                </Text>

                {isExecutingRecovery && selectedOption?.id === option.id && (
                  <View style={styles.executingContainer}>
                    <ActivityIndicator size="small" color="#4CAF50" />
                    <Text style={styles.executingText}>Executing...</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.footerButton, styles.cancelButton]}
            onPress={onClose}
            disabled={isExecutingRecovery}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          {error.canRetry && (
            <TouchableOpacity
              style={[styles.footerButton, styles.retryButton]}
              onPress={onRetry}
              disabled={isExecutingRecovery}
            >
              <Text style={styles.retryButtonText}>
                {error.retryCount > 0 ? 'Retry Again' : 'Try Again'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  errorIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffebee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  errorIcon: {
    fontSize: 22,
  },
  errorTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  errorDetails: {
    marginBottom: 24,
  },
  errorDescription: {
    fontSize: 18,
    lineHeight: 24,
    color: '#333',
    marginBottom: 16,
  },
  contextInfo: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  contextLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    width: 60,
  },
  contextValue: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  recoverySection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  recoveryOption: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedOption: {
    borderColor: '#4CAF50',
    backgroundColor: '#f1f8e9',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  priorityIndicator: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  automatedBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  automatedText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  optionDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 20,
    marginLeft: 16,
  },
  executingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginLeft: 16,
  },
  executingText: {
    fontSize: 16,
    color: '#4CAF50',
    marginLeft: 8,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
  retryButton: {
    backgroundColor: '#4CAF50',
  },
  retryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ErrorRecoveryModal;
