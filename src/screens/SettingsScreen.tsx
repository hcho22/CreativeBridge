import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import type { GradeLevel } from '../types/database';
import type { SettingsStackParamList } from '../navigation/AppNavigator';
import type { StackNavigationProp } from '@react-navigation/stack';
import { OnboardingChecklistModal } from '../components/onboarding/OnboardingChecklistModal';
import { LEGAL_URLS } from '../config/legalUrls';
import { useParentalGate } from '../components/common/ParentalGate';
import {
  PaperBackground,
  Watercolor,
  InkButton,
} from '../components/common/storybook';
import { theme } from '../constants/theme';

type SettingsScreenNavigationProp = StackNavigationProp<
  SettingsStackParamList,
  'Settings'
>;

interface SettingsScreenProps {
  navigation: SettingsScreenNavigationProp;
}

const GRADE_OPTIONS: Array<{
  id: GradeLevel;
  label: string;
  sub: string;
}> = [
  { id: 'K-2', label: 'K–2', sub: 'Big words, bold ideas' },
  { id: '3-5', label: '3–5', sub: 'Growing vocabulary' },
  { id: '6-8', label: '6–8', sub: 'Richer characters' },
  { id: '9-12', label: '9–12', sub: 'Literary depth' },
];

interface ToggleRowProps {
  label: string;
  desc?: string;
  on: boolean;
  onChange: (value: boolean) => void;
  last?: boolean;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  label,
  desc,
  on,
  onChange,
  last,
}) => (
  <View style={[styles.toggleRow, last && styles.toggleRowLast]}>
    <View style={styles.toggleRowText}>
      <Text style={styles.toggleLabel}>{label}</Text>
      {desc ? <Text style={styles.toggleDesc}>{desc}</Text> : null}
    </View>
    <TouchableOpacity
      onPress={() => onChange(!on)}
      activeOpacity={0.8}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={[styles.toggleTrack, on && styles.toggleTrackOn]}
    >
      <View style={[styles.toggleHandle, on && styles.toggleHandleOn]} />
    </TouchableOpacity>
  </View>
);

