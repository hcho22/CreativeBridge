import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSafeClerkAuth } from '../hooks/useSafeClerkAuth';
import {
  validateUsername,
  UsernameValidationResult,
} from '../utils/usernameValidation';
import { GradeLevel } from '../types/database';
import { supabase } from '../services/supabase';

interface ProfileCompletionScreenProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

const ProfileCompletionScreen: React.FC<ProfileCompletionScreenProps> = ({
  onComplete,
  onSkip,
}) => {
  const { user, refreshProfile } = useAuth();
  const { clerkUser } = useSafeClerkAuth();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel | ''>('');
  const [loading, setLoading] = useState(false);
  const [usernameValidating, setUsernameValidating] = useState(false);
  const [usernameValidation, setUsernameValidation] =
    useState<UsernameValidationResult | null>(null);
  const [usernameTouched, setUsernameTouched] = useState(false);

  const gradeLevelOptions = [
    { value: 'K-2', label: 'Kindergarten - 2nd Grade' },
    { value: '3-5', label: '3rd - 5th Grade' },
    { value: '6-8', label: '6th - 8th Grade' },
    { value: '9-12', label: '9th - 12th Grade' },
  ];

  // Pre-fill username and display name from Clerk user object or user email
  useEffect(() => {
    // Pre-fill username from email if available
    if (!username && !usernameTouched) {
      let emailToUse: string | undefined;

      // Try to get email from Clerk user first
      if (clerkUser?.emailAddresses?.[0]?.emailAddress) {
        emailToUse = clerkUser.emailAddresses[0].emailAddress;
      }
      // Fallback to user object email
      else if (user?.email) {
        emailToUse = user.email;
      }

      // Extract username from email
      if (emailToUse) {
        const emailPrefix = emailToUse.split('@')[0];
        setUsername(emailPrefix);
        console.log(
          '🔤 [ProfileCompletion] Auto-filled username from email:',
          emailPrefix,
        );
      }
    }

    // Pre-fill display name from Clerk user object
    if (!displayName) {
      const firstName = clerkUser?.firstName || '';
      const lastName = clerkUser?.lastName || '';
      if (firstName || lastName) {
        setDisplayName(`${firstName} ${lastName}`.trim());
      } else if (clerkUser?.emailAddresses?.[0]?.emailAddress) {
        // Fallback to email prefix if no name available
        const emailPrefix =
          clerkUser.emailAddresses[0].emailAddress.split('@')[0];
        setDisplayName(
          emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1),
        );
      } else if (user?.email) {
        // Final fallback to user object email
        const emailPrefix = user.email.split('@')[0];
        setDisplayName(
          emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1),
        );
      }
    }
  }, [clerkUser, user, username, displayName, usernameTouched]);

  // Real-time username validation
  useEffect(() => {
    const validateUsernameAsync = async () => {
      if (!username.trim() || !usernameTouched) {
        setUsernameValidation(null);
        return;
      }

      setUsernameValidating(true);
      try {
        const result = await validateUsername(username, true); // Check availability
        setUsernameValidation(result);
      } catch (error) {
        console.error('Username validation error:', error);
        setUsernameValidation({
          isValid: false,
          errors: ['Unable to validate username. Please try again.'],
          warnings: [],
        });
      } finally {
        setUsernameValidating(false);
      }
    };

    const timeoutId = setTimeout(validateUsernameAsync, 500); // Debounce validation
    return () => clearTimeout(timeoutId);
  }, [username, usernameTouched]);

  const handleUsernameChange = (text: string) => {
    setUsername(text);
    if (!usernameTouched) {
      setUsernameTouched(true);
    }
  };

  const handleSubmit = async () => {
    // Validate form
    if (!username.trim()) {
      Alert.alert('Error', 'Username is required');
      return;
    }

    if (!usernameValidation?.isValid) {
      const errorMessage =
        usernameValidation?.errors?.[0] || 'Please enter a valid username';
      Alert.alert('Error', errorMessage);
      return;
    }

    if (!gradeLevel) {
      Alert.alert('Error', 'Please select your grade level');
      return;
    }

    // If validation is in progress, wait for it to complete
    if (usernameValidating) {
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    setLoading(true);

    try {
      // Get Clerk user ID
      const clerkUserId = clerkUser?.id;
      if (!clerkUserId) {
        Alert.alert(
          'Error',
          'Unable to identify your account. Please try signing in again.',
        );
        setLoading(false);
        return;
      }

      // Check if profile already exists
      let profileId = user?.id;

      // If no Supabase user ID, we need to create a profile using Clerk user ID
      // First, check if a profile exists with this Clerk user ID
      const { data: profiles, error: fetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('clerk_user_id', clerkUserId)
        .limit(1);

      if (fetchError) {
        console.error('Error fetching profile:', fetchError);
        Alert.alert(
          'Error',
          'Unable to verify your profile. Please try again.',
        );
        setLoading(false);
        return;
      }

      // Handle case where query returns array
      const existingProfile =
        profiles && profiles.length > 0 ? profiles[0] : null;

      // Log warning if multiple profiles found (data integrity issue)
      if (profiles && profiles.length > 1) {
        console.warn(
          '⚠️ [ProfileCompletion] Multiple profiles found for Clerk user ID. Using oldest profile.',
          `Found ${profiles.length} profiles for clerk_user_id: ${clerkUserId}`,
        );
      }

      if (existingProfile) {
        // Profile exists, update it
        profileId = existingProfile.id;
        // For OAuth users, update by clerk_user_id to avoid RLS issues
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            username: username.trim(),
            display_name: displayName.trim() || username.trim(),
            preferred_grade_level: gradeLevel as GradeLevel,
            clerk_user_id: clerkUserId, // Ensure Clerk user ID is set
          })
          .eq('clerk_user_id', clerkUserId);

        if (updateError) {
          console.error('Error updating profile:', updateError);
          Alert.alert('Error', 'Failed to update profile. Please try again.');
          setLoading(false);
          return;
        }
      } else {
        // Create new profile
        // We need a Supabase user ID - if user is null, we'll need to create a profile
        // with a generated UUID and link it to Clerk user ID
        if (!user) {
          Alert.alert(
            'Error',
            'Unable to create profile. Please try signing in again.',
          );
          setLoading(false);
          return;
        }

        const newProfile = {
          id: user.id,
          username: username.trim(),
          display_name: displayName.trim() || username.trim(),
          clerk_user_id: clerkUserId,
          total_xp: 0,
          current_streak: 0,
          longest_streak: 0,
          last_activity_date: new Date().toISOString().split('T')[0],
          total_games_played: 0,
          total_stories_completed: 0,
          total_words_written: 0,
          best_score: 0,
          preferred_grade_level: gradeLevel as GradeLevel,
          speech_enabled: true,
        };

        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert(newProfile);

        if (insertError) {
          console.error('Error creating profile:', insertError);
          Alert.alert('Error', 'Failed to create profile. Please try again.');
          setLoading(false);
          return;
        }
      }

      // Refresh profile in AuthContext
      await refreshProfile();

      // Call onComplete callback
      if (onComplete) {
        onComplete();
      } else {
        // Default: just show success message
        Alert.alert('Success', 'Profile completed successfully!', [
          {
            text: 'OK',
            onPress: () => {
              // Profile will be refreshed and app will navigate automatically
            },
          },
        ]);
      }
    } catch (error) {
      console.error('Error completing profile:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Profile Completion?',
      'You can complete your profile later from the Settings screen. Some features may be limited until your profile is complete.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Skip for Now',
          onPress: () => {
            if (onSkip) {
              onSkip();
            }
          },
        },
      ],
    );
  };

  const getUsernameInputStyle = () => {
    if (!usernameTouched || !usernameValidation) {
      return styles.textInput;
    }

    if (!usernameValidation.isValid) {
      return [styles.textInput, styles.textInputError];
    }

    if (usernameValidation.warnings.length > 0) {
      return [styles.textInput, styles.textInputWarning];
    }

    return [styles.textInput, styles.textInputValid];
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          <View style={styles.headerSection}>
            <Text style={styles.title}>Complete Your Profile</Text>
            <Text style={styles.subtitle}>
              Help us personalize your CreativeBridge experience
            </Text>
          </View>

          <View style={styles.formSection}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Username *</Text>
              <View style={styles.emailInputWrapper}>
                <TextInput
                  style={getUsernameInputStyle()}
                  value={username}
                  onChangeText={handleUsernameChange}
                  placeholder="Choose a username"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                {usernameValidating && (
                  <View style={styles.validationSpinner}>
                    <ActivityIndicator size="small" color="#666" />
                  </View>
                )}
              </View>

              {/* Username validation feedback */}
              {usernameTouched && usernameValidation && (
                <View style={styles.validationFeedback}>
                  {usernameValidation.errors.map((error, index) => (
                    <Text key={`error-${index}`} style={styles.errorText}>
                      ❌ {error}
                    </Text>
                  ))}
                  {usernameValidation.warnings.map((warning, index) => (
                    <Text key={`warning-${index}`} style={styles.warningText}>
                      ⚠️ {warning}
                    </Text>
                  ))}
                  {usernameValidation.suggestions?.map((suggestion, index) => (
                    <Text
                      key={`suggestion-${index}`}
                      style={styles.suggestionText}
                    >
                      💡 Try: {suggestion}
                    </Text>
                  ))}
                  {usernameValidation.isValid &&
                    usernameValidation.errors.length === 0 &&
                    usernameValidation.warnings.length === 0 && (
                      <Text style={styles.successText}>
                        ✅ Username is available!
                      </Text>
                    )}
                </View>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Display Name</Text>
              <TextInput
                style={styles.textInput}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="How should we display your name?"
                autoCorrect={false}
                editable={!loading}
              />
              <Text style={styles.hintText}>
                This is how your name will appear to others. Leave blank to use
                your username.
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Grade Level *</Text>
              <View style={styles.gradeLevelContainer}>
                {gradeLevelOptions.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.gradeLevelOption,
                      gradeLevel === option.value &&
                        styles.gradeLevelOptionSelected,
                    ]}
                    onPress={() => setGradeLevel(option.value as GradeLevel)}
                    disabled={loading}
                  >
                    <Text
                      style={[
                        styles.gradeLevelOptionText,
                        gradeLevel === option.value &&
                          styles.gradeLevelOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (loading ||
                  usernameValidating ||
                  (usernameTouched && !usernameValidation?.isValid)) &&
                  styles.disabledButton,
              ]}
              onPress={handleSubmit}
              disabled={
                loading ||
                usernameValidating ||
                (usernameTouched && !usernameValidation?.isValid)
              }
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Saving...' : 'Complete Profile'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
              disabled={loading}
            >
              <Text style={styles.skipButtonText}>Skip for Now</Text>
            </TouchableOpacity>

            <View style={styles.helpSection}>
              <Text style={styles.helpText}>
                💡 You can update your profile anytime from Settings
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  content: {
    width: '100%',
    paddingHorizontal: 20,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  formSection: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  emailInputWrapper: {
    position: 'relative',
  },
  validationSpinner: {
    position: 'absolute',
    right: 12,
    top: 12,
    height: 20,
    width: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  validationFeedback: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#dc3545',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    color: '#fd7e14',
    marginBottom: 4,
  },
  suggestionText: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  successText: {
    fontSize: 12,
    color: '#198754',
    marginBottom: 4,
  },
  textInputError: {
    borderColor: '#ff4444',
    borderWidth: 2,
    backgroundColor: '#fff5f5',
  },
  textInputWarning: {
    borderColor: '#ffaa00',
    borderWidth: 2,
    backgroundColor: '#fffaf0',
  },
  textInputValid: {
    borderColor: '#44aa44',
    borderWidth: 2,
    backgroundColor: '#f0fff0',
  },
  hintText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  gradeLevelContainer: {
    gap: 8,
  },
  gradeLevelOption: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
  },
  gradeLevelOptionSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#f0fff0',
  },
  gradeLevelOptionText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    fontWeight: '500',
  },
  gradeLevelOptionTextSelected: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  skipButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  helpSection: {
    backgroundColor: '#fff3cd',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  helpText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
});

export default ProfileCompletionScreen;
