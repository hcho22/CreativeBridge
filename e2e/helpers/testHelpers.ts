import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

/**
 * Helper functions for E2E tests
 */

export const TestHelpers = {
  /**
   * Wait for an element to be visible with retry logic
   */
  async waitForElementToBeVisible(
    testID: string,
    timeout: number = 10000,
  ): Promise<void> {
    await waitFor(element(by.id(testID)))
      .toBeVisible()
      .withTimeout(timeout);
  },

  /**
   * Wait for text to be visible
   */
  async waitForTextToBeVisible(
    text: string,
    timeout: number = 10000,
  ): Promise<void> {
    await waitFor(element(by.text(text)))
      .toBeVisible()
      .withTimeout(timeout);
  },

  /**
   * Tap on an element by testID
   */
  async tapByTestID(testID: string): Promise<void> {
    await element(by.id(testID)).tap();
  },

  /**
   * Tap on an element by text
   */
  async tapByText(text: string): Promise<void> {
    await element(by.text(text)).tap();
  },

  /**
   * Type text into an input field
   */
  async typeText(testID: string, text: string): Promise<void> {
    await element(by.id(testID)).typeText(text);
  },

  /**
   * Replace text in an input field
   */
  async replaceText(testID: string, text: string): Promise<void> {
    await element(by.id(testID)).replaceText(text);
  },

  /**
   * Clear text from an input field
   */
  async clearText(testID: string): Promise<void> {
    await element(by.id(testID)).clearText();
  },

  /**
   * Scroll to an element
   */
  async scrollTo(testID: string, direction: 'up' | 'down' = 'down'): Promise<void> {
    await element(by.id(testID)).scrollTo(direction === 'down' ? 'bottom' : 'top');
  },

  /**
   * Swipe on an element
   */
  async swipe(
    testID: string,
    direction: 'up' | 'down' | 'left' | 'right',
    speed: 'fast' | 'slow' = 'fast',
  ): Promise<void> {
    await element(by.id(testID)).swipe(direction, speed);
  },

  /**
   * Wait for a specific time
   */
  async wait(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Take a screenshot
   */
  async takeScreenshot(name: string): Promise<void> {
    await device.takeScreenshot(name);
  },

  /**
   * Reload the React Native app
   */
  async reloadReactNative(): Promise<void> {
    await device.reloadReactNative();
  },

  /**
   * Enable/disable network
   */
  async setNetworkState(enabled: boolean): Promise<void> {
    if (device.getPlatform() === 'ios') {
      // iOS doesn't support network toggling via Detox
      console.warn('Network toggling not supported on iOS');
    } else {
      // Android network toggling
      await device.setURLBlacklist(enabled ? [] : ['.*']);
    }
  },

  /**
   * Check if element exists
   */
  async elementExists(testID: string): Promise<boolean> {
    try {
      await detoxExpect(element(by.id(testID))).toExist();
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Wait for element to not be visible
   */
  async waitForElementToNotExist(
    testID: string,
    timeout: number = 10000,
  ): Promise<void> {
    await waitFor(element(by.id(testID)))
      .not.toExist()
      .withTimeout(timeout);
  },

  /**
   * Verify text exists on screen
   */
  async verifyTextExists(text: string): Promise<void> {
    await detoxExpect(element(by.text(text))).toExist();
  },

  /**
   * Verify element is visible
   */
  async verifyElementVisible(testID: string): Promise<void> {
    await detoxExpect(element(by.id(testID))).toBeVisible();
  },

  /**
   * Verify element is not visible
   */
  async verifyElementNotVisible(testID: string): Promise<void> {
    await detoxExpect(element(by.id(testID))).not.toBeVisible();
  },

  /**
   * Complete a story round (user input + AI response)
   */
  async completeStoryRound(roundNumber: number): Promise<void> {
    // Type user contribution
    const userInput = `This is user contribution for round ${roundNumber}. The story continues with exciting adventures.`;
    await this.typeText('story-input', userInput);

    // Submit contribution
    await this.tapByTestID('submit-button');

    // Wait for AI response
    await this.waitForTextToBeVisible('AI:', 30000);

    // Wait a bit for the round to complete
    await this.wait(1000);
  },

  /**
   * Login helper (if needed)
   */
  async login(email: string, password: string): Promise<void> {
    await this.waitForElementToBeVisible('email-input', 10000);
    await this.typeText('email-input', email);
    await this.typeText('password-input', password);
    await this.tapByTestID('login-button');
    await this.waitForElementToBeVisible('home-screen', 15000);
  },

  /**
   * Navigate to settings screen
   */
  async navigateToSettings(): Promise<void> {
    await this.tapByTestID('settings-tab');
    await this.waitForElementToBeVisible('settings-screen');
  },

  /**
   * Navigate to home screen
   */
  async navigateToHome(): Promise<void> {
    await this.tapByTestID('home-tab');
    await this.waitForElementToBeVisible('home-screen');
  },

  /**
   * Start a new story
   */
  async startNewStory(gradeLevel: 'K-2' | '3-5' | '6-8' = 'K-2'): Promise<void> {
    await this.waitForElementToBeVisible('start-new-story-button');
    await this.tapByTestID('start-new-story-button');

    // Select grade level if picker appears
    try {
      await this.waitForElementToBeVisible(`grade-level-${gradeLevel}`, 2000);
      await this.tapByTestID(`grade-level-${gradeLevel}`);
    } catch {
      // Grade level might already be selected
    }

    // Wait for story input to be ready
    await this.waitForElementToBeVisible('story-input');
  },

  /**
   * Verify round progress indicator
   */
  async verifyRoundProgress(currentRound: number, maxRounds: number = 5): Promise<void> {
    await this.verifyTextExists(`Round ${currentRound}/${maxRounds}`);
  },

  /**
   * Verify story completion
   */
  async verifyStoryCompleted(): Promise<void> {
    await this.waitForTextToBeVisible('Story Complete!', 5000);
  },

  /**
   * Generate image for completed story
   */
  async generateImage(): Promise<void> {
    await this.waitForElementToBeVisible('generate-image-button');
    await this.tapByTestID('generate-image-button');

    // Wait for image generation to complete (can take up to 60 seconds)
    await this.waitForElementToBeVisible('story-image', 60000);
  },

  /**
   * Verify image upload status badge
   */
  async verifyUploadStatus(status: 'pending' | 'uploaded' | 'failed'): Promise<void> {
    const statusMessages = {
      pending: 'Backing up to permanent storage',
      uploaded: 'Permanently saved',
      failed: 'Backup failed',
    };

    await this.waitForTextToBeVisible(statusMessages[status], 20000);
  },

  /**
   * Retry failed image upload
   */
  async retryImageUpload(): Promise<void> {
    await this.waitForElementToBeVisible('retry-upload-button');
    await this.tapByTestID('retry-upload-button');
  },
};
