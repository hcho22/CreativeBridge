import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  BackHandler,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { theme } from '../constants/theme';
import { HomeStackParamList } from '../navigation/AppNavigator';
import type {
  StoryGenre,
  CharacterType,
  AnimalType,
  StorySetting,
  StoryStarter,
  StorySetupAnswers,
} from '../types/storySetup';
import type { GradeLevel } from '../types/database';

// ─── Navigation typing ──────────────────────────────────────────────

type StorySetupScreenNavigationProp = StackNavigationProp<
  HomeStackParamList,
  'StorySetup'
>;

interface StorySetupScreenProps {
  navigation: StorySetupScreenNavigationProp;
}

// ─── Genre configuration ────────────────────────────────────────────

interface GenreOption {
  value: StoryGenre;
  emoji: string;
}

const GENRE_OPTIONS: GenreOption[] = [
  { value: 'Mystery', emoji: '🔍' },
  { value: 'Fantasy', emoji: '🧙' },
  { value: 'Comedy', emoji: '😂' },
  { value: 'Horror', emoji: '👻' },
  { value: 'Fiction', emoji: '📖' },
  { value: 'Fairy Tale', emoji: '🧚' },
];

/**
 * Returns the grade-adaptive display label for a genre.
 * The stored value is always the canonical StoryGenre string — only
 * the label shown to the user changes based on grade level.
 *
 * Mapping:
 *   Horror  → "Spooky" (K-2, 3-5), "Suspense" (6-8), "Horror" (9-12)
 *   Comedy  → "Funny" (K-2), "Comedy" (3-5+)
 *   Fiction → "Story" (K-2), "Fiction" (3-5+)
 */
const getGenreLabel = (genre: StoryGenre, gradeLevel: GradeLevel): string => {
  switch (genre) {
    case 'Horror':
      if (gradeLevel === 'K-2' || gradeLevel === '3-5') return 'Spooky';
      if (gradeLevel === '6-8') return 'Suspense';
      return 'Horror';
    case 'Comedy':
      if (gradeLevel === 'K-2') return 'Funny';
      return 'Comedy';
    case 'Fiction':
      if (gradeLevel === 'K-2') return 'Story';
      return 'Fiction';
    default:
      return genre;
  }
};

// ─── Character configuration ────────────────────────────────────────

interface CharacterOption {
  value: CharacterType;
  emoji: string;
}

const CHARACTER_OPTIONS: CharacterOption[] = [
  { value: 'Girl', emoji: '👧' },
  { value: 'Boy', emoji: '👦' },
  { value: 'Animal', emoji: '🐾' },
  { value: 'Custom', emoji: '✏️' },
];

interface AnimalOption {
  value: AnimalType;
  emoji: string;
}

const ANIMAL_OPTIONS: AnimalOption[] = [
  { value: 'Cat', emoji: '🐱' },
  { value: 'Dog', emoji: '🐶' },
  { value: 'Rabbit', emoji: '🐰' },
  { value: 'Owl', emoji: '🦉' },
  { value: 'Other', emoji: '✏️' },
];

// ─── Setting configuration ──────────────────────────────────────────

interface SettingOption {
  value: StorySetting;
  emoji: string;
}

const SETTING_OPTIONS: SettingOption[] = [
  { value: 'Forest', emoji: '🌲' },
  { value: 'Beach', emoji: '🌴' },
  { value: 'Castle', emoji: '🏰' },
  { value: 'Space', emoji: '🚀' },
  { value: 'Custom', emoji: '✏️' },
];

// ─── Starter configuration ─────────────────────────────────────────

interface StarterOption {
  value: StoryStarter;
  label: string;
  emoji: string;
}

const STARTER_OPTIONS: StarterOption[] = [
  { value: 'ai', label: 'AI starts the story', emoji: '✨' },
  { value: 'user', label: 'I want to start', emoji: '✏️' },
];

// ─── Constants ──────────────────────────────────────────────────────

const TOTAL_STEPS = 4;
const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Component ──────────────────────────────────────────────────────

