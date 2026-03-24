/**
 * Consent Pending Screen (US-002)
 *
 * Displayed while waiting for a parent to grant consent via the email link.
 * Shows the pending state, allows resending the consent email, and
 * polls for consent status updates via Convex real-time queries.
 *
 * The child cannot access any app features while on this screen.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { theme } from '../constants/theme';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../services/convex';
import { useSafeClerkAuth } from '../hooks/useSafeClerkAuth';

interface ConsentPendingScreenProps {
  onConsentGranted: () => void;
  onSignOut: () => void;
}

const ConsentPendingScreen: React.FC<ConsentPendingScreenProps> = ({
  onConsentGranted,
  onSignOut,
}) => {
  const { clerkUser } = useSafeClerkAuth();
  const clerkUserId = clerkUser?.user?.id;

  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(false);

  // Real-time consent status query — Convex will reactively update
  const consentStatus = useQuery(
    api.consent.getConsentStatus,
    clerkUserId ? { clerkUserId } : 'skip',
  );

  const submitParentEmail = useMutation(api.consent.submitParentEmail);
  const sendConsentEmail = useAction(api.consent.sendConsentEmail);

  // If consent is granted, notify parent component
  React.useEffect(() => {
    if (consentStatus?.status === 'granted') {
      onConsentGranted();
    }
  }, [consentStatus?.status, onConsentGranted]);

  const handleResendEmail = useCallback(async () => {
    if (!consentStatus?.parentEmail || resendCooldown) return;

    setResending(true);
    try {
      // Create new consent record (expires old one)
      const result = await submitParentEmail({
        parentEmail: consentStatus.parentEmail,
      });

      // Send email
      await sendConsentEmail({
        parentEmail: consentStatus.parentEmail,
        consentToken: result.consentToken,
      });

      // Set cooldown to prevent spam
      setResendCooldown(true);
      setTimeout(() => setResendCooldown(false), 60000); // 1 minute cooldown

      Alert.alert(
        'Email Sent',
        'A new consent email has been sent to your parent.',
      );
    } catch (err) {
      Alert.alert(
        'Error',
        'Could not resend the email. Please try again later.',
      );
    } finally {
      setResending(false);
    }
  }, [
    consentStatus?.parentEmail,
    resendCooldown,
    submitParentEmail,
    sendConsentEmail,
  ]);

  const maskedEmail = consentStatus?.parentEmail
    ? maskEmail(consentStatus.parentEmail)
    : '...';

  const expiresIn = consentStatus?.tokenExpiresAt
    ? formatTimeRemaining(consentStatus.tokenExpiresAt - Date.now())
    : '';

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>&#9993;&#65039;</Text>
        <Text style={styles.title}>Waiting for Your Parent</Text>

        <View style={styles.statusCard}>
          <Text style={styles.statusText}>
            We sent an email to{' '}
            <Text style={styles.emailHighlight}>{maskedEmail}</Text>
          </Text>
          <Text style={styles.statusSubtext}>
            Your parent needs to open the email and click the consent link. Once
            they do, you'll be all set to start creating stories!
          </Text>
          {expiresIn && (
            <Text style={styles.expiryText}>Link expires in {expiresIn}</Text>
          )}
        </View>

        <View style={styles.stepsContainer}>
          <Text style={styles.stepsTitle}>What happens next:</Text>
          <Step number={1} text="Your parent opens their email" />
          <Step number={2} text="They click the consent link" />
          <Step number={3} text="They review and approve" />
          <Step number={4} text="You can start making stories!" active />
        </View>

        <TouchableOpacity
          style={[
            styles.resendButton,
            (resendCooldown || resending) && styles.resendButtonDisabled,
          ]}
          onPress={handleResendEmail}
          disabled={resendCooldown || resending}
        >
          {resending ? (
            <ActivityIndicator color={theme.colors.primary} size="small" />
          ) : (
            <Text
              style={[
                styles.resendButtonText,
                resendCooldown && styles.resendButtonTextDisabled,
              ]}
            >
              {resendCooldown ? 'Email sent! Wait a moment...' : 'Resend Email'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutButton} onPress={onSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const Step: React.FC<{ number: number; text: string; active?: boolean }> = ({
  number,
  text,
  active,
}) => (
  <View style={styles.step}>
    <View style={[styles.stepNumber, active && styles.stepNumberActive]}>
      <Text
        style={[styles.stepNumberText, active && styles.stepNumberTextActive]}
      >
        {number}
      </Text>
    </View>
    <Text style={[styles.stepText, active && styles.stepTextActive]}>
      {text}
    </Text>
  </View>
);

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const masked =
    local.length > 2 ? local[0] + '***' + local[local.length - 1] : '***';
  return `${masked}@${domain}`;
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'expired';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours >= 1) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  const minutes = Math.floor(ms / (1000 * 60));
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
  },
  emoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: 24,
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: '#f0f4ff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    marginBottom: 24,
  },
  statusText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  emailHighlight: {
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary,
  },
  statusSubtext: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  expiryText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textDisabled,
    textAlign: 'center',
    marginTop: 8,
  },
  stepsContainer: {
    width: '100%',
    marginBottom: 24,
  },
  stepsTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: 12,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberActive: {
    backgroundColor: theme.colors.primary,
  },
  stepNumberText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    color: '#888',
  },
  stepNumberTextActive: {
    color: '#fff',
  },
  stepText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
  },
  stepTextActive: {
    color: theme.colors.text,
    fontWeight: theme.typography.fontWeight.medium,
  },
  resendButton: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 10,
    padding: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  resendButtonDisabled: {
    borderColor: theme.colors.disabled,
  },
  resendButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  resendButtonTextDisabled: {
    color: theme.colors.textDisabled,
  },
  signOutButton: {
    padding: 14,
    alignItems: 'center',
  },
  signOutButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.base,
  },
});

export default ConsentPendingScreen;
