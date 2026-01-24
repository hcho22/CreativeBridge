#!/bin/bash
# Verify TestFlight Crash Fix
# This script verifies that the expo-updates crash fix is properly applied

set -e

echo "🔍 Verifying TestFlight crash fix..."
echo ""

ERRORS=0

# Check 1: Verify Expo.plist has EXUpdatesRequestHeaders
echo "📋 Check 1: Expo.plist configuration..."
if plutil -extract EXUpdatesRequestHeaders xml1 -o - ios/CreativeBridge/Supporting/Expo.plist > /dev/null 2>&1; then
    echo "✅ EXUpdatesRequestHeaders is present in Expo.plist"
else
    echo "❌ EXUpdatesRequestHeaders is MISSING from Expo.plist"
    ERRORS=$((ERRORS + 1))
fi

# Check 2: Verify AppDelegate.swift calls start()
echo ""
echo "📋 Check 2: AppDelegate.swift initialization..."
if grep -q "AppController\.sharedInstance\.start()" ios/CreativeBridge/AppDelegate.swift; then
    echo "✅ AppController.sharedInstance.start() is called in AppDelegate"
else
    echo "❌ AppController.sharedInstance.start() is NOT called in AppDelegate"
    ERRORS=$((ERRORS + 1))
fi

# Check 3: Verify AppDelegate.swift calls initializeWithoutStarting()
echo ""
echo "📋 Check 3: AppController initialization..."
if grep -q "AppController\.initializeWithoutStarting()" ios/CreativeBridge/AppDelegate.swift; then
    echo "✅ AppController.initializeWithoutStarting() is called in AppDelegate"
else
    echo "❌ AppController.initializeWithoutStarting() is NOT called in AppDelegate"
    ERRORS=$((ERRORS + 1))
fi

# Check 4: Verify the order is correct
echo ""
echo "📋 Check 4: Initialization order..."
INIT_LINE=$(grep -n "AppController.initializeWithoutStarting()" ios/CreativeBridge/AppDelegate.swift | cut -d: -f1 | head -1)
START_LINE=$(grep -n "AppController.sharedInstance.start()" ios/CreativeBridge/AppDelegate.swift | cut -d: -f1 | head -1)

if [ -n "$INIT_LINE" ] && [ -n "$START_LINE" ] && [ "$INIT_LINE" -lt "$START_LINE" ]; then
    echo "✅ initializeWithoutStarting() is called before start()"
else
    echo "❌ Initialization order is incorrect"
    ERRORS=$((ERRORS + 1))
fi

# Check 5: Verify isActiveController check exists
echo ""
echo "📋 Check 5: Active controller check..."
if grep -q "isActiveController" ios/CreativeBridge/AppDelegate.swift; then
    echo "✅ isActiveController check is present"
else
    echo "⚠️  Warning: isActiveController check is missing (non-critical)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ]; then
    echo "🎉 All checks passed! The TestFlight crash fix is properly applied."
    echo ""
    echo "Next steps:"
    echo "  1. Build for production: npm run eas:build:production"
    echo "  2. Submit to TestFlight: npm run eas:submit:testflight"
    echo "  3. Test on physical device"
    exit 0
else
    echo "❌ $ERRORS check(s) failed. Please review the fix."
    echo ""
    echo "Fix summary:"
    echo "  1. Add EXUpdatesRequestHeaders to Expo.plist"
    echo "  2. Call AppController.initializeWithoutStarting() in AppDelegate"
    echo "  3. Call AppController.sharedInstance.start() after initialization"
    exit 1
fi
