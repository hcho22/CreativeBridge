#!/bin/bash
# Fix and Deploy to TestFlight
# This script builds and submits the fixed app to TestFlight

set -e  # Exit on error

echo "🚀 Building iOS app with Expo Updates fix..."
echo ""

# Build for production
echo "📦 Step 1: Building production iOS app..."
eas build --platform ios --profile production --auto-submit

echo ""
echo "✅ Build complete! The app will be automatically submitted to TestFlight."
echo ""
echo "📱 Once processing is complete (usually 10-30 minutes), test on your physical device."
echo ""
echo "🔍 What was fixed:"
echo "   - Added EXUpdatesRequestHeaders to Expo.plist"
echo "   - This resolves the nil unwrap crash in EnabledAppController"
echo ""
