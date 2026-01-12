# End-to-End Testing Guide

This directory contains E2E tests for the CreativeBridge app using Detox.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Writing Tests](#writing-tests)
- [Troubleshooting](#troubleshooting)
- [CI/CD Integration](#cicd-integration)

## Prerequisites

### iOS Testing

- macOS with Xcode 14+ installed
- iOS Simulator
- CocoaPods
- Detox CLI: `npm install -g detox-cli`

### Android Testing

- Android Studio
- Android SDK
- Android Emulator (API 34 recommended)
- Java 17+

## Installation

1. **Install dependencies:**

```bash
npm install
```

2. **Install Detox CLI globally:**

```bash
npm install -g detox-cli
```

3. **Build the app for testing:**

For iOS:
```bash
npm run e2e:build:ios
```

For Android:
```bash
npm run e2e:build:android
```

## Running Tests

### iOS

**Run all E2E tests on iOS simulator:**
```bash
npm run e2e:ios
```

**Run specific test file:**
```bash
detox test e2e/storyCompletionJourney.e2e.ts --configuration ios.sim.debug
```

**Run with debugging:**
```bash
detox test --configuration ios.sim.debug --loglevel verbose
```

### Android

**Run all E2E tests on Android emulator:**
```bash
npm run e2e:android
```

**Run specific test file:**
```bash
detox test e2e/storyCompletionJourney.e2e.ts --configuration android.emu.debug
```

**Run with debugging:**
```bash
detox test --configuration android.emu.debug --loglevel verbose
```

### Run All Tests (Both Platforms)

```bash
npm run e2e:all
```

## Test Structure

```
e2e/
├── helpers/
│   └── testHelpers.ts          # Reusable test utilities
├── storyCompletionJourney.e2e.ts    # Story completion flow tests
├── xpManagementJourney.e2e.ts       # XP management tests
├── retryUpload.e2e.ts               # Upload retry tests
├── offlineMode.e2e.ts               # Offline mode tests
├── jest.config.js                    # Jest configuration for E2E
└── README.md                         # This file
```

## Test Suites

### 1. Story Completion Journey (`storyCompletionJourney.e2e.ts`)

Tests the complete user journey from creating a story to viewing the generated image.

**Test Cases:**
- ✅ Complete full story journey (5 rounds → completion → image generation)
- ✅ Image generation disabled until story completion
- ✅ Round progress tracking
- ✅ Story state persistence after backgrounding

**Run:**
```bash
detox test e2e/storyCompletionJourney.e2e.ts --configuration ios.sim.debug
```

### 2. XP Management Journey (`xpManagementJourney.e2e.ts`)

Tests XP balance checking, earning, and spending for image generation.

**Test Cases:**
- ✅ Prevent image generation with insufficient XP
- ✅ Allow generation after earning sufficient XP
- ✅ Display XP balance throughout app
- ✅ Show XP cost for image generation
- ✅ Refund XP on generation failure
- ✅ Real-time XP balance updates

**Run:**
```bash
detox test e2e/xpManagementJourney.e2e.ts --configuration ios.sim.debug
```

### 3. Image Upload Retry (`retryUpload.e2e.ts`)

Tests image upload failure scenarios and retry functionality.

**Test Cases:**
- ✅ Show retry button when upload fails
- ✅ Successfully retry failed upload
- ✅ Show upload progress indicator
- ✅ Preserve Replicate URL on Supabase upload failure
- ✅ Display appropriate error messages
- ✅ Allow multiple retry attempts
- ✅ XP handling for upload failures

**Run:**
```bash
detox test e2e/retryUpload.e2e.ts --configuration ios.sim.debug
```

### 4. Offline Mode (`offlineMode.e2e.ts`)

Tests offline functionality and data synchronization.

**Test Cases:**
- ✅ Display cached stories when offline
- ✅ Sync data when coming back online
- ✅ Cache images for offline viewing
- ✅ Show appropriate offline messages
- ✅ Preserve session state during network interruption
- ✅ Handle offline image upload gracefully
- ✅ Queue XP updates when offline

**Run:**
```bash
detox test e2e/offlineMode.e2e.ts --configuration ios.sim.debug
```

## Writing Tests

### Basic Test Structure

```typescript
import { device, element, by, expect as detoxExpect } from 'detox';
import { TestHelpers } from './helpers/testHelpers';

describe('My Feature E2E', () => {
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

  it('should do something', async () => {
    await TestHelpers.waitForElementToBeVisible('my-element');
    await TestHelpers.tapByTestID('my-button');
    await TestHelpers.verifyTextExists('Expected text');
  });
});
```

### Using Test Helpers

The `TestHelpers` object provides reusable utilities:

```typescript
// Wait for elements
await TestHelpers.waitForElementToBeVisible('testID', timeout);
await TestHelpers.waitForTextToBeVisible('text', timeout);

// Interact with elements
await TestHelpers.tapByTestID('button-testID');
await TestHelpers.typeText('input-testID', 'text to type');
await TestHelpers.replaceText('input-testID', 'replacement text');

// Verify state
await TestHelpers.verifyTextExists('expected text');
await TestHelpers.verifyElementVisible('testID');
await TestHelpers.verifyElementNotVisible('testID');

// Story-specific helpers
await TestHelpers.startNewStory('K-2');
await TestHelpers.completeStoryRound(roundNumber);
await TestHelpers.verifyRoundProgress(currentRound, maxRounds);
await TestHelpers.generateImage();
await TestHelpers.verifyUploadStatus('uploaded');

// Screenshots
await TestHelpers.takeScreenshot('screenshot-name');

// Network control
await TestHelpers.setNetworkState(false); // Go offline
await TestHelpers.setNetworkState(true);  // Go online
```

### Adding testID to Components

For Detox to find elements, add `testID` props:

```tsx
// Button
<TouchableOpacity testID="submit-button" onPress={handleSubmit}>
  <Text>Submit</Text>
</TouchableOpacity>

// Input
<TextInput
  testID="story-input"
  placeholder="Write your story"
  value={text}
  onChangeText={setText}
/>

// View
<View testID="home-screen">
  {/* content */}
</View>

// Image
<Image testID="story-image" source={{ uri: imageUrl }} />
```

### Best Practices

1. **Use descriptive testIDs**: Use kebab-case like `generate-image-button`
2. **Take screenshots**: Take screenshots at key points for debugging
3. **Use explicit waits**: Always wait for elements before interacting
4. **Handle async operations**: Use appropriate timeouts for network calls
5. **Keep tests isolated**: Each test should be independent
6. **Clean up**: Reset app state between tests
7. **Test real user flows**: Focus on complete user journeys

## Troubleshooting

### iOS Issues

**Problem: "Command failed: xcodebuild"**

Solution:
```bash
cd ios
pod install
cd ..
npm run e2e:build:ios
```

**Problem: Simulator not booting**

Solution:
```bash
# List available simulators
xcrun simctl list devices

# Boot specific simulator
xcrun simctl boot "iPhone 15 Pro"
```

**Problem: "Cannot find app bundle"**

Solution: Make sure you've built the app first:
```bash
npm run e2e:build:ios
```

### Android Issues

**Problem: "No emulator found"**

Solution:
```bash
# List available AVDs
emulator -list-avds

# Start specific emulator
emulator -avd Pixel_7_API_34
```

**Problem: "Build failed"**

Solution:
```bash
cd android
./gradlew clean
cd ..
npm run e2e:build:android
```

**Problem: "Detox can't sync with app"**

Solution: Add Detox dependency to your `android/app/build.gradle`:
```gradle
androidTestImplementation('com.wix:detox:+')
```

### General Issues

**Problem: "Element not found"**

- Verify `testID` is correctly set in component
- Check if element is rendered conditionally
- Increase timeout for slow operations
- Use `TestHelpers.takeScreenshot()` to see current state

**Problem: "Tests are flaky"**

- Increase timeouts for network operations
- Add explicit waits before interactions
- Ensure proper cleanup between tests
- Check for race conditions

**Problem: "Network toggling doesn't work on iOS"**

- iOS doesn't support programmatic network toggling via Detox
- Use test environment configuration instead
- Mock API responses for offline testing

## CI/CD Integration

### GitHub Actions

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install Detox CLI
        run: npm install -g detox-cli

      - name: Build iOS app
        run: npm run e2e:build:ios

      - name: Run E2E tests
        run: npm run e2e:test:ios

      - name: Upload screenshots
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: e2e-screenshots-ios
          path: artifacts/

  e2e-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Set up Java
        uses: actions/setup-java@v3
        with:
          distribution: 'zulu'
          java-version: '17'

      - name: Install dependencies
        run: npm ci

      - name: Install Detox CLI
        run: npm install -g detox-cli

      - name: Build Android app
        run: npm run e2e:build:android

      - name: Run E2E tests
        run: npm run e2e:test:android

      - name: Upload screenshots
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: e2e-screenshots-android
          path: artifacts/
```

## Test Coverage Goals

As per Task 6.3 requirements:

- ✅ All E2E tests pass on iOS
- ✅ All E2E tests pass on Android
- ⚠️ Tests run on real devices (currently simulator/emulator only)
- ✅ All critical user journeys covered:
  - Story completion flow
  - Image generation with XP management
  - Upload retry functionality
  - Offline mode and sync

## Performance Benchmarks

Expected test execution times:

- Story Completion Journey: ~8-12 minutes
- XP Management Journey: ~5-8 minutes
- Retry Upload: ~3-5 minutes
- Offline Mode: ~4-6 minutes

**Total E2E Suite: ~12-15 minutes per platform**

## Screenshots

Screenshots are automatically saved to the `artifacts/` directory when tests run. You can find them organized by:
- Platform (ios/android)
- Configuration (debug/release)
- Test name
- Screenshot name

Example: `artifacts/ios.sim.debug/storyCompletionJourney/01-home-screen.png`

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review Detox documentation: https://wix.github.io/Detox/
3. Check existing tests for examples
4. Contact the development team

## Next Steps

- [ ] Set up CI/CD pipeline for automated E2E testing
- [ ] Add tests for real devices (not just simulators/emulators)
- [ ] Expand test coverage for edge cases
- [ ] Add performance testing metrics
- [ ] Integrate with crash reporting tools
