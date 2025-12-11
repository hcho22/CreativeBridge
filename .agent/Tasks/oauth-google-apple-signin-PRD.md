# Google and Apple OAuth Sign-In Feature - Product Requirements Document (PRD)

## Overview

**Feature Name:** Google and Apple OAuth Authentication  
**Priority:** High  
**Target Platform:** iOS and Android  
**Estimated Timeline:** 3-4 weeks

## Problem Statement

Currently, users can only sign up and sign in using email and password authentication. This creates barriers for:

- Users who prefer using their existing Google or Apple accounts for faster authentication
- Users who want to avoid creating and remembering another password
- Users who want a more streamlined sign-up process
- Users who may forget their passwords and need alternative authentication methods

The current authentication flow requires users to manually enter email, password, and complete profile information, which can be time-consuming and may lead to user drop-off during the sign-up process.

## Goals & Success Criteria

### Primary Goals

- Enable users to sign up and sign in using Google OAuth
- Enable users to sign up and sign in using Apple Sign In
- Automatically link accounts when the same email is used across different authentication methods
- Maintain secure authentication through Supabase's OAuth integration
- Provide seamless user experience with minimal friction

### Success Criteria

- Google Sign-In button successfully authenticates users on both iOS and Android
- Apple Sign-In button successfully authenticates users on iOS and Android
- OAuth users bypass email confirmation (since provider verifies email)
- Accounts are automatically linked when same email is detected
- Users can link both Google and Apple to the same account
- Profile completion prompt appears after first OAuth login
- OAuth authentication data is securely stored in Supabase database
- 95%+ of OAuth authentication attempts complete successfully
- Feature works consistently across all supported grade levels
- UI matches existing design system and is intuitive

## User Stories

### Core User Stories

**As a** new user  
**I want to** sign up using my Google account  
**So that** I can quickly create an account without entering a password

**As a** new user  
**I want to** sign up using my Apple ID  
**So that** I can use my existing Apple account for authentication

**As a** returning user  
**I want to** sign in using Google or Apple  
**So that** I don't have to remember my password

**As a** user who signed up with email/password  
**I want to** sign in with Google/Apple using the same email  
**So that** my accounts are automatically linked and I can use either method

**As a** user who signed up with Google/Apple  
**I want to** complete my profile after first login  
**So that** the app can personalize my experience

### Additional User Stories

- **As a user**, I want to link both Google and Apple to my account so I can use either provider
- **As a user**, I want OAuth sign-in to work seamlessly so I don't experience authentication errors
- **As a user**, I want my OAuth authentication to be secure so my account information is protected
- **As a user**, I want to see clear OAuth buttons so I know what authentication options are available
- **As a user**, I want OAuth to work on both iOS and Android so I can use it on any device

## Functional Requirements

### Google OAuth Sign-In

1. **Authentication Flow**

   - Display "Continue with Google" button on login/signup screen
   - Button should be placed below the email/password form
   - On tap, initiate Google OAuth flow via Supabase
   - Handle OAuth callback and create/authenticate user session
   - Extract user email from Google account
   - Store authentication data securely in Supabase

2. **Account Creation/Linking**

   - If email doesn't exist: Create new user account with Google provider
   - If email exists with email/password: Automatically link Google provider to existing account
   - If email exists with different OAuth provider: Link Google provider to existing account
   - Store provider information in Supabase auth metadata

3. **Profile Handling**

   - For new users: Prompt for profile completion (username, grade level, display name)
   - For existing users: Load existing profile
   - Extract available information from Google (name, email, profile picture if available)
   - Pre-fill profile fields where possible

4. **Email Confirmation**
   - Bypass email confirmation for OAuth users (Google verifies email)
   - Set `email_confirmed_at` automatically upon successful OAuth authentication

### Apple Sign-In

1. **Authentication Flow**

   - Display "Continue with Apple" button on login/signup screen
   - Button should be placed below the email/password form (below Google button)
   - On tap, initiate Apple Sign In flow via Supabase
   - Handle OAuth callback and create/authenticate user session
   - Extract user email from Apple account
   - Handle Apple's private relay email if user chooses to hide email
   - Store authentication data securely in Supabase

2. **Account Creation/Linking**

   - If email doesn't exist: Create new user account with Apple provider
   - If email exists with email/password: Automatically link Apple provider to existing account
   - If email exists with different OAuth provider: Link Apple provider to existing account
   - Store provider information in Supabase auth metadata
   - Handle Apple private relay email mapping if needed

3. **Profile Handling**

   - For new users: Prompt for profile completion (username, grade level, display name)
   - For existing users: Load existing profile
   - Extract available information from Apple (name, email)
   - Pre-fill profile fields where possible

