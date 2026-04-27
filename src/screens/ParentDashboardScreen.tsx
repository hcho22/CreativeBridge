/**
 * Parent Dashboard Screen (US-021)
 *
 * Allows parents to review their child's data, request data export/deletion,
 * and manage consent — all accessible via a parental gate (math problem).
 * Does NOT require a separate parent account.
 *
 * @implements US-021: Parental Dashboard
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useAction } from 'convex/react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/convex';
import { PaperBackground, WaxSeal } from '../components/common/storybook';
import { theme } from '../constants/theme';

// ----------------------------------------------------------------------------
// Parental Gate (inline, reuses the math-problem pattern from US-009)
// ----------------------------------------------------------------------------

function generateProblem(): { a: number; b: number } {
  const a = Math.floor(Math.random() * 30) + 10;
  const b = Math.floor(Math.random() * 30) + 10;
  return { a, b };
}

interface ParentalGateScreenProps {
  onPass: () => void;
  onCancel: () => void;
}

const ParentalGateScreen: React.FC<ParentalGateScreenProps> = ({
  onPass,
  onCancel,
}) => {
  const insets = useSafeAreaInsets();
  const [problem, setProblem] = useState(generateProblem);
  const [answer, setAnswer] = useState('');

  const handleSubmit = useCallback(() => {
    const parsed = parseInt(answer, 10);
    if (parsed === problem.a + problem.b) {
      onPass();
    } else {
      setAnswer('');
      setProblem(generateProblem());
      Alert.alert(
        'Incorrect',
        "That wasn't right. Please try again with the new problem.",
      );
    }
  }, [answer, problem, onPass]);

  return (
    <View
      testID="parental-gate-screen"
      style={[
        styles.gateContainer,
        { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 },
      ]}
    >
      <View style={styles.gateCard}>
        <Text style={styles.gateTitle}>Parent Verification</Text>
        <Text style={styles.gateDescription}>
          To access the Parent Dashboard, please solve this math problem to
          confirm you are a parent or guardian.
        </Text>
        <Text style={styles.gateProblem}>
          What is {problem.a} + {problem.b}?
        </Text>
        <TextInput
          testID="parental-gate-input"
          style={styles.gateInput}
          keyboardType="number-pad"
          placeholder="Your answer"
          placeholderTextColor="#999"
          value={answer}
          onChangeText={setAnswer}
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
          autoFocus
          accessibilityLabel={`What is ${problem.a} plus ${problem.b}`}
        />
        <View style={styles.gateButtonRow}>
          <TouchableOpacity
            testID="parental-gate-cancel"
            style={styles.gateCancelButton}
            onPress={onCancel}
          >
            <Text style={styles.gateCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="parental-gate-submit"
            style={[
              styles.gateSubmitButton,
              !answer && styles.gateSubmitDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!answer}
          >
            <Text style={styles.gateSubmitText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// ----------------------------------------------------------------------------
// Dashboard Content
// ----------------------------------------------------------------------------

const ParentDashboardScreen: React.FC<{ navigation: any }> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { userProfile } = useAuth();
  const [gateUnlocked, setGateUnlocked] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Convex queries — only run when the gate is unlocked
  const dashboardData = useQuery(
    api.consent.getParentalDashboardData,
    gateUnlocked ? {} : 'skip',
  );
  const exportData = useQuery(
    api.consent.exportChildData,
    // Only fetch when export is requested
    isExporting ? {} : 'skip',
  );

  const withdrawConsentMutation = useMutation(api.consent.withdrawConsent);
  const deleteAccountAction = useAction(api.userProfiles.deleteAccount);
  const { signOut } = useAuth();

  // Gate handlers
  const handleGatePass = useCallback(() => setGateUnlocked(true), []);
  const handleGateCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // -- Data Export --
  const handleExportData = useCallback(async () => {
    setIsExporting(true);
  }, []);

  // Effect: when exportData arrives, share it
  React.useEffect(() => {
    if (exportData && isExporting) {
      const jsonString = JSON.stringify(exportData, null, 2);
      Share.share({
        message: jsonString,
        title: 'CreativeBridge Data Export',
      })
        .catch(() => {
          Alert.alert('Export Error', 'Failed to share data export.');
        })
        .finally(() => setIsExporting(false));
    }
  }, [exportData, isExporting]);

  // -- Withdraw Consent --
  const handleWithdrawConsent = useCallback(() => {
    const clerkId = userProfile?.clerk_user_id;
    if (!clerkId) return;

    Alert.alert(
      'Withdraw Consent',
      "This will disable your child's account. They will not be able to use CreativeBridge until consent is granted again. Are you sure?",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw Consent',
          style: 'destructive',
          onPress: async () => {
            try {
              await withdrawConsentMutation({ childUserId: clerkId });
              Alert.alert(
                'Consent Withdrawn',
                "Your child's account has been disabled.",
                [{ text: 'OK', onPress: () => navigation.goBack() }],
              );
            } catch (error) {
              console.error('Withdraw consent error:', error);
              Alert.alert(
                'Error',
                'Failed to withdraw consent. Please try again.',
              );
            }
          },
        },
      ],
    );
  }, [userProfile, withdrawConsentMutation, navigation]);

  // -- Delete Account & Data --
  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete All Data',
      "This will permanently delete your child's account and ALL associated data including stories, images, and progress. This action cannot be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            Alert.prompt(
              'Confirm Deletion',
              'Type DELETE to permanently delete the account and all data.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async (confirmText?: string) => {
                    if (confirmText?.trim().toUpperCase() !== 'DELETE') {
                      Alert.alert(
                        'Deletion Cancelled',
                        'You must type DELETE to confirm.',
                      );
                      return;
                    }
                    setIsDeletingAccount(true);
                    try {
                      await deleteAccountAction();
                      await signOut();
                      Alert.alert(
                        'Account Deleted',
                        'The account and all data have been permanently deleted.',
                      );
                    } catch (error) {
                      console.error('Account deletion error:', error);
                      Alert.alert(
                        'Error',
                        'Failed to delete account. Please try again or contact support.',
                      );
                    } finally {
                      setIsDeletingAccount(false);
                    }
                  },
                },
              ],
              'plain-text',
            );
          },
        },
      ],
    );
  }, [deleteAccountAction, signOut]);

  // -- Show parental gate first --
  if (!gateUnlocked) {
    return (
      <ParentalGateScreen onPass={handleGatePass} onCancel={handleGateCancel} />
    );
  }

  // -- Loading --
  if (dashboardData === undefined) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#4A90D9" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (dashboardData === null) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>No profile data found.</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { profile, consent, storyCount, stories } = dashboardData;

  const consentDateStr = consent?.consentTimestamp
    ? new Date(consent.consentTimestamp).toLocaleDateString()
    : 'N/A';

  return (
    <View style={styles.container} testID="parent-dashboard-screen">
      <PaperBackground style={StyleSheet.absoluteFillObject} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 100,
        }}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backArrow}>← Settings</Text>
            </TouchableOpacity>
            <View style={styles.headerTitleRow}>
              <WaxSeal letter="P" size={44} />
              <Text style={styles.title}>Parent Dashboard</Text>
            </View>
          </View>

          {/* Child Profile Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Child Profile</Text>
            <InfoRow label="Display Name" value={profile.displayName} />
            <InfoRow label="Grade Level" value={profile.gradeLevel} />
            <InfoRow label="Age Group" value={profile.ageGroup ?? 'Not set'} />
            <InfoRow
              label="Account Created"
              value={new Date(profile.createdAt).toLocaleDateString()}
            />
            <InfoRow label="Stories Created" value={String(storyCount)} />
          </View>

          {/* Consent Status Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Consent Status</Text>
            {consent ? (
              <>
                <InfoRow
                  label="Status"
                  value={consent.status}
                  valueColor={
                    consent.status === 'granted'
                      ? '#4CAF50'
                      : consent.status === 'withdrawn'
                      ? '#f44336'
                      : '#FF9800'
                  }
                />
                <InfoRow
                  label="Parent Email"
                  value={consent.parentEmail || 'N/A'}
                />
                <InfoRow label="Consent Date" value={consentDateStr} />
                <InfoRow
                  label="Policy Version"
                  value={consent.consentVersion}
                />
              </>
            ) : (
              <Text style={styles.noDataText}>
                No consent record found for this account.
              </Text>
            )}
          </View>

          {/* Story Review Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Stories ({storyCount})</Text>
            {stories.length === 0 ? (
              <Text style={styles.noDataText}>No stories yet.</Text>
            ) : (
              stories.slice(0, 20).map(story => (
                <View key={story.id} style={styles.storyCard}>
                  <View style={styles.storyHeader}>
                    <Text style={styles.storyGrade}>{story.gradeLevel}</Text>
                    <Text style={styles.storyDate}>
                      {new Date(story.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.storyPreview}>
                    {story.contentPreview || 'No content'}
                  </Text>
                  <Text style={styles.storyMeta}>
                    {story.wordsWritten} words
                    {story.completedAt ? ' — Completed' : ' — In progress'}
                  </Text>
                </View>
              ))
            )}
            {stories.length > 20 && (
              <Text style={styles.moreText}>
                ... and {stories.length - 20} more stories
              </Text>
            )}
          </View>

          {/* Parent Actions Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Parent Actions</Text>

            {/* Data Export */}
            <TouchableOpacity
              testID="export-data-button"
              style={styles.actionButton}
              onPress={handleExportData}
              disabled={isExporting}
            >
              {isExporting ? (
                <ActivityIndicator color="#4A90D9" size="small" />
              ) : (
                <Text style={styles.actionButtonText}>
                  Export All Data (JSON)
                </Text>
              )}
            </TouchableOpacity>

            {/* Withdraw Consent */}
            {consent?.status === 'granted' && (
              <TouchableOpacity
                testID="withdraw-consent-button"
                style={styles.warningButton}
                onPress={handleWithdrawConsent}
              >
                <Text style={styles.warningButtonText}>Withdraw Consent</Text>
              </TouchableOpacity>
            )}

            {/* Delete Account */}
            <TouchableOpacity
              testID="delete-account-button"
              style={styles.dangerButton}
              onPress={handleDeleteAccount}
              disabled={isDeletingAccount}
            >
              {isDeletingAccount ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.dangerButtonText}>
                  Delete Account & All Data
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

