/**
 * Haptic Feedback Service (Task 2.6)
 * Provides tactile feedback for download operations and user interactions
 */

import { Vibration, Platform } from 'react-native';

export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

export interface HapticConfig {
  enabled: boolean;
  downloadStart: boolean;
  downloadComplete: boolean;
  downloadError: boolean;
  buttonPress: boolean;
  progressMilestones: boolean;
  errorRecovery: boolean;
}

export class HapticFeedbackService {
  private config: HapticConfig = {
    enabled: true,
    downloadStart: true,
    downloadComplete: true,
    downloadError: true,
    buttonPress: true,
    progressMilestones: false, // Disabled by default to avoid spam
    errorRecovery: true,
  };

  private isSupported: boolean = Platform.OS === 'ios';
  private lastHapticTime: number = 0;
  private readonly HAPTIC_COOLDOWN = 100; // Minimum time between haptics in ms

  /**
   * Initialize haptic feedback service
   */
  initialize(): void {
    console.log(`📳 Haptic Feedback Service initialized - Supported: ${this.isSupported ? 'yes' : 'no'}`);
  }

  /**
   * Trigger haptic feedback for download start
   */
  downloadStarted(): void {
    if (this.config.enabled && this.config.downloadStart) {
      this.triggerHaptic('light');
      console.log('📳 Haptic: Download started');
    }
  }

  /**
   * Trigger haptic feedback for download completion
   */
  downloadCompleted(success: boolean = true): void {
    if (!this.config.enabled) return;

    if (success && this.config.downloadComplete) {
      this.triggerHaptic('success');
      console.log('📳 Haptic: Download completed successfully');
    } else if (!success && this.config.downloadError) {
      this.triggerHaptic('error');
      console.log('📳 Haptic: Download failed');
    }
  }

  /**
   * Trigger haptic feedback for download progress milestones
   */
  downloadProgress(progress: number): void {
    if (!this.config.enabled || !this.config.progressMilestones) return;

    // Only trigger at major milestones to avoid overwhelming the user
    const milestones = [25, 50, 75];
    if (milestones.includes(Math.round(progress))) {
      this.triggerHaptic('light');
      console.log(`📳 Haptic: Download progress ${progress}%`);
    }
  }

  /**
   * Trigger haptic feedback for button presses
   */
  buttonPressed(buttonType: 'primary' | 'secondary' | 'destructive' = 'primary'): void {
    if (!this.config.enabled || !this.config.buttonPress) return;

    const hapticType = buttonType === 'destructive' ? 'warning' : 'selection';
    this.triggerHaptic(hapticType);
    console.log(`📳 Haptic: Button pressed (${buttonType})`);
  }

  /**
   * Trigger haptic feedback for error recovery actions
   */
  errorRecoveryAction(actionType: 'automatic' | 'manual' = 'manual'): void {
    if (!this.config.enabled || !this.config.errorRecovery) return;

    const hapticType = actionType === 'automatic' ? 'light' : 'medium';
    this.triggerHaptic(hapticType);
    console.log(`📳 Haptic: Error recovery action (${actionType})`);
  }

  /**
   * Trigger haptic feedback for critical alerts
   */
  criticalAlert(): void {
    if (!this.config.enabled) return;

    this.triggerHaptic('error');
    console.log('📳 Haptic: Critical alert');
  }

  /**
   * Trigger haptic feedback for success confirmations
   */
  successConfirmation(): void {
    if (!this.config.enabled) return;

    this.triggerHaptic('success');
    console.log('📳 Haptic: Success confirmation');
  }

  /**
   * Trigger haptic feedback for navigation actions
   */
  navigationAction(actionType: 'open' | 'close' | 'swipe' = 'open'): void {
    if (!this.config.enabled) return;

    this.triggerHaptic('light');
    console.log(`📳 Haptic: Navigation ${actionType}`);
  }

  /**
   * Trigger custom haptic pattern
   */
  customPattern(pattern: number[]): void {
    if (!this.config.enabled || !this.isSupported) return;

    try {
      Vibration.vibrate(pattern);
      console.log('📳 Haptic: Custom pattern triggered');
    } catch (error) {
      console.warn('⚠️ Failed to trigger custom haptic pattern:', error);
    }
  }

  /**
   * Set haptic configuration
   */
  setConfig(config: Partial<HapticConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('📳 Haptic config updated:', this.config);
  }

  /**
   * Get current haptic configuration
   */
  getConfig(): HapticConfig {
    return { ...this.config };
  }

