# E2E Testing Setup Guide

Complete setup guide for running E2E tests for CreativeBridge.

## Quick Start

```bash
# Install dependencies
npm install

# Install Detox CLI globally
npm install -g detox-cli

# iOS: Build and run tests
npm run e2e:ios

# Android: Build and run tests
npm run e2e:android
```

## Detailed Setup

### 1. System Requirements

#### macOS (for iOS testing)
- macOS 12.0 or later
- Xcode 14.0 or later
- CocoaPods 1.11.0 or later
- Node.js 20+ and npm

#### All platforms (for Android testing)
- Node.js 20+ and npm
- Java Development Kit (JDK) 17
- Android Studio with Android SDK
- Android Emulator (API 34)

### 2. Install Detox

```bash
# Install Detox CLI globally
npm install -g detox-cli

# Verify installation
detox --version
```

### 3. iOS Setup

#### Install Xcode Command Line Tools

```bash
xcode-select --install
```

#### Install applesimutils (required for Detox on iOS)

```bash
brew tap wix/brew
brew install applesimutils
```

#### Install CocoaPods dependencies

```bash
cd ios
pod install
cd ..
```

#### Create iOS Simulator

Open Xcode → Window → Devices and Simulators → Simulators → Click "+" to add:
- Device Type: iPhone 15 Pro
- OS Version: Latest iOS

Or via command line:
```bash
xcrun simctl create "iPhone 15 Pro" "iPhone 15 Pro"
```

#### Build the iOS app for testing

```bash
npm run e2e:build:ios
```

This will:
1. Build the app with Detox configuration
2. Create the app bundle in `ios/build/Build/Products/Debug-iphonesimulator/`

### 4. Android Setup

#### Install Android Studio

Download from: https://developer.android.com/studio

#### Set up Android SDK

1. Open Android Studio
2. Go to Tools → SDK Manager
3. Install:
   - Android SDK Platform 34
   - Android SDK Build-Tools 34.0.0
   - Android Emulator
   - Intel x86 Emulator Accelerator (HAXM installer)

#### Set environment variables

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

Reload:
```bash
source ~/.zshrc  # or source ~/.bashrc
```

#### Create Android Virtual Device (AVD)

Via Android Studio:
1. Tools → Device Manager
2. Click "Create Device"
3. Select: Pixel 7
4. Select System Image: API 34 (Android 14.0)
5. Name: `Pixel_7_API_34`
6. Click Finish

Via command line:
```bash
# List available system images
sdkmanager --list | grep system-images

# Download system image
sdkmanager "system-images;android-34;google_apis;x86_64"

# Create AVD
avdmanager create avd -n Pixel_7_API_34 -k "system-images;android-34;google_apis;x86_64" -d "pixel_7"
```

#### Build the Android app for testing

```bash
npm run e2e:build:android
```

This will:
1. Build the debug APK
2. Build the Android test APK
3. Place APKs in `android/app/build/outputs/apk/`

### 5. Verify Setup

#### iOS Verification

```bash
# List available simulators
xcrun simctl list devices

# Verify applesimutils
applesimutils --list

# Test build
npm run e2e:build:ios

# Expected output: "BUILD SUCCEEDED"
```

#### Android Verification

```bash
# List available AVDs
emulator -list-avds

# Verify Android SDK
adb version

# Test build
npm run e2e:build:android

# Expected output: "BUILD SUCCESSFUL"
```

### 6. Run Your First Test

#### iOS

```bash
# Run all tests
npm run e2e:test:ios

# Run specific test file
detox test e2e/storyCompletionJourney.e2e.ts --configuration ios.sim.debug

# Run with debug logs
detox test --configuration ios.sim.debug --loglevel verbose
```

#### Android

Start emulator first:
```bash
# Start emulator in background
emulator -avd Pixel_7_API_34 &

# Wait for emulator to boot
adb wait-for-device
```

Then run tests:
```bash
# Run all tests
npm run e2e:test:android

# Run specific test file
detox test e2e/storyCompletionJourney.e2e.ts --configuration android.emu.debug

# Run with debug logs
detox test --configuration android.emu.debug --loglevel verbose
```

## Configuration Files

### `.detoxrc.js`

Main Detox configuration file. Defines:
- Test runner (Jest)
- App build commands
- Device configurations
- Test configurations

### `e2e/jest.config.js`

Jest configuration for E2E tests. Defines:
- Test file patterns
- Timeouts
- Setup/teardown scripts
- Environment

## Common Issues and Solutions

### Issue: "Command PhaseScriptExecution failed with a nonzero exit code" (iOS)

**Solution:**
```bash
cd ios
pod deintegrate
pod install
cd ..
npm run e2e:build:ios
```

### Issue: "No emulator found" (Android)

**Solution:**
```bash
# Start emulator manually
emulator -avd Pixel_7_API_34

# Or create a new one
avdmanager create avd -n Pixel_7_API_34 -k "system-images;android-34;google_apis;x86_64"
```

### Issue: "Detox can't communicate with the app"

**iOS Solution:**
- Make sure simulator is running: `open -a Simulator`
- Rebuild the app: `npm run e2e:build:ios`
- Check that applesimutils is installed: `applesimutils --list`

