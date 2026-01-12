# Google and Apple OAuth Sign-In Feature - Product Requirements Document (PRD)

## Overview

**Feature Name:** Google and Apple OAuth Authentication with Clerk + Supabase Integration  
**Priority:** High  
**Target Platform:** iOS and Android  
**Estimated Timeline:** 3-4 weeks

### Architecture Overview

This feature implements a hybrid authentication architecture that combines Clerk's advanced authentication capabilities with Supabase's robust data and backend services:

- **Clerk** handles user sign-in (Google and Apple OAuth) and issues JSON Web Tokens (JWTs)
- **Supabase** verifies the JWT's authenticity by checking it against Clerk's public JWKS (JSON Web Key Set) endpoint
- **Supabase** uses the user's ID from the JWT to apply data access rules via Row-Level Security (RLS), ensuring users can only access their own data
- This architecture leverages Clerk's advanced authentication features (OAuth providers, session management, user management) while maintaining Supabase's powerful data layer and backend services

### Architecture Details

#### Authentication Flow Architecture

1. **Clerk Authentication Layer**

   - User initiates OAuth sign-in (Google or Apple) through Clerk
   - Clerk handles the OAuth flow with the provider (Google/Apple)
   - Upon successful authentication, Clerk creates/updates user account
   - Clerk issues a JWT token containing user information and claims
   - JWT includes Clerk user ID as a custom claim

2. **JWT Verification Layer**

   - App retrieves Clerk JWT token using Clerk's `getToken()` method
   - JWT is sent to Supabase (via Edge Function or direct API call)
   - Supabase fetches Clerk's public keys from Clerk's JWKS endpoint
   - Supabase verifies JWT signature using Clerk's public keys
   - Supabase validates JWT claims (issuer, expiration, etc.)
   - Upon successful verification, Supabase extracts Clerk user ID from JWT claims

3. **Data Access Layer**
   - Supabase uses Clerk user ID from verified JWT for session management
   - All Supabase RLS policies reference Clerk user ID from JWT
   - RLS policies ensure users can only access data associated with their Clerk user ID
   - User profile and application data stored in Supabase tables use Clerk user ID as identifier

#### Benefits of This Architecture

- **Separation of Concerns**: Clerk handles authentication complexity, Supabase handles data storage
- **Security**: JWT verification ensures only authenticated Clerk users can access Supabase data
- **Scalability**: Leverage Clerk's OAuth provider management and Supabase's database capabilities
- **Flexibility**: Can add more OAuth providers through Clerk without changing Supabase configuration
- **Data Integrity**: RLS policies ensure data isolation based on Clerk user identity

## Problem Statement

Currently, users can only sign up and sign in using email and password authentication. This creates barriers for:

- Users who prefer using their existing Google or Apple accounts for faster authentication
- Users who want to avoid creating and remembering another password
- Users who want a more streamlined sign-up process
- Users who may forget their passwords and need alternative authentication methods

The current authentication flow requires users to manually enter email, password, and complete profile information, which can be time-consuming and may lead to user drop-off during the sign-up process.

## Goals & Success Criteria

### Primary Goals

- Enable users to sign up and sign in using Google OAuth via Clerk
- Enable users to sign up and sign in using Apple Sign In via Clerk
- Automatically link accounts when the same email is used across different authentication methods
- Integrate Clerk authentication with Supabase backend using JWT verification
- Leverage Clerk's advanced authentication features while using Supabase for data storage and RLS
- Provide seamless user experience with minimal friction

### Success Criteria

- Google Sign-In button successfully authenticates users on both iOS and Android
- Apple Sign-In button successfully authenticates users on iOS and Android
- OAuth users bypass email confirmation (since provider verifies email)
- Accounts are automatically linked when same email is detected
- Users can link both Google and Apple to the same account
- Profile completion prompt appears after first OAuth login
- Clerk JWT tokens are verified by Supabase against Clerk's JWKS endpoint
- User data access is enforced through Supabase RLS policies using Clerk user IDs
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
   - On tap, initiate Google OAuth flow via Clerk
   - Clerk handles the OAuth flow with Google and issues a JWT token upon successful authentication
   - Extract user email and profile information from Clerk user object
   - Send Clerk JWT to Supabase for verification and session establishment
   - Supabase verifies the JWT against Clerk's public JWKS endpoint
   - Upon verification, Supabase establishes a session using the user ID from the JWT
   - Store user profile data in Supabase `user_profiles` table

