/**
 * H-04 — Consent Email Error UX Tests
 *
 * Verifies that ParentEmailScreen does NOT silently swallow email send failures.
 * The catch block for sendConsentEmail must:
 *   1. Set a user-visible error state (emailSendError)
 *   2. Show an Alert to the user explaining the issue
 *   3. Still call onConsentInitiated() (consent record exists server-side)
 *
 * @see .claude/audit/coppa-audit-2026-03-25.md — Finding H-04
 */

import { readSourceFile } from './helpers';

const PARENT_EMAIL_SOURCE = readSourceFile('src/screens/ParentEmailScreen.tsx');

describe('H-04: Consent Email Error UX', () => {
  test('[H-04] ParentEmailScreen does not silently swallow email errors', () => {
    // Find the catch block for sendConsentEmail
    // The catch block should contain more than just console.warn
    // It must set state or call Alert.alert
    const catchBlockPattern = /catch\s*\(\s*emailErr\s*\)\s*\{([\s\S]*?)\}/;
    const catchMatch = PARENT_EMAIL_SOURCE.match(catchBlockPattern);

    expect(catchMatch).not.toBeNull();

    const catchBody = catchMatch![1];

    // Must do more than just console.warn — assert Alert.alert or setState call
    const hasUserFeedback = /Alert\.alert|setEmailSendError|setError/.test(
      catchBody,
    );
    expect(hasUserFeedback).toBe(true);
  });

  test('[H-04] ParentEmailScreen has an error state for email send failure', () => {
    // Assert emailSendError state variable is declared
    expect(PARENT_EMAIL_SOURCE).toMatch(
      /const\s+\[\s*emailSendError\s*,\s*setEmailSendError\s*\]\s*=\s*useState/,
    );
  });

  test('[H-04] onConsentInitiated is still called after email failure (fallback path)', () => {
    // The onConsentInitiated call should appear AFTER the inner try/catch
    // (i.e., outside the sendConsentEmail catch block, still inside the outer try)
    //
    // Structure:
    //   try {
    //     ... submitParentEmail ...
    //     try { sendConsentEmail } catch { ... }
    //     onConsentInitiated();   <-- must be here
    //   } catch { ... }

    // Find the outer try block that contains both sendConsentEmail and onConsentInitiated
    const outerTryPattern =
      /try\s*\{[\s\S]*?sendConsentEmail[\s\S]*?onConsentInitiated\s*\(\)/;
    expect(PARENT_EMAIL_SOURCE).toMatch(outerTryPattern);

    // Verify onConsentInitiated is NOT inside the inner catch block
    // (it should be called regardless of email send success/failure)
    const catchBlockPattern = /catch\s*\(\s*emailErr\s*\)\s*\{([\s\S]*?)\}/;
    const catchMatch = PARENT_EMAIL_SOURCE.match(catchBlockPattern);
    expect(catchMatch).not.toBeNull();

    const catchBody = catchMatch![1];
    expect(catchBody).not.toContain('onConsentInitiated');
  });
});
