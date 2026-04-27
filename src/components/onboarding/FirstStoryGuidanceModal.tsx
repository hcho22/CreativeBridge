/**
 * First Story Guidance Modal Component (US-012)
 *
 * Educational modal that appears before a user's first story to explain
 * how collaborative AI storytelling works and shows onboarding progress.
 * Only shown once per user.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import { onboardingMilestoneTracker } from '../../services/onboardingMilestoneTracker';

export interface FirstStoryGuidanceModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when user proceeds (closes modal and starts story) */
  onProceed: () => void;
  /** Whether to show "Don't show again" option (default: true) */
  showDontShowAgain?: boolean;
  /** Callback when "Don't show again" is toggled */
  onDontShowAgainChange?: (value: boolean) => void;
}

interface ChecklistItem {
  id: string;
  emoji: string;
  title: string;
  xpReward: number;
  isCompleted: boolean;
}

export const FirstStoryGuidanceModal: React.FC<
  FirstStoryGuidanceModalProps
> = ({
  visible,
  onClose,
  onProceed,
  showDontShowAgain = true,
  onDontShowAgainChange,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Calculate completion stats
  const completedCount = checklistItems.filter(item => item.isCompleted).length;
  const totalCount = checklistItems.length;
  const completionPercentage =
    totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Load onboarding progress when modal becomes visible
  useEffect(() => {
    if (visible) {
      const loadProgress = async () => {
        try {
          setIsLoading(true);
          const progress =
            await onboardingMilestoneTracker.getMilestoneProgress();

          const items: ChecklistItem[] = [
            {
              id: 'create_account',
              emoji: '✅',
              title: 'Create your account',
              xpReward: 0,
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
        } catch (error) {
          console.error('❌ Error loading onboarding progress:', error);
          setIsLoading(false);
        }
      };

      loadProgress();
    }
  }, [visible]);

  // Update progress bar animation when completion changes
  useEffect(() => {
    if (!isLoading && checklistItems.length > 0) {
      Animated.timing(progressAnim, {
        toValue: completionPercentage,
        duration: theme.animation.normal,
        useNativeDriver: false,
      }).start();
    }
  }, [completionPercentage, isLoading, checklistItems.length, progressAnim]);

  // Animate modal appearance
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: theme.animation.normal,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset animations when modal closes
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      progressAnim.setValue(0);
      setDontShowAgain(false);
    }
  }, [visible, scaleAnim, opacityAnim, progressAnim]);

  const handleDontShowAgainChange = (value: boolean) => {
    setDontShowAgain(value);
    onDontShowAgainChange?.(value);
  };

  const handleProceed = () => {
    onProceed();
  };

  const handleBackdropPress = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      accessibilityViewIsModal
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* Backdrop touch handler */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleBackdropPress}
          accessible={false}
        />

        {/* Modal content */}
        <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.modalContainer,
              {
                opacity: opacityAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
            accessible
            accessibilityLabel="Welcome to collaborative storytelling. How storytelling works."
          >
            {/* Close button */}
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Close guidance"
              accessibilityRole="button"
              accessibilityHint="Dismisses this guidance modal"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>

            {/* Header icon */}
            <View style={styles.iconContainer}>
              <Text style={styles.iconText}>📋</Text>
            </View>

            {/* Title */}
            <Text style={styles.title} accessibilityRole="header">
              Onboarding Progress
            </Text>

            {/* Subtitle */}
            <Text style={styles.subtitle}>
              {'Complete these tasks to\nearn XP and discover features'}
            </Text>

            {/* Progress Section */}
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : (
              <>
                {/* Getting Started Header with Progress */}
                <View style={styles.progressHeader}>
                  <View style={styles.progressHeaderLeft}>
                    <Text style={styles.progressTitle}>Getting Started</Text>
                    <Text style={styles.progressSubtitle}>
                      {completedCount}/{totalCount} completed
                    </Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBarBackground}>
                    <Animated.View
                      style={[
                        styles.progressBarFill,
                        {
                          width: progressAnim.interpolate({
                            inputRange: [0, 100],
                            outputRange: ['0%', '100%'],
                          }),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressPercentage}>
                    {Math.round(completionPercentage)}%
                  </Text>
                </View>

                {/* Checklist Items */}
                <View style={styles.checklistContainer}>
                  {checklistItems.map((item, index) => (
                    <View
                      key={item.id}
                      style={[
                        styles.checklistItem,
                        index === checklistItems.length - 1 &&
                          styles.checklistItemLast,
                        item.isCompleted && styles.checklistItemCompleted,
                      ]}
                      accessible
                      accessibilityLabel={`${item.title}${
                        item.isCompleted
                          ? ', completed'
                          : item.xpReward > 0
                          ? `, earn ${item.xpReward} XP`
                          : ''
                      }`}
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
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Don't show again toggle */}
            {showDontShowAgain && (
              <View style={styles.dontShowAgainContainer}>
                <Text style={styles.dontShowAgainText}>
                  Don't show this again
                </Text>
                <Switch
                  value={dontShowAgain}
                  onValueChange={handleDontShowAgainChange}
                  trackColor={{
                    false: theme.colors.inputBackground,
                    true: theme.colors.primary,
                  }}
                  thumbColor={dontShowAgain ? '#ffffff' : '#f4f3f4'}
                  ios_backgroundColor={theme.colors.inputBackground}
                  accessibilityLabel="Don't show again toggle"
                  accessibilityHint="When enabled, this guidance will not appear for future stories"
                />
              </View>
            )}

            {/* CTA Button */}
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleProceed}
              activeOpacity={0.8}
              accessibilityLabel="Let's Go!"
              accessibilityRole="button"
              accessibilityHint="Start creating your first story"
            >
              <Text style={styles.ctaButtonText}>Let's Go! ✨</Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  modalContainer: {
    backgroundColor: theme.colors.paper.card,
    borderRadius: 22,
    padding: theme.spacing.xxl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    ...theme.shadows.lift,
  },
  closeButton: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.paper.cream,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.ink.soft,
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontWeight: theme.typography.fontWeight.medium,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.paper.cardWarm,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  iconText: {
    fontSize: 42,
  },
  title: {
    fontSize: theme.typography.fontSize.xxl,
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontStyle: 'italic',
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.ink.base,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    width: '100%',
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.hand,
    fontWeight: theme.typography.fontWeight.normal,
    color: theme.colors.ink.soft,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  // Loading state
  loadingContainer: {
    width: '100%',
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Progress header styles
  progressHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  progressHeaderLeft: {
    flex: 1,
  },
  progressTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.ink.base,
    marginBottom: theme.spacing.xs,
  },
  progressSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontWeight: theme.typography.fontWeight.normal,
    color: theme.colors.ink.soft,
  },

  // Progress bar styles
  progressBarContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: theme.colors.paper.deep,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.accents.moss,
    borderRadius: 999,
  },
  progressPercentage: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.serifBold,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.accents.moss,
    minWidth: 40,
    textAlign: 'right',
    marginLeft: theme.spacing.sm,
  },

  // Checklist styles
  checklistContainer: {
    width: '100%',
    alignSelf: 'stretch',
    borderTopWidth: 1,
    borderTopColor: theme.colors.paper.edge,
    marginBottom: theme.spacing.md,
  },
  checklistItem: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.paper.edge,
    backgroundColor: theme.colors.paper.card,
  },
  checklistItemLast: {
    borderBottomWidth: 0,
  },
  checklistItemCompleted: {
    backgroundColor: theme.colors.paper.cardWarm,
    opacity: 0.95,
  },
  emojiContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.paper.cream,
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
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontWeight: theme.typography.fontWeight.normal,
    color: theme.colors.ink.base,
  },
  itemTitleCompleted: {
    textDecorationLine: 'line-through',
    color: theme.colors.ink.soft,
  },
  xpBadge: {
    backgroundColor: theme.colors.accents.moss + '22',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: 999,
    marginLeft: theme.spacing.sm,
  },
  xpBadgeCompleted: {
    backgroundColor: theme.colors.accents.moss + '33',
  },
  xpBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.serifBold,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.accents.moss,
  },
  xpBadgeTextCompleted: {
    color: theme.colors.accents.moss,
  },
  dontShowAgainContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.accents.foxglove,
  },
  dontShowAgainText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.uiRegular,
    color: theme.colors.ink.soft,
  },
  ctaButton: {
    backgroundColor: theme.colors.accents.foxglove,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 160,
    ...theme.shadows.sm,
  },
  ctaButtonText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontWeight: '600',
    color: theme.colors.paper.cream,
    textAlign: 'center',
  },
});

export default FirstStoryGuidanceModal;
