// Safe Text-to-Speech Service for CreativeBridge
// Provides audio accessibility with proper fallback handling

import { Platform } from 'react-native';
import { GradeLevel } from '../types';

// Narrow `unknown` errors thrown from native modules / Promise.race timeouts
// to a printable string without using `any` or widening.
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  try {
    return String(error);
  } catch {
    return 'Unknown error';
  }
}

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

// Safe TTS wrapper that prevents native module errors
class SafeTextToSpeechService {
  private isInitialized = false;
  private isAvailable = false;
  private Tts: any = null;
  private availableVoices: VoiceProfile[] = [];
  private currentOptions: SpeechOptions = {
    rate: 0.5,
    pitch: 1.0,
    language: 'en-US',
  };

  // Initialize TTS service with safe loading
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Detect if we can safely load the TTS module
      const canUseTTS = await this.checkTTSAvailability();

      if (!canUseTTS) {
        console.log('⚠️ TTS not available in current environment');
        this.isAvailable = false;
        this.Tts = null;
        this.isInitialized = true;
        return;
      }

      // Try to load TTS module safely
      this.Tts = await this.loadTTSModule();

      if (this.Tts) {
        await this.initializeTTSModule();
        console.log('✅ TTS initialized successfully');
      } else {
        console.log('⚠️ TTS module could not be loaded');
      }

