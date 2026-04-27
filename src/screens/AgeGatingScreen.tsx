import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '../services/convex';
import type { AgeGroup } from '../types/database';
import {
  PaperBackground,
  Watercolor,
  OrnamentRule,
} from '../components/common/storybook';
import { theme } from '../constants/theme';

interface AgeGatingScreenProps {
  onComplete: () => void;
}

const AGE_OPTIONS: {
  value: AgeGroup;
  label: string;
  description: string;
  hue: number;
  emoji: string;
}[] = [
  {
    value: 'under_13',
    label: 'Under 13',
    description: 'A parent or guardian will need to give permission',
    hue: 200,
    emoji: '🌱',
  },
  {
    value: '13_to_17',
    label: '13 to 17',
    description: 'You can use CreativeBridge on your own',
    hue: 140,
    emoji: '🌿',
  },
  {
    value: '18_plus',
    label: '18 or older',
    description: 'Full access to all features',
    hue: 30,
    emoji: '🌻',
  },
];

const AgeGatingScreen: React.FC<AgeGatingScreenProps> = ({ onComplete }) => {
  const [selectedAge, setSelectedAge] = useState<AgeGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setAgeGroup = useMutation(api.userProfiles.setAgeGroup);

  const handleContinue = async () => {
    if (!selectedAge) return;

    setSaving(true);
    setError(null);

    try {
      await setAgeGroup({ ageGroup: selectedAge });
      onComplete();
    } catch (err) {
      console.error('[AgeGating] Error saving age group:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} testID="age-gating-screen">
      <PaperBackground style={StyleSheet.absoluteFillObject} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <Text style={styles.eyebrow}>Welcome, young scribe</Text>
          <Text style={styles.title}>How old are you?</Text>
          <View style={styles.ornamentWrap}>
            <OrnamentRule width={160} />
          </View>
          <Text style={styles.subtitle}>
            This helps us keep CreativeBridge safe and fun for everyone
          </Text>
        </View>

        <View style={styles.optionsSection}>
          {AGE_OPTIONS.map(option => {
            const selected = selectedAge === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                testID={`age-option-${option.value}`}
                style={[styles.ageOption, selected && styles.ageOptionSelected]}
                onPress={() => setSelectedAge(option.value)}
                disabled={saving}
                activeOpacity={0.85}
              >
                <Watercolor hue={option.hue} size={48}>
                  {option.emoji}
                </Watercolor>
                <View style={styles.ageOptionBody}>
                  <Text
                    style={[
                      styles.ageOptionLabel,
                      selected && styles.ageOptionLabelSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.ageOptionDescription,
                      selected && styles.ageOptionDescriptionSelected,
                    ]}
                  >
                    {option.description}
                  </Text>
                </View>
                {selected ? <Text style={styles.checkmark}>✓</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          testID="age-gating-continue"
          style={[
            styles.continueButton,
            (!selectedAge || saving) && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!selectedAge || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={theme.colors.paper.cream} />
          ) : (
            <Text style={styles.continueButtonText}>Continue</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.privacyNote}>
          We ask this to comply with children's privacy laws (COPPA).{'\n'}
          Your age information is stored securely and never shared.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.paper.base,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  eyebrow: {
    fontFamily: theme.typography.fontFamily.hand,
    fontSize: 22,
    color: theme.colors.accents.foxglove,
    marginBottom: 4,
  },
  title: {
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontSize: 32,
    fontStyle: 'italic',
    color: theme.colors.ink.base,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  ornamentWrap: {
    marginVertical: 12,
  },
  subtitle: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 15,
    color: theme.colors.ink.soft,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  optionsSection: {
    marginBottom: 20,
    gap: 12,
  },
  ageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.paper.edge,
    borderRadius: 16,
    padding: 16,
    backgroundColor: theme.colors.paper.card,
  },
  ageOptionSelected: {
    borderColor: theme.colors.accents.foxglove,
    backgroundColor: theme.colors.paper.cardWarm,
    ...theme.shadows.paper,
  },
  ageOptionBody: {
    flex: 1,
  },
  ageOptionLabel: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 20,
    color: theme.colors.ink.base,
  },
  ageOptionLabelSelected: {
    color: theme.colors.accents.foxglove,
  },
  ageOptionDescription: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 13,
    color: theme.colors.ink.faint,
    marginTop: 2,
  },
  ageOptionDescriptionSelected: {
    color: theme.colors.ink.soft,
  },
  checkmark: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 24,
    color: theme.colors.accents.foxglove,
  },
  errorText: {
    fontFamily: theme.typography.fontFamily.uiMedium,
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 14,
  },
  continueButton: {
    backgroundColor: theme.colors.accents.foxglove,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
    ...theme.shadows.sm,
  },
  continueButtonDisabled: {
    backgroundColor: theme.colors.paper.deep,
  },
  continueButtonText: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    color: theme.colors.paper.cream,
    fontSize: 17,
    fontWeight: '600',
  },
  privacyNote: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 12,
    color: theme.colors.ink.faint,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default AgeGatingScreen;
