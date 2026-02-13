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
    // Only auto-fill if user hasn't touched the field yet (prevents overwriting user edits)
    if (!displayName && !displayNameTouched) {
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
      // Get Clerk user ID
      const clerkUserObj = clerkUser?.user;
      const clerkUserId = clerkUserObj?.id;
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
        // Create new profile using RPC function (generates proper UUID)
        // For OAuth users, user.id is the Clerk user ID which is not a valid UUID
        // The RPC function handles UUID generation internally
        const clerkEmail =
          clerkUser?.user?.emailAddresses?.[0]?.emailAddress || null;

        console.log('📝 [ProfileCompletion] Creating new profile via RPC:', {
          clerkUserId,
          username: username.trim(),
          displayName: displayName.trim() || username.trim(),
          gradeLevel,
        });

        const { data: createdProfile, error: insertError } = await (
          supabase as any
        )
          .rpc('create_oauth_user_profile', {
            p_clerk_user_id: clerkUserId,
            p_username: username.trim(),
            p_display_name: displayName.trim() || username.trim(),
            p_preferred_grade_level: gradeLevel as GradeLevel,
            p_email: clerkEmail,
            p_speech_enabled: true,
          })
          .single();

        if (insertError) {
          // Check if profile already exists (race condition)
          if (insertError.message?.includes('already exists')) {
            console.log(
              '✅ [ProfileCompletion] Profile already exists, proceeding with update',
            );
            // Profile exists, we can proceed - it will be refreshed below
          } else {
            console.error('Error creating profile:', insertError);
            Alert.alert('Error', 'Failed to create profile. Please try again.');
            setLoading(false);
            return;
          }
        } else {
          console.log(
            '✅ [ProfileCompletion] Profile created successfully:',
            createdProfile,
          );
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
          onPress: async () => {
            setIsSkipping(true);
            try {
              // Get Clerk user object and ID - required for profile creation
              const clerkUserObj = clerkUser?.user;
              const clerkUserId = clerkUserObj?.id;
              if (!clerkUserId) {
                console.error(
                  '❌ [ProfileCompletion] Cannot create minimal profile: No Clerk user ID',
                );
                // Still allow skip, user can fix in Settings later
                if (onSkip) {
                  onSkip();
                }
                return;
              }

              // Generate username from email or fallback to clerk user ID suffix
              const generateUsername = (): string => {
                // Try email prefix first
                const email =
                  clerkUserObj?.emailAddresses?.[0]?.emailAddress ||
                  user?.email;
                if (email) {
                  const emailPrefix = email.split('@')[0];
                  // Sanitize: lowercase, replace dots/special chars with underscores
                  // Also handle edge cases like leading/trailing/consecutive underscores
                  const sanitized = emailPrefix
                    .toLowerCase()
                    .replace(/[^a-z0-9_-]/g, '_') // Replace invalid chars with underscore
                    .replace(/^[_-]+/, '') // Remove leading underscores/hyphens
                    .replace(/[_-]+$/, '') // Remove trailing underscores/hyphens
                    .replace(/[_-]{2,}/g, '_'); // Replace consecutive special chars
                  // If sanitization resulted in empty string, use fallback
                  if (sanitized.length >= 3) {
                    return sanitized;
                  }
                }
                // Fallback: use last 8 chars of clerk user ID
                return `user_${clerkUserId.slice(-8)}`;
              };

              // Generate display name from Clerk firstName + lastName
              const generateDisplayName = (): string => {
                const firstName = clerkUserObj?.firstName || '';
                const lastName = clerkUserObj?.lastName || '';
                const fullName = `${firstName} ${lastName}`.trim();
                if (fullName) {
                  return fullName;
                }
                // Fallback to capitalized username
                // For 'user_xxx' format (Apple hidden email), create friendlier display
                const generatedUsername = generateUsername();
                if (generatedUsername.startsWith('user_')) {
                  // Transform 'user_abc12345' to 'User abc12345' for display
                  return 'User ' + generatedUsername.slice(5);
                }
                // For email-derived usernames, capitalize first letter
                return (
                  generatedUsername.charAt(0).toUpperCase() +
                  generatedUsername.slice(1)
                );
              };

              const generatedUsername = generateUsername();
              const generatedDisplayName = generateDisplayName();

              // Log edge case detection for debugging
              const hasEmail = !!(
                clerkUserObj?.emailAddresses?.[0]?.emailAddress || user?.email
              );
              const hasName = !!(
                clerkUserObj?.firstName || clerkUserObj?.lastName
              );
              if (!hasEmail) {
                console.log(
                  '🍎 [ProfileCompletion] Apple Sign In hidden email detected - using Clerk ID fallback for username',
                );
              }
              if (!hasName) {
                console.log(
                  '🍎 [ProfileCompletion] No name available - using username-derived display name',
                );
              }

              console.log(
                '🔄 [ProfileCompletion] Creating minimal profile for skipped user...',
                {
                  username: generatedUsername,
                  displayName: generatedDisplayName,
                  hasEmail,
                  hasName,
                },
              );

              // Use RPC function to create profile (bypasses RLS)
              const { data: createdProfile, error: createError } = await (
                supabase as any
              )
                .rpc('create_oauth_user_profile', {
                  p_clerk_user_id: clerkUserId,
                  p_username: generatedUsername,
                  p_display_name: generatedDisplayName,
                  p_preferred_grade_level: 'K-2', // Default for skipped users
                  p_email:
                    clerkUserObj?.emailAddresses?.[0]?.emailAddress || null,
                  p_speech_enabled: true,
                })
                .single();

              if (createError) {
                // Check if profile already exists (not an error, just skip creation)
                if (createError.message?.includes('already exists')) {
                  console.log(
                    '✅ [ProfileCompletion] Profile already exists, skipping creation',
                  );
                } else {
                  console.error(
                    '❌ [ProfileCompletion] Error creating minimal profile:',
                    createError,
                  );
                }
                // Don't block navigation on error - user can fix in Settings
              } else {
                console.log(
                  '✅ [ProfileCompletion] Minimal profile created successfully:',
                  createdProfile,
                );
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
                onChangeText={handleDisplayNameChange}
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
