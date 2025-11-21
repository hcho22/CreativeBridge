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
    // Detect iOS simulator
    if (Platform.OS === 'ios' && __DEV__) {
      return true;
    }

    // Detect Android emulator
    if (Platform.OS === 'android' && __DEV__) {
      // Additional checks could be added here if needed
      return false; // For now, assume Android emulator can handle TTS
    }

    return false;
  }

  static canLoadNativeModules(): boolean {
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

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (!EnvironmentDetector.canLoadNativeModules()) {
        console.log(
          '🚫 TTS disabled in simulator environment to prevent native module errors',
        );
        this.ttsModule = new MockTTSService();
        this.isAvailable = false;
        this.isInitialized = true;
        return;
      }

      // Only try to load real TTS on devices
      this.ttsModule = await this.loadRealTTSModule();

      if (this.ttsModule) {
        await this.initializeRealTTS();
        this.isAvailable = true;
        console.log('✅ Real TTS initialized successfully on device');
      } else {
        this.ttsModule = new MockTTSService();
        this.isAvailable = false;
        console.log('⚠️ Falling back to mock TTS');
      }

      this.isInitialized = true;
    } catch (error) {
      console.warn('❌ TTS initialization failed:', error);
      this.ttsModule = new MockTTSService();
      this.isAvailable = false;
      this.isInitialized = true;
    }
  }

  private async loadRealTTSModule(): Promise<any> {
    try {
      // This should only be called on real devices
      const TtsModule = require('react-native-tts');
      return TtsModule;
    } catch (error) {
      console.warn('Could not load real TTS module:', error);
      return null;
    }
  }

  private async initializeRealTTS(): Promise<void> {
    if (!this.ttsModule || this.ttsModule instanceof MockTTSService) return;

    try {
      // Test initialization with timeout
      await Promise.race([
        this.ttsModule.getInitStatus(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('TTS init timeout')), 3000),
        ),
      ]);

      // Load voices
      try {
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
      } catch (voicesError) {
        console.warn('Could not load voices:', voicesError);
        this.availableVoices = [];
      }

      // Set default settings
      await this.setDefaultSettings();
    } catch (error) {
      console.warn('Real TTS initialization failed:', error);
      throw error;
    }
  }

  public isServiceAvailable(): boolean {
    return (
      this.isAvailable &&
      this.ttsModule &&
      !(this.ttsModule instanceof MockTTSService)
    );
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
      await this.ttsModule.speak(cleanText);
    } catch (error) {
      console.error('❌ Speech failed:', error);
      this.isPausedState = false; // Reset on error
    }
  }

  public async stop(): Promise<void> {
    if (!this.ttsModule) return;

    try {
      await this.ttsModule.stop();
      // Reset pause state when stopping
      this.isPausedState = false;
    } catch (error) {
      console.error('Stop failed:', error);
      this.isPausedState = false; // Reset on error
    }
  }

  public async pause(): Promise<void> {
    if (!this.ttsModule) return;

    // Check if we're actually speaking before attempting to pause
    const speaking = await this.isSpeaking();
    if (!speaking) {
      console.log('⚠️ Cannot pause - not currently speaking');
      return;
    }

    try {
      // Platform-specific pause handling
      if (Platform.OS === 'ios') {
        // iOS TTS pause support
        await this.ttsModule.pause();
        this.isPausedState = true;
        console.log('⏸️ Speech paused');
      } else if (Platform.OS === 'android') {
        // Android TTS pause support
        await this.ttsModule.pause();
        this.isPausedState = true;
        console.log('⏸️ Speech paused');
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
      if (
        error.message?.includes('not supported') ||
        error.message?.includes('not available')
      ) {
        console.warn('⚠️ Pause functionality not available on this device');
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
      if (
        error.message?.includes('not supported') ||
        error.message?.includes('not available')
      ) {
        console.warn('⚠️ Resume functionality not available on this device');
      }
    }
  }

  public async isSpeaking(): Promise<boolean> {
    if (!this.ttsModule) return false;

    try {
      return await this.ttsModule.isSpeaking();
    } catch (error) {
      console.error('isSpeaking check failed:', error);
      return false;
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

    try {
      if (callbacks.onStart) {
        this.ttsModule.addEventListener('tts-start', () => {
          this.isPausedState = false; // Reset pause state on start
          callbacks.onStart?.();
        });
      }
      if (callbacks.onFinish) {
        this.ttsModule.addEventListener('tts-finish', () => {
          this.isPausedState = false; // Reset pause state on finish
          callbacks.onFinish?.();
        });
      }
      if (callbacks.onCancel) {
        this.ttsModule.addEventListener('tts-cancel', () => {
          this.isPausedState = false; // Reset pause state on cancel
          callbacks.onCancel?.();
        });
      }
      if (callbacks.onError) {
        this.ttsModule.addEventListener('tts-error', (error: any) => {
          this.isPausedState = false; // Reset pause state on error
          callbacks.onError?.(error);
        });
      }
      // Note: react-native-tts may not have pause/resume events
      // We track pause state manually in pause()/resume() methods
      if (callbacks.onPause) {
        // If the library supports pause events, add listener
        // Otherwise, this will be handled manually
        try {
          this.ttsModule.addEventListener('tts-pause', callbacks.onPause);
        } catch {
          // Event not supported, will be handled manually
        }
      }
      if (callbacks.onResume) {
        try {
          this.ttsModule.addEventListener('tts-resume', callbacks.onResume);
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
      this.ttsModule.removeAllListeners('tts-error');
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

    try {
      await this.ttsModule.setDefaultRate(this.currentOptions.rate || 0.5);
      await this.ttsModule.setDefaultPitch(this.currentOptions.pitch || 1.0);
      await this.ttsModule.setDefaultLanguage(
        this.currentOptions.language || 'en-US',
      );
    } catch (error) {
      console.error('setDefaultSettings failed:', error);
    }
  }

  private async applySpeechSettings(options?: SpeechOptions): Promise<void> {
    if (!this.isServiceAvailable()) return;

    const settings = options || this.currentOptions;

    try {
      if (settings.rate !== undefined) {
        await this.ttsModule.setDefaultRate(settings.rate);
      }
      if (settings.pitch !== undefined) {
        await this.ttsModule.setDefaultPitch(settings.pitch);
      }
      if (settings.language !== undefined) {
        await this.ttsModule.setDefaultLanguage(settings.language);
      }
      if (settings.voice !== undefined) {
        await this.ttsModule.setDefaultVoice(settings.voice);
      }
    } catch (error) {
      console.error('applySpeechSettings failed:', error);
    }
  }

  private preprocessTextForSpeech(text: string): string {
    return text
      .replace(/\./g, '. ')
      .replace(/,/g, ', ')
      .replace(/!/g, '! ')
      .replace(/\?/g, '? ')
      .replace(/\bMr\./g, 'Mister')
      .replace(/\bMrs\./g, 'Missus')
      .replace(/\bDr\./g, 'Doctor')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export const textToSpeechService = new IsolatedTextToSpeechService();
export default IsolatedTextToSpeechService;
