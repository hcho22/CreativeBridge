import React, {
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
  useRef,
  useMemo,
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
  LayoutAnimation,
  Platform,
  Keyboard,
  KeyboardEvent,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import { useRoute, RouteProp } from '@react-navigation/native';
import {
  BottomTabNavigationProp,
  useBottomTabBarHeight,
} from '@react-navigation/bottom-tabs';
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
import type { StorySetupAnswers } from '../types/storySetup';
import { resolveStorySetup } from '../utils/storySetupDefaults';
import { textToSpeechService } from '../services/textToSpeechIsolated';
import { StoryInputDebouncer } from '../utils/debounceUtils';
import { extractLatestContinuation } from '../utils/storyUtils';
import { challengeService } from '../services/challengeService';
import { Challenge, ChallengeProgress } from '../types/challenges';
import ChallengeDisplay from '../components/common/ChallengeDisplay';
import ImageGeneration from '../components/common/ImageGeneration';
import { storyDownloadService } from '../services/storyDownloadService';
import { imageStorageService } from '../services/imageStorageService';
import RNFS, { rnfsWrapper } from '../utils/rnfsWrapper';
import { VoiceInput } from '../components/common/VoiceInput';
import Share from '../utils/shareWrapper';
import { CelebrationModal } from '../components/common/CelebrationModal';
import {
  FirstStoryGuidanceModal,
  EnhancedEmptyState,
} from '../components/onboarding';
import { onboardingMilestoneTracker } from '../services/onboardingMilestoneTracker';
import { AdaptiveGlassBackground } from '../components/common/AdaptiveGlassBackground';
import { ImageDisplayModal } from '../components/common/ImageDisplayModal';
import { useMutation } from 'convex/react';
import { getConvexClient, api, isConvexReady } from '../services/convex';
import type { Id } from '../../convex/_generated/dataModel';

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
  const { userProfile, refreshProfile, awardOnboardingXP } = useAuth();
  const { clerkAuth } = useSafeClerkAuth();
  const route = useRoute<RouteProp<HomeStackParamList, 'Home'>>();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();

  // All users authenticate via Clerk — use Clerk user ID for all operations
  const effectiveUserId = clerkAuth?.userId || userProfile?.clerk_user_id;
  const isAuthenticated = !!clerkAuth?.isSignedIn;

  // useMutation for recording milestones — uses React auth context (reliable),
  // unlike convexClient.mutation() which can silently fail auth.
  const recordOnboardingMilestone = useMutation(
    api.onboarding.recordOnboardingMilestone,
  );

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
  const floatingBarBottom = useMemo(
    () => Animated.add(new Animated.Value(tabBarHeight + 8), keyboardHeight),
    [keyboardHeight, tabBarHeight],
  );
  const storyScrollViewRef = useRef<ScrollView>(null);
  const storyInputRef = useRef<TextInput>(null);

  // Game round tracking
  const [currentRound, setCurrentRound] = useState(1);
  const [isGameCompleted, setIsGameCompleted] = useState(false);
  const [showCompletionOptions, setShowCompletionOptions] = useState(false);
  const [showImageGeneration, setShowImageGeneration] = useState(false);
  const [showImageDisplayModal, setShowImageDisplayModal] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null,
  );
  const MAX_ROUNDS = 5;

  // "User starts first" mode (US-011): user writes the opening line instead of AI
  const [isUserStarting, setIsUserStarting] = useState(false);

  // US-004: Collapsible loaded story section
  const [isLoadedStoryExpanded, setIsLoadedStoryExpanded] = useState(true);
  // US-007: Independent collapse state for previous continuation segment
  const [isPrevContinuationExpanded, setIsPrevContinuationExpanded] =
    useState(false);

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
  // Shown once after signup; subsequent access via Settings tab
  const [showFirstStoryGuidance, setShowFirstStoryGuidance] = useState(false);

  // Ref to track if TTS has been initialized to prevent re-initialization loops
  const ttsInitializedRef = useRef(false);

  // Speaker button enabled logic — extracted for reuse in floating input bar (US-001)
  const canUseSpeaker = useMemo(() => {
    const hasStoryContent = !!currentSession?.story_content?.trim();
    if (!hasStoryContent) return false;

    // Check if there's at least one AI contribution (continuation)
    if (
      currentSession?.contributions &&
      currentSession.contributions.length > 0
    ) {
      return currentSession.contributions.some(c => c.type === 'ai');
    }
    // Fallback: check if we can extract a continuation (more than just starter)
    const latestContinuation = extractLatestContinuation(
      currentSession?.story_content,
      currentSession,
    );
    return latestContinuation.trim().length > 0;
  }, [currentSession?.story_content, currentSession?.contributions]);

  // Enhanced empty state for new users (US-017)
  const [isNewUser, setIsNewUser] = useState(false);

  // Use the user's preferred grade level from their profile, or default to K-2
  // Memoize to prevent infinite re-renders in useEffect dependencies
  const gradeLevel: GradeLevel = useMemo(
    () => (userProfile?.preferred_grade_level as GradeLevel) || 'K-2',
    [userProfile?.preferred_grade_level],
  );

  // Use the user's preferred story genre from their profile (US-007)
  const preferredGenre = useMemo(
    () => userProfile?.preferred_genre,
    [userProfile?.preferred_genre],
  );

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
        const { shouldShowCelebration, isFirstStreak } =
          await onboardingMilestoneTracker.markFirstStreakAchieved();

        // Sync milestone to Convex via useMutation hook (React auth context)
        if (isFirstStreak && effectiveUserId) {
          try {
            await recordOnboardingMilestone({
              clerkUserId: effectiveUserId,
              milestoneType: 'first_streak',
              awardXp: false,
            });
          } catch (err) {
            console.error('⚠️ Failed to sync streak milestone to Convex:', err);
          }
        }

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
        // total_stories_completed > 0 means user has used the app before (not new)
        if (
          userProfile?.total_stories_completed &&
          userProfile.total_stories_completed > 0
        ) {
          setIsNewUser(false);
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

  // Auto-show onboarding progress modal once for brand-new users
  useEffect(() => {
    if (!isNewUser) return;
    const autoShowOnboarding = async () => {
      try {
        const shouldShow =
          await onboardingMilestoneTracker.shouldShowFirstStoryGuidance();
        if (shouldShow) {
          setShowFirstStoryGuidance(true);
          // Mark as shown immediately so it never auto-triggers again
          await onboardingMilestoneTracker.markFirstStoryGuidanceShown();
        }
      } catch (error) {
        console.error('❌ Error auto-showing onboarding:', error);
      }
    };
    autoShowOnboarding();
  }, [isNewUser]);

  // US-017: Update new user status when first story celebration shows
  useEffect(() => {
    if (showFirstStoryCelebration) {
      setIsNewUser(false);
      console.log(
        '📚 [US-017] First story completed, hiding enhanced empty state',
      );
    }
  }, [showFirstStoryCelebration]);

  // Control header visibility based on game state
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
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
        // Subtract tabBarHeight since floatingBarBottom base already includes it
        // and the keyboard covers the tab bar area
        Animated.spring(keyboardHeight, {
          toValue: Math.max(0, event.endCoordinates.height - tabBarHeight),
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
  }, [keyboardHeight, tabBarHeight]);

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

  // US-004: Reset loaded story expanded state when session changes
  useEffect(() => {
    const loaded = currentSession?.contributions?.find(
      c => c.type === 'loaded',
    );
    if (loaded) {
      setIsLoadedStoryExpanded(loaded.content.length <= 500);
    }
  }, [currentSession?.id]);

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
        // Voice preference is synced in a separate useEffect
      } catch (error) {
        console.error('❌ Failed to initialize audio services:', error);
        setTtsServiceAvailable(false);
        // Continue without throwing - graceful degradation
      }
    };

    if (isAuthenticated && !ttsInitializedRef.current) {
      ttsInitializedRef.current = true;
      initializeAudio();
      // Check service availability on mount
      checkServiceAvailability();
    }

    return () => {
      textToSpeechService.removeAllListeners();
      ttsInitializedRef.current = false;
    };
    // Only depend on isAuthenticated to initialize once when user logs in
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Update TTS grade level options when gradeLevel changes (separate from init)
  useEffect(() => {
    if (ttsServiceAvailable && gradeLevel) {
      textToSpeechService.setGradeLevelOptions(gradeLevel);
    }
  }, [ttsServiceAvailable, gradeLevel]);

  // Sync voice input preference when userProfile changes
  useEffect(() => {
    if (userProfile?.speech_enabled !== undefined) {
      setVoiceInputEnabled(userProfile.speech_enabled);
    }
  }, [userProfile?.speech_enabled]);

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
          // Sync milestone to Convex via useMutation hook (React auth context)
          if (effectiveUserId) {
            try {
              await recordOnboardingMilestone({
                clerkUserId: effectiveUserId,
                milestoneType: 'first_voice',
                awardXp: false,
              });
            } catch (err) {
              console.error(
                '⚠️ Failed to sync voice milestone to Convex:',
                err,
              );
            }
          }
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

      // Clear the param immediately to prevent re-triggering on exit
      (navigation as any).setParams({ continueStory: undefined });

      // Start the imported story continuation
      handleContinueImportedStory(continueStoryParams);
    }
  }, [
    route.params?.continueStory,
    isAuthenticated,
    effectiveUserId,
    isGameActive,
  ]);

  // Handle story setup from wizard (US-009)
  useEffect(() => {
    const storySetupParams = route.params?.storySetup;

    if (
      storySetupParams &&
      isAuthenticated &&
      effectiveUserId &&
      !isGameActive
    ) {
      console.log('🎭 Detected story setup from wizard:', {
        genre: storySetupParams.genre,
        characterType: storySetupParams.characterType,
        setting: storySetupParams.setting,
        whoStarts: storySetupParams.whoStarts,
      });

      // Clear the param immediately to prevent re-triggering
      (navigation as any).setParams({ storySetup: undefined });

      // Start the story with setup answers
      executeStartNewGame(effectiveUserId, storySetupParams);
    }
  }, [
    route.params?.storySetup,
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

      // Clear stale contribution cache so getSession re-synthesizes
      // the 'loaded' contribution from the latest storyContent
      await storySessionManager.clearCachedContributions(
        continueParams.sessionId,
      );

      // Load the existing session from the database (preserveContributions
      // ensures cached contributions survive the Convex fetch, and triggers
      // synthesis of a 'loaded' contribution when cache is empty)
      const existingSession = await storySessionManager.getSession(
        continueParams.sessionId,
        true, // preserveContributions — US-002
      );

      if (existingSession) {
        console.log('✅ Loaded existing session:', existingSession.id);

        // Reset Convex DB state (completion, image, scores) for fresh continuation
        if (isConvexReady()) {
          const convexClient = getConvexClient();
          if (convexClient) {
            await convexClient.mutation(
              api.gameSessions.resetSessionForContinuation,
              {
                sessionId: continueParams.sessionId as Id<'gameSessions'>,
              },
            );
          }
        }

        // Reset React state for image generation
        setGeneratedImageUrl(null);
        setShowImageGeneration(false);
        setShowImageDisplayModal(false);

        // Reset local session object fields for fresh continuation
        existingSession.current_round = 1;
        existingSession.isCompleted = false;
        existingSession.completed_at = undefined;
        existingSession.generated_image_url = undefined;
        existingSession.image_generation_timestamp = undefined;
        existingSession.image_generation_cost = undefined;
        existingSession.image_upload_status = undefined;
        existingSession.image_upload_attempts = undefined;
        existingSession.image_upload_error = undefined;
        existingSession.xp_earned = 0;
        existingSession.final_score = 0;
        existingSession.words_written = 0;

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
  const executeStartNewGame = async (
    overrideUserId?: string,
    setup?: StorySetupAnswers,
  ) => {
    const userIdToUse = overrideUserId || effectiveUserId;
    // Resolve wizard answers into pipeline-ready values (US-010)
    const resolvedSetup = resolveStorySetup(setup);
    console.log('📖 executeStartNewGame: Starting new game flow', {
      overrideUserId,
      effectiveUserId,
      userIdToUse,
      resolvedSetup,
    });
    try {
      // Clear any previous errors and reset image/user-starts state
      setGenerationError(null);
      setGeneratedImageUrl(null); // Reset to prevent showing expired images from previous sessions
      setIsUserStarting(false); // US-011: Reset in case previous session was user-starts-first

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
        {
          difficulty: 1,
          theme: resolvedSetup.genre,
          character: resolvedSetup.character,
          setting: resolvedSetup.setting,
        },
      );
      console.log('📖 executeStartNewGame: Session created:', newSession.id);

      // US-011: "User starts first" mode — skip AI generation, show empty story with prompt
      if (resolvedSetup.whoStarts === 'user') {
        console.log(
          '📖 executeStartNewGame: User-starts-first mode — skipping AI generation',
        );
        setCurrentSession({ ...newSession });
        setIsGameActive(true);
        setIsUserStarting(true);
        setCurrentRound(1);
        setIsGameCompleted(false);
        startFadeAnimation();
        initializeChallengeSystem();

        // Auto-focus the text input after a short delay to let the UI render
        setTimeout(() => {
          storyInputRef.current?.focus();
        }, 500);
        return;
      }

      // Generate dynamic story starter using AI with diversity tracking (US-010)
      // Use resolved setup values; fall back to profile genre or 'adventure' when no wizard answers
      const starterResponse = await storyAgentService.generateStoryStarter({
        gradeLevel,
        theme: setup ? resolvedSetup.genre : preferredGenre ?? 'adventure',
        character: resolvedSetup.character,
        characterName: resolvedSetup.characterName,
        setting: resolvedSetup.setting,
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
          setCurrentRound(updatedSession.current_round);
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
          setCurrentRound(updatedSession.current_round);
          setIsGameActive(true);
          startFadeAnimation();

          // Initialize challenge system
          initializeChallengeSystem();

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
      clerkUserId: clerkAuth?.userId,
    });

    if (!isAuthenticated || !effectiveUserId) {
      console.log(
        '📖 handleStartNewGame: Not authenticated or no effectiveUserId',
      );
      Alert.alert('Error', 'Please log in to start a story');
      return;
    }

    // All users should have a profile loaded via Convex reactive query
    if (!userProfile) {
      console.log('📖 handleStartNewGame: No profile loaded yet');
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

    // All users use Clerk user ID for Convex session operations
    const userIdForSession = clerkAuth?.userId || userProfile?.clerk_user_id;

    if (!userIdForSession) {
      console.log('📖 handleStartNewGame: No Clerk user ID available');
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

    console.log(
      '📖 handleStartNewGame: Using Clerk user ID for session:',
      userIdForSession,
    );

    // Proceed directly to story setup — onboarding progress is shown once
    // after account creation and is accessible from Settings thereafter
    navigation.navigate('StorySetup' as never);
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
    // US-004: Prevent submissions after game completion (defense-in-depth)
    if (isGameCompleted) return;
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
      const _dbg = updatedSession;
      console.log(
        `📊 [ROUND-DEBUG] After user contribution: round=${_dbg.current_round}, completed=${_dbg.isCompleted}, contribs=${_dbg.contributions?.length}`,
      );
      // Force re-render by creating new object reference
      setCurrentSession({ ...updatedSession });
      setCurrentRound(updatedSession.current_round);

      // Check if game should end after user's contribution
      // (happens when user is the "closer" — e.g., AI started the game)
      if (updatedSession.isCompleted) {
        console.log(
          '🎉 [ROUND-DEBUG] Game completed after user contribution (user closed final round)',
        );
        setIsGameCompleted(true);
        setUserInput('');

        // Handle completion milestones and UI (same as AI completion path)
        const { shouldShowCelebration, isFirstStory } =
          await onboardingMilestoneTracker.markFirstStoryCompleted();

        if (isFirstStory && effectiveUserId) {
          try {
            await recordOnboardingMilestone({
              clerkUserId: effectiveUserId,
              milestoneType: 'first_story',
              awardXp: false,
            });
          } catch (err) {
            console.error('⚠️ useMutation FAILED for first_story:', err);
          }
        }

        if (shouldShowCelebration) {
          const xpResult = await awardOnboardingXP('first_story');
          const totalXpEarned =
            (updatedSession.xp_earned || 0) + (xpResult.xpAwarded || 0);
          setFirstStoryXpEarned(totalXpEarned);
          setTimeout(() => {
            storyScrollViewRef.current?.scrollTo({ y: 0, animated: false });
            setShowFirstStoryCelebration(true);
          }, 1500);
        } else {
          setTimeout(() => {
            storyScrollViewRef.current?.scrollTo({ y: 0, animated: false });
            setShowCompletionOptions(true);
          }, 2000);
        }
        return; // Skip AI response — game is complete
      }

      // US-011: After user's first contribution in "user starts first" mode,
      // switch to normal turn-taking — AI will continue using session metadata
      if (isUserStarting) {
        setIsUserStarting(false);
      }

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
        genre: preferredGenre,
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

          // Check if game should end after this round (US-002: use session state, not React state)
          if (updatedSession.isCompleted) {
            setIsGameCompleted(true);

            // Check if this is the user's first story completion (US-004)
            const { shouldShowCelebration, isFirstStory } =
              await onboardingMilestoneTracker.markFirstStoryCompleted();

            // Sync milestone to Convex for cross-session persistence
            // Uses useMutation hook (React auth context) instead of
            // convexClient.mutation() which can silently fail auth.
            if (isFirstStory && effectiveUserId) {
              try {
                console.log(
                  '🔍 [DEBUG-ONBOARDING] Recording first_story via useMutation hook...',
                  { effectiveUserId },
                );
                const result = await recordOnboardingMilestone({
                  clerkUserId: effectiveUserId,
                  milestoneType: 'first_story',
                  awardXp: false,
                });
                console.log(
                  '🔍 [DEBUG-ONBOARDING] useMutation result:',
                  JSON.stringify(result),
                );
              } catch (err) {
                console.error(
                  '⚠️ [DEBUG-ONBOARDING] useMutation FAILED for first_story:',
                  err,
                );
              }
            } else {
              console.log('🔍 [DEBUG-ONBOARDING] Skipped Convex sync:', {
                isFirstStory,
                effectiveUserId,
              });
            }

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
            // US-001: Sync round counter from session manager (source of truth)
            console.log(
              `📊 [ROUND-DEBUG] After AI response: session.current_round=${updatedSession.current_round}, isCompleted=${updatedSession.isCompleted}, contributions=${updatedSession.contributions?.length}`,
            );
            setCurrentRound(updatedSession.current_round);
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
    setIsUserStarting(false); // US-011: Reset user-starts-first mode
    setShowCompletionOptions(false);
    setShowImageGeneration(false);
    setShowImageDisplayModal(false);
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
    setShowImageDisplayModal(true);
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

  // Handler for first story guidance modal close/proceed (US-012)
  // Modal is only shown once after signup; subsequent access is via Settings
  const handleFirstStoryGuidanceClose = useCallback(async () => {
    await onboardingMilestoneTracker.markFirstStoryGuidanceShown();
    setShowFirstStoryGuidance(false);
  }, []);

  const handleFirstStoryGuidanceProceed = useCallback(async () => {
    await onboardingMilestoneTracker.markFirstStoryGuidanceShown();
    setShowFirstStoryGuidance(false);
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
      let celebrationShown = false;
      try {
        const { shouldShowCelebration, isFirstImage } =
          await onboardingMilestoneTracker.markFirstImageGenerated();

        // Sync milestone to Convex via useMutation hook (React auth context)
        if (isFirstImage && effectiveUserId) {
          try {
            await recordOnboardingMilestone({
              clerkUserId: effectiveUserId,
              milestoneType: 'first_image',
              awardXp: false,
            });
          } catch (err) {
            console.error('⚠️ Failed to sync image milestone to Convex:', err);
          }
        }

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
          celebrationShown = true;
        }
      } catch (error) {
        console.error('❌ Error checking first image milestone:', error);
      }

      // Open the image display modal automatically after generation
      // (unless the first-image celebration is showing — US-007 handles opening from celebration CTA)
      if (!celebrationShown) {
        setShowImageDisplayModal(true);
      }

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
      <View style={styles.safeContainer}>
        {/* Flex Middle Section - Story Content (scrolls behind challenge box) */}
        <View style={styles.storyContentSection}>
          <ScrollView
            ref={storyScrollViewRef}
            style={styles.storyScrollContainer}
            contentContainerStyle={[
              styles.storyScrollContent,
              { paddingTop: insets.top + 80 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.gameContainer}>
              {/* Story Display - Book Format */}
              <View style={styles.storyBookContainer}>
                <View style={styles.storyBookHeader}>
                  <View style={styles.storyTitleRow}>
                    <Text style={styles.roundCounter}>
                      Round {currentRound}/{MAX_ROUNDS}
                    </Text>
                    <Text style={styles.gradeLevel}>{gradeLevel}</Text>
                  </View>
                  <View style={styles.headerButtonRow}>
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
                          Alert.alert(
                            '✅ Copied!',
                            'Story copied to clipboard',
                            [{ text: 'OK' }],
                          );
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
                    <TouchableOpacity
                      style={styles.exitButtonHeader}
                      onPress={handleExitGame}
                    >
                      <Text style={styles.exitButtonHeaderText}>← Exit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <ScrollView
                  style={styles.storyBook}
                  contentContainerStyle={styles.storyBookContent}
                >
                  {currentSession?.contributions &&
                  currentSession.contributions.length > 0 ? (
                    <>
                      {/* US-004: Collapsible loaded story section */}
                      {(() => {
                        const loadedContribution =
                          currentSession.contributions.find(
                            c => c.type === 'loaded',
                          );
                        const newContributions =
                          currentSession.contributions.filter(
                            c => c.type !== 'loaded',
                          );
                        return (
                          <>
                            {loadedContribution &&
                              (() => {
                                const importedContent =
                                  currentSession?.imported_story_content;
                                const loadedContent =
                                  loadedContribution.content;
                                const hasContinuationSegment =
                                  importedContent &&
                                  importedContent.length <
                                    loadedContent.length &&
                                  loadedContent.startsWith(importedContent);
                                const continuationContent =
                                  hasContinuationSegment
                                    ? loadedContent
                                        .slice(importedContent.length)
                                        .trim()
                                    : null;
                                const originalWordCount = hasContinuationSegment
                                  ? importedContent.split(/\s+/).filter(Boolean)
                                      .length
                                  : loadedContribution.wordCount;
                                const continuationWordCount =
                                  continuationContent
                                    ? continuationContent
                                        .split(/\s+/)
                                        .filter(Boolean).length
                                    : 0;

                                if (!hasContinuationSegment) {
                                  // First continuation — single "Previously Written" block
                                  return (
                                    <>
                                      <TouchableOpacity
                                        style={styles.collapsibleHeader}
                                        onPress={() => {
                                          LayoutAnimation.configureNext(
                                            LayoutAnimation.Presets
                                              .easeInEaseOut,
                                          );
                                          setIsLoadedStoryExpanded(
                                            !isLoadedStoryExpanded,
                                          );
                                        }}
                                        activeOpacity={0.7}
                                      >
                                        <Text
                                          style={styles.collapsibleHeaderText}
                                        >
                                          Previously Written
                                        </Text>
                                        <Text
                                          style={styles.collapsibleWordCount}
                                        >
                                          {loadedContribution.wordCount}w
                                        </Text>
                                        <Text style={styles.collapsibleChevron}>
                                          {isLoadedStoryExpanded ? '▼' : '▶'}
                                        </Text>
                                      </TouchableOpacity>
                                      {isLoadedStoryExpanded ? (
                                        <Text
                                          style={[
                                            styles.storyText,
                                            styles.selectableText,
                                          ]}
                                          selectable={true}
                                        >
                                          {loadedContribution.content}
                                        </Text>
                                      ) : (
                                        <Text style={styles.collapsiblePreview}>
                                          {loadedContribution.content.substring(
                                            0,
                                            100,
                                          )}
                                          ...
                                        </Text>
                                      )}
                                      {newContributions.length > 0 && (
                                        <View style={styles.loadedSeparator} />
                                      )}
                                    </>
                                  );
                                }

                                // 3rd+ continuation — segmented into Original Story + Previous Continuation
                                return (
                                  <>
                                    <TouchableOpacity
                                      style={styles.collapsibleHeader}
                                      onPress={() => {
                                        LayoutAnimation.configureNext(
                                          LayoutAnimation.Presets.easeInEaseOut,
                                        );
                                        setIsLoadedStoryExpanded(
                                          !isLoadedStoryExpanded,
                                        );
                                      }}
                                      activeOpacity={0.7}
                                    >
                                      <Text
                                        style={styles.collapsibleHeaderText}
                                      >
                                        Original Story
                                      </Text>
                                      <Text style={styles.collapsibleWordCount}>
                                        {originalWordCount}w
                                      </Text>
                                      <Text style={styles.collapsibleChevron}>
                                        {isLoadedStoryExpanded ? '▼' : '▶'}
                                      </Text>
                                    </TouchableOpacity>
                                    {isLoadedStoryExpanded ? (
                                      <Text
                                        style={[
                                          styles.storyText,
                                          styles.selectableText,
                                        ]}
                                        selectable={true}
                                      >
                                        {importedContent}
                                      </Text>
                                    ) : (
                                      <Text style={styles.collapsiblePreview}>
                                        {importedContent.substring(0, 100)}
                                        ...
                                      </Text>
                                    )}
                                    <TouchableOpacity
                                      style={styles.collapsibleHeader}
                                      onPress={() => {
                                        LayoutAnimation.configureNext(
                                          LayoutAnimation.Presets.easeInEaseOut,
                                        );
                                        setIsPrevContinuationExpanded(
                                          !isPrevContinuationExpanded,
                                        );
                                      }}
                                      activeOpacity={0.7}
                                    >
                                      <Text
                                        style={styles.collapsibleHeaderText}
                                      >
                                        Previous Continuation
                                      </Text>
                                      <Text style={styles.collapsibleWordCount}>
                                        {continuationWordCount}w
                                      </Text>
                                      <Text style={styles.collapsibleChevron}>
                                        {isPrevContinuationExpanded ? '▼' : '▶'}
                                      </Text>
                                    </TouchableOpacity>
                                    {isPrevContinuationExpanded ? (
                                      <Text
                                        style={[
                                          styles.storyText,
                                          styles.selectableText,
                                        ]}
                                        selectable={true}
                                      >
                                        {continuationContent}
                                      </Text>
                                    ) : (
                                      <Text style={styles.collapsiblePreview}>
                                        {continuationContent!.substring(0, 100)}
                                        ...
                                      </Text>
                                    )}
                                    {newContributions.length > 0 && (
                                      <View style={styles.loadedSeparator} />
                                    )}
                                  </>
                                );
                              })()}
                            {newContributions.map((contribution, index) => (
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
                                  style={[
                                    styles.storyText,
                                    styles.selectableText,
                                  ]}
                                  selectable={true}
                                >
                                  {contribution.content}
                                </Text>
                              </View>
                            ))}
                          </>
                        );
                      })()}
                    </>
                  ) : isUserStarting ? (
                    /* US-011: "User starts first" prompt card */
                    <View style={styles.userStartsPromptCard}>
                      <Text style={styles.userStartsPromptEmoji}>✍️</Text>
                      <Text style={styles.userStartsPromptText}>
                        Write the first line of your story...
                      </Text>
                    </View>
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

              {/* Back to Options Button - Show when game is completed and no modal overlay is active */}
              {isGameCompleted &&
                !showCompletionOptions &&
                !showImageGeneration &&
                !showImageDisplayModal && (
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

          {/* Floating Input Bar — glass card overlay (US-004, US-005, US-006) */}
          {!showCompletionOptions && (
            <Animated.View
              style={[
                styles.floatingInputBarPositioner,
                { bottom: floatingBarBottom },
              ]}
            >
              <AdaptiveGlassBackground
                glassStyle="regular"
                isInteractive={true}
                fallbackBlurIntensity={90}
                fallbackBlurTint="light"
                androidFallbackColor="rgba(255,255,255,0.95)"
                style={styles.floatingInputBarGlass}
              >
                {/* Loading Banner (US-006) — compact row above TextInput */}
                {(loadingState.isValidating ||
                  loadingState.isSaving ||
                  loadingState.isGenerating) && (
                  <View style={styles.loadingBanner}>
                    <View style={styles.loadingBannerContent}>
                      <Animated.Text
                        style={[
                          styles.loadingBannerSpinner,
                          {
                            transform: [
                              {
                                rotate: spinValue.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['0deg', '360deg'],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        {'\u26A1'}
                      </Animated.Text>
                      <Text style={styles.loadingBannerText} numberOfLines={1}>
                        {loadingState.currentTask || 'Processing...'}
                      </Text>
                    </View>
                    {loadingState.generationProgress > 0 && (
                      <View style={styles.loadingBannerProgressContainer}>
                        <View
                          style={[
                            styles.loadingBannerProgressFill,
                            {
                              width: `${loadingState.generationProgress}%`,
                            },
                          ]}
                        />
                      </View>
                    )}
                  </View>
                )}

                {/* Error Banner (US-006) — compact row above TextInput */}
                {generationError && (
                  <View style={styles.errorBanner}>
                    <View style={styles.errorBannerContent}>
                      <Text style={styles.errorBannerIcon}>
                        {'\u26A0\uFE0F'}
                      </Text>
                      <Text style={styles.errorBannerText} numberOfLines={2}>
                        {generationError.message}
                        {generationError.suggestion
                          ? ` — ${generationError.suggestion}`
                          : ''}
                      </Text>
                    </View>
                    {generationError.retryable && (
                      <TouchableOpacity
                        style={styles.errorBannerRetry}
                        onPress={() => {
                          setGenerationError(null);
                          handleContinueStory();
                        }}
                        accessibilityLabel="Retry story generation"
                        accessibilityRole="button"
                      >
                        <Text style={styles.errorBannerRetryText}>Retry</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* TextInput */}
                <TextInput
                  ref={storyInputRef}
                  testID="story-input"
                  style={styles.floatingTextInput}
                  placeholder={
                    isUserStarting
                      ? 'Start your story...'
                      : 'Continue the story...'
                  }
                  placeholderTextColor="#999"
                  multiline
                  value={userInput}
                  onChangeText={(text: string) => {
                    setUserInput(text);
                    inputDebouncer?.handleInput(text);
                  }}
                  editable={!loadingState.isGenerating && !isGameCompleted}
                />

                {/* Button Row: Mic → Speaker → spacer → Submit */}
                <View style={styles.floatingButtonRow}>
                  {/* Mic Button — VoiceInput component */}
                  <View>
                    <VoiceInput
                      onSpeechResult={handleVoiceResult}
                      isEnabled={
                        voiceInputEnabled && !loadingState.isGenerating
                      }
                      style={styles.floatingIconButton}
                    />
                  </View>

                  {/* Speaker Button */}
                  <TouchableOpacity
                    testID="speaker-button"
                    style={[
                      styles.floatingIconButton,
                      !canUseSpeaker && styles.floatingIconButtonDisabled,
                    ]}
                    onPress={handleSpeakerButtonPress}
                    onLongPress={handleSpeakerButtonLongPress}
                    disabled={!canUseSpeaker}
                    accessibilityLabel={
                      speakerState === 'speaking' || speakerState === 'starting'
                        ? 'Stop reading story'
                        : 'Read story aloud'
                    }
                    accessibilityRole="button"
                  >
                    <Text style={styles.floatingIconText}>
                      {speakerState === 'speaking' ||
                      speakerState === 'starting'
                        ? '\u23F9\uFE0F'
                        : '\uD83D\uDD0A'}
                    </Text>
                  </TouchableOpacity>

                  {/* Spacer */}
                  <View style={{ flex: 1 }} />

                  {/* Submit Button */}
                  <TouchableOpacity
                    testID="continue-story-button"
                    style={[
                      styles.floatingSubmitButton,
                      (!userInput.trim() ||
                        loadingState.isGenerating ||
                        isGameCompleted) &&
                        styles.floatingSubmitButtonDisabled,
                    ]}
                    onPress={handleContinueStory}
                    disabled={
                      !userInput.trim() ||
                      loadingState.isGenerating ||
                      isGameCompleted
                    }
                    accessibilityLabel="Submit story contribution"
                    accessibilityRole="button"
                  >
                    {loadingState.isGenerating ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.floatingSubmitText}>{'\u2191'}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </AdaptiveGlassBackground>
            </Animated.View>
          )}
        </View>

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
          showDontShowAgain={false}
        />

        {/* Story Completion Options Screen - Full Screen Overlay */}
        {showCompletionOptions && (
          <View style={styles.completionModalOverlay}>
            <AdaptiveGlassBackground
              glassStyle="clear"
              fallbackBlurIntensity={20}
              fallbackBlurTint="dark"
              androidFallbackColor="rgba(0,0,0,0.5)"
            />
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
                      {(() => {
                        const totalLength =
                          currentSession?.story_content?.length || 0;
                        const loadedContent =
                          currentSession?.contributions?.find(
                            c => c.type === 'loaded',
                          )?.content;
                        return Math.max(
                          0,
                          totalLength - (loadedContent?.length || 0),
                        );
                      })()}{' '}
                      characters
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

                  {generatedImageUrl ||
                  currentSession?.generated_image_url ||
                  currentSession?.supabase_image_url ? (
                    <TouchableOpacity
                      style={styles.completionOptionButton}
                      onPress={() => {
                        setShowCompletionOptions(false);
                        setShowImageDisplayModal(true);
                      }}
                    >
                      <Text style={styles.completionOptionText}>
                        🖼️ View Generated Image
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.completionOptionButton}
                      onPress={handleImageGeneration}
                    >
                      <Text style={styles.completionOptionText}>
                        🎨 Generate Image
                      </Text>
                    </TouchableOpacity>
                  )}

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
            <AdaptiveGlassBackground
              glassStyle="clear"
              fallbackBlurIntensity={20}
              fallbackBlurTint="dark"
              androidFallbackColor="rgba(0,0,0,0.5)"
            />
            <Pressable
              style={styles.imageGenerationScrollView}
              onPress={e => e.stopPropagation()}
            >
              <ScrollView
                contentContainerStyle={styles.imageGenerationScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.imageGenerationContainer}>
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

        {/* Image Display Modal — shows generated image in dismissable overlay */}
        <ImageDisplayModal
          visible={showImageDisplayModal}
          onClose={() => setShowImageDisplayModal(false)}
          onBackToOptions={() => {
            setShowImageDisplayModal(false);
            setShowCompletionOptions(true);
          }}
          replicateUrl={
            generatedImageUrl ||
            currentSession?.generated_image_url ||
            undefined
          }
          supabaseUrl={currentSession?.supabase_image_url || undefined}
          uploadStatus={currentSession?.image_upload_status}
          storyTitle={
            currentSession?.story_content
              ? currentSession.story_content
                  .split(/\s+/)
                  .slice(0, 6)
                  .join(' ') + '...'
              : 'Story Illustration'
          }
          sessionId={currentSession?.id || ''}
          userId={effectiveUserId || ''}
          onRetryUpload={handleRetryImageUpload}
          onImageSaved={localPath => {
            if (currentSession?.id) {
              storySessionManager.updateSessionWithLocalImage(
                currentSession.id,
                localPath,
              );
            }
          }}
          onError={error => {
            console.error('❌ ImageDisplayModal error:', error);
          }}
        />

        {/* Absolute-positioned Challenge Display — story content scrolls behind it */}
        {currentChallenge && !showCompletionOptions && (
          <View style={[styles.challengeHeaderSection, { top: insets.top }]}>
            <ChallengeDisplay
              challenge={currentChallenge}
              progress={challengeProgress.find(
                p => p.challengeId === currentChallenge.id,
              )}
              compact={true}
            />
          </View>
        )}
      </View>
    );
  }

  // Handler for "See how it works" button in EnhancedEmptyState (US-017)
  const handleSeeHowItWorks = () => {
    setShowFirstStoryGuidance(true);
    console.log('📚 [US-017] Opening guidance modal from enhanced empty state');
  };

  return (
    <View style={styles.safeContainer}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: insets.top },
        ]}
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
                        style={[
                          styles.startButtonText,
                          styles.loadingButtonText,
                        ]}
                      >
                        {loadingState.currentTask || 'Creating Story...'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.startButtonText}>
                      🎮 Start New Story
                    </Text>
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
                  <Text style={styles.continueButtonText}>
                    📖 Continue Story
                  </Text>
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
          showDontShowAgain={false}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fcfcfc',
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
    backgroundColor: '#fcfcfc',
  },
  challengeHeaderSection: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 4,
    zIndex: 10,
  },
  storyContentSection: {
    flex: 1,
    paddingHorizontal: 0,
  },
  storyScrollContainer: {
    flex: 1,
  },
  storyScrollContent: {
    flexGrow: 1,
    paddingBottom: 200, // Increased from 120 to account for absolute-positioned glass tab bar (US-005)
  },
  // Floating input bar — layout positioning only (US-006: split from floatingInputBar)
  floatingInputBarPositioner: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    zIndex: 100,
  },
  // Floating input bar — glass visual style (US-006: AdaptiveGlassBackground provides material)
  floatingInputBarGlass: {
    // Override AdaptiveGlassBackground's absoluteFill so glass acts as layout container
    position: 'relative' as const,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: 'hidden' as const,
  },
  floatingTextInput: {
    minHeight: 36,
    maxHeight: 120,
    fontSize: 18,
    fontFamily: 'ArchitectsDaughter_400Regular',
    color: '#333',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  floatingButtonRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: 4,
    gap: 4,
  },
  floatingIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 0,
    paddingHorizontal: 0,
    minWidth: 36,
  },
  floatingIconButtonDisabled: {
    opacity: 0.3,
  },
  floatingIconText: {
    fontSize: 22,
  },
  floatingSubmitButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4CAF50',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  floatingSubmitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  floatingSubmitText: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: '#ffffff',
  },
  // Loading & error banners inside floating bar (US-006)
  loadingBanner: {
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  loadingBannerContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  loadingBannerSpinner: {
    fontSize: 18,
  },
  loadingBannerText: {
    fontSize: 15,
    color: '#555',
    flex: 1,
  },
  loadingBannerProgressContainer: {
    height: 3,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden' as const,
  },
  loadingBannerProgressFill: {
    height: 3,
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  errorBanner: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  errorBannerContent: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 6,
  },
  errorBannerIcon: {
    fontSize: 18,
  },
  errorBannerText: {
    fontSize: 15,
    color: '#664d03',
    flex: 1,
  },
  errorBannerRetry: {
    marginTop: 4,
    alignSelf: 'flex-end' as const,
  },
  errorBannerRetryText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#0d6efd',
  },
  gameContainer: {
    padding: 8,
  },
  welcomeSection: {
    marginBottom: 60,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
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
    fontSize: 22,
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
    fontSize: 20,
    fontWeight: '600',
  },
  // Game Screen Styles
  gradeLevel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#4CAF50',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roundCounter: {
    fontSize: 13,
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
  headerButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  copyButton: {
    backgroundColor: '#6B7280',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  copyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  exitButtonHeader: {
    backgroundColor: '#6B7280',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  exitButtonHeaderText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  storyBook: {
    backgroundColor: '#fcfcfc',
    borderRadius: 0,
    width: '100%',
    borderWidth: 0,
  },
  storyBookContent: {
    padding: 16,
    flexGrow: 1,
  },
  storyText: {
    fontSize: 20,
    lineHeight: 26,
    color: '#333',
    fontFamily: 'ArchitectsDaughter_400Regular',
    textAlign: 'left',
  },
  selectableText: {
    // Allow text selection on supported platforms
    userSelect: 'text',
  },
  aiLabel: {
    color: '#4285f4',
  },
  userLabel: {
    color: '#22c55e',
  },
  loadedLabel: {
    color: '#8b5cf6',
  },
  // US-004: Collapsible loaded story section styles
  collapsibleHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  collapsibleHeaderText: {
    fontSize: 14,
    fontWeight: 'bold' as const,
    color: '#8b5cf6',
    fontFamily: 'ArchitectsDaughter_400Regular',
    flex: 1,
  },
  collapsibleWordCount: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500' as const,
    marginRight: 8,
  },
  collapsibleChevron: {
    fontSize: 12,
    color: '#8b5cf6',
  },
  collapsiblePreview: {
    fontSize: 18,
    lineHeight: 24,
    color: '#999',
    fontFamily: 'ArchitectsDaughter_400Regular',
    fontStyle: 'italic' as const,
    marginBottom: 4,
  },
  loadedSeparator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
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
    fontSize: 14,
    fontWeight: 'bold',
  },
  compactWordCount: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
  },
  // US-011: "User starts first" prompt card styles
  userStartsPromptCard: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  userStartsPromptEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  userStartsPromptText: {
    fontSize: 18,
    fontWeight: '500' as const,
    color: '#666666',
    textAlign: 'center' as const,
    lineHeight: 28,
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  loadingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingButtonText: {
    marginLeft: 10,
  },
  loadingSpinnerButton: {
    fontSize: 18,
    marginRight: 8,
    color: '#ffffff',
  },
  // Story Completion Options Styles - Full Screen Modal
  completionModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    fontSize: 30,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 12,
    textAlign: 'center',
  },
  completionSubtitle: {
    fontSize: 19,
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
    fontSize: 16,
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
    fontSize: 19,
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
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default React.memo(HomeScreen);