  /**
   * Check if haptic feedback is supported on this device
   */
  isHapticSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Enable or disable all haptic feedback
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    console.log(`📳 Haptic feedback ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Private methods

  /**
   * Core haptic triggering method with iOS optimization
   */
  private triggerHaptic(pattern: HapticPattern): void {
    if (!this.config.enabled || !this.isSupported) return;

    const now = Date.now();
    if (now - this.lastHapticTime < this.HAPTIC_COOLDOWN) {
      return; // Prevent haptic spam
    }

    this.lastHapticTime = now;

    try {
      if (Platform.OS === 'ios') {
        this.triggerIOSHaptic(pattern);
      } else {
        this.triggerAndroidVibration(pattern);
      }
    } catch (error) {
      console.warn('⚠️ Failed to trigger haptic feedback:', error);
    }
  }

  /**
   * iOS-specific haptic feedback using UIImpactFeedbackGenerator patterns
   */
  private triggerIOSHaptic(pattern: HapticPattern): void {
    // Note: In a real implementation, you would use react-native-haptic-feedback
    // or a similar library for precise iOS haptic control
    const hapticPatterns: Record<HapticPattern, number[]> = {
      light: [50],
      medium: [100],
      heavy: [200],
      success: [50, 50, 100],
      warning: [100, 100],
      error: [200, 100, 200],
      selection: [25],
    };

    const vibrationPattern = hapticPatterns[pattern] || hapticPatterns.light;
    Vibration.vibrate(vibrationPattern);
  }

  /**
   * Android-specific vibration patterns
   */
  private triggerAndroidVibration(pattern: HapticPattern): void {
    const androidPatterns: Record<HapticPattern, number[]> = {
      light: [0, 50],
      medium: [0, 100],
      heavy: [0, 200],
      success: [0, 50, 50, 50, 50, 100],
      warning: [0, 100, 100, 100],
      error: [0, 200, 100, 200, 100, 200],
      selection: [0, 25],
    };

    const vibrationPattern = androidPatterns[pattern] || androidPatterns.light;
    Vibration.vibrate(vibrationPattern);
  }

  /**
   * Trigger contextual haptic feedback based on download state
   */
  downloadStateChanged(
    previousState: 'idle' | 'downloading' | 'completed' | 'error',
    newState: 'idle' | 'downloading' | 'completed' | 'error'
  ): void {
    if (!this.config.enabled) return;

    // Only trigger haptic on meaningful state transitions
    if (previousState === newState) return;

    switch (newState) {
      case 'downloading':
        if (previousState === 'idle') {
          this.downloadStarted();
        }
        break;
      
      case 'completed':
        this.downloadCompleted(true);
        break;
      
      case 'error':
        this.downloadCompleted(false);
        break;
      
      case 'idle':
        // No haptic needed for returning to idle state
        break;
    }
  }

  /**
   * Trigger haptic feedback for user interface interactions
   */
  uiInteraction(interaction: {
    type: 'tap' | 'longPress' | 'swipe' | 'pinch';
    element: 'button' | 'list' | 'modal' | 'tab';
    result: 'success' | 'error' | 'neutral';
  }): void {
    if (!this.config.enabled) return;

    let hapticType: HapticPattern;

    // Determine haptic type based on interaction
    switch (interaction.result) {
      case 'success':
        hapticType = 'light';
        break;
      case 'error':
        hapticType = 'warning';
        break;
      default:
        hapticType = 'selection';
        break;
    }

    // Adjust intensity based on interaction type
    if (interaction.type === 'longPress') {
      hapticType = 'medium';
    } else if (interaction.type === 'swipe') {
      hapticType = 'light';
    }

    this.triggerHaptic(hapticType);
    console.log(`📳 Haptic: UI interaction (${interaction.type} on ${interaction.element})`);
  }

  /**
   * Create haptic feedback sequence for complex operations
   */
  async playSequence(sequence: Array<{
    pattern: HapticPattern;
    delay: number;
  }>): Promise<void> {
    if (!this.config.enabled) return;

    for (const step of sequence) {
      this.triggerHaptic(step.pattern);
      if (step.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, step.delay));
      }
    }
  }

  /**
   * Pre-defined haptic sequences for common scenarios
   */
  async playPredefinedSequence(sequenceType: 'downloadSuccess' | 'downloadError' | 'operationComplete'): Promise<void> {
    const sequences = {
      downloadSuccess: [
        { pattern: 'light' as HapticPattern, delay: 0 },
        { pattern: 'success' as HapticPattern, delay: 100 },
      ],
      downloadError: [
        { pattern: 'error' as HapticPattern, delay: 0 },
        { pattern: 'warning' as HapticPattern, delay: 200 },
      ],
      operationComplete: [
        { pattern: 'medium' as HapticPattern, delay: 0 },
        { pattern: 'light' as HapticPattern, delay: 150 },
      ],
    };

    const sequence = sequences[sequenceType];
    if (sequence) {
      await this.playSequence(sequence);
      console.log(`📳 Haptic: Played sequence (${sequenceType})`);
    }
  }
}

// Export singleton instance
export const hapticFeedbackService = new HapticFeedbackService();
export default hapticFeedbackService;