// ----------------------------------------------------------------------------
// InfoRow helper
// ----------------------------------------------------------------------------

const InfoRow: React.FC<{
  label: string;
  value: string;
  valueColor?: string;
}> = ({ label, value, valueColor }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text
      style={[styles.infoValue, valueColor ? { color: valueColor } : undefined]}
    >
      {value}
    </Text>
  </View>
);

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.paper.base,
  },
  scrollView: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.paper.base,
  },
  content: {
    padding: 20,
  },

  // Header
  header: {
    marginBottom: 18,
  },
  backArrow: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontSize: 14,
    color: theme.colors.accents.foxglove,
    marginBottom: 12,
    fontWeight: '600',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontSize: 28,
    fontStyle: 'italic',
    color: theme.colors.ink.base,
    letterSpacing: -0.5,
  },

  // Sections
  section: {
    backgroundColor: theme.colors.paper.card,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    ...theme.shadows.paper,
  },
  sectionTitle: {
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontSize: 18,
    fontStyle: 'italic',
    color: theme.colors.ink.base,
    marginBottom: 14,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.paper.edge,
  },
  infoLabel: {
    fontFamily: theme.typography.fontFamily.uiMedium,
    fontSize: 14,
    color: theme.colors.ink.soft,
    flex: 1,
  },
  infoValue: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.ink.base,
    flex: 1,
    textAlign: 'right',
  },

  // Story cards
  storyCard: {
    backgroundColor: theme.colors.paper.cardWarm,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.accents.foxglove,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
  },
  storyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  storyGrade: {
    fontFamily: theme.typography.fontFamily.uiBold,
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.accents.foxglove,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  storyDate: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 12,
    color: theme.colors.ink.faint,
  },
  storyPreview: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 13,
    color: theme.colors.ink.soft,
    lineHeight: 19,
    marginBottom: 4,
  },
  storyMeta: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 11,
    color: theme.colors.ink.faint,
  },
  moreText: {
    fontFamily: theme.typography.fontFamily.hand,
    fontSize: 16,
    color: theme.colors.ink.faint,
    textAlign: 'center',
    marginTop: 8,
  },

  // Action buttons
  actionButton: {
    backgroundColor: theme.colors.paper.cream,
    borderWidth: 1.5,
    borderColor: theme.colors.accents.inkwell,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonText: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.accents.inkwell,
  },
  warningButton: {
    backgroundColor: theme.colors.paper.cardWarm,
    borderWidth: 1.5,
    borderColor: theme.colors.accents.amber,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  warningButtonText: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.accents.amber,
  },
  dangerButton: {
    backgroundColor: theme.colors.error,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    ...theme.shadows.sm,
  },
  dangerButtonText: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.paper.cream,
  },

  // Loading / Error
  loadingText: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 15,
    color: theme.colors.ink.soft,
    marginTop: 12,
  },
  errorText: {
    fontFamily: theme.typography.fontFamily.uiMedium,
    fontSize: 15,
    color: theme.colors.error,
    marginBottom: 16,
  },
  noDataText: {
    fontFamily: theme.typography.fontFamily.hand,
    fontSize: 16,
    color: theme.colors.ink.faint,
  },
  backButton: {
    backgroundColor: theme.colors.accents.foxglove,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    ...theme.shadows.sm,
  },
  backButtonText: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    color: theme.colors.paper.cream,
    fontSize: 15,
    fontWeight: '600',
  },

  // Parental Gate styles
  gateContainer: {
    flex: 1,
    backgroundColor: theme.colors.paper.base,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  gateCard: {
    backgroundColor: theme.colors.paper.card,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
    borderRadius: 22,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    ...theme.shadows.lift,
  },
  gateTitle: {
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontSize: 24,
    fontStyle: 'italic',
    color: theme.colors.ink.base,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  gateDescription: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 14,
    color: theme.colors.ink.soft,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  gateProblem: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.accents.foxglove,
    marginBottom: 16,
  },
  gateInput: {
    fontFamily: theme.typography.fontFamily.serifBold,
    width: '100%',
    borderWidth: 1.5,
    borderColor: theme.colors.paper.edge,
    backgroundColor: theme.colors.paper.cream,
    borderRadius: 12,
    paddingVertical: 14,
    fontSize: 22,
    textAlign: 'center',
    color: theme.colors.ink.base,
    marginBottom: 20,
  },
  gateButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  gateCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: theme.colors.paper.cream,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
    alignItems: 'center',
  },
  gateCancelText: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.ink.soft,
  },
  gateSubmitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: theme.colors.accents.foxglove,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  gateSubmitDisabled: {
    opacity: 0.5,
  },
  gateSubmitText: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.paper.cream,
  },
});

export default ParentDashboardScreen;
