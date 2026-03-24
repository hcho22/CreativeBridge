import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '../services/convex';
import type { AgeGroup } from '../types/database';

interface AgeGatingScreenProps {
  onComplete: () => void;
}

const AGE_OPTIONS: { value: AgeGroup; label: string; description: string }[] = [
  {
    value: 'under_13',
    label: 'Under 13',
    description: 'A parent or guardian will need to give permission',
  },
  {
    value: '13_to_17',
    label: '13 to 17',
    description: 'You can use CreativeBridge on your own',
  },
  {
    value: '18_plus',
    label: '18 or older',
    description: 'Full access to all features',
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
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerSection}>
          <Text style={styles.title}>How old are you?</Text>
          <Text style={styles.subtitle}>
            This helps us keep CreativeBridge safe and fun for everyone
          </Text>
        </View>

        <View style={styles.optionsSection}>
          {AGE_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.ageOption,
                selectedAge === option.value && styles.ageOptionSelected,
              ]}
              onPress={() => setSelectedAge(option.value)}
              disabled={saving}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.ageOptionLabel,
                  selectedAge === option.value && styles.ageOptionLabelSelected,
                ]}
              >
                {option.label}
              </Text>
              <Text
                style={[
                  styles.ageOptionDescription,
                  selectedAge === option.value &&
                    styles.ageOptionDescriptionSelected,
                ]}
              >
                {option.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[
            styles.continueButton,
            (!selectedAge || saving) && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!selectedAge || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.continueButtonText}>Continue</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.privacyNote}>
          We ask this to comply with children's privacy laws (COPPA).{'\n'}
          Your age information is stored securely and never shared.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fcfcfc',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  optionsSection: {
    marginBottom: 24,
  },
  ageOption: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  ageOptionSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#F1F8E9',
  },
  ageOptionLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  ageOptionLabelSelected: {
    color: '#2E7D32',
  },
  ageOptionDescription: {
    fontSize: 14,
    color: '#888',
  },
  ageOptionDescriptionSelected: {
    color: '#558B2F',
  },
  errorText: {
    color: '#D32F2F',
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 14,
  },
  continueButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  continueButtonDisabled: {
    backgroundColor: '#C8E6C9',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  privacyNote: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default AgeGatingScreen;
