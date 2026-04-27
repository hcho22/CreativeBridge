/**
 * Onboarding Checklist Modal (US-018)
 *
 * A modal that displays the onboarding checklist, accessible from Settings/Profile.
 * Allows users who dismissed the checklist on HomeScreen to re-access their progress.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Pressable,
} from 'react-native';
import { useQuery } from 'convex/react';
import { theme } from '../../constants/theme';
import { api } from '../../services/convex';
import { OnboardingChecklist } from './OnboardingChecklist';
import { onboardingMilestoneTracker } from '../../services/onboardingMilestoneTracker';

/**
 * Props for the OnboardingChecklistModal component
 */
export interface OnboardingChecklistModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when the modal is closed */
  onClose: () => void;
  /** User ID for server-side hydration of progress */
  userId?: string;
}

/**
 * OnboardingChecklistModal wraps the OnboardingChecklist component in a modal
 * for access from Settings/Profile screens.
 */
export const OnboardingChecklistModal: React.FC<
  OnboardingChecklistModalProps
> = ({ visible, onClose, userId }) => {
  const [scaleAnim] = useState(() => new Animated.Value(0));
  const [opacityAnim] = useState(() => new Animated.Value(0));
  const [isComplete, setIsComplete] = useState(false);

  // Fetch server onboarding status via Convex React hook
  const serverOnboarding = useQuery(
    api.onboarding.getOnboardingStatus,
    userId ? { clerkUserId: userId } : 'skip',
  );

  // Check if onboarding is complete, merging server + local data
  useEffect(() => {
    const checkCompletion = async () => {
      const serverComplete = serverOnboarding?.onboardingCompleted ?? false;
      const localComplete =
        await onboardingMilestoneTracker.isOnboardingComplete();
      setIsComplete(serverComplete || localComplete);
    };
    if (visible) {
      checkCompletion();
    }
  }, [visible, serverOnboarding]);

  // Animate modal on open/close
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: theme.animation.fast,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: theme.animation.fast,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: theme.animation.fast,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleAnim, opacityAnim]);

  // Handle closing and resetting dismissed state
  const handleClose = useCallback(() => {
    // When user views the checklist from Settings, reset the dismissed state
    // so it can show on HomeScreen again if they want
    onboardingMilestoneTracker.resetChecklistDismissed();
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Pressable onPress={e => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Text style={styles.headerIcon}>📋</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Close modal"
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Title */}
            <Text style={styles.title}>Onboarding Progress</Text>
            <Text style={styles.subtitle}>
              {isComplete
                ? "You've completed all onboarding tasks! 🎉"
                : 'Complete these tasks to earn XP and discover features'}
            </Text>

            {/* Checklist */}
            <View style={styles.checklistWrapper}>
              <OnboardingChecklist initiallyCollapsed={false} userId={userId} />
            </View>

            {/* Footer */}
            <TouchableOpacity
              style={styles.doneButton}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close onboarding progress"
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContainer: {
    backgroundColor: theme.colors.paper.card,
    borderRadius: 22,
    width: '100%',
    maxWidth: 400,
    padding: theme.spacing.lg,
    ...theme.shadows.lift,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.base,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.paper.cardWarm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 26,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.paper.cream,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.ink.soft,
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontWeight: theme.typography.fontWeight.medium,
  },
  title: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontStyle: 'italic',
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.ink.base,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.hand,
    color: theme.colors.ink.soft,
    marginBottom: theme.spacing.lg,
    lineHeight: 22,
  },
  checklistWrapper: {
    marginHorizontal: -theme.spacing.base,
    marginBottom: theme.spacing.base,
  },
  doneButton: {
    backgroundColor: theme.colors.accents.foxglove,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  doneButtonText: {
    color: theme.colors.paper.cream,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontWeight: '600',
  },
});

export default OnboardingChecklistModal;
