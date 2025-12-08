#!/bin/bash

# Script to set up EAS environment variables for image generation
# Usage: ./scripts/setup-eas-env-vars.sh
#
# IMPORTANT: Replace the placeholder values with your actual API tokens
# before running this script, or set them interactively when prompted.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    print_error "EAS CLI is not installed. Install it with: npm install -g eas-cli"
    exit 1
fi

# Check if user is logged in
if ! eas whoami &> /dev/null; then
    print_error "Not logged in to EAS. Run: eas login"
    exit 1
fi

print_header "EAS Environment Variables Setup for Image Generation"

print_info "This script will set up the following environment variables:"
echo "  • REPLICATE_API_TOKEN"
echo "  • BACKUP_IMAGE_API_TOKEN"
echo "  • IMAGE_GENERATION_ENABLED"
echo ""

# Check if values are provided as arguments or environment variables
REPLICATE_TOKEN="${1:-${REPLICATE_API_TOKEN}}"
BACKUP_TOKEN="${2:-${BACKUP_IMAGE_API_TOKEN}}"
IMAGE_GEN_ENABLED="${3:-${IMAGE_GENERATION_ENABLED:-true}}"

# If not provided, prompt for values
if [ -z "$REPLICATE_TOKEN" ]; then
    print_warning "REPLICATE_API_TOKEN not provided"
    echo -n "Enter your Replicate API token (r8_...): "
    read -s REPLICATE_TOKEN
    echo ""
    if [ -z "$REPLICATE_TOKEN" ]; then
        print_error "REPLICATE_API_TOKEN is required"
        exit 1
    fi
fi

if [ -z "$BACKUP_TOKEN" ]; then
    print_warning "BACKUP_IMAGE_API_TOKEN not provided"
    echo -n "Enter your backup image API token (r8_...): "
    read -s BACKUP_TOKEN
    echo ""
    if [ -z "$BACKUP_TOKEN" ]; then
        print_warning "BACKUP_IMAGE_API_TOKEN is optional, but recommended"
        echo -n "Continue without backup token? (y/N): "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

print_info "Setting up EAS environment variables..."

# Set REPLICATE_API_TOKEN
print_info "Setting REPLICATE_API_TOKEN..."
if eas secret:create --scope project --name REPLICATE_API_TOKEN --value "$REPLICATE_TOKEN" 2>&1; then
    print_info "✅ REPLICATE_API_TOKEN set successfully"
else
    print_error "Failed to set REPLICATE_API_TOKEN"
    exit 1
fi

# Set BACKUP_IMAGE_API_TOKEN (if provided)
if [ -n "$BACKUP_TOKEN" ]; then
    print_info "Setting BACKUP_IMAGE_API_TOKEN..."
    if eas secret:create --scope project --name BACKUP_IMAGE_API_TOKEN --value "$BACKUP_TOKEN" 2>&1; then
        print_info "✅ BACKUP_IMAGE_API_TOKEN set successfully"
    else
        print_warning "Failed to set BACKUP_IMAGE_API_TOKEN (may already exist)"
    fi
fi

# Set IMAGE_GENERATION_ENABLED
print_info "Setting IMAGE_GENERATION_ENABLED to $IMAGE_GEN_ENABLED..."
if eas secret:create --scope project --name IMAGE_GENERATION_ENABLED --value "$IMAGE_GEN_ENABLED" 2>&1; then
    print_info "✅ IMAGE_GENERATION_ENABLED set successfully"
else
    print_warning "Failed to set IMAGE_GENERATION_ENABLED (may already exist)"
fi

echo ""
print_header "Setup Complete!"

print_info "Environment variables have been set. You can verify them with:"
echo "  eas secret:list"
echo ""
print_info "Next steps:"
echo "  1. Rebuild your app for TestFlight:"
echo "     eas build --platform ios --profile production"
echo ""
print_info "Note: If secrets already exist, you may need to update them with:"
echo "  eas secret:delete --scope project --name <SECRET_NAME>"
echo "  (then run this script again)"

