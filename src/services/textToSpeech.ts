// Text-to-Speech Service for CreativeBridge
// Provides audio accessibility for generated content

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

class TextToSpeechService {
  private isInitialized = false;
  private isAvailable = false;
  private Tts: any = null;
  private availableVoices: VoiceProfile[] = [];
  private currentOptions: SpeechOptions = {
    rate: 0.5,
    pitch: 1.0,
    language: 'en-US',
  };

  // Initialize TTS service
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check if we're in a simulator environment
      const isSimulator = Platform.OS === 'ios' && __DEV__;

      if (isSimulator) {
        // Skip TTS initialization in simulator to avoid native module errors
        console.log(
          '⚠️ Running in simulator - TTS disabled to prevent native module errors',
        );
        this.isAvailable = false;
        this.Tts = null;
        this.isInitialized = true;
        return;
      }

      // Try to import and initialize react-native-tts for real devices
      try {
        // Use a more defensive approach to importing
        const TtsModule = require('react-native-tts');
        this.Tts = TtsModule;

        // Test if the native module is working
        if (this.Tts && typeof this.Tts.getInitStatus === 'function') {
          // Wrap in timeout to prevent hanging
          const initPromise = this.Tts.getInitStatus();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TTS init timeout')), 3000),
          );

          await Promise.race([initPromise, timeoutPromise]);
          this.isAvailable = true;

          // Get available voices with timeout
          const voicesPromise = this.Tts.voices();
          const voicesTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Voices timeout')), 2000),
          );

          try {
            const voices = await Promise.race([voicesPromise, voicesTimeout]);
            this.availableVoices = voices.map((voice: any) => ({
              id: voice.id,
              name: voice.name,
              language: voice.language,
              quality: voice.quality || 'normal',
            }));
          } catch (voicesError) {
            console.warn('⚠️ Could not load voices, using defaults');
            this.availableVoices = [];
          }

          // Set default speech settings
          await this.setDefaultSettings();

          console.log('✅ TTS initialized successfully');
        } else {
          throw new Error('TTS module methods not available');
        }
      } catch (importError) {
        console.warn('⚠️ TTS not available:', importError.message);
        this.isAvailable = false;
        this.Tts = null;
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize TTS:', error);
      this.isAvailable = false;
      this.isInitialized = true; // Mark as initialized even if failed
    }
  }

  // Check if TTS is available
  public isServiceAvailable(): boolean {
    return this.isAvailable && this.Tts !== null;
  }

  // Set speech options based on grade level
  public async setGradeLevelOptions(gradeLevel: GradeLevel): Promise<void> {
    const gradeSettings = {
      'K-2': { rate: 0.4, pitch: 1.1 }, // Slower, higher pitch for young learners
      '3-5': { rate: 0.5, pitch: 1.0 }, // Normal pace
      '6-8': { rate: 0.6, pitch: 0.95 }, // Slightly faster
      '9-12': { rate: 0.7, pitch: 0.9 }, // Faster, lower pitch
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

  // Speak text with optional custom options
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
      // Apply custom options if provided
      if (options) {
        const tempOptions = { ...this.currentOptions, ...options };
        await this.applySpeechSettings(tempOptions);
      }

      // Clean text for better speech
      const cleanText = this.preprocessTextForSpeech(text);

      console.log('🔊 Speaking text:', cleanText.substring(0, 50) + '...');
      await this.Tts.speak(cleanText);
    } catch (error) {
      console.error('❌ Failed to speak text:', error);
      // Don't throw error - gracefully degrade
    }
  }

  // Stop current speech
  public async stop(): Promise<void> {
    if (!this.isServiceAvailable()) return;

    try {
      await this.Tts.stop();
    } catch (error) {
      console.error('Failed to stop speech:', error);
    }
  }

  // Pause current speech
  public async pause(): Promise<void> {
    if (!this.isServiceAvailable()) return;

    try {
      await this.Tts.pause();
    } catch (error) {
      console.error('Failed to pause speech:', error);
    }
  }

  // Resume paused speech
  public async resume(): Promise<void> {
    if (!this.isServiceAvailable()) return;

    try {
      await this.Tts.resume();
    } catch (error) {
      console.error('Failed to resume speech:', error);
    }
  }

  // Check if TTS is currently speaking
  public async isSpeaking(): Promise<boolean> {
    if (!this.isServiceAvailable()) return false;

    try {
      return await this.Tts.isSpeaking();
    } catch (error) {
      console.error('Failed to check speaking status:', error);
      return false;
    }
  }

  // Get available voices
  public getAvailableVoices(): VoiceProfile[] {
    return this.availableVoices;
  }

  // Set specific voice
  public async setVoice(voiceId: string): Promise<void> {
    this.currentOptions.voice = voiceId;

    if (!this.isServiceAvailable()) return;

    try {
      await this.Tts.setDefaultVoice(voiceId);
    } catch (error) {
      console.error('Failed to set voice:', error);
    }
  }

  // Get best voice for grade level
  public getBestVoiceForGrade(gradeLevel: GradeLevel): VoiceProfile | null {
    // Prefer child-friendly voices for younger grades
    const isYoungGrade = gradeLevel === 'K-2' || gradeLevel === '3-5';

    const suitableVoices = this.availableVoices.filter(voice => {
      const lowerName = voice.name.toLowerCase();

      if (isYoungGrade) {
        // Look for child or female voices
        return (
          lowerName.includes('child') ||
          lowerName.includes('kids') ||
          lowerName.includes('female') ||
          lowerName.includes('woman')
        );
      } else {
        // Any clear voice is fine for older students
        return voice.quality === 'enhanced' || voice.quality === 'premium';
      }
    });

    return suitableVoices.length > 0
      ? suitableVoices[0]
      : this.availableVoices[0] || null;
  }

  // Speak story with expression
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

  // Add audio cues for story elements
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

  // Set up event listeners for TTS events
  public setupEventListeners(callbacks: {
    onStart?: () => void;
    onFinish?: () => void;
    onCancel?: () => void;
    onError?: (error: any) => void;
  }): void {
    if (!this.isServiceAvailable()) return;

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
  }

  // Remove all event listeners
  public removeAllListeners(): void {
    if (!this.isServiceAvailable()) return;

    this.Tts.removeAllListeners('tts-start');
    this.Tts.removeAllListeners('tts-finish');
    this.Tts.removeAllListeners('tts-cancel');
    this.Tts.removeAllListeners('tts-error');
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
      console.error('Failed to set default TTS settings:', error);
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
      console.error('Failed to apply speech settings:', error);
    }
  }

  private preprocessTextForSpeech(text: string): string {
    return (
      text
        // Add pauses for better narration
        .replace(/\./g, '. ')
        .replace(/,/g, ', ')
        .replace(/!/g, '! ')
        .replace(/\?/g, '? ')
        // Handle abbreviations
        .replace(/\bMr\./g, 'Mister')
        .replace(/\bMrs\./g, 'Missus')
        .replace(/\bDr\./g, 'Doctor')
        // Clean up extra spaces
        .replace(/\s+/g, ' ')
        .trim()
    );
  }
}

export const textToSpeechService = new TextToSpeechService();
export default TextToSpeechService;
