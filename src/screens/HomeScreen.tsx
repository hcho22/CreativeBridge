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
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { challengeService } from '../services/challengeService';
import { Challenge, ChallengeProgress } from '../types/challenges';
import ChallengeDisplay from '../components/common/ChallengeDisplay';

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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(true);

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

  // Initialize TTS and check voice input preferences
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        await textToSpeechService.initialize();

        if (textToSpeechService.isServiceAvailable()) {
          await textToSpeechService.setGradeLevelOptions(gradeLevel);

          // Set up TTS event listeners
          textToSpeechService.setupEventListeners({
            onStart: () => setIsSpeaking(true),
            onFinish: () => setIsSpeaking(false),
            onCancel: () => setIsSpeaking(false),
            onError: error => {
              console.error('TTS Error:', error);
              setIsSpeaking(false);
            },
          });

          console.log('✅ TTS service initialized successfully');
        } else {
          console.log(
            '⚠️ TTS service not available - continuing without speech features',
          );
        }

        // Check user's voice preference
        if (userProfile?.speech_enabled !== undefined) {
          setVoiceInputEnabled(userProfile.speech_enabled);
        }
      } catch (error) {
        console.error('❌ Failed to initialize audio services:', error);
        // Continue without throwing - graceful degradation
      }
    };

    if (user) {
      initializeAudio();
    }

    return () => {
      textToSpeechService.removeAllListeners();
    };
  }, [user, userProfile?.speech_enabled, gradeLevel]);

  // Removed voice input handlers - using simplified voice button

  // TTS functions
  const speakStoryContent = useCallback(
    async (content: string) => {
      if (!textToSpeechService.isServiceAvailable()) {
        console.log(
          '📢 TTS not available - would speak:',
          content.substring(0, 50) + '...',
        );
        return;
      }

      try {
        if (isSpeaking) {
          await textToSpeechService.stop();
          return;
        }

        await textToSpeechService.speakStoryContent(content, 'narrative');
      } catch (error) {
        console.error('Error speaking content:', error);
      }
    },
    [isSpeaking],
  );

  const provideContinuationFeedback = useCallback(async () => {
    if (!textToSpeechService.isServiceAvailable()) return;

    try {
      await textToSpeechService.addAudioCue('ai_turn');
    } catch (error) {
      console.error('Error providing audio feedback:', error);
    }
  }, []);

  const checkForExistingSession = useCallback(async () => {
    try {
      // Always clear any existing session and start fresh
      // Users will start a new story every time they log in
      const existingSession = await storySessionManager.getCurrentSession();
      if (existingSession && !existingSession.isCompleted) {
        console.log('Clearing existing unfinished session to start fresh');
        // Clear the current session reference but don't delete the session data
        // This allows the session to remain in the database for history
        await AsyncStorage.removeItem('@CreativeBridge:currentSession');
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
    [currentChallenge],
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
      // Clear any previous errors
      setGenerationError(null);

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

          // Update round counter after AI responds
          const nextRound = currentRound + 1;
          setCurrentRound(nextRound);

          // Check if game should end after this round
          if (nextRound > MAX_ROUNDS) {
            setIsGameCompleted(true);

            // Show game completion after a brief delay
            setTimeout(() => {
              handleGameCompletion();
            }, 2000);
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
  };

  const handleGameCompletion = () => {
    const finalWordCount = currentSession?.sessionStats.userWords || 0;
    const completedChallenges = challengeProgress.filter(
      p => p.isCompleted,
    ).length;

    Alert.alert(
      '🎉 Story Complete!',
      `Congratulations! You've completed your ${MAX_ROUNDS}-round story adventure!\n\n` +
        `📝 Words Written: ${finalWordCount}\n` +
        `🎯 Challenges Completed: ${completedChallenges}\n` +
        `📚 Story Length: ${
          currentSession?.story_content?.length || 0
        } characters\n\n` +
        `Your story has been saved. Would you like to start a new adventure?`,
      [
        {
          text: 'View Story',
          onPress: () => {
            // Keep the story visible for review
            console.log('📖 Player wants to review completed story');
          },
        },
        {
          text: 'New Story',
          onPress: () => {
            exitGame();
            // Optionally auto-start a new game
            setTimeout(() => {
              handleStartNewGame();
            }, 500);
          },
        },
        {
          text: 'Main Menu',
          onPress: () => exitGame(),
        },
      ],
    );
  };

  // Removed handleCompleteStory and handleShareStory functions since Complete button was removed

  if (isGameActive) {
    return (
      <View style={styles.container}>
        <View style={styles.gameContainer}>
          {/* Game Header */}
          <View style={styles.gameHeader}>
            <TouchableOpacity
              style={styles.exitButton}
              onPress={handleExitGame}
            >
              <Text style={styles.exitButtonText}>← Exit</Text>
            </TouchableOpacity>

            {/* Game Info Section - Single row with three columns */}
            <View style={styles.gameInfoContainer}>
              <Text style={styles.gradeLevel}>{gradeLevel}</Text>
              <Text style={styles.roundCounter}>
                Round {currentRound}/{MAX_ROUNDS}
              </Text>
              <Text style={styles.userWordsCount}>
                {currentSession?.sessionStats.userWords || 0} words
              </Text>
            </View>
          </View>

          {/* Current Challenge Display */}
          {currentChallenge && (
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
              <Text style={styles.storyBookTitle}>📖 Your Story</Text>
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

          {/* User Input Section */}
          <View style={styles.inputSection}>
            <TextInput
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
              {/* Read Story Button */}
              <TouchableOpacity
                style={styles.readStoryButton}
                onPress={() =>
                  currentSession?.story_content &&
                  speakStoryContent(currentSession.story_content)
                }
                disabled={!currentSession?.story_content}
              >
                <Text style={styles.readStoryButtonText}>
                  {isSpeaking ? '⏹️ Stop Reading' : '🔊 Read Story'}
                </Text>
              </TouchableOpacity>

              {/* Speak Button for Voice Input */}
              <TouchableOpacity
                style={[
                  styles.speakButton,
                  (!voiceInputEnabled || loadingState.isGenerating) &&
                    styles.disabledButton,
                ]}
                onPress={() => {
                  if (!voiceInputEnabled) {
                    Alert.alert(
                      'Voice Input Disabled',
                      'Please enable speech features in Settings to use voice input.',
                      [{ text: 'OK' }],
                    );
                    return;
                  }
                  if (loadingState.isGenerating) {
                    Alert.alert(
                      'Please Wait',
                      'Please wait for the current story generation to complete.',
                      [{ text: 'OK' }],
                    );
                    return;
                  }
                  // Trigger voice input using the existing VoiceInput functionality
                  Alert.alert(
                    'Voice Input',
                    'Tap and hold to speak your story continuation. Release when finished.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Start Speaking',
                        onPress: () => {
                          // This would trigger voice recognition
                          // For now, we'll add some sample text
                          setUserInput(
                            prev => prev + ' [Voice input would appear here]',
                          );
                        },
                      },
                    ],
                  );
                }}
                disabled={!voiceInputEnabled || loadingState.isGenerating}
              >
                <Text style={styles.speakButtonText}>🎤 Speak</Text>
              </TouchableOpacity>

              {/* Continue Story Button */}
              <TouchableOpacity
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
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  exitButton: {
    backgroundColor: '#666',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  exitButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  gameInfoContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 8,
    paddingHorizontal: 4,
  },
  gradeLevel: {
    fontSize: 13,
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
  userWordsCount: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    textAlign: 'center',
    minWidth: 60,
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
    flex: 1,
  },
  storyBookHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 4,
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
    gap: 6,
  },
  readStoryButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  readStoryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  speakButton: {
    backgroundColor: '#9C27B0',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  continueStoryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  continueStoryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default React.memo(HomeScreen);
