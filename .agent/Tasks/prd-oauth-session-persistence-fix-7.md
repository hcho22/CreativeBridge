# PRD: OAuth Session Persistence Bug - Ultimate Fix #7

## Introduction

Fix the OAuth session persistence bug where, after User A logs out, User B's OAuth sign-up reactivates User A's session instead of creating a new account. This bug persists despite previous fixes (#5 and #6) because of a race condition in Clerk's internal token re-write mechanism. The root cause is that Clerk's `__unstable__onAfterResponse` callback writes tokens back AFTER our cleanup code runs.

## Goals

- Eliminate the OAuth session persistence bug completely across all edge cases
- Implement proper token cleanup that accounts for Clerk's async internal callbacks
- Add verification that tokens are actually deleted (not just assumed deleted)
- Provide graceful user guidance when OS-level OAuth sessions cannot be cleared programmatically
- Ensure the fix handles app backgrounding, restarts, and rapid login/logout cycles

## User Stories

### US-001: Implement `clearToken` Method in TokenCache ✅

**Description:** As a developer, I need the tokenCache to implement Clerk's `clearToken` interface method so that Clerk's internal hot-swap mechanism can properly clear tokens.

**Acceptance Criteria:**

- [x] Add `clearToken(key: string): void` method to `clerkTokenCache` object
- [x] Method removes the key from the `tokenKeys` Set
- [x] Method calls `SecureStore.deleteItemAsync()` (fire-and-forget per Clerk interface)
- [x] Method logs the clear operation for debugging
- [x] Typecheck passes

### US-002: Add Token Deletion Verification Function ✅

**Description:** As a developer, I need a function that verifies tokens are actually deleted from SecureStore, with retry logic, so that silent deletion failures don't leave stale tokens.

**Acceptance Criteria:**

- [x] Create `clearAndVerifyTokens(maxAttempts?: number): Promise<boolean>` function
- [x] Function calls `clearAllClerkTokens()` then verifies the main token is gone
- [x] If token still exists, retry deletion up to `maxAttempts` times (default 5)
- [x] Wait 100ms between retry attempts
- [x] Return `true` if verified deleted, `false` if verification fails
- [x] Log verification status for debugging
- [x] Typecheck passes

### US-003: Extend Token Key List for Comprehensive Clearing ✅

**Description:** As a developer, I need to clear all possible Clerk cache keys (including A/B slot storage) so that partial cleanup doesn't leave session data behind.

**Acceptance Criteria:**

- [x] Update `ALL_CLERK_KEYS` constant to include Clerk's internal cache keys
- [x] Include: `__clerk_client_jwt` (primary), legacy keys, and A/B slot keys
- [x] A/B slot keys: `clerk-js-session-jwt-latest`, `*-A-metadata`, `*-B-metadata` variants
- [x] `clearAllClerkTokens()` attempts to delete all keys in the extended list
- [x] Typecheck passes

### US-004: Add Mutex Lock for Concurrent Token Operations ✅

**Description:** As a developer, I need to prevent race conditions when multiple `clearAllClerkTokens()` calls happen concurrently so that parallel clears don't interfere with each other.

**Acceptance Criteria:**

- [x] Add `clearingInProgress` module-level boolean flag
- [x] `clearAllClerkTokens()` checks flag before starting
- [x] If clearing is in progress, wait 200ms and return (assume other operation succeeds)
- [x] Flag is set in try block, cleared in finally block
- [x] Typecheck passes

### US-005: Reorder Logout Flow - Clear Tokens AFTER signOut ✅

**Description:** As a user, I need logout to clear tokens AFTER Clerk's signOut completes so that Clerk's `onAfterResponse` callback doesn't re-write tokens after cleanup.

**Acceptance Criteria:**

- [x] `signOut()` calls `clerkAuth.signOut()` FIRST
- [x] Wait 200ms for Clerk's async callbacks to complete
- [x] THEN call `clearAndVerifyTokens()`
- [x] If verification fails, call `clearAndVerifyTokens()` again
- [x] Store `__previous_clerk_user_id` and `__previous_logout_timestamp` in AsyncStorage before clearing
- [x] Clear `lastSyncedClerkUserId.current` ref during logout
- [x] Typecheck passes

### US-006: Enhanced Pre-OAuth Cleanup with Verification ✅

**Description:** As a user signing in via OAuth, I need the app to thoroughly clean up any stale sessions before starting the OAuth flow so that I don't get logged into a previous user's account.

**Acceptance Criteria:**

- [x] Pre-OAuth check calls `hasClerkTokens()` to detect stale sessions
- [x] If stale session detected, call `clerkAuth.signOut()` FIRST
- [x] Wait 300ms for async callbacks
- [x] Call `clearAndVerifyTokens()`
- [x] Double-check with `hasClerkTokens()` - if tokens reappeared, clear again
- [x] Call `clerkTokenCache.clearToken('__clerk_client_jwt')` directly
- [x] Applies to both `signInWithGoogle` and `signInWithApple`
- [x] Typecheck passes

### US-007: Atomic Logout Flag for App Backgrounding ✅

**Description:** As a user, I need logout to complete fully even if the app is backgrounded during the process so that interrupted logouts don't leave me in a partial state.

**Acceptance Criteria:**

- [x] Set `__logout_in_progress` in AsyncStorage at start of signOut
- [x] Remove `__logout_in_progress` in finally block of signOut
- [x] On AuthContext initialization, check for `__logout_in_progress`
- [x] If found, call `clearAndVerifyTokens()` and remove the flag
- [x] Log when completing interrupted logout
- [x] Typecheck passes

### US-008: Strengthen Auth State Listener Guard ✅

**Description:** As a developer, I need the auth state listener to ignore state changes during logout so that the listener doesn't re-sync user data mid-logout.

**Acceptance Criteria:**

- [x] Auth state listener checks `isSigningOut.current` and returns early if true
- [x] Auth state listener also checks AsyncStorage for `__logout_in_progress` flag
- [x] If either flag is set, skip processing the auth state change
- [x] Log when skipping due to logout in progress
- [x] Typecheck passes

### US-009: Create OAuth Session Help Modal Component ✅

**Description:** As a user who encounters a stale OS-level OAuth session, I need clear instructions on how to sign out at the system level so that I can sign in with a different account.

**Acceptance Criteria:**

- [x] Create `OAuthSessionHelpModal.tsx` in `src/components/common/`
- [x] Accept props: `visible`, `onClose`, `provider` ('google' | 'apple')
- [x] For Google: Show instructions to sign out from google.com in Safari/Chrome
- [x] For Apple: Show instructions to go to Settings > Apple ID > Sign Out
- [x] Include "Try Again" button that calls `onClose`
- [x] Use appropriate styling consistent with app design
- [x] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-010: Integrate Help Modal into Login Screen ✅

**Description:** As a user, I need the help modal to appear automatically when OAuth fails due to a stale session so that I know how to resolve the issue.

**Acceptance Criteria:**

- [x] Import and render `OAuthSessionHelpModal` in `LoginScreen.tsx`
- [x] Track `showSessionHelp` and `helpProvider` state
- [x] When OAuth returns error with `showSessionHelp: true`, show the modal
- [x] Pass the correct provider ('google' or 'apple') to the modal
- [x] Modal dismissal clears the state and allows retry
- [x] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-011: Update OAuth Functions to Return Help Dialog Trigger ✅

**Description:** As a developer, I need the OAuth functions to return structured data indicating when to show the help dialog so that the UI can respond appropriately.

**Acceptance Criteria:**

- [x] Update `signInWithGoogle` return type to include `showSessionHelp?: boolean` and `provider?: 'google' | 'apple'`
- [x] Update `signInWithApple` return type similarly
- [x] When stale session is detected and cannot be cleared, return `{ error: '...', showSessionHelp: true, provider: 'google' }` (or 'apple')
- [x] Existing error-only return paths continue to work
- [x] Typecheck passes

## Functional Requirements

- FR-1: The tokenCache must implement `clearToken(key)` method per Clerk's interface
- FR-2: Token deletion must be verified by reading back from SecureStore after deletion
- FR-3: Token clearing must include Clerk's A/B slot cache keys, not just primary JWT key
- FR-4: Concurrent `clearAllClerkTokens()` calls must not race (use mutex)
- FR-5: Logout must call Clerk signOut BEFORE clearing tokens to avoid `onAfterResponse` re-write
- FR-6: Pre-OAuth cleanup must signOut first, wait for callbacks, then clear and verify tokens
- FR-7: Pre-OAuth cleanup must re-check for token reappearance and clear again if needed
- FR-8: Logout state must persist to AsyncStorage to survive app backgrounding
- FR-9: Auth state listener must ignore changes while logout is in progress
- FR-10: Help modal must show provider-specific instructions for OS-level signout
- FR-11: OAuth functions must return help dialog trigger when stale session cannot be cleared

## Non-Goals

- No changes to Clerk SDK source code or forking the SDK
- No automatic clearing of OS-level Google/Apple sessions (not technically possible)
- No changes to the 60-second rule for legitimate re-login detection
- No refactoring of unrelated authentication code
- No changes to Supabase authentication flow

## Technical Considerations

- **Clerk SDK Version:** Current implementation based on `@clerk/clerk-expo` - verify interface compatibility
- **expo-secure-store:** Deletion verification needed because `deleteItemAsync` can fail silently on iOS
- **Race Conditions:** `__unstable__onAfterResponse` callback is async and can fire after our code continues
- **A/B Slot Storage:** Clerk uses chunked storage for large tokens - must clear both slots
- **AsyncStorage:** Used for persisting logout state; ensure it doesn't conflict with other app state

### Key Files

- `src/utils/clerkTokenCache.ts` - Token cache implementation
- `src/context/AuthContext.tsx` - Auth state and OAuth flows
- `src/components/common/OAuthSessionHelpModal.tsx` - New component
- `src/screens/auth/LoginScreen.tsx` - Integrate help modal

### Root Cause Reference

The bug flow:

1. User A logs out → `clearAllClerkTokens()` called → tokens deleted ✓
2. `clerkAuth.signOut()` makes API call to invalidate session
3. API response includes `authorization` header
4. Clerk's `__unstable__onAfterResponse` callback WRITES THE TOKEN BACK
5. User B tries OAuth → token exists → previous session reactivated

## Success Metrics

- OAuth session persistence bug does not occur in any test scenario
- Logout completes successfully even when app is backgrounded
- Token verification confirms deletion within 5 attempts
- Users who encounter OS-level session issues receive actionable help
- No regression in legitimate re-login flow (60+ seconds after logout)

## Manual Testing Checklist

| Test Case            | Steps                                                 | Expected Result                       |
| -------------------- | ----------------------------------------------------- | ------------------------------------- |
| Basic Flow           | User A login → logout → User B signup                 | User B gets NEW account               |
| App Restart          | User A login → logout → force quit → User B signup    | User B gets NEW account               |
| Rapid Logout         | User A login/logout 3x rapidly → User B signup        | User B gets NEW account               |
| Interrupted Logout   | User A login → start logout → background app → resume | Logout completes on resume            |
| 60s Rule             | User A login → logout → wait 61s → User A login       | User A can re-login (account linking) |
| Help Dialog (Google) | Trigger stale session error with Google               | Help modal shows Google instructions  |
| Help Dialog (Apple)  | Trigger stale session error with Apple                | Help modal shows Apple instructions   |

## Console Log Verification

After logout, you should see these logs in sequence:

```
🔐 Starting logout process...
🧹 Clearing local state...
✅ Signed out from Clerk successfully
⏳ Waiting for Clerk callbacks...
🧹 Clearing all Clerk tokens...
✅ Tokens verified cleared after 1 attempt(s)
✅ User signed out successfully
```

Before OAuth (with stale session), you should see:

```
🔍 Pre-OAuth: Checking for stale sessions...
⚠️ Stale session detected, performing deep cleanup...
✅ Clerk signOut completed
⏳ Waiting for async callbacks...
🧹 Clearing all Clerk tokens...
✅ Tokens verified cleared after 1 attempt(s)
✅ Deep cleanup complete
```

## Open Questions

- Should we add telemetry to track how often the verification retry loop is needed?
- Should the help modal include a "Don't show again" checkbox?
- What is the appropriate timeout for the mutex lock (currently 200ms)?
