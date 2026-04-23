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
import {
  InkButton,
  PaperBackground,
  QuillIcon,
  Stepper,
  Watercolor,
} from '../components/common/storybook';
import {
  animal as animalAsset,
  beach,
  boy,
  castle,
  comedy,
  customChar,
  fairytale,
  fiction,
  forest,
  girl,
  mysteryBox,
  space,
  suspense,
  wizard,
} from '../assets/storybook';
import type { ImageSourcePropType } from 'react-native';

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

// US-005: Watercolor hue + storybook raster asset per option value, ported
// from /tmp/cb_design/components/screens-flow.jsx:104-124. Values match the
// existing StoryGenre/CharacterType/etc. enums so StorySetupAnswers payloads
// are byte-for-byte identical across the refresh.
interface OptionVisualMeta {
  hue: number;
  imageSource?: ImageSourcePropType;
  fallbackEmoji?: string;
}

const GENRE_VISUALS: Record<StoryGenre, OptionVisualMeta> = {
  Mystery: { hue: 260, imageSource: mysteryBox },
  Fantasy: { hue: 290, imageSource: wizard },
  Comedy: { hue: 50, imageSource: comedy },
  Horror: { hue: 300, imageSource: suspense },
  Fiction: { hue: 220, imageSource: fiction },
  'Fairy Tale': { hue: 340, imageSource: fairytale },
};

const CHARACTER_VISUALS: Record<CharacterType, OptionVisualMeta> = {
  Girl: { hue: 20, imageSource: girl },
  Boy: { hue: 40, imageSource: boy },
  Animal: { hue: 30, imageSource: animalAsset },
  Custom: { hue: 70, imageSource: customChar },
};

const SETTING_VISUALS: Record<StorySetting, OptionVisualMeta> = {
  Forest: { hue: 140, imageSource: forest },
  Beach: { hue: 60, imageSource: beach },
  Castle: { hue: 270, imageSource: castle },
  Space: { hue: 240, imageSource: space },
  Custom: { hue: 50, fallbackEmoji: '✏️' },
};

const STARTER_VISUALS: Record<StoryStarter, OptionVisualMeta> = {
  ai: { hue: 230, fallbackEmoji: '✨' },
  user: { hue: 30, fallbackEmoji: '✒️' },
};

