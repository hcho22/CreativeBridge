/**
 * Onboarding Checklist Component (US-008)
 *
 * Displays a collapsible checklist of onboarding tasks to help new users
 * discover key features and earn XP rewards. Tasks include:
 * - Create your account (auto-completed on signup)
 * - Write your first story (+50 XP)
 * - See your first illustration (+25 XP)
 * - Try voice input (+25 XP)
 * - Start a streak (+50 XP)
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { theme } from '../../constants/theme';
import { onboardingMilestoneTracker } from '../../services/onboardingMilestoneTracker';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Individual checklist item configuration
 */
interface ChecklistItem {
  id: string;
  emoji: string;
  title: string;
  xpReward: number;
  isCompleted: boolean;
}

/**
 * Props for the OnboardingChecklist component
 */
export interface OnboardingChecklistProps {
  /** Callback when the checklist is dismissed */
  onDismiss?: () => void;
  /** Whether the checklist starts collapsed (default: false) */
  initiallyCollapsed?: boolean;
  /** Callback when a checklist item is tapped (for navigation hints) */
  onItemPress?: (itemId: string) => void;
}

/**
 * OnboardingChecklist displays a list of first-time tasks for new users
 * with XP rewards and a progress bar showing overall completion.
 */
export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({
  onDismiss,
  initiallyCollapsed = false,
  onItemPress,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(initiallyCollapsed);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Animation values
  const rotateAnim = useRef(
    new Animated.Value(initiallyCollapsed ? 1 : 0),
  ).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Calculate completion stats
  const completedCount = checklistItems.filter(item => item.isCompleted).length;
  const totalCount = checklistItems.length;
  const completionPercentage =
    totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  /**
   * Load milestone progress and build checklist items
   */
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const progress =
          await onboardingMilestoneTracker.getMilestoneProgress();

        const items: ChecklistItem[] = [
          {
            id: 'create_account',
            emoji: '✅',
            title: 'Create your account',
            xpReward: 0, // Auto-completed, no XP
            isCompleted: true, // Always true if they're seeing this
          },
          {
            id: 'first_story',
            emoji: '📝',
            title: 'Write your first story',
            xpReward: 50,
            isCompleted: progress.storiesCompleted,
          },
          {
            id: 'first_image',
            emoji: '🎨',
            title: 'See your first illustration',
            xpReward: 25,
            isCompleted: progress.imagesGenerated,
          },
          {
            id: 'first_voice',
            emoji: '🎤',
            title: 'Try voice input',
            xpReward: 25,
            isCompleted: progress.voiceInputUsed,
          },
          {
            id: 'first_streak',
            emoji: '🔥',
            title: 'Start a streak',
            xpReward: 50,
            isCompleted: progress.streakAchieved,
          },
        ];

        setChecklistItems(items);
        setIsLoading(false);

        // Animate progress bar to current value
        Animated.timing(progressAnim, {
          toValue: completionPercentage,
          duration: theme.animation.slow,
          useNativeDriver: false, // width animation can't use native driver
        }).start();
      } catch (error) {
        console.error('❌ Error loading onboarding progress:', error);
        setIsLoading(false);
      }
    };

    loadProgress();
  }, [progressAnim, completionPercentage]);

  // Update progress bar animation when completion changes
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: completionPercentage,
      duration: theme.animation.normal,
      useNativeDriver: false,
    }).start();
  }, [completionPercentage, progressAnim]);

  /**
   * Toggle collapse/expand state with animation
   */
  const handleToggleCollapse = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    // Animate chevron rotation
    Animated.timing(rotateAnim, {
      toValue: isCollapsed ? 0 : 1,
      duration: theme.animation.fast,
      useNativeDriver: true,
    }).start();

    setIsCollapsed(!isCollapsed);
  };

  /**
   * Render a single checklist item
   */
  const renderChecklistItem = (item: ChecklistItem, index: number) => {
    const isFirst = index === 0;
    const isLast = index === checklistItems.length - 1;

    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.checklistItem,
          isFirst && styles.checklistItemFirst,
          isLast && styles.checklistItemLast,
          item.isCompleted && styles.checklistItemCompleted,
        ]}
        onPress={() => onItemPress?.(item.id)}
        disabled={item.isCompleted}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}${
          item.isCompleted ? ', completed' : `, earn ${item.xpReward} XP`
        }`}
        accessibilityState={{ disabled: item.isCompleted }}
      >
        {/* Emoji/Icon */}
        <View style={styles.emojiContainer}>
          <Text style={styles.emoji}>
            {item.isCompleted ? '✓' : item.emoji}
          </Text>
        </View>

        {/* Title */}
        <Text
          style={[
            styles.itemTitle,
            item.isCompleted && styles.itemTitleCompleted,
          ]}
          numberOfLines={1}
        >
          {item.title}
        </Text>

        {/* XP Badge */}
        {item.xpReward > 0 && (
          <View
            style={[
              styles.xpBadge,
              item.isCompleted && styles.xpBadgeCompleted,
            ]}
          >
            <Text
              style={[
                styles.xpBadgeText,
                item.isCompleted && styles.xpBadgeTextCompleted,
              ]}
            >
              +{item.xpReward} XP
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Calculate chevron rotation
  const chevronRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-90deg'],
  });

  // Calculate progress bar width
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  if (isLoading) {
    return null; // Don't render until loaded
  }

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={`Onboarding checklist, ${completedCount} of ${totalCount} tasks completed`}
    >
      {/* Header with collapse toggle */}
      <TouchableOpacity
        style={styles.header}
        onPress={handleToggleCollapse}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Getting Started, ${
          isCollapsed ? 'expand' : 'collapse'
        } checklist`}
        accessibilityHint={
          isCollapsed
            ? 'Double tap to show checklist items'
            : 'Double tap to hide checklist items'
        }
      >
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Getting Started</Text>
          <Text style={styles.headerSubtitle}>
            {completedCount}/{totalCount} completed
          </Text>
        </View>

        <View style={styles.headerRight}>
          {/* Dismiss button */}
          {onDismiss && (
            <TouchableOpacity
              onPress={onDismiss}
              style={styles.dismissButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss checklist"
            >
              <Text style={styles.dismissButtonText}>✕</Text>
            </TouchableOpacity>
          )}

          {/* Collapse chevron */}
          <Animated.View
            style={[
              styles.chevronContainer,
              { transform: [{ rotate: chevronRotation }] },
            ]}
          >
            <Text style={styles.chevron}>▼</Text>
          </Animated.View>
        </View>
      </TouchableOpacity>

      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <Animated.View
            style={[styles.progressBarFill, { width: progressWidth }]}
          />
        </View>
        <Text style={styles.progressPercentage}>
          {Math.round(completionPercentage)}%
        </Text>
      </View>

      {/* Checklist items (collapsible) */}
      {!isCollapsed && (
        <View style={styles.checklistContainer}>
          {checklistItems.map(renderChecklistItem)}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.card,
    marginHorizontal: theme.spacing.base,
    marginVertical: theme.spacing.sm,
    ...theme.shadows.base,
    overflow: 'hidden',
  },

  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  headerSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal,
    color: theme.colors.textSecondary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dismissButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  dismissButtonText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  chevronContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevron: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },

  // Progress bar styles
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.base,
    paddingBottom: theme.spacing.md,
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
  },
  progressPercentage: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.primary,
    minWidth: 40,
    textAlign: 'right',
    marginLeft: theme.spacing.sm,
  },

  // Checklist items styles
  checklistContainer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  checklistItemFirst: {
    // First item has no special styling needed
  },
  checklistItemLast: {
    borderBottomWidth: 0,
  },
  checklistItemCompleted: {
    backgroundColor: theme.colors.inputBackground,
    opacity: 0.8,
  },
  emojiContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  emoji: {
    fontSize: 18,
  },
  itemTitle: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.normal,
    color: theme.colors.text,
  },
  itemTitleCompleted: {
    textDecorationLine: 'line-through',
    color: theme.colors.textSecondary,
  },
  xpBadge: {
    backgroundColor: theme.colors.primary + '20', // 20% opacity
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    marginLeft: theme.spacing.sm,
  },
  xpBadgeCompleted: {
    backgroundColor: theme.colors.textSecondary + '20',
  },
  xpBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.primary,
  },
  xpBadgeTextCompleted: {
    color: theme.colors.textSecondary,
  },
});

export default OnboardingChecklist;
