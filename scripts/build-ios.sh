#!/bin/bash

# CreativeBridge iOS Build Script
# Builds the iOS app for distribution

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="CreativeBridge"
SCHEME="CreativeBridge"
WORKSPACE="CreativeBridge.xcworkspace"
BUILD_DIR="build"
ARCHIVE_PATH="$BUILD_DIR/$APP_NAME.xcarchive"

# Functions
print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check if we're in the right directory
    if [ ! -f "../package.json" ]; then
        print_error "Please run this script from the project root: npm run build:ios"
        exit 1
    fi
    
    # Check if Xcode is installed
    if ! command -v xcodebuild &> /dev/null; then
        print_error "Xcode is not installed or xcodebuild is not in PATH"
        exit 1
    fi
    
    # Check if workspace exists
    if [ ! -d "ios/$WORKSPACE" ]; then
        print_error "Workspace not found. Run 'cd ios && pod install' first"
        exit 1
    fi
    
    print_success "All prerequisites met"
}

# Clean previous builds
clean_build() {
    print_header "Cleaning Previous Builds"
    
    cd ios
    
    # Remove build directory
    if [ -d "$BUILD_DIR" ]; then
        rm -rf "$BUILD_DIR"
        print_success "Removed existing build directory"
    fi
    
    # Create fresh build directory
    mkdir -p "$BUILD_DIR"
    
    # Clean Xcode build
    xcodebuild clean \
        -workspace "$WORKSPACE" \
        -scheme "$SCHEME" \
        -quiet
    
    print_success "Build environment cleaned"
}

# Install dependencies
install_dependencies() {
    print_header "Installing Dependencies"
    
    # Install pods
    if command -v pod &> /dev/null; then
        print_info "Installing CocoaPods dependencies..."
        pod install --quiet
        print_success "CocoaPods dependencies installed"
    else
        print_warning "CocoaPods not found. Install with: gem install cocoapods"
        exit 1
    fi
}

# Create export options plist
create_export_options() {
    print_header "Creating Export Options"
    
    cat > exportOptions.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>destination</key>
    <string>export</string>
    <key>compileBitcode</key>
    <true/>
    <key>uploadSymbols</key>
    <true/>
    <key>uploadBitcode</key>
    <false/>
    <key>manageAppVersionAndBuildNumber</key>
    <false/>
    <key>teamID</key>
    <string>YOUR_TEAM_ID</string>
    <key>signingStyle</key>
    <string>automatic</string>
    <key>provisioningProfiles</key>
    <dict>
        <key>com.yourcompany.creativebridge</key>
        <string>CreativeBridge Distribution Profile</string>
    </dict>
</dict>
</plist>
EOF
    
    print_success "Export options created"
}

# Build for device
build_archive() {
    print_header "Building Archive"
    
    print_info "This may take several minutes..."
    
    # Build archive
    xcodebuild archive \
        -workspace "$WORKSPACE" \
        -scheme "$SCHEME" \
        -configuration Release \
        -archivePath "$ARCHIVE_PATH" \
        -destination "generic/platform=iOS" \
        -allowProvisioningUpdates \
        SKIP_INSTALL=NO \
        BUILD_LIBRARY_FOR_DISTRIBUTION=YES
    
    if [ $? -eq 0 ]; then
        print_success "Archive build completed successfully"
    else
        print_error "Archive build failed"
        exit 1
    fi
}

# Export IPA
export_ipa() {
    print_header "Exporting IPA"
    
    # Check if archive exists
    if [ ! -d "$ARCHIVE_PATH" ]; then
        print_error "Archive not found at $ARCHIVE_PATH"
        exit 1
    fi
    
    # Export archive to IPA
    xcodebuild -exportArchive \
        -archivePath "$ARCHIVE_PATH" \
        -exportPath "$BUILD_DIR/" \
        -exportOptionsPlist exportOptions.plist \
        -allowProvisioningUpdates
    
    if [ $? -eq 0 ]; then
        print_success "IPA export completed successfully"
    else
        print_error "IPA export failed"
        exit 1
    fi
}

# Development build (for simulator)
build_for_simulator() {
    print_header "Building for Simulator (Development)"
    
    xcodebuild build \
        -workspace "$WORKSPACE" \
        -scheme "$SCHEME" \
        -configuration Debug \
        -destination "platform=iOS Simulator,name=iPhone 14" \
        -quiet
    
    if [ $? -eq 0 ]; then
        print_success "Simulator build completed"
    else
        print_error "Simulator build failed"
        exit 1
    fi
}

# Show build info
show_build_info() {
    print_header "Build Information"
    
    if [ -f "$BUILD_DIR/$APP_NAME.ipa" ]; then
        IPA_SIZE=$(du -h "$BUILD_DIR/$APP_NAME.ipa" | cut -f1)
        print_info "IPA file: $BUILD_DIR/$APP_NAME.ipa"
        print_info "IPA size: $IPA_SIZE"
    fi
    
    if [ -d "$ARCHIVE_PATH" ]; then
        ARCHIVE_SIZE=$(du -sh "$ARCHIVE_PATH" | cut -f1)
        print_info "Archive: $ARCHIVE_PATH"
        print_info "Archive size: $ARCHIVE_SIZE"
    fi
    
    print_info "Build directory: ios/$BUILD_DIR/"
}

# Cleanup function
cleanup() {
    print_header "Cleanup"
    
    # Remove export options plist
    if [ -f "exportOptions.plist" ]; then
        rm exportOptions.plist
        print_success "Removed temporary export options"
    fi
    
    # Optionally clean derived data
    if [ "$CLEAN_DERIVED_DATA" = "true" ]; then
        rm -rf ~/Library/Developer/Xcode/DerivedData/CreativeBridge-*
        print_success "Cleaned derived data"
    fi
}

# Main build process
main() {
    print_header "CreativeBridge iOS Build"
    print_info "Starting build process..."
    
    # Parse command line arguments
    BUILD_TYPE="release"
    while [[ $# -gt 0 ]]; do
        case $1 in
            --simulator)
                BUILD_TYPE="simulator"
                shift
                ;;
            --clean-derived-data)
                CLEAN_DERIVED_DATA="true"
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --simulator          Build for simulator only"
                echo "  --clean-derived-data Clean Xcode derived data after build"
                echo "  --help, -h           Show this help message"
                exit 0
                ;;
            *)
                print_warning "Unknown option: $1"
                shift
                ;;
        esac
    done
    
    # Run build steps
    check_prerequisites
    
    if [ "$BUILD_TYPE" = "simulator" ]; then
        clean_build
        install_dependencies
        build_for_simulator
        print_success "Simulator build completed!"
    else
        clean_build
        install_dependencies
        create_export_options
        build_archive
        export_ipa
        show_build_info
        cleanup
        
        print_success "Production build completed!"
        print_info "Next steps:"
        print_info "1. Test the IPA on a device using TestFlight or direct installation"
        print_info "2. Upload to App Store Connect using Xcode or Application Loader"
        print_info "3. Submit for App Store review"
    fi
}

# Handle script interruption
trap cleanup EXIT

# Run main function
main "$@"