const StorySetupScreen: React.FC<StorySetupScreenProps> = ({ navigation }) => {
  const { userProfile } = useAuth();
  const gradeLevel: GradeLevel =
    (userProfile?.preferred_grade_level as GradeLevel) ?? 'K-2';

  // ── Wizard state ───────────────────────────────────────────────

  const [currentStep, setCurrentStep] = useState(0);

  // Step 0 — Genre
  const [selectedGenre, setSelectedGenre] = useState<StoryGenre | null>(null);

  // Step 1 — Character
  const [selectedCharacterType, setSelectedCharacterType] =
    useState<CharacterType | null>(null);
  const [selectedAnimalType, setSelectedAnimalType] =
    useState<AnimalType | null>(null);
  const [customAnimal, setCustomAnimal] = useState('');
  const [customCharacter, setCustomCharacter] = useState('');
  const [characterName, setCharacterName] = useState('');

  // Step 2 — Setting
  const [selectedSetting, setSelectedSetting] = useState<StorySetting | null>(
    null,
  );
  const [customSetting, setCustomSetting] = useState('');
  const customSettingInputRef = useRef<TextInput>(null);

  // Step 3 — Who Starts
  const [selectedStarter, setSelectedStarter] = useState<StoryStarter>('ai');

  // Double-tap prevention for Start Story
  const isStartingRef = useRef(false);
  const [isStarting, setIsStarting] = useState(false);

  // ── Animation ─────────────────────────────────────────────────

  const slideAnim = useRef(new Animated.Value(0)).current;
  const isTransitioning = useRef(false);
  const isNavigatingAway = useRef(false);
  const dotAnims = useMemo(
    () => Array.from({ length: TOTAL_STEPS }, () => new Animated.Value(1)),
    [],
  );

  /** Slide current step out, update content, slide new step in. */
  const animateStepTransition = useCallback(
    (direction: 'forward' | 'backward', updateStep: () => void) => {
      if (isTransitioning.current) return;
      isTransitioning.current = true;

      const exitValue = direction === 'forward' ? -SCREEN_WIDTH : SCREEN_WIDTH;
      const entryValue = direction === 'forward' ? SCREEN_WIDTH : -SCREEN_WIDTH;

      // Phase 1: slide current content out
      Animated.timing(slideAnim, {
        toValue: exitValue,
        duration: theme.animation.fast,
        useNativeDriver: true,
      }).start(() => {
        updateStep();
        slideAnim.setValue(entryValue);
        // Phase 2: slide new content in
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: theme.animation.fast,
          useNativeDriver: true,
        }).start(() => {
          isTransitioning.current = false;
        });
      });
    },
    [slideAnim],
  );

  // ── Handlers ────────────────────────────────────────────────────

  const handleGenrePress = useCallback((genre: StoryGenre) => {
    setSelectedGenre(prev => (prev === genre ? null : genre));
  }, []);

  const handleCharacterTypePress = useCallback((type: CharacterType) => {
    setSelectedCharacterType(prev => {
      if (prev === type) return null; // toggle off
      // State cleanup: clear irrelevant sub-state when switching
      if (type !== 'Animal') {
        setSelectedAnimalType(null);
        setCustomAnimal('');
      }
      if (type !== 'Custom') {
        setCustomCharacter('');
      }
      return type;
    });
  }, []);

  const handleAnimalTypePress = useCallback((animal: AnimalType) => {
    setSelectedAnimalType(prev => {
      if (prev === animal) return null;
      if (animal !== 'Other') {
        setCustomAnimal('');
      }
      return animal;
    });
  }, []);

  const handleSettingPress = useCallback(
    (setting: StorySetting) => {
      setSelectedSetting(prev => (prev === setting ? null : setting));
      // Clear custom text when leaving Custom
      if (selectedSetting === 'Custom') {
        setCustomSetting('');
      }
      // Focus custom input when selecting Custom
      if (setting === 'Custom' && selectedSetting !== 'Custom') {
        setTimeout(() => customSettingInputRef.current?.focus(), 150);
      }
    },
    [selectedSetting],
  );

  const handleStarterPress = useCallback((starter: StoryStarter) => {
    setSelectedStarter(starter);
  }, []);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      animateStepTransition('backward', () => {
        setCurrentStep(prev => prev - 1);
      });
    }
  }, [currentStep, animateStepTransition]);

  const buildAnswers = useCallback(
    (starterOverride?: StoryStarter): StorySetupAnswers => ({
      genre: selectedGenre,
      characterType: selectedCharacterType,
      animalType: selectedAnimalType,
      customAnimal: customAnimal.trim() || null,
      customCharacter: customCharacter.trim() || null,
      characterName: characterName.trim() || null,
      setting: selectedSetting,
      customSetting: customSetting.trim() || null,
      whoStarts: starterOverride ?? selectedStarter,
    }),
    [
      selectedGenre,
      selectedCharacterType,
      selectedAnimalType,
      customAnimal,
      customCharacter,
      characterName,
      selectedSetting,
      customSetting,
      selectedStarter,
    ],
  );

  const handleSkip = useCallback(() => {
    if (currentStep === 3) {
      // Skip on final step defaults to 'ai' and starts the story
      if (isStartingRef.current) return;
      isStartingRef.current = true;
      setIsStarting(true);
      isNavigatingAway.current = true;
      navigation.navigate('Home', { storySetup: buildAnswers('ai') });
      return;
    }
    animateStepTransition('forward', () => {
      // Clear state for the skipped step
      if (currentStep === 0) {
        setSelectedGenre(null);
      } else if (currentStep === 1) {
        setSelectedCharacterType(null);
        setSelectedAnimalType(null);
        setCustomAnimal('');
        setCustomCharacter('');
        setCharacterName('');
      } else if (currentStep === 2) {
        setSelectedSetting(null);
        setCustomSetting('');
      }
      setCurrentStep(prev => prev + 1);
    });
  }, [currentStep, navigation, buildAnswers, animateStepTransition]);

  const handleNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS - 1) {
      animateStepTransition('forward', () => {
        setCurrentStep(prev => prev + 1);
      });
    }
  }, [currentStep, animateStepTransition]);

  const handleStartStory = useCallback(() => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setIsStarting(true);
    isNavigatingAway.current = true;
    navigation.navigate('Home', { storySetup: buildAnswers() });
  }, [navigation, buildAnswers]);

  // ── Effects ───────────────────────────────────────────────────

  // Animate progress dot with spring "pop" when step changes
  useEffect(() => {
    dotAnims.forEach((anim, index) => {
      if (index === currentStep) {
        Animated.spring(anim, {
          toValue: 1.3,
          useNativeDriver: true,
          friction: 4,
          tension: 200,
        }).start(() => {
          Animated.spring(anim, {
            toValue: 1,
            useNativeDriver: true,
            friction: 5,
          }).start();
        });
      }
    });
  }, [currentStep, dotAnims]);

  // Android hardware back button: go to previous step on steps 1-3
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currentStep > 0) {
        handleBack();
        return true;
      }
      return false; // Allow default (exit screen) on step 0
    });
    return () => handler.remove();
  }, [currentStep, handleBack]);

  // iOS swipe-back gesture: intercept and go to previous step on steps 1-3
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      if (isNavigatingAway.current) return; // Allow intentional navigation
      if (currentStep > 0) {
        e.preventDefault();
        handleBack();
      }
    });
    return unsubscribe;
  }, [currentStep, handleBack, navigation]);

  // ── Progress Dots ───────────────────────────────────────────────

  const renderProgressDots = () => (
    <View style={styles.progressContainer}>
      {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
        <Animated.View
          key={index}
          style={[
            styles.progressDot,
            index <= currentStep && styles.progressDotActive,
            { transform: [{ scale: dotAnims[index] }] },
          ]}
        />
      ))}
    </View>
  );

  // ── Genre Grid ──────────────────────────────────────────────────

  const renderGenreGrid = () => (
    <View style={styles.gridContainer}>
      {GENRE_OPTIONS.map(option => {
        const isSelected = selectedGenre === option.value;
        const label = getGenreLabel(option.value, gradeLevel);

        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.genreButton,
              isSelected && styles.genreButtonSelected,
            ]}
            onPress={() => handleGenrePress(option.value)}
            activeOpacity={0.7}
          >
            <Text style={styles.genreEmoji}>{option.emoji}</Text>
            <Text
              style={[
                styles.genreLabel,
                isSelected && styles.genreLabelSelected,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── Character Step (Step 1) ─────────────────────────────────────

  const renderCharacterStep = () => (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Character type grid */}
        <View style={styles.gridContainer}>
          {CHARACTER_OPTIONS.map(option => {
            const isSelected = selectedCharacterType === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.genreButton,
                  isSelected && styles.genreButtonSelected,
                ]}
                onPress={() => handleCharacterTypePress(option.value)}
                activeOpacity={0.7}
              >
                <Text style={styles.genreEmoji}>{option.emoji}</Text>
                <Text
                  style={[
                    styles.genreLabel,
                    isSelected && styles.genreLabelSelected,
                  ]}
                >
                  {option.value}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Animal inline expansion */}
        {selectedCharacterType === 'Animal' && (
          <View style={styles.expansionContainer}>
            <Text style={styles.expansionLabel}>Pick an animal:</Text>
            <View style={styles.gridContainer}>
              {ANIMAL_OPTIONS.map(option => {
                const isSelected = selectedAnimalType === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.genreButton,
                      isSelected && styles.genreButtonSelected,
                    ]}
                    onPress={() => handleAnimalTypePress(option.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.genreEmoji}>{option.emoji}</Text>
                    <Text
                      style={[
                        styles.genreLabel,
                        isSelected && styles.genreLabelSelected,
                      ]}
                    >
                      {option.value}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* "Other" animal text input */}
            {selectedAnimalType === 'Other' && (
              <TextInput
                style={styles.textInput}
                placeholder="Type of animal..."
                placeholderTextColor={theme.colors.textDisabled}
                value={customAnimal}
                onChangeText={setCustomAnimal}
                maxLength={30}
                autoCapitalize="sentences"
                returnKeyType="done"
              />
            )}
          </View>
        )}

        {/* Custom character text input */}
        {selectedCharacterType === 'Custom' && (
          <View style={styles.expansionContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Describe your character..."
              placeholderTextColor={theme.colors.textDisabled}
              value={customCharacter}
              onChangeText={setCustomCharacter}
              maxLength={50}
              autoCapitalize="sentences"
              returnKeyType="done"
            />
          </View>
        )}

        {/* Character name — always visible */}
        <View style={styles.nameInputContainer}>
          <Text style={styles.nameInputLabel}>
            Give them a name: (optional)
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="Character name..."
            placeholderTextColor={theme.colors.textDisabled}
            value={characterName}
            onChangeText={setCharacterName}
            maxLength={30}
            autoCapitalize="words"
            returnKeyType="done"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ── Setting Step (Step 2) ──────────────────────────────────────

  const renderSettingStep = () => (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Setting grid */}
        <View style={styles.gridContainer}>
          {SETTING_OPTIONS.map(option => {
            const isSelected = selectedSetting === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.genreButton,
                  isSelected && styles.genreButtonSelected,
                ]}
                onPress={() => handleSettingPress(option.value)}
                activeOpacity={0.7}
              >
                <Text style={styles.genreEmoji}>{option.emoji}</Text>
                <Text
                  style={[
                    styles.genreLabel,
                    isSelected && styles.genreLabelSelected,
                  ]}
                >
                  {option.value}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom setting text input */}
        {selectedSetting === 'Custom' && (
          <View style={styles.expansionContainer}>
            <TextInput
              ref={customSettingInputRef}
              style={styles.textInput}
              placeholder="Describe a place..."
              placeholderTextColor={theme.colors.textDisabled}
              value={customSetting}
              onChangeText={setCustomSetting}
              maxLength={50}
              autoCapitalize="sentences"
              returnKeyType="done"
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ── Starter Options (Step 3) ──────────────────────────────────

  const renderStarterOptions = () => (
    <View style={styles.starterContainer}>
      {STARTER_OPTIONS.map(option => {
        const isSelected = selectedStarter === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.starterButton,
              isSelected && styles.starterButtonSelected,
            ]}
            onPress={() => handleStarterPress(option.value)}
            activeOpacity={0.7}
          >
            <Text style={styles.starterEmoji}>{option.emoji}</Text>
            <Text
              style={[
                styles.starterLabel,
                isSelected && styles.starterLabelSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── Bottom Bar ──────────────────────────────────────────────────

  const renderBottomBar = () => {
    const isLastStep = currentStep === 3;

    return (
      <View style={styles.bottomBar}>
        {/* Left: Close (X) on step 0, Back on steps 1+ */}
        {currentStep === 0 ? (
          <TouchableOpacity
            style={styles.bottomBarButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.bottomBarButton}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}

        {/* Skip — center */}
        <TouchableOpacity
          style={styles.bottomBarButton}
          onPress={handleSkip}
          activeOpacity={0.7}
          disabled={isStarting}
        >
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>

        {/* Right: "Start Story" on step 3, "Next" otherwise */}
        {isLastStep ? (
          <TouchableOpacity
            style={[
              styles.bottomBarButton,
              styles.startStoryButton,
              isStarting && styles.startStoryButtonDisabled,
            ]}
            onPress={handleStartStory}
            activeOpacity={0.7}
            disabled={isStarting}
          >
            <Text style={styles.nextButtonText}>
              {isStarting ? 'Starting…' : 'Start Story'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.bottomBarButton, styles.nextButton]}
            onPress={handleNext}
            activeOpacity={0.7}
          >
            <Text style={styles.nextButtonText}>Next</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ── Step titles ────────────────────────────────────────────────

  const stepTitles = [
    'Pick a story genre',
    'Who is your character?',
    'Where does the story happen?',
    'Who writes first?',
  ];

  // ── Render step content ───────────────────────────────────────

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderGenreGrid();
      case 1:
        return renderCharacterStep();
      case 2:
        return renderSettingStep();
      case 3:
        return renderStarterOptions();
      default:
        return null;
    }
  };

  // ── Render ──────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {renderProgressDots()}

        <View style={styles.stepContentWrapper}>
          <Animated.View
            style={[
              styles.stepAnimatedContent,
              { transform: [{ translateX: slideAnim }] },
            ]}
          >
            <Text style={styles.stepTitle}>{stepTitles[currentStep]}</Text>
            {renderStepContent()}
          </Animated.View>
        </View>
      </View>

      {renderBottomBar()}
    </SafeAreaView>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.section,
  },
  stepContentWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  stepAnimatedContent: {
    flex: 1,
  },

  // Progress dots
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.section,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.border,
  },
  progressDotActive: {
    backgroundColor: theme.colors.primary,
  },

  // Step title
  stepTitle: {
    fontSize: theme.typography.textStyles.h2.fontSize,
    fontWeight: theme.typography.textStyles.h2.fontWeight,
    lineHeight:
      theme.typography.textStyles.h2.fontSize *
      theme.typography.textStyles.h2.lineHeight,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },

  // Genre grid
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  genreButton: {
    width: '47%',
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.md,
    borderWidth: theme.layout.borderWidthThick,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.button,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  genreButtonSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.inputBackgroundValid, // #f0fff0 — light green
  },
  genreEmoji: {
    fontSize: 28,
    marginBottom: theme.spacing.xs,
  },
  genreLabel: {
    fontSize: theme.typography.textStyles.button.fontSize,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text,
    textAlign: 'center',
  },
  genreLabelSelected: {
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeight.semibold,
  },

  // Character step
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: theme.spacing.xl,
  },
  expansionContainer: {
    marginTop: theme.spacing.base,
  },
  expansionLabel: {
    fontSize: theme.typography.textStyles.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  textInput: {
    borderWidth: theme.layout.borderWidth,
    borderColor: theme.colors.inputBorder,
    borderRadius: theme.borderRadius.input,
    backgroundColor: theme.colors.inputBackground,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.base,
    fontSize: theme.typography.textStyles.body.fontSize,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
  },
  nameInputContainer: {
    marginTop: theme.spacing.xl,
  },
  nameInputLabel: {
    fontSize: theme.typography.textStyles.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },

  // Starter options (Step 3) — full-width stacked buttons
  starterContainer: {
    gap: theme.spacing.base,
  },
  starterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    borderWidth: theme.layout.borderWidthThick,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.button,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.sm,
  },
  starterButtonSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.inputBackgroundValid,
  },
  starterEmoji: {
    fontSize: 28,
    marginRight: theme.spacing.base,
  },
  starterLabel: {
    fontSize: theme.typography.textStyles.body.fontSize,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text,
  },
  starterLabelSelected: {
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeight.semibold,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.screen,
    paddingVertical: theme.spacing.base,
    borderTopWidth: theme.layout.borderWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  bottomBarButton: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.base,
    minWidth: 60,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  backButtonText: {
    fontSize: theme.typography.textStyles.button.fontSize,
    fontWeight: theme.typography.textStyles.button.fontWeight,
    color: theme.colors.textSecondary,
  },
  skipButtonText: {
    fontSize: theme.typography.textStyles.button.fontSize,
    fontWeight: theme.typography.textStyles.button.fontWeight,
    color: theme.colors.textSecondary,
  },
  nextButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.button,
    paddingHorizontal: theme.spacing.xl,
  },
  startStoryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.button,
    paddingHorizontal: theme.spacing.xl,
  },
  startStoryButtonDisabled: {
    backgroundColor: theme.colors.disabled,
  },
  nextButtonText: {
    fontSize: theme.typography.textStyles.button.fontSize,
    fontWeight: theme.typography.textStyles.button.fontWeight,
    color: '#ffffff',
  },
});

export default StorySetupScreen;
