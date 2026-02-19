import React, {
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
  useRef,
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
  Platform,
  Keyboard,
  KeyboardEvent,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import { useRoute, RouteProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { useSafeClerkAuth } from '../hooks/useSafeClerkAuth';
import { TabParamList, HomeStackParamList } from '../navigation/AppNavigator';
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
import { imageStorageService } from '../services/imageStorageService';
import RNFS, { rnfsWrapper } from '../utils/rnfsWrapper';
import { VoiceInput } from '../components/common/VoiceInput';
import Share from '../utils/shareWrapper';
import { CelebrationModal } from '../components/common/CelebrationModal';
import { FeatureTooltip } from '../components/common/FeatureTooltip';
import {
  FirstStoryGuidanceModal,
  EnhancedEmptyState,
} from '../components/onboarding';
import { onboardingMilestoneTracker } from '../services/onboardingMilestoneTracker';
import { onboardingService } from '../services/onboardingService';
import { supabase } from '../services/supabase';

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
  const { userProfile, user, refreshProfile, awardOnboardingXP } = useAuth();
  const { clerkAuth } = useSafeClerkAuth();
  const route = useRoute<RouteProp<HomeStackParamList, 'Home'>>();

  // Use user profile ID (Supabase UUID) for database operations when available
  // This ensures OAuth users use proper UUIDs instead of Clerk user IDs for Supabase operations
  const effectiveUserId = userProfile?.id || user?.id || clerkAuth?.userId;
  const isAuthenticated = !!user || clerkAuth?.isSignedIn;

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
  // Speaker button state: 'idle' | 'starting' | 'speaking' | 'paused'
  // 'starting' is used to prevent race conditions between button press and TTS start
  const [speakerState, setSpeakerState] = useState<
    'idle' | 'starting' | 'speaking' | 'paused'
  >('idle');
  // Speaker button enabled state - disabled by default, toggles on press
  const [speakerButtonEnabled, setSpeakerButtonEnabled] = useState(false);
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

  // Keyboard animation refs
  const keyboardHeight = useRef(new Animated.Value(0)).current;
  const storyScrollViewRef = useRef<ScrollView>(null);

  // Game round tracking
  const [currentRound, setCurrentRound] = useState(1);
  const [isGameCompleted, setIsGameCompleted] = useState(false);
  const [showCompletionOptions, setShowCompletionOptions] = useState(false);
  const [showImageGeneration, setShowImageGeneration] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null,
  );
  const MAX_ROUNDS = 5;

  // First story celebration state (US-004)
  const [showFirstStoryCelebration, setShowFirstStoryCelebration] =
    useState(false);
  const [firstStoryXpEarned, setFirstStoryXpEarned] = useState(0);

  // First image generation celebration state (US-005)
  const [showFirstImageCelebration, setShowFirstImageCelebration] =
    useState(false);

  // First streak achievement celebration state (US-006)
  const [showFirstStreakCelebration, setShowFirstStreakCelebration] =
    useState(false);
  // Track the previous streak to detect when it changes to 2+
  const previousStreakRef = useRef<number | null>(null);

  // First story guidance modal state (US-012)
  const [showFirstStoryGuidance, setShowFirstStoryGuidance] = useState(false);
  const [dontShowGuidanceAgain, setDontShowGuidanceAgain] = useState(false);
  // Store the pending action to execute after guidance is dismissed
  const pendingStoryActionRef = useRef<(() => void) | null>(null);

  // Voice input feature tooltip state (US-013)
  const [showVoiceInputTooltip, setShowVoiceInputTooltip] = useState(false);
  const [voiceButtonLayout, setVoiceButtonLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const voiceButtonContainerRef = useRef<View>(null);

  // Image generation feature tooltip state (US-014)
  const [showImageGenerationTooltip, setShowImageGenerationTooltip] =
    useState(false);
  const [imageGenerationLayout, setImageGenerationLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const imageGenerationContainerRef = useRef<View>(null);

  // XP/Challenges feature tooltip state (US-015)
  const [showXpChallengesTooltip, setShowXpChallengesTooltip] = useState(false);
  const [challengeDisplayLayout, setChallengeDisplayLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const challengeDisplayContainerRef = useRef<View>(null);

  // Enhanced empty state for new users (US-017)
  const [isNewUser, setIsNewUser] = useState(false);

  // Use the user's preferred grade level from their profile, or default to K-2
  const gradeLevel: GradeLevel =
    (userProfile?.preferred_grade_level as GradeLevel) || 'K-2';

  // Detect first streak achievement (US-006)
  // When streak changes from <2 to >=2, check if we should show the celebration
  useEffect(() => {
    const checkFirstStreakAchievement = async () => {
      const currentStreak = userProfile?.current_streak;
      const previousStreak = previousStreakRef.current;

      // Check if streak just changed from <2 to >=2 (first streak achieved)
      if (
        currentStreak !== undefined &&
        currentStreak >= 2 &&
        previousStreak !== null &&
        previousStreak < 2
      ) {
        console.log(
          `🔥 [US-006] Streak changed from ${previousStreak} to ${currentStreak}`,
        );

        // Check if this is truly the first streak and celebration should show
        const { shouldShowCelebration } =
          await onboardingMilestoneTracker.markFirstStreakAchieved();

        if (shouldShowCelebration) {
          console.log('🔥 [US-006] Showing first streak celebration!');
          // Award XP for first streak achievement (US-010)
          const xpResult = await awardOnboardingXP('first_streak');
          if (xpResult.success) {
            console.log(
              `🎁 [US-010] Awarded ${xpResult.xpAwarded} XP for first streak!`,
            );
          }
          setShowFirstStreakCelebration(true);
        }
      }

      // Update the ref for next comparison
      if (currentStreak !== undefined) {
        previousStreakRef.current = currentStreak;
      }
    };

    checkFirstStreakAchievement();
  }, [userProfile?.current_streak]);

  // Determine if user is "new" (US-017) - controls enhanced empty state display
  const onboardingCompleted = userProfile?.onboarding_completed;
  const hasUserProfile = !!userProfile;

  useEffect(() => {
    const loadNewUserStatus = async () => {
      try {
        // Check if user has completed onboarding (database field from US-007)
        if (onboardingCompleted === true) {
          setIsNewUser(false);
          return;
        }

        // Use database as source of truth for existing users
        // total_stories_completed > 0 means user has completed stories (not new)
        if (
          userProfile?.total_stories_completed &&
          userProfile.total_stories_completed > 0
        ) {
          setIsNewUser(false);
          console.log(
            '📋 [BugFix] Existing user detected via total_stories_completed:',
            userProfile.total_stories_completed,
          );

          // Auto-fix database: set onboarding_completed = true for existing users
          if (!onboardingCompleted && userProfile.id) {
            onboardingService
              .markOnboardingComplete(userProfile.id)
              .then(result => {
                if (result.error) {
                  console.error(
                    '❌ Failed to auto-fix onboarding status:',
                    result.error,
                  );
                } else {
                  console.log(
                    '✅ Auto-fixed onboarding_completed for existing user',
                  );
                }
              });
          }
          return;
        }

        // Check AsyncStorage for users with no completed stories in database
        const progress =
          await onboardingMilestoneTracker.getMilestoneProgress();
        setIsNewUser(!progress.storiesCompleted);
      } catch (error) {
        console.error('❌ Error loading new user status:', error);
        setIsNewUser(true); // Assume new user on error
      }
    };

    if (hasUserProfile) {
      loadNewUserStatus();
    }
  }, [
    onboardingCompleted,
    hasUserProfile,
    userProfile?.total_stories_completed,
    userProfile?.id,
  ]);

  // US-017: Update new user status when first story celebration shows
  useEffect(() => {
    if (showFirstStoryCelebration) {
      setIsNewUser(false);
      console.log(
        '📚 [US-017] First story completed, hiding enhanced empty state',
      );
    }
  }, [showFirstStoryCelebration]);

  // Show voice input tooltip when game becomes active (US-013)
  // Tooltip appears near voice input button on first game with voice input enabled
  useEffect(() => {
    const checkVoiceInputTooltip = async () => {
      // Only check when game becomes active and voice input is enabled
      if (!isGameActive || !voiceInputEnabled) {
        setShowVoiceInputTooltip(false);
        return;
      }

      try {
        // Check if tooltip should be shown (first time seeing voice input)
        const shouldShow =
          await onboardingMilestoneTracker.shouldShowVoiceInputTooltip();

        if (shouldShow) {
          // Small delay to ensure the voice button is rendered and measurable
          setTimeout(() => {
            // Measure voice button position for tooltip placement
            if (voiceButtonContainerRef.current) {
              voiceButtonContainerRef.current.measureInWindow(
                (x, y, width, height) => {
                  setVoiceButtonLayout({ x, y, width, height });
                  setShowVoiceInputTooltip(true);
                  console.log('💡 [US-013] Showing voice input tooltip');
                },
              );
            } else {
              // Fallback: show tooltip without precise positioning
              setShowVoiceInputTooltip(true);
              console.log(
                '💡 [US-013] Showing voice input tooltip (no ref available)',
              );
            }
          }, 500); // Wait for layout to stabilize
        }
      } catch (error) {
        console.error('❌ Error checking voice input tooltip:', error);
      }
    };

    checkVoiceInputTooltip();
  }, [isGameActive, voiceInputEnabled]);

  // Handle voice input tooltip dismissal (US-013)
  const handleVoiceInputTooltipDismiss = useCallback(async () => {
    setShowVoiceInputTooltip(false);
    try {
      await onboardingMilestoneTracker.markVoiceInputTooltipShown();
    } catch (error) {
      console.error('❌ Error marking voice input tooltip as shown:', error);
    }
  }, []);

  // Show image generation tooltip when image generation modal opens (US-014)
  // Tooltip appears to inform new users that AI creates grade-level illustrations
  useEffect(() => {
    const checkImageGenerationTooltip = async () => {
      // Only check when image generation modal is shown
      if (!showImageGeneration) {
        setShowImageGenerationTooltip(false);
        return;
      }

      try {
        // Check if tooltip should be shown (first time seeing image generation)
        const shouldShow =
          await onboardingMilestoneTracker.shouldShowImageGenerationTooltip();

        if (shouldShow) {
          // Small delay to ensure the image generation container is rendered and measurable
          setTimeout(() => {
            // Measure image generation container position for tooltip placement
            if (imageGenerationContainerRef.current) {
              imageGenerationContainerRef.current.measureInWindow(
                (x, y, width, height) => {
                  setImageGenerationLayout({ x, y, width, height });
                  setShowImageGenerationTooltip(true);
                  console.log('💡 [US-014] Showing image generation tooltip');
                },
              );
            } else {
              // Fallback: show tooltip without precise positioning
              setShowImageGenerationTooltip(true);
              console.log(
                '💡 [US-014] Showing image generation tooltip (no ref available)',
              );
            }
          }, 500); // Wait for layout to stabilize
        }
      } catch (error) {
        console.error('❌ Error checking image generation tooltip:', error);
      }
    };

    checkImageGenerationTooltip();
  }, [showImageGeneration]);

  // Handle image generation tooltip dismissal (US-014)
  const handleImageGenerationTooltipDismiss = useCallback(async () => {
    setShowImageGenerationTooltip(false);
    try {
      await onboardingMilestoneTracker.markImageGenerationTooltipShown();
    } catch (error) {
      console.error(
        '❌ Error marking image generation tooltip as shown:',
        error,
      );
    }
  }, []);

  // Show XP/Challenges tooltip when game becomes active with a challenge (US-015)
  // Tooltip appears to inform new users about the XP and challenge system
  useEffect(() => {
    const checkXpChallengesTooltip = async () => {
      // Only check when game is active and there's a current challenge displayed
      if (!isGameActive || !currentChallenge) {
        setShowXpChallengesTooltip(false);
        return;
      }

      try {
        // Check if tooltip should be shown (first time seeing challenges during a story)
        const shouldShow =
          await onboardingMilestoneTracker.shouldShowXpChallengesTooltip();

        if (shouldShow) {
          // Small delay to ensure the challenge display container is rendered and measurable
          setTimeout(() => {
            // Measure challenge display container position for tooltip placement
            if (challengeDisplayContainerRef.current) {
              challengeDisplayContainerRef.current.measureInWindow(
                (x, y, width, height) => {
                  setChallengeDisplayLayout({ x, y, width, height });
                  setShowXpChallengesTooltip(true);
                  console.log('💡 [US-015] Showing XP/Challenges tooltip');
                },
              );
            } else {
              // Fallback: show tooltip without precise positioning
              setShowXpChallengesTooltip(true);
              console.log(
                '💡 [US-015] Showing XP/Challenges tooltip (no ref available)',
              );
            }
          }, 500); // Wait for layout to stabilize
        }
      } catch (error) {
        console.error('❌ Error checking XP/Challenges tooltip:', error);
      }
    };

    checkXpChallengesTooltip();
  }, [isGameActive, currentChallenge]);

  // Handle XP/Challenges tooltip dismissal (US-015)
  const handleXpChallengesTooltipDismiss = useCallback(async () => {
    setShowXpChallengesTooltip(false);
    try {
      await onboardingMilestoneTracker.markXpChallengesTooltipShown();
    } catch (error) {
      console.error('❌ Error marking XP/Challenges tooltip as shown:', error);
    }
  }, []);

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

  // Animated keyboard handling - smooth slide up when keyboard appears
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event: KeyboardEvent) => {
        // Animate content up with spring animation for natural feel
        Animated.spring(keyboardHeight, {
          toValue: event.endCoordinates.height,
          useNativeDriver: false,
          tension: 100,
          friction: 10,
        }).start();

        // Scroll to input after a brief delay to ensure layout is updated
        setTimeout(() => {
          storyScrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      },
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        // Animate content back down with spring animation
        Animated.spring(keyboardHeight, {
          toValue: 0,
          useNativeDriver: false,
          tension: 100,
          friction: 10,
        }).start();
      },
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, [keyboardHeight]);

  // Auto-scroll to show latest story contribution
  useEffect(() => {
    if (!currentSession?.contributions) return;

    const contributionCount = currentSession.contributions.length;

    // Only scroll when new contributions are added (skip initial render)
    if (contributionCount > 0) {
      // Small delay to allow layout to settle after content render
      const scrollTimer = setTimeout(() => {
        storyScrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);

      return () => clearTimeout(scrollTimer);
    }
  }, [currentSession?.contributions?.length]);

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
        if (__DEV__) {
          console.log('🔊 [HomeScreen] Initializing TTS service...');
        }
        await textToSpeechService.initialize();

        // Check TTS availability after initialization
        const ttsAvailable = textToSpeechService.isServiceAvailable();
        if (__DEV__) {
          console.log('🔊 [HomeScreen] TTS availability check result:', {
            ttsAvailable,
            platform: Platform.OS,
            isDev: __DEV__,
          });
        }
        setTtsServiceAvailable(ttsAvailable);

        if (ttsAvailable) {
          await textToSpeechService.setGradeLevelOptions(gradeLevel);

          // Set up TTS event listeners with pause/resume state tracking
          // IMPORTANT: Use functional state updates to check current state
          // This prevents race conditions where stop() is called but onStart fires later
          textToSpeechService.setupEventListeners({
            onStart: () => {
              console.log('🔊 TTS started event received');
              // Only update to 'speaking' if we're in 'starting' state
              // If we're already 'idle' (stop was called), ignore this event
              setSpeakerState(currentState => {
                if (currentState === 'starting') {
                  console.log('🔊 TTS started - transitioning to speaking');
                  // Announce state change for screen readers
                  const { AccessibilityInfo } = require('react-native');
                  AccessibilityInfo.announceForAccessibility(
                    'Story playback started',
                  );
                  return 'speaking';
                }
                console.log(
                  '🔊 TTS started but state is',
                  currentState,
                  '- ignoring (stop was requested)',
                );
                return currentState;
              });
            },
            onFinish: () => {
              console.log('✅ TTS finished');
              setSpeakerState('idle');
              setSpeakerButtonEnabled(false); // Disable button when speech finishes
              // Announce completion for screen readers
              const { AccessibilityInfo } = require('react-native');
              AccessibilityInfo.announceForAccessibility(
                'Story playback finished',
              );
            },
            onCancel: () => {
              console.log('🛑 TTS cancelled');
              setSpeakerState('idle');
              setSpeakerButtonEnabled(false); // Disable button when speech is cancelled
            },
            onError: error => {
              console.error('❌ TTS Error:', error);
              setSpeakerState('idle');
              setSpeakerButtonEnabled(false); // Disable button on error
            },
            // Note: react-native-tts may not support pause/resume events natively
            // We'll track pause/resume state manually in pause()/resume() methods
            onPause: () => {
              console.log('⏸️ TTS paused');
              // Only update if we're currently speaking
              setSpeakerState(currentState => {
                if (currentState === 'speaking') {
                  // Announce pause for screen readers
                  const { AccessibilityInfo } = require('react-native');
                  AccessibilityInfo.announceForAccessibility(
                    'Story playback paused',
                  );
                  return 'paused';
                }
                return currentState;
              });
            },
            onResume: () => {
              console.log('▶️ TTS resumed');
              // Only update if we're currently paused
              setSpeakerState(currentState => {
                if (currentState === 'paused') {
                  // Announce resume for screen readers
                  const { AccessibilityInfo } = require('react-native');
                  AccessibilityInfo.announceForAccessibility(
                    'Story playback resumed',
                  );
                  return 'speaking';
                }
                return currentState;
              });
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

  // Voice input handler - replaces text during active recording, appends on new recording
  // Also known as handleVoiceTranscription for task documentation
  //
  // IMPORTANT: Voice recognition libraries send CUMULATIVE partial results
  // (e.g., "The" → "The force" → "The force seemed"), NOT incremental changes.
  // We must REPLACE the text during an active voice session to avoid duplication.
  const handleVoiceResult = useCallback(
    async (text: string) => {
      console.log('🎤 handleVoiceResult called with text:', text);
      // Handle empty transcriptions gracefully
      if (!text || !text.trim()) {
        console.log('⚠️ Empty transcription received, ignoring');
        return;
      }

      // Clean transcribed text: trim whitespace and normalize
      const cleanedText = text.trim().replace(/\s+/g, ' '); // Normalize multiple spaces to single space
      console.log('✅ Cleaned text:', cleanedText);

      // REPLACE the text instead of appending
      // Voice recognition sends cumulative results (the entire transcription so far),
      // not just the new words. Appending would cause duplication like:
      // "The" + " The force" + " The force seemed" = "The The force The force seemed"
      //
      // Instead, we simply replace the entire input with the latest transcription
      console.log('✅ Setting voice text:', cleanedText);
      setUserInput(cleanedText);

      // Track first voice input for onboarding milestone (US-010, US-011)
      try {
        const isFirst =
          await onboardingMilestoneTracker.markFirstVoiceInputUsed();
        if (isFirst) {
          console.log('🎤 First voice input used! Awarding XP.');
          // Award XP for first voice input (US-010)
          const xpResult = await awardOnboardingXP('first_voice');
          if (xpResult.success) {
            console.log(
              `🎁 [US-010] Awarded ${xpResult.xpAwarded} XP for first voice input!`,
            );
          }
        }
      } catch (error) {
        console.error('❌ Error tracking first voice input milestone:', error);
      }
    },
    [awardOnboardingXP],
  );

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

  // Guard to prevent multiple simultaneous button presses
  const [isHandlingPress, setIsHandlingPress] = useState(false);

  // Speaker button tap handler with pause/resume logic
  const handleSpeakerButtonPress = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (isHandlingPress) {
      if (__DEV__) {
        console.log(
          '🔊 [DEBUG] Button press already being handled, ignoring duplicate press',
        );
      }
      return;
    }

    if (__DEV__) {
      console.log('🔊 [DEBUG] Speaker button pressed!', {
        speakerState,
        speakerButtonEnabled,
        hasCurrentSession: !!currentSession,
        hasStoryContent: !!currentSession?.story_content,
        storyContentLength: currentSession?.story_content?.length || 0,
        ttsServiceAvailable,
        isHandlingPress,
      });
    }

    setIsHandlingPress(true);

    // Check if TTS service is available
    const isAvailable = textToSpeechService.isServiceAvailable();
    if (__DEV__) {
      console.log('🔊 [DEBUG] TTS service availability check:', {
        isAvailable,
        ttsServiceAvailableState: ttsServiceAvailable,
      });
    }

    try {
      if (!isAvailable) {
        // Update availability state
        setTtsServiceAvailable(false);
        // Disable button again since TTS is not available
        setSpeakerButtonEnabled(false);
        // Only show alert if this is the first time we're discovering it's unavailable
        // (i.e., if it was previously null or true, not already false)
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
        if (__DEV__) {
          console.log('⚠️ [DEBUG] No story content to read');
        }
        Alert.alert('No Story Content', 'There is no story content to read.', [
          { text: 'OK' },
        ]);
        return;
      }

      // Handle different states
      if (__DEV__) {
        console.log('🔊 [DEBUG] Handling speaker state:', speakerState);
      }
      if (speakerState === 'idle') {
        // Extract latest continuation (not full story)
        const latestContinuation = extractLatestContinuation(
          currentSession.story_content,
          currentSession,
        );

        if (__DEV__) {
          console.log('🔊 [DEBUG] Extracted continuation:', {
            continuationLength: latestContinuation.length,
            preview: latestContinuation.substring(0, 50) + '...',
          });
        }

        if (!latestContinuation.trim()) {
          if (__DEV__) {
            console.log('⚠️ [DEBUG] No continuation found to read');
          }
          Alert.alert('No Content', 'No continuation found to read.', [
            { text: 'OK' },
          ]);
          return;
        }

        // IMMEDIATELY set state to 'starting' to prevent race conditions
        // This ensures pressing the button again will trigger stop, not another start
        setSpeakerState('starting');
        setSpeakerButtonEnabled(true);

        // Clear any potentially queued utterances before starting new speech
        // This prevents buildup of queued speech that causes the "completes before stopping" issue
        try {
          await textToSpeechService.stop();
          if (__DEV__) {
            console.log('🔊 [DEBUG] Cleared TTS queue before starting');
          }
        } catch (clearError) {
          // Ignore clear errors - may not have anything to clear
          if (__DEV__) {
            console.log('🔊 [DEBUG] TTS queue clear (no-op):', clearError);
          }
        }

        // Start reading latest continuation
        if (__DEV__) {
          console.log('🔊 Starting to read latest continuation');
        }
        await textToSpeechService.speakStoryContent(
          latestContinuation,
          'narrative',
        );
        // State will be updated to 'speaking' via onStart event listener
        if (__DEV__) {
          console.log(
            '🔊 [DEBUG] Called speakStoryContent, waiting for onStart event',
          );
        }
      } else if (speakerState === 'speaking' || speakerState === 'starting') {
        // Stop current speech immediately (handles both 'speaking' and 'starting' states)
        if (__DEV__) {
          console.log(
            '🛑 Stopping speech - calling stop() directly, state was:',
            speakerState,
          );
        }

        // Call stop FIRST before updating UI state
        try {
          await textToSpeechService.stop();
          if (__DEV__) {
            console.log('🛑 [DEBUG] TTS stop() call completed successfully');
          }
        } catch (stopError: any) {
          // Stop failed - log but continue
          console.warn('⚠️ stop() failed:', stopError?.message || stopError);
        }

        // Update UI state after stop attempt
        setSpeakerState('idle');
        setSpeakerButtonEnabled(false);
        if (__DEV__) {
          console.log('🛑 [DEBUG] UI state updated to idle');
        }
      } else if (speakerState === 'paused') {
        // Resume paused speech - update UI immediately
        if (__DEV__) {
          console.log('▶️ Resuming speech - updating UI immediately');
        }
        // Optimistically update state immediately
        setSpeakerState('speaking');

        // Then attempt to resume TTS in the background
        try {
          await textToSpeechService.resume();
          if (__DEV__) {
            console.log('▶️ [DEBUG] TTS resume() call completed');
          }
        } catch (resumeError) {
          console.error('❌ Resume failed:', resumeError);
          // If resume fails, reset to idle and allow user to start fresh
          setSpeakerState('idle');
          setSpeakerButtonEnabled(false);
          Alert.alert(
            'Resume Failed',
            'Could not resume speech. Please start playback again.',
            [{ text: 'OK' }],
          );
        }
      }
    } catch (error) {
      console.error('❌ Error in speaker button handler:', error);
      // Don't show alert for every error - might be too frequent
      // Just log and reset state
      setSpeakerState('idle');
      setSpeakerButtonEnabled(false);
    } finally {
      // Always release the lock
      setIsHandlingPress(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakerState, speakerButtonEnabled, currentSession, isHandlingPress]); // ttsServiceAvailable not used in this callback

  // Handler for long-press to stop speech completely
  const handleSpeakerButtonLongPress = useCallback(async () => {
    if (speakerState === 'idle') {
      return; // Nothing to stop
    }

    if (__DEV__) {
      console.log(
        '🛑 [DEBUG] Speaker button long-pressed - stopping speech completely',
      );
    }

    // Update UI state immediately for instant feedback
    setSpeakerState('idle');
    setSpeakerButtonEnabled(false);

    // Then attempt to stop TTS in the background
    try {
      await textToSpeechService.stop();
      if (__DEV__) {
        console.log('🛑 [DEBUG] TTS stop() call completed');
      }
    } catch (stopError) {
      console.error('❌ Stop failed on long-press:', stopError);
      // State already updated, which is fine - user sees immediate feedback
      // On iOS, stop() might not work, but UI is already updated
    }
  }, [speakerState]);

  // Removed automatic session restoration - app should always start from home screen
  // Users can manually continue their story via the "Continue Story" button if needed
  // The checkForExistingSession function was removed as it's no longer needed

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
    if (!isAuthenticated) {
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
  }, [isAuthenticated, navigation]);

  // Handle story continuation from imported stories
  useEffect(() => {
    const continueStoryParams = route.params?.continueStory;

    if (
      continueStoryParams &&
      isAuthenticated &&
      effectiveUserId &&
      !isGameActive
    ) {
      console.log('📖 Detected story continuation request:', {
        sessionId: continueStoryParams.sessionId,
        source: continueStoryParams.storySource,
        gradeLevel: continueStoryParams.gradeLevel,
      });

      // Start the imported story continuation
      handleContinueImportedStory(continueStoryParams);
    }
  }, [
    route.params?.continueStory,
    isAuthenticated,
    effectiveUserId,
    isGameActive,
  ]);

  const handleContinueImportedStory = async (
    continueParams: NonNullable<HomeStackParamList['Home']>['continueStory'],
  ) => {
    if (!continueParams || !effectiveUserId) return;

    try {
      console.log('🚀 Starting imported story continuation...');

      setLoadingState(prev => ({
        ...prev,
        isGenerating: true,
        generationProgress: 0,
        currentTask: 'Loading your story...',
      }));

      startSpinAnimation();

      // Load the existing session from the database
      const existingSession = await storySessionManager.getSession(
        continueParams.sessionId,
      );

      if (existingSession) {
        console.log('✅ Loaded existing session:', existingSession.id);

        // Set up the game with the imported story
        setCurrentSession(existingSession);
        setIsGameActive(true);
        startFadeAnimation();

        // Initialize challenge system
        initializeChallengeSystem();

        // Reset round counter
        setCurrentRound(1);
        setIsGameCompleted(false);

        console.log('🎮 Story continuation started successfully');
      } else {
        throw new Error('Failed to load story session');
      }
    } catch (error) {
      console.error('❌ Error continuing imported story:', error);
      Alert.alert(
        'Error Loading Story',
        'Unable to load the selected story. Please try again.',
        [{ text: 'OK' }],
      );
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

  // Core story creation logic - extracted for reuse after guidance modal (US-012)
  // overrideUserId allows passing a resolved profile ID when userProfile context isn't updated yet
  const executeStartNewGame = async (overrideUserId?: string) => {
    const userIdToUse = overrideUserId || effectiveUserId;
    console.log('📖 executeStartNewGame: Starting new game flow', {
      overrideUserId,
      effectiveUserId,
      userIdToUse,
    });
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

      // Create new session using the resolved user ID
      if (!userIdToUse) {
        throw new Error('No user ID available to create session');
      }
      console.log(
        '📖 executeStartNewGame: Creating session for user:',
        userIdToUse,
      );
      const newSession = await storySessionManager.createSession(
        userIdToUse,
        gradeLevel,
        { difficulty: 1 },
      );
      console.log('📖 executeStartNewGame: Session created:', newSession.id);

      // Generate dynamic story starter using AI with diversity tracking
      const starterResponse = await storyAgentService.generateStoryStarter({
        gradeLevel,
        theme: 'adventure',
        sessionId: newSession.id,
        userId: userIdToUse,
        storyId: newSession.id, // Use session ID as story ID for the starter
      });

      if (starterResponse.success && starterResponse.story) {
        console.log(
          '📖 executeStartNewGame: Story starter generated successfully',
        );
        // Add AI story starter to session
        const updatedSession = await storySessionManager.addContribution(
          newSession.id,
          'ai',
          starterResponse.story,
          newSession,
        );
        console.log(
          '📖 executeStartNewGame: addContribution result:',
          updatedSession ? 'success' : 'null',
        );

        if (updatedSession) {
          console.log('📖 executeStartNewGame: Setting game active state');
          setCurrentSession({ ...updatedSession });
          setIsGameActive(true);
          startFadeAnimation();

          // Initialize challenge system
          initializeChallengeSystem();

          // Audio feedback removed - user must manually enable speaker button
          // if (voiceInputEnabled) {
          //   await textToSpeechService.addAudioCue('story_start');
          //   setTimeout(async () => {
          //     if (starterResponse.story) {
          //       await speakStoryContent(starterResponse.story);
          //     }
          //   }, 2000);
          // }
        } else {
          console.error(
            '❌ Failed to add AI contribution to session - session returned null',
          );
          Alert.alert(
            'Story Creation Failed',
            'Unable to start your story. Please try again.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Retry',
                onPress: () => setTimeout(executeStartNewGame, 1000),
              },
            ],
          );
          return;
        }
      } else {
        // Fallback to basic starter if AI fails
        console.log(
          '📖 executeStartNewGame: AI story starter failed, using fallback',
        );
        const fallbackStarter = await generateFallbackStarter();
        const updatedSession = await storySessionManager.addContribution(
          newSession.id,
          'ai',
          fallbackStarter,
          newSession,
        );
        console.log(
          '📖 executeStartNewGame: Fallback addContribution result:',
          updatedSession ? 'success' : 'null',
        );

        if (updatedSession) {
          console.log(
            '📖 executeStartNewGame: Setting game active state (fallback path)',
          );
          setCurrentSession({ ...updatedSession });
          setIsGameActive(true);
          startFadeAnimation();

          // Initialize challenge system
          initializeChallengeSystem();

          // Reset round counter for new game
          setCurrentRound(1);
          setIsGameCompleted(false);
        } else {
          console.error(
            '❌ Failed to add fallback contribution to session - session returned null',
          );
          Alert.alert(
            'Story Creation Failed',
            'Unable to start your story. Please try again.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Retry',
                onPress: () => setTimeout(executeStartNewGame, 1000),
              },
            ],
          );
          return;
        }
      }
    } catch (error) {
      const errorInfo = handleGenerationError(error, 'starting new game');

      if (errorInfo.retryable) {
        Alert.alert('⚠️ ' + errorInfo.message, errorInfo.suggestion, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Retry',
            onPress: () => setTimeout(executeStartNewGame, 1000),
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

  // Wrapper function that shows first story guidance modal if needed (US-012)
  const handleStartNewGame = async () => {
    console.log('📖 handleStartNewGame: Starting...', {
      isAuthenticated,
      effectiveUserId,
      userProfileId: userProfile?.id,
      userId: user?.id,
      clerkUserId: clerkAuth?.userId,
    });

    if (!isAuthenticated || !effectiveUserId) {
      console.log(
        '📖 handleStartNewGame: Not authenticated or no effectiveUserId',
      );
      Alert.alert('Error', 'Please log in to start a story');
      return;
    }

    // Check if effectiveUserId is a valid UUID for database operations
    // Clerk user IDs start with "user_" and are not valid UUIDs for Supabase
    const isClerkUserId = effectiveUserId.startsWith('user_');
    let resolvedProfileId = userProfile?.id;

    if (isClerkUserId && !resolvedProfileId) {
      console.log(
        '📖 handleStartNewGame: Clerk user detected without profile ID, fetching from database...',
      );

      // Directly fetch the profile from database - it may have been created but not loaded into context yet
      try {
        const { data: profiles, error: fetchError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('clerk_user_id', effectiveUserId)
          .limit(1);

        if (!fetchError && profiles && profiles.length > 0) {
          resolvedProfileId = profiles[0].id;
          console.log(
            '📖 handleStartNewGame: Found profile in database:',
            resolvedProfileId,
          );

          // Also trigger a background refresh to update the context
          refreshProfile().catch(err =>
            console.error(
              '📖 handleStartNewGame: Background refresh failed:',
              err,
            ),
          );
        } else {
          console.log(
            '📖 handleStartNewGame: No profile found in database',
            fetchError,
          );
        }
      } catch (error) {
        console.error('📖 handleStartNewGame: Error fetching profile:', error);
      }

      // If still no profile after database check, show the alert
      if (!resolvedProfileId) {
        console.log('📖 handleStartNewGame: No profile found, showing alert');
        Alert.alert(
          'Profile Setup Required',
          'Please complete your profile setup before starting a story. This ensures your progress is properly saved.',
          [
            {
              text: 'Complete Profile',
              onPress: () => navigation.navigate('Profile'),
            },
          ],
        );
        return;
      }
    }

    // Determine the user ID for session creation
    // For OAuth users (Clerk): use clerk_user_id for Convex operations
    // For email/password users (Supabase-only): use Supabase UUID, which falls back to Supabase storage
    const clerkUserIdForSession =
      userProfile?.clerk_user_id || clerkAuth?.userId;
    const supabaseUserId = userProfile?.id || user?.id;

    // Use Clerk user ID if available (OAuth users), otherwise use Supabase UUID (email/password users)
    const userIdForSession = clerkUserIdForSession || supabaseUserId;

    if (!userIdForSession) {
      console.log('📖 handleStartNewGame: No user ID available for session');
      Alert.alert(
        'Profile Setup Required',
        'Please complete your profile setup before starting a story. This ensures your progress is properly saved.',
        [
          {
            text: 'Complete Profile',
            onPress: () => navigation.navigate('Profile'),
          },
        ],
      );
      return;
    }

    const isEmailPasswordUser = !clerkUserIdForSession && !!supabaseUserId;
    console.log(
      '📖 handleStartNewGame: Using user ID for session:',
      userIdForSession,
      isEmailPasswordUser
        ? '(email/password user - Supabase fallback)'
        : '(OAuth user - Convex)',
    );

    // Check if first story guidance should be shown (US-012)
    try {
      const shouldShowGuidance =
        await onboardingMilestoneTracker.shouldShowFirstStoryGuidance();

      if (shouldShowGuidance) {
        // Store the action to execute after guidance is dismissed
        // Capture the user ID in a closure (works for both OAuth and email/password users)
        pendingStoryActionRef.current = () =>
          executeStartNewGame(userIdForSession);
        setShowFirstStoryGuidance(true);
        return;
      }
    } catch (error) {
      console.error('❌ Error checking first story guidance:', error);
      // Continue with story creation on error
    }

    // No guidance needed, proceed directly
    executeStartNewGame(userIdForSession);
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

      // Generate AI continuation with diversity tracking
      const aiResponse = await storyAgentService.continueStory({
        gradeLevel,
        storySoFar: updatedSession.story_content || '',
        userInput: userContribution,
        consistencyCheck: true,
        qualityThreshold: 0.7,
        sessionId: currentSession?.id || undefined,
        userId: effectiveUserId,
        storyId: currentSession?.id || undefined, // Use session ID as story ID
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

            // Check if this is the user's first story completion (US-004)
            const { shouldShowCelebration } =
              await onboardingMilestoneTracker.markFirstStoryCompleted();

            if (shouldShowCelebration) {
              // Award XP for first story completion (US-010)
              const xpResult = await awardOnboardingXP('first_story');
              if (xpResult.success) {
                console.log(
                  `🎁 [US-010] Awarded ${xpResult.xpAwarded} XP for first story!`,
                );
              }
              // Store XP earned for celebration modal (story XP + onboarding bonus)
              const totalXpEarned =
                (updatedSession.xp_earned || 0) + (xpResult.xpAwarded || 0);
              setFirstStoryXpEarned(totalXpEarned);

              // Show first story celebration before completion options
              setTimeout(() => {
                storyScrollViewRef.current?.scrollTo({
                  y: 0,
                  animated: false,
                });
                setShowFirstStoryCelebration(true);
              }, 1500);
            } else {
              // Not first story - show completion options directly
              setTimeout(() => {
                // Scroll to top to ensure modal is visible
                storyScrollViewRef.current?.scrollTo({
                  y: 0,
                  animated: false, // Instant scroll to prevent modal being off-screen
                });
                setShowCompletionOptions(true);
              }, 2000);
            }
          } else {
            // Only increment round counter if game is continuing
            const nextRound = currentRound + 1;
            setCurrentRound(nextRound);
          }

          // Provide audio feedback and optionally read the AI response
          // Auto-read removed - user must manually enable speaker button
          // if (voiceInputEnabled) {
          //   await provideContinuationFeedback();
          //   setTimeout(async () => {
          //     if (aiResponse.story) {
          //       await speakStoryContent(aiResponse.story);
          //     }
          //   }, 1000);
          // }
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

  // Handler for first story celebration modal (US-004)
  const handleFirstStoryCelebrationClose = useCallback(async () => {
    // Mark celebration as shown so it doesn't repeat
    await onboardingMilestoneTracker.markFirstStoryCelebrationShown();
    setShowFirstStoryCelebration(false);

    // Now show the regular completion options
    setTimeout(() => {
      setShowCompletionOptions(true);
    }, 300);
  }, []);

  // CTA handler for first story celebration - view the story
  const handleFirstStoryCelebrationCta = useCallback(async () => {
    await onboardingMilestoneTracker.markFirstStoryCelebrationShown();
    setShowFirstStoryCelebration(false);

    // Show completion options so user can interact with the story
    setTimeout(() => {
      setShowCompletionOptions(true);
    }, 300);
  }, []);

  // Handler for first image generation celebration modal (US-005)
  const handleFirstImageCelebrationClose = useCallback(async () => {
    // Mark celebration as shown so it doesn't repeat
    await onboardingMilestoneTracker.markFirstImageCelebrationShown();
    setShowFirstImageCelebration(false);
  }, []);

  // CTA handler for first image celebration - continue viewing
  const handleFirstImageCelebrationCta = useCallback(async () => {
    await onboardingMilestoneTracker.markFirstImageCelebrationShown();
    setShowFirstImageCelebration(false);
  }, []);

  // Handler for first streak achievement celebration modal (US-006)
  const handleFirstStreakCelebrationClose = useCallback(async () => {
    // Mark celebration as shown so it doesn't repeat
    await onboardingMilestoneTracker.markFirstStreakCelebrationShown();
    setShowFirstStreakCelebration(false);
  }, []);

  // CTA handler for first streak celebration
  const handleFirstStreakCelebrationCta = useCallback(async () => {
    await onboardingMilestoneTracker.markFirstStreakCelebrationShown();
    setShowFirstStreakCelebration(false);
  }, []);

  // Handler for first story guidance modal close (US-012)
  const handleFirstStoryGuidanceClose = useCallback(async () => {
    // If "don't show again" was checked, mark as permanently shown
    if (dontShowGuidanceAgain) {
      await onboardingMilestoneTracker.markFirstStoryGuidanceShown();
    }
    setShowFirstStoryGuidance(false);
    pendingStoryActionRef.current = null;
  }, [dontShowGuidanceAgain]);

  // Handler for "Let's Go!" button in first story guidance modal (US-012)
  const handleFirstStoryGuidanceProceed = useCallback(async () => {
    // Always mark guidance as shown when user proceeds
    await onboardingMilestoneTracker.markFirstStoryGuidanceShown();
    setShowFirstStoryGuidance(false);

    // Execute the pending story creation action
    if (pendingStoryActionRef.current) {
      const action = pendingStoryActionRef.current;
      pendingStoryActionRef.current = null;
      action();
    }
  }, []);

  // Handler for "Don't show again" toggle change (US-012)
  const handleDontShowGuidanceAgainChange = useCallback((value: boolean) => {
    setDontShowGuidanceAgain(value);
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

      // Check if this is the user's first image generation (US-005)
      try {
        const { shouldShowCelebration } =
          await onboardingMilestoneTracker.markFirstImageGenerated();
        if (shouldShowCelebration) {
          console.log('🎨 First image generated! Showing celebration modal.');
          // Award XP for first image generation (US-010)
          const xpResult = await awardOnboardingXP('first_image');
          if (xpResult.success) {
            console.log(
              `🎁 [US-010] Awarded ${xpResult.xpAwarded} XP for first image!`,
            );
          }
          setShowFirstImageCelebration(true);
        }
      } catch (error) {
        console.error('❌ Error checking first image milestone:', error);
      }

      // Auto-scroll to show the generated image after modal dismisses and image renders
      setTimeout(() => {
        storyScrollViewRef.current?.scrollToEnd({ animated: true });
      }, 300); // Delay to allow modal dismissal and image rendering

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

  const handleRetryImageUpload = useCallback(async () => {
    if (!currentSession || !effectiveUserId) {
      console.error('❌ Cannot retry upload: missing session or user ID');
      return;
    }

    try {
      console.log('🔄 Retrying Supabase image upload...');

      // Show loading alert
      Alert.alert(
        '🔄 Retrying Upload',
        'Attempting to backup your image to permanent storage...',
      );

      const result = await imageStorageService.retryFailedUpload(
        currentSession.id,
        effectiveUserId,
      );

      if (result.success) {
        Alert.alert(
          '✅ Success',
          'Image backup completed successfully! Your image is now permanently saved.',
        );

        // Reload session to get updated upload status
        const updatedSession = await storySessionManager.getSession(
          currentSession.id,
        );
        if (updatedSession) {
          setCurrentSession(updatedSession);
        }
      } else {
        Alert.alert(
          '❌ Retry Failed',
          result.error || 'Upload failed. Please try again later.',
        );
      }
    } catch (error: any) {
      console.error('❌ Retry upload error:', error);
      Alert.alert(
        '❌ Error',
        error.message ||
          'An unexpected error occurred while retrying the upload.',
      );
    }
  }, [currentSession, effectiveUserId]);

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
      <SafeAreaView style={styles.safeContainer}>
        {/* Fixed Top Section - Challenge Display */}
        {currentChallenge && !showCompletionOptions && (
          <View style={styles.challengeHeaderSection}>
            <View ref={challengeDisplayContainerRef} collapsable={false}>
              <ChallengeDisplay
                challenge={currentChallenge}
                progress={challengeProgress.find(
                  p => p.challengeId === currentChallenge.id,
                )}
                compact={true}
              />
            </View>
          </View>
        )}

        {/* Flex Middle Section - Story Content */}
        <View style={styles.storyContentSection}>
          <ScrollView
            ref={storyScrollViewRef}
            style={styles.storyScrollContainer}
            contentContainerStyle={styles.storyScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.gameContainer}>
              {/* Story Display - Book Format */}
              <View style={styles.storyBookContainer}>
                <View style={styles.storyBookHeader}>
                  <View style={styles.storyTitleRow}>
                    <Text style={styles.storyBookTitle}>📖 Your Story</Text>
                    <Text style={styles.gradeLevel}>{gradeLevel}</Text>
                    {currentSession?.story_source === 'New' && (
                      <Text style={styles.roundCounter}>
                        Round {currentRound}/{MAX_ROUNDS}
                      </Text>
                    )}
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
                        Alert.alert(
                          '📝 No Story',
                          'No story content to copy yet',
                          [{ text: 'OK' }],
                        );
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

              {/* Generated Image Display */}
              {(() => {
                const shouldShowImage =
                  (generatedImageUrl ||
                    currentSession?.generated_image_url ||
                    currentSession?.supabase_image_url) &&
                  currentSession;
                console.log('🖼️ [DEBUG] Image display check:', {
                  generatedImageUrl:
                    generatedImageUrl?.substring(0, 50) + '...',
                  sessionImageUrl:
                    currentSession?.generated_image_url?.substring(0, 50) +
                    '...',
                  supabaseImageUrl:
                    currentSession?.supabase_image_url?.substring(0, 50) +
                    '...',
                  uploadStatus: currentSession?.image_upload_status,
                  hasCurrentSession: !!currentSession,
                  shouldShowImage,
                });
                return shouldShowImage;
              })() ? (
                <View style={styles.imageDisplayContainerOverlay}>
                  <StoryImageDisplay
                    replicateUrl={
                      generatedImageUrl ||
                      currentSession?.generated_image_url ||
                      undefined
                    }
                    supabaseUrl={
                      currentSession?.supabase_image_url || undefined
                    }
                    uploadStatus={currentSession?.image_upload_status}
                    storyTitle={`${
                      currentSession?.story_content
                        ?.split(' ')
                        .slice(0, 6)
                        .join(' ') || 'Your Story'
                    }...`}
                    sessionId={currentSession?.id || ''}
                    userId={effectiveUserId || ''}
                    showBackButton={true}
                    displayMode="responsive"
                    enableFullScreen={false}
                    onBackToOptions={() => {
                      // Scroll to top to ensure completion options modal is visible
                      storyScrollViewRef.current?.scrollTo({
                        y: 0,
                        animated: true,
                      });
                      setShowCompletionOptions(true);
                    }}
                    onRetryUpload={handleRetryImageUpload}
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
                      onPress={() => {
                        // Scroll to top to ensure completion options modal is visible
                        storyScrollViewRef.current?.scrollTo({
                          y: 0,
                          animated: true,
                        });
                        setShowCompletionOptions(true);
                      }}
                    >
                      <Text style={styles.backToOptionsText}>
                        ← Back to Options
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
            </View>
          </ScrollView>
        </View>

        {/* Fixed Bottom Section - Input Controls */}
        <Animated.View
          style={[
            styles.fixedInputSection,
            {
              paddingBottom: Animated.add(keyboardHeight, 4),
            },
          ]}
        >
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
                {(() => {
                  // Button is disabled if:
                  // 1. No story content exists, OR
                  // 2. No continuation exists (only starter, no AI response yet)
                  const hasStoryContent =
                    !!currentSession?.story_content?.trim();
                  const hasContinuation =
                    hasStoryContent &&
                    (() => {
                      // Check if there's at least one AI contribution (continuation)
                      if (
                        currentSession?.contributions &&
                        currentSession.contributions.length > 0
                      ) {
                        return currentSession.contributions.some(
                          c => c.type === 'ai',
                        );
                      }
                      // Fallback: check if we can extract a continuation (more than just starter)
                      const latestContinuation = extractLatestContinuation(
                        currentSession?.story_content,
                        currentSession,
                      );
                      return latestContinuation.trim().length > 0;
                    })();

                  // Button is always pressable when there's content, regardless of speaking state
                  // This allows users to stop TTS even while it's speaking
                  const canUseSpeaker = hasStoryContent && hasContinuation;
                  // Only visually disable if there's no content - button should work when speaking to allow stopping
                  const isVisuallyDisabled = !canUseSpeaker;

                  if (__DEV__) {
                    console.log('🔊 [DEBUG] Speaker button render:', {
                      hasCurrentSession: !!currentSession,
                      hasStoryContent,
                      hasContinuation,
                      storyContentLength:
                        currentSession?.story_content?.length || 0,
                      contributionsCount:
                        currentSession?.contributions?.length || 0,
                      ttsServiceAvailable,
                      speakerButtonEnabled,
                      canUseSpeaker,
                      isVisuallyDisabled,
                      speakerState,
                    });
                  }
                  return (
                    <TouchableOpacity
                      testID="speaker-button"
                      style={[
                        styles.readStoryButton,
                        isVisuallyDisabled && styles.disabledButton,
                        // Show visual indication if TTS is unavailable but button is still enabled
                        !isVisuallyDisabled &&
                          ttsServiceAvailable === false &&
                          styles.warningButton,
                      ]}
                      onPress={() => {
                        if (__DEV__) {
                          console.log(
                            '🔊 [DEBUG] TouchableOpacity onPress triggered!',
                            {
                              hasCurrentSession: !!currentSession,
                              hasStoryContent: !!currentSession?.story_content,
                              ttsServiceAvailable,
                              speakerButtonEnabled,
                              canUseSpeaker,
                              isVisuallyDisabled,
                            },
                          );
                        }
                        // Only handle press if there's content to read
                        if (!canUseSpeaker) {
                          Alert.alert(
                            'No Content',
                            'No continuation found to read.',
                            [{ text: 'OK' }],
                          );
                          return;
                        }
                        handleSpeakerButtonPress();
                      }}
                      onLongPress={() => {
                        if (
                          canUseSpeaker &&
                          (speakerState === 'speaking' ||
                            speakerState === 'paused')
                        ) {
                          handleSpeakerButtonLongPress();
                        }
                      }}
                      disabled={!canUseSpeaker} // Only disable if no content, not for enabled state
                      activeOpacity={isVisuallyDisabled ? 1 : 0.7}
                      accessibilityLabel={
                        ttsServiceAvailable === false
                          ? 'Read story (disabled - TTS unavailable)'
                          : !currentSession?.story_content
                          ? 'Read story (disabled - no content)'
                          : speakerState === 'idle'
                          ? 'Read story'
                          : speakerState === 'speaking' ||
                            speakerState === 'starting'
                          ? 'Stop story playback'
                          : 'Resume story playback'
                      }
                      accessibilityHint={
                        ttsServiceAvailable === false
                          ? 'Text-to-speech is not available on this device. You can still read the story on screen.'
                          : !currentSession?.story_content
                          ? 'Story content is required to read'
                          : speakerState === 'idle'
                          ? 'Tap to start reading the latest story continuation'
                          : speakerState === 'speaking' ||
                            speakerState === 'starting'
                          ? 'Tap to stop the story playback immediately'
                          : 'Tap to resume the story playback'
                      }
                      accessibilityRole="button"
                      accessibilityState={{
                        disabled: !canUseSpeaker,
                      }}
                    >
                      <Text style={styles.emojiButtonText}>
                        {speakerState === 'idle' ? '🔊' : '⏹️'}
                      </Text>
                    </TouchableOpacity>
                  );
                })()}

                {/* Voice Input Component with Tooltip (US-013) */}
                <View ref={voiceButtonContainerRef} collapsable={false}>
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
                </View>

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
        </Animated.View>

        {/* First Story Celebration Modal (US-004) */}
        <CelebrationModal
          visible={showFirstStoryCelebration}
          title="You wrote your first story!"
          message="Amazing work! You've completed your very first collaborative story with AI. This is just the beginning of your creative journey!"
          icon="🎉"
          ctaText="See My Story"
          onClose={handleFirstStoryCelebrationClose}
          onCtaPress={handleFirstStoryCelebrationCta}
          secondaryMessage={
            firstStoryXpEarned > 0
              ? `+${firstStoryXpEarned} XP earned!`
              : undefined
          }
        />

        {/* First Image Generation Celebration Modal (US-005) */}
        <CelebrationModal
          visible={showFirstImageCelebration}
          title="Your story came to life!"
          message="Amazing! AI has created a unique illustration just for your story. The art style is tailored to match your grade level for the perfect look!"
          icon="🎨"
          ctaText="View My Illustration"
          onClose={handleFirstImageCelebrationClose}
          onCtaPress={handleFirstImageCelebrationCta}
          secondaryMessage="+25 XP earned!"
        />

        {/* First Streak Achievement Celebration Modal (US-006) */}
        <CelebrationModal
          visible={showFirstStreakCelebration}
          title="You're on fire! 2-day streak!"
          message="You're building an amazing writing habit! Keep the streak going by writing stories every day. Consistency is the key to becoming a great storyteller!"
          icon="🔥"
          ctaText="Keep Going!"
          onClose={handleFirstStreakCelebrationClose}
          onCtaPress={handleFirstStreakCelebrationCta}
          secondaryMessage="+50 Bonus XP for your streak!"
        />

        {/* First Story Guidance Modal (US-012) */}
        <FirstStoryGuidanceModal
          visible={showFirstStoryGuidance}
          onClose={handleFirstStoryGuidanceClose}
          onProceed={handleFirstStoryGuidanceProceed}
          showDontShowAgain={true}
          onDontShowAgainChange={handleDontShowGuidanceAgainChange}
        />

        {/* Voice Input Feature Tooltip (US-013) */}
        <FeatureTooltip
          visible={showVoiceInputTooltip}
          text="Tap to speak your story instead of typing"
          icon="🎤"
          position="top"
          targetLayout={voiceButtonLayout || undefined}
          onDismiss={handleVoiceInputTooltipDismiss}
          autoHideDelay={5000}
        />

        {/* XP/Challenges Feature Tooltip (US-015) */}
        <FeatureTooltip
          visible={showXpChallengesTooltip}
          text="Complete challenges for bonus XP and level up!"
          icon="🏆"
          position="bottom"
          targetLayout={challengeDisplayLayout || undefined}
          onDismiss={handleXpChallengesTooltipDismiss}
          autoHideDelay={5000}
        />

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
                    Congratulations! You've completed your {MAX_ROUNDS}
                    -round story adventure!
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
                    <Text style={styles.completionStat}>
                      💰 XP Earned: {currentSession?.xp_earned || 0}
                    </Text>
                    <Text style={styles.completionStat}>
                      ⭐ Total XP:{' '}
                      {userProfile
                        ? (userProfile.total_xp || 0) +
                          (currentSession?.xp_earned || 0)
                        : 'Loading...'}
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

        {/* Image Generation Modal Overlay */}
        {showImageGeneration && currentSession && (
          <Pressable
            style={styles.imageGenerationModalOverlay}
            onPress={() => {
              Alert.alert(
                'Cancel Image Generation?',
                'You can generate an image later from the completion options.',
                [
                  { text: 'Continue Generating', style: 'cancel' },
                  {
                    text: 'Cancel',
                    style: 'destructive',
                    onPress: () => setShowImageGeneration(false),
                  },
                ],
              );
            }}
          >
            <Pressable
              style={styles.imageGenerationScrollView}
              onPress={e => e.stopPropagation()}
            >
              <ScrollView
                contentContainerStyle={styles.imageGenerationScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Image Generation Container with ref for tooltip positioning (US-014) */}
                <View
                  ref={imageGenerationContainerRef}
                  style={styles.imageGenerationContainer}
                  collapsable={false}
                >
                  <ImageGeneration
                    storyContent={currentSession.story_content || ''}
                    sessionId={currentSession.id}
                    gradeLevel={gradeLevel}
                    wordCount={currentSession.sessionStats.userWords}
                    onImageGenerated={handleImageGenerated}
                    onError={handleImageGenerationError}
                    onClose={() => setShowImageGeneration(false)}
                    disabled={!isGameCompleted}
                    isStoryCompleted={isGameCompleted}
                    currentRound={currentRound}
                    maxRounds={MAX_ROUNDS}
                  />
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        )}

        {/* Image Generation Feature Tooltip (US-014) */}
        <FeatureTooltip
          visible={showImageGenerationTooltip}
          text="AI creates illustrations matching your grade level!"
          icon="🎨"
          position="bottom"
          targetLayout={imageGenerationLayout || undefined}
          onDismiss={handleImageGenerationTooltipDismiss}
          autoHideDelay={5000}
        />
      </SafeAreaView>
    );
  }

  // Handler for "See how it works" button in EnhancedEmptyState (US-017)
  const handleSeeHowItWorks = () => {
    setShowFirstStoryGuidance(true);
    console.log('📚 [US-017] Opening guidance modal from enhanced empty state');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.homeContainer}>
        {/* US-017: Enhanced Empty State for new users */}
        {isNewUser ? (
          <>
            <EnhancedEmptyState
              userName={userProfile?.display_name}
              onStartFirstStory={handleStartNewGame}
              onSeeHowItWorks={handleSeeHowItWorks}
              isLoading={loadingState.isGenerating}
            />
          </>
        ) : (
          <>
            {/* Welcome Section - for returning users */}
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
          </>
        )}
      </View>

      {/* First Story Guidance Modal (US-012) - added here for non-game-active state */}
      <FirstStoryGuidanceModal
        visible={showFirstStoryGuidance}
        onClose={handleFirstStoryGuidanceClose}
        onProceed={handleFirstStoryGuidanceProceed}
        showDontShowAgain={true}
        onDontShowAgainChange={handleDontShowGuidanceAgainChange}
      />
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
  // New three-section layout styles
  safeContainer: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  challengeHeaderSection: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
    zIndex: 10,
  },
  storyContentSection: {
    flex: 1,
    paddingHorizontal: 8,
  },
  storyScrollContainer: {
    flex: 1,
  },
  storyScrollContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  fixedInputSection: {
    backgroundColor: '#f0f2f5',
    paddingHorizontal: 8,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  gameContainer: {
    padding: 8,
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
  inputSection: {},
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
  warningButton: {
    // Visual indication that TTS is unavailable but button still works
    opacity: 0.8,
    borderWidth: 1,
    borderColor: '#ff9800',
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
    marginBottom: 0,
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
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 40,
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
  // Image Generation Modal Overlay Styles
  imageGenerationModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent backdrop
    zIndex: 1001, // Above completion modal (zIndex: 1000)
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageGenerationScrollView: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageGenerationScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  imageGenerationContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 0, // ImageGeneration has its own padding (16px)
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
    borderWidth: 3,
    borderColor: '#9C27B0', // Purple border to distinguish from green completion modal
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
