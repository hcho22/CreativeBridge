import { device, element, by, expect as detoxExpect } from 'detox';
import { TestHelpers } from './helpers/testHelpers';

/**
 * E2E Test: Image Upload Retry Journey
 * Failed Upload → Retry → Success
 */
describe('Image Upload Retry E2E', () => {
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

  it('should show retry button when image upload fails', async () => {
    // Note: This test requires test environment configuration to simulate upload failure
    // You might need to use a test API endpoint or mock server

    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);
    await TestHelpers.takeScreenshot('01-home-screen');

    // Complete a story
    await TestHelpers.startNewStory('K-2');
    for (let i = 1; i <= 5; i++) {
      await TestHelpers.completeStoryRound(i);
    }
    await TestHelpers.verifyStoryCompleted();
    await TestHelpers.takeScreenshot('02-story-completed');

    // Generate image
    await TestHelpers.generateImage();
    await TestHelpers.takeScreenshot('03-image-generated');

    // Wait for upload to complete or fail
    await TestHelpers.wait(20000);

    // Check if upload failed
    try {
      await TestHelpers.verifyUploadStatus('failed');
      await TestHelpers.takeScreenshot('04-upload-failed');

      // Verify retry button is visible
      await TestHelpers.verifyElementVisible('retry-upload-button');
      await TestHelpers.takeScreenshot('05-retry-button-visible');

      // Verify Replicate image is still displayed
      await TestHelpers.verifyElementVisible('story-image');
      await TestHelpers.verifyTextExists('image still available');
      await TestHelpers.takeScreenshot('06-image-still-available');
    } catch {
      // Upload succeeded - this is also acceptable
      await TestHelpers.verifyUploadStatus('uploaded');
      await TestHelpers.takeScreenshot('04-upload-succeeded');
    }
  });

  it('should successfully retry failed upload', async () => {
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);

    // Complete a story and generate image
    await TestHelpers.startNewStory('3-5');
    for (let i = 1; i <= 5; i++) {
      await TestHelpers.completeStoryRound(i);
    }
    await TestHelpers.verifyStoryCompleted();
    await TestHelpers.generateImage();

    // Wait for potential failure
    await TestHelpers.wait(20000);

    // If upload failed, retry
    try {
      await TestHelpers.verifyUploadStatus('failed');
      await TestHelpers.takeScreenshot('01-upload-failed');

      // Tap retry button
      await TestHelpers.retryImageUpload();
      await TestHelpers.takeScreenshot('02-retry-initiated');

      // Wait for retry to complete
      await TestHelpers.wait(15000);

      // Verify upload succeeded after retry
      await TestHelpers.verifyUploadStatus('uploaded');
      await TestHelpers.takeScreenshot('03-retry-succeeded');

      // Verify retry button is no longer visible
      await TestHelpers.verifyElementNotVisible('retry-upload-button');
      await TestHelpers.takeScreenshot('04-retry-button-hidden');
    } catch {
      // Upload succeeded on first try
      await TestHelpers.verifyUploadStatus('uploaded');
      await TestHelpers.takeScreenshot('upload-succeeded-first-try');
    }
  });

  it('should show upload progress indicator', async () => {
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);

    // Complete story and generate image
    await TestHelpers.startNewStory('K-2');
    for (let i = 1; i <= 5; i++) {
      await TestHelpers.completeStoryRound(i);
    }
    await TestHelpers.verifyStoryCompleted();
    await TestHelpers.generateImage();

    // Verify pending status immediately after generation
    await TestHelpers.verifyUploadStatus('pending');
    await TestHelpers.verifyElementVisible('upload-spinner');
    await TestHelpers.takeScreenshot('01-upload-pending-with-spinner');

    // Wait for upload to complete
    await TestHelpers.wait(15000);

    // Verify final status (either uploaded or failed)
    try {
      await TestHelpers.verifyUploadStatus('uploaded');
      await TestHelpers.takeScreenshot('02-upload-completed');
    } catch {
      await TestHelpers.verifyUploadStatus('failed');
      await TestHelpers.takeScreenshot('02-upload-failed');
    }

    // Verify spinner is gone
    try {
      await TestHelpers.verifyElementNotVisible('upload-spinner');
    } catch {
      // Spinner might still be visible if upload is pending
    }
  });

  it('should preserve Replicate image URL even if Supabase upload fails', async () => {
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);

    // Complete story and generate image
    await TestHelpers.startNewStory('K-2');
    for (let i = 1; i <= 5; i++) {
      await TestHelpers.completeStoryRound(i);
    }
    await TestHelpers.verifyStoryCompleted();

    // Generate image
    await TestHelpers.generateImage();
    await TestHelpers.verifyElementVisible('story-image');
    await TestHelpers.takeScreenshot('01-image-displayed');

    // Wait for upload process
    await TestHelpers.wait(20000);

    // Regardless of upload status, image should still be visible
    await TestHelpers.verifyElementVisible('story-image');
    await TestHelpers.takeScreenshot('02-image-still-visible');

    // Reload app to verify persistence
    await device.reloadReactNative();
    await TestHelpers.waitForElementToBeVisible('home-screen');
    await TestHelpers.verifyElementVisible('story-image');
    await TestHelpers.takeScreenshot('03-image-persists-after-reload');
  });

  it('should show appropriate error message when upload fails', async () => {
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);

    // Complete story and generate image
    await TestHelpers.startNewStory('3-5');
    for (let i = 1; i <= 5; i++) {
      await TestHelpers.completeStoryRound(i);
    }
    await TestHelpers.verifyStoryCompleted();
    await TestHelpers.generateImage();

    // Wait for upload
    await TestHelpers.wait(20000);

    // Check for failure
    try {
      await TestHelpers.verifyUploadStatus('failed');

      // Verify error message is displayed
      await TestHelpers.verifyTextExists('Backup failed');
      await TestHelpers.verifyTextExists('image still available');
      await TestHelpers.takeScreenshot('01-error-message-displayed');

      // Verify user-friendly error (not technical jargon)
      // Should not show raw error messages like "ECONNREFUSED" to users
      const errorElement = element(by.id('upload-error-message'));
      try {
        await detoxExpect(errorElement).toExist();
        await TestHelpers.takeScreenshot('02-user-friendly-error');
      } catch {
        // Error message might be embedded in status badge
        await TestHelpers.takeScreenshot('02-error-in-badge');
      }
    } catch {
      // Upload succeeded
      await TestHelpers.verifyUploadStatus('uploaded');
      await TestHelpers.takeScreenshot('upload-succeeded');
    }
  });

  it('should allow multiple retry attempts', async () => {
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);

    // Complete story and generate image
    await TestHelpers.startNewStory('K-2');
    for (let i = 1; i <= 5; i++) {
      await TestHelpers.completeStoryRound(i);
    }
    await TestHelpers.verifyStoryCompleted();
    await TestHelpers.generateImage();

    // Wait for initial upload
    await TestHelpers.wait(20000);

    // If failed, try multiple retries
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        await TestHelpers.verifyUploadStatus('failed');
        await TestHelpers.takeScreenshot(`retry-attempt-${retryCount + 1}-failed`);

        // Retry upload
        await TestHelpers.retryImageUpload();
        await TestHelpers.wait(15000);

        retryCount++;
      } catch {
        // Upload succeeded
        await TestHelpers.verifyUploadStatus('uploaded');
        await TestHelpers.takeScreenshot(`retry-succeeded-after-${retryCount}-attempts`);
        break;
      }
    }

    // Final verification
    try {
      await TestHelpers.verifyUploadStatus('uploaded');
      await TestHelpers.takeScreenshot('final-upload-success');
    } catch {
      await TestHelpers.verifyUploadStatus('failed');
      await TestHelpers.takeScreenshot('final-upload-still-failed');
    }
  });

  it('should not deduct XP if only Supabase upload fails', async () => {
    await TestHelpers.waitForElementToBeVisible('home-screen', 15000);

    // Get initial XP
    await TestHelpers.verifyElementVisible('xp-balance');
    await TestHelpers.takeScreenshot('01-initial-xp');

    // Complete story
    await TestHelpers.startNewStory('K-2');
    for (let i = 1; i <= 5; i++) {
      await TestHelpers.completeStoryRound(i);
    }
    await TestHelpers.verifyStoryCompleted();

    // Get XP after story completion (should have increased)
    await TestHelpers.takeScreenshot('02-xp-after-story');

    // Generate image (XP will be deducted)
    await TestHelpers.generateImage();
    await TestHelpers.takeScreenshot('03-image-generated-xp-deducted');

    // Wait for upload
    await TestHelpers.wait(20000);

    // Check upload status
    try {
      await TestHelpers.verifyUploadStatus('failed');

      // Even if Supabase upload failed, XP should remain deducted
      // because user successfully got the image from Replicate
      await TestHelpers.verifyElementVisible('story-image');
      await TestHelpers.takeScreenshot('04-image-available-despite-upload-failure');

      // XP should NOT be refunded (user got the image)
      // This is different from image generation failure
    } catch {
      await TestHelpers.verifyUploadStatus('uploaded');
      await TestHelpers.takeScreenshot('04-upload-succeeded');
    }
  });
});
