/**
 * First Story Guidance Modal Component (US-012)
 *
 * Educational modal that appears before a user's first story to explain
 * how collaborative AI storytelling works. Only shown once per user.
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';

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

interface GuidanceItem {
  emoji: string;
  text: string;
}

const GUIDANCE_ITEMS: GuidanceItem[] = [
  {
    emoji: '🤝',
    text: "You'll write a story together with AI",
  },
  {
    emoji: '🎨',
    text: 'The AI will continue your story and create illustrations',
  },
  {
    emoji: '📖',
    text: 'Complete 5 rounds to finish your story',
  },
  {
    emoji: '⭐',
    text: 'Earn XP and level up as you write!',
  },
];

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
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

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
      setDontShowAgain(false);
    }
  }, [visible, scaleAnim, opacityAnim]);

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
              <Text style={styles.iconText}>📚</Text>
            </View>

            {/* Title */}
            <Text style={styles.title} accessibilityRole="header">
              How Storytelling Works
            </Text>

            {/* Subtitle */}
            <Text style={styles.subtitle}>
              Get ready for a magical adventure!
            </Text>

            {/* Guidance bullet points */}
            <View style={styles.guidanceList}>
              {GUIDANCE_ITEMS.map((item, index) => (
                <View
                  key={index}
                  style={styles.guidanceItem}
                  accessible
                  accessibilityLabel={item.text}
                >
                  <Text style={styles.guidanceEmoji}>{item.emoji}</Text>
                  <Text style={styles.guidanceText}>{item.text}</Text>
                </View>
              ))}
            </View>

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
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xxl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    ...theme.shadows.lg,
  },
  closeButton: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E9', // Light green background
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  iconText: {
    fontSize: 40,
  },
  title: {
    fontSize: theme.typography.fontSize.xxl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.normal,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  guidanceList: {
    width: '100%',
    marginBottom: theme.spacing.lg,
  },
  guidanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.base,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.base,
    marginBottom: theme.spacing.sm,
  },
  guidanceEmoji: {
    fontSize: 24,
    marginRight: theme.spacing.base,
  },
  guidanceText: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text,
    lineHeight: 22,
  },
  dontShowAgainContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  dontShowAgainText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
  },
  ctaButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.base,
    borderRadius: theme.borderRadius.button,
    minWidth: 160,
    ...theme.shadows.sm,
  },
  ctaButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    color: '#ffffff',
    textAlign: 'center',
  },
});

export default FirstStoryGuidanceModal;
