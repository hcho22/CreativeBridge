#!/bin/bash

# Quick Fix Script for Apple ID Auth Capability Issue
# This provides manual cleanup instructions and emergency workarounds

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║  CreativeBridge - TestFlight Build Capability Issue Fix      ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${YELLOW}Problem:${NC} Apple ID Auth capability sync failure"
echo -e "${YELLOW}Bundle ID:${NC} org.name.CreativeBridge (L26846T9DM)"
echo ""

# Check if user wants detailed explanation
echo -e "${BLUE}${BOLD}What happened?${NC}"
echo "EAS Build tried to disable 'Sign in with Apple' capability but"
echo "Apple Developer Console won't allow the change because there are"
echo "existing apps associated with this bundle identifier."
echo ""

# Present options
echo -e "${GREEN}${BOLD}Choose a solution:${NC}"
echo ""
echo -e "${GREEN}1. ${BOLD}[RECOMMENDED]${NC} Manual Fix in Apple Developer Console (5-10 min)"
echo "   - Permanent solution"
echo "   - Clean and proper"
echo "   - No side effects"
echo ""
echo -e "${YELLOW}2. ${BOLD}[EMERGENCY]${NC} Build with capability sync disabled"
echo "   - Quick workaround"
echo "   - May cause issues later"
echo "   - Use only if needed NOW"
echo ""
echo -e "${BLUE}3.${NC} Submit a previous successful build"
echo "   - Deploy without new changes"
echo "   - Emergency fallback"
echo ""
echo -e "${CYAN}4.${NC} View detailed troubleshooting guide"
echo ""
read -p "Enter choice [1-4]: " choice

case $choice in
  1)
    echo ""
    echo -e "${GREEN}${BOLD}═══ SOLUTION 1: Manual Capability Cleanup ═══${NC}"
    echo ""
    echo -e "${YELLOW}Step-by-step instructions:${NC}"
    echo ""
    echo "1️⃣  Open Apple Developer Console:"
    echo -e "   ${BLUE}https://developer.apple.com/account/resources/identifiers/list${NC}"
    echo ""
    echo "   Or use the direct link:"
    echo -e "   ${BLUE}https://developer-mdn.apple.com/account/resources/identifiers/bundleId/edit/L26846T9DM${NC}"
    echo ""
    echo "2️⃣  Find bundle identifier:"
    echo "   Search for: ${CYAN}org.name.CreativeBridge${NC}"
    echo "   Click on it to view details"
    echo ""
    echo "3️⃣  Check capabilities:"
    echo "   Look for ${YELLOW}'Sign in with Apple'${NC} checkbox"
    echo "   It's probably ENABLED (causing the conflict)"
    echo ""
    echo "4️⃣  Disable the capability:"
    echo "   ${RED}[IMPORTANT]${NC} Since your local project doesn't use 'Sign in with Apple'"
    echo "   (the entitlements file is empty), you should:"
    echo "   - ${CYAN}UNCHECK${NC} 'Sign in with Apple'"
    echo "   - Ensure NO other capabilities are enabled"
    echo ""
    echo "5️⃣  Save changes:"
    echo "   - Click ${GREEN}'Save'${NC}"
    echo "   - Confirm the changes"
    echo ""
    echo "6️⃣  Retry the build:"
    echo -e "   ${CYAN}eas build --platform ios --profile production${NC}"
    echo ""
    echo -e "${GREEN}Press Enter when you've completed these steps...${NC}"
    read

    # Offer to run the build
    echo ""
    read -p "Would you like to start the build now? (y/n): " start_build
    if [[ $start_build == "y" || $start_build == "Y" ]]; then
      echo ""
      echo -e "${CYAN}Starting EAS build...${NC}"
      eas build --platform ios --profile production
    else
      echo ""
      echo "You can manually run the build later with:"
      echo -e "${CYAN}  eas build --platform ios --profile production${NC}"
    fi
    ;;

  2)
    echo ""
    echo -e "${YELLOW}${BOLD}═══ SOLUTION 2: Emergency Workaround ═══${NC}"
    echo ""
    echo -e "${RED}⚠️  WARNING:${NC} This is a temporary fix that may cause issues later"
    echo ""
    echo -e "${YELLOW}This will build with capability sync disabled.${NC}"
    echo "The mismatch between your local project and Apple Developer Console"
    echo "will remain, which could cause problems with:"
    echo "  - Provisioning profiles"
    echo "  - App Store submission"
    echo "  - Runtime permissions"
    echo ""
    read -p "Are you sure you want to proceed? (y/n): " confirm

    if [[ $confirm == "y" || $confirm == "Y" ]]; then
      echo ""
      echo -e "${CYAN}Building with EXPO_NO_CAPABILITY_SYNC=1...${NC}"
      EXPO_NO_CAPABILITY_SYNC=1 eas build --platform ios --profile production
    else
      echo ""
      echo "Build cancelled. Consider using Solution 1 instead."
    fi
    ;;

  3)
    echo ""
    echo -e "${BLUE}${BOLD}═══ SOLUTION 3: Submit Previous Build ═══${NC}"
    echo ""
    echo "Fetching recent successful builds..."
    echo ""
    eas build:list --platform ios --limit 5 --status finished
    echo ""
    read -p "Enter the Build ID you want to submit: " build_id

    if [ -n "$build_id" ]; then
      echo ""
      echo -e "${CYAN}Submitting build ${build_id} to TestFlight...${NC}"
      bash scripts/submit-testflight.sh --id "$build_id"
    else
      echo ""
      echo "No build ID provided. Cancelled."
    fi
    ;;

  4)
    echo ""
    echo -e "${CYAN}${BOLD}═══ Detailed Troubleshooting Guide ═══${NC}"
    echo ""
    echo "Opening the comprehensive troubleshooting document..."
    echo ""
    echo -e "File: ${BLUE}.agent/Troubleshooting/testflight-build-failure-fix.md${NC}"
    echo ""

    if command -v open &> /dev/null; then
      open .agent/Troubleshooting/testflight-build-failure-fix.md
    elif command -v xdg-open &> /dev/null; then
      xdg-open .agent/Troubleshooting/testflight-build-failure-fix.md
    else
      cat .agent/Troubleshooting/testflight-build-failure-fix.md
    fi
    ;;

  *)
    echo ""
    echo -e "${RED}Invalid choice${NC}"
    echo "Please run the script again and choose 1-4"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════${NC}"
echo -e "${GREEN}Done!${NC}"
echo ""
echo -e "${YELLOW}Need more help?${NC}"
echo "  - View detailed guide: ${BLUE}.agent/Troubleshooting/testflight-build-failure-fix.md${NC}"
echo "  - Check deployment SOP: ${BLUE}.agent/SOP/testflight-deployment-procedure.md${NC}"
echo ""
