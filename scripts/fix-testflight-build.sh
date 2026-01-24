#!/bin/bash

# CreativeBridge TestFlight Build Troubleshooting Script
# This script helps diagnose and fix build/submission issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  CreativeBridge TestFlight Build Troubleshooting${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Step 1: Check EAS login status
echo -e "${YELLOW}[1/7] Checking EAS login status...${NC}"
if eas whoami &> /dev/null; then
    USERNAME=$(eas whoami)
    echo -e "${GREEN}✓ Logged in as: $USERNAME${NC}"
else
    echo -e "${RED}✗ Not logged in to EAS${NC}"
    echo "Please run: eas login"
    exit 1
fi
echo ""

# Step 2: Check project configuration
echo -e "${YELLOW}[2/7] Verifying project configuration...${NC}"
if eas project:info &> /dev/null; then
    echo -e "${GREEN}✓ Project linked to EAS${NC}"
    eas project:info | grep -E "Project ID|Owner"
else
    echo -e "${RED}✗ Project not linked to EAS${NC}"
    exit 1
fi
echo ""

# Step 3: Check bundle identifier consistency
echo -e "${YELLOW}[3/7] Checking bundle identifier consistency...${NC}"
APP_JSON_BUNDLE=$(grep -A 2 '"ios"' app.json | grep bundleIdentifier | sed 's/.*: "\(.*\)".*/\1/')
PLIST_BUNDLE="org.name.CreativeBridge"
XCODE_BUNDLE=$(cd ios && xcodebuild -showBuildSettings -project CreativeBridge.xcodeproj -target CreativeBridge 2>/dev/null | grep "PRODUCT_BUNDLE_IDENTIFIER =" | head -1 | awk '{print $3}')

echo "  app.json:           $APP_JSON_BUNDLE"
echo "  Info.plist:         $PLIST_BUNDLE (expected)"
echo "  Xcode project:      $XCODE_BUNDLE"

if [ "$XCODE_BUNDLE" == "org.name.CreativeBridge" ]; then
    echo -e "${GREEN}✓ Bundle identifiers match${NC}"
else
    echo -e "${RED}✗ Bundle identifier mismatch!${NC}"
    echo "Expected: org.name.CreativeBridge"
    echo "Got: $XCODE_BUNDLE"
fi
echo ""

# Step 4: Check for capability sync environment variable
echo -e "${YELLOW}[4/7] Checking capability sync configuration...${NC}"
if grep -q "EXPO_NO_CAPABILITY_SYNC" eas.json; then
    echo -e "${GREEN}✓ Capability sync disabled in eas.json${NC}"
else
    echo -e "${YELLOW}⚠ Capability sync not disabled${NC}"
    echo "  Consider adding EXPO_NO_CAPABILITY_SYNC=1 to avoid Apple capability conflicts"
fi
echo ""

# Step 5: Check recent builds
echo -e "${YELLOW}[5/7] Checking recent builds...${NC}"
LATEST_BUILD=$(eas build:list --platform ios --limit 1 --json 2>/dev/null | jq -r '.[0].id' 2>/dev/null || echo "")
if [ -n "$LATEST_BUILD" ]; then
    echo -e "${GREEN}✓ Latest build ID: $LATEST_BUILD${NC}"
    BUILD_STATUS=$(eas build:list --platform ios --limit 1 --json 2>/dev/null | jq -r '.[0].status' 2>/dev/null || echo "unknown")
    echo "  Status: $BUILD_STATUS"
else
    echo -e "${YELLOW}⚠ No recent builds found${NC}"
fi
echo ""

# Step 6: Check eas.json configuration
echo -e "${YELLOW}[6/7] Checking eas.json configuration...${NC}"
if grep -q "ascAppId" eas.json; then
    ASC_APP_ID=$(grep ascAppId eas.json | sed 's/.*: "\(.*\)".*/\1/')
    if [ "$ASC_APP_ID" == "PLACEHOLDER_NEEDS_APP_STORE_CONNECT_ID" ]; then
        echo -e "${RED}✗ ascAppId is placeholder - needs App Store Connect ID${NC}"
        echo ""
        echo -e "${BLUE}To fix this:${NC}"
        echo "1. Go to https://appstoreconnect.apple.com"
        echo "2. Navigate to 'My Apps' → CreativeBridge"
        echo "3. Under 'App Information', find 'Apple ID' (10-digit number)"
        echo "4. Update eas.json with: \"ascAppId\": \"YOUR_APP_ID\""
        echo ""
    else
        echo -e "${GREEN}✓ ascAppId configured: $ASC_APP_ID${NC}"
    fi
else
    echo -e "${YELLOW}⚠ ascAppId not set in eas.json${NC}"
fi
echo ""

# Step 7: Provide next steps
echo -e "${YELLOW}[7/7] Recommended actions:${NC}"
echo ""
echo -e "${BLUE}Current Issue:${NC}"
echo "  Failed to patch capabilities: APPLE_ID_AUTH"
echo "  Bundle 'L26846T9DM' cannot be deleted - Apps are related to this bundle"
echo ""
echo -e "${BLUE}Solution Steps:${NC}"
echo ""
echo -e "${GREEN}Option 1: Manual Apple Developer Console Cleanup (Recommended)${NC}"
echo "  1. Visit: https://developer.apple.com/account/resources/identifiers/list"
echo "  2. Find bundle: org.name.CreativeBridge"
echo "  3. Check if there are any conflicting capabilities (Sign in with Apple)"
echo "  4. Remove or disable conflicting capabilities"
echo "  5. If you see duplicate bundle IDs, delete the unused ones"
echo ""
echo -e "${GREEN}Option 2: Build with Capability Sync Disabled${NC}"
echo "  Environment variable EXPO_NO_CAPABILITY_SYNC=1 is now configured in eas.json"
echo "  Run: eas build --platform ios --profile production"
echo ""
echo -e "${GREEN}Option 3: Get App Store Connect ID${NC}"
echo "  1. Go to: https://appstoreconnect.apple.com"
echo "  2. My Apps → CreativeBridge"
echo "  3. Find 'Apple ID' under App Information"
echo "  4. Update eas.json: \"ascAppId\": \"YOUR_10_DIGIT_ID\""
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  For immediate help with the bundle conflict:${NC}"
echo -e "${BLUE}  https://developer.apple.com/account/resources/identifiers/bundleId/edit/L26846T9DM${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
