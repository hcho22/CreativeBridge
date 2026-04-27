/**
 * Enhanced Empty State Component (US-017)
 *
 * Displays an inspiring empty state for new users with no stories.
 * Features a sample story card preview, engaging tagline, and clear CTAs.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { theme } from '../../constants/theme';

export interface EnhancedEmptyStateProps {
  /** User's display name for personalization */
  userName?: string;
  /** Primary CTA callback - start first story */
  onStartFirstStory: () => void;
  /** Secondary CTA callback - show guidance modal */
  onSeeHowItWorks?: () => void;
  /** Whether the start button is in loading state */
  isLoading?: boolean;
}

/**
 * Sample story data for the preview mockup
 */
const SAMPLE_STORY = {
  title: 'The Magic Garden',
  preview:
    'Once upon a time, in a garden filled with wonder, a tiny seed began to glow with mysterious light...',
  wordCount: 342,
  rounds: 5,
};

/**
 * Feature highlights shown below the sample story
 */
const FEATURE_HIGHLIGHTS = [
  {
    emoji: '✨',
    text: 'AI continues your story',
  },
  {
    emoji: '🎨',
    text: 'Illustrations for your words',
  },
  {
    emoji: '⭐',
    text: 'Earn XP as you write',
  },
];

export const EnhancedEmptyState: React.FC<EnhancedEmptyStateProps> = ({
  userName,
  onStartFirstStory,
  onSeeHowItWorks,
  isLoading = false,
}) => {
  // Animation values
  const floatAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Entrance and floating animations
  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: theme.animation.slow,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Floating animation for the sample card
    const floatAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    floatAnimation.start();

    // Shimmer animation for the image placeholder
    const shimmerAnimation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2500,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    shimmerAnimation.start();

    return () => {
      floatAnimation.stop();
      shimmerAnimation.stop();
    };
  }, [floatAnim, shimmerAnim, scaleAnim, opacityAnim]);

  const floatTranslateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 100],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
      accessible
      accessibilityLabel="Welcome to CreativeBridge. Start your storytelling adventure."
    >
      {/* Header Section */}
      <View style={styles.headerSection}>
        <Text style={styles.welcomeEmoji}>📚</Text>
        <Text style={styles.tagline}>Create magical stories with AI</Text>
        <Text style={styles.subtitle}>
          {userName
            ? `Hi ${userName}! Your creative adventure awaits.`
            : 'Your creative adventure awaits.'}
        </Text>
      </View>

      {/* Sample Story Card Preview */}
      <Animated.View
        style={[
          styles.sampleCardContainer,
          {
            transform: [{ translateY: floatTranslateY }],
          },
        ]}
      >
        <View style={styles.sampleCard}>
          {/* Sample Image Placeholder with shimmer effect */}
          <View style={styles.sampleImageContainer}>
            <Animated.View
              style={[
                styles.shimmerOverlay,
                {
                  transform: [{ translateX: shimmerTranslateX }],
                },
              ]}
            />
            <View style={styles.sampleImagePlaceholder}>
              <Text style={styles.sampleImageEmoji}>🌸</Text>
              <Text style={styles.sampleImageText}>AI Illustration</Text>
            </View>
          </View>

          {/* Sample Story Content */}
          <View style={styles.sampleContent}>
            <View style={styles.sampleHeader}>
              <Text style={styles.sampleTitle}>{SAMPLE_STORY.title}</Text>
              <View style={styles.completeBadge}>
                <Text style={styles.completeBadgeText}>✓</Text>
              </View>
            </View>
            <Text style={styles.samplePreview} numberOfLines={2}>
              {SAMPLE_STORY.preview}
            </Text>
            <View style={styles.sampleFooter}>
              <Text style={styles.sampleMeta}>
                {SAMPLE_STORY.wordCount} words • {SAMPLE_STORY.rounds} rounds
              </Text>
              <View style={styles.xpBadge}>
                <Text style={styles.xpBadgeText}>+125 XP</Text>
              </View>
            </View>
          </View>
        </View>

        {/* "Example Story" label */}
        <View style={styles.exampleLabel}>
          <Text style={styles.exampleLabelText}>Example Story</Text>
        </View>
      </Animated.View>

      {/* Feature Highlights */}
      <View style={styles.featureHighlights}>
        {FEATURE_HIGHLIGHTS.map((feature, index) => (
          <View
            key={index}
            style={styles.featureItem}
            accessible
            accessibilityLabel={feature.text}
          >
            <Text style={styles.featureEmoji}>{feature.emoji}</Text>
            <Text style={styles.featureText}>{feature.text}</Text>
          </View>
        ))}
      </View>

      {/* CTA Buttons */}
      <View style={styles.ctaSection}>
        <TouchableOpacity
          style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
          onPress={onStartFirstStory}
          disabled={isLoading}
          activeOpacity={0.8}
          accessibilityLabel="Start Your First Story"
          accessibilityRole="button"
          accessibilityHint="Begin creating your first AI-powered story"
        >
          {isLoading ? (
            <Text style={styles.primaryButtonText}>✨ Creating...</Text>
          ) : (
            <Text style={styles.primaryButtonText}>
              🎮 Start Your First Story
            </Text>
          )}
        </TouchableOpacity>

        {onSeeHowItWorks && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onSeeHowItWorks}
            activeOpacity={0.7}
            accessibilityLabel="See how it works"
            accessibilityRole="button"
            accessibilityHint="Opens a guide explaining collaborative storytelling"
          >
            <Text style={styles.secondaryButtonText}>💡 See how it works</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    backgroundColor: theme.colors.paper.base,
  },

  // Header Section
  headerSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  welcomeEmoji: {
    fontSize: 50,
    marginBottom: theme.spacing.md,
  },
  tagline: {
    fontSize: theme.typography.fontSize.xxl,
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontStyle: 'italic',
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.ink.base,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.hand,
    color: theme.colors.ink.soft,
    textAlign: 'center',
  },

  // Sample Card Container
  sampleCardContainer: {
    width: '100%',
    maxWidth: 320,
    marginBottom: theme.spacing.xxl,
    position: 'relative',
  },
  sampleCard: {
    backgroundColor: theme.colors.paper.card,
    borderRadius: 18,
    overflow: 'hidden',
    ...theme.shadows.paper,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
  },

  // Sample Image Section
  sampleImageContainer: {
    height: 140,
    backgroundColor: theme.colors.paper.cardWarm,
    overflow: 'hidden',
    position: 'relative',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 100,
    backgroundColor: 'rgba(251, 245, 230, 0.5)',
    transform: [{ skewX: '-20deg' }],
  },
  sampleImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sampleImageEmoji: {
    fontSize: 50,
    marginBottom: theme.spacing.xs,
  },
  sampleImageText: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.uiMedium,
    color: theme.colors.accents.moss,
    fontWeight: theme.typography.fontWeight.medium,
  },

  // Sample Content Section
  sampleContent: {
    padding: theme.spacing.base,
  },
  sampleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  sampleTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontStyle: 'italic',
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.ink.base,
    flex: 1,
  },
  completeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.accents.moss,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeBadgeText: {
    color: theme.colors.paper.cream,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontWeight: theme.typography.fontWeight.bold,
  },
  samplePreview: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.uiRegular,
    color: theme.colors.ink.soft,
    lineHeight: 22,
    marginBottom: theme.spacing.sm,
  },
  sampleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sampleMeta: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.uiRegular,
    color: theme.colors.ink.faint,
  },
  xpBadge: {
    backgroundColor: theme.colors.accents.moss + '22',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: 999,
  },
  xpBadgeText: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.serifBold,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.accents.moss,
  },

  // Example Label
  exampleLabel: {
    position: 'absolute',
    top: -10,
    right: theme.spacing.base,
    backgroundColor: theme.colors.accents.inkwell,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: 8,
    ...theme.shadows.sm,
  },
  exampleLabelText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.paper.cream,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Feature Highlights
  featureHighlights: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xxl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.paper.cream,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
  },
  featureEmoji: {
    fontSize: 18,
    marginRight: theme.spacing.xs,
  },
  featureText: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.ink.base,
  },

  // CTA Section
  ctaSection: {
    width: '100%',
    alignItems: 'center',
    gap: theme.spacing.base,
  },
  primaryButton: {
    backgroundColor: theme.colors.accents.foxglove,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    minWidth: 260,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.disabled,
    ...theme.shadows.sm,
  },
  primaryButtonText: {
    color: theme.colors.paper.cream,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
  },
  secondaryButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.accents.inkwell,
  },
});

export default EnhancedEmptyState;
