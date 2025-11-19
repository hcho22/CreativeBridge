/**
 * Service Status Indicator Component
 * 
 * Provides user communication for service issues and degradation
 * Task 6.3: Service Degradation Handling - User communication component
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Modal } from 'react-native';
import { ServiceHealthMonitor, ServiceHealthStatus } from '../services/serviceHealth';
import { AutomaticFallbackManager, SystemDegradationStatus } from '../services/automaticFallbackManager';
import { ServiceRestorationManager } from '../services/serviceRestoration';
import { structuredLogger } from '../utils/logger';

export interface ServiceStatusProps {
  healthMonitor: ServiceHealthMonitor;
  fallbackManager: AutomaticFallbackManager;
  restorationManager: ServiceRestorationManager;
  position?: 'top' | 'bottom';
  autoHide?: boolean;
  showDetails?: boolean;
  onStatusChange?: (status: SystemDegradationStatus) => void;
}

export interface StatusMessage {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'working';
  title: string;
  message: string;
  persistent: boolean;
  actions?: StatusAction[];
  timestamp: Date;
  priority: number; // 1 = highest priority
  icon?: string;
  progress?: number; // 0-1 for progress indicators
}

export interface StatusAction {
  label: string;
  action: 'dismiss' | 'retry' | 'details' | 'refresh' | 'contact_support';
  handler?: () => void;
}

export const ServiceStatusIndicator: React.FC<ServiceStatusProps> = ({
  healthMonitor,
  fallbackManager,
  restorationManager,
  position = 'top',
  autoHide = true,
  showDetails = false,
  onStatusChange
}) => {
  const [systemStatus, setSystemStatus] = useState<SystemDegradationStatus>({
    overall: 'normal',
    activeFallbacks: [],
    availableFeatures: [],
    disabledFeatures: []
  });

  const [currentMessage, setCurrentMessage] = useState<StatusMessage | null>(null);
  const [messageQueue, setMessageQueue] = useState<StatusMessage[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(-50))[0];

  // Update system status
  const updateSystemStatus = useCallback(() => {
    try {
      const status = fallbackManager.getSystemStatus();
      setSystemStatus(status);
      onStatusChange?.(status);

      // Generate appropriate user message
      const message = generateStatusMessage(status);
      if (message) {
        addMessage(message);
      }

      structuredLogger.debug('System status updated', {
        overall: status.overall,
        activeFallbacks: status.activeFallbacks.length,
        disabledFeatures: status.disabledFeatures.length
      });

    } catch (error) {
      structuredLogger.error('Failed to update system status', {}, error as Error);
    }
  }, [fallbackManager, onStatusChange]);

  // Add message to queue
  const addMessage = useCallback((message: StatusMessage) => {
    setMessageQueue(prevQueue => {
      // Remove duplicates and add new message
      const filteredQueue = prevQueue.filter(m => m.id !== message.id);
      const newQueue = [...filteredQueue, message];
      
      // Sort by priority (higher number = higher priority)
      return newQueue.sort((a, b) => b.priority - a.priority);
    });
  }, []);

  // Process message queue
  const processMessageQueue = useCallback(() => {
    if (currentMessage && currentMessage.persistent) {
      return; // Don't change persistent messages
    }

    if (messageQueue.length > 0) {
      const nextMessage = messageQueue[0];
      setCurrentMessage(nextMessage);
      
      if (!nextMessage.persistent) {
        setMessageQueue(prevQueue => prevQueue.slice(1));
      }

      setIsVisible(true);
      
      // Auto-hide non-persistent messages
      if (autoHide && !nextMessage.persistent) {
        setTimeout(() => {
          hideMessage();
        }, getAutoHideDuration(nextMessage));
      }
    } else if (currentMessage && !currentMessage.persistent) {
      hideMessage();
    }
  }, [currentMessage, messageQueue, autoHide]);

  // Hide current message
  const hideMessage = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentMessage(null);
      setMessageQueue(prevQueue => prevQueue.slice(1));
    }, 300); // Wait for fade animation
  }, []);

  // Animation effects
  useEffect(() => {
    if (isVisible && currentMessage) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: position === 'top' ? -50 : 50,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [isVisible, currentMessage, fadeAnim, slideAnim, position]);

  // Process queue when it changes
  useEffect(() => {
    processMessageQueue();
  }, [processMessageQueue]);

  // Set up monitoring intervals
  useEffect(() => {
    updateSystemStatus();
    
    const interval = setInterval(() => {
      updateSystemStatus();
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [updateSystemStatus]);

  // Generate status message based on system status
  const generateStatusMessage = (status: SystemDegradationStatus): StatusMessage | null => {
    const messageId = `system_${status.overall}_${Date.now()}`;
    
    switch (status.overall) {
      case 'normal':
        // Clear any existing persistent messages when system is normal
        if (currentMessage?.persistent) {
          return {
            id: messageId,
            type: 'success',
            title: 'System Restored',
            message: 'All services are now operating normally.',
            persistent: false,
            timestamp: new Date(),
            priority: 3,
            icon: '✅'
          };
        }
        return null;

      case 'degraded':
        return {
          id: messageId,
          type: 'warning',
          title: 'Limited Service Mode',
          message: status.userMessage || 'Some features are temporarily running in reduced mode to ensure the best experience.',
          persistent: true,
          timestamp: new Date(),
          priority: 4,
          icon: '⚠️',
          actions: [
            {
              label: 'Details',
              action: 'details',
              handler: () => setShowDetailModal(true)
            },
            {
              label: 'Dismiss',
              action: 'dismiss',
              handler: () => hideMessage()
            }
          ]
        };

      case 'critical':
        return {
          id: messageId,
          type: 'error',
          title: 'Service Issues',
          message: status.userMessage || 'We\'re experiencing technical difficulties. Core features remain available with limited functionality.',
          persistent: true,
          timestamp: new Date(),
          priority: 5,
          icon: '🔧',
          actions: [
            {
              label: 'Details',
              action: 'details',
              handler: () => setShowDetailModal(true)
            },
            {
              label: 'Retry',
              action: 'retry',
              handler: () => retryServices()
            }
          ]
        };

      case 'emergency':
        return {
          id: messageId,
          type: 'error',
          title: 'Emergency Mode',
          message: status.userMessage || 'The system is in emergency mode. Basic story creation is available offline while we work to restore full service.',
          persistent: true,
          timestamp: new Date(),
          priority: 6,
          icon: '🚨',
          actions: [
            {
              label: 'Details',
              action: 'details',
              handler: () => setShowDetailModal(true)
            },
            {
              label: 'Contact Support',
              action: 'contact_support',
              handler: () => contactSupport()
            }
          ]
        };

      default:
        return null;
    }
  };

  // Get auto-hide duration based on message type
  const getAutoHideDuration = (message: StatusMessage): number => {
    switch (message.type) {
      case 'success':
        return 3000; // 3 seconds
      case 'info':
        return 5000; // 5 seconds
      case 'warning':
        return 8000; // 8 seconds
      case 'error':
        return 0; // Don't auto-hide errors
      case 'working':
        return 0; // Don't auto-hide progress messages
      default:
        return 5000;
    }
  };

  // Handle retry action
  const retryServices = useCallback(async () => {
    try {
      structuredLogger.info('User initiated service retry');
      
      addMessage({
        id: `retry_${Date.now()}`,
        type: 'working',
        title: 'Retrying Services',
        message: 'Attempting to restore service functionality...',
        persistent: false,
        timestamp: new Date(),
        priority: 4,
        icon: '🔄',
        progress: 0.5
      });

      // Trigger manual restoration
      const disabledServices = systemStatus.disabledFeatures;
      if (disabledServices.length > 0) {
        await restorationManager.triggerRestoration(disabledServices, undefined, true);
      }

      setTimeout(() => updateSystemStatus(), 2000);

    } catch (error) {
      structuredLogger.error('Service retry failed', {}, error as Error);
      
      addMessage({
        id: `retry_failed_${Date.now()}`,
        type: 'error',
        title: 'Retry Failed',
        message: 'Unable to restore services at this time. Please try again later.',
        persistent: false,
        timestamp: new Date(),
        priority: 5,
        icon: '❌'
      });
    }
  }, [restorationManager, systemStatus.disabledFeatures, addMessage, updateSystemStatus]);

  // Handle contact support action
  const contactSupport = useCallback(() => {
    structuredLogger.info('User initiated support contact');
    // Implementation would open support contact method
    addMessage({
      id: `support_${Date.now()}`,
      type: 'info',
      title: 'Support Contacted',
      message: 'Our team has been notified and will work to resolve the issue.',
      persistent: false,
      timestamp: new Date(),
      priority: 3,
      icon: '📞'
    });
  }, [addMessage]);

  // Get message style based on type
  const getMessageStyle = useMemo(() => {
    if (!currentMessage) return {};

    const baseStyle = styles.messageContainer;
    
    switch (currentMessage.type) {
      case 'info':
        return [baseStyle, styles.infoMessage];
      case 'warning':
        return [baseStyle, styles.warningMessage];
      case 'error':
        return [baseStyle, styles.errorMessage];
      case 'success':
        return [baseStyle, styles.successMessage];
      case 'working':
        return [baseStyle, styles.workingMessage];
      default:
        return baseStyle;
    }
  }, [currentMessage]);

  // Render detail modal
  const renderDetailModal = () => (
    <Modal
      visible={showDetailModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowDetailModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>System Status Details</Text>
          
          <View style={styles.statusSection}>
            <Text style={styles.sectionTitle}>Overall Status</Text>
            <Text style={[styles.statusText, getStatusColor(systemStatus.overall)]}>
              {getStatusLabel(systemStatus.overall)}
            </Text>
          </View>

          <View style={styles.statusSection}>
            <Text style={styles.sectionTitle}>Available Features</Text>
            {systemStatus.availableFeatures.map(feature => (
              <Text key={feature} style={styles.featureText}>• {formatFeatureName(feature)}</Text>
            ))}
          </View>

          {systemStatus.disabledFeatures.length > 0 && (
            <View style={styles.statusSection}>
              <Text style={styles.sectionTitle}>Temporarily Disabled</Text>
              {systemStatus.disabledFeatures.map(feature => (
                <Text key={feature} style={styles.disabledFeatureText}>• {formatFeatureName(feature)}</Text>
              ))}
            </View>
          )}

          {systemStatus.activeFallbacks.length > 0 && (
            <View style={styles.statusSection}>
              <Text style={styles.sectionTitle}>Active Mitigations</Text>
              {systemStatus.activeFallbacks.map((fallback, index) => (
                <Text key={index} style={styles.fallbackText}>
                  • {fallback.strategyId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Text>
              ))}
            </View>
          )}

          {systemStatus.estimatedRecoveryTime && (
            <View style={styles.statusSection}>
              <Text style={styles.sectionTitle}>Estimated Recovery</Text>
              <Text style={styles.recoveryText}>
                {formatDuration(systemStatus.estimatedRecoveryTime)}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setShowDetailModal(false)}
          >
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Render action buttons
  const renderActions = () => {
    if (!currentMessage?.actions) return null;

    return (
      <View style={styles.actionsContainer}>
        {currentMessage.actions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.actionButton, getActionButtonStyle(action.action)]}
            onPress={action.handler}
          >
            <Text style={[styles.actionText, getActionTextStyle(action.action)]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Render progress indicator
  const renderProgress = () => {
    if (!currentMessage?.progress) return null;

    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${currentMessage.progress * 100}%` }]} />
        </View>
      </View>
    );
  };

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return { color: '#28a745' };
      case 'degraded': return { color: '#ffc107' };
      case 'critical': return { color: '#fd7e14' };
      case 'emergency': return { color: '#dc3545' };
      default: return { color: '#6c757d' };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'normal': return 'All Systems Operational';
      case 'degraded': return 'Reduced Functionality';
      case 'critical': return 'Service Issues';
      case 'emergency': return 'Emergency Mode';
      default: return 'Unknown Status';
    }
  };

  const formatFeatureName = (feature: string) => {
    return feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return 'Less than 1 minute';
    }
  };

  const getActionButtonStyle = (action: string) => {
    switch (action) {
      case 'retry': return styles.primaryButton;
      case 'contact_support': return styles.primaryButton;
      default: return styles.secondaryButton;
    }
  };

  const getActionTextStyle = (action: string) => {
    switch (action) {
      case 'retry': return styles.primaryButtonText;
      case 'contact_support': return styles.primaryButtonText;
      default: return styles.secondaryButtonText;
    }
  };

  // Don't render if no message and system is normal
  if (!currentMessage && systemStatus.overall === 'normal') {
    return null;
  }

  return (
    <>
      {isVisible && currentMessage && (
        <Animated.View
          style={[
            styles.container,
            getMessageStyle,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            position === 'bottom' ? styles.bottomPosition : styles.topPosition
          ]}
        >
          <View style={styles.messageContent}>
            <View style={styles.headerRow}>
              {currentMessage.icon && (
                <Text style={styles.icon}>{currentMessage.icon}</Text>
              )}
              <View style={styles.textContainer}>
                <Text style={styles.title}>{currentMessage.title}</Text>
                <Text style={styles.message}>{currentMessage.message}</Text>
              </View>
              {!currentMessage.persistent && (
                <TouchableOpacity
                  style={styles.dismissButton}
                  onPress={hideMessage}
                >
                  <Text style={styles.dismissText}>×</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {renderProgress()}
            {renderActions()}
          </View>
        </Animated.View>
      )}
      
      {renderDetailModal()}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  topPosition: {
    top: 50,
  },
  bottomPosition: {
    bottom: 50,
  },
  messageContainer: {
    padding: 12,
    borderLeftWidth: 4,
  },
  infoMessage: {
    backgroundColor: '#e7f3ff',
    borderLeftColor: '#007bff',
  },
  warningMessage: {
    backgroundColor: '#fff8e1',
    borderLeftColor: '#ffc107',
  },
  errorMessage: {
    backgroundColor: '#ffeaea',
    borderLeftColor: '#dc3545',
  },
  successMessage: {
    backgroundColor: '#eafaf1',
    borderLeftColor: '#28a745',
  },
  workingMessage: {
    backgroundColor: '#f8f9fa',
    borderLeftColor: '#6c757d',
  },
  messageContent: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: 18,
    marginRight: 8,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
    color: '#6c757d',
    lineHeight: 16,
  },
  dismissButton: {
    padding: 4,
    marginLeft: 8,
  },
  dismissText: {
    fontSize: 20,
    color: '#6c757d',
    lineHeight: 20,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 2,
    backgroundColor: '#e9ecef',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007bff',
    borderRadius: 1,
  },
  actionsContainer: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  primaryButton: {
    backgroundColor: '#007bff',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6c757d',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  secondaryButtonText: {
    color: '#6c757d',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    maxWidth: 320,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 16,
    textAlign: 'center',
  },
  statusSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
  },
  featureText: {
    fontSize: 12,
    color: '#28a745',
    marginBottom: 2,
  },
  disabledFeatureText: {
    fontSize: 12,
    color: '#dc3545',
    marginBottom: 2,
  },
  fallbackText: {
    fontSize: 12,
    color: '#ffc107',
    marginBottom: 2,
  },
  recoveryText: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  modalCloseButton: {
    backgroundColor: '#007bff',
    borderRadius: 6,
    padding: 12,
    marginTop: 8,
  },
  modalCloseText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default ServiceStatusIndicator;