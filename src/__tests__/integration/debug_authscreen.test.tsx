import React from 'react';
import { render, screen } from '@testing-library/react-native';

// Add missing KeyboardAvoidingView to the react-native mock from jest.setup.js
beforeAll(() => {
  const RN = require('react-native');
  if (!RN.KeyboardAvoidingView) {
    RN.KeyboardAvoidingView = (props: any) =>
      React.createElement('View', props, props.children);
  }
});

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn().mockReturnValue({
    user: null,
    session: null,
    userProfile: null,
    loading: false,
    emailConfirmed: true,
    needsProfileCompletion: false,
    oauthError: null,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    updateProfile: jest.fn(),
    refreshProfile: jest.fn(),
    resendConfirmation: jest.fn(),
    checkEmailConfirmation: jest.fn(),
    addXp: jest.fn(),
    deductXp: jest.fn(),
    signInWithGoogle: jest.fn(),
    signInWithApple: jest.fn(),
    checkProfileCompletion: jest.fn(),
    clearOAuthError: jest.fn(),
    signUpWithClerk: jest.fn(),
    verifyEmailCode: jest.fn(),
    resendClerkVerificationCode: jest.fn(),
    signInWithClerk: jest.fn(),
    verifySignInSecondFactor: jest.fn(),
    resetPasswordWithClerk: jest.fn(),
    verifyPasswordResetCode: jest.fn(),
    migrateFromSupabase: jest.fn(),
    createImageGenerationEvent: jest.fn(),
    logImageGenerationResult: jest.fn(),
  }),
}));

jest.mock('../../components/auth/GoogleSignInButton', () => ({
  GoogleSignInButton: () => null,
}));
jest.mock('../../components/auth/AppleSignInButton', () => ({
  AppleSignInButton: () => null,
}));
jest.mock('../../components/common/OAuthSessionHelpModal', () => ({
  OAuthSessionHelpModal: () => null,
}));
jest.mock('../../utils/emailValidation', () => ({
  validateEmail: jest
    .fn()
    .mockResolvedValue({ isValid: true, errors: [], warnings: [] }),
}));
jest.mock('../../utils/passwordValidation', () => ({
  validatePassword: jest
    .fn()
    .mockReturnValue({ isValid: true, score: 4, feedback: [] }),
  PasswordValidator: {
    getStrengthColor: jest.fn(),
    getStrengthLabel: jest.fn(),
  },
}));
jest.mock('../../utils/usernameValidation', () => ({
  validateUsername: jest
    .fn()
    .mockResolvedValue({ isValid: true, errors: [], warnings: [] }),
}));
jest.mock('../../utils/rememberMeStorage', () => ({
  RememberMeStorage: {
    setRememberMe: jest.fn(),
    getRememberMe: jest.fn().mockResolvedValue({ isEnabled: false }),
    clearRememberMe: jest.fn(),
  },
}));

import AuthScreen from '../../screens/AuthScreen';

describe('Debug', () => {
  it('should render AuthScreen', () => {
    render(<AuthScreen />);
    expect(screen.getByText('Welcome Back!')).toBeTruthy();
  });
});
