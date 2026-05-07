/**
 * Download Progress Indicator Component (Task 2.5)
 * Shows real-time progress for story downloads with stage-specific feedback
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { DownloadProgress } from '../../services/optimizedStoryDownloadService';

interface DownloadProgressIndicatorProps {
  visible: boolean;
  progress: DownloadProgress | null;
  onCancel?: () => void;
  style?: any;
}

export const DownloadProgressIndicator: React.FC<
  DownloadProgressIndicatorProps
> = ({ visible, progress, onCancel, style }) => {
  const [progressAnim] = useState(new Animated.Value(0));
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));

  useEffect(() => {
    if (visible) {
      // Animate modal entrance
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate modal exit
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- US-019 batch 4: fadeAnim/scaleAnim are useRef Animated.Value refs and are stable across renders.
  }, [visible]);

  useEffect(() => {
    if (progress) {
      // Animate progress bar
      Animated.timing(progressAnim, {
        toValue: progress.progress / 100,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- US-019 batch 4: progressAnim is a stable useRef; depending on the exact `progress.progress` numeric is the intended trigger.
  }, [progress?.progress]);

  const getStageIcon = (stage: DownloadProgress['stage']): string => {
    switch (stage) {
      case 'validating':
        return '🔍';
      case 'generating':
        return '📝';
      case 'compressing':
        return '🗜️';
      case 'saving':
        return '💾';
      case 'sharing':
        return '📤';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '⏳';
    }
  };

  const getStageColor = (stage: DownloadProgress['stage']): string => {
    switch (stage) {
      case 'validating':
        return '#2196F3';
      case 'generating':
        return '#FF9800';
      case 'compressing':
        return '#9C27B0';
      case 'saving':
        return '#4CAF50';
      case 'sharing':
        return '#00BCD4';
      case 'completed':
        return '#4CAF50';
      case 'error':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  const formatStageMessage = (
    stage: DownloadProgress['stage'],
    message: string,
  ): string => {
    const stageLabels: Record<string, string> = {
      validating: 'Validating Content',
      generating: 'Generating File',
      compressing: 'Optimizing File',
      saving: 'Saving File',
      sharing: 'Opening Share Dialog',
      completed: 'Complete',
      error: 'Error',
    };

    return stageLabels[stage] || message;
  };

  const formatTimeRemaining = (seconds?: number): string => {
    if (!seconds || seconds <= 0) return '';

    if (seconds < 60) {
      return `${Math.round(seconds)}s remaining`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${minutes}m ${remainingSeconds}s remaining`;
    }
  };

  if (!visible || !progress) {
    return null;
  }

  const isCompleted = progress.stage === 'completed';
  const isError = progress.stage === 'error';
  const canCancel = !isCompleted && !isError && onCancel;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={canCancel ? onCancel : undefined}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            style,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerIcon}>
              {getStageIcon(progress.stage)}
            </Text>
            <Text style={styles.headerTitle}>
              {isCompleted
                ? 'Download Complete'
                : isError
                ? 'Download Failed'
                : 'Downloading Story'}
            </Text>
          </View>

          {/* Progress Content */}
          <View style={styles.content}>
            {/* Stage Information */}
            <View style={styles.stageContainer}>
              <View
                style={[
                  styles.stageIndicator,
                  { backgroundColor: getStageColor(progress.stage) },
                ]}
              />
              <Text style={styles.stageText}>
                {formatStageMessage(progress.stage, progress.message)}
              </Text>
            </View>

            {/* Progress Bar */}
            {!isCompleted && !isError && (
              <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                        backgroundColor: getStageColor(progress.stage),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {Math.round(progress.progress)}%
                </Text>
              </View>
            )}

            {/* Message */}
            <Text
              style={[
                styles.message,
                isError && styles.errorMessage,
                isCompleted && styles.successMessage,
              ]}
            >
              {progress.message}
            </Text>

            {/* Time Remaining */}
            {progress.estimatedTimeRemaining && !isCompleted && !isError && (
              <Text style={styles.timeRemaining}>
                {formatTimeRemaining(progress.estimatedTimeRemaining)}
              </Text>
            )}

            {/* Loading Spinner for Active Operations */}
            {!isCompleted && !isError && (
              <View style={styles.spinnerContainer}>
                <ActivityIndicator
                  size="large"
                  color={getStageColor(progress.stage)}
                />
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {canCancel && (
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onCancel}
                accessibilityLabel="Cancel download"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}

            {(isCompleted || isError) && (
              <TouchableOpacity
                style={[styles.button, styles.closeButton]}
                onPress={onCancel}
                accessibilityLabel={isCompleted ? 'Close' : 'Dismiss error'}
              >
                <Text style={styles.closeButtonText}>
                  {isCompleted ? 'Done' : 'Close'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const { width: screenWidth } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: Math.min(screenWidth - 40, 340),
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 34,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  content: {
    padding: 20,
  },
  stageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stageIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  stageText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  errorMessage: {
    color: '#F44336',
  },
  successMessage: {
    color: '#4CAF50',
  },
  timeRemaining: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  spinnerContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
  closeButton: {
    backgroundColor: '#4CAF50',
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});

export default DownloadProgressIndicator;
