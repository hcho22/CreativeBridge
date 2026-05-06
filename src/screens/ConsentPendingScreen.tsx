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
import { useQuery, useAction, useConvexAuth } from 'convex/react';
import { api } from '../services/convex';
import { useSafeClerkAuth } from '../hooks/useSafeClerkAuth';
import {
  PaperBackground,
  Watercolor,
  OrnamentRule,
} from '../components/common/storybook';

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
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();

  const [loading, setLoading] = useState(false);
  const [consentUrl, setConsentUrl] = useState<string | null>(null);
  const [maskedEmailFromServer, setMaskedEmailFromServer] = useState<
    string | null
  >(null);

  // Real-time consent status query — Convex will reactively update
  // Gate on isConvexAuthenticated to avoid Clerk/Convex auth timing race.
  const consentStatus = useQuery(
    api.consent.getConsentStatus,
    clerkUserId && isConvexAuthenticated ? {} : 'skip',
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
      <PaperBackground style={StyleSheet.absoluteFillObject} />
      <View style={styles.content}>
        <Watercolor hue={50} size={88}>
          ✉️
        </Watercolor>
        <Text style={styles.title}>Waiting for your parent</Text>
        <View style={styles.ornamentWrap}>
          <OrnamentRule width={140} />
        </View>

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
          <Text style={styles.stepsTitle}>What happens next</Text>
          <Step number={1} text="Share the link with your parent" />
          <Step number={2} text="They open the link" />
          <Step number={3} text="They review and approve" />
          <Step number={4} text="You can start making stories!" active />
        </View>

        {loading ? (
          <ActivityIndicator
            color={theme.colors.accents.foxglove}
            size="large"
            style={styles.loadingIndicator}
          />
        ) : consentUrl ? (
          <>
            <TouchableOpacity
              testID="consent-share-button"
              style={styles.shareButton}
              onPress={handleShare}
            >
              <Text style={styles.shareButtonText}>Share with parent</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.copyButton}
              onPress={handleCopyLink}
            >
              <Text style={styles.copyButtonText}>Copy link</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.openButton}
              onPress={handleOpenInBrowser}
            >
              <Text style={styles.openButtonText}>
                Open in browser (for testing)
              </Text>
            </TouchableOpacity>
          </>
        ) : null}

        <TouchableOpacity
          testID="consent-sign-out"
          style={styles.signOutButton}
          onPress={onSignOut}
        >
          <Text style={styles.signOutButtonText}>Sign out</Text>
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
    backgroundColor: theme.colors.paper.base,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
  },
  loadingIndicator: {
    marginBottom: 24,
  },
  ornamentWrap: {
    marginVertical: 12,
  },
  title: {
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontSize: 26,
    fontStyle: 'italic',
    color: theme.colors.ink.base,
    letterSpacing: -0.5,
    marginTop: 14,
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: theme.colors.paper.cardWarm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.accents.foxglove,
    borderRadius: 18,
    padding: 18,
    width: '100%',
    marginBottom: 22,
    marginTop: 4,
  },
  statusText: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 16,
    color: theme.colors.ink.base,
    textAlign: 'center',
    marginBottom: 6,
  },
  statusSubtext: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 13,
    color: theme.colors.ink.soft,
    textAlign: 'center',
    lineHeight: 19,
  },
  stepsContainer: {
    width: '100%',
    marginBottom: 22,
  },
  stepsTitle: {
    fontFamily: theme.typography.fontFamily.uiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: theme.colors.ink.faint,
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
    backgroundColor: theme.colors.paper.deep,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberActive: {
    backgroundColor: theme.colors.accents.moss,
    borderColor: theme.colors.accents.moss,
  },
  stepNumberText: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 14,
    color: theme.colors.ink.faint,
  },
  stepNumberTextActive: {
    color: theme.colors.paper.cream,
  },
  stepText: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 14,
    color: theme.colors.ink.soft,
  },
  stepTextActive: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    color: theme.colors.ink.base,
    fontWeight: '500',
  },
  shareButton: {
    backgroundColor: theme.colors.accents.foxglove,
    borderRadius: 14,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    ...theme.shadows.sm,
  },
  shareButtonText: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    color: theme.colors.paper.cream,
    fontSize: 16,
    fontWeight: '600',
  },
  copyButton: {
    borderWidth: 1.5,
    borderColor: theme.colors.accents.moss,
    borderRadius: 14,
    padding: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: theme.colors.paper.card,
  },
  copyButtonText: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    color: theme.colors.accents.moss,
    fontSize: 15,
    fontWeight: '600',
  },
  openButton: {
    padding: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  openButtonText: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    color: theme.colors.ink.faint,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  signOutButton: {
    padding: 14,
    alignItems: 'center',
  },
  signOutButtonText: {
    fontFamily: theme.typography.fontFamily.uiMedium,
    color: theme.colors.ink.faint,
    fontSize: 14,
  },
});

export default ConsentPendingScreen;
