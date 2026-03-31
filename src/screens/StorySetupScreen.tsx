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
import LinearGradient from 'react-native-linear-gradient';
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
  const progressAnim = useRef(new Animated.Value(1 / TOTAL_STEPS)).current;

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

  // Animate progress badge with spring "pop" and progress bar fill when step changes
  useEffect(() => {
    // Badge spring pop (reuse dotAnims for badge scale)
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
    // Progress bar fill animation (JS-driven since width is a layout prop)
    Animated.timing(progressAnim, {
      toValue: (currentStep + 1) / TOTAL_STEPS,
      duration: theme.animation.normal,
      useNativeDriver: false,
    }).start();
  }, [currentStep, dotAnims, progressAnim]);

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

  // ── Progress Bar ────────────────────────────────────────────────

  const stepLabels = ['Genre', 'Character', 'Setting', 'Start'];

  const renderProgressBar = () => {
    const fillWidth = progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    });

    return (
      <View style={styles.progressBarContainer}>
        {/* Numbered badge with spring pop */}
        <Animated.View
          style={[
            styles.progressBadge,
            { transform: [{ scale: dotAnims[currentStep] }] },
          ]}
        >
          <Text style={styles.progressBadgeText}>{currentStep + 1}</Text>
        </Animated.View>

        {/* Step label */}
        <Text style={styles.progressStepLabel}>{stepLabels[currentStep]}</Text>

        {/* Track + animated fill */}
        <View style={styles.progressBarTrack}>
          <Animated.View
            style={[styles.progressBarFill, { width: fillWidth }]}
          />
        </View>
      </View>
    );
  };

  // ── Genre List (full-width cards) ───────────────────────────────

  const renderGenreList = () => (
    <View style={styles.optionCardList}>
      {GENRE_OPTIONS.map(option => {
        const isSelected = selectedGenre === option.value;
        const label = getGenreLabel(option.value, gradeLevel);

        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.optionCard, isSelected && styles.optionCardSelected]}
            onPress={() => handleGenrePress(option.value)}
            activeOpacity={0.7}
          >
            {/* Left — Emoji circle */}
            <View
              style={[
                styles.optionCardEmojiCircle,
                isSelected && styles.optionCardEmojiCircleSelected,
              ]}
            >
              <Text style={styles.optionCardEmoji}>{option.emoji}</Text>
            </View>

            {/* Center — Label */}
            <Text
              style={[
                styles.optionCardLabel,
                isSelected && styles.optionCardLabelSelected,
              ]}
            >
              {label}
            </Text>

            {/* Right — Checkbox */}
            <View
              style={[
                styles.optionCardCheckbox,
                isSelected && styles.optionCardCheckboxSelected,
              ]}
            >
              {isSelected && <Text style={styles.optionCardCheckmark}>✓</Text>}
            </View>
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
        {/* Character type cards */}
        <View style={styles.optionCardList}>
          {CHARACTER_OPTIONS.map(option => {
            const isSelected = selectedCharacterType === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                ]}
                onPress={() => handleCharacterTypePress(option.value)}
                activeOpacity={0.7}
              >
                {/* Left — Emoji circle */}
                <View
                  style={[
                    styles.optionCardEmojiCircle,
                    isSelected && styles.optionCardEmojiCircleSelected,
                  ]}
                >
                  <Text style={styles.optionCardEmoji}>{option.emoji}</Text>
                </View>

                {/* Center — Label */}
                <Text
                  style={[
                    styles.optionCardLabel,
                    isSelected && styles.optionCardLabelSelected,
                  ]}
                >
                  {option.value}
                </Text>

                {/* Right — Checkbox */}
                <View
                  style={[
                    styles.optionCardCheckbox,
                    isSelected && styles.optionCardCheckboxSelected,
                  ]}
                >
                  {isSelected && (
                    <Text style={styles.optionCardCheckmark}>✓</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Animal inline expansion */}
        {selectedCharacterType === 'Animal' && (
          <View style={styles.expansionContainer}>
            <Text style={styles.expansionLabel}>Pick an animal:</Text>
            <View style={styles.optionCardList}>
              {ANIMAL_OPTIONS.map(option => {
                const isSelected = selectedAnimalType === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardSelected,
                    ]}
                    onPress={() => handleAnimalTypePress(option.value)}
                    activeOpacity={0.7}
                  >
                    {/* Left — Emoji circle */}
                    <View
                      style={[
                        styles.optionCardEmojiCircle,
                        isSelected && styles.optionCardEmojiCircleSelected,
                      ]}
                    >
                      <Text style={styles.optionCardEmoji}>{option.emoji}</Text>
                    </View>

                    {/* Center — Label */}
                    <Text
                      style={[
                        styles.optionCardLabel,
                        isSelected && styles.optionCardLabelSelected,
                      ]}
                    >
                      {option.value}
                    </Text>

                    {/* Right — Checkbox */}
                    <View
                      style={[
                        styles.optionCardCheckbox,
                        isSelected && styles.optionCardCheckboxSelected,
                      ]}
                    >
                      {isSelected && (
                        <Text style={styles.optionCardCheckmark}>✓</Text>
                      )}
                    </View>
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
        {/* Setting cards (full-width) */}
        <View style={styles.optionCardList}>
          {SETTING_OPTIONS.map(option => {
            const isSelected = selectedSetting === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                ]}
                onPress={() => handleSettingPress(option.value)}
                activeOpacity={0.7}
              >
                {/* Left — Emoji circle */}
                <View
                  style={[
                    styles.optionCardEmojiCircle,
                    isSelected && styles.optionCardEmojiCircleSelected,
                  ]}
                >
                  <Text style={styles.optionCardEmoji}>{option.emoji}</Text>
                </View>

                {/* Center — Label */}
                <Text
                  style={[
                    styles.optionCardLabel,
                    isSelected && styles.optionCardLabelSelected,
                  ]}
                >
                  {option.value}
                </Text>

                {/* Right — Checkbox */}
                <View
                  style={[
                    styles.optionCardCheckbox,
                    isSelected && styles.optionCardCheckboxSelected,
                  ]}
                >
                  {isSelected && (
                    <Text style={styles.optionCardCheckmark}>✓</Text>
                  )}
                </View>
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

  // ── Starter Options (Step 3) — full-width option cards ─────────

  const renderStarterOptions = () => (
    <View style={styles.optionCardList}>
      {STARTER_OPTIONS.map(option => {
        const isSelected = selectedStarter === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.optionCard, isSelected && styles.optionCardSelected]}
            onPress={() => handleStarterPress(option.value)}
            activeOpacity={0.7}
          >
            {/* Left — Emoji circle */}
            <View
              style={[
                styles.optionCardEmojiCircle,
                isSelected && styles.optionCardEmojiCircleSelected,
              ]}
            >
              <Text style={styles.optionCardEmoji}>{option.emoji}</Text>
            </View>

            {/* Center — Label */}
            <Text
              style={[
                styles.optionCardLabel,
                isSelected && styles.optionCardLabelSelected,
              ]}
            >
              {option.label}
            </Text>

            {/* Right — Checkbox */}
            <View
              style={[
                styles.optionCardCheckbox,
                isSelected && styles.optionCardCheckboxSelected,
              ]}
            >
              {isSelected && <Text style={styles.optionCardCheckmark}>✓</Text>}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── Bottom Bar ──────────────────────────────────────────────────

  const renderBottomBar = () => {
    const isLastStep = currentStep === 3;
    const ctaLabel = isStarting
      ? 'Starting…'
      : isLastStep
      ? 'Start Story'
      : 'Next';
    const ctaOnPress = isLastStep ? handleStartStory : handleNext;

    return (
      <View style={styles.bottomBar}>
        {/* Top row: Back/Close (left) + Skip (right) */}
        <View style={styles.bottomBarTopRow}>
          {currentStep === 0 ? (
            <TouchableOpacity
              style={styles.bottomBarTextButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.bottomBarTextButton}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.bottomBarTextButton}
            onPress={handleSkip}
            activeOpacity={0.7}
            disabled={isStarting}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Gradient CTA button */}
        <TouchableOpacity
          onPress={ctaOnPress}
          activeOpacity={0.7}
          disabled={isStarting}
          style={isStarting ? styles.ctaDisabled : undefined}
        >
          <LinearGradient
            colors={['#4CAF50', '#2196F3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaButtonText}>{ctaLabel}</Text>
          </LinearGradient>
        </TouchableOpacity>
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

  const stepSubtitles = [
    'Choose a genre for your adventure',
    'Pick who will star in your story',
    'Select where the magic happens',
    'Decide how your story begins',
  ];

  // ── Render step content ───────────────────────────────────────

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderGenreList();
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
        {renderProgressBar()}

        <View style={styles.stepContentWrapper}>
          <Animated.View
            style={[
              styles.stepAnimatedContent,
              { transform: [{ translateX: slideAnim }] },
            ]}
          >
            <Text style={styles.stepTitle}>{stepTitles[currentStep]}</Text>
            <Text style={styles.stepSubtitle}>
              {stepSubtitles[currentStep]}
            </Text>
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

  // Progress bar
  progressBarContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.section,
  },
  progressBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  progressBadgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  progressStepLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: theme.colors.textSecondary,
    marginBottom: 10,
  },
  progressBarTrack: {
    width: '100%' as const,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden' as const,
  },
  progressBarFill: {
    height: '100%' as const,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
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
    marginBottom: 0,
  },
  stepSubtitle: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },

  // Full-width option card pattern (shared by Genre, Character, Setting, and Starter steps)
  optionCardList: {
    gap: 0, // marginBottom on each card handles spacing
  },
  optionCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#ffffff',
    marginBottom: 12,
    ...theme.shadows.sm,
  },
  optionCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#f0fff0',
  },
  optionCardEmojiCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  optionCardEmojiCircleSelected: {
    backgroundColor: '#e8f5e9',
  },
  optionCardEmoji: {
    fontSize: 24,
  },
  optionCardLabel: {
    flex: 1,
    marginLeft: 14,
    fontSize: 17,
    fontWeight: '500' as const,
    color: '#333333',
  },
  optionCardLabelSelected: {
    fontWeight: '600' as const,
    color: theme.colors.primary,
  },
  optionCardCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#d0d0d0',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  optionCardCheckboxSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  optionCardCheckmark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700' as const,
    lineHeight: 16,
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
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#666666',
    marginBottom: 10,
    marginTop: 20,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
  },
  nameInputContainer: {
    marginTop: theme.spacing.xl,
  },
  nameInputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#666666',
    marginBottom: theme.spacing.sm,
  },

  // Bottom bar
  bottomBar: {
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: theme.colors.surface,
  },
  bottomBarTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.screen,
    marginBottom: 8,
  },
  bottomBarTextButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.base,
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
  ctaButton: {
    height: 52,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600' as const,
  },
  ctaDisabled: {
    opacity: 0.5,
  },
});

export default StorySetupScreen;