interface InfoRowProps {
  label: string;
  value: string;
  last?: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, last }) => (
  <View style={[styles.infoRow, last && styles.infoRowLast]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { userProfile, updateProfile, signOut } = useAuth();
  const { openURL, parentalGateModal } = useParentalGate();
  const [speechEnabled, setSpeechEnabled] = useState(
    userProfile?.speech_enabled || false,
  );
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<GradeLevel>(
    (userProfile?.preferred_grade_level as GradeLevel) || 'K-2',
  );
  // Onboarding progress modal state (US-018)
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  const handleSpeechToggle = async (value: boolean) => {
    setSpeechEnabled(value);

    try {
      const result = await updateProfile({
        speech_enabled: value,
      });

      if (result.error) {
        Alert.alert('Profile Setup Required', result.error);
        setSpeechEnabled(!value); // Revert on error
      } else {
        Alert.alert(
          'Success',
          `Speech ${value ? 'enabled' : 'disabled'} successfully!`,
        );
      }
    } catch (error) {
      console.error('Speech toggle error:', error);
      Alert.alert('Error', 'Failed to update speech settings');
      setSpeechEnabled(!value); // Revert on error
    }
  };

  const handleGradeLevelChange = async (level: GradeLevel) => {
    setSelectedGradeLevel(level);

    try {
      const result = await updateProfile({
        preferred_grade_level: level,
      });

      if (result.error) {
        // Provide user-friendly error message
        const errorMessage = result.error.includes(
          'JSON object requested, multiple',
        )
          ? 'There was an issue with your profile. Please contact support or try logging out and back in.'
          : result.error;

        Alert.alert('Update Failed', errorMessage);
        setSelectedGradeLevel(
          (userProfile?.preferred_grade_level as GradeLevel) || 'K-2',
        ); // Revert on error
      } else {
        Alert.alert('Success', `Grade level updated to ${level}!`);
      }
    } catch (error) {
      console.error('Grade level update error:', error);
      Alert.alert('Error', 'Failed to update grade level preference');
      setSelectedGradeLevel(
        (userProfile?.preferred_grade_level as GradeLevel) || 'K-2',
      ); // Revert on error
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (error) {
            console.error('Logout error:', error);
            Alert.alert('Error', 'Failed to logout. Please try again.');
          }
        },
      },
    ]);
  };

  const gradeLevelDescriptions = useMemo(
    () => ({
      'K-2': 'Simple vocabulary and basic sentence structure',
      '3-5': 'Intermediate complexity with creative prompts',
      '6-8': 'Advanced storytelling and character development',
      '9-12': 'Complex narratives and literary techniques',
    }),
    [],
  );

  const getGradeLevelDescription = (level: GradeLevel): string => {
    return gradeLevelDescriptions[level] || '';
  };

  const renderSectionTitle = (icon: string, title: string) => (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitleIcon}>{icon}</Text>
      <Text style={styles.sectionTitleText}>{title}</Text>
      <View style={styles.sectionTitleRule} />
    </View>
  );

  return (
    <View style={styles.container}>
      <PaperBackground style={StyleSheet.absoluteFillObject} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>The Workshop</Text>
          <Text style={styles.headerSubtitle}>
            Tune your tools for the perfect tale
          </Text>
        </View>

        {/* Reading Level */}
        <View style={styles.section}>
          {renderSectionTitle('📖', 'Reading level')}
          <Text style={styles.gradeContextDescription}>
            {getGradeLevelDescription(selectedGradeLevel)}
          </Text>
          <View style={styles.gradeGrid}>
            {GRADE_OPTIONS.map(option => {
              const selected = selectedGradeLevel === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.gradeButton,
                    selected && styles.gradeButtonSelected,
                  ]}
                  onPress={() => handleGradeLevelChange(option.id)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.gradeLabel,
                      selected && styles.gradeLabelSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.gradeSub,
                      selected && styles.gradeSubSelected,
                    ]}
                  >
                    {option.sub}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Accessibility */}
        <View style={styles.section}>
          {renderSectionTitle('♿︎', 'Accessibility')}
          <View style={styles.toggleCard}>
            <ToggleRow
              label="Speech features"
              desc="Voice input and text-to-speech"
              on={speechEnabled}
              onChange={handleSpeechToggle}
              last
            />
          </View>
        </View>

        {/* Quests / Onboarding */}
        <View style={styles.section}>
          {renderSectionTitle('🚀', 'Quests')}
          <TouchableOpacity
            style={styles.questCard}
            onPress={() => setShowOnboardingModal(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="View onboarding progress"
            accessibilityHint="Opens a modal showing your onboarding checklist progress"
          >
            <Watercolor hue={50} size={52}>
              📜
            </Watercolor>
            <View style={styles.questCardBody}>
              <Text style={styles.questTitle}>Getting started checklist</Text>
              <Text style={styles.questSubtitle}>
                Track your progress · earn XP
              </Text>
            </View>
            <Text style={styles.questArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Family / Parent Dashboard (under_13 only) */}
        {userProfile?.age_group === 'under_13' && (
          <View style={styles.section}>
            {renderSectionTitle('🛡️', 'Family')}
            <TouchableOpacity
              style={styles.familyCard}
              onPress={() => navigation.navigate('ParentDashboard')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Open parent dashboard"
              accessibilityHint="Opens the parent dashboard to review data and manage consent"
            >
              <Watercolor hue={210} size={52}>
                🛡️
              </Watercolor>
              <View style={styles.questCardBody}>
                <Text style={styles.questTitle}>Parent dashboard</Text>
                <Text style={styles.questSubtitle}>
                  Review data, export, manage consent
                </Text>
              </View>
              <Text style={styles.questArrow}>→</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Author Account */}
        <View style={styles.section}>
          {renderSectionTitle('✒️', 'Author account')}
          <View style={styles.accountCard}>
            <InfoRow
              label="Username"
              value={
                userProfile?.username ? `@${userProfile.username}` : 'Not set'
              }
            />
            <InfoRow
              label="Display name"
              value={userProfile?.display_name || 'Not set'}
              last
            />
          </View>

          <View style={{ marginTop: 14 }}>
            <InkButton variant="ghost" onPress={handleLogout}>
              🚪 Log out
            </InkButton>
          </View>
        </View>

        {/* Footer / Branding */}
        <View style={styles.footer}>
          <View style={styles.footerLogoRow}>
            <Text style={styles.footerLogo}>
              Creative
              <Text style={styles.footerLogoAccent}>Bridge</Text>
            </Text>
            <Text style={styles.footerVersion}>v1.0.0</Text>
          </View>
          <Text style={styles.footerTagline}>
            Collaborative storytelling with a kind AI, crafted to help young
            writers find their voice.
          </Text>
          <View style={styles.legalLinksRow}>
            <TouchableOpacity
              style={styles.legalLinkButton}
              onPress={() => openURL(LEGAL_URLS.PRIVACY_POLICY)}
            >
              <Text style={styles.legalLinkText}>Privacy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.legalLinkButton}
              onPress={() => openURL(LEGAL_URLS.TERMS_OF_SERVICE)}
            >
              <Text style={styles.legalLinkText}>Terms</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Onboarding Checklist Modal (US-018) */}
        <OnboardingChecklistModal
          visible={showOnboardingModal}
          userId={userProfile?.clerk_user_id}
          onClose={() => setShowOnboardingModal(false)}
        />
      </ScrollView>

      {/* US-009: Parental Gate for external links */}
      {parentalGateModal}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.paper.base,
  },
  scrollView: {
    flex: 1,
  },

  // Header
  header: {
    marginBottom: 18,
  },
  headerTitle: {
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontSize: 36,
    fontStyle: 'italic',
    color: theme.colors.ink.base,
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontFamily: theme.typography.fontFamily.hand,
    fontSize: 20,
    color: theme.colors.ink.soft,
    marginTop: 4,
  },

  // Section primitives
  section: {
    marginBottom: 22,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingLeft: 4,
  },
  sectionTitleIcon: {
    fontSize: 16,
  },
  sectionTitleText: {
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontSize: 18,
    fontStyle: 'italic',
    color: theme.colors.ink.base,
  },
  sectionTitleRule: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.paper.edge,
    marginLeft: 6,
  },

  // Reading level
  gradeContextDescription: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 12,
    color: theme.colors.ink.faint,
    marginBottom: 10,
    paddingLeft: 4,
  },
  gradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gradeButton: {
    width: '47.5%',
    padding: 14,
    borderRadius: 14,
    backgroundColor: theme.colors.paper.card,
    borderWidth: 1.5,
    borderColor: theme.colors.paper.edge,
  },
  gradeButtonSelected: {
    backgroundColor: theme.colors.accents.foxglove,
    borderColor: theme.colors.accents.foxglove,
    ...theme.shadows.sm,
  },
  gradeLabel: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 22,
    color: theme.colors.ink.base,
  },
  gradeLabelSelected: {
    color: theme.colors.paper.cream,
  },
  gradeSub: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 12,
    color: theme.colors.ink.faint,
    marginTop: 2,
    opacity: 0.9,
  },
  gradeSubSelected: {
    color: theme.colors.paper.cream,
    opacity: 0.9,
  },

  // Toggle card
  toggleCard: {
    padding: 4,
    borderRadius: 18,
    backgroundColor: theme.colors.paper.card,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.paper.edge,
  },
  toggleRowLast: {
    borderBottomWidth: 0,
  },
  toggleRowText: {
    flex: 1,
    marginRight: 14,
  },
  toggleLabel: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontSize: 15,
    color: theme.colors.ink.base,
    fontWeight: '600',
  },
  toggleDesc: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 12,
    color: theme.colors.ink.faint,
    marginTop: 2,
  },
  toggleTrack: {
    width: 48,
    height: 28,
    borderRadius: 999,
    padding: 2,
    backgroundColor: theme.colors.paper.deep,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
    justifyContent: 'center',
  },
  toggleTrackOn: {
    backgroundColor: theme.colors.accents.moss,
    borderColor: theme.colors.accents.moss,
  },
  toggleHandle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.paper.cream,
    alignSelf: 'flex-start',
    ...theme.shadows.sm,
  },
  toggleHandleOn: {
    alignSelf: 'flex-end',
  },

  // Quest card (onboarding) + family card
  questCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: theme.colors.paper.cardWarm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.accents.foxglove,
  },
  familyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: theme.colors.paper.card,
    borderWidth: 1.5,
    borderColor: theme.colors.accents.inkwell,
  },
  questCardBody: {
    flex: 1,
  },
  questTitle: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 17,
    color: theme.colors.ink.base,
    fontWeight: '700',
  },
  questSubtitle: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 12,
    color: theme.colors.ink.faint,
    marginTop: 2,
  },
  questArrow: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 22,
    color: theme.colors.accents.foxglove,
  },

  // Account card
  accountCard: {
    padding: 4,
    borderRadius: 18,
    backgroundColor: theme.colors.paper.card,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.paper.edge,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontFamily: theme.typography.fontFamily.uiMedium,
    fontSize: 14,
    color: theme.colors.ink.soft,
    fontWeight: '500',
  },
  infoValue: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontSize: 14,
    color: theme.colors.ink.base,
    fontWeight: '600',
  },

  // Footer
  footer: {
    marginTop: 12,
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.paper.edge,
  },
  footerLogoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  footerLogo: {
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontSize: 18,
    fontStyle: 'italic',
    color: theme.colors.ink.base,
    letterSpacing: -0.2,
    fontWeight: '700',
  },
  footerLogoAccent: {
    color: theme.colors.accents.foxglove,
  },
  footerVersion: {
    fontFamily: theme.typography.fontFamily.uiMedium,
    fontSize: 13,
    color: theme.colors.ink.faint,
  },
  footerTagline: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 12,
    color: theme.colors.ink.faint,
    marginTop: 6,
    maxWidth: 360,
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLinksRow: {
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'center',
    marginTop: 10,
  },
  legalLinkButton: {
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  legalLinkText: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontSize: 12,
    color: theme.colors.accents.foxglove,
    fontWeight: '600',
  },
});

export default SettingsScreen;
