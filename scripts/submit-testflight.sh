#!/bin/bash

# Script to submit iOS build to TestFlight with retry logic
# Usage: ./scripts/submit-testflight.sh [--latest | --id <build-id>]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Maximum number of retries
MAX_RETRIES=3
RETRY_DELAY=30  # seconds

# Function to submit with retry logic
submit_with_retry() {
    local attempt=1
    local submit_args="$@"
    
    while [ $attempt -le $MAX_RETRIES ]; do
        print_info "Attempt $attempt of $MAX_RETRIES: Submitting to TestFlight..."
        
        if eas submit --platform ios --profile production --wait --verbose $submit_args; then
            print_info "✅ Successfully submitted to TestFlight!"
            return 0
        else
            local exit_code=$?
            
            if [ $attempt -lt $MAX_RETRIES ]; then
                print_warning "Submission failed (exit code: $exit_code)"
                print_info "Waiting ${RETRY_DELAY} seconds before retry..."
                sleep $RETRY_DELAY
                
                # Exponential backoff
                RETRY_DELAY=$((RETRY_DELAY * 2))
            else
                print_error "Submission failed after $MAX_RETRIES attempts"
                return $exit_code
            fi
        fi
        
        attempt=$((attempt + 1))
    done
    
    return 1
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

# Parse arguments
SUBMIT_ARGS=""

if [ "$1" == "--latest" ]; then
    SUBMIT_ARGS="--latest"
    print_info "Submitting latest iOS build..."
elif [ "$1" == "--id" ] && [ -n "$2" ]; then
    SUBMIT_ARGS="--id $2"
    print_info "Submitting build ID: $2"
elif [ -n "$1" ]; then
    print_error "Unknown argument: $1"
    echo "Usage: $0 [--latest | --id <build-id>]"
    exit 1
else
    SUBMIT_ARGS="--latest"
    print_info "No arguments provided, submitting latest iOS build..."
fi

# Submit with retry logic
submit_with_retry $SUBMIT_ARGS

exit $?

