# PRD: Migrate Email/Password Users to Clerk Authentication

## Introduction

Migrate all email/password authentication from Supabase to Clerk, unifying all users (OAuth and email/password) under a single authentication provider. This eliminates the dual-auth architecture, removes `isClerkUserId()` checks scattered across 5+ service files, and simplifies the codebase to a single, maintainable authentication flow.

**Current State:**

- OAuth users (Google/Apple): Clerk auth → Convex database
- Email/password users: Supabase auth → Supabase database
- `isClerkUserId()` checks route users to correct backend

**Target State:**

- ALL users: Clerk auth → Convex database
- Single, unified authentication flow
- No dual-backend routing logic

## Goals

- Enable Clerk email/password authentication for new users
- Provide seamless migration path for existing Supabase email/password users
- Preserve all user data during migration (profiles, stats, game sessions)
- Achieve 100% user migration to Clerk
- Maintain zero auth disruption during transition
- Remove all `isClerkUserId()` checks and Supabase auth fallback code
- Implement admin tooling to track migration progress
- Complete dual-support period when 95%+ users have migrated

## User Stories

### Phase 1: Clerk Dashboard Configuration

#### US-001: Configure Clerk Email/Password Authentication ✅ COMPLETED

**Description:** As an administrator, I need to enable email/password authentication in Clerk so users can sign up and sign in with email credentials.

**Completion Date:** 2026-02-24

**Acceptance Criteria:**

- [x] Clerk Dashboard: Enable "Email address" as identifier under User & Authentication
- [x] Clerk Dashboard: Enable "Password" authentication method
- [x] Password policy configured: min 8 characters, mixed case, numbers
- [x] Email verification enabled (code-based for mobile UX)
- [x] Verification email template customized with CreativeBridge branding
- [x] Password reset email template customized with CreativeBridge branding
- [x] Test email delivery works in development environment

---

### Phase 2: Implement Clerk Email/Password Auth

#### US-002: Implement Clerk Email/Password Sign-Up ✅ COMPLETED

**Description:** As a new user, I want to sign up with my email and password so I can create an account without using OAuth providers.

**Completion Date:** 2026-02-24

**Implementation Notes:**

- Added `PendingClerkProfile` interface for storing profile data during verification
- Added `PENDING_CLERK_PROFILE_KEY` constant for AsyncStorage
- Implemented `signUpWithClerk()` function using Clerk's `useSignUp` hook
- Uses `email_code` verification strategy for mobile-friendly UX
- Includes user-friendly error messages for common Clerk errors (duplicate email, weak password, rate limiting)

**Acceptance Criteria:**

- [x] Add `signUpWithClerk(email, password, profileData)` function to `AuthContext.tsx`
- [x] Function creates Clerk sign-up with email and password
- [x] Function triggers email verification code flow
- [x] Pending profile data stored in AsyncStorage for post-verification
- [x] Function returns `{ needsVerification: true }` on success
- [x] Function returns `{ error: string }` on failure with descriptive message
- [x] Typecheck passes

#### US-003: Implement Email Verification Flow ✅ COMPLETED

**Description:** As a user signing up, I want to verify my email with a code so I can complete my account creation.

**Completion Date:** 2026-02-24

**Implementation Notes:**

- Added `verifyEmailCode(code)` function using Clerk's `attemptEmailAddressVerification` API
- 5-step flow: verify code → activate session → retrieve pending profile → create Convex profile → clear AsyncStorage
- Graceful degradation: if pending profile is missing, session still activates (profile can be created later)
- User-friendly error messages for invalid codes, expired codes, and rate limiting
- Uses existing `convexCreateProfile` mutation (idempotent — safe against race conditions)

**Acceptance Criteria:**

- [x] Add `verifyEmailCode(code)` function to `AuthContext.tsx`
- [x] Function verifies 6-digit code against Clerk
- [x] On success: activates Clerk session
- [x] On success: retrieves pending profile from AsyncStorage
- [x] On success: creates Convex profile via `createOAuthProfile` mutation
- [x] On success: clears pending profile from AsyncStorage
- [x] Function returns empty object `{}` on success
- [x] Function returns `{ error: string }` on invalid code
- [x] Typecheck passes

#### US-004: Add Email Verification UI ✅ COMPLETED

**Description:** As a user, I want to see a verification code input screen after signing up so I can complete the verification process.

**Completion Date:** 2026-02-24

**Implementation Notes:**

