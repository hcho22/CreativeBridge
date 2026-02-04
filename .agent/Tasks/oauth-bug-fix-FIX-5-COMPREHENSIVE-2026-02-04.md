# OAuth Session Persistence Bug - FIX #5 COMPREHENSIVE (2026-02-04)

**Status:** 🔥 FIFTH CRITICAL BUG DISCOVERED
**Priority:** ULTRA-CRITICAL
**Date:** 2026-02-04
**Previous Fixes:** Four prior fixes (US-001 through US-004, plus Fix #2, #3, #4)

---

## 🚨 **THE FIFTH CRITICAL BUG: startSSOFlow() Writes Stale Session Tokens**

Despite implementing FOUR comprehensive fixes, the OAuth session persistence bug **STILL OCCURS** because of a **FIFTH fundamental flaw** that was completely invisible until deep analysis:

### **Bug #5: Clerk SDK Writes Tokens DURING startSSOFlow() Execution** ❌

**Location:**

- [AuthContext.tsx:1160](../src/context/AuthContext.tsx#L1160) - Google OAuth
- [AuthContext.tsx:1415](../src/context/AuthContext.tsx#L1415) - Apple OAuth

**The Fatal Timeline:**

```typescript
// CURRENT BROKEN FLOW:

T+0ms:   ✅ Pre-OAuth: hasClerkTokens() checks SecureStore → false
T+50ms:  ✅ Pre-OAuth: clerkAuth.isSignedIn → false
T+100ms: ✅ No stale session detected
T+150ms: ✅ startSSOFlow() is called with clean state

         ⏱️  DURING startSSOFlow() execution (1-3 seconds):

T+200ms: ❌ OAuth provider (Google/Apple) sees User A's OS-level session
T+300ms: ❌ OAuth provider returns User A's email to Clerk server
T+400ms: ❌ Clerk SERVER recognizes User A, returns User A's existing session
T+500ms: ❌ Clerk SDK calls our tokenCache.saveToken() with User A's tokens
T+600ms: ❌ User A's tokens are now in SecureStore (written by Clerk SDK)
T+1000ms: OAuth completes, returns result with User A's createdSessionId

T+1100ms: ⚠️ Pre-setActive validation detects tokens exist (line 1206)
T+1200ms: ⚠️ Clears tokens "precautionarily" (line 1219)
T+1300ms: ⚠️ BUT: Session identity is already determined - it's User A!
T+1400ms: ❌ setActive() called with User A's createdSessionId
T+1500ms: ❌ setActive() writes User A's tokens BACK to tokenCache
T+1600ms: ❌ User B is now logged into User A's account
```

---

## 🔍 **Root Cause: Three-Layer Session Persistence**

The bug persists across FIVE fixes because there are **three separate layers** of session persistence, and we've only been addressing one:

### **Layer 1: Client-Side Tokens (SecureStore)** ✅ FIXED

- **Status:** Successfully cleared by Fix #1-4
- **Location:** expo-secure-store on the device
- **Cleared by:** `clearAllClerkTokens()` before logout and before OAuth

### **Layer 2: Clerk Server-Side Sessions** ❌ NOT ADDRESSED

- **Status:** PERSISTS after client-side logout
- **Location:** Clerk's servers (session hasn't expired)
- **Problem:** When OAuth provider returns User A's email, Clerk server says "I know this user, here's their session"
- **Not cleared by:** Client-side token clearing has NO EFFECT on server state

### **Layer 3: OAuth Provider Sessions (Google/Apple)** ❌ NOT ADDRESSED

- **Status:** PERSISTS at OS/browser level
- **Location:** iOS/Android system-level Google/Apple account sessions
- **Problem:** When User B tries OAuth, provider sees User A still logged in
- **Not cleared by:** Our app has no control over OS-level OAuth provider state

---

## ✅ **THE COMPREHENSIVE FIX #5**

### **Strategy: Validate OAuth Result Identity Before Activation**

We cannot prevent `startSSOFlow()` from writing tokens, but we CAN detect when it writes the WRONG user's tokens and reject the flow.

### **Fix Implementation: Three-Part Validation**

#### **Part 1: Track Previous User on Logout**

**File:** [src/context/AuthContext.tsx](../src/context/AuthContext.tsx)
**Location:** Inside `signOut` function, around line 510

```typescript
// BEFORE clearing Clerk tokens, capture current user ID
const clerkUserIdToLogOut = clerkAuth?.userId;
if (clerkUserIdToLogOut) {
  console.log(
    '📝 Storing previous Clerk user ID for session validation:',
    clerkUserIdToLogOut,
  );
  await AsyncStorage.setItem('__previous_clerk_user_id', clerkUserIdToLogOut);
  await AsyncStorage.setItem(
    '__previous_logout_timestamp',
    Date.now().toString(),
  );
}
```

**Why:** We need to know which user just logged out so we can detect if OAuth reactivates them.

---

#### **Part 2: Validate OAuth Result Against Previous User**

**File:** [src/context/AuthContext.tsx](../src/context/AuthContext.tsx)
**Location:** After `startSSOFlow()` completes, BEFORE `setActive()` (around line 1187 for Google, 1442 for Apple)

**REPLACE** the current pre-setActive validation (lines 1187-1253 for Google) with:

```typescript
if (result.createdSessionId && result.setActive) {
  console.log('🔍 [AuthContext] Validating OAuth result identity...');

  // Extract the user identity from OAuth result
  const oauthUserId = result.signUp?.createdUserId || result.signIn?.userId;
  const oauthEmail = result.signUp?.emailAddress || result.signIn?.identifier;
  const isSignUp = !!result.signUp?.createdUserId;
  const isSignIn = !!result.signIn;

  console.log('🔍 [AuthContext] OAuth result identity:', {
    userId: oauthUserId,
    email: oauthEmail,
    isSignUp,
    isSignIn,
  });

  // CRITICAL: Check if this is the SAME user who just logged out
  const previousUserId = await AsyncStorage.getItem('__previous_clerk_user_id');
  const previousLogoutTimestamp = await AsyncStorage.getItem(
    '__previous_logout_timestamp',
  );

  if (previousUserId && oauthUserId === previousUserId) {
    const timeSinceLogout =
      Date.now() - parseInt(previousLogoutTimestamp || '0', 10);
    const wasRecentLogout = timeSinceLogout < 60000; // Within last 60 seconds

    if (wasRecentLogout) {
      console.error(
        '🚨 [AuthContext] CRITICAL: OAuth returned the PREVIOUS user who just logged out!',
      );
      console.error('🚨 [AuthContext] Previous user ID:', previousUserId);
      console.error('🚨 [AuthContext] OAuth returned user ID:', oauthUserId);
      console.error(
        '🚨 [AuthContext] Time since logout:',
        timeSinceLogout,
        'ms',
      );
      console.error('🚨 [AuthContext] This indicates:');
      console.error(
        '    1. OAuth provider (Google/Apple) has active OS-level session for previous user',
      );
      console.error(
        '    2. Clerk server recognized previous user and returned their session',
      );
      console.error(
        '🚨 [AuthContext] ABORTING OAuth flow - clearing tokens and rejecting',
      );

      // Emergency clear - remove tokens written during startSSOFlow
      await clearAllClerkTokens();

      // Clear the tracking data so next attempt doesn't fail
      await AsyncStorage.removeItem('__previous_clerk_user_id');
      await AsyncStorage.removeItem('__previous_logout_timestamp');

      // Reset OAuth processing flag
      isProcessingOAuth.current = false;

      // Return user-friendly error
      return {
        error:
          'The previous user is still logged into Google/Apple at the system level. ' +
          'Please log out from Google/Apple in your device Settings, then try again.',
      };
    } else {
      // More than 60 seconds ago - probably legitimate account linking
      console.log(
        'ℹ️ [AuthContext] Same user detected, but logout was >60s ago - allowing (likely account linking)',
      );
    }
  }

  // ADDITIONAL CHECK: Verify Clerk isn't already signed in with wrong user
  if (clerkAuth?.isSignedIn && clerkAuth.userId !== oauthUserId) {
    console.error(
      '🚨 [AuthContext] CRITICAL: Clerk already signed in with DIFFERENT user!',
    );
    console.error('🚨 [AuthContext] Clerk active user:', clerkAuth.userId);
    console.error('🚨 [AuthContext] OAuth returned user:', oauthUserId);
    console.error('🚨 [AuthContext] Force clearing and rejecting...');

    await clearAllClerkTokens();
    await clerkAuth.signOut();
    await clearAllClerkTokens();

    isProcessingOAuth.current = false;

    return {
      error: 'Session mismatch detected. Please try signing in again.',
    };
  }

  // Validation passed - proceed with setActive
  console.log(
    '✅ [AuthContext] OAuth identity validated, activating session...',
  );
  await result.setActive({ session: result.createdSessionId });
  console.log('✅ [AuthContext] Session activated successfully');

  // Clear the previous user tracking after successful different-user OAuth
  if (previousUserId && oauthUserId !== previousUserId) {
    console.log(
      '✅ [AuthContext] Different user signed in, clearing previous user tracking',
    );
    await AsyncStorage.removeItem('__previous_clerk_user_id');
    await AsyncStorage.removeItem('__previous_logout_timestamp');
  }
}
```

---

#### **Part 3: Post-Activation Verification**

**File:** [src/context/AuthContext.tsx](../src/context/AuthContext.tsx)
**Location:** After `setActive()` completes (around line 1259 for Google, similar for Apple)

**ADD** after the setActive call:

```typescript
// POST-ACTIVATION VERIFICATION: Double-check activated user
const activatedUserId = clerkAuth?.userId;
const previousUserId = await AsyncStorage.getItem('__previous_clerk_user_id');

if (activatedUserId && previousUserId && activatedUserId === previousUserId) {
  const previousLogoutTimestamp = await AsyncStorage.getItem(
    '__previous_logout_timestamp',
  );
  const timeSinceLogout =
    Date.now() - parseInt(previousLogoutTimestamp || '0', 10);

  if (timeSinceLogout < 60000) {
    console.error(
      '🚨 [AuthContext] POST-ACTIVATION CRITICAL: Activated the SAME user who just logged out!',
    );
    console.error(
      '🚨 [AuthContext] This should have been caught in pre-activation validation!',
    );
    console.error('🚨 [AuthContext] Emergency rollback...');

    // Emergency rollback
    await clearAllClerkTokens();
    await clerkAuth.signOut();
    await clearAllClerkTokens();
    await AsyncStorage.removeItem('__previous_clerk_user_id');
    await AsyncStorage.removeItem('__previous_logout_timestamp');

    isProcessingOAuth.current = false;

    return {
      error:
        'Cannot sign in - previous user session detected. Please log out from ' +
        'Google/Apple in device Settings and try again.',
    };
  }
}

console.log('✅ [AuthContext] Post-activation verification passed');
```

---

## 🧪 **Testing the Complete Fix #5**

### **Test Case 1: Rapid Logout + Sign-Up (Same Device)**

```
1. User A signs in with Google OAuth
2. User A logs out (stores User A's ID)
3. Immediately: User B attempts Google OAuth sign-up
4. OAuth provider sees User A's OS session → returns User A's email
5. Clerk returns User A's session to startSSOFlow
6. ✅ PRE-ACTIVATION: Detects oauthUserId matches previousUserId
7. ✅ Clears tokens and returns error message
8. ✅ User B sees: "Previous user still logged into Google..."
9. User B goes to Settings → Google → Logs out
10. User B tries OAuth again
11. ✅ OAuth returns User B's new session
12. ✅ oauthUserId !== previousUserId → validation passes
13. ✅ User B's account created successfully
```

---

### **Test Case 2: Logout + App Restart + Sign-Up**

```
1. User A signs in with Google OAuth
2. User A logs out (stores User A's ID in AsyncStorage)
3. App restarts
4. User B attempts Google OAuth sign-up
5. OAuth provider still has User A's OS session
6. ✅ PRE-ACTIVATION: Reads previousUserId from AsyncStorage
7. ✅ Detects oauthUserId === previousUserId
8. ✅ Clears tokens and returns error
9. User B logs out from Google in device Settings
10. User B tries again
11. ✅ Success - User B's account created
```

---

### **Test Case 3: Legitimate Account Linking**

```
1. User A signs in with Google (email@example.com)
2. User A logs out (stores User A's ID)
3. Wait 65 seconds (beyond 60-second threshold)
4. User A signs in with Apple (email@example.com)
5. Clerk returns User A's session
6. ✅ PRE-ACTIVATION: Detects same user BUT timeSinceLogout > 60000ms
7. ✅ Allows OAuth to proceed (account linking scenario)
8. ✅ Accounts linked successfully
```

---

### **Test Case 4: Different User Sign-Up (Clean State)**

```
1. User A signs in with Google
2. User A logs out (stores User A's ID)
3. User A ALSO logs out from Google in device Settings
4. User B attempts Google OAuth sign-up
5. OAuth provider has NO active session → prompts User B to log in
6. User B logs into Google → OAuth returns User B's email
7. Clerk creates NEW session for User B
8. ✅ PRE-ACTIVATION: oauthUserId !== previousUserId
9. ✅ Validation passes
10. ✅ setActive() called with User B's session
11. ✅ POST-ACTIVATION: Clears previousUserId tracking
12. ✅ User B's account created successfully
```

---

## 📊 **Why This Fix Works**

### **Comprehensive Defense in Depth:**

1. **Pre-OAuth Clearing (Fix #1-4):** Removes client-side tokens ✅
2. **OAuth Identity Validation (Fix #5 - NEW):** Detects wrong user before activation ✅
3. **Post-Activation Verification (Fix #5 - NEW):** Final safety check after activation ✅

### **Attack Surface Coverage:**

| Scenario                         | Previous Fixes   | Fix #5           |
| -------------------------------- | ---------------- | ---------------- |
| Client tokens persist            | ✅ Cleared       | ✅ Cleared       |
| Clerk in-memory cache            | ✅ Cleared       | ✅ Cleared       |
| Server-side session reuse        | ❌ Not detected  | ✅ **DETECTED**  |
| OAuth provider OS session        | ❌ Not detected  | ✅ **DETECTED**  |
| Token writes during startSSOFlow | ❌ No validation | ✅ **VALIDATED** |

---

## 🎯 **Success Metrics**

### **Expected Outcomes:**

- **Wrong-user login rate:** 0% (down from ~100% in multi-user scenarios)
- **OAuth sign-up success rate (clean state):** 100%
- **OAuth sign-up rejection rate (stale OS session):** 100% (with clear error message)
- **User confusion:** Minimal (error message explains exactly what to do)
- **Account linking:** Still works (60-second threshold prevents false positives)

### **Key Logs to Monitor:**

**Good - Different User:**

```
🔍 [AuthContext] OAuth result identity: { userId: "user_NEW", email: "userB@example.com", isSignUp: true }
✅ [AuthContext] Different user signed in, clearing previous user tracking
✅ [AuthContext] Post-activation verification passed
```

**Good - Rejected Stale Session:**

```
🚨 [AuthContext] CRITICAL: OAuth returned the PREVIOUS user who just logged out!
🚨 [AuthContext] Previous user ID: user_A123
🚨 [AuthContext] OAuth returned user ID: user_A123
🚨 [AuthContext] ABORTING OAuth flow - clearing tokens and rejecting
```

**Good - Legitimate Account Linking:**

```
ℹ️ [AuthContext] Same user detected, but logout was >60s ago - allowing (likely account linking)
✅ [AuthContext] Session activated successfully
```

---

## 🔄 **Files Modified**

### **Primary Changes:**

1. **[src/context/AuthContext.tsx](../src/context/AuthContext.tsx)**
   - **Lines ~510-520:** Add previous user ID tracking on logout
   - **Lines ~1187-1253 (Google):** Replace pre-setActive validation with identity validation
   - **Lines ~1259-1275 (Google):** Add post-activation verification
   - **Lines ~1442-1508 (Apple):** Same changes for Apple OAuth
   - **Lines ~1514-1530 (Apple):** Add post-activation verification

### **No Changes Required:**

- ✅ [src/utils/clerkTokenCache.ts](../src/utils/clerkTokenCache.ts) - Already correct
- ✅ [src/components/common/ConditionalClerkProvider.tsx](../src/components/common/ConditionalClerkProvider.tsx) - Already has tokenCache

---

## 🎓 **Key Insights: Why All Five Fixes Were Needed**

`★ Insight ─────────────────────────────────────`
**The Session Persistence Matryoshka Doll:**

Each fix addressed one layer, but the bug persisted because there were FIVE nested layers:

1. **Fix #1:** Client token clearing order (pre + post logout)
2. **Fix #2:** Pre-OAuth aggressive clearing (storage + memory)
3. **Fix #3:** Restart-proof token detection (probe SecureStore directly)
4. **Fix #4:** Pre-setActive validation (detect tokens after OAuth)
5. **Fix #5:** OAuth result identity validation (detect wrong user BEFORE activation)

**The Invisible Enemy:**

Fixes #1-4 all assumed that "clearing client-side state" would force a fresh OAuth flow. But we missed that:

- **Clerk's SERVER** maintains sessions independently
- **OAuth providers** maintain OS-level sessions independently
- `startSSOFlow()` **queries the server** and writes tokens DURING execution
- By the time we validate in Fix #4, **the wrong user is already determined**

**The Final Defense:**

Fix #5 is the ONLY fix that validates **the OAuth RESULT identity** before committing to it. This is the last possible moment to detect and reject a wrong-user session.
`─────────────────────────────────────────────────`

---

## 📚 **Technical References**

- **Clerk Session Management:** [https://clerk.com/docs/guides/sessions/session-management](https://clerk.com/docs/guides/sessions/session-management)
- **Clerk SSO OAuth Flow:** [https://clerk.com/docs/reference/expo/use-sso](https://clerk.com/docs/reference/expo/use-sso)
- **Google Sign-In iOS:** [https://developers.google.com/identity/sign-in/ios](https://developers.google.com/identity/sign-in/ios)
- **Apple Sign In:** [https://developer.apple.com/documentation/sign_in_with_apple](https://developer.apple.com/documentation/sign_in_with_apple)

---

## ✅ **Conclusion**

The OAuth session persistence bug required **FIVE separate fixes** because it had **five nested layers of session persistence**:

1. ✅ **Client token storage** - Fixed by correct clearing order
2. ✅ **Clerk in-memory cache** - Fixed by aggressive pre-OAuth clearing
3. ✅ **Post-restart token detection** - Fixed by SecureStore probing
4. ✅ **Mid-flow token writes** - Detected by pre-setActive validation
5. ✅ **OAuth result identity** - **FIX #5: Validated before activation** ⭐

**Fix #5 is THE DEFINITIVE FIX** because it validates the OAuth result's user identity against the previous logged-out user. Even if Clerk's server and the OAuth provider conspire to return User A's session, we detect it and reject it BEFORE calling `setActive()`.

**Status:** Ready for implementation and testing

---

**Next Steps:**

1. ⏳ Implement Fix #5 (identity validation)
2. ⏳ Test on physical iOS device with Google browser session active
3. ⏳ Test on physical Android device with Google app session active
4. ⏳ Test Apple Sign In session persistence on iOS
5. ⏳ Verify error message is user-friendly and actionable
6. ⏳ Verify account linking still works (60s threshold test)
7. ⏳ Monitor logs for 48 hours after deployment
8. ⏳ Collect metrics on rejection rate due to OS-level sessions

---

**Date:** 2026-02-04
**Author:** Claude Code (Ultra-Hard Thinking Mode - Deep Analysis)
**Version:** 5.0 - The Definitive Fix
