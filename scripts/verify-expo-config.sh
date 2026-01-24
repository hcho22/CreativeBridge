#!/bin/bash
# Verify Expo Updates Configuration
# This script checks that all required expo-updates keys are present

set -e

EXPO_PLIST="ios/CreativeBridge/Supporting/Expo.plist"

echo "🔍 Verifying Expo Updates Configuration..."
echo ""

# Check if file exists
if [ ! -f "$EXPO_PLIST" ]; then
    echo "❌ Error: $EXPO_PLIST not found"
    exit 1
fi

# Check if plist is valid
if ! plutil -lint "$EXPO_PLIST" > /dev/null 2>&1; then
    echo "❌ Error: $EXPO_PLIST is not valid XML"
    exit 1
fi

echo "✅ Expo.plist is valid XML"

# Convert to JSON for easier parsing
PLIST_JSON=$(plutil -convert json -o - "$EXPO_PLIST")

# Check required keys
REQUIRED_KEYS=(
    "EXUpdatesEnabled"
    "EXUpdatesURL"
    "EXUpdatesRuntimeVersion"
    "EXUpdatesRequestHeaders"
)

ALL_PRESENT=true

for key in "${REQUIRED_KEYS[@]}"; do
    if echo "$PLIST_JSON" | grep -q "\"$key\""; then
        echo "✅ $key is present"
    else
        echo "❌ $key is MISSING"
        ALL_PRESENT=false
    fi
done

echo ""

if [ "$ALL_PRESENT" = true ]; then
    echo "🎉 All required expo-updates configuration keys are present!"
    echo ""
    echo "Configuration details:"
    echo "$PLIST_JSON" | python3 -m json.tool
    exit 0
else
    echo "❌ Configuration is incomplete"
    exit 1
fi
