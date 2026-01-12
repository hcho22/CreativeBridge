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
  Dimensions,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { validateEmail, EmailValidationResult } from '../utils/emailValidation';
import {
  validatePassword,
  PasswordStrengthResult,
  PasswordValidator,
} from '../utils/passwordValidation';
import {
  validateUsername,
  UsernameValidationResult,
} from '../utils/usernameValidation';
import { AuthStackParamList } from '../navigation/AppNavigator';
import { GradeLevel } from '../types/database';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { AppleSignInButton } from '../components/auth/AppleSignInButton';

type AuthScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Auth'>;

interface AuthScreenProps {
  navigation?: AuthScreenNavigationProp; // Optional since AuthScreen may be rendered without stack navigation
}

const AuthScreen: React.FC<AuthScreenProps> = ({ navigation: _navigation }) => {
  const {
    signIn,
    signUp,
    user,
    emailConfirmed,
    resendConfirmation,
    checkEmailConfirmation,
    resetPassword,
    oauthError,
    clearOAuthError,
  } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel | ''>('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailValidating, setEmailValidating] = useState(false);
  const [emailValidation, setEmailValidation] =
    useState<EmailValidationResult | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordValidation, setPasswordValidation] =
    useState<PasswordStrengthResult | null>(null);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [usernameValidating, setUsernameValidating] = useState(false);
  const [usernameValidation, setUsernameValidation] =
    useState<UsernameValidationResult | null>(null);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // Show OAuth errors from AuthContext
  useEffect(() => {
    if (oauthError) {
      Alert.alert('Sign-In Error', oauthError, [
        {
          text: 'OK',
          onPress: () => {
            clearOAuthError();
          },
        },
      ]);
    }
  }, [oauthError, clearOAuthError]);

  const isValidPassword = (passwordParam: string): boolean => {
    const validation = validatePassword(passwordParam);
    return validation.isValid;
  };

  const gradeLevelOptions = [
    { value: 'K-2', label: 'Kindergarten - 2nd Grade' },
    { value: '3-5', label: '3rd - 5th Grade' },
    { value: '6-8', label: '6th - 8th Grade' },
    { value: '9-12', label: '9th - 12th Grade' },
  ];

  // Load saved email and remember me preference on component mount
  useEffect(() => {
    const loadSavedPreferences = async () => {
      try {
        const { RememberMeStorage } = await import(
          '../utils/rememberMeStorage'
        );
        const rememberMeData = await RememberMeStorage.getRememberMe();

        if (rememberMeData?.isEnabled && rememberMeData.userEmail) {
          setEmail(rememberMeData.userEmail);
          setRememberMe(true);
          // Set emailTouched to true so validation runs for the loaded email
          setEmailTouched(true);
        }
      } catch (error) {
        console.error('Error loading saved preferences:', error);
      }
    };

    loadSavedPreferences();
  }, []);

  // Check if user needs email confirmation
  useEffect(() => {
    if (user && !emailConfirmed) {
      setShowEmailConfirmation(true);
      setEmail(user.email || '');
    } else if (user && emailConfirmed) {
      setShowEmailConfirmation(false);
    }
  }, [user, emailConfirmed]);

  // Real-time email validation
  useEffect(() => {
    const validateEmailAsync = async () => {
      if (!email.trim() || !emailTouched) {
        setEmailValidation(null);
        return;
      }

      setEmailValidating(true);
      try {
        const result = await validateEmail(email, !isLogin); // Check availability for signup
        setEmailValidation(result);
      } catch (error) {
        console.error('Email validation error:', error);
        setEmailValidation({
          isValid: false,
          errors: ['Unable to validate email. Please try again.'],
          warnings: [],
        });
      } finally {
        setEmailValidating(false);
      }
    };

    const timeoutId = setTimeout(validateEmailAsync, 500); // Debounce validation
    return () => clearTimeout(timeoutId);
  }, [email, emailTouched, isLogin]);

  // Real-time password validation
  useEffect(() => {
    if (!password || !passwordTouched) {
      setPasswordValidation(null);
      return;
    }

    const result = validatePassword(password);
    setPasswordValidation(result);
  }, [password, passwordTouched]);

  // Real-time username validation
  useEffect(() => {
    const validateUsernameAsync = async () => {
      if (!username.trim() || !usernameTouched || isLogin) {
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
  }, [username, usernameTouched, isLogin]);

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // If validation is in progress, wait for it to complete
    if (emailValidating) {
      // Wait for validation to complete (debounce is 500ms, so wait a bit longer)
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    // If email is touched but validation hasn't completed yet, wait a bit more
    // This can happen if the email was just loaded from storage
    if (emailTouched && !emailValidation && !emailValidating) {
      // Wait for the debounced validation to complete
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    // Check email validation result
    if (!emailValidation?.isValid) {
      const errorMessage =
        emailValidation?.errors?.[0] || 'Please enter a valid email address';
      Alert.alert('Error', errorMessage);
      return;
    }

    if (!isValidPassword(password)) {
      const passwordResult = validatePassword(password);
      Alert.alert(
        'Error',
        passwordResult.feedback[0] || 'Please choose a stronger password',
      );
      return;
    }

    // Check additional signup fields
    if (!isLogin) {
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

      if (!acceptedTerms) {
        Alert.alert('Error', 'Please accept the Terms of Service to continue');
        return;
      }
    }

    // Show warnings if any
    if (emailValidation?.warnings && emailValidation.warnings.length > 0) {
      const warningMessage = emailValidation.warnings.join('\n');
      const suggestions = emailValidation.suggestions
        ? '\n\nSuggestions:\n' + emailValidation.suggestions.join('\n')
        : '';

      Alert.alert('Email Warning', warningMessage + suggestions, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue Anyway', onPress: () => proceedWithAuth() },
      ]);
      return;
    }

    proceedWithAuth();
  };

  const proceedWithAuth = async () => {
    setLoading(true);

    try {
      let result;
      if (isLogin) {
        result = await signIn(email.trim(), password, rememberMe);
      } else {
        result = await signUp(email.trim(), password, {
          username: username.trim(),
          displayName: displayName.trim() || undefined,
          gradeLevel: gradeLevel as GradeLevel,
        });
      }

      if (result.error) {
        Alert.alert('Error', result.error);
      } else if (!isLogin) {
        setShowEmailConfirmation(true);
        Alert.alert(
          'Account Created!',
          'Please check your email and click the confirmation link to complete your registration.',
        );
      }
    } catch (error) {
      console.error('Auth error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setEmail('');
    setPassword('');
    setUsername('');
    setDisplayName('');
    setGradeLevel('');
    setAcceptedTerms(false);
    setRememberMe(false);
    setEmailValidation(null);
    setEmailTouched(false);
    setPasswordValidation(null);
    setPasswordTouched(false);
    setUsernameValidation(null);
    setUsernameTouched(false);
    setShowForgotPassword(false);
    setResetEmailSent(false);
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (!emailTouched) {
      setEmailTouched(true);
    }
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (!passwordTouched) {
      setPasswordTouched(true);
    }
  };

  const handleUsernameChange = (text: string) => {
    setUsername(text);
    if (!usernameTouched) {
      setUsernameTouched(true);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setResendingConfirmation(true);
    try {
      const result = await resendConfirmation(email.trim());
      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        Alert.alert(
          'Success',
          'Confirmation email sent! Please check your inbox.',
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to resend confirmation email. Please try again.',
      );
    } finally {
      setResendingConfirmation(false);
    }
  };

  const handleCheckConfirmation = async () => {
    try {
      const confirmed = await checkEmailConfirmation();
      if (confirmed) {
        Alert.alert('Success', 'Email confirmed! You can now access the app.');
        setShowEmailConfirmation(false);
      } else {
        Alert.alert(
          'Not Confirmed',
          'Email has not been confirmed yet. Please check your inbox and click the confirmation link.',
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to check confirmation status. Please try again.',
      );
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    if (!emailValidation?.isValid) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword(email.trim());
      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        setResetEmailSent(true);
        Alert.alert(
          'Reset Email Sent!',
          'Please check your email for instructions to reset your password.',
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getEmailInputStyle = () => {
    if (!emailTouched || !emailValidation) {
      return styles.textInput;
    }

    if (!emailValidation.isValid) {
      return [styles.textInput, styles.textInputError];
    }

    if (emailValidation.warnings.length > 0) {
      return [styles.textInput, styles.textInputWarning];
    }

    return [styles.textInput, styles.textInputValid];
  };

  const getPasswordInputStyle = () => {
    if (!passwordTouched || !passwordValidation) {
      return styles.passwordInput;
    }

    if (!passwordValidation.isValid) {
      return [styles.passwordInput, styles.passwordInputError];
    }

    if (passwordValidation.score >= 4) {
      return [styles.passwordInput, styles.passwordInputValid];
    }

    if (passwordValidation.score >= 2) {
      return [styles.passwordInput, styles.passwordInputWarning];
    }

    return [styles.passwordInput, styles.passwordInputError];
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

  // If user needs email confirmation, show confirmation screen
  if (showEmailConfirmation) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.content}>
            <View style={styles.headerSection}>
              <Text style={styles.appTitle}>📧 Confirm Your Email</Text>
              <Text style={styles.appSubtitle}>
                We've sent a confirmation link to your email
              </Text>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formTitle}>Almost There!</Text>
              <Text style={styles.formSubtitle}>
                Please check your email and click the confirmation link to
                complete your registration.
              </Text>

              <View style={styles.emailConfirmationInfo}>
                <Text style={styles.emailLabel}>Email sent to:</Text>
                <Text style={styles.emailAddress}>{email}</Text>
              </View>

              <TouchableOpacity
                style={styles.authButton}
                onPress={handleCheckConfirmation}
                disabled={loading}
              >
                <Text style={styles.authButtonText}>
                  I've Confirmed My Email
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton]}
                onPress={handleResendConfirmation}
                disabled={resendingConfirmation}
              >
                <Text style={styles.secondaryButtonText}>
                  {resendingConfirmation
                    ? 'Sending...'
                    : 'Resend Confirmation Email'}
                </Text>
              </TouchableOpacity>

              <View style={styles.helpSection}>
                <Text style={styles.helpText}>
                  💡 Check your spam folder if you don't see the email
                </Text>
                <Text style={styles.helpText}>
                  📧 Make sure {email} is correct
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // If user is on forgot password screen, show forgot password form
  if (showForgotPassword) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.content}>
            <View style={styles.headerSection}>
              <Text style={styles.appTitle}>🔑 Reset Password</Text>
              <Text style={styles.appSubtitle}>
                Enter your email to receive reset instructions
              </Text>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formTitle}>Forgot Your Password?</Text>
              <Text style={styles.formSubtitle}>
                No worries! Enter your email address and we'll send you
                instructions to reset your password.
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <View style={styles.emailInputWrapper}>
                  <TextInput
                    style={getEmailInputStyle()}
                    value={email}
                    onChangeText={handleEmailChange}
                    placeholder="Enter your email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                  {emailValidating && (
                    <View style={styles.validationSpinner}>
                      <ActivityIndicator size="small" color="#666" />
                    </View>
                  )}
                </View>

                {/* Email validation feedback */}
                {emailTouched && emailValidation && (
                  <View style={styles.validationFeedback}>
                    {emailValidation.errors.map((error, index) => (
                      <Text key={`error-${index}`} style={styles.errorText}>
                        ❌ {error}
                      </Text>
                    ))}
                    {emailValidation.warnings.map((warning, index) => (
                      <Text key={`warning-${index}`} style={styles.warningText}>
                        ⚠️ {warning}
                      </Text>
                    ))}
                    {emailValidation.isValid &&
                      emailValidation.errors.length === 0 &&
                      emailValidation.warnings.length === 0 && (
                        <Text style={styles.successText}>
                          ✅ Email looks good!
                        </Text>
                      )}
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.authButton,
                  (loading ||
                    emailValidating ||
                    (emailTouched && !emailValidation?.isValid)) &&
                    styles.disabledButton,
                ]}
                onPress={handleForgotPassword}
                disabled={
                  loading ||
                  emailValidating ||
                  (emailTouched && !emailValidation?.isValid)
                }
              >
                <Text style={styles.authButtonText}>
                  {loading ? 'Sending...' : 'Send Reset Email'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setShowForgotPassword(false)}
                disabled={loading}
              >
                <Text style={styles.secondaryButtonText}>Back to Sign In</Text>
              </TouchableOpacity>

              {resetEmailSent && (
                <View style={styles.helpSection}>
                  <Text style={styles.helpText}>
                    📧 Check your email for reset instructions
                  </Text>
                  <Text style={styles.helpText}>
                    💡 Don't forget to check your spam folder
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          {/* App Logo/Title */}
          <View style={styles.headerSection}>
            <Text style={styles.appTitle}>🎮 CreativeBridge</Text>
            <Text style={styles.appSubtitle}>
              AI-Assisted Story Writing for Students
            </Text>
          </View>

          {/* Auth Form */}
          <View style={styles.formSection}>
            {!isLogin && (
              <>
                <Text style={styles.formTitle}>Create Account</Text>
                <Text style={styles.formSubtitle}>
                  Join thousands of creative writers
                </Text>
              </>
            )}

            {/* OAuth Sign-In Buttons - Primary Method */}
            <View style={styles.socialButtonsRow}>
              <GoogleSignInButton
                disabled={loading}
                style={styles.socialButton}
                onSignInStart={() => {
                  console.log('Google sign-in initiated');
                }}
                onSignInComplete={error => {
                  if (error) {
                    console.error('Google sign-in error:', error);
                  } else {
                    console.log('Google sign-in completed successfully');
                  }
                }}
              />

              <AppleSignInButton
                disabled={loading}
                style={styles.socialButton}
                onSignInStart={() => {
                  console.log('Apple sign-in initiated');
                }}
                onSignInComplete={error => {
                  if (error) {
                    console.error('Apple sign-in error:', error);
                  } else {
                    console.log('Apple sign-in completed successfully');
                  }
                }}
              />
            </View>

            {/* OAuth Divider */}
            <View style={styles.oauthDividerContainer}>
              <View style={styles.oauthDividerLine} />
              <Text style={styles.oauthDividerText}>OR</Text>
              <View style={styles.oauthDividerLine} />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.emailInputWrapper}>
                <TextInput
                  style={getEmailInputStyle()}
                  value={email}
                  onChangeText={handleEmailChange}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                {emailValidating && (
                  <View style={styles.validationSpinner}>
                    <ActivityIndicator size="small" color="#666" />
                  </View>
                )}
              </View>

              {/* Email validation feedback */}
              {emailTouched && emailValidation && (
                <View style={styles.validationFeedback}>
                  {emailValidation.errors.map((error, index) => (
                    <Text key={`error-${index}`} style={styles.errorText}>
                      ❌ {error}
                    </Text>
                  ))}
                  {emailValidation.warnings.map((warning, index) => (
                    <Text key={`warning-${index}`} style={styles.warningText}>
                      ⚠️ {warning}
                    </Text>
                  ))}
                  {emailValidation.suggestions?.map((suggestion, index) => (
                    <Text
                      key={`suggestion-${index}`}
                      style={styles.suggestionText}
                    >
                      💡 {suggestion}
                    </Text>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordInputWrapper}>
                <TextInput
                  style={getPasswordInputStyle()}
                  value={password}
                  onChangeText={handlePasswordChange}
                  placeholder="Enter your password"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  <Text style={styles.passwordToggleText}>
                    {showPassword ? '🙈' : '👁️'}
                  </Text>
                </TouchableOpacity>
              </View>
              {!isLogin && passwordTouched && passwordValidation && (
                <View style={styles.passwordStrengthContainer}>
                  <View style={styles.passwordStrengthBar}>
                    <View
                      style={[
                        styles.passwordStrengthFill,
                        {
                          width: `${(passwordValidation.score / 5) * 100}%`,
                          backgroundColor: PasswordValidator.getStrengthColor(
                            passwordValidation.score,
                          ),
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.passwordStrengthText,
                      {
                        color: PasswordValidator.getStrengthColor(
                          passwordValidation.score,
                        ),
                      },
                    ]}
                  >
                    {PasswordValidator.getStrengthLabel(
                      passwordValidation.score,
                    )}
                  </Text>
                </View>
              )}

              {passwordTouched &&
                passwordValidation &&
                passwordValidation.feedback.length > 0 && (
                  <View style={styles.validationFeedback}>
                    {passwordValidation.feedback.map((feedback, index) => (
                      <Text
                        key={`feedback-${index}`}
                        style={
                          passwordValidation.isValid
                            ? styles.successText
                            : styles.errorText
                        }
                      >
                        {passwordValidation.isValid ? '✅' : '❌'} {feedback}
                      </Text>
                    ))}
                  </View>
                )}

              <Text style={styles.passwordHint}>
                {isLogin
                  ? 'Password must be at least 6 characters'
                  : 'Choose a strong password with 8+ characters, including uppercase, lowercase, numbers, and symbols'}
              </Text>
            </View>

            {/* Remember Me checkbox - login only */}
            {isLogin && (
              <View style={styles.inputContainer}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setRememberMe(!rememberMe)}
                  disabled={loading}
                >
                  <View
                    style={[
                      styles.checkbox,
                      rememberMe && styles.checkboxChecked,
                    ]}
                  >
                    {rememberMe && <Text style={styles.checkboxCheck}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxText}>
                    Remember me on this device
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Username input - signup only */}
            {!isLogin && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Username</Text>
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
                    {usernameValidation.suggestions?.map(
                      (suggestion, index) => (
                        <Text
                          key={`suggestion-${index}`}
                          style={styles.suggestionText}
                        >
                          💡 Try: {suggestion}
                        </Text>
                      ),
                    )}
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
            )}

            {/* Display name input - signup only */}
            {!isLogin && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Display Name (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="How should we display your name?"
                  autoCorrect={false}
                  editable={!loading}
                />
                <Text style={styles.passwordHint}>
                  This is how your name will appear to others. Leave blank to
                  use your username.
                </Text>
              </View>
            )}

            {/* Grade level selection - signup only */}
            {!isLogin && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Grade Level</Text>
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
            )}

            {/* Terms of service - signup only */}
            {!isLogin && (
              <View style={styles.inputContainer}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setAcceptedTerms(!acceptedTerms)}
                  disabled={loading}
                >
                  <View
                    style={[
                      styles.checkbox,
                      acceptedTerms && styles.checkboxChecked,
                    ]}
                  >
                    {acceptedTerms && (
                      <Text style={styles.checkboxCheck}>✓</Text>
                    )}
                  </View>
                  <Text style={styles.checkboxText}>
                    I agree to the{' '}
                    <Text style={styles.linkText}>Terms of Service</Text> and{' '}
                    <Text style={styles.linkText}>Privacy Policy</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.authButton,
                (loading ||
                  emailValidating ||
                  (emailTouched && !emailValidation?.isValid)) &&
                  styles.disabledButton,
              ]}
              onPress={handleAuth}
              disabled={
                loading ||
                emailValidating ||
                (emailTouched && !emailValidation?.isValid)
              }
            >
              <Text style={styles.authButtonText}>
                {loading
                  ? 'Please wait...'
                  : isLogin
                  ? 'Sign In'
                  : 'Create Account'}
              </Text>
            </TouchableOpacity>

            <View style={styles.switchContainer}>
              <Text style={styles.switchText}>
                {isLogin
                  ? "Don't have an account? "
                  : 'Already have an account? '}
              </Text>
              <TouchableOpacity onPress={toggleAuthMode} disabled={loading}>
                <Text style={styles.switchLink}>
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Forgot Password Link - login only */}
            {isLogin && (
              <TouchableOpacity
                style={styles.forgotPasswordLinkBelow}
                onPress={() => setShowForgotPassword(true)}
                disabled={loading}
              >
                <Text style={styles.forgotPasswordText}>
                  Forgot your password?
                </Text>
              </TouchableOpacity>
            )}

            {/* Legal Links */}
            <View style={styles.legalLinksContainer}>
              <TouchableOpacity disabled={loading}>
                <Text style={styles.legalLinkText}>Privacy Policy</Text>
              </TouchableOpacity>
              <Text style={styles.legalDivider}>•</Text>
              <TouchableOpacity disabled={loading}>
                <Text style={styles.legalLinkText}>Terms of Service</Text>
              </TouchableOpacity>
              <Text style={styles.legalDivider}>•</Text>
              <TouchableOpacity disabled={loading}>
                <Text style={styles.legalLinkText}>EULA</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Calculate responsive font size for title
const screenWidth = Dimensions.get('window').width;
const titleFontSize = Math.min(screenWidth * 0.18, 80);

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
    marginBottom: 12,
  },
  appTitle: {
    fontSize: titleFontSize,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
    textAlign: 'center',
    width: '100%',
  },
  appSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 100,
  },
  formSection: {
    width: '100%',
    marginBottom: 10,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  inputContainer: {
    marginBottom: 10,
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
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  passwordInputWrapper: {
    position: 'relative',
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingRight: 50,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  passwordToggle: {
    position: 'absolute',
    right: 15,
    top: 12,
    height: 24,
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passwordToggleText: {
    fontSize: 18,
  },
  passwordHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotPasswordLinkBelow: {
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 60,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  authButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  authButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
    color: '#666',
  },
  switchLink: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  oauthDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  oauthDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  oauthDividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  socialButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 0,
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  socialButton: {
    flex: 1,
    minWidth: 0,
    marginVertical: 0,
  },
  legalLinksContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 20,
    paddingTop: 8,
    paddingBottom: 2,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  legalLinkText: {
    fontSize: 12,
    color: '#666',
    textDecorationLine: 'underline',
  },
  legalDivider: {
    fontSize: 12,
    color: '#666',
    marginHorizontal: 8,
  },
  // Email validation styles
  emailInputWrapper: {
    position: 'relative',
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
  // Email confirmation styles
  emailConfirmationInfo: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  emailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  emailAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  secondaryButton: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  secondaryButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
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
    marginBottom: 8,
    textAlign: 'center',
  },
  // Password strength styles
  passwordStrengthContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  passwordStrengthBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginBottom: 4,
  },
  passwordStrengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  passwordStrengthText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Password input variants
  passwordInputError: {
    borderColor: '#ff4444',
    borderWidth: 2,
    backgroundColor: '#fff5f5',
  },
  passwordInputWarning: {
    borderColor: '#ffaa00',
    borderWidth: 2,
    backgroundColor: '#fffaf0',
  },
  passwordInputValid: {
    borderColor: '#44aa44',
    borderWidth: 2,
    backgroundColor: '#f0fff0',
  },
  // Grade level selection styles
  gradeLevelContainer: {
    gap: 8,
  },
  gradeLevelOption: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
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
  // Checkbox styles
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 5,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
  },
  checkboxChecked: {
    borderColor: '#4CAF50',
    backgroundColor: '#4CAF50',
  },
  checkboxCheck: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    lineHeight: 20,
  },
  linkText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
});

export default AuthScreen;