4. **Email Confirmation**

   - Bypass email confirmation for OAuth users (Apple verifies email)
   - Set `email_confirmed_at` automatically upon successful OAuth authentication

5. **Platform Support**
   - iOS: Use native Apple Sign In SDK
   - Android: Use web-based Apple Sign In (if available) or provide alternative

### Account Linking Logic

1. **Email Matching**

   - When OAuth authentication succeeds, check if email already exists in Supabase
   - If email exists: Link the new provider to existing account
   - If email doesn't exist: Create new account with OAuth provider
   - Handle case-insensitive email matching

2. **Multiple Provider Support**

   - Allow users to link both Google and Apple to same account
   - Store all linked providers in Supabase auth metadata
   - Users can sign in with any linked provider
   - Display linked providers in user profile (optional future enhancement)

3. **Conflict Resolution**
   - If email exists but account is locked/suspended: Show appropriate error
   - If linking fails due to provider conflict: Show user-friendly error message
   - Log all account linking attempts for security auditing

### Profile Completion Flow

1. **First-Time OAuth Users**

   - After successful OAuth authentication, check if profile exists
   - If no profile: Show profile completion screen/modal
   - Collect required fields: username, grade level, display name (optional)
   - Pre-fill display name from OAuth provider if available
   - Validate username availability
   - Save profile to `user_profiles` table

2. **Returning OAuth Users**
   - Load existing profile from database
   - If profile incomplete: Show profile completion prompt
   - Allow users to skip and complete later (with reminders)

### UI/UX Requirements

1. **Button Design**

   - Google button: White background, Google logo on left, "Continue with Google" text
   - Apple button: White background (or black on dark mode), Apple logo on left, "Continue with Apple" text
   - Buttons should match existing design system (rounded corners, proper spacing)
   - Buttons should be full-width and match email/password form width
   - Add visual separator (e.g., "or" divider) between email form and OAuth buttons

2. **Placement**

   - OAuth buttons appear below the email/password form
   - Google button appears first, Apple button below it
   - Maintain consistent spacing with other form elements

3. **Loading States**

   - Show loading indicator during OAuth flow
   - Disable buttons during authentication
   - Display appropriate error messages if authentication fails

4. **Error Handling**
   - Show user-friendly error messages for authentication failures
   - Handle network errors gracefully
   - Provide fallback to email/password authentication
   - Log errors for debugging and monitoring

### Security Requirements

1. **Data Security**

   - All OAuth tokens stored securely in Supabase
   - Never store OAuth credentials in app storage
   - Use Supabase's built-in OAuth security features
   - Follow OAuth 2.0 best practices

2. **Account Security**

   - Verify email ownership through OAuth provider
   - Implement rate limiting on authentication attempts
   - Monitor for suspicious authentication patterns
   - Support account recovery through linked providers

3. **Privacy Compliance**
   - Comply with COPPA/FERPA requirements
   - Only request necessary permissions from OAuth providers
   - Clearly communicate data usage to users
   - Allow users to unlink OAuth providers (future enhancement)

## Technical Requirements

### Supabase Configuration

1. **OAuth Provider Setup**

   - Configure Google OAuth in Supabase dashboard
   - Configure Apple OAuth in Supabase dashboard
   - Set up redirect URLs for both iOS and Android
   - Configure OAuth scopes (email, profile)

2. **Database Schema**
   - No schema changes required (Supabase auth handles OAuth)
   - Ensure `user_profiles` table supports OAuth users
   - Store provider information in Supabase auth metadata

### React Native Implementation

1. **Dependencies**

   - Use Supabase's built-in OAuth support
   - For Apple Sign In: Use `@react-native-async-storage/async-storage` (already installed)
   - For Google Sign In: May need `@react-native-google-signin/google-signin` or use Supabase web flow
   - Use `expo-web-browser` or `react-native-inappbrowser-reborn` for OAuth web flows

2. **Authentication Methods**

   - `supabase.auth.signInWithOAuth({ provider: 'google' })`
   - `supabase.auth.signInWithOAuth({ provider: 'apple' })`
   - Handle OAuth callbacks via deep linking
   - Update existing `AuthContext` to support OAuth methods

3. **Deep Linking**
   - Configure deep links for OAuth callbacks
   - Handle OAuth redirects in `App.tsx` or navigation
   - Parse OAuth tokens from callback URLs

### Platform-Specific Requirements

1. **iOS**

   - Configure Apple Sign In capability in Xcode
   - Add Apple Sign In to `Info.plist` if needed
   - Test on iOS 13+ (minimum for Apple Sign In)
   - Handle Apple Sign In native flow

2. **Android**
   - Configure Google Sign In in `build.gradle`
   - Add SHA-1 fingerprint to Google OAuth console
   - Configure deep links in `AndroidManifest.xml`
   - Test on Android 5.0+ (API level 21+)