// Animals stay emoji-only — no storybook assets for individual species.
const ANIMAL_VISUALS: Record<AnimalType, OptionVisualMeta> = {
  Cat: { hue: 20, fallbackEmoji: '🐱' },
  Dog: { hue: 40, fallbackEmoji: '🐶' },
  Rabbit: { hue: 340, fallbackEmoji: '🐰' },
  Owl: { hue: 50, fallbackEmoji: '🦉' },
  Other: { hue: 70, fallbackEmoji: '✏️' },
};

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

  // US-005: Storybook Stepper (Genre → Hero → Setting → Quill). Replaces the
  // numeric-badge progress bar. The animated dot/progress values are retained
  // in state so existing animation hooks (animateStepTransition, etc.) keep
  // working — we just don't read from them here.
  const stepLabels = ['Genre', 'Hero', 'Setting', 'Quill'];

  const renderProgressBar = () => (
    <Stepper step={currentStep} steps={stepLabels} />
  );

  // US-005: Shared option-card body used across genre/character/animal/
  // setting/starter render functions. Each card is a Watercolor tile (hue +
  // optional storybook asset) + Fraunces label + optional Caveat subtitle +
  // checkmark. Mirrors /tmp/cb_design/components/screens-flow.jsx:52-87.
  const renderOptionCard = (args: {
    key: string;
    label: string;
    subtitle?: string;
    selected: boolean;
    onPress: () => void;
    meta: OptionVisualMeta;
  }) => {
    const { key, label, subtitle, selected, onPress, meta } = args;
    return (
      <TouchableOpacity
        key={key}
        style={[styles.optionCard, selected && styles.optionCardSelected]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <Watercolor hue={meta.hue} size={54} imageSource={meta.imageSource}>
          {meta.imageSource ? undefined : meta.fallbackEmoji}
        </Watercolor>
        <View style={styles.optionCardTextBlock}>
          <Text
            style={[
              styles.optionCardLabel,
              selected && styles.optionCardLabelSelected,
            ]}
          >
            {label}
          </Text>
          {subtitle ? (
            <Text style={styles.optionCardSubtitle}>{subtitle}</Text>
          ) : null}
        </View>
        <View
          style={[
            styles.optionCardCheckbox,
            selected && styles.optionCardCheckboxSelected,
          ]}
        >
          {selected ? <Text style={styles.optionCardCheckmark}>✓</Text> : null}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Genre List (full-width cards) ───────────────────────────────

  const GENRE_SUBTITLES: Record<StoryGenre, string> = {
    Mystery: 'Secrets wait to be found',
    Fantasy: 'Magic & wonder',
    Comedy: 'Make them laugh',
    Horror: 'Keep them guessing',
    Fiction: 'Your own imagined world',
    'Fairy Tale': 'Once upon a time...',
  };

  const renderGenreList = () => (
    <View style={styles.optionCardList}>
      {GENRE_OPTIONS.map(option =>
        renderOptionCard({
          key: option.value,
          label: getGenreLabel(option.value, gradeLevel),
          subtitle: GENRE_SUBTITLES[option.value],
          selected: selectedGenre === option.value,
          onPress: () => handleGenrePress(option.value),
          meta: GENRE_VISUALS[option.value],
        }),
      )}
    </View>
  );

  // ── Character Step (Step 1) ─────────────────────────────────────

  const CHARACTER_SUBTITLES: Record<CharacterType, string> = {
    Girl: 'Resourceful & curious',
    Boy: 'Ready for adventure',
    Animal: 'Fox, owl, or something wilder',
    Custom: 'Someone else entirely',
  };

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
        <View style={styles.optionCardList}>
          {CHARACTER_OPTIONS.map(option =>
            renderOptionCard({
              key: option.value,
              label: option.value,
              subtitle: CHARACTER_SUBTITLES[option.value],
              selected: selectedCharacterType === option.value,
              onPress: () => handleCharacterTypePress(option.value),
              meta: CHARACTER_VISUALS[option.value],
            }),
          )}
        </View>

        {selectedCharacterType === 'Animal' && (
          <View style={styles.expansionContainer}>
            <Text style={styles.expansionLabel}>Pick an animal</Text>
            <View style={styles.optionCardList}>
              {ANIMAL_OPTIONS.map(option =>
                renderOptionCard({
                  key: option.value,
                  label: option.value,
                  selected: selectedAnimalType === option.value,
                  onPress: () => handleAnimalTypePress(option.value),
                  meta: ANIMAL_VISUALS[option.value],
                }),
              )}
            </View>

            {selectedAnimalType === 'Other' && (
              <TextInput
                style={styles.textInput}
                placeholder="Type of animal..."
                placeholderTextColor={theme.colors.ink.faint}
                value={customAnimal}
                onChangeText={setCustomAnimal}
                maxLength={30}
                autoCapitalize="sentences"
                returnKeyType="done"
              />
            )}
          </View>
        )}

        {selectedCharacterType === 'Custom' && (
          <View style={styles.expansionContainer}>
            <Text style={styles.expansionLabel}>Describe your character</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. A shy dragon who collects lost buttons"
              placeholderTextColor={theme.colors.ink.faint}
              value={customCharacter}
              onChangeText={setCustomCharacter}
              maxLength={50}
              autoCapitalize="sentences"
              returnKeyType="done"
            />
          </View>
        )}

        <View style={styles.nameInputContainer}>
          <Text style={styles.nameInputLabel}>Give them a name (optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Felix the Fox"
            placeholderTextColor={theme.colors.ink.faint}
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

  const SETTING_LABELS: Record<StorySetting, string> = {
    Forest: 'Whispering Woods',
    Beach: 'A sunlit shore',
    Castle: 'Forgotten castle',
    Space: 'Among the stars',
    Custom: 'Somewhere of your making',
  };

  const SETTING_SUBTITLES: Record<StorySetting, string> = {
    Forest: 'Ancient trees, hidden paths',
    Beach: 'Salt air & mystery tides',
    Castle: 'Towers & secret corridors',
    Space: 'Rockets & distant worlds',
    Custom: 'Describe the place',
  };

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
        <View style={styles.optionCardList}>
          {SETTING_OPTIONS.map(option =>
            renderOptionCard({
              key: option.value,
              label: SETTING_LABELS[option.value],
              subtitle: SETTING_SUBTITLES[option.value],
              selected: selectedSetting === option.value,
              onPress: () => handleSettingPress(option.value),
              meta: SETTING_VISUALS[option.value],
            }),
          )}
        </View>

        {selectedSetting === 'Custom' && (
          <View style={styles.expansionContainer}>
            <Text style={styles.expansionLabel}>Describe the place</Text>
            <TextInput
              ref={customSettingInputRef}
              style={styles.textInput}
              placeholder="e.g. An old lighthouse on a cliff full of seabirds"
              placeholderTextColor={theme.colors.ink.faint}
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

  const STARTER_SUBTITLES: Record<StoryStarter, string> = {
    ai: "Let the AI spin the opening — you'll continue",
    user: 'Write the opening lines yourself',
  };

  const STARTER_LABELS: Record<StoryStarter, string> = {
    ai: 'The AI starts the story',
    user: 'I want to start',
  };

  // US-005: Step 3 renders starter options PLUS a "Your story so far"
  // preview card with Fraunces interpolation and Pills.
  const renderStarterOptions = () => {
    const genreLabel = selectedGenre
      ? getGenreLabel(selectedGenre, gradeLevel).toLowerCase()
      : '...';
    const characterLabel = characterName
      ? characterName
      : selectedCharacterType === 'Custom'
      ? customCharacter || 'your hero'
      : selectedCharacterType === 'Animal'
      ? selectedAnimalType === 'Other'
        ? customAnimal || 'a creature'
        : (selectedAnimalType ?? 'an animal').toLowerCase()
      : (selectedCharacterType ?? 'your hero').toLowerCase();
    const settingLabel =
      selectedSetting === 'Custom'
        ? customSetting || 'a place of your making'
        : selectedSetting
        ? SETTING_LABELS[selectedSetting].toLowerCase()
        : 'a place of your making';

    return (
      <View style={styles.optionCardList}>
        {STARTER_OPTIONS.map(option =>
          renderOptionCard({
            key: option.value,
            label: STARTER_LABELS[option.value],
            subtitle: STARTER_SUBTITLES[option.value],
            selected: selectedStarter === option.value,
            onPress: () => handleStarterPress(option.value),
            meta: STARTER_VISUALS[option.value],
          }),
        )}

        <View style={styles.previewCard}>
          <Text style={styles.previewEyebrow}>YOUR STORY SO FAR</Text>
          <Text style={styles.previewBody}>
            A <Text style={styles.previewAccent}>{genreLabel}</Text> tale,
            starring <Text style={styles.previewAccent}>{characterLabel}</Text>,
            unfolding in{' '}
            <Text style={styles.previewAccent}>{settingLabel}</Text>.
          </Text>
          <View style={styles.previewPillRow}>
            <View style={styles.previewPill}>
              <Text style={styles.previewPillText}>+40 XP on completion</Text>
            </View>
            <View style={styles.previewPill}>
              <Text style={styles.previewPillText}>5 rounds</Text>
            </View>
            <View style={styles.previewPill}>
              <Text style={styles.previewPillText}>
                {gradeLevel} reading level
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // ── Bottom Bar ──────────────────────────────────────────────────

  // US-005: Bottom bar. Primary CTA becomes a storybook InkButton — primary
  // variant for intermediate steps, foxglove + QuillIcon for the final step
  // ("Open the book"). Handler wiring (handleNext / handleStartStory) and
  // disabled logic are unchanged.
  const renderBottomBar = () => {
    const isLastStep = currentStep === 3;
    const ctaLabel = isStarting
      ? 'Starting…'
      : isLastStep
      ? 'Open the book'
      : 'Next';
    const ctaOnPress = isLastStep ? handleStartStory : handleNext;

    return (
      <View style={styles.bottomBar}>
        <InkButton
          variant={isLastStep ? 'foxglove' : 'primary'}
          onPress={ctaOnPress}
          disabled={isStarting}
          icon={
            isLastStep ? (
              <QuillIcon size={18} color={theme.colors.paper.cream} />
            ) : undefined
          }
          style={styles.ctaButton}
        >
          {ctaLabel}
        </InkButton>
        <View style={styles.bottomBarTopRow}>
          {currentStep === 0 ? (
            <TouchableOpacity
              style={styles.bottomBarTextButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text style={styles.closeButtonText}>← Close</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.bottomBarTextButton}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <Text style={styles.backButtonText}>← Back</Text>
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
      </View>
    );
  };

  // ── Step titles ────────────────────────────────────────────────

  // US-005: Titles/subtitles match /tmp/cb_design/components/screens-flow.jsx:126-131.
  const stepTitles = [
    'Pick a story genre',
    'Who is your hero?',
    'Where does it all happen?',
    'Who writes first?',
  ];

  const stepSubtitles = [
    'What kind of tale will this be?',
    'Choose who stars in your story',
    'Set the stage for the magic',
    'Pass the quill, or take it up yourself',
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
      <PaperBackground style={StyleSheet.absoluteFillObject} />
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
    backgroundColor: 'transparent',
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

  // Step title — Fraunces italic per design.
  stepTitle: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 32,
    fontStyle: 'italic',
    color: theme.colors.ink.base,
    letterSpacing: -0.8,
    textAlign: 'center',
    lineHeight: 36,
  },
  stepSubtitle: {
    fontFamily: theme.typography.fontFamily.hand,
    fontSize: 20,
    color: theme.colors.ink.soft,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },

  // Full-width option card pattern (shared across Genre/Character/Setting/Starter).
  optionCardList: {
    gap: 0,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: theme.colors.paper.edge,
    backgroundColor: theme.colors.paper.card,
    marginBottom: 12,
    ...theme.shadows.paper,
  },
  optionCardSelected: {
    borderWidth: 2,
    borderColor: theme.colors.accents.foxglove,
    backgroundColor: theme.colors.paper.cardWarm,
  },
  optionCardTextBlock: {
    flex: 1,
  },
  optionCardLabel: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 20,
    color: theme.colors.ink.base,
    letterSpacing: -0.3,
  },
  optionCardLabelSelected: {
    color: theme.colors.accents.foxglove,
  },
  optionCardSubtitle: {
    fontSize: 13,
    color: theme.colors.ink.faint,
    marginTop: 2,
  },
  optionCardCheckbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: theme.colors.paper.edge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCardCheckboxSelected: {
    backgroundColor: theme.colors.accents.foxglove,
    borderColor: theme.colors.accents.foxglove,
  },
  optionCardCheckmark: {
    color: theme.colors.paper.cream,
    fontSize: 14,
    fontWeight: '700',
  },

  // US-005: Preview card (Step 3).
  previewCard: {
    marginTop: 20,
    padding: 18,
    borderRadius: 18,
    backgroundColor: theme.colors.paper.cardWarm,
    borderWidth: 1.5,
    borderColor: theme.colors.paper.edge,
    borderStyle: 'dashed',
  },
  previewEyebrow: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: theme.colors.ink.faint,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  previewBody: {
    fontFamily: theme.typography.fontFamily.serif,
    fontSize: 17,
    lineHeight: 26,
    color: theme.colors.ink.base,
  },
  previewAccent: {
    fontStyle: 'italic',
    color: theme.colors.accents.foxglove,
  },
  previewPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  previewPill: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: theme.colors.paper.card,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
  },
  previewPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.accents.moss,
  },

  // Character / setting step layout.
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
    fontFamily: theme.typography.fontFamily.hand,
    fontSize: 18,
    color: theme.colors.accents.foxglove,
    marginBottom: 6,
    marginLeft: 4,
    marginTop: 12,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: theme.colors.paper.edge,
    borderRadius: 12,
    backgroundColor: theme.colors.paper.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.serif,
    color: theme.colors.ink.base,
    marginTop: theme.spacing.md,
  },
  nameInputContainer: {
    marginTop: theme.spacing.xl,
  },
  nameInputLabel: {
    fontFamily: theme.typography.fontFamily.hand,
    fontSize: 18,
    color: theme.colors.ink.soft,
    marginBottom: theme.spacing.sm,
    marginLeft: 4,
  },

  // Bottom bar.
  bottomBar: {
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 32,
    gap: 12,
    backgroundColor: 'transparent',
  },
  bottomBarTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomBarTextButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  closeButtonText: {
    fontSize: 14,
    color: theme.colors.ink.soft,
    fontWeight: '600',
  },
  backButtonText: {
    fontSize: 14,
    color: theme.colors.ink.soft,
    fontWeight: '600',
  },
  skipButtonText: {
    fontSize: 14,
    color: theme.colors.ink.faint,
    fontWeight: '500',
  },
  ctaButton: {
    width: '100%',
    paddingVertical: 16,
  },
});

export default StorySetupScreen;
