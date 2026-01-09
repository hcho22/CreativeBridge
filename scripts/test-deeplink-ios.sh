#!/bin/bash

# Test Deep Link on iOS Simulator
# Usage: ./scripts/test-deeplink-ios.sh [url]

# Default test URL
TEST_URL="${1:-creativebridge://auth/callback?test=1}"

echo "🔗 Testing deep link on iOS Simulator..."
echo "URL: $TEST_URL"
echo ""

# Check if simulator is booted
BOOTED_DEVICE=$(xcrun simctl list devices | grep Booted | head -1)
if [ -z "$BOOTED_DEVICE" ]; then
    echo "❌ No simulator is booted"
    echo "Please boot a simulator first:"
    echo "  open -a Simulator"
    exit 1
fi

echo "✅ Simulator is booted: $BOOTED_DEVICE"
echo ""

# Check if app is installed
APP_INSTALLED=$(xcrun simctl listapps booted 2>/dev/null | grep -i "org.name.CreativeBridge" || echo "")
if [ -z "$APP_INSTALLED" ]; then
    echo "⚠️  App not found on simulator"
    echo "Please build and install the app first:"
    echo "  npm run ios"
    exit 1
fi

echo "✅ App is installed on simulator"
echo ""

# Send deep link
echo "📤 Sending deep link..."
xcrun simctl openurl booted "$TEST_URL"

if [ $? -eq 0 ]; then
    echo "✅ Deep link sent successfully!"
    echo ""
    echo "Check the app console/logs for:"
    echo "  - 'Deep link received: $TEST_URL'"
    echo "  - 'OAuth callback detected via deep link'"
else
    echo "❌ Failed to send deep link"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Ensure app is built with latest Info.plist changes"
    echo "  2. Rebuild app: npm run ios"
    echo "  3. Restart simulator if needed"
    exit 1
fi