      this.isInitialized = true;
    } catch (error) {
      console.warn('❌ TTS initialization failed:', getErrorMessage(error));
      this.isAvailable = false;
      this.isInitialized = true;
    }
  }

  // Check if TTS can be safely loaded
  private async checkTTSAvailability(): Promise<boolean> {
    // Skip TTS in simulator to prevent native module errors
    if (Platform.OS === 'ios' && __DEV__) {
      return false;
    }

    // Check if react-native-tts is available without importing it
    try {
      const { NativeModules } = require('react-native');
      return NativeModules.TextToSpeech !== undefined;
    } catch {
      return false;
    }
  }

  // Safely load the TTS module
  private async loadTTSModule(): Promise<any> {
    try {
      // Only require if we know it's safe
      return require('react-native-tts');
    } catch (error) {
      console.warn('Could not load TTS module:', getErrorMessage(error));
      return null;
    }
  }

  // Initialize the loaded TTS module
  private async initializeTTSModule(): Promise<void> {
    if (!this.Tts) return;

    try {
      // Test basic functionality with timeout
      await Promise.race([
        this.Tts.getInitStatus(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Init timeout')), 3000),
        ),
      ]);

      this.isAvailable = true;

      // Try to get voices
      try {
        const voices = await Promise.race([
          this.Tts.voices(),
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
        console.warn('Could not load voices:', getErrorMessage(voicesError));
        this.availableVoices = [];
      }

      // Set default settings
      await this.setDefaultSettings();
    } catch (initError) {
      console.warn('TTS module init failed:', getErrorMessage(initError));
      this.isAvailable = false;
      this.Tts = null;
    }
  }

  // Check if TTS is available
  public isServiceAvailable(): boolean {
    return this.isAvailable && this.Tts !== null;
  }

  // Set speech options based on grade level
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

  // Speak text with fallback
  public async speak(
    text: string,
    options?: Partial<SpeechOptions>,
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.isServiceAvailable()) {
      console.log(
        '📢 TTS not available, would speak:',
        text.substring(0, 50) + '...',
      );
      return;
    }

    try {
      if (options) {
        const tempOptions = { ...this.currentOptions, ...options };
        await this.applySpeechSettings(tempOptions);
      }

      const cleanText = this.preprocessTextForSpeech(text);
      console.log('🔊 Speaking:', cleanText.substring(0, 50) + '...');
      await this.Tts.speak(cleanText);
    } catch (error) {
      console.error('❌ Speech failed:', getErrorMessage(error));
    }
  }

  // Stop speech
  public async stop(): Promise<void> {
    if (!this.isServiceAvailable()) return;

    try {
      await this.Tts.stop();
    } catch (error) {
      console.error('Stop failed:', getErrorMessage(error));
    }
  }

  // Pause speech
  public async pause(): Promise<void> {
    if (!this.isServiceAvailable()) return;

    try {
      await this.Tts.pause();
    } catch (error) {
      console.error('Pause failed:', getErrorMessage(error));
    }
  }

  // Resume speech
  public async resume(): Promise<void> {
    if (!this.isServiceAvailable()) return;

    try {
      await this.Tts.resume();
    } catch (error) {
      console.error('Resume failed:', getErrorMessage(error));
    }
  }

  // Check if speaking
  public async isSpeaking(): Promise<boolean> {
    if (!this.isServiceAvailable()) return false;

    try {
      return await this.Tts.isSpeaking();
    } catch (error) {
      console.error('isSpeaking check failed:', getErrorMessage(error));
      return false;
    }
  }

  // Get available voices
  public getAvailableVoices(): VoiceProfile[] {
    return this.availableVoices;
  }

  // Set voice
  public async setVoice(voiceId: string): Promise<void> {
    this.currentOptions.voice = voiceId;

    if (!this.isServiceAvailable()) return;

    try {
      await this.Tts.setDefaultVoice(voiceId);
    } catch (error) {
      console.error('setVoice failed:', getErrorMessage(error));
    }
  }

  // Get best voice for grade level
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

  // Speak story content with expression
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

  // Add audio cues
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

  // Set up event listeners (safe version)
  public setupEventListeners(callbacks: {
    onStart?: () => void;
    onFinish?: () => void;
    onCancel?: () => void;
    onError?: (error: any) => void;
  }): void {
    if (!this.isServiceAvailable()) return;

    try {
      if (callbacks.onStart) {
        this.Tts.addEventListener('tts-start', callbacks.onStart);
      }
      if (callbacks.onFinish) {
        this.Tts.addEventListener('tts-finish', callbacks.onFinish);
      }
      if (callbacks.onCancel) {
        this.Tts.addEventListener('tts-cancel', callbacks.onCancel);
      }
      if (callbacks.onError) {
        this.Tts.addEventListener('tts-error', callbacks.onError);
      }
    } catch (error) {
      console.warn(
        'Could not set up TTS event listeners:',
        getErrorMessage(error),
      );
    }
  }

  // Remove all listeners (safe version)
  public removeAllListeners(): void {
    if (!this.isServiceAvailable()) return;

    try {
      this.Tts.removeAllListeners('tts-start');
      this.Tts.removeAllListeners('tts-finish');
      this.Tts.removeAllListeners('tts-cancel');
      this.Tts.removeAllListeners('tts-error');
    } catch (error) {
      console.warn('Could not remove TTS listeners:', getErrorMessage(error));
    }
  }

  // Private helper methods
  private async setDefaultSettings(): Promise<void> {
    if (!this.isServiceAvailable()) return;

    try {
      await this.Tts.setDefaultRate(this.currentOptions.rate || 0.5);
      await this.Tts.setDefaultPitch(this.currentOptions.pitch || 1.0);
      await this.Tts.setDefaultLanguage(
        this.currentOptions.language || 'en-US',
      );
    } catch (error) {
      console.error('setDefaultSettings failed:', getErrorMessage(error));
    }
  }

  private async applySpeechSettings(options?: SpeechOptions): Promise<void> {
    if (!this.isServiceAvailable()) return;

    const settings = options || this.currentOptions;

    try {
      if (settings.rate !== undefined) {
        await this.Tts.setDefaultRate(settings.rate);
      }
      if (settings.pitch !== undefined) {
        await this.Tts.setDefaultPitch(settings.pitch);
      }
      if (settings.language !== undefined) {
        await this.Tts.setDefaultLanguage(settings.language);
      }
      if (settings.voice !== undefined) {
        await this.Tts.setDefaultVoice(settings.voice);
      }
    } catch (error) {
      console.error('applySpeechSettings failed:', getErrorMessage(error));
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

export const textToSpeechService = new SafeTextToSpeechService();
export default SafeTextToSpeechService;