2. **Account Creation/Linking**

   - Clerk automatically handles user creation/linking for OAuth providers
   - If email doesn't exist in Clerk: Clerk creates new user account with Google provider
   - If email exists in Clerk: Clerk links Google provider to existing account
   - After Clerk authentication, check if user exists in Supabase `user_profiles` table
   - If user doesn't exist in Supabase: Create new profile record using Clerk user ID
   - If user exists: Update profile with latest information from Clerk
   - Store Clerk user ID as the primary identifier in Supabase for RLS policies

3. **Profile Handling**

   - For new users: Prompt for profile completion (username, grade level, display name)
   - For existing users: Load existing profile from Supabase using Clerk user ID
   - Extract available information from Clerk user object (name, email, profile picture if available)
   - Pre-fill profile fields where possible
   - Store profile data in Supabase with Clerk user ID as foreign key

4. **Email Confirmation**
   - Clerk automatically verifies email through Google OAuth
   - No additional email confirmation step required
   - Clerk user object includes verified email status

### Apple Sign-In

1. **Authentication Flow**

   - Display "Continue with Apple" button on login/signup screen
   - Button should be placed below the email/password form (below Google button)
   - On tap, initiate Apple Sign In flow via Clerk
   - Clerk handles the OAuth flow with Apple and issues a JWT token upon successful authentication
   - Extract user email and profile information from Clerk user object
   - Handle Apple's private relay email if user chooses to hide email (Clerk manages this)
   - Send Clerk JWT to Supabase for verification and session establishment
   - Supabase verifies the JWT against Clerk's public JWKS endpoint
   - Upon verification, Supabase establishes a session using the user ID from the JWT
   - Store user profile data in Supabase `user_profiles` table

2. **Account Creation/Linking**

   - Clerk automatically handles user creation/linking for OAuth providers
   - If email doesn't exist in Clerk: Clerk creates new user account with Apple provider
   - If email exists in Clerk: Clerk links Apple provider to existing account
   - After Clerk authentication, check if user exists in Supabase `user_profiles` table
   - If user doesn't exist in Supabase: Create new profile record using Clerk user ID
   - If user exists: Update profile with latest information from Clerk
   - Store Clerk user ID as the primary identifier in Supabase for RLS policies
   - Handle Apple private relay email mapping through Clerk's user management

3. **Profile Handling**

   - For new users: Prompt for profile completion (username, grade level, display name)
   - For existing users: Load existing profile from Supabase using Clerk user ID
   - Extract available information from Clerk user object (name, email)
   - Pre-fill profile fields where possible
   - Store profile data in Supabase with Clerk user ID as foreign key

4. **Email Confirmation**

   - Clerk automatically verifies email through Apple OAuth
   - No additional email confirmation step required
   - Clerk user object includes verified email status

5. **Platform Support**
   - iOS: Use Clerk's native Apple Sign In integration
   - Android: Use Clerk's web-based Apple Sign In flow

### Account Linking Logic

1. **Email Matching**

   - Clerk handles account linking automatically when same email is used
   - When OAuth authentication succeeds via Clerk, Clerk checks if email already exists
   - If email exists in Clerk: Clerk automatically links the new provider to existing account
   - If email doesn't exist in Clerk: Clerk creates new account with OAuth provider
   - After Clerk authentication, sync user data to Supabase using Clerk user ID
   - Handle case-insensitive email matching (Clerk handles this)

2. **Multiple Provider Support**

   - Clerk allows users to link both Google and Apple to same account
   - Clerk stores all linked providers in user metadata
   - Users can sign in with any linked provider through Clerk
   - Supabase uses the same Clerk user ID regardless of which provider was used
   - Display linked providers in user profile (optional future enhancement)

