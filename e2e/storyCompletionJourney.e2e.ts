import { device, element, by, expect as detoxExpect } from 'detox';
import { TestHelpers } from './helpers/testHelpers';

/**
 * E2E Test: Complete User Journey
 * Story Creation → 5 Rounds → Completion → Image Generation → View
 */
describe('Story Completion Journey E2E', () => {
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

  it('should complete full story journey from creation to image viewing', async () => {
    // Step 1: Wait for home screen to load
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);
    await TestHelpers.takeScreenshot('01-home-screen-loaded');

    // Step 2: Start new story
    await TestHelpers.startNewStory('K-2');
    await TestHelpers.takeScreenshot('02-story-started');

    // Step 3: Verify initial state (Round 1)
    await TestHelpers.verifyRoundProgress(1, 5);
    await TestHelpers.takeScreenshot('03-round-1-initial');

    // Step 4: Complete Round 1
    await TestHelpers.completeStoryRound(1);
    await TestHelpers.verifyRoundProgress(2, 5);
    await TestHelpers.takeScreenshot('04-round-1-completed');

    // Step 5: Complete Round 2
    await TestHelpers.completeStoryRound(2);
    await TestHelpers.verifyRoundProgress(3, 5);
    await TestHelpers.takeScreenshot('05-round-2-completed');

    // Step 6: Complete Round 3
    await TestHelpers.completeStoryRound(3);
    await TestHelpers.verifyRoundProgress(4, 5);
    await TestHelpers.takeScreenshot('06-round-3-completed');

    // Step 7: Complete Round 4
    await TestHelpers.completeStoryRound(4);
    await TestHelpers.verifyRoundProgress(5, 5);
    await TestHelpers.takeScreenshot('07-round-4-completed');

    // Step 8: Complete Round 5 (final round)
    await TestHelpers.completeStoryRound(5);
    await TestHelpers.takeScreenshot('08-round-5-completed');

    // Step 9: Verify story completion
    await TestHelpers.verifyStoryCompleted();
    await TestHelpers.takeScreenshot('09-story-completed');

    // Step 10: Verify image generation button is now enabled
    await TestHelpers.verifyElementVisible('generate-image-button');
    await detoxExpect(element(by.id('generate-image-button'))).not.toHaveToggleValue(false);
    await TestHelpers.takeScreenshot('10-image-button-enabled');

    // Step 11: Generate image
    await TestHelpers.generateImage();
    await TestHelpers.takeScreenshot('11-image-generated');

    // Step 12: Verify image is displayed
    await TestHelpers.verifyElementVisible('story-image');
    await TestHelpers.takeScreenshot('12-image-displayed');

    // Step 13: Verify upload status (should start as pending)
    await TestHelpers.verifyUploadStatus('pending');
    await TestHelpers.takeScreenshot('13-upload-pending');

    // Step 14: Wait for upload to complete
    await TestHelpers.wait(15000);
    await TestHelpers.verifyUploadStatus('uploaded');
    await TestHelpers.takeScreenshot('14-upload-completed');

    // Step 15: Verify image persists after reload
    await device.reloadReactNative();
    await TestHelpers.waitForElementToBeVisible('home-screen');
    await TestHelpers.verifyElementVisible('story-image');
    await TestHelpers.verifyUploadStatus('uploaded');
    await TestHelpers.takeScreenshot('15-image-persists-after-reload');
  });

  it('should disable image generation until story reaches round 5', async () => {
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);

    // Start new story
    await TestHelpers.startNewStory('3-5');

    // Complete only 3 rounds
    for (let i = 1; i <= 3; i++) {
      await TestHelpers.completeStoryRound(i);
      await TestHelpers.verifyRoundProgress(i + 1, 5);
    }

    // Verify image generation button exists but is disabled
    await TestHelpers.verifyElementVisible('generate-image-button');
    await detoxExpect(element(by.id('generate-image-button'))).toHaveToggleValue(false);

    // Verify progress message shows
    await TestHelpers.verifyTextExists('Complete Your Story First');
    await TestHelpers.verifyTextExists('Progress: Round 4/5');

    await TestHelpers.takeScreenshot('story-incomplete-button-disabled');
  });

  it('should show round progress throughout the story', async () => {
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);
    await TestHelpers.startNewStory('K-2');

    // Track progress through all rounds
    for (let round = 1; round <= 5; round++) {
      // Verify current round indicator
      await TestHelpers.verifyRoundProgress(round, 5);
      await TestHelpers.takeScreenshot(`round-${round}-progress`);

      // Complete the round (except for the last round verification)
      if (round < 5) {
        await TestHelpers.completeStoryRound(round);
      } else {
        // On round 5, just complete it without verifying next round
        await TestHelpers.completeStoryRound(round);
        await TestHelpers.verifyStoryCompleted();
      }
    }
  });

  it('should maintain story state after backgrounding the app', async () => {
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);
    await TestHelpers.startNewStory('K-2');

    // Complete 2 rounds
    await TestHelpers.completeStoryRound(1);
    await TestHelpers.completeStoryRound(2);
    await TestHelpers.verifyRoundProgress(3, 5);

    // Background the app
    await device.sendToHome();
    await TestHelpers.wait(2000);
    await device.launchApp({ newInstance: false });

    // Verify story state is maintained
    await TestHelpers.waitForElementToBeVisible('home-screen');
    await TestHelpers.verifyRoundProgress(3, 5);
    await TestHelpers.verifyElementVisible('story-input');

    await TestHelpers.takeScreenshot('story-state-after-backgrounding');
  });
});
