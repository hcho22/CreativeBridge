// Completely Isolated Text-to-Speech Service
// Prevents any native module loading in simulator environments

import { Platform } from 'react-native';
import { GradeLevel } from '../types';

export interface SpeechOptions {
  rate?: number;
  pitch?: number;
  language?: string;
  voice?: string;
}

export interface VoiceProfile {
  id: string;
  name: string;
  language: string;
  quality: string;
}

// Mock TTS implementation for simulators
class MockTTSService {
  private mockPausedState: boolean = false;

  async getInitStatus(): Promise<void> {
    throw new Error('Mock TTS - not available in simulator');
  }

  async voices(): Promise<VoiceProfile[]> {
    return [];
  }

  async speak(text: string): Promise<void> {
    console.log('🎤 [MOCK TTS] Would speak:', text);
    this.mockPausedState = false;
  }

  async stop(): Promise<void> {
    console.log('🛑 [MOCK TTS] Would stop');
    this.mockPausedState = false;
  }

  async pause(): Promise<void> {
    console.log('⏸️ [MOCK TTS] Would pause');
    this.mockPausedState = true;
  }

  async resume(): Promise<void> {
    console.log('▶️ [MOCK TTS] Would resume');
    this.mockPausedState = false;
  }

  async isSpeaking(): Promise<boolean> {
    return false;
  }

  isPaused(): boolean {
    return this.mockPausedState;
  }

  async setDefaultRate(rate: number): Promise<void> {
    console.log('🎚️ [MOCK TTS] Would set rate:', rate);
  }

  async setDefaultPitch(pitch: number): Promise<void> {
    console.log('🎚️ [MOCK TTS] Would set pitch:', pitch);
  }

  async setDefaultLanguage(language: string): Promise<void> {
    console.log('🌍 [MOCK TTS] Would set language:', language);
  }

  async setDefaultVoice(voiceId: string): Promise<void> {
    console.log('🗣️ [MOCK TTS] Would set voice:', voiceId);
  }

  addEventListener(event: string, _callback: () => void): void {
    console.log('👂 [MOCK TTS] Would add listener for:', event);
  }

  removeAllListeners(event: string): void {
    console.log('🚫 [MOCK TTS] Would remove listeners for:', event);
  }
}

// Environment detection utility
class EnvironmentDetector {
  static isSimulatorEnvironment(): boolean {
    // Try to detect simulator using native module constants
    // Note: __DEV__ is true in debug builds on physical devices too, so we can't use it alone
    try {
      const RN = require('react-native');
      const constants = RN.NativeModules?.PlatformConstants || {};

      // Check if we're in a testing environment
      if (constants.isTesting) {
        return true;
      }

      // For iOS, try to detect simulator by checking if we can access device-specific APIs
      // On simulator, some native modules may not be available
      if (Platform.OS === 'ios') {
        // If we can't detect reliably, we'll try to load TTS anyway and handle errors
        // This is safer than blocking it on physical devices
        return false;
      }
    } catch (error) {
      // If we can't check, assume it's a real device and try to load TTS
      if (__DEV__) {
        console.log(
          '🔊 [TTS] Could not detect environment, will attempt to load TTS',
        );
      }
      return false;
    }

    return false;
  }

  static canLoadNativeModules(): boolean {
    // Always try to load on physical devices - we'll handle errors gracefully
    // Only block if we're certain it's a simulator/test environment
    return !this.isSimulatorEnvironment();
  }
}

