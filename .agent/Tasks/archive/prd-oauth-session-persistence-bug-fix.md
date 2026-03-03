# PRD: OAuth Session Persistence Bug Fix

## Introduction

**Bug Summary:** When User A logs out after signing in via Google/Apple OAuth, and then User B attempts to sign up via OAuth, the app automatically logs User A back in instead of allowing User B to create a new account.

**Impact:** Critical - This bug prevents new user acquisition through the OAuth sign-up flow. Users attempting to create accounts on shared/borrowed devices experience automatic login to the previous user's account, creating a serious security and user experience issue.

**Root Cause:** The `ClerkProvider` in [ConditionalClerkProvider.tsx:67](src/components/common/ConditionalClerkProvider.tsx#L67) is instantiated without a `tokenCache` prop. This causes Clerk to use its default token storage mechanism, which persists OAuth session tokens in device storage even after `clerkAuth.signOut()` is called.

## Goals

- Ensure complete session token cleanup when users log out
- Allow new users to successfully create OAuth accounts after another user logs out
- Prevent automatic re-authentication of previous users' sessions
- Maintain legitimate account linking functionality (same email, different providers)
- Implement fail-safe token clearing that handles network failures and crashes
- Achieve 100% success rate for new user OAuth signups on previously-used devices

## User Stories

### US-001: Implement Custom Secure Token Cache

**Description:** As a developer, I need to create a custom `tokenCache` that provides explicit token clearing capability so that Clerk sessions can be completely removed from device storage on logout.

**Acceptance Criteria:**

- [x] Install `expo-secure-store` dependency via npm
- [x] Run `npx expo prebuild --clean` to integrate native modules
- [x] Create new file [src/utils/clerkTokenCache.ts](src/utils/clerkTokenCache.ts)
- [x] Implement `clerkTokenCache` object conforming to Clerk's `TokenCache` interface
- [x] Implement `clearAllClerkTokens()` function to remove all stored tokens
- [x] Implement `hasClerkTokens()` function to detect presence of stale sessions
- [x] Store tokens in `expo-secure-store` with `@clerk_token_` prefix
- [x] Track all token keys in a Set for efficient bulk clearing
- [x] Include console logging for debugging token lifecycle
- [x] Handle errors gracefully (token write/read failures should not crash app)
- [x] Typecheck passes (`npm run typecheck`)

**Technical Details:**

- File: `src/utils/clerkTokenCache.ts` (NEW FILE, ~120 lines)
- Use `SecureStore.setItemAsync()` and `SecureStore.getItemAsync()` from expo-secure-store
- Implement token key tracking: maintain a Set of all stored token keys
- Clear function should iterate through tracked keys and call `SecureStore.deleteItemAsync()`

### US-002: Configure ClerkProvider with Custom TokenCache

**Description:** As a developer, I need to attach the custom `tokenCache` to the `ClerkProvider` so that Clerk uses our secure storage instead of its default mechanism.

**Acceptance Criteria:**

- [x] Import `clerkTokenCache` in [ConditionalClerkProvider.tsx](src/components/common/ConditionalClerkProvider.tsx)
- [x] Add `tokenCache={clerkTokenCache}` prop to `ClerkProvider` at line 67
- [x] Verify Clerk uses custom cache (check logs during login/logout)
- [x] Typecheck passes
- [x] App builds successfully on iOS and Android

**Technical Details:**

- File: [src/components/common/ConditionalClerkProvider.tsx](src/components/common/ConditionalClerkProvider.tsx)
- Changes at line 67: Add `tokenCache` prop to `<ClerkProvider>`
- Import statement: `import { clerkTokenCache } from '../../utils/clerkTokenCache';`

### US-003: Enhance Logout Flow with Explicit Token Clearing

**Description:** As a user, when I log out of the app, I expect all my session data to be completely removed so that the next person cannot access my account.

**Acceptance Criteria:**

- [x] Import `clearAllClerkTokens` and `hasClerkTokens` in [AuthContext.tsx](src/context/AuthContext.tsx)
- [x] Call `clearAllClerkTokens()` before `clerkAuth.signOut()` in the `signOut` function (~line 509)
- [x] Add verification after `signOut()` to ensure `clerkAuth.isSignedIn` becomes `false`
- [x] Add force-clear in error handler (catch block ~line 558) to ensure tokens are cleared even if Clerk API fails
- [x] Add console logs confirming token clearing steps
- [ ] Test logout with network disconnected - tokens should still clear
- [ ] Test logout during OAuth in progress - session should clear properly
- [x] Typecheck passes

**Technical Details:**

- File: [src/context/AuthContext.tsx](src/context/AuthContext.tsx) - lines 483-584
- Fail-safe approach: Clear tokens BEFORE calling Clerk's signOut (ensures clearing happens even if network call fails)
- Add double-check after signOut succeeds to verify `isSignedIn === false`
- In catch block, force-clear tokens to handle partial failure scenarios

### US-004: Add Pre-OAuth Session Detection

**Description:** As a user attempting to sign up with OAuth, I expect the app to detect and clear any stale sessions before starting the OAuth flow so that I don't get automatically logged in as the previous user.

**Acceptance Criteria:**

- [x] Add pre-OAuth session check in `signInWithGoogle` function (~line 1050)
- [x] Add pre-OAuth session check in `signInWithApple` function (~line 1170)
- [x] If `clerkAuth.isSignedIn` is true before OAuth starts, log warning
- [x] Check `hasClerkTokens()` to detect stale session
- [x] If stale tokens exist, call `clearAllClerkTokens()` and `clerkAuth.signOut()`
- [x] Add 200ms delay after clearing to ensure cleanup completes before OAuth
- [ ] Test: User A logs out, User B signs up with Google - creates NEW account
- [ ] Test: User A logs out, User B signs up with Apple - creates NEW account
- [ ] Test: Legitimate account linking still works (same email, different providers)
- [x] Typecheck passes
- [ ] Verify in browser/device using OAuth test flow

**Technical Details:**

- Files: [src/context/AuthContext.tsx](src/context/AuthContext.tsx)
  - `signInWithGoogle` (lines 1036-1152)
  - `signInWithApple` (lines 1154-1274)
- Add session detection logic after initial parameter checks
- Implementation:
  ```typescript
  // Check for existing Clerk session before starting OAuth
  if (clerkAuth?.isSignedIn) {
    console.warn('⚠️ Clerk session already exists before OAuth!');
    const hasTokens = await hasClerkTokens();
    if (hasTokens) {
      await clearAllClerkTokens();
      await clerkAuth.signOut();
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  ```

### US-005: Comprehensive Testing & Verification

**Description:** As a QA tester, I need to verify that the OAuth session persistence bug is completely fixed and that no legitimate functionality is broken.

**Acceptance Criteria:**

**Primary Bug Verification:**

- [ ] User A signs in with Google OAuth
- [ ] User A logs out completely
- [ ] User B attempts to sign up with Google OAuth
- [ ] Verify User B creates a NEW account (not logged into User A's account)
- [ ] Repeat test flow for Apple OAuth
- [ ] Document results in test report

**Edge Case Testing:**

- [ ] Network failure during logout → verify tokens are still cleared locally
- [ ] App crash/force-quit during OAuth → verify stale session is cleared on restart
- [ ] Multiple rapid login/logout cycles → verify no stale data accumulates
- [ ] Logout while OAuth in progress → verify session is properly cleared

**Legitimate Account Linking (must still work):**

- [ ] User A signs in with Google using email@example.com
- [ ] User A logs out
- [ ] User A signs in with Apple using email@example.com
- [ ] Verify accounts are linked (same user profile, not duplicate)

**Cross-Platform Testing:**

- [ ] iOS: Google OAuth flow works correctly
- [ ] iOS: Apple Sign In flow works correctly
- [ ] Android: Google OAuth flow works correctly
- [ ] Android: Apple OAuth (web-based) flow works correctly

**Performance & Monitoring:**

- [ ] OAuth signup success rate maintains ≥95%
- [ ] Logout completion time remains under 2 seconds
- [ ] Token clearing failures occur <1% of the time (check logs)
- [ ] No increase in crash rate or error reports

## Functional Requirements

- **FR-1:** The app must use a custom `tokenCache` implementing Clerk's `TokenCache` interface with `expo-secure-store` as the storage backend
- **FR-2:** All Clerk session tokens must be stored with the prefix `@clerk_token_` for easy identification and bulk clearing
- **FR-3:** The `signOut` function must call `clearAllClerkTokens()` before invoking `clerkAuth.signOut()` to ensure fail-safe token removal
- **FR-4:** After logout completes, `clerkAuth.isSignedIn` must return `false` and no Clerk tokens should remain in device storage
- **FR-5:** Before initiating Google or Apple OAuth flows, the app must check for existing sessions and clear them if present
- **FR-6:** If stale tokens are detected before OAuth, the app must clear tokens, sign out, and wait 200ms before proceeding with OAuth
- **FR-7:** Token clearing must succeed even if network calls to Clerk API fail (local storage clearing is independent)
- **FR-8:** All token storage operations must handle errors gracefully with console logging (failures should not crash the app)
- **FR-9:** Account linking for the same user with different OAuth providers must continue to work as expected

## Non-Goals (Out of Scope)

- **Not implementing server-side session invalidation** - This fix focuses on client-side token management; server-side session cleanup is handled by Clerk's API
- **Not migrating existing user sessions** - Users currently logged in will continue with existing behavior; the fix applies to future login/logout cycles
- **Not adding UI for manual token clearing** - Token clearing is automatic on logout; no user-facing "clear cache" button is needed
- **Not implementing token expiration** - Clerk handles token lifecycle; we're only managing storage and explicit clearing
- **Not changing OAuth provider configuration** - Google and Apple OAuth settings remain unchanged
- **Not implementing multi-device session management** - The fix handles single-device token persistence; Clerk manages cross-device sessions

## Technical Considerations

### Dependencies

- **expo-secure-store:** Required for secure token storage on iOS/Android
  - Must run `npx expo prebuild --clean` after installation to link native modules
  - Provides encrypted storage via iOS Keychain and Android SharedPreferences

### Critical Files Modified

1. **src/utils/clerkTokenCache.ts** (NEW FILE, ~120 lines)

   - Implements custom `TokenCache` interface
   - Provides `clearAllClerkTokens()` and `hasClerkTokens()` utilities

2. **src/components/common/ConditionalClerkProvider.tsx**

   - Line 67: Add `tokenCache` prop (+2 lines total with import)

3. **src/context/AuthContext.tsx** (~50 lines of changes)

   - Lines 483-584: Enhanced `signOut` function with pre-clearing
   - Lines 1036-1152: Add pre-OAuth check to `signInWithGoogle`
   - Lines 1154-1274: Add pre-OAuth check to `signInWithApple`

4. **package.json**
   - Add `expo-secure-store` dependency

### Why The Bug Occurs (Technical Flow)

1. User A signs in with Google/Apple OAuth → Clerk stores session tokens using default storage
2. User A logs out → `clerkAuth.signOut()` is called but tokens remain in device storage
3. User B attempts to sign up with OAuth → Clerk detects existing tokens in storage
4. Clerk reactivates User A's session instead of creating a new one for User B
5. App syncs with User A's Supabase profile, effectively blocking User B's signup

### Integration Points

- **Clerk Authentication:** Custom `tokenCache` integrates with Clerk's session management
- **Supabase:** No direct changes; improved Clerk session management ensures correct user sync
- **AsyncStorage:** Continues to be used for app-specific state; Clerk tokens move to SecureStore
- **OAuth Providers:** No changes to Google/Apple OAuth configuration

### Performance Impact

- Token clearing adds <100ms to logout flow (SecureStore operations are fast)
- Pre-OAuth session check adds negligible overhead (<50ms)
- No impact on login performance for users without stale sessions

### Error Handling Strategy

- **Token write failures:** Log error, continue with app (graceful degradation)
- **Token read failures:** Return null, treat as no token present
- **Token clear failures:** Log error, attempt Clerk signOut anyway (fail-safe)
- **Network failures during logout:** Tokens cleared locally regardless of API success

## Success Metrics

- **Primary Goal:** New users can successfully sign up via OAuth after another user logs out (target: 100% success rate)
- **Logout Completeness:** Clerk tokens are fully cleared from device storage on logout (verify via logging and manual inspection)
- **OAuth Success Rate:** Maintain ≥95% OAuth authentication success rate (should not decrease)
- **Account Linking:** Legitimate same-user, different-provider scenarios continue to work (no regression)
- **Error Rate:** Token clearing failures occur in <1% of logout attempts
- **Performance:** Logout completes within 2 seconds (including token clearing)

## Design Considerations

### User Experience

- **No UI changes required** - This is a behind-the-scenes fix; users experience normal login/logout flows
- **Error messaging:** If OAuth fails after stale session clearing, show generic "Sign in failed, please try again" message (don't expose technical details)
- **Loading states:** Existing loading indicators during OAuth flows remain unchanged

### Accessibility

- No accessibility impact (no UI changes)

## Rollback Plan

### Immediate Rollback (if critical issues arise)

1. Remove `tokenCache` prop from `ClerkProvider` in [ConditionalClerkProvider.tsx:67](src/components/common/ConditionalClerkProvider.tsx#L67)
2. Reverts to default Clerk behavior
3. Original bug returns but no new issues introduced
4. Can be done in <5 minutes

### Partial Rollback

1. Keep `tokenCache` implementation
2. Remove pre-OAuth session checks from `signInWithGoogle` and `signInWithApple`
3. Retains explicit token clearing on logout
4. Removes automatic stale session detection before OAuth

### Emergency Hotfix Option

- Add manual "Clear All Sessions" button in app settings
- Calls `clearAllClerkTokens()` when pressed
- Provides user-controlled workaround while investigating issues

## Post-Implementation Monitoring

**Monitor for 48 hours after deployment:**

- OAuth signup success rate (should remain ≥95%, alert if drops below)
- Logout success rate (track token clearing failures, should be <1%)
- User reports of "wrong account" login issues (should drop to zero)
- Account linking success rate (should remain unchanged from baseline)
- App crash rate during login/logout flows (should not increase)

**Logging Strategy:**

- Log when stale sessions are detected and cleared
- Log token clearing success/failure during logout
- Log OAuth flow initiation with session state context
- Review logs daily for first week, then weekly

## CRITICAL BUG FIX (2026-02-03)

### Bug: Token Detection Failing After App Restart

**Root Cause Identified:** The original implementation of `hasClerkTokens()` and `clearAllClerkTokens()` relied on an in-memory `tokenKeys` Set to track which tokens exist. This Set is **cleared when the app restarts**, but the actual tokens remain in SecureStore.

**Impact:**

- User A logs in → tokens stored in SecureStore
- User A logs out → tokens cleared from `tokenKeys` Set
- **App restarts** (user closes app, kills it, or device restarts)
- User B tries to sign up → `hasClerkTokens()` checks empty Set, returns `false`
- Pre-OAuth cleanup is skipped
- **Clerk detects tokens still in SecureStore and logs User A back in**

**Fix Applied:**

1. **`hasClerkTokens()` Enhancement** (lines 189-235):

   - Now probes SecureStore directly for common Clerk token keys
   - Checks: `__clerk_client_jwt`, `__session`, `__clerk_db_jwt`, `__clerk_refresh_token`, `__clerk_session`
   - Re-populates `tokenKeys` Set when found tokens are detected
   - Works correctly even after app restart

2. **`clearAllClerkTokens()` Enhancement** (lines 112-175):
   - Falls back to clearing common Clerk token keys if `tokenKeys` Set is empty
   - Ensures tokens are cleared even after app restart
   - Provides comprehensive cleanup regardless of in-memory tracking state

**Files Modified:**

- [src/utils/clerkTokenCache.ts](src/utils/clerkTokenCache.ts) - lines 112-235

**Testing Required:**

- [ ] User A logs in, logs out, **app restarts**, User B signs up → NEW account created ✅
- [ ] User A logs in, **app restarts**, User A logs in again → account linking works ✅
- [ ] Verify tokens are detected and cleared after app restart

---

## Open Questions

- ~~Should we implement server-side session invalidation?~~ → No, Clerk API handles this
- ~~Do we need to migrate existing logged-in users?~~ → No, fix applies to future login cycles
- ~~Should we add a manual "clear sessions" button in settings?~~ → Only if needed as emergency hotfix
- ~~Why does OAuth sign-up fail after app restart?~~ → **FIXED:** In-memory tokenKeys Set was not persistent
- **Post-implementation:** Should we add automated E2E tests for the OAuth flows?
- **Post-implementation:** Should we implement analytics tracking for OAuth signup funnel to detect future issues early?

---

## Implementation Notes

- This fix is **non-breaking** - all existing OAuth users continue working normally
- Token clearing is **fail-safe** - attempts clearing even if Clerk API signOut fails
- Pre-OAuth checks are **non-intrusive** - only activate if stale session is detected
- Solution follows **Clerk best practices** for custom `tokenCache` implementation
- All changes are **testable** via manual testing on physical devices/simulators

## References

- Clerk TokenCache Documentation: https://clerk.com/docs/references/react/use-auth#token-cache
- expo-secure-store API: https://docs.expo.dev/versions/latest/sdk/securestore/
- Original bug report context: Provided in implementation plan
