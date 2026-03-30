/**
 * Consent Pending Screen (US-002)
 *
 * Displayed while waiting for a parent to grant consent via a shared link.
 * The child shares the consent URL with their parent using the native Share sheet
 * (Messages, email, AirDrop, etc.). The parent opens the link and clicks "I Consent."
 *
 * Convex real-time query detects when consent is granted and unblocks the child.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Share,
  Clipboard,
  Linking,
} from 'react-native';
import { theme } from '../constants/theme';
import { useQuery, useAction } from 'convex/react';
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

  const [loading, setLoading] = useState(false);
  const [consentUrl, setConsentUrl] = useState<string | null>(null);
  const [maskedEmailFromServer, setMaskedEmailFromServer] = useState<
    string | null
  >(null);

  // Real-time consent status query — Convex will reactively update
  const consentStatus = useQuery(
    api.consent.getConsentStatus,
    clerkUserId ? {} : 'skip',
  );

  const getConsentUrl = useAction(api.consent.getConsentUrl);

  // If consent is granted, notify parent component
  React.useEffect(() => {
    if (consentStatus?.status === 'granted') {
      onConsentGranted();
    }
  }, [consentStatus?.status, onConsentGranted]);

  // Build consent URL server-side (token never exposed to client)
  React.useEffect(() => {
    if (!consentStatus || consentUrl) return;
    if (consentStatus.status !== 'pending') return;

    const generateUrl = async () => {
      setLoading(true);
      try {
        const result = await getConsentUrl({});
        setConsentUrl(result.consentUrl);
        if (result.maskedEmail) {
          setMaskedEmailFromServer(result.maskedEmail);
        }
      } catch (err) {
        console.error('[ConsentPending] Failed to generate consent URL:', err);
      } finally {
        setLoading(false);
      }
    };

    generateUrl();
  }, [consentStatus, consentUrl, getConsentUrl]);

  const handleShare = useCallback(async () => {
    if (!consentUrl) return;
    try {
      await Share.share({
        title: 'CreativeBridge - Parental Consent',
        message:
          `Hi! I signed up for CreativeBridge, an educational storytelling app. ` +
          `Since I'm under 13, they need your permission before I can use it.\n\n` +
          `Please open this link to review and approve:\n${consentUrl}\n\n` +
          `The link expires in 48 hours.`,
        url: consentUrl, // iOS uses this as a tappable link
      });
    } catch {
      // User dismissed the share sheet — not an error
    }
  }, [consentUrl]);

  const handleCopyLink = useCallback(() => {
    if (!consentUrl) return;
    Clipboard.setString(consentUrl);
    Alert.alert('Copied!', 'Consent link copied to clipboard.');
  }, [consentUrl]);

  const handleOpenInBrowser = useCallback(() => {
    if (!consentUrl) return;
    Linking.openURL(consentUrl);
  }, [consentUrl]);

  const maskedEmail = maskedEmailFromServer ?? '...';

  return (
    <View style={styles.container} testID="consent-pending-screen">
      <View style={styles.content}>
        <Text style={styles.emoji}>&#9993;&#65039;</Text>
        <Text style={styles.title}>Waiting for Your Parent</Text>

        <View style={styles.statusCard}>
          <Text style={styles.statusText}>
            Your parent ({maskedEmail}) needs to approve your account.
          </Text>
          <Text style={styles.statusSubtext}>
            Share the consent link with your parent. Once they open it and
            approve, you'll be all set to start creating stories!
          </Text>
        </View>

        <View style={styles.stepsContainer}>
          <Text style={styles.stepsTitle}>What happens next:</Text>
          <Step number={1} text="Share the link with your parent" />
          <Step number={2} text="They open the link" />
          <Step number={3} text="They review and approve" />
          <Step number={4} text="You can start making stories!" active />
        </View>

        {loading ? (
          <ActivityIndicator
            color={theme.colors.primary}
            size="large"
            style={{ marginBottom: 24 }}
          />
        ) : consentUrl ? (
          <>
            <TouchableOpacity
              testID="consent-share-button"
              style={styles.shareButton}
              onPress={handleShare}
            >
              <Text style={styles.shareButtonText}>Share with Parent</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.copyButton}
              onPress={handleCopyLink}
            >
              <Text style={styles.copyButtonText}>Copy Link</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.openButton}
              onPress={handleOpenInBrowser}
            >
              <Text style={styles.openButtonText}>
                Open in Browser (for testing)
              </Text>
            </TouchableOpacity>
          </>
        ) : null}

        <TouchableOpacity
          testID="consent-sign-out"
          style={styles.signOutButton}
          onPress={onSignOut}
        >
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
  statusSubtext: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
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
  shareButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  copyButton: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 10,
    padding: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  copyButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  openButton: {
    padding: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  openButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.sm,
    textDecorationLine: 'underline',
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