3. **Conflict Resolution**
   - Clerk handles account conflicts and provides appropriate error messages
   - If account is locked/suspended in Clerk: Show appropriate error from Clerk
   - If linking fails due to provider conflict: Clerk provides user-friendly error message
   - Log all account linking attempts in Clerk dashboard for security auditing
   - Sync account status from Clerk to Supabase for RLS enforcement

### Profile Completion Flow

1. **First-Time OAuth Users**

   - After successful Clerk authentication and Supabase JWT verification, check if profile exists in Supabase
   - Query Supabase `user_profiles` table using Clerk user ID from JWT
   - If no profile: Show profile completion screen/modal
   - Collect required fields: username, grade level, display name (optional)
   - Pre-fill display name from Clerk user object if available
   - Validate username availability in Supabase
   - Save profile to `user_profiles` table with Clerk user ID as the primary identifier

2. **Returning OAuth Users**
   - Load existing profile from Supabase using Clerk user ID from JWT
   - Supabase RLS policies ensure users can only access their own profile data
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

   - Clerk handles OAuth token storage and management securely
   - Clerk JWTs are signed and verified using industry-standard algorithms
   - Never store OAuth credentials or JWTs in app storage (use Clerk's secure storage)
   - Supabase verifies Clerk JWTs against Clerk's public JWKS endpoint before granting access
   - Follow OAuth 2.0 and JWT best practices

2. **Account Security**

   - Clerk verifies email ownership through OAuth providers
   - Clerk implements rate limiting on authentication attempts
   - Clerk monitors for suspicious authentication patterns
   - Support account recovery through linked providers via Clerk
   - Supabase RLS policies enforce data access based on Clerk user ID from verified JWT

3. **JWT Verification & RLS**

   - Supabase must verify Clerk JWTs by fetching public keys from Clerk's JWKS endpoint
   - Configure Supabase to trust Clerk as a JWT issuer
   - Extract Clerk user ID from verified JWT claims
   - Use Clerk user ID in Supabase RLS policies to ensure users can only access their own data
   - Implement proper JWT expiration and refresh handling

4. **Privacy Compliance**
   - Comply with COPPA/FERPA requirements
   - Clerk only requests necessary permissions from OAuth providers
   - Clearly communicate data usage to users
   - Allow users to unlink OAuth providers through Clerk (future enhancement)

## Technical Requirements

### Clerk Configuration

1. **Clerk Setup**

   - Create Clerk application in Clerk dashboard
   - Configure Google OAuth provider in Clerk dashboard
   - Configure Apple Sign In provider in Clerk dashboard
   - Set up redirect URLs for both iOS and Android
   - Configure OAuth scopes (email, profile)
   - Obtain Clerk publishable key and secret key
   - Configure Clerk JWKS endpoint URL for Supabase verification

2. **Clerk Integration**

   - Install `@clerk/clerk-expo` package
   - Wrap app with `ClerkProvider` component (already partially implemented)
   - Use Clerk's `useAuth()` and `useUser()` hooks for authentication state
   - Implement Clerk OAuth methods: `signInWithOAuth()` for Google and Apple
   - Handle OAuth callbacks via Clerk's built-in deep linking support

### Supabase Configuration

1. **JWT Verification Setup**

   - Configure Supabase to accept Clerk as a JWT issuer
   - Set up Supabase to fetch and verify JWTs from Clerk's JWKS endpoint
   - Configure JWT verification settings in Supabase dashboard or via API
   - Map Clerk user ID claim to Supabase user identifier
   - Set up Supabase RLS policies that use Clerk user ID from JWT claims

2. **Database Schema**

   - Ensure `user_profiles` table has a column for Clerk user ID (or use Clerk user ID as primary key)
   - Update RLS policies to reference Clerk user ID from JWT
   - Store Clerk user ID as the primary identifier for user data access
   - No need for Supabase auth table entries (Clerk handles authentication)

3. **Supabase JWT Verification Function**

   - Implement Supabase Edge Function or use Supabase Auth hooks to verify Clerk JWTs
   - Fetch Clerk's public keys from JWKS endpoint
   - Verify JWT signature and claims
   - Extract Clerk user ID from verified JWT
   - Create Supabase session using Clerk user ID

### React Native Implementation

1. **Dependencies**

   - Install `@clerk/clerk-expo` for Clerk integration
   - Use existing `@supabase/supabase-js` for Supabase client
   - For Apple Sign In: Clerk handles native integration
   - For Google Sign In: Clerk handles OAuth flow
   - Use `expo-web-browser` for OAuth web flows (if needed by Clerk)

2. **Authentication Methods**

   - Use Clerk's `signInWithOAuth({ strategy: 'oauth_google' })` for Google
   - Use Clerk's `signInWithOAuth({ strategy: 'oauth_apple' })` for Apple
   - After Clerk authentication, get JWT token using `getToken()`
   - Send Clerk JWT to Supabase for verification and session creation
   - Update existing `AuthContext` to integrate Clerk authentication with Supabase data access

3. **JWT Token Exchange**

   - After successful Clerk authentication, retrieve JWT using `await clerkAuth.getToken()`
   - Send JWT to Supabase backend (via Edge Function or direct API call)
   - Supabase verifies JWT and creates session
   - Store Supabase session for subsequent API calls
   - Include Clerk JWT in Supabase API requests for RLS enforcement

4. **Deep Linking**
   - Clerk handles OAuth redirects automatically
   - Configure deep links in Clerk dashboard
   - Handle Clerk OAuth callbacks in app navigation

### Platform-Specific Requirements

1. **iOS**

   - Clerk handles Apple Sign In capability configuration
   - Configure Clerk iOS SDK settings
   - Test on iOS 13+ (minimum for Apple Sign In)
   - Clerk manages native Apple Sign In flow

2. **Android**
   - Clerk handles Google Sign In configuration
   - Add SHA-1 fingerprint to Clerk dashboard (Clerk manages Google OAuth)
   - Configure deep links in `AndroidManifest.xml` for Clerk callbacks
   - Test on Android 5.0+ (API level 21+)

### Supabase RLS Policy Configuration

1. **Row-Level Security Setup**

   - Create RLS policies that extract Clerk user ID from JWT claims
   - Example policy: `auth.uid() = (jwt->>'clerk_user_id')::uuid`
   - Ensure all user data tables have RLS enabled
   - Test RLS policies with Clerk JWT tokens
   - Verify users can only access their own data

2. **JWT Claims Mapping**

   - Configure Supabase to read Clerk user ID from JWT custom claims
   - Map Clerk user ID to Supabase user identifier in RLS policies
   - Ensure JWT verification function extracts correct user ID claim

## User Experience Flow

### Google Sign-In Flow

1. User taps "Continue with Google" button
2. App initiates Google OAuth flow via Clerk
3. Clerk handles OAuth flow (web browser or native)
4. User authenticates with Google
5. Google redirects back to Clerk
6. Clerk issues JWT token upon successful authentication
7. App retrieves Clerk JWT token using `getToken()`
8. App sends Clerk JWT to Supabase for verification
9. Supabase verifies JWT against Clerk's JWKS endpoint
10. Supabase extracts Clerk user ID from verified JWT
11. Supabase creates/updates user session using Clerk user ID
12. App checks if profile exists in Supabase using Clerk user ID
13. If no profile: Show profile completion screen
14. If profile exists: Navigate to main app
15. User is signed in and ready to use app
16. Subsequent Supabase API calls include Clerk JWT for RLS enforcement

### Apple Sign-In Flow

1. User taps "Continue with Apple" button
2. App initiates Apple Sign In flow via Clerk
3. Clerk handles OAuth flow (native on iOS, web on Android)
4. User authenticates with Apple ID
5. Apple returns authentication token to Clerk
6. Clerk issues JWT token upon successful authentication
7. App retrieves Clerk JWT token using `getToken()`
8. App sends Clerk JWT to Supabase for verification
9. Supabase verifies JWT against Clerk's JWKS endpoint
10. Supabase extracts Clerk user ID from verified JWT
11. Supabase creates/updates user session using Clerk user ID
12. App checks if profile exists in Supabase using Clerk user ID
13. If no profile: Show profile completion screen
14. If profile exists: Navigate to main app
15. User is signed in and ready to use app
16. Subsequent Supabase API calls include Clerk JWT for RLS enforcement

### Account Linking Flow

1. User signs in with Google/Apple using email that already exists
2. Clerk detects existing account with same email
3. Clerk automatically links OAuth provider to existing account
4. Clerk issues JWT with same user ID regardless of provider used
5. App sends Clerk JWT to Supabase
6. Supabase verifies JWT and uses Clerk user ID for data access
7. User can now sign in with any linked provider through Clerk
8. Supabase uses same Clerk user ID for RLS, ensuring consistent data access
9. No additional user action required

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

### Clerk Setup

- Clerk account and application creation
- Clerk publishable key and secret key
- Google OAuth credentials configured in Clerk dashboard
- Apple Developer account setup configured in Clerk dashboard
- Clerk JWKS endpoint URL for Supabase verification
- Deep linking configuration in Clerk dashboard for OAuth callbacks

### Supabase Setup

- Supabase project with JWT verification configured
- Supabase Edge Function or API endpoint for Clerk JWT verification
- Supabase RLS policies configured to use Clerk user ID from JWT
- Database schema updated to use Clerk user ID as identifier

### React Native Dependencies

- `@clerk/clerk-expo` package (Clerk React Native SDK)
- `@supabase/supabase-js` package (already installed)
- `expo-web-browser` (for OAuth flows, if needed)

## Risks & Mitigation

1. **Risk**: OAuth provider changes or deprecation

   - **Mitigation**: Clerk handles OAuth provider abstraction, monitor Clerk updates

2. **Risk**: Account linking conflicts

   - **Mitigation**: Clerk handles account linking automatically, implement fallback error handling

3. **Risk**: JWT verification failures between Clerk and Supabase

   - **Mitigation**: Implement robust JWT verification with proper error handling, cache JWKS keys, implement retry logic

4. **Risk**: RLS policy misconfiguration leading to data access issues

   - **Mitigation**: Thoroughly test RLS policies with Clerk JWTs, implement comprehensive test coverage, monitor access logs

5. **Risk**: Platform-specific OAuth implementation differences

   - **Mitigation**: Clerk handles platform differences, test thoroughly on both platforms

6. **Risk**: User confusion with multiple authentication methods

   - **Mitigation**: Clear UI design, helpful error messages, user education

7. **Risk**: Clerk JWT expiration causing session interruptions
   - **Mitigation**: Implement JWT refresh logic, handle token expiration gracefully, use Clerk's session management features

## Acceptance Criteria

- [ ] Google Sign-In button appears below email/password form
- [ ] Apple Sign-In button appears below Google button
- [ ] Both buttons work on iOS and Android
- [ ] Clerk handles OAuth authentication with Google and Apple
- [ ] Clerk issues JWT tokens upon successful authentication
- [ ] Supabase verifies Clerk JWTs against Clerk's JWKS endpoint
- [ ] Supabase extracts Clerk user ID from verified JWT
- [ ] Supabase RLS policies enforce data access using Clerk user ID
- [ ] OAuth authentication creates new accounts successfully in Clerk
- [ ] User profiles are created/updated in Supabase using Clerk user ID
- [ ] OAuth authentication signs in existing users successfully
- [ ] Accounts are automatically linked when same email is used (via Clerk)
- [ ] Users can link both Google and Apple to same account (via Clerk)
- [ ] OAuth users bypass email confirmation (handled by Clerk)
- [ ] Profile completion prompt appears after first OAuth login
- [ ] All authentication handled securely by Clerk
- [ ] User data access enforced through Supabase RLS with Clerk user ID
- [ ] JWT token refresh works correctly
- [ ] Error handling works for all failure scenarios (Clerk auth, JWT verification, Supabase access)
- [ ] UI matches existing design system
- [ ] Feature tested on both iOS and Android
- [ ] Documentation updated with Clerk + Supabase integration setup instructions
