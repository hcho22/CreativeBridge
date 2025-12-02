/**
 * Native Speech Recognizer Service
 *
 * Provides a TypeScript wrapper around the native iOS SpeechRecognizerModule.
 * Falls back to null on non-iOS platforms (use @react-native-voice/voice for Android).
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

// Types
export interface SpeechRecognizerPermissions {
  microphone: boolean;
  speechRecognition: boolean;
  granted: boolean;
}

export interface SpeechRecognizerResultEvent {
  text: string;
  isFinal: boolean;
}

export interface SpeechRecognizerErrorEvent {
  code: string;
  message: string;
}

export interface SpeechRecognizerStateEvent {
  state: 'idle' | 'listening' | 'processing';
}

export type SpeechRecognizerEventType =
  | 'SpeechRecognizerResult'
  | 'SpeechRecognizerPartialResult'
  | 'SpeechRecognizerError'
  | 'SpeechRecognizerStateChange';

// Native module interface
interface NativeSpeechRecognizerModule {
  requestPermissions(): Promise<SpeechRecognizerPermissions>;
  checkPermissions(): Promise<SpeechRecognizerPermissions>;
  isAvailable(): Promise<boolean>;
  startDictation(locale: string): Promise<boolean>;
  stopDictation(): Promise<boolean>;
  cancelDictation(): Promise<boolean>;
}

// Check if native module is available (iOS only)
const isModuleAvailable =
  Platform.OS === 'ios' && NativeModules.SpeechRecognizerModule;

// Get the native module or null
const SpeechRecognizerNativeModule: NativeSpeechRecognizerModule | null =
  isModuleAvailable ? NativeModules.SpeechRecognizerModule : null;

// Create event emitter if module is available
const eventEmitter: NativeEventEmitter | null = SpeechRecognizerNativeModule
  ? new NativeEventEmitter(NativeModules.SpeechRecognizerModule)
  : null;

/**
 * Native Speech Recognizer Service
 *
 * Provides speech recognition using iOS native SFSpeechRecognizer API.
 * This is only available on iOS. For Android, use @react-native-voice/voice.
 */
class NativeSpeechRecognizerService {
  private listeners: Map<string, any[]> = new Map();
  private eventSubscriptions: any[] = [];

  /**
   * Check if the native speech recognizer is available
   * Returns false on non-iOS platforms
   */
  isModuleAvailable(): boolean {
    return isModuleAvailable;
  }

  /**
   * Check if speech recognition is available on this device
   */
  async isAvailable(): Promise<boolean> {
    if (!SpeechRecognizerNativeModule) {
      console.log(
        '[NativeSpeechRecognizer] Module not available (non-iOS platform)',
      );
      return false;
    }

    try {
      return await SpeechRecognizerNativeModule.isAvailable();
    } catch (error) {
      console.error(
        '[NativeSpeechRecognizer] Error checking availability:',
        error,
      );
      return false;
    }
  }

  /**
   * Request microphone and speech recognition permissions
   */
  async requestPermissions(): Promise<SpeechRecognizerPermissions> {
    if (!SpeechRecognizerNativeModule) {
      return { microphone: false, speechRecognition: false, granted: false };
    }

    try {
      return await SpeechRecognizerNativeModule.requestPermissions();
    } catch (error) {
      console.error(
        '[NativeSpeechRecognizer] Error requesting permissions:',
        error,
      );
      return { microphone: false, speechRecognition: false, granted: false };
    }
  }

  /**
   * Check current permission status
   */
  async checkPermissions(): Promise<SpeechRecognizerPermissions> {
    if (!SpeechRecognizerNativeModule) {
      return { microphone: false, speechRecognition: false, granted: false };
    }

    try {
      return await SpeechRecognizerNativeModule.checkPermissions();
    } catch (error) {
      console.error(
        '[NativeSpeechRecognizer] Error checking permissions:',
        error,
      );
      return { microphone: false, speechRecognition: false, granted: false };
    }
  }

  /**
   * Start speech recognition/dictation
   * @param locale The locale for speech recognition (e.g., 'en-US')
   */
  async startDictation(locale: string = 'en-US'): Promise<boolean> {
    if (!SpeechRecognizerNativeModule) {
      console.warn(
        '[NativeSpeechRecognizer] Cannot start dictation - module not available',
      );
      return false;
    }

    try {
      console.log(
        '[NativeSpeechRecognizer] Starting dictation with locale:',
        locale,
      );
      return await SpeechRecognizerNativeModule.startDictation(locale);
    } catch (error: any) {
      console.error(
        '[NativeSpeechRecognizer] Error starting dictation:',
        error,
      );
      throw error;
    }
  }

  /**
   * Stop speech recognition and get final result
   */
  async stopDictation(): Promise<boolean> {
    if (!SpeechRecognizerNativeModule) {
      return false;
    }

    try {
      console.log('[NativeSpeechRecognizer] Stopping dictation');
      return await SpeechRecognizerNativeModule.stopDictation();
    } catch (error) {
      console.error(
        '[NativeSpeechRecognizer] Error stopping dictation:',
        error,
      );
      throw error;
    }
  }

  /**
   * Cancel speech recognition without getting result
   */
  async cancelDictation(): Promise<boolean> {
    if (!SpeechRecognizerNativeModule) {
      return false;
    }

    try {
      console.log('[NativeSpeechRecognizer] Cancelling dictation');
      return await SpeechRecognizerNativeModule.cancelDictation();
    } catch (error) {
      console.error(
        '[NativeSpeechRecognizer] Error cancelling dictation:',
        error,
      );
      throw error;
    }
  }

  /**
   * Add event listener for speech recognition events
   */
  addListener(
    eventType: SpeechRecognizerEventType,
    callback: (event: any) => void,
  ): () => void {
    if (!eventEmitter) {
      console.warn(
        '[NativeSpeechRecognizer] Cannot add listener - module not available',
      );
      return () => {};
    }

    const subscription = eventEmitter.addListener(eventType, callback);
    this.eventSubscriptions.push(subscription);

    // Return unsubscribe function
    return () => {
      subscription.remove();
      const index = this.eventSubscriptions.indexOf(subscription);
      if (index > -1) {
        this.eventSubscriptions.splice(index, 1);
      }
    };
  }

  /**
   * Add listener for final speech results
   */
  onResult(callback: (event: SpeechRecognizerResultEvent) => void): () => void {
    return this.addListener('SpeechRecognizerResult', callback);
  }

  /**
   * Add listener for partial speech results
   */
  onPartialResult(
    callback: (event: SpeechRecognizerResultEvent) => void,
  ): () => void {
    return this.addListener('SpeechRecognizerPartialResult', callback);
  }

  /**
   * Add listener for speech recognition errors
   */
  onError(callback: (event: SpeechRecognizerErrorEvent) => void): () => void {
    return this.addListener('SpeechRecognizerError', callback);
  }

  /**
   * Add listener for state changes
   */
  onStateChange(
    callback: (event: SpeechRecognizerStateEvent) => void,
  ): () => void {
    return this.addListener('SpeechRecognizerStateChange', callback);
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.eventSubscriptions.forEach(subscription => {
      try {
        subscription.remove();
      } catch (error) {
        // Ignore errors during cleanup
      }
    });
    this.eventSubscriptions = [];
    this.listeners.clear();
  }
}

// Export singleton instance
export const nativeSpeechRecognizer = new NativeSpeechRecognizerService();

// Export class for testing
export { NativeSpeechRecognizerService };
