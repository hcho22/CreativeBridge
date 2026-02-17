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
  },

  // Header Section
  headerSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  welcomeEmoji: {
    fontSize: 48,
    marginBottom: theme.spacing.md,
  },
  tagline: {
    fontSize: theme.typography.fontSize.xxl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
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
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  // Sample Image Section
  sampleImageContainer: {
    height: 140,
    backgroundColor: '#E8F5E9', // Light green matching primary
    overflow: 'hidden',
    position: 'relative',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    transform: [{ skewX: '-20deg' }],
  },
  sampleImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sampleImageEmoji: {
    fontSize: 48,
    marginBottom: theme.spacing.xs,
  },
  sampleImageText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary,
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
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    flex: 1,
  },
  completeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeBadgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: theme.typography.fontWeight.bold,
  },
  samplePreview: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: theme.spacing.sm,
  },
  sampleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sampleMeta: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textDisabled,
  },
  xpBadge: {
    backgroundColor: '#FFF3E0', // Light orange
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  xpBadgeText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: '#FF9800', // Orange
  },

  // Example Label
  exampleLabel: {
    position: 'absolute',
    top: -10,
    right: theme.spacing.base,
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    ...theme.shadows.sm,
  },
  exampleLabelText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    color: '#ffffff',
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
    backgroundColor: theme.colors.inputBackground,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
  },
  featureEmoji: {
    fontSize: 16,
    marginRight: theme.spacing.xs,
  },
  featureText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text,
  },

  // CTA Section
  ctaSection: {
    width: '100%',
    alignItems: 'center',
    gap: theme.spacing.base,
  },
  primaryButton: {
    backgroundColor: '#f44336', // Red - matching existing start button
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xxl,
    borderRadius: 50,
    minWidth: 260,
    alignItems: 'center',
    ...theme.shadows.lg,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.disabled,
    ...theme.shadows.sm,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  secondaryButton: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
  },
  secondaryButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.secondary,
  },
});

export default EnhancedEmptyState;
