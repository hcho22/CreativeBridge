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

interface ProfileCompletionScreenProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

const ProfileCompletionScreen: React.FC<ProfileCompletionScreenProps> = ({
  onComplete,
  onSkip,
}) => {
  const { user, userProfile, updateProfile, refreshProfile } = useAuth();
  const { clerkUser } = useSafeClerkAuth();

  // US-010: Determine if user is under 13 to block real name auto-fill
  const isUnder13 = userProfile?.age_group === 'under_13';

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel | ''>('');
  const [loading, setLoading] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [usernameValidating, setUsernameValidating] = useState(false);
  const [usernameValidation, setUsernameValidation] =
    useState<UsernameValidationResult | null>(null);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [displayNameTouched, setDisplayNameTouched] = useState(false);

  const gradeLevelOptions = [
    { value: 'K-2', label: 'Kindergarten - 2nd Grade' },
    { value: '3-5', label: '3rd - 5th Grade' },
    { value: '6-8', label: '6th - 8th Grade' },
    { value: '9-12', label: '9th - 12th Grade' },
  ];

  // Pre-fill username and display name from Clerk user object or user email
  useEffect(() => {
    const clerkUserObj = clerkUser?.user;

    // Pre-fill username from email if available
    if (!username && !usernameTouched) {
      let emailToUse: string | undefined;

      // Try to get email from Clerk user first
      if (clerkUserObj?.emailAddresses?.[0]?.emailAddress) {
        emailToUse = clerkUserObj.emailAddresses[0].emailAddress;
      }
      // Fallback to user object email
      else if (user?.email) {
        emailToUse = user.email;
      }

      // Extract username from email and sanitize for validation
      if (emailToUse) {
        const emailPrefix = emailToUse.split('@')[0];
        // Sanitize: lowercase, replace dots/special chars with underscores (same as skip flow)
        const sanitizedUsername = emailPrefix
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '_') // Replace invalid chars with underscore
          .replace(/^[_-]+/, '') // Remove leading underscores/hyphens
          .replace(/[_-]+$/, '') // Remove trailing underscores/hyphens
          .replace(/[_-]{2,}/g, '_'); // Replace consecutive special chars with single underscore
        setUsername(sanitizedUsername);
        // Mark as touched so validation runs for auto-filled username
        setUsernameTouched(true);
        console.log(
          '🔤 [ProfileCompletion] Auto-filled username from email:',
          emailPrefix,
          '→ sanitized:',
          sanitizedUsername,
        );
      }
    }

    // Pre-fill display name from Clerk user object
    // US-010: For under-13 users, NEVER auto-fill real name from OAuth — leave blank
    // Only auto-fill if user hasn't touched the field yet (prevents overwriting user edits)
    if (!displayName && !displayNameTouched && !isUnder13) {
      const firstName = clerkUserObj?.firstName || '';
      const lastName = clerkUserObj?.lastName || '';
      if (firstName || lastName) {
        setDisplayName(`${firstName} ${lastName}`.trim());
      } else if (clerkUserObj?.emailAddresses?.[0]?.emailAddress) {
        // Fallback to email prefix if no name available
        const emailPrefix =
          clerkUserObj.emailAddresses[0].emailAddress.split('@')[0];
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
  }, [
    clerkUser,
    user,
    username,
    displayName,
    usernameTouched,
    displayNameTouched,
    isUnder13,
  ]);

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

  const handleDisplayNameChange = (text: string) => {
    setDisplayName(text);
    if (!displayNameTouched) {
      setDisplayNameTouched(true);
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
      // Use AuthContext's updateProfile which routes through Convex
      // It handles both create (new user) and update (existing profile) cases
      const { error } = await updateProfile({
        username: username.trim(),
        display_name: displayName.trim() || username.trim(),
        preferred_grade_level: gradeLevel as GradeLevel,
      });

      if (error) {
        console.error('Error completing profile:', error);
        Alert.alert('Error', error);
        setLoading(false);
        return;
      }

      // Refresh profile in AuthContext
      await refreshProfile();

      // Call onComplete callback
      if (onComplete) {
        onComplete();
      } else {
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
          onPress: async () => {
            setIsSkipping(true);
            try {
              // Use the username/displayName already populated in the form
              // (auto-filled from Clerk data), or generate defaults
              const clerkUserObj = clerkUser?.user;
              const skipUsername =
                username.trim() ||
                (() => {
                  const email =
                    clerkUserObj?.emailAddresses?.[0]?.emailAddress ||
                    user?.email;
                  if (email) {
                    const sanitized = email
                      .split('@')[0]
                      .toLowerCase()
                      .replace(/[^a-z0-9_-]/g, '_')
                      .replace(/^[_-]+/, '')
                      .replace(/[_-]+$/, '')
                      .replace(/[_-]{2,}/g, '_');
                    if (sanitized.length >= 3) return sanitized;
                  }
                  return `user_${(clerkUserObj?.id || 'unknown').slice(-8)}`;
                })();

              // US-010: For under-13, never fall back to OAuth real name
              const skipDisplayName = isUnder13
                ? displayName.trim() ||
                  skipUsername.charAt(0).toUpperCase() + skipUsername.slice(1)
                : displayName.trim() ||
                  `${clerkUserObj?.firstName || ''} ${
                    clerkUserObj?.lastName || ''
                  }`.trim() ||
                  skipUsername.charAt(0).toUpperCase() + skipUsername.slice(1);

              console.log(
                '🔄 [ProfileCompletion] Creating minimal profile for skipped user...',
                { username: skipUsername, displayName: skipDisplayName },
              );

              // Use AuthContext's updateProfile which routes through Convex
              const { error } = await updateProfile({
                username: skipUsername,
                display_name: skipDisplayName,
                preferred_grade_level: 'K-2' as GradeLevel,
              });

              if (error) {
                console.error(
                  '❌ [ProfileCompletion] Error creating minimal profile:',
                  error,
                );
                // Don't block navigation on error - user can fix in Settings
              }

              // Refresh profile in AuthContext to load the new data
              await refreshProfile();

              // Call onSkip callback to proceed with navigation
              if (onSkip) {
                onSkip();
              }
            } catch (error) {
              console.error(
                '❌ [ProfileCompletion] Unexpected error during skip:',
                error,
              );
              // Don't block navigation on error
              if (onSkip) {
                onSkip();
              }
            } finally {
              setIsSkipping(false);
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
      testID="profile-completion-screen"
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
              <Text style={styles.inputLabel}>
                {isUnder13 ? 'Nickname' : 'Display Name'}
              </Text>
              <TextInput
                style={styles.textInput}
                value={displayName}
                onChangeText={handleDisplayNameChange}
                placeholder={
                  isUnder13
                    ? 'Choose a fun nickname!'
                    : 'How should we display your name?'
                }
                autoCorrect={false}
                editable={!loading}
              />
              <Text style={styles.hintText}>
                {isUnder13
                  ? "Pick a creative nickname! Don't use your real name."
                  : 'This is how your name will appear to others. Leave blank to use your username.'}
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
              <Text style={styles.hintText}>
                Your grade level personalizes story language, illustration
                style, and challenge difficulty.
              </Text>
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
              style={[
                styles.skipButton,
                (loading || isSkipping) && styles.skipButtonDisabled,
              ]}
              onPress={handleSkip}
              disabled={loading || isSkipping}
            >
              {isSkipping ? (
                <View style={styles.skipButtonContent}>
                  <ActivityIndicator
                    size="small"
                    color="#666"
                    style={styles.skipButtonSpinner}
                  />
                  <Text style={styles.skipButtonText}>Setting up...</Text>
                </View>
              ) : (
                <Text style={styles.skipButtonText}>Skip for Now</Text>
              )}
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
    backgroundColor: '#fcfcfc',
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
  },
  formSection: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 17,
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
    fontSize: 18,
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
    fontSize: 14,
    color: '#dc3545',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: '#fd7e14',
    marginBottom: 4,
  },
  suggestionText: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  successText: {
    fontSize: 14,
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
    fontSize: 14,
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
    fontSize: 16,
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
    fontSize: 20,
    fontWeight: 'bold',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  skipButtonDisabled: {
    opacity: 0.6,
  },
  skipButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonSpinner: {
    marginRight: 8,
  },
  skipButtonText: {
    color: '#666',
    fontSize: 18,
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
    fontSize: 16,
    color: '#856404',
    textAlign: 'center',
  },
});

export default ProfileCompletionScreen;
