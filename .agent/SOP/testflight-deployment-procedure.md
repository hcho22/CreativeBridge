# TestFlight Deployment Procedure for iOS

## Overview

This document provides a comprehensive, step-by-step procedure for deploying the CreativeBridge app to Apple's TestFlight for internal and external testing. The process uses Expo Application Services (EAS) for building and submitting the app to App Store Connect.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Pre-Deployment Checklist](#pre-deployment-checklist)
4. [Building the iOS App](#building-the-ios-app)
5. [Submitting to TestFlight](#submitting-to-testflight)
6. [Post-Submission Steps](#post-submission-steps)
7. [Troubleshooting](#troubleshooting)
8. [Version Management](#version-management)

---

## Prerequisites

### Required Accounts & Access

1. **Apple Developer Account**

   - Active Apple Developer Program membership ($99/year)
   - Account holder or Admin access level
   - Access to App Store Connect (https://appstoreconnect.apple.com)

2. **Expo Account**

   - Expo account with access to the project
   - Organization: `hcho22`
   - Project ID: `3212248a-37c8-4ca7-b054-bac5b7730c35`

3. **Apple Certificates & Provisioning**
   - Distribution Certificate (managed by EAS)
   - App Store Provisioning Profile (managed by EAS)
   - App ID: `org.name.CreativeBridge` (configured in [app.json](../app.json:10))

### Required Software

1. **Node.js**: Version 20 or higher (specified in [package.json](../package.json:171))

   ```bash
   node --version  # Should be >= 20
   ```

2. **EAS CLI**: Version 16.28.0 or higher

   ```bash
   npm install -g eas-cli
   eas --version  # Should be >= 16.28.0
   ```

3. **Git**: For version control
   ```bash
   git --version
   ```

### Optional but Recommended

- **Xcode**: Latest version (for local testing and debugging)
- **iOS Simulator**: For pre-deployment testing

---

## Environment Setup

### 1. Install and Configure EAS CLI

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Verify installation
eas --version

# Login to your Expo account
eas login

# Verify you're logged in
eas whoami
```

Expected output: Your Expo username should be displayed.

### 2. Verify Project Configuration

```bash
# Navigate to project root
cd /Users/hcho/Documents/AI/Projects/CreativeBridge

# Verify project is linked to EAS
eas project:info
```

Expected output should show:

- Project ID: `3212248a-37c8-4ca7-b054-bac5b7730c35`
- Owner: `hcho22`

### 3. Configure Apple Credentials

EAS will automatically manage your Apple credentials. On first build, you'll be prompted to:

```bash
# This happens automatically during first build
eas credentials
```

Options:

- **Automatic**: Let EAS create and manage certificates (recommended)
- **Manual**: Upload your own certificates if you have them

---

## Pre-Deployment Checklist

Before starting the deployment process, ensure all items below are completed:

### Code Quality

- [ ] All changes committed to git
- [ ] Working on the correct branch (usually `main` or a release branch)
- [ ] All tests passing: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] Code reviewed and approved (for production releases)

### Version Management

- [ ] Version number updated in [package.json](../package.json:3) (e.g., `0.0.1` → `0.0.2`)
- [ ] Version updated in [ios/CreativeBridge/Info.plist](../ios/CreativeBridge/Info.plist:22):
  - `CFBundleShortVersionString`: User-facing version (e.g., `0.0.2`)
  - `CFBundleVersion`: Build number (auto-incremented by EAS if configured)

### Environment Configuration

- [ ] Environment variables configured in EAS:

  ```bash
  eas secret:list
  ```

  Required secrets:

  - `OPENAI_API_KEY`
  - `REPLICATE_API_TOKEN`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`

- [ ] Verify [eas.json](../eas.json) configuration for production profile

### Database & Backend

- [ ] Database migrations applied (if any)
- [ ] Supabase services operational
- [ ] API endpoints tested and functional
- [ ] RLS policies reviewed and tested

### App Store Connect

- [ ] App created in App Store Connect (if first deployment)
- [ ] Bundle Identifier matches: `org.name.CreativeBridge`
- [ ] Export compliance documentation ready (if required)
- [ ] Privacy policy URL available (if required)
- [ ] App metadata prepared (description, screenshots, etc.)

### Testing

- [ ] App tested on physical iOS device
- [ ] All core features functional:
  - [ ] User authentication
  - [ ] Story creation with AI
  - [ ] Image generation
  - [ ] Voice input
  - [ ] Photo library access
  - [ ] XP and gamification
- [ ] Performance benchmarks met
- [ ] Memory leaks checked
- [ ] Battery impact acceptable

---

## Building the iOS App

### Step 1: Choose Build Profile

CreativeBridge has three build profiles defined in [eas.json](../eas.json):

1. **Development**: For internal development with dev client
2. **Preview**: For internal testing
3. **Production**: For TestFlight and App Store release

For TestFlight, we use the **production** profile.

### Step 2: Start the Build

```bash
# Build for production (TestFlight/App Store)
npm run eas:build:production



# Or directly with EAS CLI
eas build --platform ios --profile production

EXPO_NO_CAPABILITY_SYNC=1 eas build --platform ios --profile production
```

**What happens during the build:**

1. **Configuration Check**: EAS verifies your [eas.json](../eas.json) and [app.json](../app.json)
2. **Credentials Setup**: EAS ensures certificates and provisioning profiles are valid
3. **Version Increment**: If `autoIncrement: true` (line 15 in [eas.json](../eas.json)), build number increments
4. **Cloud Build**: Code is uploaded and built on EAS servers
5. **Artifact Generation**: `.ipa` file is created and stored

### Step 3: Monitor Build Progress

```bash
# Check build status
eas build:list --platform ios

npm run eas:submit:testflight

# View detailed build logs
eas build:view <build-id>
```

Build typically takes 10-20 minutes depending on:

- Project size
- Dependencies
- EAS server load

### Step 4: Build Completion

When the build completes successfully, you'll see:

- ✅ Build successful
- Download URL for `.ipa` file
- Build ID (save this for submission)

**Example Output:**

```
✔ Build finished successfully!
Build ID: abc123-def456-ghi789
Build URL: https://expo.dev/accounts/hcho22/projects/CreativeBridge/builds/abc123
Download: https://expo.dev/artifacts/eas/...
```

---

## Submitting to TestFlight

### Method 1: Automated Submission (Recommended)

CreativeBridge includes a custom submission script with retry logic and error handling.

#### Using the Submit Script

```bash
# Submit the latest successful build
npm run eas:submit:testflight

# Or use the script directly
bash scripts/submit-testflight.sh --latest
```

**Script Features** ([scripts/submit-testflight.sh](../scripts/submit-testflight.sh)):

- Automatic retry logic (3 attempts)
- Exponential backoff between retries
- Colored output for easy monitoring
- Validates EAS login status
- Verbose logging for troubleshooting

#### Submit Specific Build ID

```bash
# If you want to submit a specific build
bash scripts/submit-testflight.sh --id <build-id>
```

### Method 2: Manual Submission via EAS CLI

```bash
# Submit latest build
npm run eas:submit:ios:latest

# Or with EAS CLI directly
eas submit --platform ios --profile production --latest --wait
```

### Method 3: Manual Submission via App Store Connect

If automated submission fails, you can manually upload:

1. Download the `.ipa` file from EAS build URL
2. Open Xcode
3. Go to **Window → Organizer**
4. Drag and drop the `.ipa` file
5. Click **Distribute App**
6. Select **App Store Connect**
7. Follow the wizard to upload

### Submission Process Details

**What happens during submission:**

1. **Authentication**: EAS authenticates with App Store Connect using your credentials
2. **Validation**: Apple validates the app package
3. **Upload**: `.ipa` file is uploaded to App Store Connect
4. **Processing**: Apple processes the build (5-30 minutes)
5. **TestFlight Ready**: Build appears in TestFlight section

**Expected Timeline:**

- Submission: 2-5 minutes
- Processing: 5-30 minutes
- Beta review (external testers): 24-48 hours

---

## Post-Submission Steps

### 1. Verify Upload in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **My Apps → CreativeBridge**
3. Click **TestFlight** tab
4. Verify your build appears under **iOS Builds**

**Expected Build Information:**

- Version: Match your `CFBundleShortVersionString`
- Build: Auto-incremented build number
- Status: "Processing" → "Ready to Submit" → "Testing"

### 2. Add Build to Test Groups

#### For Internal Testing

1. In TestFlight section, go to **Internal Testing**
2. Click **+** next to the test group
3. Select your build
4. Add internal testers (up to 100)
5. Testers receive immediate access via TestFlight app

#### For External Testing

1. Go to **External Testing**
2. Create a test group (if not exists)
3. Click **+** to add build
4. Select your build
5. Add testers via email (up to 10,000)
6. Submit for Beta App Review (required)

**Beta App Review Checklist:**

- Beta App Description
- Feedback email
- Test instructions (what to test)
- Export compliance information
- Privacy policy URL (if collecting data)

### 3. Configure Build Settings

```bash
# In App Store Connect → TestFlight → Build
```

Set the following:

- **What to Test**: Describe new features and changes
- **Test Details**: Provide testing instructions
- **App Clip**: Configure if using App Clips
- **Export Compliance**: Select appropriate option

### 4. Notify Testers

Internal testers are notified automatically via:

- TestFlight app notification
- Email notification

External testers receive:

- Email invitation
- TestFlight installation instructions

### 5. Monitor Feedback

1. **Crash Reports**:

   - App Store Connect → TestFlight → Crashes
   - Review crash logs and stack traces

2. **Tester Feedback**:

   - TestFlight → Feedback
   - Screenshots from testers
   - Device information

3. **Analytics**:
   - Number of testers
   - Number of sessions
   - Number of crashes

### 6. Document Deployment

Update project documentation:

```bash
# Create a deployment record
cat >> .agent/deployment-log.md << EOF

## Deployment - $(date +%Y-%m-%d)

- **Version**: 0.0.2
- **Build**: 2
- **Build ID**: <eas-build-id>
- **Deployed By**: $(whoami)
- **Environment**: Production → TestFlight
- **Changes**:
  - Feature A implemented
  - Bug B fixed
  - Performance improvements
- **Notes**:
  - All tests passing
  - No database migrations required

EOF
```

---

## Troubleshooting

### Common Build Issues

#### Issue: Build fails with "Provisioning profile doesn't match"

**Solution:**

```bash
# Clear credentials and regenerate
eas credentials --clear

# Rebuild
eas build --platform ios --profile production --clear-cache
```

#### Issue: Build fails with TypeScript errors

**Solution:**

```bash
# Run TypeScript check locally first
npx tsc --noEmit

# Fix all errors before rebuilding
npm run lint:fix
```

#### Issue: Build fails with dependency errors

**Solution:**

```bash
# Clear dependencies and reinstall
rm -rf node_modules ios/Pods
npm install
cd ios && pod install && cd ..

# Rebuild
eas build --platform ios --profile production --clear-cache
```

#### Issue: Build times out

**Solution:**

- Check EAS status: https://status.expo.dev
- Retry build after 15-30 minutes
- Use `--clear-cache` flag to force clean build

### Common Submission Issues

#### Issue: Submission fails with authentication error

**Solution:**

```bash
# Re-login to EAS
eas logout
eas login

# Verify Apple ID credentials
eas credentials
```

#### Issue: "Missing compliance information"

**Solution:**

1. Go to App Store Connect → App Information
2. Update Export Compliance settings
3. If app uses encryption: Provide compliance documentation
4. Re-submit build

#### Issue: "Invalid bundle identifier"

**Solution:**

1. Verify [app.json](../app.json:10) has correct `bundleIdentifier`: `org.name.CreativeBridge`
2. Ensure App Store Connect app uses same identifier
3. Rebuild with correct identifier

#### Issue: Submission stuck at "Processing"

**Solution:**

- Normal processing: 5-30 minutes
- If over 1 hour: Check App Store Connect for error messages
- If over 2 hours: Contact Apple Developer Support

### Common TestFlight Issues

#### Issue: Testers can't install app

**Solutions:**

- Verify tester email matches Apple ID
- Ensure tester has TestFlight app installed
- Check device compatibility (iOS 12.0+ required per [Info.plist](../ios/CreativeBridge/Info.plist:48))
- Verify tester accepted invitation

#### Issue: App crashes on launch in TestFlight

**Solutions:**

```bash
# Check crash logs in App Store Connect
# Common causes:
# 1. Missing environment variables
eas secret:list

# 2. API keys not configured
# 3. Missing permissions (check Info.plist)

# To debug:
# 1. Download crash log from App Store Connect
# 2. Symbolicate crash log in Xcode
# 3. Identify failing code
# 4. Fix and redeploy
```

#### Issue: External testing stuck in "Waiting for Review"

**Solution:**

- Normal review time: 24-48 hours
- Ensure all Beta App Review information is complete
- Check for rejection email from Apple
- If rejected: Address issues and resubmit

### Recovery Procedures

#### Emergency Rollback

If a critical issue is discovered after deployment:

```bash
# 1. Identify last stable build ID
eas build:list --platform ios --status finished

# 2. Submit previous build
bash scripts/submit-testflight.sh --id <previous-build-id>

# 3. Disable problematic build in App Store Connect
# Go to TestFlight → Select build → Stop Testing
```

#### Complete Reset

If everything is broken:

```bash
# 1. Clear all EAS credentials
eas credentials --clear

# 2. Clear local cache
rm -rf node_modules ios/Pods ios/build
npm install
cd ios && pod install && cd ..

# 3. Clean build
eas build --platform ios --profile production --clear-cache

# 4. Submit fresh build
npm run eas:submit:testflight
```

---

## Version Management

### Semantic Versioning

CreativeBridge follows semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (0 → 1)
- **MINOR**: New features (0.0 → 0.1)
- **PATCH**: Bug fixes (0.0.1 → 0.0.2)

### Updating Versions

#### 1. Update package.json

```bash
# For bug fixes
npm version patch  # 0.0.1 → 0.0.2

# For new features
npm version minor  # 0.0.1 → 0.1.0

# For breaking changes
npm version major  # 0.0.1 → 1.0.0
```

This automatically updates [package.json](../package.json:3).

#### 2. Update iOS Info.plist

Edit [ios/CreativeBridge/Info.plist](../ios/CreativeBridge/Info.plist):

```xml
<key>CFBundleShortVersionString</key>
<string>0.0.2</string>  <!-- Update this to match package.json -->
```

**Note**: `CFBundleVersion` (build number) is auto-incremented by EAS when `autoIncrement: true` is set in [eas.json](../eas.json:15).

#### 3. Commit Version Changes

```bash
git add package.json package-lock.json ios/CreativeBridge/Info.plist
git commit -m "chore: bump version to 0.0.2"
git push origin main
```

#### 4. Tag Release

```bash
git tag v0.0.2
git push origin v0.0.2
```

### Build Number Management

EAS automatically increments build numbers for each production build when configured in [eas.json](../eas.json).

**Setting a Specific Starting Build Number**:

If you need to start from a specific build number (e.g., after reverting code), configure it in [eas.json](../eas.json):

```json
{
  "build": {
    "production": {
      "autoIncrement": true,
      "ios": {
        "buildNumber": "4"
      }
    }
  }
}
```

EAS will use this number for the next build and auto-increment from there. After the first build, you can remove the explicit `buildNumber` setting to let EAS continue auto-incrementing.

**Manual Override** (not recommended):

Edit [ios/CreativeBridge/Info.plist](../ios/CreativeBridge/Info.plist):

```xml
<key>CFBundleVersion</key>
<string>2</string>  <!-- Build number -->
```

Note: Manual overrides can conflict with EAS auto-increment. Always prefer the EAS configuration method above.

---

## Quick Reference Commands

### Essential Commands

```bash
# Build for TestFlight
npm run eas:build:production
# or
eas build --platform ios --profile production

# Submit to TestFlight (automated with retry)
npm run eas:submit:testflight
# or
bash scripts/submit-testflight.sh --latest

# Submit specific build
bash scripts/submit-testflight.sh --id <build-id>

# Check build status
eas build:list --platform ios

# View build details
eas build:view <build-id>

# Check credentials
eas credentials

# Update version
npm version patch|minor|major
```

### Environment Management

```bash
# List environment secrets
eas secret:list

# Add secret
eas secret:create --name OPENAI_API_KEY --value "sk-..."

# Delete secret
eas secret:delete --name OPENAI_API_KEY

# View project info
eas project:info

# Check login status
eas whoami
```

### Testing & Validation

```bash
# Run all tests
npm test

# Run linting
npm run lint

# Type check
npx tsc --noEmit

# Pre-deployment validation
npm run deploy:pre-check
```

---

## Best Practices

### Before Every Deployment

1. **Test thoroughly**: Run app on physical device
2. **Review changes**: Use `git diff` to review all changes
3. **Update changelog**: Document what's new
4. **Version bump**: Follow semantic versioning
5. **Clean builds**: Use `--clear-cache` periodically

### During Deployment

1. **Monitor build logs**: Watch for warnings and errors
2. **Verify credentials**: Ensure certificates are valid
3. **Check submission**: Wait for successful upload confirmation
4. **Test immediately**: Install via TestFlight and verify

### After Deployment

1. **Document deployment**: Update logs and changelogs
2. **Notify testers**: Inform them of new build and what to test
3. **Monitor feedback**: Check crash reports and tester feedback daily
4. **Iterate quickly**: Fix critical issues and redeploy promptly

### Security Considerations

1. **Never commit secrets**: Use EAS secrets for API keys
2. **Rotate credentials**: Periodically update API keys
3. **Review permissions**: Audit Info.plist usage descriptions
4. **Validate inputs**: Ensure all user inputs are sanitized
5. **Monitor access**: Review who has TestFlight access

---

## Deployment Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    PRE-DEPLOYMENT PHASE                      │
├─────────────────────────────────────────────────────────────┤
│  1. Run tests (npm test)                                    │
│  2. Update version (npm version patch)                      │
│  3. Commit changes (git commit)                             │
│  4. Verify environment variables (eas secret:list)          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      BUILD PHASE                             │
├─────────────────────────────────────────────────────────────┤
│  1. Start build (npm run eas:build:production)              │
│  2. EAS uploads code to cloud                               │
│  3. Cloud builds .ipa file (10-20 min)                      │
│  4. Build artifact stored                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   SUBMISSION PHASE                           │
├─────────────────────────────────────────────────────────────┤
│  1. Submit to TestFlight (npm run eas:submit:testflight)    │
│  2. Upload to App Store Connect (2-5 min)                   │
│  3. Apple processes build (5-30 min)                        │
│  4. Build status: "Ready to Submit"                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  TESTFLIGHT SETUP                            │
├─────────────────────────────────────────────────────────────┤
│  1. Add build to test groups                                │
│  2. Configure "What to Test" notes                          │
│  3. Add testers (internal: immediate, external: review)     │
│  4. Submit for Beta Review (external only)                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 POST-DEPLOYMENT PHASE                        │
├─────────────────────────────────────────────────────────────┤
│  1. Notify testers                                          │
│  2. Monitor crash reports                                   │
│  3. Collect feedback                                        │
│  4. Document deployment                                     │
│  5. Plan next iteration                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Related Documentation

- [Project Architecture](../System/project_architecture.md) - System overview and design
- [Database Schema](../System/database_schema.md) - Database structure
- [Development SOPs](./development_procedures.md) - Development best practices
- [EAS Documentation](https://docs.expo.dev/build/introduction/) - Expo Application Services
- [TestFlight Documentation](https://developer.apple.com/testflight/) - Apple TestFlight

---

## Changelog

### Version 1.0 - January 2026

- Initial comprehensive TestFlight deployment procedure
- Covers EAS build and submission workflow
- Includes troubleshooting guide
- Version management procedures
- Best practices and quick reference

---

**Document Version**: 1.0
**Last Updated**: January 16, 2026
**Maintainer**: Development Team
**Review Schedule**: Quarterly or after significant process changes
