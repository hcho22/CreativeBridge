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
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 100,
        }}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backArrow}>{'<'} Settings</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Parent Dashboard</Text>
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
    backgroundColor: '#fcfcfc',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fcfcfc',
  },
  content: {
    padding: 20,
  },

  // Header
  header: {
    marginBottom: 20,
  },
  backArrow: {
    fontSize: 16,
    color: '#4A90D9',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A2E',
  },

  // Sections
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 15,
    color: '#666',
    flex: 1,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },

  // Story cards
  storyCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#4A90D9',
  },
  storyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  storyGrade: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A90D9',
  },
  storyDate: {
    fontSize: 12,
    color: '#999',
  },
  storyPreview: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 4,
  },
  storyMeta: {
    fontSize: 12,
    color: '#999',
  },
  moreText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },

  // Action buttons
  actionButton: {
    backgroundColor: '#f0f7ff',
    borderWidth: 1,
    borderColor: '#4A90D9',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A90D9',
  },
  warningButton: {
    backgroundColor: '#fff3e0',
    borderWidth: 1,
    borderColor: '#FF9800',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  warningButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E65100',
  },
  dangerButton: {
    backgroundColor: '#8B0000',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Loading / Error
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    marginBottom: 16,
  },
  noDataText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  backButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Parental Gate styles
  gateContainer: {
    flex: 1,
    backgroundColor: '#fcfcfc',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  gateCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  gateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 10,
  },
  gateDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  gateProblem: {
    fontSize: 30,
    fontWeight: '700',
    color: '#4A90D9',
    marginBottom: 16,
  },
  gateInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    padding: 12,
    fontSize: 18,
    textAlign: 'center',
    color: '#1A1A2E',
    marginBottom: 20,
  },
  gateButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  gateCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  gateCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  gateSubmitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#4A90D9',
    alignItems: 'center',
  },
  gateSubmitDisabled: {
    opacity: 0.5,
  },
  gateSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ParentDashboardScreen;