## User Experience Flow

### Google Sign-In Flow

1. User taps "Continue with Google" button
2. App initiates Google OAuth flow (web browser or native)
3. User authenticates with Google
4. Google redirects back to app with authentication token
5. App exchanges token with Supabase
6. Supabase creates/updates user account
7. App checks if profile exists
8. If no profile: Show profile completion screen
9. If profile exists: Navigate to main app
10. User is signed in and ready to use app

### Apple Sign-In Flow

1. User taps "Continue with Apple" button
2. App initiates Apple Sign In flow (native on iOS, web on Android)
3. User authenticates with Apple ID
4. Apple returns authentication token
5. App exchanges token with Supabase
6. Supabase creates/updates user account
7. App checks if profile exists
8. If no profile: Show profile completion screen
9. If profile exists: Navigate to main app
10. User is signed in and ready to use app

### Account Linking Flow

1. User signs in with Google/Apple using email that already exists
2. Supabase detects existing account with same email
3. System automatically links OAuth provider to existing account
4. User can now sign in with either email/password or OAuth
5. No additional user action required

## Error Handling

1. **OAuth Authentication Failures**

   - Network errors: Show "Connection error. Please try again."
   - User cancellation: Silently return to login screen
   - Provider errors: Show "Authentication failed. Please try again or use email/password."
   - Invalid credentials: Show appropriate error message

2. **Account Linking Failures**

   - Email mismatch: Show "This email is already associated with another account."
   - Provider conflict: Show "Unable to link account. Please contact support."
   - Database errors: Log error and show generic error message

3. **Profile Creation Failures**
   - Username taken: Show "Username is already taken. Please choose another."
   - Validation errors: Show specific field validation errors
   - Database errors: Show "Unable to save profile. Please try again."

## Testing Requirements

### Unit Tests

- Test OAuth authentication methods in `AuthContext`
- Test account linking logic
- Test profile creation for OAuth users
- Test email matching logic

### Integration Tests

- Test Google OAuth flow end-to-end
- Test Apple OAuth flow end-to-end
- Test account linking scenarios
- Test profile completion flow

### Manual Testing

- Test on iOS devices (various versions)
- Test on Android devices (various versions)
- Test with existing email/password accounts
- Test with new OAuth accounts
- Test account linking with same email
- Test profile completion after OAuth sign-in
- Test error scenarios (network failures, user cancellation)

## Success Metrics

- **Adoption Rate**: 30%+ of new sign-ups use OAuth within first month
- **Completion Rate**: 90%+ of OAuth sign-ups complete profile setup
- **Error Rate**: <5% of OAuth attempts result in errors
- **User Satisfaction**: Positive feedback on authentication speed and convenience
- **Account Linking**: 80%+ of account linking attempts succeed automatically

## Future Enhancements (Out of Scope)

- Display linked providers in user profile settings
- Allow users to unlink OAuth providers
- Support additional OAuth providers (Facebook, Microsoft, etc.)
- OAuth provider switching in settings
- Enhanced profile pre-filling from OAuth data
- OAuth-based password recovery

## Dependencies

- Supabase OAuth configuration (backend setup required)
- Google OAuth credentials (Google Cloud Console setup)
- Apple Developer account setup (for Apple Sign In)
- Deep linking configuration for OAuth callbacks
- React Native OAuth libraries (if needed beyond Supabase)

## Risks & Mitigation

1. **Risk**: OAuth provider changes or deprecation

   - **Mitigation**: Use Supabase's abstraction layer, monitor provider updates

2. **Risk**: Account linking conflicts

   - **Mitigation**: Implement robust email matching and conflict resolution

3. **Risk**: Platform-specific OAuth implementation differences

   - **Mitigation**: Test thoroughly on both platforms, use platform-specific code where needed

4. **Risk**: User confusion with multiple authentication methods
   - **Mitigation**: Clear UI design, helpful error messages, user education

## Acceptance Criteria

- [ ] Google Sign-In button appears below email/password form
- [ ] Apple Sign-In button appears below Google button
- [ ] Both buttons work on iOS and Android
- [ ] OAuth authentication creates new accounts successfully
- [ ] OAuth authentication signs in existing users successfully
- [ ] Accounts are automatically linked when same email is used
- [ ] Users can link both Google and Apple to same account
- [ ] OAuth users bypass email confirmation
- [ ] Profile completion prompt appears after first OAuth login
- [ ] All authentication data stored securely in Supabase
- [ ] Error handling works for all failure scenarios
- [ ] UI matches existing design system
- [ ] Feature tested on both iOS and Android
- [ ] Documentation updated with OAuth setup instructions
