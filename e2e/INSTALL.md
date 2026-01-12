# E2E Testing Installation Instructions

Quick installation guide to get E2E tests running on your machine.

## Prerequisites Check

Before starting, verify you have:

- [ ] Node.js 20+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] For iOS: macOS with Xcode 14+ (`xcode-select --version`)
- [ ] For Android: Java 17+ (`java --version`)

## Installation Steps

### 1. Install Project Dependencies

```bash
cd /path/to/CreativeBridge
npm install
```

This will install all dependencies including Detox (version 20.18.0).

### 2. Install Detox CLI Globally

```bash
npm install -g detox-cli
```

Verify installation:
```bash
detox --version
# Expected output: 20.18.0 or similar
```

### 3. iOS Setup (macOS only)

#### Install applesimutils

```bash
brew tap wix/brew
brew install applesimutils
```

Verify:
```bash
applesimutils --list
```

#### Install iOS Dependencies

```bash
cd ios
pod install
cd ..
```

#### Build iOS App for Testing

```bash
npm run e2e:build:ios
```

Expected output: `** BUILD SUCCEEDED **`

### 4. Android Setup (All platforms)

#### Set Environment Variables

Add to `~/.zshrc` or `~/.bashrc`:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

Reload shell:
```bash
source ~/.zshrc
```

#### Create Android Emulator

```bash
# Create AVD
avdmanager create avd \
  -n Pixel_7_API_34 \
  -k "system-images;android-34;google_apis;x86_64" \
  -d "pixel_7"
```

Or use Android Studio:
- Tools → Device Manager → Create Device
- Select: Pixel 7, API 34

#### Build Android App for Testing

```bash
npm run e2e:build:android
```

Expected output: `BUILD SUCCESSFUL`

## Verify Installation

### Test iOS Setup

```bash
# Start iOS simulator
open -a Simulator

# Run a quick test
detox test e2e/storyCompletionJourney.e2e.ts --configuration ios.sim.debug
```

### Test Android Setup

```bash
# Start Android emulator
emulator -avd Pixel_7_API_34 &

# Wait for boot
adb wait-for-device

# Run a quick test
detox test e2e/storyCompletionJourney.e2e.ts --configuration android.emu.debug
```

## Quick Reference Commands

```bash
# Build apps
npm run e2e:build:ios
npm run e2e:build:android

# Run tests
npm run e2e:test:ios
npm run e2e:test:android

# Build + Test
npm run e2e:ios
npm run e2e:android
```

## Troubleshooting

### "Command not found: detox"

```bash
npm install -g detox-cli
```

### iOS: "applesimutils not found"

```bash
brew tap wix/brew
brew install applesimutils
```

### Android: "ANDROID_HOME not set"

Add to shell profile:
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
source ~/.zshrc
```

### "No emulator found"

```bash
# List available
emulator -list-avds

# Start specific one
emulator -avd Pixel_7_API_34
```

## Next Steps

1. ✅ Verify all tests pass: `npm run e2e:ios` or `npm run e2e:android`
2. 📖 Read [README.md](./README.md) for detailed usage
3. 📋 Review [TEST_SUMMARY.md](./TEST_SUMMARY.md) for test coverage
4. 🔧 See [SETUP.md](./SETUP.md) for advanced configuration

## Need Help?

- Check [SETUP.md](./SETUP.md) for detailed setup instructions
- Review [README.md](./README.md) for troubleshooting
- Visit [Detox Documentation](https://wix.github.io/Detox/)
- Contact development team

## Installation Checklist

- [ ] Node.js 20+ installed
- [ ] npm dependencies installed (`npm install`)
- [ ] Detox CLI installed globally
- [ ] iOS: applesimutils installed
- [ ] iOS: Pods installed
- [ ] iOS: App built successfully
- [ ] Android: ANDROID_HOME set
- [ ] Android: Emulator created
- [ ] Android: App built successfully
- [ ] Verification test passed

Once all items are checked, you're ready to run E2E tests! 🎉