**Android Solution:**
- Make sure emulator is running: `adb devices`
- Rebuild the app: `npm run e2e:build:android`
- Check reverse ports: `adb reverse tcp:8081 tcp:8081`

### Issue: "App crashes on launch during tests"

**Solution:**
- Check if the app runs normally: `npm run ios` or `npm run android`
- Look at console logs for errors
- Verify all native dependencies are properly linked
- Try clean build:
  - iOS: `cd ios && xcodebuild clean && cd ..`
  - Android: `cd android && ./gradlew clean && cd ..`

### Issue: Tests are timing out

**Solution:**
- Increase timeout in test: `await TestHelpers.waitForElementToBeVisible('id', 30000)`
- Check network connectivity (tests may be waiting for API responses)
- Ensure device/simulator has enough resources
- Close other apps to free up CPU/memory

### Issue: "Cannot find module 'detox'"

**Solution:**
```bash
npm install
npm install -g detox-cli
```

## Environment Setup for Different Operating Systems

### macOS

Best option - can test both iOS and Android:
```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node

# Install Watchman (recommended)
brew install watchman

# Install applesimutils for iOS
brew tap wix/brew
brew install applesimutils

# Install Java for Android
brew install --cask zulu17
```

### Linux (Ubuntu/Debian)

Can only test Android:
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Java
sudo apt-get install -y openjdk-17-jdk

# Set JAVA_HOME
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' >> ~/.bashrc
source ~/.bashrc
```

### Windows

Can only test Android:
```bash
# Install Node.js from: https://nodejs.org/

# Install Java from: https://www.oracle.com/java/technologies/downloads/

# Install Android Studio from: https://developer.android.com/studio

# Set environment variables in System Properties → Environment Variables:
# ANDROID_HOME: C:\Users\<username>\AppData\Local\Android\Sdk
# JAVA_HOME: C:\Program Files\Java\jdk-17
```

## Running Tests in Different Modes

### Debug Mode (Default)

Slower but easier to debug:
```bash
npm run e2e:test:ios
npm run e2e:test:android
```

### Release Mode

Faster, production-like:
```bash
npm run e2e:build:ios:release
npm run e2e:test:ios:release

npm run e2e:build:android:release
npm run e2e:test:android:release
```

### Reuse Existing Build

If you've already built the app:
```bash
detox test --configuration ios.sim.debug --reuse
detox test --configuration android.emu.debug --reuse
```

### Headless Mode (CI/CD)

Run without launching simulator/emulator UI:
```bash
# iOS
detox test --configuration ios.sim.debug --headless

# Android
detox test --configuration android.emu.debug --headless
```

## Performance Optimization

### Speed up iOS builds

Add to your `~/.detoxrc.json`:
```json
{
  "configurations": {
    "ios.sim.debug": {
      "binaryPath": "ios/build/Build/Products/Debug-iphonesimulator/CreativeBridge.app",
      "build": "xcodebuild -workspace ios/CreativeBridge.xcworkspace -scheme CreativeBridge -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build -UseModernBuildSystem=YES -quiet"
    }
  }
}
```

### Speed up Android builds

Add to `android/gradle.properties`:
```properties
org.gradle.daemon=true
org.gradle.parallel=true
org.gradle.configureondemand=true
org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=512m -XX:+HeapDumpOnOutOfMemoryError
```

### Reduce test execution time

1. **Run tests in parallel** (if you have multiple devices):
```bash
detox test --configuration ios.sim.debug --maxWorkers 2
```

2. **Use --reuse flag** to skip rebuilding:
```bash
detox test --reuse
```

3. **Run only specific tests**:
```bash
detox test e2e/storyCompletionJourney.e2e.ts
```

## Advanced Configuration

### Custom Timeout Settings

In `e2e/jest.config.js`:
```javascript
module.exports = {
  testTimeout: 180000, // 3 minutes per test
  // ... other config
};
```

### Custom Device Configuration

In `.detoxrc.js`:
```javascript
devices: {
  'my-custom-device': {
    type: 'ios.simulator',
    device: {
      type: 'iPhone 15 Pro Max',
      os: 'iOS 17.2'
    }
  }
}
```

### Recording Test Videos

Add to test configuration:
```javascript
detox.init({
  recordLogs: 'all',
  recordVideos: 'failing',
  recordPerformance: 'all',
});
```

## Next Steps

1. ✅ Verify setup by running: `npm run e2e:ios` or `npm run e2e:android`
2. 📖 Read the [main E2E documentation](./README.md)
3. ✍️ Write your first test following the examples
4. 🔧 Integrate E2E tests into your CI/CD pipeline
5. 📊 Monitor test results and maintain test suite

## Resources

- [Detox Documentation](https://wix.github.io/Detox/)
- [React Native Testing Guide](https://reactnative.dev/docs/testing-overview)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Xcode Command Line Tools](https://developer.apple.com/xcode/)
- [Android Studio Setup](https://developer.android.com/studio/install)

## Support

If you encounter issues not covered in this guide:
1. Check the [Troubleshooting](#common-issues-and-solutions) section
2. Review Detox GitHub issues: https://github.com/wix/Detox/issues
3. Contact the development team