- Added `showVerificationInput`, `verificationCode`, `verificationError`, `verifyingCode`, `resendingCode` states to `AuthScreen.tsx`
- Modified `proceedWithAuth()` to call `signUpWithClerk()` for sign-ups instead of Supabase `signUp()`
- Built dedicated verification code screen with centered 6-digit numeric input (`textContentType="oneTimeCode"` for iOS autofill)
- Added `resendClerkVerificationCode()` function to `AuthContext.tsx` that re-calls `signUp.prepareEmailAddressVerification({ strategy: 'email_code' })`
- Verification success automatically navigates to main app via Clerk session activation (auth state change triggers navigation)
- Input sanitization: only digits allowed, max 6 characters

**Acceptance Criteria:**

- [x] Add `showVerificationInput` state to `AuthScreen.tsx`
- [x] Display 6-digit code input field after sign-up
- [x] "Verify" button calls `verifyEmailCode()` and shows loading state
- [x] "Resend Code" button triggers new verification email
- [x] Back button allows user to restart sign-up process
- [x] Error message displays for invalid codes
- [x] Success navigates to main app
- [x] Typecheck passes
- [ ] Verify in simulator/device: complete sign-up flow with email verification

#### US-005: Implement Clerk Email/Password Sign-In ✅ COMPLETED

**Description:** As a returning user, I want to sign in with my email and password so I can access my account.

**Completion Date:** 2026-02-25

**Implementation Notes:**

- Added `signInWithClerk(email, password)` function using Clerk's `useSignIn` hook via `clerkSignIn` from `useSafeClerkAuth`
- Uses `signIn.create({ identifier, password })` to authenticate, then `setActive({ session })` to activate the session
- Handles Clerk structured error codes: `form_identifier_not_found` → `needsMigration`, `form_password_incorrect` → `Invalid credentials`, `strategy_for_user_invalid` → OAuth-only account message
- Modified existing `signIn()` to try Clerk first, then fall back to Supabase for legacy users
- Supabase fallback returns `{ needsMigration: true }` so UI can prompt migration when US-010 is ready
- AuthScreen `proceedWithAuth()` updated to handle `needsMigration` response (logs for now, migration UI in US-010)

**Acceptance Criteria:**

- [x] Add `signInWithClerk(email, password)` function to `AuthContext.tsx`
- [x] Function attempts Clerk sign-in with credentials
- [x] On success: activates Clerk session, returns empty object `{}`
- [x] On "user not found": returns `{ needsMigration: true }` (for Supabase users)
- [x] On invalid password: returns `{ error: 'Invalid credentials' }`
- [x] Modify existing `signIn()` to try Clerk first
- [x] Typecheck passes

#### US-006: Implement Clerk Password Reset

**Description:** As a user who forgot my password, I want to reset it via email so I can regain access to my account.

**Acceptance Criteria:**

- [ ] Add `resetPasswordWithClerk(email)` function to `AuthContext.tsx`
- [ ] Function triggers Clerk's `reset_password_email_code` strategy
- [ ] Add password reset code verification UI
- [ ] Add new password input UI after code verification
- [ ] Update existing `resetPassword()` to use Clerk
- [ ] Typecheck passes
- [ ] Verify in simulator/device: complete password reset flow

---

### Phase 3: Existing User Migration Flow

#### US-007: Implement Supabase to Clerk Migration Function

**Description:** As a developer, I need a migration function that transfers Supabase email/password users to Clerk while preserving all their data.

**Acceptance Criteria:**

- [ ] Add `migrateFromSupabase(email, password)` function to `AuthContext.tsx`
- [ ] Step 1: Verify credentials against Supabase auth
- [ ] Step 2: Fetch existing Supabase user profile
- [ ] Step 3: Create Clerk account with same email/password
- [ ] Step 4: Create Convex profile via `createOAuthProfile` mutation
- [ ] Step 5: Migrate user stats via new `migrateUserStats` mutation
- [ ] Step 6: Migrate game sessions via new `migrateUserGameSessions` mutation
- [ ] Step 7: Sign out of Supabase
- [ ] Step 8: Activate Clerk session
- [ ] Function returns `{ success: true }` on completion
- [ ] Function returns `{ error: string }` on failure at any step
- [ ] Typecheck passes

#### US-008: Add User Stats Migration Mutation

**Description:** As a developer, I need a Convex mutation to migrate user statistics from Supabase to Convex.

**Acceptance Criteria:**

- [ ] Add `migrateUserStats` mutation to `convex/userProfiles.ts`
- [ ] Accepts: clerkUserId, totalXp, currentStreak, longestStreak, bestScore, totalGamesPlayed, totalStoriesCompleted, totalWordsWritten, lastActivityDate, onboardingCompleted, onboardingProgress
- [ ] Finds profile by clerkUserId
- [ ] Updates profile with all stats fields
- [ ] Throws error if profile not found
- [ ] Typecheck passes
- [ ] Unit test covers success and error cases