// Main TTS service with complete isolation
class IsolatedTextToSpeechService {
  private isInitialized = false;
  private isAvailable = false;
  private ttsModule: any = null;
  private availableVoices: VoiceProfile[] = [];
  private currentOptions: SpeechOptions = {
    rate: 0.5,
    pitch: 1.0,
    language: 'en-US',
  };
  // State tracking for pause/resume functionality
  private isPausedState: boolean = false;
  // Error callback for manual error handling (since tts-error event is not supported)
  private errorCallback?: (error: any) => void;
  // Flag to prevent re-entrant stop() calls
  private isStopping: boolean = false;

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      if (__DEV__) {
        console.log(
          '🔊 [TTS] Already initialized, isAvailable:',
          this.isAvailable,
        );
      }
      return;
    }

    try {
      const isSimulator = EnvironmentDetector.isSimulatorEnvironment();
      if (__DEV__) {
        console.log('🔊 [TTS] Initializing...', {
          platform: Platform.OS,
          isSimulator,
          canLoadNativeModules: EnvironmentDetector.canLoadNativeModules(),
        });
      }

      // Always try to load TTS - we'll handle errors gracefully
      // Only skip if we're certain it's a test/simulator environment
      const shouldSkip = !EnvironmentDetector.canLoadNativeModules();
      if (shouldSkip) {
        console.log(
          '🚫 TTS disabled in test/simulator environment to prevent native module errors',
        );
        this.ttsModule = new MockTTSService();
        this.isAvailable = false;
        this.isInitialized = true;
        return;
      }

      // Try to load real TTS module on all devices
      if (__DEV__) {
        console.log('🔊 [TTS] Attempting to load real TTS module...');
      }
      this.ttsModule = await this.loadRealTTSModule();

      if (this.ttsModule) {
        if (__DEV__) {
          console.log('🔊 [TTS] Real TTS module loaded, initializing...');
        }
        try {
          await this.initializeRealTTS();
          this.isAvailable = true;
          console.log('✅ Real TTS initialized successfully on device');
        } catch (initError) {
          console.warn(
            '⚠️ TTS initialization failed, falling back to mock:',
            initError,
          );
          this.ttsModule = new MockTTSService();
          this.isAvailable = false;
        }
      } else {
        if (__DEV__) {
          console.log('⚠️ TTS module not loaded, falling back to mock TTS');
        }
        this.ttsModule = new MockTTSService();
        this.isAvailable = false;
      }

      this.isInitialized = true;
      if (__DEV__) {
        console.log('🔊 [TTS] Initialization complete', {
          isAvailable: this.isAvailable,
          hasModule: !!this.ttsModule,
          isMock: this.ttsModule instanceof MockTTSService,
        });
      }
    } catch (error) {
      console.warn('❌ TTS initialization failed:', error);
      if (__DEV__) {
        console.error('🔊 [TTS] Initialization error details:', error);
      }
      this.ttsModule = new MockTTSService();
      this.isAvailable = false;
      this.isInitialized = true;
    }
  }

  private async loadRealTTSModule(): Promise<any> {
    try {
      // This should only be called on real devices
      if (__DEV__) {
        console.log('🔊 [TTS] Loading react-native-tts module...');
      }
      const TtsModule = require('react-native-tts');

      // Check if it's a default export
      const module = TtsModule.default || TtsModule;

      if (__DEV__) {
        console.log('🔊 [TTS] Module loaded successfully:', {
          hasModule: !!module,
          hasDefault: !!TtsModule.default,
          moduleKeys: Object.keys(module || {}).slice(0, 10),
          hasSpeak: typeof module.speak === 'function',
          hasSetDefaultRate: typeof module.setDefaultRate === 'function',
          hasSetDefaultPitch: typeof module.setDefaultPitch === 'function',
        });
      }
      return module;
    } catch (error) {
      console.warn('Could not load real TTS module:', error);
      if (__DEV__) {
        console.error('🔊 [TTS] Module load error:', error);
      }
      return null;
    }
  }

  private async initializeRealTTS(): Promise<void> {
    if (!this.ttsModule || this.ttsModule instanceof MockTTSService) {
      if (__DEV__) {
        console.log('🔊 [TTS] initializeRealTTS: Skipping - no valid module');
      }
      return;
    }

    try {
      if (__DEV__) {
        console.log('🔊 [TTS] initializeRealTTS: Starting initialization...');
      }

      // Check if getInitStatus exists - some versions of react-native-tts may not have it
      // IMPORTANT: On iOS, we MUST wait for getInitStatus to complete before speaking
      if (typeof this.ttsModule.getInitStatus === 'function') {
        // Test initialization with timeout - but don't fail silently
        try {
          const initResult = await Promise.race([
            this.ttsModule.getInitStatus(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('TTS init timeout')), 5000),
            ),
          ]);
          if (__DEV__) {
            console.log(
              '🔊 [TTS] getInitStatus completed successfully:',
              initResult,
            );
          }
        } catch (initStatusError) {
          // Log the error but continue - some versions might not need this
          console.warn(
            '⚠️ [TTS] getInitStatus failed or timed out:',
            initStatusError,
          );
          if (__DEV__) {
            console.log(
              '🔊 [TTS] Continuing despite getInitStatus failure - TTS may still work',
            );
          }
        }
      } else {
        if (__DEV__) {
          console.log('🔊 [TTS] getInitStatus not available, skipping');
        }
      }

      // Load voices (optional - TTS can work without voices)
      try {
        if (typeof this.ttsModule.voices === 'function') {
          const voices = await Promise.race([
            this.ttsModule.voices(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Voices timeout')), 2000),
            ),
          ]);

          this.availableVoices = voices.map((voice: any) => ({
            id: voice.id,
            name: voice.name,
            language: voice.language,
            quality: voice.quality || 'normal',
          }));
          if (__DEV__) {
            console.log('🔊 [TTS] Loaded voices:', this.availableVoices.length);
          }
        } else {
          if (__DEV__) {
            console.log('🔊 [TTS] voices() not available');
          }
          this.availableVoices = [];
        }
      } catch (voicesError) {
        console.warn('Could not load voices:', voicesError);
        this.availableVoices = [];
        // Don't throw - TTS can work without voices
      }

      // Set default settings
      await this.setDefaultSettings();
      if (__DEV__) {
        console.log('🔊 [TTS] initializeRealTTS: Completed successfully');
      }
    } catch (error) {
      console.warn('Real TTS initialization failed:', error);
      if (__DEV__) {
        console.error('🔊 [TTS] initializeRealTTS error details:', error);
      }
      throw error;
    }
  }

  public isServiceAvailable(): boolean {
    const available =
      this.isAvailable &&
      this.ttsModule &&
      !(this.ttsModule instanceof MockTTSService);
    if (__DEV__) {
      console.log('🔊 [TTS] isServiceAvailable check:', {
        available,
        isAvailable: this.isAvailable,
        hasModule: !!this.ttsModule,
        isMock: this.ttsModule instanceof MockTTSService,
        isInitialized: this.isInitialized,
      });
    }
    return available;
  }

  public async setGradeLevelOptions(gradeLevel: GradeLevel): Promise<void> {
    const gradeSettings = {
      'K-2': { rate: 0.4, pitch: 1.1 },
      '3-5': { rate: 0.5, pitch: 1.0 },
      '6-8': { rate: 0.6, pitch: 0.95 },
      '9-12': { rate: 0.7, pitch: 0.9 },
    };

    const settings = gradeSettings[gradeLevel] || gradeSettings['K-2'];

    this.currentOptions = {
      ...this.currentOptions,
      ...settings,
    };

    if (this.isServiceAvailable()) {
      await this.applySpeechSettings();
    }
  }

  public async speak(
    text: string,
    options?: Partial<SpeechOptions>,
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.ttsModule) {
      console.log('📢 No TTS module available');
      return;
    }

    try {
      // Reset pause state when starting new speech
      this.isPausedState = false;

      if (options) {
        const tempOptions = { ...this.currentOptions, ...options };
        await this.applySpeechSettings(tempOptions);
      }

      const cleanText = this.preprocessTextForSpeech(text);

      // Log what we're about to speak
      if (__DEV__) {
        console.log('🔊 [TTS] About to speak:', {
          originalLength: text.length,
          cleanedLength: cleanText.length,
          textPreview: cleanText.substring(0, 100) + '...',
          isEmpty: !cleanText.trim(),
        });
      }

      if (!cleanText.trim()) {
        console.error('❌ Speech failed: text is empty after preprocessing');
        this.isPausedState = false;
        return;
      }

      // Use module directly - react-native-tts may export differently
      // Try both direct access and default export
      let module = this.ttsModule;
      if (this.ttsModule.default) {
        module = this.ttsModule.default;
      }

      if (__DEV__) {
        console.log('🔊 [TTS] Module check:', {
          hasModule: !!this.ttsModule,
          hasDefault: !!this.ttsModule?.default,
          moduleType: typeof module,
          hasSpeak: typeof module?.speak === 'function',
          moduleKeys: module ? Object.keys(module).slice(0, 20) : [],
          allModuleKeys: module ? Object.keys(module) : [],
          moduleValue: module, // Log the actual module to see its structure
          speakFunction: module?.speak
            ? module.speak.toString().substring(0, 200)
            : 'not found',
          hasSetDefaultRate: typeof module?.setDefaultRate === 'function',
          hasSetDefaultPitch: typeof module?.setDefaultPitch === 'function',
          hasSetDefaultLanguage:
            typeof module?.setDefaultLanguage === 'function',
          hasGetInitStatus: typeof module?.getInitStatus === 'function',
          hasStop: typeof module?.stop === 'function',
          hasPause: typeof module?.pause === 'function',
          hasResume: typeof module?.resume === 'function',
        });
      }

      if (typeof module.speak !== 'function') {
        console.error(
          '❌ Speech failed: speak method not available on TTS module',
        );
        if (__DEV__) {
          console.error('🔊 [TTS] Module structure:', {
            hasModule: !!this.ttsModule,
            hasDefault: !!this.ttsModule?.default,
            moduleKeys: this.ttsModule
              ? Object.keys(this.ttsModule).slice(0, 15)
              : [],
            defaultKeys: this.ttsModule?.default
              ? Object.keys(this.ttsModule.default).slice(0, 15)
              : [],
            speakType: typeof module?.speak,
          });
        }
        this.isPausedState = false;
        return;
      }

      // Log the exact text being passed
      console.log('🔊 [TTS] About to call speak() with:', {
        textLength: cleanText.length,
        textPreview: cleanText.substring(0, 150),
        fullText: cleanText, // Log full text to verify it's not empty
        isEmpty: !cleanText.trim(),
      });

      // IMPORTANT: On iOS, ensure TTS is initialized before speaking
      // Wait for getInitStatus if available, but don't block if it's not
      if (typeof module.getInitStatus === 'function') {
        try {
          if (__DEV__) {
            console.log(
              '🔊 [TTS] Waiting for getInitStatus before speaking...',
            );
          }
          await Promise.race([
            module.getInitStatus(),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error('getInitStatus timeout')),
                2000,
              ),
            ),
          ]);
          if (__DEV__) {
            console.log(
              '🔊 [TTS] getInitStatus completed, proceeding with speak()',
            );
          }
        } catch (initError) {
          // If getInitStatus fails, log but continue - TTS might still work
          console.warn(
            '⚠️ [TTS] getInitStatus failed before speak(), continuing anyway:',
            initError,
          );
        }
      }

      // Call speak directly on the module
      // Note: react-native-tts speak() is non-blocking - it returns immediately
      // The actual speech happens asynchronously and we track it via event listeners
      try {
        if (__DEV__) {
          console.log('🔊 [TTS] Calling module.speak() now...');
          console.log('🔊 [TTS] Text to speak:', {
            length: cleanText.length,
            first50: cleanText.substring(0, 50),
            last50: cleanText.substring(Math.max(0, cleanText.length - 50)),
          });
        }

        // Try calling speak with just the text first (standard API)
        let result = module.speak(cleanText);

        if (__DEV__) {
          console.log('🔊 [TTS] speak() call result:', {
            resultType: typeof result,
            isPromise: result && typeof result.then === 'function',
            resultValue: result,
            hasResult: !!result,
          });
        }

        // If speak returns a promise, await it (some versions do, some don't)
        if (result && typeof result.then === 'function') {
          try {
            await result;
            if (__DEV__) {
              console.log('🔊 [TTS] speak() promise resolved successfully');
            }
          } catch (promiseError) {
            console.error('❌ speak() promise rejected:', promiseError);
            throw promiseError;
          }
        } else {
          if (__DEV__) {
            console.log(
              '🔊 [TTS] speak() returned immediately (non-blocking, speech continues in background)',
            );
            console.log(
              '🔊 [TTS] Waiting for tts-start event to confirm speech began...',
            );
          }
        }
      } catch (speakError) {
        console.error('❌ speak() call threw error:', speakError);
        if (__DEV__) {
          console.error('🔊 [TTS] speak() error details:', {
            error: speakError,
            errorMessage:
              speakError instanceof Error
                ? speakError.message
                : String(speakError),
            errorStack:
              speakError instanceof Error ? speakError.stack : undefined,
            hasModule: !!module,
            hasSpeak: typeof module?.speak === 'function',
          });
        }
        throw speakError;
      }
    } catch (error) {
      console.error('❌ Speech failed:', error);
      if (__DEV__) {
        console.error('🔊 [TTS] speak error details:', {
          error,
          hasModule: !!this.ttsModule,
          hasSpeak: typeof this.ttsModule?.speak === 'function',
          moduleKeys: this.ttsModule
            ? Object.keys(this.ttsModule).slice(0, 10)
            : [],
        });
      }
      this.isPausedState = false; // Reset on error
      // Call error callback if set (since tts-error event is not supported)
      if (this.errorCallback) {
        this.errorCallback(error);
      }
    }
  }

  public async stop(): Promise<void> {
    // Prevent re-entrant calls
    if (this.isStopping) {
      if (__DEV__) {
        console.log(
          '🔊 [TTS] stop() already in progress, ignoring duplicate call',
        );
      }
      return;
    }

    if (!this.ttsModule) {
      if (__DEV__) {
        console.log('🔊 [TTS] stop() called but no module available');
      }
      this.isPausedState = false;
      return;
    }

    this.isStopping = true;
    const module = this.ttsModule.default || this.ttsModule;

    try {
      if (__DEV__) {
        console.log('🔊 [TTS] Calling stop()...');
      }

      // Helper function to run with timeout
      const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), ms),
          ),
        ]);
      };

      // The native iOS stop() method has been patched to use BOOL instead of BOOL*
      // We pass false to use AVSpeechBoundaryImmediate (stop immediately)
      // If native patch is not applied, fallback approaches will be tried

      if (typeof module.stop === 'function') {
        // Primary approach: Call with false for immediate stop (AVSpeechBoundaryImmediate)
        if (__DEV__) {
          console.log(
            '🔊 [TTS] Calling module.stop(false) for immediate stop...',
          );
        }
        try {
          const stopResult = module.stop(false);

          if (stopResult && typeof stopResult.then === 'function') {
            await withTimeout(stopResult, 2000);
          }

          this.isPausedState = false;
          this.isStopping = false;
          if (__DEV__) {
            console.log(
              '🔊 [TTS] module.stop(false) succeeded - speech stopped immediately',
            );
          }
          return;
        } catch (stopError: any) {
          if (__DEV__) {
            console.log(
              '🔊 [TTS] module.stop(false) failed:',
              stopError?.message,
            );
          }
          // If this fails with "BOOL is unsupported", the native patch wasn't applied
          // Try fallback approaches
        }

        // Fallback: Try with no arguments
        if (__DEV__) {
          console.log('🔊 [TTS] Trying module.stop() with no arguments...');
        }
        try {
          const stopResult = module.stop();

          if (stopResult && typeof stopResult.then === 'function') {
            await withTimeout(stopResult, 2000);
          }

          this.isPausedState = false;
          this.isStopping = false;
          if (__DEV__) {
            console.log('🔊 [TTS] module.stop() succeeded');
          }
          return;
        } catch (stopError: any) {
          if (__DEV__) {
            console.log('🔊 [TTS] module.stop() failed:', stopError?.message);
          }
        }
      }

      // Last resort for iOS: Try using pause as a stop workaround
      if (Platform.OS === 'ios' && typeof module.pause === 'function') {
        try {
          if (__DEV__) {
            console.log('🔊 [TTS] iOS: Trying pause() as stop workaround...');
          }
          const pauseResult = module.pause(false);
          if (pauseResult && typeof pauseResult.then === 'function') {
            await withTimeout(pauseResult, 1000).catch(() => {});
          }
          this.isPausedState = false;
          this.isStopping = false;
          if (__DEV__) {
            console.log(
              '🔊 [TTS] iOS pause(false) succeeded - speech paused immediately',
            );
          }
          return;
        } catch (pauseError: any) {
          if (__DEV__) {
            console.log('🔊 [TTS] iOS pause() failed:', pauseError?.message);
          }
        }
      }

      // If we get here, all approaches failed
      this.isPausedState = false;
      this.isStopping = false;
      if (__DEV__) {
        console.log('🔊 [TTS] Could not stop speech - all approaches failed');
        console.log(
          '🔊 [TTS] NOTE: Apply the patch at patches/react-native-tts+4.1.1.patch to fix this',
        );
      }
    } catch (error: any) {
      // Stop errors are non-critical - speech may have already finished
      console.warn('⚠️ [TTS] stop() failed:', error?.message);
      this.isPausedState = false;
      this.isStopping = false;
    }
  }

  public async pause(): Promise<void> {
    // Prevent crashes by checking module availability first
    if (!this.ttsModule) {
      if (__DEV__) {
        console.log('🔊 [TTS] pause() called but no module available');
      }
      return;
    }

    const module = this.ttsModule.default || this.ttsModule;

    // Check if we're actually speaking before attempting to pause
    // Use internal state if isSpeaking method doesn't exist
    try {
      const speaking = await this.isSpeaking();
      if (!speaking) {
        if (__DEV__) {
          console.log('⚠️ Cannot pause - not currently speaking');
        }
        return;
      }
    } catch (error) {
      // If isSpeaking fails, assume we're speaking if state says so
      if (__DEV__) {
        console.warn(
          '🔊 [TTS] Could not check speaking state, attempting pause anyway',
        );
      }
    }

    try {
      // Check if pause method exists
      if (typeof module.pause !== 'function') {
        if (__DEV__) {
          console.warn('🔊 [TTS] pause method not available');
        }
        // Don't use stop as fallback on iOS - it crashes
        if (Platform.OS !== 'ios' && typeof module.stop === 'function') {
          const stopMethod = module.stop;
          await stopMethod.call(module);
        }
        this.isPausedState = false; // Stop resets pause state
        return;
      }

      // Platform-specific pause handling
      // NOTE: On iOS, pause() may also have bugs - wrap in extra try-catch
      if (Platform.OS === 'ios') {
        // iOS TTS pause support - but it may crash, so be extra defensive
        try {
          const pauseResult = module.pause();
          if (pauseResult && typeof pauseResult.then === 'function') {
            await pauseResult;
          }
          this.isPausedState = true;
          if (__DEV__) {
            console.log('⏸️ Speech paused');
          }
        } catch (iosPauseError: any) {
          // iOS pause may crash - catch and log, but don't throw to prevent app crashes
          // The native crash happens before our try-catch can catch it, so if we get here,
          // the pause actually failed but didn't crash (yet). We'll return gracefully.
          console.warn(
            '⚠️ [TTS] pause() failed on iOS:',
            iosPauseError?.message,
          );
          this.isPausedState = false;
          // Don't throw - return gracefully to prevent cascading errors
          // The UI state will be updated optimistically, which is better than crashing
          return;
        }
      } else if (Platform.OS === 'android') {
        // Android TTS pause support
        try {
          const pauseResult = module.pause();
          if (pauseResult && typeof pauseResult.then === 'function') {
            await pauseResult;
          }
          this.isPausedState = true;
          if (__DEV__) {
            console.log('⏸️ Speech paused');
          }
        } catch (androidPauseError) {
          console.warn(
            '⚠️ [TTS] pause() failed on Android:',
            androidPauseError,
          );
          this.isPausedState = false;
          throw androidPauseError; // Re-throw on Android as it should work
        }
      } else {
        // Fallback for other platforms
        console.warn('⚠️ Pause not supported on this platform');
        this.isPausedState = false;
      }
    } catch (error) {
      console.error('❌ Pause failed:', error);
      // On error, try to determine if pause actually worked
      // Some platforms may not support pause, so we'll reset state
      this.isPausedState = false;

      // If pause is not supported, log a warning but don't throw
      const pauseErrorMessage = error instanceof Error ? error.message : '';
      if (
        pauseErrorMessage.includes('not supported') ||
        pauseErrorMessage.includes('not available')
      ) {
        if (__DEV__) {
          console.warn('⚠️ Pause functionality not available on this device');
        }
      }
    }
  }

  public async resume(): Promise<void> {
    if (!this.ttsModule) return;

    // Check if we're actually paused before attempting to resume
    if (!this.isPausedState) {
      console.log('⚠️ Cannot resume - not currently paused');
      return;
    }

    try {
      // Platform-specific resume handling
      if (Platform.OS === 'ios') {
        // iOS TTS resume support
        await this.ttsModule.resume();
        this.isPausedState = false;
        console.log('▶️ Speech resumed');
      } else if (Platform.OS === 'android') {
        // Android TTS resume support
        await this.ttsModule.resume();
        this.isPausedState = false;
        console.log('▶️ Speech resumed');
      } else {
        // Fallback for other platforms
        console.warn('⚠️ Resume not supported on this platform');
        this.isPausedState = false;
      }
    } catch (error) {
      console.error('❌ Resume failed:', error);
      // Reset pause state on error
      this.isPausedState = false;

      // If resume is not supported, log a warning but don't throw
      const resumeErrorMessage = error instanceof Error ? error.message : '';
      if (
        resumeErrorMessage.includes('not supported') ||
        resumeErrorMessage.includes('not available')
      ) {
        console.warn('⚠️ Resume functionality not available on this device');
      }
    }
  }

  public async isSpeaking(): Promise<boolean> {
    if (!this.ttsModule) return false;

    try {
      const module = this.ttsModule.default || this.ttsModule;
      if (typeof module.isSpeaking === 'function') {
        return await module.isSpeaking();
      }
      // If isSpeaking doesn't exist, use our internal state
      return !this.isPausedState && this.isAvailable;
    } catch (error) {
      if (__DEV__) {
        console.warn(
          '🔊 [TTS] isSpeaking check failed, using internal state:',
          error,
        );
      }
      // Fallback to internal state if method doesn't exist
      return !this.isPausedState;
    }
  }

  // Check if speech is currently paused
  public isPaused(): boolean {
    return this.isPausedState;
  }

  public getAvailableVoices(): VoiceProfile[] {
    return this.availableVoices;
  }

  public async setVoice(voiceId: string): Promise<void> {
    this.currentOptions.voice = voiceId;

    if (!this.isServiceAvailable()) return;

    try {
      await this.ttsModule.setDefaultVoice(voiceId);
    } catch (error) {
      console.error('setVoice failed:', error);
    }
  }

  public getBestVoiceForGrade(gradeLevel: GradeLevel): VoiceProfile | null {
    const isYoungGrade = gradeLevel === 'K-2' || gradeLevel === '3-5';

    const suitableVoices = this.availableVoices.filter(voice => {
      const lowerName = voice.name.toLowerCase();

      if (isYoungGrade) {
        return (
          lowerName.includes('child') ||
          lowerName.includes('kids') ||
          lowerName.includes('female') ||
          lowerName.includes('woman')
        );
      } else {
        return voice.quality === 'enhanced' || voice.quality === 'premium';
      }
    });

    return suitableVoices.length > 0
      ? suitableVoices[0]
      : this.availableVoices[0] || null;
  }

  public async speakStoryContent(
    content: string,
    type: 'narrative' | 'dialogue' | 'action',
  ): Promise<void> {
    const expressionOptions: Record<string, Partial<SpeechOptions>> = {
      narrative: { rate: 0.5, pitch: 1.0 },
      dialogue: { rate: 0.6, pitch: 1.1 },
      action: { rate: 0.7, pitch: 0.95 },
    };

    await this.speak(content, expressionOptions[type]);
  }

  public async addAudioCue(
    cueType: 'story_start' | 'story_end' | 'user_turn' | 'ai_turn',
  ): Promise<void> {
    const cues = {
      story_start: "Let's begin our story!",
      story_end: 'The end! Great job on your story!',
      user_turn: 'Your turn to add to the story.',
      ai_turn: "Here's what happens next:",
    };

    const cueOptions: SpeechOptions = {
      rate: 0.6,
      pitch: 1.2,
      language: 'en-US',
    };

    await this.speak(cues[cueType], cueOptions);
  }

  public setupEventListeners(callbacks: {
    onStart?: () => void;
    onFinish?: () => void;
    onCancel?: () => void;
    onError?: (error: any) => void;
    onPause?: () => void;
    onResume?: () => void;
  }): void {
    if (!this.ttsModule || this.ttsModule instanceof MockTTSService) return;

    const module = this.ttsModule.default || this.ttsModule;

    try {
      // Remove existing listeners first to prevent duplicates
      if (typeof module.removeAllListeners === 'function') {
        module.removeAllListeners('tts-start');
        module.removeAllListeners('tts-finish');
        module.removeAllListeners('tts-cancel');
        // Note: tts-error is not a supported event type in react-native-tts
        module.removeAllListeners('tts-pause');
        module.removeAllListeners('tts-resume');
      }

      if (callbacks.onStart && typeof module.addEventListener === 'function') {
        module.addEventListener('tts-start', () => {
          this.isPausedState = false; // Reset pause state on start
          callbacks.onStart?.();
        });
      }
      if (callbacks.onFinish && typeof module.addEventListener === 'function') {
        module.addEventListener('tts-finish', () => {
          this.isPausedState = false; // Reset pause state on finish
          if (__DEV__) {
            console.log('🔊 [TTS] tts-finish event received');
          }
          callbacks.onFinish?.();
        });
      }
      if (callbacks.onCancel && typeof module.addEventListener === 'function') {
        module.addEventListener('tts-cancel', () => {
          this.isPausedState = false; // Reset pause state on cancel
          if (__DEV__) {
            console.log('🔊 [TTS] tts-cancel event received');
          }
          callbacks.onCancel?.();
        });
      }
      // Note: tts-error is not a supported event type in react-native-tts
      // Errors are handled via try/catch in the speak/pause/resume methods instead
      if (callbacks.onError) {
        // Store error callback for manual error handling
        // Errors will be caught in speak/pause/resume methods and passed to this callback
        this.errorCallback = callbacks.onError;
      }
      // Note: react-native-tts may not have pause/resume events
      // We track pause state manually in pause()/resume() methods
      if (callbacks.onPause && typeof module.addEventListener === 'function') {
        try {
          module.addEventListener('tts-pause', callbacks.onPause);
        } catch {
          // Event not supported, will be handled manually
        }
      }
      if (callbacks.onResume && typeof module.addEventListener === 'function') {
        try {
          module.addEventListener('tts-resume', callbacks.onResume);
        } catch {
          // Event not supported, will be handled manually
        }
      }
    } catch (error) {
      console.warn('Could not set up TTS event listeners:', error);
    }
  }

  public removeAllListeners(): void {
    if (!this.ttsModule || this.ttsModule instanceof MockTTSService) return;

    try {
      this.ttsModule.removeAllListeners('tts-start');
      this.ttsModule.removeAllListeners('tts-finish');
      this.ttsModule.removeAllListeners('tts-cancel');
      // Note: tts-error is not a supported event type
      // Try to remove pause/resume listeners if they exist
      try {
        this.ttsModule.removeAllListeners('tts-pause');
        this.ttsModule.removeAllListeners('tts-resume');
      } catch {
        // Events may not be supported, ignore
      }
    } catch (error) {
      console.warn('Could not remove TTS listeners:', error);
    }
  }

  private async setDefaultSettings(): Promise<void> {
    if (!this.isServiceAvailable()) return;

    // Skip setting default settings - the react-native-tts API has compatibility issues
    // with setDefaultRate/setDefaultPitch on iOS. Speech will work with system defaults.
    // This prevents "BOOL is unsupported" errors while still allowing speech to function.
    if (__DEV__) {
      console.log(
        '🔊 [TTS] Skipping setDefaultSettings - using system TTS defaults',
      );
    }
  }

  private async applySpeechSettings(options?: SpeechOptions): Promise<void> {
    if (!this.isServiceAvailable()) return;

    const settings = options || this.currentOptions;

    // Skip applying settings - the react-native-tts API seems to have issues with setDefaultRate
    // Speech will work with default settings, and we can pass options directly to speak() if needed
    // This prevents the "BOOL is unsupported" errors
    if (__DEV__) {
      console.log(
        '🔊 [TTS] Skipping applySpeechSettings - using default TTS settings',
      );
    }

    // Store settings for potential future use, but don't apply them via setDefault methods
    // The native module appears to have API compatibility issues
    this.currentOptions = { ...this.currentOptions, ...settings };
  }

  private preprocessTextForSpeech(text: string): string {
    if (!text || !text.trim()) {
      if (__DEV__) {
        console.warn('🔊 [TTS] preprocessTextForSpeech: input text is empty');
      }
      return '';
    }

    const processed = text
      .replace(/\./g, '. ')
      .replace(/,/g, ', ')
      .replace(/!/g, '! ')
      .replace(/\?/g, '? ')
      .replace(/\bMr\./g, 'Mister')
      .replace(/\bMrs\./g, 'Missus')
      .replace(/\bDr\./g, 'Doctor')
      .replace(/\s+/g, ' ')
      .trim();

    if (__DEV__) {
      console.log('🔊 [TTS] Text preprocessing:', {
        originalLength: text.length,
        processedLength: processed.length,
        originalPreview: text.substring(0, 50),
        processedPreview: processed.substring(0, 50),
      });
    }

    return processed;
  }
}

export const textToSpeechService = new IsolatedTextToSpeechService();
export default IsolatedTextToSpeechService;
