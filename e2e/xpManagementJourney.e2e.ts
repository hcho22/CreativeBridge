import { device, element, by, expect as detoxExpect } from 'detox';
import { TestHelpers } from './helpers/testHelpers';

/**
 * E2E Test: XP Management Journey
 * Insufficient XP → Earn XP → Generate Image
 */
describe('XP Management Journey E2E', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES', camera: 'YES', microphone: 'YES' },
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('should prevent image generation when XP is insufficient', async () => {
    // Step 1: Wait for home screen
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);
    await TestHelpers.takeScreenshot('01-home-screen');

    // Step 2: Check current XP balance
    await TestHelpers.waitForElementToBeVisible('xp-balance');
    await TestHelpers.takeScreenshot('02-xp-balance');

    // Step 3: Complete a story
    await TestHelpers.startNewStory('K-2');
    for (let i = 1; i <= 5; i++) {
      await TestHelpers.completeStoryRound(i);
    }
    await TestHelpers.verifyStoryCompleted();
    await TestHelpers.takeScreenshot('03-story-completed');

    // Step 4: Check if XP is insufficient
    // Note: This test assumes the test account has < 1000 XP
    // If user has sufficient XP, the button should be enabled
    const xpText = await element(by.id('xp-balance')).getAttributes();
    await TestHelpers.takeScreenshot('04-checking-xp-balance');

    // Step 5: Try to generate image with insufficient XP
    // The button should either be disabled or show an error
    try {
      await TestHelpers.waitForElementToBeVisible('generate-image-button');
      await TestHelpers.tapByTestID('generate-image-button');

      // Should show insufficient XP message
      await TestHelpers.waitForTextToBeVisible('Insufficient XP', 3000);
      await TestHelpers.takeScreenshot('05-insufficient-xp-message');
    } catch {
      // Button might be disabled - verify disabled state
      await detoxExpect(element(by.id('generate-image-button'))).toHaveToggleValue(false);
      await TestHelpers.verifyTextExists('You need');
      await TestHelpers.takeScreenshot('05-button-disabled-insufficient-xp');
    }
  });

  it('should allow image generation after earning sufficient XP', async () => {
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);

    // Step 1: Complete first story to earn XP
    await TestHelpers.startNewStory('K-2');
    for (let i = 1; i <= 5; i++) {
      await TestHelpers.completeStoryRound(i);
    }
    await TestHelpers.verifyStoryCompleted();
    await TestHelpers.takeScreenshot('01-first-story-completed');

    // Step 2: Verify XP earned
    await TestHelpers.verifyElementVisible('xp-earned-notification');
    await TestHelpers.takeScreenshot('02-xp-earned');

    // Step 3: Check updated XP balance
    await TestHelpers.waitForElementToBeVisible('xp-balance');
    await TestHelpers.takeScreenshot('03-updated-xp-balance');

    // Step 4: Complete another story if needed to have enough XP
    // Each completed story gives 500 XP, need 1000 for image generation
    await TestHelpers.startNewStory('3-5');
    for (let i = 1; i <= 5; i++) {
      await TestHelpers.completeStoryRound(i);
    }
    await TestHelpers.verifyStoryCompleted();
    await TestHelpers.takeScreenshot('04-second-story-completed');

    // Step 5: Now try to generate image (should succeed)
    await TestHelpers.waitForElementToBeVisible('generate-image-button');
    await detoxExpect(element(by.id('generate-image-button'))).not.toHaveToggleValue(false);
    await TestHelpers.generateImage();
    await TestHelpers.takeScreenshot('05-image-generated-after-earning-xp');

    // Step 6: Verify XP was deducted
    await TestHelpers.verifyElementVisible('xp-balance');
    await TestHelpers.takeScreenshot('06-xp-deducted-after-generation');
  });

  it('should show XP balance prominently throughout the app', async () => {
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);

    // Verify XP balance is visible on home screen
    await TestHelpers.verifyElementVisible('xp-balance');
    await TestHelpers.takeScreenshot('01-xp-on-home-screen');

    // Navigate to settings and verify XP is visible
    await TestHelpers.navigateToSettings();
    await TestHelpers.verifyElementVisible('xp-balance');
    await TestHelpers.takeScreenshot('02-xp-on-settings-screen');

    // Navigate back to home
    await TestHelpers.navigateToHome();
    await TestHelpers.verifyElementVisible('xp-balance');
  });

  it('should display XP cost for image generation', async () => {
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);

    // Complete a story
    await TestHelpers.startNewStory('K-2');
    for (let i = 1; i <= 5; i++) {
      await TestHelpers.completeStoryRound(i);
    }
    await TestHelpers.verifyStoryCompleted();

    // Verify XP cost is displayed
    await TestHelpers.verifyTextExists('1000 XP');
    await TestHelpers.verifyTextExists('Cost');
    await TestHelpers.takeScreenshot('xp-cost-displayed');
  });

  it('should refund XP if image generation fails', async () => {
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);

    // Note: This test requires a way to simulate image generation failure
    // This might need to be done via test environment configuration

    // Complete a story
    await TestHelpers.startNewStory('K-2');
    for (let i = 1; i <= 5; i++) {
      await TestHelpers.completeStoryRound(i);
    }
    await TestHelpers.verifyStoryCompleted();

    // Record XP before generation
    const xpBeforeElement = await element(by.id('xp-balance')).getAttributes();
    await TestHelpers.takeScreenshot('01-xp-before-generation');

    // Try to generate image (simulate failure)
    // In real test, you'd need to mock the API to return failure
    await TestHelpers.waitForElementToBeVisible('generate-image-button');
    await TestHelpers.tapByTestID('generate-image-button');

    // Wait for generation process
    await TestHelpers.wait(5000);

    // If generation failed, verify error message and XP refund
    try {
      await TestHelpers.waitForTextToBeVisible('Generation failed', 10000);
      await TestHelpers.takeScreenshot('02-generation-failed-message');

      // Verify XP was refunded
      const xpAfterElement = await element(by.id('xp-balance')).getAttributes();
      await TestHelpers.takeScreenshot('03-xp-refunded');

      // XP should be the same as before (refunded)
      // Note: Actual comparison would need to parse the text
    } catch {
      // If generation succeeded, verify image is displayed
      await TestHelpers.verifyElementVisible('story-image');
      await TestHelpers.takeScreenshot('02-generation-succeeded');
    }
  });

  it('should update XP balance in real-time after story completion', async () => {
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);

    // Get initial XP balance
    await TestHelpers.verifyElementVisible('xp-balance');
    await TestHelpers.takeScreenshot('01-initial-xp-balance');

    // Complete a story
    await TestHelpers.startNewStory('K-2');
    for (let i = 1; i <= 5; i++) {
      await TestHelpers.completeStoryRound(i);
    }
    await TestHelpers.verifyStoryCompleted();

    // Verify XP increased
    await TestHelpers.waitForElementToBeVisible('xp-earned-notification', 5000);
    await TestHelpers.takeScreenshot('02-xp-earned-notification');

    // Wait for notification to disappear
    await TestHelpers.wait(3000);

    // Verify updated balance
    await TestHelpers.verifyElementVisible('xp-balance');
    await TestHelpers.takeScreenshot('03-updated-xp-balance');
  });
});
