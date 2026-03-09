import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { theme } from '../constants/theme';
import { HomeStackParamList } from '../navigation/AppNavigator';
import type { StoryGenre } from '../types/storySetup';
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

// ─── Constants ──────────────────────────────────────────────────────

const TOTAL_STEPS = 4;

// ─── Component ──────────────────────────────────────────────────────

const StorySetupScreen: React.FC<StorySetupScreenProps> = ({ navigation }) => {
  const { userProfile } = useAuth();
  const gradeLevel: GradeLevel =
    (userProfile?.preferred_grade_level as GradeLevel) ?? 'K-2';

  // Wizard state — only genre for Step 0 (other steps will extend this)
  const [selectedGenre, setSelectedGenre] = useState<StoryGenre | null>(null);

  // Current step — Step 0 is Genre
  const [currentStep] = useState(0);

  // ── Handlers ────────────────────────────────────────────────────

  const handleGenrePress = useCallback((genre: StoryGenre) => {
    // Toggle: tap selected genre to deselect
    setSelectedGenre(prev => (prev === genre ? null : genre));
  }, []);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleSkip = useCallback(() => {
    // Skip sets genre to null — advance to step 1
    // For now (US-003 only), this is a placeholder for future steps.
    // Once steps 1-3 are implemented, this will advance `currentStep`.
    setSelectedGenre(null);
    // TODO: advance to step 1 when character step is implemented
  }, []);

  const handleNext = useCallback(() => {
    // Advance to step 1 with selected genre (null if none selected = same as skip)
    // TODO: advance to step 1 when character step is implemented
  }, []);

  // ── Progress Dots ───────────────────────────────────────────────

  const renderProgressDots = () => (
    <View style={styles.progressContainer}>
      {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.progressDot,
            index <= currentStep && styles.progressDotActive,
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

  // ── Bottom Bar ──────────────────────────────────────────────────

  const renderBottomBar = () => (
    <View style={styles.bottomBar}>
      {/* Close (X) — left side (step 0 has no Back) */}
      <TouchableOpacity
        style={styles.bottomBarButton}
        onPress={handleClose}
        activeOpacity={0.7}
      >
        <Text style={styles.closeButtonText}>✕</Text>
      </TouchableOpacity>

      {/* Skip — center */}
      <TouchableOpacity
        style={styles.bottomBarButton}
        onPress={handleSkip}
        activeOpacity={0.7}
      >
        <Text style={styles.skipButtonText}>Skip</Text>
      </TouchableOpacity>

      {/* Next — right */}
      <TouchableOpacity
        style={[styles.bottomBarButton, styles.nextButton]}
        onPress={handleNext}
        activeOpacity={0.7}
      >
        <Text style={styles.nextButtonText}>Next</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Render ──────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {renderProgressDots()}

        <Text style={styles.stepTitle}>Pick a story genre</Text>

        {renderGenreGrid()}
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
  nextButtonText: {
    fontSize: theme.typography.textStyles.button.fontSize,
    fontWeight: theme.typography.textStyles.button.fontWeight,
    color: '#ffffff',
  },
});

export default StorySetupScreen;
