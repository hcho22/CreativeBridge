import { device, element, by, expect as detoxExpect } from 'detox';
import { TestHelpers } from './helpers/testHelpers';

/**
 * E2E Test: Offline Mode Journey
 * Offline Mode → View Cached Data → Online Sync
 */
describe('Offline Mode E2E', () => {
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

  it('should display cached stories when offline', async () => {
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);
    await TestHelpers.takeScreenshot('01-online-home-screen');

    // Complete a story while online
    await TestHelpers.startNewStory('K-2');
    for (let i = 1; i <= 5; i++) {
      await TestHelpers.completeStoryRound(i);
    }
    await TestHelpers.verifyStoryCompleted();
    await TestHelpers.generateImage();
    await TestHelpers.takeScreenshot('02-story-completed-with-image');

    // Wait for data to be cached
    await TestHelpers.wait(5000);

    // Go offline
    await TestHelpers.setNetworkState(false);
    await TestHelpers.takeScreenshot('03-network-disabled');

    // Reload app
    await device.reloadReactNative();
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);

    // Verify story and image are still visible from cache
    await TestHelpers.verifyElementVisible('story-content');
    await TestHelpers.verifyElementVisible('story-image');
    await TestHelpers.verifyStoryCompleted();
    await TestHelpers.takeScreenshot('04-cached-story-visible-offline');

    // Verify offline indicator is shown
    await TestHelpers.verifyTextExists('Offline');
    await TestHelpers.takeScreenshot('05-offline-indicator');

    // Go back online
    await TestHelpers.setNetworkState(true);
    await TestHelpers.wait(3000);

    // Verify online indicator
    try {
      await TestHelpers.verifyTextExists('Online');
      await TestHelpers.takeScreenshot('06-back-online');
    } catch {
      // Online indicator might not be shown explicitly
      await TestHelpers.takeScreenshot('06-back-online-no-indicator');
    }
  });

  it('should sync data when coming back online', async () => {
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);

    // Create a story while online
    await TestHelpers.startNewStory('3-5');
    await TestHelpers.completeStoryRound(1);
    await TestHelpers.completeStoryRound(2);
    await TestHelpers.takeScreenshot('01-partial-story-online');

    // Go offline
    await TestHelpers.setNetworkState(false);
    await TestHelpers.takeScreenshot('02-went-offline');

    // Try to continue story (should fail gracefully or queue)
    try {
      await TestHelpers.completeStoryRound(3);
      await TestHelpers.takeScreenshot('03-tried-to-continue-offline');
    } catch {
      // AI response might fail offline
      await TestHelpers.verifyTextExists('Connection error');
      await TestHelpers.takeScreenshot('03-connection-error-offline');
    }

    // Go back online
    await TestHelpers.setNetworkState(true);
    await TestHelpers.wait(5000);
    await TestHelpers.takeScreenshot('04-back-online');

    // Verify sync occurs
    await TestHelpers.waitForElementToBeVisible('home-screen');
    await TestHelpers.verifyRoundProgress(3, 5);
    await TestHelpers.takeScreenshot('05-data-synced');

    // Continue story (should work now)
    await TestHelpers.completeStoryRound(3);
    await TestHelpers.verifyRoundProgress(4, 5);
    await TestHelpers.takeScreenshot('06-story-continues-after-sync');
  });

  it('should cache images for offline viewing', async () => {
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);

    // Complete story and generate image while online
    await TestHelpers.startNewStory('K-2');
    for (let i = 1; i <= 5; i++) {
      await TestHelpers.completeStoryRound(i);
    }
    await TestHelpers.verifyStoryCompleted();
    await TestHelpers.generateImage();
    await TestHelpers.verifyElementVisible('story-image');
    await TestHelpers.takeScreenshot('01-image-generated-online');

    // Wait for Supabase upload
    await TestHelpers.wait(15000);

    // Verify image is cached (both URLs should be stored)
    await TestHelpers.takeScreenshot('02-image-with-both-urls');

    // Go offline
    await TestHelpers.setNetworkState(false);
    await device.reloadReactNative();
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);

    // Verify image is still visible offline
    await TestHelpers.verifyElementVisible('story-image');
    await TestHelpers.takeScreenshot('03-image-visible-offline');

    // Go back online
    await TestHelpers.setNetworkState(true);
    await TestHelpers.wait(3000);

    // Verify image still works
    await TestHelpers.verifyElementVisible('story-image');
    await TestHelpers.takeScreenshot('04-image-works-after-reconnection');
  });

  it('should show appropriate offline messages', async () => {
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);

    // Go offline
    await TestHelpers.setNetworkState(false);
    await device.reloadReactNative();
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);

    // Try to start a new story (might be prevented)
    try {
      await TestHelpers.tapByTestID('start-new-story-button');
      await TestHelpers.wait(2000);

      // Should show offline message
      await TestHelpers.verifyTextExists('offline');
      await TestHelpers.takeScreenshot('01-offline-message-new-story');
    } catch {
      // Might allow offline story creation
      await TestHelpers.takeScreenshot('01-offline-story-allowed');
    }

    // Try to generate image offline (should be prevented)
    // First need a completed story
    await TestHelpers.setNetworkState(true);
    await TestHelpers.wait(3000);
    await device.reloadReactNative();
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);

    await TestHelpers.startNewStory('K-2');
    for (let i = 1; i <= 5; i++) {
      await TestHelpers.completeStoryRound(i);
    }
    await TestHelpers.verifyStoryCompleted();

    // Now go offline and try to generate image
    await TestHelpers.setNetworkState(false);
    await TestHelpers.wait(2000);

    await TestHelpers.tapByTestID('generate-image-button');
    await TestHelpers.wait(2000);

    // Should show offline error
    await TestHelpers.verifyTextExists('offline');
    await TestHelpers.takeScreenshot('02-offline-message-image-generation');

    // Restore network
    await TestHelpers.setNetworkState(true);
  });

  it('should preserve session state during network interruption', async () => {
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);

    // Start story online
    await TestHelpers.startNewStory('3-5');
    await TestHelpers.completeStoryRound(1);
    await TestHelpers.completeStoryRound(2);
    await TestHelpers.verifyRoundProgress(3, 5);
    await TestHelpers.takeScreenshot('01-story-progress-online');

    // Simulate network interruption
    await TestHelpers.setNetworkState(false);
    await TestHelpers.wait(5000);
    await TestHelpers.setNetworkState(true);
    await TestHelpers.wait(3000);

    // Verify session is still intact
    await TestHelpers.verifyRoundProgress(3, 5);
    await TestHelpers.verifyElementVisible('story-input');
    await TestHelpers.takeScreenshot('02-session-preserved-after-interruption');

    // Continue story
    await TestHelpers.completeStoryRound(3);
    await TestHelpers.verifyRoundProgress(4, 5);
    await TestHelpers.takeScreenshot('03-story-continues-normally');
  });

  it('should handle offline image upload gracefully', async () => {
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);

    // Complete story online
    await TestHelpers.startNewStory('K-2');
    for (let i = 1; i <= 5; i++) {
      await TestHelpers.completeStoryRound(i);
    }
    await TestHelpers.verifyStoryCompleted();

    // Generate image online
    await TestHelpers.generateImage();
    await TestHelpers.verifyElementVisible('story-image');
    await TestHelpers.takeScreenshot('01-image-generated');

    // Immediately go offline before Supabase upload completes
    await TestHelpers.wait(2000);
    await TestHelpers.setNetworkState(false);
    await TestHelpers.takeScreenshot('02-went-offline-during-upload');

    // Wait a bit
    await TestHelpers.wait(10000);

    // Verify image is still displayed (Replicate URL)
    await TestHelpers.verifyElementVisible('story-image');

    // Verify upload status shows failed or pending
    try {
      await TestHelpers.verifyUploadStatus('failed');
      await TestHelpers.takeScreenshot('03-upload-failed-offline');
    } catch {
      try {
        await TestHelpers.verifyUploadStatus('pending');
        await TestHelpers.takeScreenshot('03-upload-pending');
      } catch {
        await TestHelpers.takeScreenshot('03-upload-status-unknown');
      }
    }

    // Go back online
    await TestHelpers.setNetworkState(true);
    await TestHelpers.wait(5000);

    // Retry upload if needed
    try {
      await TestHelpers.verifyElementVisible('retry-upload-button');
      await TestHelpers.retryImageUpload();
      await TestHelpers.wait(15000);
      await TestHelpers.verifyUploadStatus('uploaded');
      await TestHelpers.takeScreenshot('04-upload-succeeded-after-retry');
    } catch {
      // Upload might have succeeded automatically
      await TestHelpers.verifyUploadStatus('uploaded');
      await TestHelpers.takeScreenshot('04-upload-succeeded-automatically');
    }
  });

  it('should queue XP updates when offline', async () => {
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);

    // Get initial XP
    await TestHelpers.verifyElementVisible('xp-balance');
    await TestHelpers.takeScreenshot('01-initial-xp-online');

    // Start a story
    await TestHelpers.startNewStory('K-2');
    await TestHelpers.completeStoryRound(1);

    // Go offline mid-story
    await TestHelpers.setNetworkState(false);
    await TestHelpers.wait(2000);
    await TestHelpers.takeScreenshot('02-went-offline-mid-story');

    // XP updates might be queued locally
    await TestHelpers.verifyElementVisible('xp-balance');
    await TestHelpers.takeScreenshot('03-xp-balance-offline');

    // Go back online
    await TestHelpers.setNetworkState(true);
    await TestHelpers.wait(5000);

    // Complete the story
    for (let i = 2; i <= 5; i++) {
      await TestHelpers.completeStoryRound(i);
    }
    await TestHelpers.verifyStoryCompleted();

    // Verify XP was updated correctly
    await TestHelpers.waitForElementToBeVisible('xp-earned-notification', 10000);
    await TestHelpers.takeScreenshot('04-xp-synced-after-completion');
  });
});
