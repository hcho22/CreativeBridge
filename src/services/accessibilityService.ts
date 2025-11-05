/**
 * Accessibility Service (Task 2.6)
 * Provides comprehensive accessibility support for download features
 */

import { AccessibilityInfo, Alert } from 'react-native';

export interface AccessibilityAnnouncement {
  message: string;
  priority: 'low' | 'normal' | 'high';
  interrupt?: boolean;
}

export interface AccessibilityConfig {
  enableVoiceOver: boolean;
  enableHaptics: boolean;
  enableAudio: boolean;
  announceProgress: boolean;
  verboseDescriptions: boolean;
}

export class AccessibilityService {
  private isScreenReaderEnabled: boolean = false;
  private config: AccessibilityConfig = {
    enableVoiceOver: true,
    enableHaptics: true,
    enableAudio: true,
    announceProgress: true,
    verboseDescriptions: false,
  };

  /**
   * Initialize accessibility service
   */
  async initialize(): Promise<void> {
    try {
      // Check if screen reader is enabled
      this.isScreenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      
      // Listen for screen reader changes
      AccessibilityInfo.addEventListener('screenReaderChanged', this.handleScreenReaderChange.bind(this));

      console.log(`♿ Accessibility Service initialized - Screen reader: ${this.isScreenReaderEnabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('❌ Failed to initialize accessibility service:', error);
    }
  }

  /**
   * Cleanup accessibility service
   */
  cleanup(): void {
    AccessibilityInfo.removeEventListener('screenReaderChanged', this.handleScreenReaderChange);
  }

  /**
   * Announce message to screen readers
   */
  async announce(announcement: AccessibilityAnnouncement): Promise<void> {
    if (!this.config.enableVoiceOver || !this.isScreenReaderEnabled) {
      return;
    }

    try {
      await AccessibilityInfo.announceForAccessibility(announcement.message);
      console.log(`🔊 Accessibility announcement: ${announcement.message}`);
    } catch (error) {
      console.error('❌ Failed to make accessibility announcement:', error);
    }
  }

  /**
   * Get accessibility labels for download components
   */
  getDownloadButtonLabels(state: 'idle' | 'downloading' | 'completed' | 'error'): {
    accessibilityLabel: string;
    accessibilityHint: string;
    accessibilityRole: string;
    accessibilityState?: any;
  } {
    const baseRole = 'button';
    
    switch (state) {
      case 'idle':
        return {
          accessibilityLabel: 'Download Story',
          accessibilityHint: 'Saves your completed story as a text file to your device. Double-tap to start download.',
          accessibilityRole: baseRole,
          accessibilityState: { disabled: false },
        };
      
      case 'downloading':
        return {
          accessibilityLabel: 'Downloading Story',
          accessibilityHint: 'Story download is in progress. Please wait.',
          accessibilityRole: baseRole,
          accessibilityState: { disabled: true, busy: true },
        };
      
      case 'completed':
        return {
          accessibilityLabel: 'Download Complete',
          accessibilityHint: 'Story has been successfully downloaded to your device.',
          accessibilityRole: baseRole,
          accessibilityState: { disabled: false },
        };
      
      case 'error':
        return {
          accessibilityLabel: 'Download Failed - Retry',
          accessibilityHint: 'Story download failed. Double-tap to try again.',
          accessibilityRole: baseRole,
          accessibilityState: { disabled: false },
        };
      
      default:
        return {
          accessibilityLabel: 'Download Story',
          accessibilityHint: 'Download your story',
          accessibilityRole: baseRole,
        };
    }
  }

  /**
   * Get accessibility labels for progress indicators
   */
  getProgressLabels(progress: number, stage: string): {
    accessibilityLabel: string;
    accessibilityValue?: { min: number; max: number; now: number };
  } {
    const progressPercent = Math.round(progress);
    
    return {
      accessibilityLabel: `Download progress: ${progressPercent}% complete. Current stage: ${stage}`,
      accessibilityValue: {
        min: 0,
        max: 100,
        now: progressPercent,
      },
    };
  }

  /**
   * Get accessibility labels for download history items
   */
  getHistoryItemLabels(item: {
    fileName: string;
    storyTitle?: string;
    downloadDate: string;
    fileSize?: number;
    status: string;
  }): {
    accessibilityLabel: string;
    accessibilityHint: string;
    accessibilityRole: string;
  } {
    const dateFormatted = new Date(item.downloadDate).toLocaleDateString();
    const sizeFormatted = item.fileSize ? this.formatFileSize(item.fileSize) : '';
    
    const label = this.config.verboseDescriptions
      ? `Story: ${item.storyTitle || item.fileName}. Downloaded on ${dateFormatted}. File size: ${sizeFormatted}. Status: ${item.status}.`
      : `${item.storyTitle || item.fileName}, downloaded ${dateFormatted}`;

    const hint = item.status === 'success'
      ? 'Double-tap to view options: re-download, share, or delete.'
      : 'Download failed. Double-tap for retry options.';

    return {
      accessibilityLabel: label,
      accessibilityHint: hint,
      accessibilityRole: 'button',
    };
  }

  /**
   * Get accessibility labels for error recovery options
   */
  getErrorRecoveryLabels(option: {
    label: string;
    description: string;
    automated: boolean;
    priority: 'high' | 'medium' | 'low';
  }): {
    accessibilityLabel: string;
    accessibilityHint: string;
    accessibilityRole: string;
  } {
    const priorityText = option.priority === 'high' ? 'Recommended: ' : '';
    const automatedText = option.automated ? ' This action will be performed automatically.' : ' This requires manual action.';
    
    return {
      accessibilityLabel: `${priorityText}${option.label}`,
      accessibilityHint: `${option.description}${automatedText}`,
      accessibilityRole: 'button',
    };
  }

  /**
   * Announce download progress updates
   */
  async announceProgress(progress: number, stage: string, estimatedTime?: number): Promise<void> {
    if (!this.config.announceProgress) return;

    // Only announce at significant milestones to avoid spam
    const shouldAnnounce = progress === 0 || progress === 100 || progress % 25 === 0;
    
    if (shouldAnnounce) {
      let message = `Download ${Math.round(progress)}% complete`;
      
      if (stage && stage !== 'downloading') {
        message += `, ${stage}`;
      }
      
      if (estimatedTime && estimatedTime > 5) {
        const timeText = estimatedTime < 60 
          ? `${Math.round(estimatedTime)} seconds remaining`
          : `${Math.round(estimatedTime / 60)} minutes remaining`;
        message += `, ${timeText}`;
      }

      await this.announce({
        message,
        priority: progress === 100 ? 'high' : 'normal',
      });
    }
  }

  /**
   * Announce download completion with success details
   */
  async announceDownloadSuccess(fileName: string, fileSize?: number): Promise<void> {
    const sizeText = fileSize ? `, file size ${this.formatFileSize(fileSize)}` : '';
    const message = `Download completed successfully. File saved as ${fileName}${sizeText}. You can find it in your Downloads or Files app.`;

    await this.announce({
      message,
      priority: 'high',
    });
  }

  /**
   * Announce download error with recovery suggestions
   */
  async announceDownloadError(errorType: string, recoveryOptions: string[]): Promise<void> {
    let message = `Download failed: ${errorType}.`;
    
    if (recoveryOptions.length > 0) {
      message += ` Available recovery options: ${recoveryOptions.slice(0, 2).join(', ')}`;
      if (recoveryOptions.length > 2) {
        message += `, and ${recoveryOptions.length - 2} more options`;
      }
    }

    await this.announce({
      message,
      priority: 'high',
    });
  }

  /**
   * Set accessibility configuration
   */
  setConfig(config: Partial<AccessibilityConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('♿ Accessibility config updated:', this.config);
  }

  /**
   * Get current accessibility configuration
   */
  getConfig(): AccessibilityConfig {
    return { ...this.config };
  }

  /**
   * Check if screen reader is currently active
   */
  isScreenReaderActive(): boolean {
    return this.isScreenReaderEnabled;
  }

  /**
   * Get accessibility traits for different component states
   */
  getAccessibilityTraits(type: 'button' | 'progress' | 'text' | 'header', state?: any): string[] {
    const traits: string[] = [];

    switch (type) {
      case 'button':
        traits.push('button');
        if (state?.disabled) traits.push('disabled');
        if (state?.selected) traits.push('selected');
        break;
      
      case 'progress':
        traits.push('adjustable');
        if (state?.busy) traits.push('updatesFrequently');
        break;
      
      case 'header':
        traits.push('header');
        break;
      
      case 'text':
        traits.push('staticText');
        break;
    }

    return traits;
  }

  /**
   * Create accessible alert for critical notifications
   */
  async showAccessibleAlert(title: string, message: string, actions?: Array<{
    text: string;
    onPress: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>): Promise<void> {
    // Announce the alert for screen readers
    await this.announce({
      message: `Alert: ${title}. ${message}`,
      priority: 'high',
      interrupt: true,
    });

    // Show standard alert with accessibility support
    const alertActions = actions?.map(action => ({
      text: action.text,
      onPress: action.onPress,
      style: action.style,
    })) || [{ text: 'OK', style: 'default' as const }];

    return new Promise((resolve) => {
      Alert.alert(
        title,
        message,
        [
          ...alertActions,
          {
            text: alertActions.length === 1 ? 'OK' : 'Cancel',
            style: 'cancel',
            onPress: () => resolve(),
          },
        ],
        {
          cancelable: true,
          onDismiss: () => resolve(),
        }
      );
    });
  }

  /**
   * Generate accessible instructions for complex interactions
   */
  getInteractionInstructions(interaction: 'download' | 'progress' | 'history' | 'error'): string {
    switch (interaction) {
      case 'download':
        return 'To download your story: double-tap the Download Story button. You will be prompted to choose a save location.';
      
      case 'progress':
        return 'Download progress is displayed. The operation will complete automatically. You can cancel by double-tapping the Cancel button.';
      
      case 'history':
        return 'Your download history is displayed as a list. Swipe up or down to navigate. Double-tap any item to view options.';
      
      case 'error':
        return 'Download error recovery options are available. Swipe through options and double-tap to select your preferred recovery method.';
      
      default:
        return 'Use VoiceOver gestures to navigate. Double-tap to activate buttons.';
    }
  }

  // Private methods

  private handleScreenReaderChange(isEnabled: boolean): void {
    this.isScreenReaderEnabled = isEnabled;
    console.log(`♿ Screen reader ${isEnabled ? 'enabled' : 'disabled'}`);
    
    // Adjust configuration based on screen reader state
    if (isEnabled && !this.config.verboseDescriptions) {
      this.setConfig({ verboseDescriptions: true });
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  }
}

// Export singleton instance
export const accessibilityService = new AccessibilityService();
export default accessibilityService;