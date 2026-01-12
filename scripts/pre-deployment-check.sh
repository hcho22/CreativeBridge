#!/bin/bash

# Pre-Deployment Verification Script
# Task 7.2: Code Deployment
# This script verifies that all prerequisites are met before deploying to production

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║     PRE-DEPLOYMENT VERIFICATION CHECKLIST              ║"
echo "║     Task 7.2: Code Deployment                          ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Function to print test result
print_result() {
    local test_name=$1
    local status=$2
    local message=$3

    if [ "$status" == "pass" ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        [ -n "$message" ] && echo -e "  ${BLUE}→${NC} $message"
        ((PASSED++))
    elif [ "$status" == "fail" ]; then
        echo -e "${RED}✗${NC} $test_name"
        [ -n "$message" ] && echo -e "  ${RED}→${NC} $message"
        ((FAILED++))
    elif [ "$status" == "warn" ]; then
        echo -e "${YELLOW}⚠${NC} $test_name"
        [ -n "$message" ] && echo -e "  ${YELLOW}→${NC} $message"
        ((WARNINGS++))
    fi
    echo ""
}

# ============================================================
# SECTION 1: Environment Checks
# ============================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 1: Environment Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Node.js version
NODE_VERSION=$(node --version | cut -d 'v' -f 2)
REQUIRED_NODE_VERSION="20.0.0"
if [ "$(printf '%s\n' "$REQUIRED_NODE_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_NODE_VERSION" ]; then
    print_result "Node.js version >= 20" "pass" "Current: v$NODE_VERSION"
else
    print_result "Node.js version >= 20" "fail" "Current: v$NODE_VERSION, Required: >= v$REQUIRED_NODE_VERSION"
fi

# Check npm packages installed
if [ -d "node_modules" ]; then
    print_result "Node modules installed" "pass"
else
    print_result "Node modules installed" "fail" "Run 'npm install' first"
fi

# Check EAS CLI
if command -v eas &> /dev/null; then
    EAS_VERSION=$(eas --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
    print_result "EAS CLI installed" "pass" "Version: $EAS_VERSION"
else
    print_result "EAS CLI installed" "fail" "Install with: npm install -g eas-cli"
fi

# Check Git status
if [ -d ".git" ]; then
    print_result "Git repository" "pass"
else
    print_result "Git repository" "fail" "Not a git repository"
fi

# Check for uncommitted changes
UNCOMMITTED=$(git status --porcelain | wc -l)
if [ "$UNCOMMITTED" -eq 0 ]; then
    print_result "No uncommitted changes" "pass"
else
    print_result "No uncommitted changes" "warn" "$UNCOMMITTED files with uncommitted changes"
fi

# Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" == "main" ] || [ "$CURRENT_BRANCH" == "master" ]; then
    print_result "On main/master branch" "pass" "Branch: $CURRENT_BRANCH"
else
    print_result "On main/master branch" "warn" "Current branch: $CURRENT_BRANCH (consider merging to main first)"
fi

# ============================================================
# SECTION 2: Test Suite Status
# ============================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 2: Test Suite Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Running test suite (this may take a minute)..."
echo ""

# Run unit tests
if npm run test:unit > /tmp/test-output.log 2>&1; then
    UNIT_TEST_COUNT=$(grep -oP '\d+ passed' /tmp/test-output.log | head -1 | grep -oP '^\d+')
    print_result "Unit tests passing" "pass" "$UNIT_TEST_COUNT tests passed"
else
    FAILED_TESTS=$(grep -oP '\d+ failed' /tmp/test-output.log | head -1 | grep -oP '^\d+' || echo "unknown")
    print_result "Unit tests passing" "fail" "$FAILED_TESTS tests failed - Review output in /tmp/test-output.log"
fi

# Check if integration tests exist
if [ -f "jest.config.js" ] && grep -q "integration" jest.config.js; then
    print_result "Integration tests configured" "pass"
else
    print_result "Integration tests configured" "warn" "Integration tests not found or not configured"
fi

# Check if E2E tests exist
if [ -d "e2e" ] || [ -f ".detoxrc.js" ]; then
    print_result "E2E tests configured" "pass"
else
    print_result "E2E tests configured" "warn" "E2E tests not found"
fi

# ============================================================
# SECTION 3: Database Migration Status
# ============================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 3: Database Migration Status (Task 7.1)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if migration files exist
if [ -f "sql/add_story_completion_and_image_persistence.sql" ]; then
    print_result "Migration script exists" "pass" "sql/add_story_completion_and_image_persistence.sql"
else
    print_result "Migration script exists" "fail" "Migration script not found"
fi

if [ -f "sql/verify_migration.sql" ]; then
    print_result "Verification script exists" "pass" "sql/verify_migration.sql"
else
    print_result "Verification script exists" "fail" "Verification script not found"
fi

if [ -f "sql/rollback_story_completion_and_image_persistence.sql" ]; then
    print_result "Rollback script exists" "pass" "sql/rollback_story_completion_and_image_persistence.sql"
else
    print_result "Rollback script exists" "warn" "Rollback script not found"
fi

# Check if migration has been applied (this would need to query the database)
echo -e "${YELLOW}⚠${NC} Database migration status"
echo -e "  ${YELLOW}→${NC} Cannot verify automatically - Manual check required"
echo -e "  ${YELLOW}→${NC} Ensure Task 7.1 migration has been applied to production"
echo ""
((WARNINGS++))

# ============================================================
# SECTION 4: Build Configuration
# ============================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 4: Build Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check EAS configuration
if [ -f "eas.json" ]; then
    print_result "eas.json exists" "pass"

    # Check for production profile
    if grep -q '"production"' eas.json; then
        print_result "Production build profile configured" "pass"
    else
        print_result "Production build profile configured" "fail" "No production profile in eas.json"
    fi
else
    print_result "eas.json exists" "fail" "Run 'eas build:configure' first"
fi

# Check app.json
if [ -f "app.json" ]; then
    print_result "app.json exists" "pass"

    # Check for EAS project ID
    if grep -q "projectId" app.json; then
        PROJECT_ID=$(grep -oP '"projectId":\s*"\K[^"]+' app.json)
        print_result "EAS project ID configured" "pass" "Project: $PROJECT_ID"
    else
        print_result "EAS project ID configured" "fail" "No projectId in app.json"
    fi
else
    print_result "app.json exists" "fail" "app.json not found"
fi

# Check for iOS bundle identifier
if grep -q "bundleIdentifier" app.json; then
    BUNDLE_ID=$(grep -oP '"bundleIdentifier":\s*"\K[^"]+' app.json)
    print_result "iOS bundle identifier configured" "pass" "$BUNDLE_ID"
else
    print_result "iOS bundle identifier configured" "warn" "Not found in app.json"
fi

# Check for Android package name
if [ -f "android/app/build.gradle" ]; then
    PACKAGE_NAME=$(grep -oP 'applicationId\s+"\K[^"]+' android/app/build.gradle || echo "not found")
    if [ "$PACKAGE_NAME" != "not found" ]; then
        print_result "Android package name configured" "pass" "$PACKAGE_NAME"
    else
        print_result "Android package name configured" "warn" "Not found in build.gradle"
    fi
else
    print_result "Android build.gradle exists" "warn" "Android not configured"
fi

# ============================================================
# SECTION 5: Feature Implementation Status
# ============================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 5: Feature Implementation Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if key files exist
FILES_TO_CHECK=(
    "src/services/imageStorageService.ts:Image Storage Service"
    "src/services/storySessionManager.ts:Story Session Manager"
    "src/components/common/ImageGeneration.tsx:Image Generation Component"
    "src/components/common/StoryImageDisplay.tsx:Story Image Display Component"
    "src/types/database.ts:Database Types"
)

for file_info in "${FILES_TO_CHECK[@]}"; do
    IFS=':' read -r file desc <<< "$file_info"
    if [ -f "$file" ]; then
        print_result "$desc exists" "pass" "$file"
    else
        print_result "$desc exists" "fail" "$file not found"
    fi
done

# Check if tests exist for new services
TEST_FILES_TO_CHECK=(
    "src/__tests__/services/imageStorageService.test.ts:Image Storage Service Tests"
    "src/__tests__/services/storySessionManager.completion.test.ts:Completion Tests"
    "src/__tests__/services/storySessionManager.offline.test.ts:Offline Tests"
    "src/__tests__/security/imageStorageSecurity.test.ts:Security Tests"
)

for test_info in "${TEST_FILES_TO_CHECK[@]}"; do
    IFS=':' read -r file desc <<< "$test_info"
    if [ -f "$file" ]; then
        print_result "$desc exist" "pass" "$file"
    else
        print_result "$desc exist" "warn" "$file not found"
    fi
done

# ============================================================
# SECTION 6: Documentation Status
# ============================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 6: Documentation Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

DOCS_TO_CHECK=(
    ".agent/Tasks/TASKS-story-completion-and-image-persistence.md:Implementation Tasks"
    ".agent/Tasks/story-completion-and-image-persistence-PRD.md:PRD"
    ".agent/Tasks/TASK-7.1-production-migration-summary.md:Migration Guide"
    ".agent/Tasks/TASK-7.2-code-deployment-guide.md:Deployment Guide"
    "sql/PRODUCTION_MIGRATION_GUIDE.md:SQL Migration Guide"
)

for doc_info in "${DOCS_TO_CHECK[@]}"; do
    IFS=':' read -r file desc <<< "$doc_info"
    if [ -f "$file" ]; then
        print_result "$desc exists" "pass" "$file"
    else
        print_result "$desc exists" "warn" "$file not found"
    fi
done

# ============================================================
# SECTION 7: Environment Variables
# ============================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 7: Environment Variables"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check .env file exists
if [ -f ".env" ]; then
    print_result ".env file exists" "pass"

    # Check for required variables (without showing values)
    REQUIRED_VARS=(
        "SUPABASE_URL"
        "SUPABASE_ANON_KEY"
        "REPLICATE_API_TOKEN"
        "CLERK_PUBLISHABLE_KEY"
    )

    for var in "${REQUIRED_VARS[@]}"; do
        if grep -q "^$var=" .env; then
            print_result "$var configured" "pass" "(value hidden)"
        else
            print_result "$var configured" "fail" "Not found in .env"
        fi
    done
else
    print_result ".env file exists" "fail" "Environment variables not configured"
fi

# ============================================================
# SECTION 8: Security Checks
# ============================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 8: Security Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check for sensitive files that shouldn't be committed
SENSITIVE_FILES=(
    ".env"
    ".env.local"
    ".env.production"
    "google-services.json"
    "GoogleService-Info.plist"
)

for file in "${SENSITIVE_FILES[@]}"; do
    if git ls-files --error-unmatch "$file" 2>/dev/null; then
        print_result "$file not in git" "fail" "$file is tracked by git (potential security risk)"
    else
        print_result "$file not in git" "pass"
    fi
done

# Check if .gitignore exists and has common entries
if [ -f ".gitignore" ]; then
    print_result ".gitignore exists" "pass"

    GITIGNORE_ENTRIES=(
        ".env"
        "node_modules"
        ".expo"
    )

    for entry in "${GITIGNORE_ENTRIES[@]}"; do
        if grep -q "^$entry$" .gitignore || grep -q "^$entry/$" .gitignore; then
            # Silent pass - already checked .gitignore exists
            :
        else
            print_result ".gitignore contains $entry" "warn" "$entry should be in .gitignore"
        fi
    done
else
    print_result ".gitignore exists" "fail" ".gitignore not found"
fi

# ============================================================
# SUMMARY
# ============================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✓ Passed:${NC} $PASSED"
echo -e "${YELLOW}⚠ Warnings:${NC} $WARNINGS"
echo -e "${RED}✗ Failed:${NC} $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  ✓ ALL CHECKS PASSED - READY FOR DEPLOYMENT          ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Review the deployment guide: .agent/Tasks/TASK-7.2-code-deployment-guide.md"
        echo "2. Ensure Task 7.1 (database migration) is complete"
        echo "3. Run: eas build --platform all --profile production"
        echo "4. Submit builds to app stores"
        echo ""
        exit 0
    else
        echo -e "${YELLOW}╔════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║  ⚠ WARNINGS FOUND - REVIEW BEFORE PROCEEDING         ║${NC}"
        echo -e "${YELLOW}╚════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo "Review warnings above before deploying to production."
        echo "Some warnings may be acceptable depending on your setup."
        echo ""
        exit 0
    fi
else
    echo -e "${RED}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ✗ CHECKS FAILED - FIX ISSUES BEFORE DEPLOYMENT       ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Fix the failed checks above before proceeding with deployment."
    echo ""
    exit 1
fi