#### US-009: Add Game Sessions Migration Mutation

**Description:** As a developer, I need a Convex mutation to migrate game sessions from Supabase to Convex.

**Acceptance Criteria:**

- [ ] Create `convex/migration.ts` with `migrateUserGameSessions` mutation
- [ ] Accepts: clerkUserId and array of session objects
- [ ] Session object includes: completedAt, gradeLevel, finalScore, wordsWritten, sentencesCompleted, challengesCompleted, xpEarned, storyContent, storySource, generatedImageUrl, currentRound, originalCreationDate
- [ ] Finds profile by clerkUserId
- [ ] Inserts all sessions with correct userId and clerkUserId
- [ ] Preserves original creation dates where available
- [ ] Throws error if profile not found
- [ ] Typecheck passes
- [ ] Unit test covers batch insertion

#### US-010: Add Migration Prompt UI

**Description:** As an existing Supabase user, I want to see a clear migration prompt when I try to sign in so I understand what's happening and can complete the migration.

**Acceptance Criteria:**

- [ ] Detect `needsMigration: true` response from sign-in attempt
- [ ] Display banner explaining account upgrade
- [ ] Show benefits of migration (real-time features, unified experience)
- [ ] "Continue Migration" button starts migration flow
- [ ] Progress indicator during migration (profile → stats → sessions)
- [ ] Success message after migration completes
- [ ] Auto-redirect to main app after success
- [ ] Error handling with retry option
- [ ] Typecheck passes
- [ ] Verify in simulator/device: complete migration flow

---

### Phase 4: Service Layer Cleanup

#### US-011: Remove isClerkUserId() from XP Event Tracker

**Description:** As a developer, I want to remove dual-auth code from the XP service so it always uses Convex.

**Acceptance Criteria:**

- [ ] Remove `isClerkUserId()` function from `src/services/xpEventTracker.ts`
- [ ] Remove all `if (isClerkUserId())` conditional branches
- [ ] Keep only Convex code paths
- [ ] Remove Supabase imports if no longer needed
- [ ] Typecheck passes
- [ ] Existing XP tracking tests pass

#### US-012: Remove isClerkUserId() from Onboarding Service

**Description:** As a developer, I want to remove dual-auth code from the onboarding service so it always uses Convex.

**Acceptance Criteria:**

- [ ] Remove `isClerkUserId()` function from `src/services/onboardingService.ts`
- [ ] Remove all `if (isClerkUserId())` conditional branches
- [ ] Keep only Convex code paths
- [ ] Remove Supabase imports if no longer needed
- [ ] Typecheck passes
- [ ] Existing onboarding tests pass

#### US-013: Remove isClerkUserId() from Story Session Manager

**Description:** As a developer, I want to remove dual-auth code from the story session manager so it always uses Convex.

**Acceptance Criteria:**

- [ ] Remove `isClerkUserId()` function from `src/services/storySessionManager.ts`
- [ ] Remove all `if (isClerkUserId())` conditional branches
- [ ] Keep only Convex code paths
- [ ] Remove Supabase imports if no longer needed
- [ ] Typecheck passes
- [ ] Existing story session tests pass

#### US-014: Remove Dual-Write from Story Management Service

**Description:** As a developer, I want to remove dual-write code from the story management service so it only writes to Convex.

**Acceptance Criteria:**

- [ ] Remove `isClerkUserId()` function from `src/services/storyManagementService.ts`
- [ ] Remove dual-write logic that writes to both databases
- [ ] Keep only Convex write paths
- [ ] Remove Supabase imports if no longer needed
- [ ] Typecheck passes
- [ ] Existing story management tests pass

#### US-015: Remove isClerkUserId() from HomeScreen

**Description:** As a developer, I want to remove the dual-auth check from HomeScreen profile loading.

**Acceptance Criteria:**

- [ ] Remove `isClerkUserId()` check from `src/screens/HomeScreen.tsx`
- [ ] Always load profile from Convex via Clerk user ID
- [ ] Remove Supabase profile fallback code
- [ ] Typecheck passes
- [ ] Verify in simulator/device: HomeScreen loads correctly for Clerk user

#### US-016: Remove Supabase Auth from AuthContext

**Description:** As a developer, I want to remove Supabase authentication state management from AuthContext.

**Acceptance Criteria:**

