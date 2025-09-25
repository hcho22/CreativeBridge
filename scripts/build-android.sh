#!/bin/bash

# CreativeBridge Android Build Script
# Builds the Android app for distribution

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="CreativeBridge"
BUILD_DIR="android/app/build"
OUTPUTS_DIR="$BUILD_DIR/outputs"
APK_DIR="$OUTPUTS_DIR/apk/release"
BUNDLE_DIR="$OUTPUTS_DIR/bundle/release"

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
    if [ ! -f "package.json" ]; then
        print_error "Please run this script from the project root directory"
        exit 1
    fi
    
    # Check if Android SDK is available
    if [ -z "$ANDROID_HOME" ]; then
        print_error "ANDROID_HOME environment variable is not set"
        print_info "Please set ANDROID_HOME to your Android SDK path"
        exit 1
    fi
    
    # Check if Java is available
    if ! command -v java &> /dev/null; then
        print_error "Java is not installed or not in PATH"
        exit 1
    fi
    
    # Check Java version (Android requires Java 11+)
    JAVA_VERSION=$(java -version 2>&1 | grep version | cut -d'"' -f2 | cut -d'.' -f1-2)
    print_info "Java version: $JAVA_VERSION"
    
    # Check if gradlew exists
    if [ ! -f "android/gradlew" ]; then
        print_error "Gradle wrapper not found. Please ensure Android project is properly set up"
        exit 1
    fi
    
    print_success "All prerequisites met"
}

# Clean previous builds
clean_build() {
    print_header "Cleaning Previous Builds"
    
    cd android
    
    # Clean gradle build
    ./gradlew clean --quiet
    
    print_success "Build environment cleaned"
    
    cd ..
}

# Install dependencies
install_dependencies() {
    print_header "Installing Dependencies"
    
    # Install npm dependencies
    if [ -f "package.json" ]; then
        print_info "Installing npm dependencies..."
        npm install --silent
        print_success "npm dependencies installed"
    fi
    
    # Install React Native dependencies
    print_info "Checking React Native setup..."
    npx react-native info --info
}

# Generate signing keystore (for first-time setup)
generate_keystore() {
    print_header "Keystore Setup"
    
    KEYSTORE_PATH="android/app/creativebridge-release-key.keystore"
    
    if [ ! -f "$KEYSTORE_PATH" ]; then
        print_warning "Release keystore not found"
        print_info "To create a release keystore, run:"
        echo "keytool -genkey -v -keystore $KEYSTORE_PATH -alias creativebridge-release -keyalg RSA -keysize 2048 -validity 10000"
        print_info "Then update android/gradle.properties with keystore details"
        return 1
    else
        print_success "Release keystore found"
        return 0
    fi
}

# Check signing configuration
check_signing_config() {
    print_header "Checking Signing Configuration"
    
    GRADLE_PROPERTIES="android/gradle.properties"
    
    if [ ! -f "$GRADLE_PROPERTIES" ]; then
        print_error "gradle.properties not found"
        return 1
    fi
    
    # Check for required signing properties
    REQUIRED_PROPS=("MYAPP_RELEASE_STORE_FILE" "MYAPP_RELEASE_KEY_ALIAS" "MYAPP_RELEASE_STORE_PASSWORD" "MYAPP_RELEASE_KEY_PASSWORD")
    
    for prop in "${REQUIRED_PROPS[@]}"; do
        if ! grep -q "^$prop=" "$GRADLE_PROPERTIES"; then
            print_warning "Missing signing property: $prop"
            return 1
        fi
    done
    
    print_success "Signing configuration verified"
    return 0
}

# Build APK
build_apk() {
    print_header "Building APK"
    
    cd android
    
    print_info "Building release APK..."
    print_info "This may take several minutes..."
    
    # Build release APK
    ./gradlew assembleRelease
    
    if [ $? -eq 0 ]; then
        print_success "APK build completed successfully"
    else
        print_error "APK build failed"
        exit 1
    fi
    
    cd ..
}

# Build AAB (Android App Bundle)
build_bundle() {
    print_header "Building Android App Bundle"
    
    cd android
    
    print_info "Building release AAB..."
    print_info "This may take several minutes..."
    
    # Build release bundle
    ./gradlew bundleRelease
    
    if [ $? -eq 0 ]; then
        print_success "AAB build completed successfully"
    else
        print_error "AAB build failed"
        exit 1
    fi
    
    cd ..
}

# Build debug version
build_debug() {
    print_header "Building Debug APK"
    
    cd android
    
    print_info "Building debug APK..."
    
    ./gradlew assembleDebug --quiet
    
    if [ $? -eq 0 ]; then
        print_success "Debug APK build completed"
    else
        print_error "Debug APK build failed"
        exit 1
    fi
    
    cd ..
}

