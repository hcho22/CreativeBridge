import React, {
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { TabParamList } from '../navigation/AppNavigator';
import { storyAgentService } from '../services/storyAgent';
import { storyGenerationService } from '../services/storyGenerationService';
import { apiClient } from '../services/api';
import {
  storySessionManager,
  StorySession,
} from '../services/storySessionManager';
import { GradeLevel } from '../types';
import { textToSpeechService } from '../services/textToSpeechIsolated';
import { StoryInputDebouncer } from '../utils/debounceUtils';
import { extractLatestContinuation } from '../utils/storyUtils';
import { challengeService } from '../services/challengeService';
import { Challenge, ChallengeProgress } from '../types/challenges';
import ChallengeDisplay from '../components/common/ChallengeDisplay';
import ImageGeneration from '../components/common/ImageGeneration';
import StoryImageDisplay from '../components/common/StoryImageDisplay';
import { storyDownloadService } from '../services/storyDownloadService';
import RNFS, { rnfsWrapper } from '../utils/rnfsWrapper';
import { VoiceInput } from '../components/common/VoiceInput';
import Share from '../utils/shareWrapper';

type HomeScreenNavigationProp = BottomTabNavigationProp<TabParamList, 'Home'>;

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

interface LoadingState {
  isGenerating: boolean;
  isValidating: boolean;
  isSaving: boolean;
  generationProgress: number;
  currentTask: string;
}

interface GenerationError {
  type: 'network' | 'api' | 'validation' | 'unknown';
  message: string;
  suggestion: string;
  retryable: boolean;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { userProfile, user } = useAuth();
  const [isGameActive, setIsGameActive] = useState(false);
  const [currentSession, setCurrentSession] = useState<StorySession | null>(
    null,
  );
  const [userInput, setUserInput] = useState('');
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isGenerating: false,
    isValidating: false,
    isSaving: false,
    generationProgress: 0,
    currentTask: '',
  });
  const [generationError, setGenerationError] =
    useState<GenerationError | null>(null);
  const [spinValue] = useState(new Animated.Value(0));
  const [fadeValue] = useState(new Animated.Value(1));
  // Removed quality metrics for cleaner book format
  // Speaker button state: 'idle' | 'speaking' | 'paused'
  const [speakerState, setSpeakerState] = useState<
    'idle' | 'speaking' | 'paused'
  >('idle');
  // Keep isSpeaking for backward compatibility (derived from speakerState)
  // const isSpeaking = speakerState === 'speaking' || speakerState === 'paused'; // Currently unused
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(true);

  // Service availability state
  const [ttsServiceAvailable, setTtsServiceAvailable] = useState<
    boolean | null
  >(null);
  const [_sttServiceAvailable, _setSttServiceAvailable] = useState<
    boolean | null
  >(null);

  // Challenge system state
  const [currentChallenge, setCurrentChallenge] = useState<Challenge | null>(
    null,
  );
  const [challengeProgress, setChallengeProgress] = useState<
    ChallengeProgress[]
  >([]);
  const [inputDebouncer, setInputDebouncer] =
    useState<StoryInputDebouncer | null>(null);

  // Game round tracking
  const [currentRound, setCurrentRound] = useState(1);
  const [isGameCompleted, setIsGameCompleted] = useState(false);
  const [showCompletionOptions, setShowCompletionOptions] = useState(false);
  const [showImageGeneration, setShowImageGeneration] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null,
  );
  const MAX_ROUNDS = 5;

  // Use the user's preferred grade level from their profile, or default to K-2
  const gradeLevel: GradeLevel =
    (userProfile?.preferred_grade_level as GradeLevel) || 'K-2';

  // Control header visibility based on game state
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: !isGameActive,
    });
  }, [navigation, isGameActive]);

  // Animation functions
  const startSpinAnimation = useCallback(() => {
    spinValue.setValue(0);
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [spinValue]);

  const stopSpinAnimation = useCallback(() => {
    spinValue.stopAnimation();
  }, [spinValue]);

  const startFadeAnimation = useCallback(() => {
    Animated.sequence([
      Animated.timing(fadeValue, {
        toValue: 0.5,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(fadeValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeValue]);

  // Error handling utility
  const handleGenerationError = useCallback(
    (error: any, context: string) => {
      console.error(`Error in ${context}:`, error);

      let errorInfo: GenerationError;

      if (
        error?.message?.includes('network') ||
        error?.code === 'NETWORK_ERROR'
      ) {
        errorInfo = {
          type: 'network',
          message: 'Connection problem detected',
          suggestion: 'Check your internet connection and try again',
          retryable: true,
        };
      } else if (
        error?.message?.includes('rate limit') ||
        error?.status === 429
      ) {
        errorInfo = {
          type: 'api',
          message: 'Too many requests',
          suggestion: 'Please wait a moment and try again',
          retryable: true,
        };
      } else if (error?.message?.includes('validation')) {
        errorInfo = {
          type: 'validation',
          message: 'Content validation failed',
          suggestion: 'Try adjusting your story content',
          retryable: false,
        };
      } else {
        errorInfo = {
          type: 'unknown',
          message: 'Something went wrong',
          suggestion: 'Please try again or restart the app',
          retryable: true,
        };
      }

      setGenerationError(errorInfo);
      stopSpinAnimation();

      return errorInfo;
    },
    [stopSpinAnimation],
  );

  // Progress simulation for better UX
  const simulateProgress = useCallback((duration: number = 5000) => {
    const steps = [
      { progress: 20, task: 'Analyzing your story...' },
      { progress: 40, task: 'Generating creative content...' },
      { progress: 60, task: 'Checking story quality...' },
      { progress: 80, task: 'Finalizing your story...' },
      { progress: 100, task: 'Almost done!' },
    ];

    const stepDuration = duration / steps.length;

    steps.forEach((step, index) => {
      setTimeout(() => {
        setLoadingState(prev => ({
          ...prev,
          generationProgress: step.progress,
          currentTask: step.task,
        }));
      }, stepDuration * index);
    });
  }, []);

  // Removed quality assessment functions for cleaner experience

  // Initialize debouncing for user input
  useEffect(() => {
    const debouncer = new StoryInputDebouncer(
      // Validation callback for real-time feedback
      async (input: string) => {
        if (!input.trim()) return;

        try {
          const validationResult = await apiClient.validateStoryContent(
            input,
            gradeLevel,
          );
          if (!validationResult.isValid) {
            setGenerationError({
              type: 'validation',
              message: 'Input needs review',
              suggestion: validationResult.suggestions.join(' '),
              retryable: false,
            });
          } else {
            setGenerationError(null);
          }
        } catch (error) {
          console.error('Validation error:', error);
        }
      },
      // Generation callback for substantial input changes
      async (input: string) => {
        if (!currentSession || !input.trim()) return;

        // Auto-continue story for substantial user input
        console.log(
          'Auto-triggering story continuation for:',
          input.substring(0, 50),
        );
      },
      {
        validationDelay: 500,
        generationDelay: 2000,
        minInputLength: 5,
        maxInputLength: 500,
      },
    );

    setInputDebouncer(debouncer);

    return () => {
      debouncer.cancel();
    };
  }, [gradeLevel, currentSession]);

  // Check service availability
  const checkServiceAvailability = useCallback(async () => {
    // Check TTS service availability
    try {
      if (!textToSpeechService.isServiceAvailable()) {
        // Try to initialize if not already initialized
        await textToSpeechService.initialize();
      }
      const ttsAvailable = textToSpeechService.isServiceAvailable();
      setTtsServiceAvailable(ttsAvailable);

      if (!ttsAvailable) {
        console.log('⚠️ TTS service is not available');
      }
    } catch (error) {
      console.error('Error checking TTS availability:', error);
      setTtsServiceAvailable(false);
    }

    // STT service availability is handled by VoiceInput component
    // We'll assume it's available unless VoiceInput reports otherwise
    // VoiceInput component handles its own availability checks
  }, []);

  // Initialize TTS and check voice input preferences
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        await textToSpeechService.initialize();

        // Check TTS availability after initialization
        const ttsAvailable = textToSpeechService.isServiceAvailable();
        setTtsServiceAvailable(ttsAvailable);

        if (ttsAvailable) {
          await textToSpeechService.setGradeLevelOptions(gradeLevel);

          // Set up TTS event listeners with pause/resume state tracking
          textToSpeechService.setupEventListeners({
            onStart: () => {
              console.log('🔊 TTS started');
              setSpeakerState('speaking');
              // Announce state change for screen readers
              const { AccessibilityInfo } = require('react-native');
              AccessibilityInfo.announceForAccessibility(
                'Story playback started',
              );
            },
            onFinish: () => {
              console.log('✅ TTS finished');
              setSpeakerState('idle');
              // Announce completion for screen readers
              const { AccessibilityInfo } = require('react-native');
              AccessibilityInfo.announceForAccessibility(
                'Story playback finished',
              );
            },
            onCancel: () => {
              console.log('🛑 TTS cancelled');
              setSpeakerState('idle');
            },
            onError: error => {
              console.error('❌ TTS Error:', error);
              setSpeakerState('idle');
            },
            // Note: react-native-tts may not support pause/resume events natively
            // We'll track pause/resume state manually in pause()/resume() methods
            onPause: () => {
              console.log('⏸️ TTS paused');
              setSpeakerState('paused');
              // Announce pause for screen readers
              const { AccessibilityInfo } = require('react-native');
              AccessibilityInfo.announceForAccessibility(
                'Story playback paused',
              );
            },
            onResume: () => {
              console.log('▶️ TTS resumed');
              setSpeakerState('speaking');
              // Announce resume for screen readers
              const { AccessibilityInfo } = require('react-native');
              AccessibilityInfo.announceForAccessibility(
                'Story playback resumed',
              );
            },
          });

          console.log('✅ TTS service initialized successfully');
        } else {
          console.log(
            '⚠️ TTS service not available - speaker button will be disabled',
          );
        }

        // Check user's voice preference
        if (userProfile?.speech_enabled !== undefined) {
          setVoiceInputEnabled(userProfile.speech_enabled);
        }
      } catch (error) {
        console.error('❌ Failed to initialize audio services:', error);
        setTtsServiceAvailable(false);
        // Continue without throwing - graceful degradation
      }
    };

    if (user) {
      initializeAudio();
      // Check service availability on mount
      checkServiceAvailability();
    }

    return () => {
      textToSpeechService.removeAllListeners();
    };
  }, [user, userProfile?.speech_enabled, gradeLevel, checkServiceAvailability]);

  // Periodically check service availability (e.g., when app comes to foreground)
  useEffect(() => {
    const intervalId = setInterval(() => {
      checkServiceAvailability();
    }, 30000); // Check every 30 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [checkServiceAvailability]);

  // Voice input handler - appends transcribed text to existing input
  // Also known as handleVoiceTranscription for task documentation
  // Optimized to process text asynchronously to avoid blocking UI thread
  const handleVoiceResult = useCallback((text: string) => {
    // Handle empty transcriptions gracefully
    if (!text || !text.trim()) {
      console.log('Empty transcription received, ignoring');
      return;
    }

    // Process text cleaning asynchronously to avoid blocking UI
    requestAnimationFrame(() => {
      // Clean transcribed text: trim whitespace and normalize
      const cleanedText = text.trim().replace(/\s+/g, ' '); // Normalize multiple spaces to single space

      // Append transcribed text to existing input (don't replace)
      // Add space if there's existing text
      setUserInput(prev => {
        const trimmedPrev = prev.trim();

        if (!trimmedPrev) {
          // No existing text, just use the cleaned transcribed text
          return cleanedText;
        }

        // Check if previous text ends with punctuation or space
        // If it does, don't add extra space
        const lastChar = trimmedPrev[trimmedPrev.length - 1];
        const needsSpace =
          !/[.!?,;:]\s*$/.test(trimmedPrev) && lastChar !== ' ';

        // Append with space separator if needed
        return needsSpace
          ? `${trimmedPrev} ${cleanedText}`
          : `${trimmedPrev}${cleanedText}`;
      });
    });
  }, []);

  // Voice input error handler
  const handleVoiceError = useCallback((error: string) => {
    // Only log, don't show alert for expected errors (permission denied, unavailable in simulator, etc.)
    // The VoiceInput component already handles showing alerts appropriately
    console.log('Voice input error:', error);
    // Only show alert for unexpected errors (not permission, not unavailable in simulator)
    const errorLower = error.toLowerCase();
    if (
      !errorLower.includes('permission') &&
      !errorLower.includes('denied') &&
      !errorLower.includes('not available') &&
      !errorLower.includes('unavailable')
    ) {
      Alert.alert('Voice Input Error', error, [{ text: 'OK' }]);
    }
  }, []);

  // TTS functions
  const speakStoryContent = useCallback(async (content: string) => {
    if (!textToSpeechService.isServiceAvailable()) {
      console.log(
        '📢 TTS not available - would speak:',
        content.substring(0, 50) + '...',
      );
      return;
    }

    try {
      // Start speaking (idle state)
      await textToSpeechService.speakStoryContent(content, 'narrative');
      // State will be updated to 'speaking' via onStart event listener
    } catch (error) {
      console.error('Error speaking content:', error);
      setSpeakerState('idle');
    }
  }, []);

  // Speaker button tap handler with pause/resume logic
  const handleSpeakerButtonPress = useCallback(async () => {
    // Check if TTS service is available
    const isAvailable = textToSpeechService.isServiceAvailable();
    if (!isAvailable) {
      // Don't show alert for simulator - just log and disable button
      console.log(
        '⚠️ TTS service is not available (simulator or unsupported device)',
      );
      // Update availability state
      setTtsServiceAvailable(false);
      // Only show alert if this is the first time we're discovering it's unavailable
      // and we're not in a simulator (we can't detect simulator, so just show once)
      if (ttsServiceAvailable !== false) {
        Alert.alert(
          'Text-to-Speech Unavailable',
          'Text-to-speech is not available on this device. This may be because you are using a simulator or the service is not supported. You can still read the story by viewing it on screen.',
          [{ text: 'OK' }],
        );
      }
      return;
    }

    // Check if we have story content
    if (!currentSession?.story_content?.trim()) {
      Alert.alert('No Story Content', 'There is no story content to read.', [
        { text: 'OK' },
      ]);
      return;
    }

    try {
      // Handle different states
      if (speakerState === 'idle') {
        // Extract latest continuation (not full story)
        const latestContinuation = extractLatestContinuation(
          currentSession.story_content,
          currentSession,
        );

        if (!latestContinuation.trim()) {
          Alert.alert('No Content', 'No continuation found to read.', [
            { text: 'OK' },
          ]);
          return;
        }

        // Start reading latest continuation
        console.log('🔊 Starting to read latest continuation');
        await textToSpeechService.speakStoryContent(
          latestContinuation,
          'narrative',
        );
        // State will be updated to 'speaking' via onStart event listener
      } else if (speakerState === 'speaking') {
        // Pause current speech
        console.log('⏸️ Pausing speech');
        await textToSpeechService.pause();
        // Manually update state since pause event may not be available
        setSpeakerState('paused');
      } else if (speakerState === 'paused') {
        // Resume paused speech
        console.log('▶️ Resuming speech');
        await textToSpeechService.resume();
        // Manually update state since resume event may not be available
        setSpeakerState('speaking');
      }
    } catch (error) {
      console.error('❌ Error in speaker button handler:', error);
      Alert.alert(
        'Error',
        'An error occurred while controlling speech playback. Please try again.',
        [{ text: 'OK' }],
      );
      // Reset to idle state on error
      setSpeakerState('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakerState, currentSession]); // ttsServiceAvailable not used in this callback

  const provideContinuationFeedback = useCallback(async () => {
    if (!textToSpeechService.isServiceAvailable()) return;

    try {
      await textToSpeechService.addAudioCue('ai_turn');
    } catch (error) {
      console.error('Error providing audio feedback:', error);
    }
  }, []); // isServiceAvailable() is a method call, not dependent on state

  const checkForExistingSession = useCallback(async () => {
    try {
      // Check for existing session and load it if available
      const existingSession = await storySessionManager.getCurrentSession();
      if (existingSession && !existingSession.isCompleted) {
        console.log('Loading existing session:', existingSession.id);
        setCurrentSession(existingSession);
        setIsGameActive(true);
        setCurrentRound(existingSession.sessionStats.contributionCount + 1);

        // Check if session has a generated image
        if (existingSession.generated_image_url) {
          setGeneratedImageUrl(existingSession.generated_image_url);
          console.log(
            'Loaded existing image:',
            existingSession.generated_image_url,
          );
        }

        // Set completion state if needed
        if (existingSession.sessionStats.contributionCount >= MAX_ROUNDS) {
          setIsGameCompleted(true);
        }
      }
    } catch (error) {
      console.error('Error checking for existing session:', error);
    }
  }, []);

  // Clear any existing session on component mount
  useEffect(() => {
    if (user) {
      checkForExistingSession();
    }
  }, [user, checkForExistingSession]);

  // Challenge system functions
  const selectNewChallenge = useCallback(() => {
    const completedChallengeIds = challengeProgress
      .filter(progress => progress.isCompleted)
      .map(progress => progress.challengeId);

    const newChallenge = challengeService.selectRandomChallenge(
      gradeLevel,
      completedChallengeIds,
    );
    setCurrentChallenge(newChallenge);

    console.log('🎯 New challenge selected:', newChallenge?.title);
  }, [gradeLevel, challengeProgress]);

  const initializeChallengeSystem = useCallback(() => {
    // Reset challenge state
    setChallengeProgress([]);

    // Select first challenge for the session
    selectNewChallenge();
  }, [selectNewChallenge]);

  const validateUserChallenge = useCallback(
    (userText: string) => {
      if (!currentChallenge || !userText.trim()) return;

      const isCompleted = challengeService.validateChallenge(
        currentChallenge,
        userText,
      );

      if (isCompleted) {
        const progress = challengeService.createChallengeProgress(
          currentChallenge.id,
          userText,
          true,
        );

        setChallengeProgress(prev => [...prev, progress]);

        console.log(
          '✅ Challenge completed:',
          currentChallenge.title,
          '+' + currentChallenge.xpReward + ' XP',
        );

        // Automatically select new challenge after completion, passing the newly completed challenge
        setTimeout(() => {
          const completedChallengeIds = [
            ...challengeProgress
              .filter(p => p.isCompleted)
              .map(p => p.challengeId),
            currentChallenge.id,
          ];

          const newChallenge = challengeService.selectRandomChallenge(
            gradeLevel,
            completedChallengeIds,
          );
          setCurrentChallenge(newChallenge);
          console.log(
            '🎯 New challenge selected after completion:',
            newChallenge?.title,
          );
        }, 1000);

        // Show completion feedback
        Alert.alert(
          '🎉 Challenge Completed!',
          `${currentChallenge.title}\n+${currentChallenge.xpReward} XP`,
          [{ text: 'Awesome!' }],
        );
      }
    },
    [currentChallenge, challengeProgress, gradeLevel],
  );

  const handleContinueStoryOption = useCallback(() => {
    if (!user) {
      Alert.alert('Error', 'Please log in to continue a story');
      return;
    }

    // Navigate to import options screen
    try {
      navigation.navigate('ImportOptions' as never);
    } catch (error) {
      console.warn('Navigation to ImportOptions not configured:', error);
      // Show a coming soon alert until navigation is set up
      Alert.alert(
        'Story Continuation',
        'Story continuation feature is coming soon! This will allow you to:\n\n• Import stories from text files\n• Continue your previous stories\n• Edit and enhance existing stories\n\nStay tuned!',
        [{ text: 'OK' }],
      );
    }
  }, [user, navigation]);

  const handleStartNewGame = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in to start a story');
      return;
    }

    try {
      // Clear any previous errors and reset image state
      setGenerationError(null);
      setGeneratedImageUrl(null); // Reset to prevent showing expired images from previous sessions

      // Start loading with animations
      setLoadingState(prev => ({
        ...prev,
        isGenerating: true,
        generationProgress: 0,
        currentTask: 'Preparing your story...',
      }));

      startSpinAnimation();
      simulateProgress(4000);

      // Create new session
      const newSession = await storySessionManager.createSession(
        user.id,
        gradeLevel,
        { difficulty: 1 },
      );

      // Generate dynamic story starter using AI
      const starterResponse = await storyAgentService.generateStoryStarter({
        gradeLevel,
        theme: 'adventure',
      });

      if (starterResponse.success && starterResponse.story) {
        // Add AI story starter to session
        const updatedSession = await storySessionManager.addContribution(
          newSession.id,
          'ai',
          starterResponse.story,
          newSession,
        );

        if (updatedSession) {
          setCurrentSession({ ...updatedSession });
          setIsGameActive(true);
          startFadeAnimation();

          // Initialize challenge system
          initializeChallengeSystem();

          // Provide audio feedback for new story
          if (voiceInputEnabled) {
            await textToSpeechService.addAudioCue('story_start');

            // Auto-read the story starter
            setTimeout(async () => {
              if (starterResponse.story) {
                await speakStoryContent(starterResponse.story);
              }
            }, 2000);
          }
        }
      } else {
        // Fallback to basic starter if AI fails
        const fallbackStarter = await generateFallbackStarter();
        const updatedSession = await storySessionManager.addContribution(
          newSession.id,
          'ai',
          fallbackStarter,
          newSession,
        );

        if (updatedSession) {
          setCurrentSession({ ...updatedSession });
          setIsGameActive(true);
          startFadeAnimation();

          // Initialize challenge system
          initializeChallengeSystem();

          // Reset round counter for new game
          setCurrentRound(1);
          setIsGameCompleted(false);
        }
      }
    } catch (error) {
      const errorInfo = handleGenerationError(error, 'starting new game');

      if (errorInfo.retryable) {
        Alert.alert('⚠️ ' + errorInfo.message, errorInfo.suggestion, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Retry',
            onPress: () => setTimeout(handleStartNewGame, 1000),
          },
        ]);
      } else {
        Alert.alert('Error', errorInfo.message + '\n\n' + errorInfo.suggestion);
      }
    } finally {
      stopSpinAnimation();
      setLoadingState(prev => ({
        ...prev,
        isGenerating: false,
        generationProgress: 0,
        currentTask: '',
      }));
    }
  };

  const generateFallbackStarter = async (): Promise<string> => {
    try {
      console.log(
        '🎯 generateFallbackStarter called with gradeLevel:',
        gradeLevel,
      );

      // BYPASS all quality checks and use storyGenerationService directly for guaranteed variety
      console.log(
        '🔧 Using direct storyGenerationService for guaranteed story variety',
      );
      const directResponse = await storyGenerationService.generateStory({
        gradeLevel,
        userInput: `Create an engaging story starter for grade level ${gradeLevel}`,
        challenge: `Write an engaging opening for ${gradeLevel} level readers`,
      });

      console.log('📖 Direct service response:', {
        success: directResponse.success,
        hasStory: !!directResponse.story,
        error: directResponse.error,
        storyPreview: directResponse.story?.substring(0, 100) + '...',
      });

      if (directResponse.success && directResponse.story) {
        return directResponse.story;
      }
    } catch (error) {
      console.error('❌ Error in generateFallbackStarter:', error);
    }

    // Only use basic fallback if all systems fail
    console.log('🆘 All story generation failed, using basic fallback');
    return 'Once upon a time, an adventure was about to begin.';
  };

  const handleContinueStory = async () => {
    if (!userInput.trim() || !currentSession) return;

    try {
      // Clear any previous errors
      setGenerationError(null);

      setLoadingState(prev => ({
        ...prev,
        isValidating: true,
        isGenerating: true,
        currentTask: 'Validating your contribution...',
        generationProgress: 10,
      }));

      startSpinAnimation();

      // Validate user input
      const validationResult = await apiClient.validateStoryContent(
        userInput.trim(),
        gradeLevel,
      );

      if (!validationResult.isValid) {
        Alert.alert(
          '📝 Content Review',
          `Please revise your contribution:\n${validationResult.issues.join(
            '\n',
          )}\n\n💡 Suggestions:\n${validationResult.suggestions.join('\n')}`,
          [{ text: 'OK' }],
        );
        return;
      }

      setLoadingState(prev => ({
        ...prev,
        isValidating: false,
        isSaving: true,
        currentTask: 'Saving your contribution...',
        generationProgress: 30,
      }));

      // Store user input before clearing it
      const userContribution = userInput.trim();

      // Add user contribution to session, passing existing session to preserve contributions
      let updatedSession = await storySessionManager.addContribution(
        currentSession.id,
        'user',
        userContribution,
        currentSession,
      );

      if (!updatedSession) {
        throw new Error('Failed to save user contribution');
      }

      console.log(
        '✍️ User contribution added. Story length:',
        updatedSession.story_content?.length || 0,
      );
      // Force re-render by creating new object reference
      setCurrentSession({ ...updatedSession });

      // Validate challenge completion with user input
      validateUserChallenge(userContribution);

      setUserInput('');

      setLoadingState(prev => ({
        ...prev,
        isSaving: false,
        currentTask: 'Generating AI continuation...',
        generationProgress: 50,
      }));

      // Simulate progress for AI generation
      simulateProgress(3000);

      // Generate AI continuation
      const aiResponse = await storyAgentService.continueStory({
        gradeLevel,
        storySoFar: updatedSession.story_content || '',
        userInput: userContribution,
        consistencyCheck: true,
        qualityThreshold: 0.7,
      });

      if (aiResponse.success && aiResponse.story) {
        console.log(
          '🎯 AI response received:',
          aiResponse.story.substring(0, 100) + '...',
        );

        // Add AI continuation to session, passing existing session to preserve contributions
        updatedSession = await storySessionManager.addContribution(
          updatedSession.id,
          'ai',
          aiResponse.story,
          updatedSession,
        );

        if (updatedSession) {
          console.log(
            '📖 Updated session story length:',
            updatedSession.story_content?.length || 0,
          );
          console.log(
            '📖 Updated session story preview:',
            updatedSession.story_content?.substring(0, 150) + '...',
          );
          // Force re-render by creating new object reference
          setCurrentSession({ ...updatedSession });
          startFadeAnimation();

          // Check if game should end after this round
          if (currentRound >= MAX_ROUNDS) {
            setIsGameCompleted(true);

            // Show completion options screen after a brief delay
            setTimeout(() => {
              setShowCompletionOptions(true);
            }, 2000);
          } else {
            // Only increment round counter if game is continuing
            const nextRound = currentRound + 1;
            setCurrentRound(nextRound);
          }

          // Provide audio feedback and optionally read the AI response
          if (voiceInputEnabled) {
            await provideContinuationFeedback();

            // Auto-read AI response if user has speech enabled
            setTimeout(async () => {
              if (aiResponse.story) {
                await speakStoryContent(aiResponse.story);
              }
            }, 1000);
          }
        }
      } else {
        // If AI response failed but story generation service should have fallbacks
        console.log('AI response failed:', aiResponse.error);

        // The story generation should have provided a fallback - this shouldn't happen now
        Alert.alert(
          '📝 Story Generation',
          'The AI is taking a creative break, but the story will continue with our backup storyteller!',
          [
            {
              text: 'Continue Story',
              onPress: () => {
                // Force a basic continuation if all else fails
                const basicContinuation = `The story continued in an unexpected direction, opening up new possibilities for adventure.`;

                // Add basic continuation directly to the session
                storySessionManager
                  .addContribution(currentSession.id, 'ai', basicContinuation)
                  .then(newSession => {
                    if (newSession) {
                      setCurrentSession(newSession);
                      startFadeAnimation();
                    }
                  });
              },
            },
          ],
        );
      }
    } catch (error) {
      const errorInfo = handleGenerationError(error, 'continuing story');

      if (errorInfo.retryable) {
        Alert.alert('⚠️ ' + errorInfo.message, errorInfo.suggestion, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Retry',
            onPress: () => setTimeout(handleContinueStory, 1000),
          },
        ]);
      } else {
        Alert.alert('Error', errorInfo.message + '\n\n' + errorInfo.suggestion);
      }
    } finally {
      stopSpinAnimation();
      setLoadingState({
        isGenerating: false,
        isValidating: false,
        isSaving: false,
        generationProgress: 0,
        currentTask: '',
      });
    }
  };

  const handleExitGame = () => {
    // Always show warning dialog to prevent accidental exits
    if (currentSession && currentSession.contributions.length > 1) {
      // User has made progress - show full save options
      Alert.alert(
        '⚠️ Exit Game?',
        `You have written ${currentSession.sessionStats.userWords} words in this story. What would you like to do?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              // Do nothing - stay in the game
              console.log('User cancelled exit');
            },
          },
          {
            text: 'Discard Story',
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                'Confirm Discard',
                'Are you sure you want to permanently delete this story? This action cannot be undone.',
                [
                  {
                    text: 'Keep Story',
                    style: 'cancel',
                  },
                  {
                    text: 'Delete Forever',
                    style: 'destructive',
                    onPress: () => {
                      if (currentSession) {
                        storySessionManager.deleteSession(currentSession.id);
                      }
                      exitGame();
                    },
                  },
                ],
              );
            },
          },
          {
            text: 'Save & Exit',
            onPress: () => {
              console.log('Saving story and exiting');
              exitGame();
            },
          },
        ],
      );
    } else if (currentSession) {
      // User hasn't made much progress - simpler warning
      Alert.alert(
        '⚠️ Exit Game?',
        'Are you sure you want to exit? Your story progress will be saved.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              console.log('User cancelled exit');
            },
          },
          {
            text: 'Exit',
            onPress: () => exitGame(),
          },
        ],
      );
    } else {
      // No session - just confirm exit
      Alert.alert(
        '⚠️ Exit Game?',
        'Are you sure you want to return to the main screen?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Exit',
            onPress: () => exitGame(),
          },
        ],
      );
    }
  };

  const exitGame = () => {
    setIsGameActive(false);
    setCurrentSession(null);
    setUserInput('');
    setCurrentRound(1);
    setIsGameCompleted(false);
    setShowCompletionOptions(false);
    setShowImageGeneration(false);
    setGeneratedImageUrl(null); // Reset image URL to prevent showing expired images
  };

  const handleImageGeneration = useCallback(() => {
    setShowImageGeneration(true);
    setShowCompletionOptions(false); // Hide completion options while generating
  }, []);

  const handleViewStory = useCallback(() => {
    // Simply show the story (already visible) and hide completion options
    setShowCompletionOptions(false);

    // The story is now visible - user can scroll and read it
    // "Back to Options" button is available if they want to return to options
  }, []);

  const handleImageGenerated = useCallback(
    async (imageUrl: string) => {
      console.log('✅ [DEBUG] handleImageGenerated called with URL:', imageUrl);
      console.log('✅ [DEBUG] Current session ID:', currentSession?.id);
      console.log('✅ [DEBUG] Setting generatedImageUrl state');
      setGeneratedImageUrl(imageUrl);
      setShowImageGeneration(false);

      // Reload the session from database to get the updated session with image data
      if (currentSession) {
        try {
          const updatedSession = await storySessionManager.getSession(
            currentSession.id,
          );
          if (updatedSession) {
            console.log(
              '✅ [DEBUG] Reloaded session with image data:',
              updatedSession.generated_image_url?.substring(0, 50) + '...',
            );
            setCurrentSession(updatedSession);
          }
        } catch (error) {
          console.error(
            '❌ [DEBUG] Failed to reload session after image generation:',
            error,
          );
        }
      }

      // Image generated successfully - no popup needed, user will see the image directly

      console.log('✅ [DEBUG] handleImageGenerated completed');
    },
    [currentSession],
  );

  const handleImageGenerationError = useCallback((error: string) => {
    console.error('❌ Image generation failed:', error);
    setShowImageGeneration(false);

    // Return to completion options after showing error
    Alert.alert(
      '❌ Image Generation Failed',
      `Sorry, we couldn't generate an image for your story.\n\nError: ${error}\n\nYou can try again or choose other actions.`,
      [
        {
          text: 'OK',
          onPress: () => setShowCompletionOptions(true),
        },
      ],
    );
  }, []);

  const handleDownloadStory = useCallback(async () => {
    if (!currentSession) {
      Alert.alert(
        'No Story Available',
        'There is no story to download. Please complete a story first.',
        [{ text: 'OK' }],
      );
      return;
    }

    try {
      // Create download options directly from story content
      const storyContent =
        currentSession.story_content ||
        currentSession.contributions?.map(c => c.content).join('\n\n') ||
        '';

      if (!storyContent.trim()) {
        Alert.alert(
          'Empty Story',
          'Your story appears to be empty. Please add some content before downloading.',
          [
            { text: 'OK' },
            {
              text: 'Continue Writing',
              onPress: () => {
                // Keep user in the story to add content
                console.log('User wants to continue writing');
              },
            },
          ],
        );
        return;
      }

      const downloadOptions =
        storyDownloadService.createDownloadOptionsFromContent(
          currentSession.id,
          storyContent,
        );

      // Validate the story content with enhanced feedback
      const validation = storyDownloadService.validateStoryContent(
        downloadOptions.content,
      );
      if (!validation.isValid) {
        const errorDetails = validation.errors.join('\n• ');
        Alert.alert(
          'Story Validation Failed',
          `Your story cannot be downloaded due to the following issues:\n\n• ${errorDetails}\n\nPlease fix these issues and try again.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Try Anyway',
              onPress: () => {
                // Allow download with minimal validation for edge cases
                const fileName = storyDownloadService.generateFileName();
                const fileContent = storyContent; // Use raw content
                saveStoryWithLocationPicker(fileContent, fileName);
              },
            },
          ],
        );
        return;
      }

      // Check estimated file size and warn for very large files
      const stats = storyDownloadService.generateDownloadStats(downloadOptions);
      if (stats.estimatedFileSize > 500000) {
        // 500KB
        Alert.alert(
          'Large Story File',
          `Your story is quite large (${Math.round(
            stats.estimatedFileSize / 1024,
          )}KB, ${
            stats.wordCount
          } words).\n\nThis may take longer to process and share. Continue?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Continue',
              onPress: () => proceedWithDownload(downloadOptions),
            },
          ],
        );
        return;
      }

      await proceedWithDownload(downloadOptions);
    } catch (error) {
      console.error('❌ Download preparation failed:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);

      Alert.alert(
        'Download Failed',
        `Sorry, we couldn't prepare your story for download.\n\nError: ${errorMsg}\n\nWould you like to try again?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: handleDownloadStory },
        ],
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession]); // proceedWithDownload and saveStoryWithLocationPicker defined later, circular dependency

  const proceedWithDownload = useCallback(
    async (downloadOptions: any) => {
      try {
        // Generate the file content with loading indication
        const fileContent =
          storyDownloadService.generateStoryFile(downloadOptions);
        const fileName = storyDownloadService.generateFileName();

        // Save file and let user choose location through share sheet (no loading popup needed)
        await saveStoryWithLocationPicker(fileContent, fileName);
      } catch (error) {
        console.error('❌ Download processing failed:', error);
        const errorMsg = error instanceof Error ? error.message : String(error);

        Alert.alert(
          'Processing Failed',
          `Failed to process your story for download.\n\nError: ${errorMsg}\n\nThis might be due to the story content or a temporary issue.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Retry',
              onPress: () => proceedWithDownload(downloadOptions),
            },
          ],
        );
      }
    },
    [saveStoryWithLocationPicker],
  );

  const saveStoryWithLocationPicker = useCallback(
    async (fileContent: string, fileName: string) => {
      let tempFilePath: string | undefined;

      try {
        let shareOptions: any = {
          title: 'Save Story',
          message: 'Save your completed story',
          type: 'text/plain',
          filename: fileName,
          saveToFiles: true, // This enables "Save to Files" option on iOS
        };

        // Handle simulator vs real device differently
        if (rnfsWrapper.isSimulationMode) {
          console.log(
            '📁 [HomeScreen] Simulator mode detected - sharing content directly',
          );

          // In simulator, share content directly instead of fake file paths
          shareOptions.message = `Save your completed story: "${fileName}"\n\n${fileContent}`;
          // Don't include fake file URL for simulator
        } else {
          console.log('📁 [HomeScreen] Device mode - creating temporary file');

          // On real device, create temporary file as before
          const documentsPath = RNFS.DocumentDirectoryPath;
          tempFilePath = `${documentsPath}/${fileName}`;

          await RNFS.writeFile(tempFilePath, fileContent, 'utf8');

          const fileStat = await RNFS.stat(tempFilePath);
          console.log('📁 File created successfully:', {
            path: tempFilePath,
            size: fileStat.size,
            fileName: fileName,
          });

          shareOptions.url = `file://${tempFilePath}`;
        }

        try {
          const shareResult = await Share.open(shareOptions);
          console.log('📁 Share result:', shareResult);

          // Check if user cancelled - ShareWrapper returns {success: false, dismissedAction: true, message: 'User cancelled share'}
          const isCancellation =
            shareResult.dismissedAction &&
            !shareResult.success &&
            shareResult.message?.toLowerCase().includes('cancel');

          if (isCancellation) {
            console.log('📁 User cancelled share - no message shown');
            // Clean up temporary file if needed
            if (tempFilePath && !rnfsWrapper.isSimulationMode) {
              try {
                await RNFS.unlink(tempFilePath);
                console.log(
                  '📁 Cleaned up temporary file after user cancellation',
                );
              } catch (cleanupError) {
                console.log(
                  '📁 Could not clean up temporary file:',
                  cleanupError,
                );
              }
            }
            return; // Don't show any message - user intentionally cancelled
          }

          // Show success message based on share result
          if (shareResult.success) {
            Alert.alert(
              '✅ Story Saved!',
              `Your story "${fileName}" has been saved successfully!\n\nYou can find it in the location you selected.`,
              [
                {
                  text: 'Great!',
                  onPress: () => setShowCompletionOptions(true),
                },
              ],
            );
          } else if (shareResult.dismissedAction) {
            // User dismissed but it wasn't a cancellation (edge case)
            Alert.alert(
              'Story Ready',
              `Your story "${fileName}" is ready in the app's Documents folder.\n\nYou can also access it through the Files app.`,
              [
                {
                  text: 'OK',
                  onPress: () => setShowCompletionOptions(true),
                },
              ],
            );
          }
        } catch (shareError) {
          console.log('📁 Share cancelled or failed:', shareError);

          // Handle user cancellation gracefully
          const errorMessage =
            shareError instanceof Error
              ? shareError.message
              : String(shareError);

          // Check if user actually cancelled - if so, don't show any success message
          if (
            errorMessage &&
            (errorMessage.includes('User did not share') ||
              errorMessage.includes('cancelled') ||
              errorMessage.includes('User cancelled') ||
              errorMessage.toLowerCase().includes('cancel'))
          ) {
            // User cancelled - clean up the temporary file and don't show success message
            if (tempFilePath && !rnfsWrapper.isSimulationMode) {
              try {
                await RNFS.unlink(tempFilePath);
                console.log(
                  '📁 Cleaned up temporary file after user cancellation',
                );
              } catch (cleanupError) {
                console.log(
                  '📁 Could not clean up temporary file:',
                  cleanupError,
                );
              }
            }
            // Don't show any message - user intentionally cancelled
            return;
          } else {
            // Other share errors - provide appropriate feedback based on mode
            const alertMessage = rnfsWrapper.isSimulationMode
              ? `Your story content was shared. In simulator mode, file location selection is limited.`
              : `Your story "${fileName}" has been saved to the app's Documents folder.\n\nYou can access it through the Files app and move it to your preferred location.`;

            Alert.alert('Story Shared', alertMessage, [
              {
                text: 'OK',
                onPress: () => setShowCompletionOptions(true),
              },
            ]);
          }
        }

        // Clean up temporary file after a delay (in case user wants to share again)
        if (tempFilePath && !rnfsWrapper.isSimulationMode) {
          setTimeout(async () => {
            try {
              const fileExists = await RNFS.exists(tempFilePath!);
              if (fileExists) {
                // Don't delete immediately - user might want to access it
                console.log('📁 Keeping file for user access:', tempFilePath);
              }
            } catch (cleanupError) {
              console.log('📁 Cleanup check failed:', cleanupError);
            }
          }, 10000); // 10 second delay
        }
      } catch (error) {
        console.error('❌ File save operation failed:', error);

        // Provide specific error messages based on error type
        let errorMessage =
          'An unexpected error occurred while saving your story.';
        let suggestion = 'Please try again.';

        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg?.includes('ENOSPC')) {
          errorMessage = 'Not enough storage space available.';
          suggestion = 'Please free up some space and try again.';
        } else if (errorMsg?.includes('EACCES')) {
          errorMessage = 'Permission denied to write file.';
          suggestion = 'Please check app permissions in Settings.';
        } else if (errorMsg?.includes('ENOENT')) {
          errorMessage = 'Directory not accessible.';
          suggestion = 'Please restart the app and try again.';
        }

        Alert.alert('Save Failed', `${errorMessage}\n\n${suggestion}`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Retry',
            onPress: () => saveStoryWithLocationPicker(fileContent, fileName),
          },
          {
            text: 'Help',
            onPress: () => showDownloadTroubleshooting(errorMsg),
          },
        ]);
      }
    },
    [showDownloadTroubleshooting],
  ); // saveStoryWithLocationPicker not used in this callback

  const showDownloadTroubleshooting = useCallback((errorDetails: string) => {
    let troubleshootingSteps = '';
    let additionalActions: any[] = [];

    if (errorDetails?.includes('ENOSPC')) {
      troubleshootingSteps = `Storage Space Issue:\n\n1. Delete unused photos, videos, or apps\n2. Clear app caches in Settings\n3. Move files to iCloud or external storage\n4. Restart your device\n\nYour story needs about ${Math.round(
        errorDetails.length / 1024,
      )}KB of space.`;
      additionalActions = [
        {
          text: 'Open Settings',
          onPress: () => {
            console.log('User wants to open device settings');
            // On iOS, we can suggest but can't directly open specific settings
          },
        },
      ];
    } else if (errorDetails?.includes('EACCES')) {
      troubleshootingSteps = `Permission Issue:\n\n1. Go to Settings > Privacy & Security\n2. Find "CreativeBridge" in the apps list\n3. Enable "Files and Folders" permission\n4. Restart the app\n5. Try downloading again\n\nIf the issue persists, try restarting your device.`;
      additionalActions = [
        {
          text: 'Restart App',
          onPress: () => {
            Alert.alert(
              'Restart Required',
              'Please close and reopen the app to refresh permissions, then try downloading again.',
              [{ text: 'OK' }],
            );
          },
        },
      ];
    } else if (errorDetails?.includes('ENOENT')) {
      troubleshootingSteps = `Directory Access Issue:\n\n1. Restart the CreativeBridge app\n2. If that doesn't work, restart your device\n3. Ensure iOS is up to date\n4. Try downloading again\n\nThis is usually a temporary issue that resolves after restarting.`;
      additionalActions = [
        {
          text: 'Check iOS Version',
          onPress: () => {
            Alert.alert(
              'iOS Version Check',
              "Please ensure you're running iOS 14.0 or later for best compatibility.\n\nGo to Settings > General > About to check your iOS version.",
              [{ text: 'OK' }],
            );
          },
        },
      ];
    } else {
      troubleshootingSteps = `General Troubleshooting:\n\n1. Ensure you have a stable internet connection\n2. Close other apps to free up memory\n3. Restart the CreativeBridge app\n4. Try downloading at a different time\n5. Contact support if the issue persists\n\nError details: ${errorDetails.substring(
        0,
        100,
      )}...`;
      additionalActions = [
        {
          text: 'Contact Support',
          onPress: () => {
            Alert.alert(
              'Contact Support',
              'If this issue continues, please contact our support team with the error details:\n\n' +
                errorDetails,
              [
                { text: 'OK' },
                {
                  text: 'Copy Error',
                  onPress: () => {
                    console.log(
                      'Error details copied to clipboard:',
                      errorDetails,
                    );
                    Alert.alert(
                      'Error Copied',
                      'Error details copied to clipboard for support.',
                    );
                  },
                },
              ],
            );
          },
        },
      ];
    }

    Alert.alert('Download Troubleshooting', troubleshootingSteps, [
      { text: 'OK', style: 'cancel' },
      ...additionalActions,
    ]);
  }, []);

  const retryDownloadWithFallback = useCallback(
    async (fileContent: string, fileName: string, attemptCount = 1) => {
      if (attemptCount > 3) {
        Alert.alert(
          'Multiple Failures',
          "The download has failed multiple times. Your story will be saved locally in the app's Documents folder.\n\nYou can access it later through the Files app.",
          [{ text: 'OK' }],
        );
        return;
      }

      try {
        // Add exponential backoff delay
        if (attemptCount > 1) {
          const delayMs = Math.pow(2, attemptCount - 1) * 1000; // 1s, 2s, 4s
          Alert.alert(
            `Retry Attempt ${attemptCount}`,
            `Waiting ${delayMs / 1000} seconds before retrying...`,
            [],
            { cancelable: false },
          );
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        await saveStoryWithLocationPicker(fileContent, fileName);
      } catch (error) {
        console.error(`❌ Retry attempt ${attemptCount} failed:`, error);
        const errorMsg = error instanceof Error ? error.message : String(error);

        Alert.alert(
          `Retry ${attemptCount} Failed`,
          `Attempt ${attemptCount} unsuccessful.\n\nError: ${errorMsg}\n\nTry again?`,
          [
            { text: 'Give Up', style: 'cancel' },
            {
              text: `Retry (${attemptCount + 1}/3)`,
              onPress: () =>
                retryDownloadWithFallback(
                  fileContent,
                  fileName,
                  attemptCount + 1,
                ),
            },
          ],
        );
      }
    },
    [saveStoryWithLocationPicker],
  );

  // Removed handleGameCompletion function - replaced with completion options screen

  // Removed handleCompleteStory and handleShareStory functions since Complete button was removed

  if (isGameActive) {
    return (
      <View style={styles.container}>
        <View style={styles.gameContainer}>
          {/* Current Challenge Display */}
          {currentChallenge && !showCompletionOptions && (
            <ChallengeDisplay
              challenge={currentChallenge}
              progress={challengeProgress.find(
                p => p.challengeId === currentChallenge.id,
              )}
              compact={true}
            />
          )}

          {/* Story Display - Book Format */}
          <View style={styles.storyBookContainer}>
            <View style={styles.storyBookHeader}>
              <View style={styles.storyTitleRow}>
                <Text style={styles.storyBookTitle}>📖 Your Story</Text>
                <Text style={styles.gradeLevel}>{gradeLevel}</Text>
                <Text style={styles.roundCounter}>
                  Round {currentRound}/{MAX_ROUNDS}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => {
                  const storyContent =
                    currentSession?.story_content ||
                    currentSession?.contributions
                      ?.map(c => c.content)
                      .join('\n\n') ||
                    '';
                  if (storyContent.trim()) {
                    Clipboard.setString(storyContent);
                    Alert.alert('✅ Copied!', 'Story copied to clipboard', [
                      { text: 'OK' },
                    ]);
                  } else {
                    Alert.alert('📝 No Story', 'No story content to copy yet', [
                      { text: 'OK' },
                    ]);
                  }
                }}
                disabled={
                  !currentSession?.story_content &&
                  (!currentSession?.contributions ||
                    currentSession.contributions.length === 0)
                }
              >
                <Text style={styles.copyButtonText}>📋 Copy</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.storyBook}
              contentContainerStyle={styles.storyBookContent}
            >
              {currentSession?.contributions &&
              currentSession.contributions.length > 0 ? (
                currentSession.contributions.map((contribution, index) => (
                  <View
                    key={`${contribution.timestamp}-${index}`}
                    style={styles.compactContributionContainer}
                  >
                    <View style={styles.compactContributionHeader}>
                      <Text
                        style={[
                          styles.compactContributionLabel,
                          contribution.type === 'ai'
                            ? styles.aiLabel
                            : styles.userLabel,
                        ]}
                      >
                        {contribution.type === 'ai' ? '🤖' : '✍️'}
                      </Text>
                      <Text style={styles.compactWordCount}>
                        {contribution.wordCount}w
                      </Text>
                    </View>
                    <Text
                      style={[styles.storyText, styles.selectableText]}
                      selectable={true}
                    >
                      {contribution.content}
                    </Text>
                  </View>
                ))
              ) : (
                <Text
                  style={[styles.storyText, styles.selectableText]}
                  selectable={true}
                >
                  {currentSession?.story_content || 'Loading story...'}
                </Text>
              )}
            </ScrollView>
          </View>

          {/* Image Generation Section */}
          {showImageGeneration && currentSession && (
            <ImageGeneration
              storyContent={currentSession.story_content || ''}
              sessionId={currentSession.id}
              gradeLevel={gradeLevel}
              wordCount={currentSession.sessionStats.userWords}
              onImageGenerated={handleImageGenerated}
              onError={handleImageGenerationError}
              disabled={!isGameCompleted}
            />
          )}

          {/* Generated Image Display */}
          {(() => {
            const shouldShowImage =
              (generatedImageUrl || currentSession?.generated_image_url) &&
              currentSession;
            console.log('🖼️ [DEBUG] Image display check:', {
              generatedImageUrl: generatedImageUrl?.substring(0, 50) + '...',
              sessionImageUrl:
                currentSession?.generated_image_url?.substring(0, 50) + '...',
              hasCurrentSession: !!currentSession,
              shouldShowImage,
            });
            return shouldShowImage;
          })() ? (
            <View style={styles.imageDisplayContainerOverlay}>
              <StoryImageDisplay
                imageUrl={
                  generatedImageUrl || currentSession?.generated_image_url || ''
                }
                storyTitle={`${
                  currentSession?.story_content
                    ?.split(' ')
                    .slice(0, 6)
                    .join(' ') || 'Your Story'
                }...`}
                sessionId={currentSession?.id || ''}
                showBackButton={true}
                displayMode="responsive"
                enableFullScreen={false}
                onBackToOptions={() => setShowCompletionOptions(true)}
                onImageSaved={localPath => {
                  console.log('✅ [DEBUG] Image saved locally:', localPath);
                  // Update session with local image path
                  if (currentSession?.id) {
                    storySessionManager.updateSessionWithLocalImage(
                      currentSession.id,
                      localPath,
                    );
                  }
                }}
                onError={error => {
                  console.error('❌ [DEBUG] Image display error:', error);
                  // Error is already handled gracefully by StoryImageDisplay component
                }}
              />
            </View>
          ) : null}

          {/* Back to Options Button - Show when game is completed but options are hidden, image generation is not active, and no generated image is displayed */}
          {isGameCompleted &&
            !showCompletionOptions &&
            !showImageGeneration &&
            !(generatedImageUrl || currentSession?.generated_image_url) && (
              <View style={styles.backToOptionsContainer}>
                <TouchableOpacity
                  style={styles.backToOptionsButton}
                  onPress={() => setShowCompletionOptions(true)}
                >
                  <Text style={styles.backToOptionsText}>
                    ← Back to Options
                  </Text>
                </TouchableOpacity>
              </View>
            )}

          {/* User Input Section */}
          <View style={styles.inputSection}>
            <TextInput
              testID="story-input"
              style={styles.storyInput}
              value={userInput}
              onChangeText={text => {
                setUserInput(text);
                // Use debouncing for real-time validation and auto-generation
                if (inputDebouncer) {
                  inputDebouncer.handleInput(text);
                }
              }}
              placeholder="Continue the story..."
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Game Action Buttons */}
            <View style={styles.gameButtonsContainer}>
              <View style={styles.buttonRow}>
                {/* Read Story Button - Emoji Only */}
                <TouchableOpacity
                  testID="speaker-button"
                  style={[
                    styles.readStoryButton,
                    (!currentSession?.story_content ||
                      ttsServiceAvailable === false) &&
                      styles.disabledButton,
                  ]}
                  onPress={handleSpeakerButtonPress}
                  disabled={
                    !currentSession?.story_content ||
                    ttsServiceAvailable === false
                  }
                  accessibilityLabel={
                    ttsServiceAvailable === false
                      ? 'Read story (disabled - TTS unavailable)'
                      : !currentSession?.story_content
                      ? 'Read story (disabled - no content)'
                      : speakerState === 'idle'
                      ? 'Read story'
                      : speakerState === 'speaking'
                      ? 'Pause story playback'
                      : 'Resume story playback'
                  }
                  accessibilityHint={
                    ttsServiceAvailable === false
                      ? 'Text-to-speech is not available on this device. You can still read the story on screen.'
                      : !currentSession?.story_content
                      ? 'Story content is required to read'
                      : speakerState === 'idle'
                      ? 'Tap to start reading the latest story continuation'
                      : speakerState === 'speaking'
                      ? 'Tap to pause the story playback'
                      : 'Tap to resume the story playback'
                  }
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: !currentSession?.story_content,
                  }}
                >
                  <Text style={styles.emojiButtonText}>
                    {speakerState === 'idle' ? '🔊' : '⏹️'}
                  </Text>
                </TouchableOpacity>

                {/* Voice Input Component */}
                <VoiceInput
                  onSpeechResult={handleVoiceResult}
                  isEnabled={voiceInputEnabled && !loadingState.isGenerating}
                  onError={handleVoiceError}
                  buttonText={{
                    idle: '🎤',
                    listening: '🔴',
                    processing: '⏳',
                  }}
                  style={styles.speakButton}
                />

                {/* Exit Button */}
                <TouchableOpacity
                  style={styles.exitButtonBottom}
                  onPress={handleExitGame}
                >
                  <Text style={styles.exitButtonText}>← Exit</Text>
                </TouchableOpacity>

                {/* Continue Story Button */}
                <TouchableOpacity
                  testID="continue-story-button"
                  style={[
                    styles.continueStoryButton,
                    (!userInput.trim() ||
                      loadingState.isGenerating ||
                      isGameCompleted) &&
                      styles.disabledButton,
                  ]}
                  onPress={handleContinueStory}
                  disabled={
                    !userInput.trim() ||
                    loadingState.isGenerating ||
                    isGameCompleted
                  }
                >
                  {loadingState.isGenerating ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : isGameCompleted ? (
                    <Text style={styles.continueStoryButtonText}>
                      Story Complete! 🎉
                    </Text>
                  ) : (
                    <Text style={styles.continueStoryButtonText}>
                      {currentRound >= MAX_ROUNDS
                        ? 'Final Round →'
                        : 'Continue Story →'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {(loadingState.isValidating ||
              loadingState.isSaving ||
              loadingState.isGenerating) && (
              <View style={styles.loadingIndicator}>
                <Animated.View
                  style={{
                    transform: [
                      {
                        rotate: spinValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }),
                      },
                    ],
                  }}
                >
                  <Text style={styles.loadingSpinner}>⚡</Text>
                </Animated.View>
                <View style={styles.loadingTextContainer}>
                  <Text style={styles.loadingText}>
                    {loadingState.currentTask ||
                      (loadingState.isValidating
                        ? 'Validating content...'
                        : loadingState.isSaving
                        ? 'Saving...'
                        : 'Processing...')}
                  </Text>
                  {loadingState.generationProgress > 0 && (
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${loadingState.generationProgress}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.progressText}>
                        {loadingState.generationProgress}%
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {generationError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <View style={styles.errorTextContainer}>
                  <Text style={styles.errorTitle}>
                    {generationError.message}
                  </Text>
                  <Text style={styles.errorSuggestion}>
                    {generationError.suggestion}
                  </Text>
                  {generationError.retryable && (
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={() => {
                        setGenerationError(null);
                        handleContinueStory();
                      }}
                    >
                      <Text style={styles.retryButtonText}>Try Again</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Story Completion Options Screen - Full Screen Overlay */}
        {showCompletionOptions && (
          <View style={styles.completionModalOverlay}>
            <ScrollView
              style={styles.completionScrollView}
              contentContainerStyle={styles.completionScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.completionOptionsContainer}>
                <View style={styles.completionOptionsHeader}>
                  <Text style={styles.completionTitle}>🎉 Story Complete!</Text>
                  <Text style={styles.completionSubtitle}>
                    Congratulations! You've completed your {MAX_ROUNDS}-round
                    story adventure!
                  </Text>
                  <View style={styles.completionStats}>
                    <Text style={styles.completionStat}>
                      📝 Words Written:{' '}
                      {currentSession?.sessionStats.userWords || 0}
                    </Text>
                    <Text style={styles.completionStat}>
                      🎯 Challenges Completed:{' '}
                      {challengeProgress.filter(p => p.isCompleted).length}
                    </Text>
                    <Text style={styles.completionStat}>
                      📚 Story Length:{' '}
                      {currentSession?.story_content?.length || 0} characters
                    </Text>
                  </View>
                </View>

                <View style={styles.completionOptionsButtons}>
                  <TouchableOpacity
                    style={styles.completionOptionButton}
                    onPress={handleViewStory}
                  >
                    <Text style={styles.completionOptionText}>
                      📖 View Story
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.completionOptionButton}
                    onPress={() => {
                      setShowCompletionOptions(false);
                      handleDownloadStory();
                    }}
                  >
                    <Text style={styles.completionOptionText}>
                      ⬇️ Download Story
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.completionOptionButton}
                    onPress={handleImageGeneration}
                  >
                    <Text style={styles.completionOptionText}>
                      🎨 Generate Image
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.completionOptionButton,
                      styles.secondaryOptionButton,
                    ]}
                    onPress={() => {
                      exitGame();
                      setTimeout(() => {
                        handleStartNewGame();
                      }, 500);
                    }}
                  >
                    <Text style={styles.completionOptionText}>
                      ✨ New Story
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.completionOptionButton,
                      styles.exitOptionButton,
                    ]}
                    onPress={() => exitGame()}
                  >
                    <Text style={styles.completionOptionText}>
                      🏠 Main Menu
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.homeContainer}>
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>
            Welcome back, {userProfile?.display_name || 'Writer'}!
          </Text>
          <Text style={styles.welcomeSubtitle}>
            Ready to create amazing stories?
          </Text>
        </View>

        {/* Story Action Buttons */}
        <View style={styles.startSection}>
          <TouchableOpacity
            style={[
              styles.startButton,
              loadingState.isGenerating && styles.disabledButton,
            ]}
            onPress={handleStartNewGame}
            disabled={loadingState.isGenerating}
          >
            {loadingState.isGenerating ? (
              <View style={styles.loadingButtonContent}>
                <Animated.View
                  style={{
                    transform: [
                      {
                        rotate: spinValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }),
                      },
                    ],
                  }}
                >
                  <Text style={styles.loadingSpinnerButton}>✨</Text>
                </Animated.View>
                <Text
                  style={[styles.startButtonText, styles.loadingButtonText]}
                >
                  {loadingState.currentTask || 'Creating Story...'}
                </Text>
              </View>
            ) : (
              <Text style={styles.startButtonText}>🎮 Start New Story</Text>
            )}
          </TouchableOpacity>

          {/* Continue Story Button */}
          <TouchableOpacity
            style={[
              styles.continueButton,
              loadingState.isGenerating && styles.disabledButton,
            ]}
            onPress={handleContinueStoryOption}
            disabled={loadingState.isGenerating}
          >
            <Text style={styles.continueButtonText}>📖 Continue Story</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  homeContainer: {
    padding: 40,
    alignItems: 'center',
  },
  gameContainer: {
    padding: 8,
    paddingTop: 60, // Add top padding to avoid dynamic island
    flex: 1,
  },
  welcomeSection: {
    marginBottom: 60,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  gradeSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  gradeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gradeButton: {
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 8,
    width: '48%',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedGradeButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  gradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  selectedGradeButtonText: {
    color: '#ffffff',
  },
  startSection: {
    alignItems: 'center',
    gap: 20,
  },
  startButton: {
    backgroundColor: '#f44336',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 50,
    minWidth: 250,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  continueButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
    minWidth: 220,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 2,
    borderColor: '#1976D2',
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  // Game Screen Styles
  gradeLevel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4CAF50',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sessionXP: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '600',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roundCounter: {
    fontSize: 11,
    color: '#FF6B35',
    fontWeight: 'bold',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  storyBookContainer: {
    marginBottom: 8,
    flex: 1,
  },
  storyBookHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  storyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  storyBookTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  copyButton: {
    backgroundColor: '#6B7280',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  copyButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  storyBook: {
    backgroundColor: '#ffffff',
    borderRadius: 4,
    flex: 1,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  storyBookContent: {
    padding: 16,
    flexGrow: 1,
  },
  storyText: {
    fontSize: 18,
    lineHeight: 26,
    color: '#333',
    fontFamily: 'serif',
    textAlign: 'left',
  },
  selectableText: {
    // Allow text selection on supported platforms
    userSelect: 'text',
  },
  contributionContainer: {
    marginBottom: 8,
    padding: 8,
    borderRadius: 4,
    borderLeftWidth: 3,
  },
  aiContribution: {
    backgroundColor: '#f8f9ff',
    borderLeftColor: '#4285f4',
  },
  userContribution: {
    backgroundColor: '#f0fdf4',
    borderLeftColor: '#22c55e',
  },
  contributionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  contributionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aiLabel: {
    color: '#4285f4',
  },
  userLabel: {
    color: '#22c55e',
  },
  wordCount: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
  contributionText: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'serif',
  },
  aiText: {
    color: '#1e40af',
  },
  userText: {
    color: '#166534',
  },
  compactContributionContainer: {
    marginBottom: 4,
  },
  compactContributionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  compactContributionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  compactWordCount: {
    fontSize: 9,
    color: '#888',
    fontWeight: '500',
  },
  inputSection: {
    marginBottom: 8,
  },
  storyInput: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontSize: 16,
    lineHeight: 20,
    minHeight: 60,
    marginBottom: 8,
    fontFamily: 'serif',
  },
  // Removed old continueButton styles - replaced with continueStoryButton
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  // Removed old continueButtonText - replaced with continueStoryButtonText
  // Removed stats display for cleaner book format
  // Removed buttonRow - replaced with gameButtonsContainer
  // Removed complete button styles
  loadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    padding: 10,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  loadingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingButtonText: {
    marginLeft: 10,
  },
  // Enhanced loading and error styles
  loadingSpinner: {
    fontSize: 20,
    marginRight: 8,
  },
  loadingSpinnerButton: {
    fontSize: 16,
    marginRight: 8,
    color: '#ffffff',
  },
  loadingTextContainer: {
    flex: 1,
  },
  progressContainer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  errorIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  errorTextContainer: {
    flex: 1,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 4,
  },
  errorSuggestion: {
    fontSize: 12,
    color: '#856404',
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: '#ffc107',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: '#856404',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Game action buttons styles
  gameButtonsContainer: {
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  readStoryButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  speakButton: {
    backgroundColor: '#9C27B0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  emojiButtonText: {
    fontSize: 20,
  },
  exitButtonBottom: {
    backgroundColor: '#666',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  continueStoryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    flex: 1,
  },
  continueStoryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  imageDisplayContainer: {
    marginVertical: 8,
  },
  imageDisplayContainerFullWidth: {
    marginVertical: 0, // Remove margins for edge-to-edge
    flex: 1, // Allow expansion
  },
  imageDisplayContainerOverlay: {
    marginVertical: 8,
    alignItems: 'center', // Center the overlay image
    justifyContent: 'center',
  },
  // Story Completion Options Styles - Full Screen Modal
  completionModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completionScrollView: {
    flex: 1,
    width: '100%',
  },
  completionScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  completionOptionsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
    borderWidth: 3,
    borderColor: '#4CAF50',
  },
  completionOptionsHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  completionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 12,
    textAlign: 'center',
  },
  completionSubtitle: {
    fontSize: 17,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
    fontWeight: '500',
  },
  completionStats: {
    alignItems: 'center',
    gap: 4,
  },
  completionStat: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  completionOptionsButtons: {
    gap: 16,
    marginTop: 8,
  },
  completionOptionButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  secondaryOptionButton: {
    backgroundColor: '#2196F3',
  },
  exitOptionButton: {
    backgroundColor: '#666',
  },
  completionOptionText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Back to Options Button Styles
  backToOptionsContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  backToOptionsButton: {
    backgroundColor: '#f44336',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backToOptionsText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default React.memo(HomeScreen);
