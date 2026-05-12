/**
 * Cloud Transcription Disclosure Modal (US-010)
 *
 * Shown the first time a `9-12` user toggles `transcriptionEngine = 'cloud'`
 * in Settings. Discloses what audio data leaves the device and to whom, links
 * the relevant section of the privacy policy, and produces an explicit
 * "Cancel" / "Agree" decision that the caller logs to `consentEvents`.
 *
 * The component is presentational — it holds no consent state itself. The
 * parent decides whether to render it (based on the latest `consentEvents`
 * row for the user) and what to do with `onAgree` / `onCancel`.
 *
 * Privacy-policy link uses `Linking.openURL` directly rather than the
 * parental gate's wrapped `openURL`. Reason: the toggle that opens this
 * modal is only visible to 9-12 (13+) users, where COPPA's parental-gate
 * doesn't apply, and the modal is itself a deliberate consent moment —
 * adding a math-gate before the user can read what they're consenting to
 * would be hostile UX.
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
} from 'react-native';
import { theme } from '../../constants/theme';
import { LEGAL_URLS } from '../../config/legalUrls';

export interface CloudTranscriptionDisclosureModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** User tapped "Cancel" — caller should revert the toggle to on-device */
  onCancel: () => void;
  /** User tapped "I understand and agree" — caller should log consent + persist */
  onAgree: () => void;
}

export const CloudTranscriptionDisclosureModal: React.FC<
  CloudTranscriptionDisclosureModalProps
> = ({ visible, onCancel, onAgree }) => {
  // Short-circuit when invisible. RN's Modal would hide itself anyway,
  // but returning null also keeps the modal's `accessibilityViewIsModal`
  // attribute out of the test tree — otherwise React Native Testing
  // Library scopes `getByText`/`getByLabelText` to the modal subtree
  // even when the modal is hidden, which is hostile to component tests
  // that rendered the screen and want to query non-modal content.
  if (!visible) {
    return null;
  }

  const openPrivacyPolicy = () => {
    Linking.openURL(LEGAL_URLS.PRIVACY_POLICY).catch(() => {
      // Swallow — opening an external link is a best-effort affordance,
      // not a critical path. The disclosure text in the modal is the
      // legally meaningful content.
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityRole="alert">
          <Text style={styles.title}>Use cloud transcription?</Text>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
          >
            <Text style={styles.paragraph}>
              Cloud transcription gives you more accurate results, but it works
              differently from on-device:
            </Text>

            <View style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={styles.bulletEmphasis}>What gets sent: </Text>
                Audio recordings of what you say while dictating a story.
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={styles.bulletEmphasis}>Where it goes: </Text>
                OpenAI's Whisper speech-to-text API, which transcribes the audio
                and returns text back to the app.
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={styles.bulletEmphasis}>What we keep: </Text>
                Only the transcribed text becomes part of your story. The audio
                recording is not stored by CreativeBridge.
              </Text>
            </View>

            <Text style={styles.paragraph}>
              You can switch back to on-device transcription any time in
              Settings.
            </Text>

            <TouchableOpacity
              onPress={openPrivacyPolicy}
              accessibilityRole="link"
              accessibilityLabel="Read the privacy policy"
            >
              <Text style={styles.link}>Read the privacy policy →</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={onCancel}
              style={[styles.button, styles.cancelButton]}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onAgree}
              style={[styles.button, styles.agreeButton]}
              accessibilityRole="button"
              accessibilityLabel="I understand and agree"
            >
              <Text style={styles.agreeText}>I understand and agree</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: theme.colors.paper.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
    padding: 20,
    ...theme.shadows.sm,
  },
  title: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 22,
    color: theme.colors.ink.base,
    marginBottom: 12,
  },
  body: {
    marginBottom: 16,
  },
  bodyContent: {
    paddingBottom: 4,
  },
  paragraph: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 15,
    color: theme.colors.ink.soft,
    lineHeight: 22,
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingRight: 6,
  },
  bullet: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 15,
    color: theme.colors.ink.soft,
    width: 16,
  },
  bulletText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 14,
    color: theme.colors.ink.soft,
    lineHeight: 20,
  },
  bulletEmphasis: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    color: theme.colors.ink.base,
    fontWeight: '600',
  },
  link: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontSize: 14,
    color: theme.colors.accents.foxglove,
    fontWeight: '600',
    marginTop: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
  },
  cancelButton: {
    backgroundColor: theme.colors.paper.deep,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
  },
  cancelText: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontSize: 14,
    color: theme.colors.ink.soft,
    fontWeight: '600',
  },
  agreeButton: {
    backgroundColor: theme.colors.accents.foxglove,
  },
  agreeText: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontSize: 14,
    color: theme.colors.paper.cream,
    fontWeight: '600',
  },
});

export default CloudTranscriptionDisclosureModal;
