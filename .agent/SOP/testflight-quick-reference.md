# TestFlight Deployment - Quick Reference Guide

> **⚡ Quick commands for deploying CreativeBridge to TestFlight**

---

## 🚀 Standard Deployment (Most Common)

```bash
# 1. Pre-flight checks
npm test                    # All tests must pass
npm run lint                # Check code quality
npx tsc --noEmit           # TypeScript validation

# 2. Update version (choose one)
npm version patch          # Bug fixes: 0.0.1 → 0.0.2
npm version minor          # New features: 0.0.1 → 0.1.0
npm version major          # Breaking changes: 0.0.1 → 1.0.0

# 3. Update iOS version to match package.json
# Edit ios/CreativeBridge/Info.plist → CFBundleShortVersionString

# 4. Commit version changes
git add package.json package-lock.json ios/CreativeBridge/Info.plist
git commit -m "chore: bump version to X.X.X"
git push origin main

# 5. Build for production
npm run eas:build:production
# or: eas build --platform ios --profile production

# 6. Wait for build to complete (10-20 min)
# Monitor: eas build:list --platform ios

# 7. Submit to TestFlight (automated with retry)
npm run eas:submit:testflight
# or: bash scripts/submit-testflight.sh --latest

# 8. Wait for processing (5-30 min)
# Verify in App Store Connect → TestFlight
```

**⏱️ Total Time**: ~20-45 minutes (build + submission + processing)

---

## 📋 Pre-Deployment Checklist

Use this before every deployment:

```bash
□ All code committed to git
□ Tests passing: npm test
□ Linting clean: npm run lint
□ Version updated in package.json and Info.plist
□ Environment variables configured: eas secret:list
□ Database migrations applied (if any)
□ Tested on physical iOS device
□ Changes documented
```

---

## 🔧 Useful Commands

### Build Management

```bash
# List all builds
eas build:list --platform ios

# View specific build details
eas build:view <build-id>

# Build with cache cleared (for stubborn issues)
eas build --platform ios --profile production --clear-cache

# Cancel running build
eas build:cancel
```

### Submission Management

```bash
# Submit latest build (recommended)
npm run eas:submit:testflight

# Submit specific build by ID
bash scripts/submit-testflight.sh --id <build-id>

# Manual submit via EAS CLI
eas submit --platform ios --latest --wait
```

### Environment & Credentials

```bash
# Check who you're logged in as
eas whoami

# Login to EAS
eas login

# View project information
eas project:info

# Manage credentials
eas credentials

# List environment secrets
eas secret:list

# Add new secret
eas secret:create --name KEY_NAME --value "value"

# Delete secret
eas secret:delete --name KEY_NAME
```

### Version Management

```bash
# Check current version
grep '"version"' package.json

# Update version
npm version patch|minor|major

# Tag release in git
git tag v0.0.2
git push origin v0.0.2
```

---

## 🐛 Quick Troubleshooting

### Build Fails

```bash
# Clear everything and rebuild
rm -rf node_modules ios/Pods ios/build
npm install
cd ios && pod install && cd ..
eas build --platform ios --profile production --clear-cache
```

### Submission Fails

```bash
# Re-authenticate
eas logout
eas login
eas credentials

# Retry submission
bash scripts/submit-testflight.sh --latest
```

### Can't Login to EAS

```bash
# Clear credentials and re-login
eas logout
rm -rf ~/.eas-cli
eas login
```

### Build Stuck or Timeout

- Check EAS status: https://status.expo.dev
- Wait 15-30 minutes and retry
- Use `--clear-cache` flag

---

## 📱 Post-Submission in App Store Connect

1. **Navigate**: [App Store Connect](https://appstoreconnect.apple.com) → My Apps → CreativeBridge → TestFlight

2. **Verify Build**: Check iOS Builds section for new build (Status: Processing → Testing)

3. **Add to Test Group**:

   - Internal Testing: Immediate access for up to 100 testers
   - External Testing: Requires Beta Review, up to 10,000 testers

4. **Configure Build**:

   - Set "What to Test" notes
   - Provide test instructions
   - Set export compliance

5. **Add Testers**:

   - Internal: Add via email in Internal Testing section
   - External: Add via email, submit for Beta Review

6. **Monitor**:
   - Check crash reports daily
   - Review tester feedback
   - Track adoption metrics

---

## 🔐 Required Secrets (via `eas secret:create`)

```bash
OPENAI_API_KEY          # OpenAI API key for story generation
REPLICATE_API_TOKEN     # Replicate API for image generation
SUPABASE_URL           # Supabase project URL
SUPABASE_ANON_KEY      # Supabase anonymous key
```

Verify: `eas secret:list`

---

## 📊 Key Configuration Files

| File                                              | Purpose        | What to Check                   |
| ------------------------------------------------- | -------------- | ------------------------------- |
| [package.json](../../package.json)                | App version    | Line 3: `"version": "0.0.1"`    |
| [app.json](../../app.json)                        | Expo config    | Lines 10-11: `bundleIdentifier` |
| [eas.json](../../eas.json)                        | Build profiles | Line 15: `autoIncrement: true`  |
| [Info.plist](../../ios/CreativeBridge/Info.plist) | iOS metadata   | Lines 22, 47: Version strings   |

---

## ⚠️ Common Pitfalls

1. **Forgetting to update Info.plist version** → Build succeeds but version is wrong in TestFlight
2. **Not testing on device first** → Crashes appear only in TestFlight
3. **Missing environment variables** → App crashes on launch
4. **Not waiting for build to complete** → Submitting wrong build
5. **Skipping pre-flight checks** → Deploying broken code

---

## 🎯 Emergency Rollback

If critical issue found after deployment:

```bash
# 1. Find previous stable build
eas build:list --platform ios --status finished

# 2. Submit previous build
bash scripts/submit-testflight.sh --id <previous-build-id>

# 3. In App Store Connect
# TestFlight → Select broken build → Stop Testing
```

---

## 📞 Getting Help

- **EAS Documentation**: https://docs.expo.dev/build/introduction/
- **EAS Status**: https://status.expo.dev
- **TestFlight Help**: https://developer.apple.com/testflight/
- **Project Docs**: [Full Deployment Guide](./testflight-deployment-procedure.md)

---

## 🏁 Success Indicators

✅ Build completed successfully (green checkmark in `eas build:list`)
✅ Submission successful (confirmation from script)
✅ Build appears in App Store Connect TestFlight
✅ Build status changes to "Testing"
✅ Testers can install and launch app
✅ No crashes in first 24 hours
✅ Core features working as expected

---

**Quick Reference Version**: 1.0
**Last Updated**: January 16, 2026
**For Detailed Guide**: See [testflight-deployment-procedure.md](./testflight-deployment-procedure.md)
