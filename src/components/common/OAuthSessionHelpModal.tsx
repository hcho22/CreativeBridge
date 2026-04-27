/**
 * OAuth Session Help Modal Component (US-009)
 *
 * Displays provider-specific instructions for clearing OS-level OAuth sessions.
 * Used when the app detects a stale OAuth session that cannot be cleared
 * programmatically (e.g., Google or Apple sessions cached at the system level).
 *
 * This modal guides users through the manual steps needed to sign out from
 * their OAuth provider at the system level, enabling them to sign in with
 * a different account.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import { useParentalGate } from './ParentalGate';

export type OAuthProvider = 'google' | 'apple';

interface OAuthSessionHelpModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when modal is closed (including "Try Again" button) */
  onClose: () => void;
  /** The OAuth provider that has a stale session */
  provider: OAuthProvider;
}

interface InstructionStep {
  step: number;
  title: string;
  description: string;
}

/**
 * Get provider-specific instructions for clearing OAuth session
 */
function getProviderInstructions(provider: OAuthProvider): {
  title: string;
  icon: string;
  intro: string;
  steps: InstructionStep[];
  tip?: string;
} {
  if (provider === 'google') {
    return {
      title: 'Google Account Session',
      icon: '🔐',
      intro:
        'Your device has a cached Google sign-in session. To sign in with a different Google account, you need to clear the session from your browser.',
      steps: [
        {
          step: 1,
          title: 'Open Safari or Chrome',
          description: 'Open your default web browser on this device.',
        },
        {
          step: 2,
          title: 'Go to google.com',
          description: 'Navigate to google.com in the browser.',
        },
        {
          step: 3,
          title: 'Sign out of Google',
          description:
            'Tap your profile picture in the top right corner and select "Sign out" or "Sign out of all accounts".',
        },
        {
          step: 4,
          title: 'Return to the app',
          description:
            'Come back to this app and try signing in again with your desired Google account.',
        },
      ],
      tip: 'If you use multiple Google accounts, make sure to sign out of all of them to ensure a fresh sign-in.',
    };
  }

  // Apple provider
  return {
    title: 'Apple ID Session',
    icon: '',
    intro:
      'Your device is using your Apple ID for sign-in. To sign in with a different Apple ID, you may need to adjust your device settings.',
    steps:
      Platform.OS === 'ios'
        ? [
            {
              step: 1,
              title: 'Open Settings',
              description: 'Go to the Settings app on your iPhone or iPad.',
            },
            {
              step: 2,
              title: 'Tap your name',
              description:
                'Tap your name at the top of the Settings screen to access your Apple ID settings.',
            },
            {
              step: 3,
              title: 'Scroll down and Sign Out',
              description:
                'Scroll to the bottom and tap "Sign Out". You may be asked to enter your Apple ID password.',
            },
            {
              step: 4,
              title: 'Sign back in (optional)',
              description:
                'If you want to use a different Apple ID, you can sign in with that account in Settings.',
            },
            {
              step: 5,
              title: 'Return to the app',
              description:
                'Come back to this app and try signing in again with Apple.',
            },
          ]
        : [
            {
              step: 1,
              title: 'Use an iOS device',
              description:
                'Sign in with Apple is primarily managed through iOS devices.',
            },
            {
              step: 2,
              title: 'Open Settings on iOS',
              description:
                'On an iPhone or iPad signed into your Apple ID, go to Settings.',
            },
            {
              step: 3,
              title: 'Manage Apple ID',
              description:
                'Tap your name, then go to "Password & Security" > "Apps Using Apple ID" to manage app access.',
            },
          ],
    tip:
      Platform.OS === 'ios'
        ? 'Note: Signing out of your Apple ID will also sign you out of iCloud, the App Store, and other Apple services on this device.'
        : undefined,
  };
}

