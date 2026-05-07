/**
 * Parent Email Screen (US-002)
 *
 * Displayed when age-gating identifies a user as under 13.
 * Collects the parent's email address to initiate the VPC
 * (Verifiable Parental Consent) flow.
 *
 * After submission, the parent receives an email with a consent link.
 * The child is redirected to ConsentPendingScreen.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { theme } from '../constants/theme';
import { useMutation, useAction } from 'convex/react';
import { api } from '../services/convex';
import {
  PaperBackground,
  Watercolor,
  OrnamentRule,
} from '../components/common/storybook';

interface ParentEmailScreenProps {
  onConsentInitiated: () => void;
  onBack?: () => void;
  isRenewal?: boolean;
}

const ParentEmailScreen: React.FC<ParentEmailScreenProps> = ({
  onConsentInitiated,
  onBack,
  isRenewal = false,
}) => {
  const [parentEmail, setParentEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_emailSendError, setEmailSendError] = useState(false);

  const submitParentEmail = useMutation(api.consent.submitParentEmail);
  const initiateConsentRenewal = useMutation(
    api.consent.initiateConsentRenewal,
  );
  const sendConsentEmail = useAction(api.consent.sendConsentEmail);
  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const emailsMatch = parentEmail.toLowerCase() === confirmEmail.toLowerCase();
  const canSubmit = isValidEmail(parentEmail) && emailsMatch && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      // Create consent record (renewal uses initiateConsentRenewal)
      const submitFn = isRenewal ? initiateConsentRenewal : submitParentEmail;
      await submitFn({ parentEmail: parentEmail.trim() });

      // Send the consent email to the parent (token resolved server-side)
      try {
        await sendConsentEmail({
          parentEmail: parentEmail.trim(),
        });
      } catch (emailErr) {
        // Log but don't block — the consent link can still be shared manually
        console.warn('[ParentEmail] Failed to send consent email:', emailErr);
        setEmailSendError(true);
        Alert.alert(
          'Email May Not Have Been Sent',
          'We had trouble sending the consent email. Your parent can also access the consent page through the app settings. Please try again or ask your parent to check their spam folder.',
          [{ text: 'OK' }],
        );
      }

      onConsentInitiated();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      testID="parent-email-screen"
    >
      <PaperBackground style={StyleSheet.absoluteFillObject} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Watercolor hue={isRenewal ? 30 : 50} size={88}>
            {isRenewal
              ? '\u{1F504}'
              : '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}'}
          </Watercolor>
          <Text style={styles.title}>
            {isRenewal ? 'Time to renew consent' : 'Ask a parent for help'}
          </Text>
          <View style={styles.ornamentWrap}>
            <OrnamentRule width={140} />
          </View>
          <Text style={styles.subtitle}>
            {isRenewal
              ? "It's been a year since your parent gave permission. We need them to confirm again so you can keep using CreativeBridge!"
              : "Since you're under 13, we need a parent or guardian to say it's okay for you to use CreativeBridge. We'll send them a quick email!"}
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Parent's Email Address</Text>
          <TextInput
            testID="parent-email-input"
            style={[
              styles.input,
              error ? styles.inputError : null,
              parentEmail && isValidEmail(parentEmail)
                ? styles.inputValid
                : null,
            ]}
            value={parentEmail}
            onChangeText={text => {
              setParentEmail(text);
              setError(null);
            }}
            placeholder="parent@example.com"
            placeholderTextColor={theme.colors.textDisabled}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            editable={!loading}
          />

          <Text style={styles.label}>Confirm Email Address</Text>
          <TextInput
            testID="parent-email-confirm-input"
            style={[
              styles.input,
              confirmEmail && !emailsMatch ? styles.inputError : null,
              confirmEmail && emailsMatch && isValidEmail(confirmEmail)
                ? styles.inputValid
                : null,
            ]}
            value={confirmEmail}
            onChangeText={text => {
              setConfirmEmail(text);
              setError(null);
            }}
            placeholder="parent@example.com"
            placeholderTextColor={theme.colors.textDisabled}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          {confirmEmail && !emailsMatch && (
            <Text style={styles.errorText}>Email addresses don't match</Text>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            testID="parent-email-submit"
            style={[
              styles.submitButton,
              !canSubmit && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.paper.cream} />
            ) : (
              <Text style={styles.submitButtonText}>
                {isRenewal ? 'Send renewal email' : 'Send consent email'}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.helpText}>
            {isRenewal
              ? 'Your parent will receive an email to renew their consent. You can keep using the app once they confirm!'
              : "Your parent will receive an email explaining what data CreativeBridge collects and asking for their permission. You won't be able to use the app until they say okay."}
          </Text>
        </View>

        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.paper.base,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  ornamentWrap: {
    marginVertical: 12,
  },
  title: {
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontSize: 28,
    fontStyle: 'italic',
    color: theme.colors.ink.base,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginTop: 14,
  },
  subtitle: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 15,
    color: theme.colors.ink.soft,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  form: {
    width: '100%',
  },
  label: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.ink.soft,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    backgroundColor: theme.colors.paper.cream,
    borderWidth: 1.5,
    borderColor: theme.colors.paper.edge,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.colors.ink.base,
  },
  inputError: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.inputBackgroundError,
  },
  inputValid: {
    borderColor: theme.colors.accents.moss,
    backgroundColor: theme.colors.paper.card,
  },
  errorText: {
    fontFamily: theme.typography.fontFamily.uiMedium,
    color: theme.colors.error,
    fontSize: 13,
    marginTop: 6,
  },
  submitButton: {
    backgroundColor: theme.colors.accents.foxglove,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    ...theme.shadows.sm,
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.paper.deep,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    color: theme.colors.paper.cream,
    fontSize: 17,
    fontWeight: '600',
  },
  helpText: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    color: theme.colors.ink.faint,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  backButton: {
    alignItems: 'center',
    marginTop: 24,
    padding: 12,
  },
  backButtonText: {
    fontFamily: theme.typography.fontFamily.uiMedium,
    color: theme.colors.accents.foxglove,
    fontSize: 14,
  },
});

export default ParentEmailScreen;