# Show build info
show_build_info() {
    print_header "Build Information"
    
    # Check APK
    if [ -f "$APK_DIR/app-release.apk" ]; then
        APK_SIZE=$(du -h "$APK_DIR/app-release.apk" | cut -f1)
        print_info "Release APK: $APK_DIR/app-release.apk"
        print_info "APK size: $APK_SIZE"
    fi
    
    # Check AAB
    if [ -f "$BUNDLE_DIR/app-release.aab" ]; then
        AAB_SIZE=$(du -h "$BUNDLE_DIR/app-release.aab" | cut -f1)
        print_info "Release AAB: $BUNDLE_DIR/app-release.aab"
        print_info "AAB size: $AAB_SIZE"
    fi
    
    # Check debug APK
    if [ -f "$BUILD_DIR/outputs/apk/debug/app-debug.apk" ]; then
        DEBUG_SIZE=$(du -h "$BUILD_DIR/outputs/apk/debug/app-debug.apk" | cut -f1)
        print_info "Debug APK: $BUILD_DIR/outputs/apk/debug/app-debug.apk"
        print_info "Debug size: $DEBUG_SIZE"
    fi
    
    print_info "All build outputs in: $BUILD_DIR/outputs/"
}

# Install APK on connected device
install_apk() {
    print_header "Installing APK"
    
    # Check if adb is available
    if ! command -v adb &> /dev/null; then
        print_error "adb not found. Please ensure Android SDK platform-tools is in PATH"
        return 1
    fi
    
    # Check for connected devices
    DEVICES=$(adb devices | grep -v "List of devices" | grep "device$" | wc -l)
    if [ "$DEVICES" -eq 0 ]; then
        print_warning "No Android devices connected"
        return 1
    fi
    
    # Determine APK path
    APK_PATH=""
    if [ -f "$APK_DIR/app-release.apk" ]; then
        APK_PATH="$APK_DIR/app-release.apk"
    elif [ -f "$BUILD_DIR/outputs/apk/debug/app-debug.apk" ]; then
        APK_PATH="$BUILD_DIR/outputs/apk/debug/app-debug.apk"
    else
        print_error "No APK found to install"
        return 1
    fi
    
    print_info "Installing APK on connected device(s)..."
    adb install -r "$APK_PATH"
    
    if [ $? -eq 0 ]; then
        print_success "APK installed successfully"
    else
        print_error "APK installation failed"
    fi
}

# Create signing setup guide
create_signing_guide() {
    print_header "Creating Signing Setup Guide"
    
    cat > ANDROID_SIGNING_SETUP.md << EOF
# Android App Signing Setup

## 1. Generate Release Keystore

\`\`\`bash
keytool -genkey -v -keystore android/app/creativebridge-release-key.keystore -alias creativebridge-release -keyalg RSA -keysize 2048 -validity 10000
\`\`\`

**Important**: Store the keystore password and key password securely!

## 2. Configure gradle.properties

Add these lines to \`android/gradle.properties\`:

\`\`\`properties
MYAPP_RELEASE_STORE_FILE=creativebridge-release-key.keystore
MYAPP_RELEASE_KEY_ALIAS=creativebridge-release
MYAPP_RELEASE_STORE_PASSWORD=your_keystore_password
MYAPP_RELEASE_KEY_PASSWORD=your_key_password
\`\`\`

## 3. Update build.gradle

Ensure \`android/app/build.gradle\` has the signing config:

\`\`\`gradle
android {
    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {
                storeFile file(MYAPP_RELEASE_STORE_FILE)
                storePassword MYAPP_RELEASE_STORE_PASSWORD
                keyAlias MYAPP_RELEASE_KEY_ALIAS
                keyPassword MYAPP_RELEASE_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
}
\`\`\`

## 4. Security Notes

- Never commit keystore files to version control
- Keep keystore and passwords in a secure location
- Back up your keystore - losing it means you can't update your app!
- Consider using environment variables for passwords in CI/CD
EOF
    
    print_success "Signing setup guide created: ANDROID_SIGNING_SETUP.md"
}

# Main build process
main() {
    print_header "CreativeBridge Android Build"
    print_info "Starting build process..."
    
    # Parse command line arguments
    BUILD_TYPE="release"
    INSTALL_APK=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --debug)
                BUILD_TYPE="debug"
                shift
                ;;
            --apk)
                BUILD_OUTPUT="apk"
                shift
                ;;
            --bundle)
                BUILD_OUTPUT="bundle"
                shift
                ;;
            --install)
                INSTALL_APK=true
                shift
                ;;
            --setup-signing)
                create_signing_guide
                exit 0
                ;;
            --help|-h)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --debug              Build debug version"
                echo "  --apk                Build APK only"
                echo "  --bundle             Build AAB only"
                echo "  --install            Install APK after build"
                echo "  --setup-signing      Create signing setup guide"
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
    clean_build
    install_dependencies
    
    if [ "$BUILD_TYPE" = "debug" ]; then
        build_debug
        show_build_info
        print_success "Debug build completed!"
    else
        # Check signing for release builds
        if ! check_signing_config; then
            print_error "Signing configuration incomplete"
            print_info "Run: $0 --setup-signing for setup instructions"
            exit 1
        fi
        
        # Build based on specified output or both
        if [ "$BUILD_OUTPUT" = "apk" ]; then
            build_apk
        elif [ "$BUILD_OUTPUT" = "bundle" ]; then
            build_bundle
        else
            build_apk
            build_bundle
        fi
        
        show_build_info
        print_success "Release build completed!"
        print_info "Next steps:"
        print_info "1. Test the APK on device or upload AAB to Google Play Console"
        print_info "2. For Play Store: Use the AAB file for internal testing"
        print_info "3. For direct distribution: Use the APK file"
    fi
    
    # Install if requested
    if [ "$INSTALL_APK" = true ]; then
        install_apk
    fi
}

# Run main function
main "$@"