export const OAuthSessionHelpModal: React.FC<OAuthSessionHelpModalProps> = ({
  visible,
  onClose,
  provider,
}) => {
  const instructions = getProviderInstructions(provider);
  const { openURL, parentalGateModal } = useParentalGate();

  const handleOpenSettings = () => {
    if (Platform.OS === 'ios' && provider === 'apple') {
      Linking.openSettings();
    } else if (provider === 'google') {
      openURL('https://accounts.google.com');
    }
  };

  return (
    <>
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
            onPress={onClose}
            accessible={false}
          />

          <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
            <View
              style={styles.modalContainer}
              accessible
              accessibilityRole="alert"
              accessibilityLabel={`${instructions.title}. ${instructions.intro}`}
            >
              {/* Close button */}
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                accessibilityLabel="Close help"
                accessibilityRole="button"
                accessibilityHint="Dismisses this help modal"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>

              {/* Header */}
              <View style={styles.iconContainer}>
                <Text style={styles.iconText}>{instructions.icon}</Text>
              </View>

              <Text style={styles.title} accessibilityRole="header">
                {instructions.title}
              </Text>

              {/* Scrollable content */}
              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Intro text */}
                <Text style={styles.introText}>{instructions.intro}</Text>

                {/* Steps */}
                <View style={styles.stepsContainer}>
                  {instructions.steps.map(step => (
                    <View key={step.step} style={styles.stepItem}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>{step.step}</Text>
                      </View>
                      <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>{step.title}</Text>
                        <Text style={styles.stepDescription}>
                          {step.description}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Tip */}
                {instructions.tip && (
                  <View style={styles.tipContainer}>
                    <Text style={styles.tipIcon}>💡</Text>
                    <Text style={styles.tipText}>{instructions.tip}</Text>
                  </View>
                )}
              </ScrollView>

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                {/* Quick action button (open settings/browser) */}
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleOpenSettings}
                  accessibilityLabel={
                    provider === 'apple' ? 'Open Settings' : 'Open Google'
                  }
                  accessibilityRole="button"
                >
                  <Text style={styles.secondaryButtonText}>
                    {provider === 'apple' ? 'Open Settings' : 'Open Google'}
                  </Text>
                </TouchableOpacity>

                {/* Try Again button */}
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={onClose}
                  accessibilityLabel="Try Again"
                  accessibilityRole="button"
                  accessibilityHint="Closes the help and lets you try signing in again"
                >
                  <Text style={styles.primaryButtonText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* US-009: Parental Gate for external links */}
      {parentalGateModal}
    </>
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
    padding: theme.spacing.lg,
  },
  modalContainer: {
    backgroundColor: theme.colors.paper.card,
    borderWidth: 1.5,
    borderColor: theme.colors.paper.edge,
    borderRadius: 22,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
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
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    fontFamily: theme.typography.fontFamily.uiMedium,
    fontSize: 16,
    color: theme.colors.ink.soft,
    fontWeight: '500',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.paper.cardWarm,
    borderWidth: 1.5,
    borderColor: theme.colors.accents.foxglove,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: theme.spacing.base,
  },
  iconText: {
    fontSize: 34,
  },
  title: {
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontSize: 22,
    fontStyle: 'italic',
    color: theme.colors.ink.base,
    textAlign: 'center',
    marginBottom: theme.spacing.base,
    letterSpacing: -0.3,
  },
  scrollView: {
    flexGrow: 0,
    marginBottom: theme.spacing.base,
  },
  scrollContent: {
    paddingBottom: theme.spacing.sm,
  },
  introText: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 14,
    color: theme.colors.ink.soft,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: theme.spacing.lg,
  },
  stepsContainer: {
    marginBottom: theme.spacing.base,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: theme.spacing.base,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.accents.foxglove,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
    marginTop: 2,
  },
  stepNumberText: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 14,
    color: theme.colors.paper.cream,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.ink.base,
    marginBottom: 2,
  },
  stepDescription: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 13,
    color: theme.colors.ink.soft,
    lineHeight: 19,
  },
  tipContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.paper.cardWarm,
    borderWidth: 1,
    borderColor: theme.colors.accents.gold,
    borderRadius: 12,
    padding: theme.spacing.md,
    alignItems: 'flex-start',
  },
  tipIcon: {
    fontSize: 18,
    marginRight: theme.spacing.sm,
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 13,
    color: theme.colors.ink.base,
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: theme.colors.paper.cream,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
    paddingVertical: 14,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.ink.soft,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: theme.colors.accents.foxglove,
    paddingVertical: 14,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  primaryButtonText: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.paper.cream,
  },
});

export default OAuthSessionHelpModal;
