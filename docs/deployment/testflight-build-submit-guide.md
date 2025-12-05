# TestFlight Build and Submission Guide

This guide provides detailed step-by-step instructions for building and submitting the CreativeBridge iOS app to TestFlight using Expo Application Services (EAS).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Build Checklist](#pre-build-checklist)
3. [Building the App](#building-the-app)
4. [Monitoring the Build](#monitoring-the-build)
5. [Submitting to TestFlight](#submitting-to-testflight)
6. [Verification](#verification)
7. [Troubleshooting](#troubleshooting)
8. [Quick Reference](#quick-reference)

---

## Prerequisites

Before you begin, ensure you have the following:

### Required Accounts

- **Expo Account**: Sign up at [expo.dev](https://expo.dev) if you don't have one
- **Apple Developer Account**: Active membership ($99/year) with access to App Store Connect
- **App Store Connect Access**: Admin or App Manager role for the CreativeBridge app

### Required Tools

1. **Node.js**: Version 20 or higher (check with `node --version`)
2. **EAS CLI**: Install globally with `npm install -g eas-cli`
3. **Git**: For version control (check with `git --version`)
4. **Xcode Command Line Tools** (for iOS): Install with `xcode-select --install`

### Initial Setup

1. **Login to EAS**:

   ```bash
   eas login
   ```

   Enter your Expo account credentials when prompted.

2. **Verify EAS CLI Version**:

   ```bash
   eas --version
   ```

   Should be >= 16.28.0 (as specified in `eas.json`).

3. **Verify Project Configuration**:

   ```bash
   # Check you're in the project root
   pwd
   # Should show: .../CreativeBridge

   # Verify EAS project ID
   cat app.json | grep projectId
   # Should show: "projectId": "3212248a-37c8-4ca7-b054-bac5b7730c35"
   ```

---

## Pre-Build Checklist

Before building, verify the following:

### 1. Bundle Identifier

Verify the bundle identifier is consistent across all configuration files:

```bash
# Check app.json
cat app.json | grep bundleIdentifier
# Should show: "bundleIdentifier": "com.hcho22.creativebridge"

# Check Xcode project (Debug and Release)
grep PRODUCT_BUNDLE_IDENTIFIER ios/CreativeBridge.xcodeproj/project.pbxproj
# Should show: PRODUCT_BUNDLE_IDENTIFIER = com.hcho22.creativebridge;
```

**Expected Value**: `com.hcho22.creativebridge`

### 2. Version and Build Number

Check current version in `app.json` and `Info.plist`:

```bash
# Check package.json version
cat package.json | grep '"version"'
# Currently: "version": "1.0"

# Check Info.plist version
grep CFBundleShortVersionString ios/CreativeBridge/Info.plist
# Currently: <string>1.0</string>
```

**Note**: With `appVersionSource: "remote"` in `eas.json`, EAS will use the version from App Store Connect. The build number will auto-increment with `autoIncrement: true`.

### 3. Dependencies

Ensure all dependencies are installed and up to date:

```bash
# Install dependencies
npm install

# Verify no dependency conflicts
npm audit
```

### 4. Code Changes Committed

Ensure all code changes are committed to Git:

```bash
# Check git status
git status

# If there are uncommitted changes, commit them
git add .
git commit -m "Your commit message"
git push
```

### 5. App Store Connect App Exists

Verify the app exists in App Store Connect:

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **My Apps**
3. Confirm **CreativeBridge** app exists with Bundle ID: `com.hcho22.creativebridge`
4. **Important**: If you see "CreativeBridge (67212d)" or any duplicate, use the original "CreativeBridge" app

### 6. Apple Developer Credentials

EAS will handle credentials automatically, but verify:

```bash
# Check if credentials are configured
eas credentials

# If needed, configure credentials
eas credentials
# Select: iOS → Production → Automatic (recommended)
```

---

## Building the App

### Step 1: Choose Build Profile

The project has three build profiles defined in `eas.json`:

- **development**: For development builds with dev client
- **preview**: For internal testing
- **production**: For TestFlight and App Store (use this)

### Step 2: Start the Build

Use one of the following methods:

#### Method A: Using NPM Script (Recommended)

```bash
npm run eas:build:production
```

This runs: `eas build --profile production`

#### Method B: Direct EAS Command

```bash
eas build --platform ios --profile production
```

#### Method C: Interactive Build

```bash
eas build
# Follow prompts:
# - Platform: iOS
# - Profile: production
```

### Step 3: Build Configuration

During the build, EAS will:

1. **Upload your code** to Expo's build servers
2. **Install dependencies** (`npm ci`)
3. **Run prebuild** to generate native iOS project
4. **Build the iOS app** using Xcode
5. **Sign the app** with your Apple Developer credentials
6. **Generate the IPA** file

### Step 4: Build Options

You can customize the build with additional flags:

```bash
# Build with specific version
eas build --platform ios --profile production --version 1.0.0

# Build with specific build number
eas build --platform ios --profile production --build-number 42

# Build with local configuration
eas build --platform ios --profile production --local

# Build with verbose output
eas build --platform ios --profile production --verbose
```

**Note**: With `autoIncrement: true` in production profile, build numbers increment automatically.

---

## Monitoring the Build

### View Build Status

#### Method 1: Command Line

```bash
# List recent builds
eas build:list --platform ios --limit 5

# View specific build details
eas build:view <build-id>
```

#### Method 2: Expo Dashboard

1. Go to [expo.dev](https://expo.dev)
2. Navigate to your project: **CreativeBridge**
3. Click on **Builds** tab
4. Find your build and monitor progress

### Build Status Indicators

- **in-progress**: Build is currently running
- **finished**: Build completed successfully
- **errored**: Build failed (check logs)
- **canceled**: Build was canceled

### Build Logs

View detailed build logs:

```bash
# View logs for a specific build
eas build:view <build-id> --logs

# Or follow logs in real-time during build
eas build --platform ios --profile production --wait
```

### Typical Build Time

- **First build**: 15-25 minutes (dependencies installation)
- **Subsequent builds**: 10-15 minutes (incremental builds)
- **Local builds**: 5-10 minutes (if using `--local`)

### Build Completion

When the build completes successfully, you'll see:

```
✅ Build finished
📦 Build ID: abc123def456
🔗 Build URL: https://expo.dev/accounts/hcho22/projects/CreativeBridge/builds/abc123def456
```

Save the Build ID for the submission step.

---

## Submitting to TestFlight

Once your build is finished, submit it to TestFlight.

### Step 1: Verify Build Status

Ensure the build is in "finished" status:

```bash
eas build:list --platform ios --limit 1
```

The latest build should show status: `finished`

### Step 2: Submit to TestFlight

You have three options:

#### Option A: Submit Latest Build (Recommended)

```bash
npm run eas:submit:testflight
```

This uses the retry script with automatic retry logic.

#### Option B: Submit with EAS CLI Directly

```bash
npm run eas:submit:ios:latest
```

Or:

```bash
eas submit --platform ios --profile production --latest --wait
```

#### Option C: Submit Specific Build ID

If you want to submit a specific build:

```bash
eas submit --platform ios --profile production --id <build-id> --wait
```

Replace `<build-id>` with the actual build ID from `eas build:list`.

### Step 3: Submission Process

During submission, EAS will:

1. **Download the IPA** from the build server
2. **Upload to App Store Connect** via Apple's API
3. **Wait for processing** (Apple processes the upload)
4. **Confirm submission** when complete

### Step 4: Submission Flags

Useful flags for submission:

```bash
# Submit with verbose logging
eas submit --platform ios --profile production --latest --wait --verbose

# Submit with TestFlight groups
eas submit --platform ios --profile production --latest --groups "Internal Testers"

# Submit with "What to Test" notes
eas submit --platform ios --profile production --latest --what-to-test "Fixed image generation issues"

# Non-interactive mode (for CI/CD)
eas submit --platform ios --profile production --latest --non-interactive
```

### Step 5: Retry Logic

If submission fails with a timeout error, the retry script (`scripts/submit-testflight.sh`) will:

- Automatically retry up to 3 times
- Use exponential backoff (30s, 60s, 120s)
- Provide detailed error messages

You can also manually retry:

```bash
# Retry the submission
eas submit --platform ios --profile production --latest --wait --verbose
```

---

## Verification

After submission, verify the build appears in App Store Connect.

### Step 1: Check App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **My Apps** → **CreativeBridge**
3. Click on **TestFlight** tab
4. Look for your build under **iOS Builds**

### Step 2: Verify Build Details

In TestFlight, verify:

- **Version**: Matches your expected version
- **Build Number**: Incremented correctly
- **Status**: Should show "Processing" initially, then "Ready to Test"
- **Bundle ID**: `com.hcho22.creativebridge`

### Step 3: Processing Time

Apple typically processes builds in:

- **5-15 minutes**: For most builds
- **Up to 1 hour**: During peak times or for large builds

You'll receive an email when processing is complete.

### Step 4: TestFlight Groups

Once the build is "Ready to Test":

1. Go to **TestFlight** → **Internal Testing** or **External Testing**
2. Add the build to your testing group
3. Testers will receive an email invitation

### Step 5: Verify Submission Success

Check the submission was successful:

```bash
# List recent submissions (if available)
eas build:list --platform ios --limit 1

# Check build status
eas build:view <build-id>
```

The build should show it was submitted to App Store Connect.

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Build Fails: Dependency Conflicts

**Error**: `ERESOLVE could not resolve dependency`

**Solution**:

```bash
# Ensure package-lock.json is synced
npm install

# Commit and push package-lock.json
git add package-lock.json
git commit -m "Sync package-lock.json"
git push

# Rebuild
npm run eas:build:production
```

#### 2. Submission Fails: GraphQL Timeout

**Error**: `request to https://api.expo.dev/graphql failed, reason: read ETIMEDOUT`

**Solution**:

```bash
# Use the retry script (automatic retries)
npm run eas:submit:testflight

# Or manually retry with verbose logging
eas submit --platform ios --profile production --latest --wait --verbose
```

#### 3. Build Fails: Missing Info.plist Keys

**Error**: `ITMS-90683: Missing purpose string in Info.plist`

**Solution**: Ensure all required usage descriptions are in `ios/CreativeBridge/Info.plist`:

- `NSPhotoLibraryUsageDescription`
- `NSPhotoLibraryAddUsageDescription`
- `NSCameraUsageDescription`
- `NSMicrophoneUsageDescription`
- `NSSpeechRecognitionUsageDescription`

#### 4. Submission Fails: Bundle ID Mismatch

**Error**: Build uploaded to wrong app or duplicate app created

**Solution**:

1. Verify bundle identifier in `app.json`: `com.hcho22.creativebridge`
2. Check App Store Connect for the correct app (use "CreativeBridge", not "CreativeBridge (67212d)")
3. Ensure you're using the same Apple Developer account

#### 5. Build Fails: Credentials Issue

**Error**: `No credentials found` or `Invalid credentials`

**Solution**:

```bash
# Reconfigure credentials
eas credentials

# Select: iOS → Production → Automatic
# EAS will handle certificate and provisioning profile creation
```

#### 6. Build Stuck: Processing Forever

**Issue**: Build shows "in-progress" for over 30 minutes

**Solution**:

```bash
# Check build status
eas build:view <build-id>

# Check Expo status page
# Visit: https://status.expo.dev

# Cancel and retry if needed
eas build:cancel <build-id>
npm run eas:build:production
```

#### 7. Submission: Build Not Found

**Error**: `Build not found` when submitting

**Solution**:

```bash
# List recent builds to get correct build ID
eas build:list --platform ios --limit 5

# Submit with specific build ID
eas submit --platform ios --profile production --id <build-id> --wait
```

#### 8. TestFlight: Build Not Appearing

**Issue**: Build submitted but not visible in TestFlight

**Solution**:

1. Wait 10-15 minutes for Apple to process
2. Check email for processing completion notification
3. Verify you're looking at the correct app in App Store Connect
4. Check build status in App Store Connect → Activity → All Builds

### Getting Help

If issues persist:

1. **Check EAS Build Logs**:

   ```bash
   eas build:view <build-id> --logs
   ```

2. **Check Expo Status**: [status.expo.dev](https://status.expo.dev)

3. **Expo Forums**: [forums.expo.dev](https://forums.expo.dev)

4. **EAS CLI GitHub**: [github.com/expo/eas-cli/issues](https://github.com/expo/eas-cli/issues)

5. **Apple Developer Support**: For App Store Connect issues

---

## Quick Reference

### Essential Commands

```bash
# Login to EAS
eas login

# Build for production
npm run eas:build:production

# List recent builds
eas build:list --platform ios --limit 5

# View build details
eas build:view <build-id>

# Submit latest build to TestFlight
npm run eas:submit:testflight

# Submit with specific build ID
eas submit --platform ios --profile production --id <build-id> --wait

# Check credentials
eas credentials

# View build logs
eas build:view <build-id> --logs
```

### NPM Scripts

From `package.json`:

```bash
# Build scripts
npm run eas:build:development    # Development build
npm run eas:build:preview         # Preview build
npm run eas:build:production      # Production build (TestFlight/App Store)
npm run eas:build:ios             # iOS build (interactive)

# Submit scripts
npm run eas:submit:ios            # Submit iOS (interactive)
npm run eas:submit:ios:latest     # Submit latest iOS build
npm run eas:submit:testflight     # Submit with retry logic
```

### Configuration Files

- **`eas.json`**: EAS build and submit profiles
- **`app.json`**: App configuration (bundle ID, version, etc.)
- **`package.json`**: Dependencies and npm scripts
- **`ios/CreativeBridge/Info.plist`**: iOS-specific settings

### Key Identifiers

- **Bundle ID**: `com.hcho22.creativebridge`
- **EAS Project ID**: `3212248a-37c8-4ca7-b054-bac5b7730c35`
- **App Name**: CreativeBridge
- **Owner**: hcho22

### Typical Workflow

```bash
# 1. Verify configuration
git status
cat app.json | grep bundleIdentifier

# 2. Build the app
npm run eas:build:production

# 3. Wait for build (monitor with)
eas build:list --platform ios --limit 1

# 4. Submit to TestFlight
npm run eas:submit:testflight

# 5. Verify in App Store Connect
# Visit: https://appstoreconnect.apple.com
```

### Build Status Check

```bash
# Quick status check
eas build:list --platform ios --limit 1 --json | grep status

# Detailed view
eas build:view <build-id>
```

### Submission Status Check

After submission, check App Store Connect:

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. My Apps → CreativeBridge → TestFlight
3. Check "iOS Builds" section

---

## Additional Resources

- **EAS Build Documentation**: [docs.expo.dev/build/introduction](https://docs.expo.dev/build/introduction/)
- **EAS Submit Documentation**: [docs.expo.dev/submit/introduction](https://docs.expo.dev/submit/introduction/)
- **App Store Connect**: [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
- **Expo Dashboard**: [expo.dev/accounts/hcho22/projects/CreativeBridge](https://expo.dev/accounts/hcho22/projects/CreativeBridge)

---

## Notes

- **Version Management**: With `appVersionSource: "remote"`, EAS uses versions from App Store Connect
- **Build Numbers**: Auto-increment is enabled for production builds
- **Credentials**: EAS handles certificates and provisioning profiles automatically
- **Processing Time**: Allow 5-15 minutes for Apple to process builds after submission
- **TestFlight Groups**: Configure in App Store Connect after build is ready

---

_Last Updated: December 2024_
_Project: CreativeBridge_
_Bundle ID: com.hcho22.creativebridge_