- [ ] Remove Supabase auth state listener from `src/context/AuthContext.tsx`
- [ ] Remove Supabase profile fallback loading
- [ ] Remove Supabase sign-out logic
- [ ] Keep only Clerk authentication flow
- [ ] Remove unused Supabase imports
- [ ] Typecheck passes
- [ ] All auth tests pass

---

### Phase 5: Admin Tooling

#### US-017: Create Migration Progress Dashboard

**Description:** As an administrator, I want to view migration progress so I can track adoption and identify users who haven't migrated.

**Acceptance Criteria:**

- [ ] Create `convex/adminAnalytics.ts` with migration queries
- [ ] Query: `getMigrationStats` returns total Supabase users, migrated count, pending count
- [ ] Query: `getPendingMigrationUsers` returns list of emails/usernames not yet migrated
- [ ] Add admin screen or logging to view these stats
- [ ] Typecheck passes

#### US-018: Add Migration Event Tracking

**Description:** As an administrator, I want migration events tracked so I can analyze the migration funnel.

**Acceptance Criteria:**

- [ ] Add `migrationEvents` table to Convex schema
- [ ] Track events: migration_started, migration_completed, migration_failed
- [ ] Store: timestamp, userId (optional), step (profile/stats/sessions), error (if failed)
- [ ] Add `logMigrationEvent` mutation
- [ ] Call mutation at each migration step in AuthContext
- [ ] Typecheck passes

---

### Phase 6: Testing & Verification

#### US-019: Write Auth Integration Tests

**Description:** As a developer, I want comprehensive tests for the new auth flows so I can verify correctness.

**Acceptance Criteria:**

- [ ] Test: New user sign-up with email verification
- [ ] Test: Sign-in with Clerk email/password
- [ ] Test: Password reset flow
- [ ] Test: Migration flow for Supabase user
- [ ] Test: Handling of invalid verification codes
- [ ] Test: Handling of network errors during migration
- [ ] All tests pass: `npm test -- --testPathPattern=auth`
- [ ] Typecheck passes: `npx tsc --noEmit`

#### US-020: End-to-End Migration Testing

**Description:** As a developer, I want to verify the complete migration path preserves all user data.

**Acceptance Criteria:**

- [ ] Create test Supabase user with profile, stats, and game sessions
- [ ] Execute migration flow
- [ ] Verify Clerk account created
- [ ] Verify Convex profile matches original Supabase profile
- [ ] Verify all stats migrated correctly
- [ ] Verify all game sessions migrated with correct data
- [ ] Verify user can sign in with original password via Clerk
- [ ] Document test results

---

## Functional Requirements

### Authentication

- FR-1: The system must allow new users to sign up with email and password via Clerk
- FR-2: The system must send a 6-digit verification code to the user's email during sign-up
- FR-3: The system must verify the email code before completing account creation
- FR-4: The system must allow existing users to sign in with email and password via Clerk
- FR-5: The system must allow users to reset their password via email code
- FR-6: The system must detect Supabase-only users attempting to sign in and trigger migration flow

### Migration

- FR-7: The system must verify user credentials against Supabase before allowing migration
- FR-8: The system must create a Clerk account with the same email and password during migration
- FR-9: The system must migrate all user profile data (username, displayName, gradeLevel) to Convex
- FR-10: The system must migrate all user statistics (XP, streaks, scores, counts) to Convex
- FR-11: The system must migrate all game sessions to Convex with original timestamps preserved
- FR-12: The system must sign the user out of Supabase after successful migration
- FR-13: The system must activate the new Clerk session after successful migration

### Dual-Support Period

- FR-14: The system must support both Clerk and Supabase authentication during the transition period
- FR-15: The system must display optional migration prompts to Supabase users after login
- FR-16: The system must end dual-support when 95%+ users have migrated

### Cleanup (Post-Migration)

- FR-17: The system must remove all `isClerkUserId()` checks after dual-support period ends
- FR-18: The system must use Convex exclusively for all user operations after cleanup
- FR-19: The system must remove unused Supabase auth imports after cleanup

### Admin Tooling

- FR-20: The system must provide queries to track migration progress (total, migrated, pending)
- FR-21: The system must log migration events for analytics (started, completed, failed)
- FR-22: The system must allow administrators to view list of users pending migration

## Non-Goals (Out of Scope)

- **Automatic forced migration:** Users will not be forced to migrate immediately; they can continue using Supabase auth during dual-support period
- **Supabase password transfer:** Due to password hashing, users must re-enter their password during migration (verified against Supabase first)
- **Social login migration:** OAuth users (Google/Apple) are already on Clerk; this PRD only covers email/password users
- **Supabase database deletion:** Supabase data will be retained as backup; cleanup is a separate effort
- **Mobile push notifications for migration:** No push notifications will be sent; migration prompts are in-app only
- **Batch/automated migration:** Each user must initiate their own migration by signing in
- **Admin ability to force-migrate users:** Admins cannot migrate users without their password

