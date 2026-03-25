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
      const result = await submitFn({ parentEmail: parentEmail.trim() });

      // Send the consent email to the parent
      try {
        await sendConsentEmail({
          parentEmail: parentEmail.trim(),
          consentToken: result.consentToken,
        });
      } catch (emailErr) {
        // Log but don't block — the consent link can still be shared manually
        console.warn('[ParentEmail] Failed to send consent email:', emailErr);
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
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.emoji}>
            {isRenewal
              ? '\u{1F504}'
              : '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}'}
          </Text>
          <Text style={styles.title}>
            {isRenewal ? 'Time to Renew Consent' : 'Ask a Parent for Help'}
          </Text>
          <Text style={styles.subtitle}>
            {isRenewal
              ? "It's been a year since your parent gave permission. We need them to confirm again so you can keep using CreativeBridge!"
              : "Since you're under 13, we need a parent or guardian to say it's okay for you to use CreativeBridge. We'll send them a quick email!"}
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Parent's Email Address</Text>
          <TextInput
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
            style={[
              styles.submitButton,
              !canSubmit && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isRenewal ? 'Send Renewal Email' : 'Send Consent Email'}
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
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 10,
    padding: 14,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text,
  },
  inputError: {
    borderColor: theme.colors.inputBorderError,
    backgroundColor: theme.colors.inputBackgroundError,
  },
  inputValid: {
    borderColor: theme.colors.inputBorderValid,
    backgroundColor: theme.colors.inputBackgroundValid,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSize.sm,
    marginTop: 6,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.disabled,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
  },
  helpText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
  backButton: {
    alignItems: 'center',
    marginTop: 24,
    padding: 12,
  },
  backButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.base,
  },
});

export default ParentEmailScreen;
