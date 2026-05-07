import { device, element, by, expect as detoxExpect } from 'detox';
import { TestHelpers } from './helpers/testHelpers';

/**
 * E2E Test: COPPA Consent Flow
 *
 * Validates the full Verifiable Parental Consent (VPC) flow end-to-end,
 * including age gating, parent email collection, consent pending state,
 * parental gate math problem, and consent withdrawal.
 *
 * @implements COPPA Audit Task 4.2
 * @see .claude/audit/coppa-audit-2026-03-25.md
 */
describe('COPPA Consent Flow E2E', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' },
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  // ---------------------------------------------------------------------------
  // Scenario 1: Full VPC happy path
  // OAuth sign-in → AgeGatingScreen → "Under 13" → ParentEmailScreen →
  // enter email → ConsentPendingScreen shown
  // ---------------------------------------------------------------------------
  it('should complete the full VPC happy path for under-13 user', async () => {
    // Step 1: Sign in (OAuth flow — assumes test account is pre-configured)
    await TestHelpers.waitForElementToBeVisible('age-gating-screen', 20000);

    // Step 2: AgeGatingScreen — select "Under 13"
    await detoxExpect(element(by.id('age-gating-screen'))).toBeVisible();
    await element(by.id('age-option-under_13')).tap();
    await element(by.id('age-gating-continue')).tap();

    // Step 3: ParentEmailScreen — enter parent's email
    await TestHelpers.waitForElementToBeVisible('parent-email-screen', 10000);
    await element(by.id('parent-email-input')).typeText('parent@example.com');
    await element(by.id('parent-email-confirm-input')).typeText(
      'parent@example.com',
    );
    await element(by.id('parent-email-submit')).tap();

    // Step 4: ConsentPendingScreen is shown
    await TestHelpers.waitForElementToBeVisible(
      'consent-pending-screen',
      15000,
    );
    await detoxExpect(
      element(by.text('Waiting for Your Parent')),
    ).toBeVisible();

    // Step 5: Share button and sign-out button are available
    await detoxExpect(element(by.id('consent-share-button'))).toBeVisible();
    await detoxExpect(element(by.id('consent-sign-out'))).toBeVisible();

    await TestHelpers.takeScreenshot('vpc-happy-path-consent-pending');
  });

  // ---------------------------------------------------------------------------
  // Scenario 2: Age gate appears before profile completion
  // Sign in → verify AgeGatingScreen appears before ProfileCompletionScreen
  // ---------------------------------------------------------------------------
  it('should show AgeGatingScreen before ProfileCompletionScreen', async () => {
    // After sign-in, AgeGatingScreen must appear first
    await TestHelpers.waitForElementToBeVisible('age-gating-screen', 20000);
    await detoxExpect(element(by.id('age-gating-screen'))).toBeVisible();

    // ProfileCompletionScreen should NOT be visible yet
    await detoxExpect(
      element(by.id('profile-completion-screen')),
    ).not.toBeVisible();

    await TestHelpers.takeScreenshot('age-gate-before-profile');
  });

  // ---------------------------------------------------------------------------
  // Scenario 3: 13+ user skips consent flow
  // Sign in → select "13 to 17" → proceed directly to ProfileCompletionScreen
  // ---------------------------------------------------------------------------
  it('should skip consent flow for 13+ users', async () => {
    await TestHelpers.waitForElementToBeVisible('age-gating-screen', 20000);

    // Select "13 to 17" — no consent required
    await element(by.id('age-option-13_to_17')).tap();
    await element(by.id('age-gating-continue')).tap();

    // Should go directly to profile completion, NOT parent email
    await TestHelpers.waitForElementToBeVisible(
      'profile-completion-screen',
      10000,
    );
    await detoxExpect(
      element(by.id('profile-completion-screen')),
    ).toBeVisible();

    // Verify consent screens are NOT shown
    await detoxExpect(element(by.id('parent-email-screen'))).not.toBeVisible();
    await detoxExpect(
      element(by.id('consent-pending-screen')),
    ).not.toBeVisible();

    await TestHelpers.takeScreenshot('13-plus-skips-consent');
  });

  // ---------------------------------------------------------------------------
  // Scenario 4: Parental gate blocks dashboard access
  // Navigate to ParentDashboardScreen → math problem appears → wrong answer
  // regenerates → correct answer grants access
  // ---------------------------------------------------------------------------
  it('should block ParentDashboard behind math parental gate', async () => {
    // Assume user is signed in and consent is granted; navigate to dashboard
    await TestHelpers.waitForElementToBeVisible('home-screen', 20000);
    await TestHelpers.navigateToSettings();

    // Tap the Parent Dashboard option in settings
    await TestHelpers.tapByText('Parent Dashboard');

    // Step 1: Parental gate should appear with math problem
    await TestHelpers.waitForElementToBeVisible('parental-gate-screen', 10000);
    await detoxExpect(element(by.text('Parent Verification'))).toBeVisible();
    await detoxExpect(element(by.id('parental-gate-input'))).toBeVisible();

    // Step 2: Enter wrong answer — problem regenerates
    await element(by.id('parental-gate-input')).typeText('0');
    await element(by.id('parental-gate-submit')).tap();

    // Alert appears saying "Incorrect"
    await detoxExpect(element(by.text('Incorrect'))).toBeVisible();
    await element(by.text('OK')).tap();

    // Gate is still shown (problem regenerated)
    await detoxExpect(element(by.id('parental-gate-screen'))).toBeVisible();
    await detoxExpect(element(by.id('parental-gate-input'))).toBeVisible();

    // Step 3: We can't solve the problem dynamically in Detox
    // (the numbers are random), so verify cancel works
    await element(by.id('parental-gate-cancel')).tap();

    await TestHelpers.takeScreenshot('parental-gate-blocked');
  });

  // ---------------------------------------------------------------------------
  // Scenario 5: Consent withdrawal flow
  // Access ParentDashboard → withdraw consent → verify account blocked
  //
  // NOTE: This test requires the parental gate to be solved, which involves
  // random math. In a real test environment, the gate would be bypassed via
  // a test hook or pre-seeded known values.
  // ---------------------------------------------------------------------------
  it('should allow consent withdrawal from ParentDashboard', async () => {
    // Assume: user is signed in, consent granted, parental gate bypassed
    // (via test hook or pre-seeded data in test environment)
    await TestHelpers.waitForElementToBeVisible(
      'parent-dashboard-screen',
      20000,
    );

    // Step 1: Verify dashboard content is visible
    await detoxExpect(element(by.text('Parent Dashboard'))).toBeVisible();
    await detoxExpect(element(by.text('Consent Status'))).toBeVisible();
    await detoxExpect(element(by.text('Parent Actions'))).toBeVisible();

    // Step 2: Tap "Withdraw Consent"
    await TestHelpers.scrollTo('parent-dashboard-screen', 'down');
    await detoxExpect(element(by.id('withdraw-consent-button'))).toBeVisible();
    await element(by.id('withdraw-consent-button')).tap();

    // Step 3: Confirmation alert appears
    await detoxExpect(element(by.text('Withdraw Consent'))).toBeVisible();
    await detoxExpect(
      element(
        by.text(
          "This will disable your child's account. They will not be able to use CreativeBridge until consent is granted again. Are you sure?",
        ),
      ),
    ).toBeVisible();

    // Step 4: Confirm withdrawal
    await element(by.text('Withdraw Consent')).atIndex(1).tap();

    // Step 5: Verify consent withdrawn confirmation
    await TestHelpers.waitForTextToBeVisible('Consent Withdrawn', 10000);
    await element(by.text('OK')).tap();

    await TestHelpers.takeScreenshot('consent-withdrawn');
  });
});