## Technical Considerations

### Dependencies

- Clerk SDK already integrated via `useSafeClerkAuth.ts` hook
- Convex mutations for profile creation already exist (`createOAuthProfile`)
- Need to add new mutations: `migrateUserStats`, `migrateUserGameSessions`

### Email Verification Handling

- Clerk's `email_code` strategy recommended for mobile UX
- Migrating users have already verified via Supabase - consider using Clerk's backend API or `unsafe_metadata` to skip re-verification

### Data Mapping

| Supabase Field            | Convex Field            |
| ------------------------- | ----------------------- |
| `id` (UUID)               | N/A (new `clerkUserId`) |
| `username`                | `username`              |
| `display_name`            | `displayName`           |
| `preferred_grade_level`   | `preferredGradeLevel`   |
| `total_xp`                | `totalXp`               |
| `current_streak`          | `currentStreak`         |
| `longest_streak`          | `longestStreak`         |
| `best_score`              | `bestScore`             |
| `total_games_played`      | `totalGamesPlayed`      |
| `total_stories_completed` | `totalStoriesCompleted` |
| `total_words_written`     | `totalWordsWritten`     |

### Performance

- Game session migration may take time for users with many sessions
- Consider batching in chunks of 50 sessions
- Show progress indicator during migration

### Rollback Strategy

1. Set `AUTH_MODE.DUAL_SUPPORT = true` (keep both working)
2. Disable Clerk email/password in Clerk Dashboard
3. Communicate to users via in-app banner
4. Debug and fix issues
5. Re-enable Clerk email/password

## Success Metrics

- **100% Migration Rate:** All active Supabase email/password users migrated to Clerk
- **Zero Auth Failures:** No users experience login failures during transition
- **Data Integrity:** 100% of user data (profiles, stats, sessions) preserved during migration
- **Code Simplification:** All `isClerkUserId()` checks removed from codebase
- **Dual-Support Exit:** 95%+ users migrated triggers end of dual-support period
- **Migration Time:** Users can complete migration in under 30 seconds

## Implementation Order

1. **Phase 1:** Clerk Dashboard configuration (no code changes)
2. **Phase 2:** Implement Clerk email/password auth (US-002 through US-006)
3. **Phase 3:** Add migration flow and mutations (US-007 through US-010)
4. **Phase 5:** Admin tooling for tracking (US-017, US-018)
5. **Phase 6:** Testing and verification (US-019, US-020)
6. **Dual-Support Period:** Monitor adoption, encourage migration
7. **Phase 4:** Service layer cleanup after 95%+ migration (US-011 through US-016)

## Open Questions

1. **Clerk email verification skip:** Can we use Clerk's backend API to mark migrating users as email-verified since they've already verified via Supabase?
2. **Session migration batching:** What's the optimal batch size for large session migrations to avoid timeouts?
3. **Migration incentive:** Should we offer XP bonus or other incentives for early migration?
4. **Communication strategy:** Should we send email to Supabase users notifying them of upcoming migration requirement?
5. **Supabase data retention:** How long should Supabase data be retained after migration as backup?

## Risks & Mitigations

| Risk                                    | Impact                | Mitigation                                                                   |
| --------------------------------------- | --------------------- | ---------------------------------------------------------------------------- |
| Password not transferable from Supabase | User friction         | User re-enters password during migration (verified against Supabase first)   |
| User confusion during migration         | Support burden        | Clear in-app messaging explaining benefits                                   |
| Data loss during migration              | Critical              | Atomic Convex mutations, verification step, Supabase data retained as backup |
| Large session migration timeout         | Migration failure     | Batch in chunks of 50, show progress indicator                               |
| Clerk requires email re-verification    | User friction         | Investigate Clerk backend API to skip for migrated users                     |
| Low migration adoption                  | Extended dual-support | In-app prompts, optional incentives, eventual forced migration               |

---

## Appendix: Feature Flag Configuration

```typescript
const AUTH_MODE = {
  DUAL_SUPPORT: true, // Both Clerk and Supabase work
  CLERK_ONLY: false, // Only Clerk works (after cutover)
};
```

**End of Dual-Support Procedure:**

1. Query remaining Supabase users
2. Send final migration notification (if email communication decided)
3. Set `AUTH_MODE.CLERK_ONLY = true`
4. Supabase login shows "Account migration required" with migration flow
5. Execute Phase 4 cleanup (remove `isClerkUserId()` checks)
