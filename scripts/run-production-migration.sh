#!/bin/bash

################################################################################
# Production Database Migration Script - Task 7.1
# Story Completion Tracking & Image Persistence
#
# This script automates the production migration process with safety checks
#
# Usage: ./scripts/run-production-migration.sh [OPTIONS]
# Options:
#   --project-ref <ref>   Production Supabase project reference (required)
#   --dry-run             Run in dry-run mode (verification only)
#   --skip-backup         Skip backup creation (NOT RECOMMENDED)
#   --help                Show this help message
#
# Prerequisites:
#   - Supabase CLI installed (npm install -g supabase)
#   - Production access credentials configured
#   - All pre-deployment checklist items completed
#
################################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SQL_DIR="$PROJECT_ROOT/sql"
BACKUP_DIR="$PROJECT_ROOT/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Default options
DRY_RUN=false
SKIP_BACKUP=false
PROD_PROJECT_REF=""

################################################################################
# Helper Functions
################################################################################

print_header() {
  echo ""
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

check_prerequisites() {
  print_header "Checking Prerequisites"

  # Check Supabase CLI
  if ! command -v supabase &> /dev/null; then
    print_error "Supabase CLI not found. Install with: npm install -g supabase"
    exit 1
  fi
  print_success "Supabase CLI installed"

  # Check SQL files exist
  if [ ! -f "$SQL_DIR/add_story_completion_and_image_persistence.sql" ]; then
    print_error "Migration file not found: $SQL_DIR/add_story_completion_and_image_persistence.sql"
    exit 1
  fi
  print_success "Migration file found"

  if [ ! -f "$SQL_DIR/verify_migration.sql" ]; then
    print_error "Verification file not found: $SQL_DIR/verify_migration.sql"
    exit 1
  fi
  print_success "Verification file found"

  if [ ! -f "$SQL_DIR/rollback_story_completion_and_image_persistence.sql" ]; then
    print_error "Rollback file not found: $SQL_DIR/rollback_story_completion_and_image_persistence.sql"
    exit 1
  fi
  print_success "Rollback file found"

  # Create backup directory
  mkdir -p "$BACKUP_DIR"
  print_success "Backup directory ready: $BACKUP_DIR"
}

confirm_action() {
  local message=$1
  if [ "$DRY_RUN" = true ]; then
    print_warning "DRY RUN MODE: Would execute - $message"
    return 0
  fi

  echo -e "${YELLOW}$message${NC}"
  read -p "Continue? (yes/no): " response
  if [ "$response" != "yes" ]; then
    print_error "Operation cancelled by user"
    exit 1
  fi
}

create_backup() {
  if [ "$SKIP_BACKUP" = true ]; then
    print_warning "Skipping backup creation (--skip-backup flag set)"
    return 0
  fi

  print_header "Creating Production Backup"

  BACKUP_FILE="$BACKUP_DIR/backup_prod_story_completion_${TIMESTAMP}.sql"

  if [ "$DRY_RUN" = true ]; then
    print_warning "DRY RUN: Would create backup at $BACKUP_FILE"
    return 0
  fi

  print_info "Creating backup: $BACKUP_FILE"
  supabase db dump --project-ref "$PROD_PROJECT_REF" > "$BACKUP_FILE"

  # Verify backup
  if [ ! -s "$BACKUP_FILE" ]; then
    print_error "Backup file is empty!"
    exit 1
  fi

  if ! grep -q "CREATE TABLE" "$BACKUP_FILE"; then
    print_error "Backup does not contain valid SQL!"
    exit 1
  fi

  local file_size=$(du -h "$BACKUP_FILE" | cut -f1)
  print_success "Backup created successfully"
  print_info "File: $BACKUP_FILE"
  print_info "Size: $file_size"
}

run_pre_migration_health_check() {
  print_header "Pre-Migration Health Check"

  if [ "$DRY_RUN" = true ]; then
    print_warning "DRY RUN: Would run health check"
    return 0
  fi

  # Check database connection
  print_info "Testing database connection..."
  if supabase db ping --project-ref "$PROD_PROJECT_REF" &> /dev/null; then
    print_success "Database connection successful"
  else
    print_error "Database connection failed!"
    exit 1
  fi

  # Check for long-running queries
  print_info "Checking for long-running queries..."
  local long_queries=$(supabase db execute --project-ref "$PROD_PROJECT_REF" <<SQL
SELECT COUNT(*)
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < NOW() - INTERVAL '5 minutes';
SQL
)

  if [ "$long_queries" -gt 0 ]; then
    print_warning "Found $long_queries long-running queries. Review before proceeding."
    confirm_action "Continue with migration despite long-running queries?"
  else
    print_success "No long-running queries detected"
  fi
}

apply_migration() {
  print_header "Applying Migration to Production"

  if [ "$DRY_RUN" = true ]; then
    print_warning "DRY RUN: Would apply migration from $SQL_DIR/add_story_completion_and_image_persistence.sql"
    return 0
  fi

  print_info "Executing migration..."
  echo "Start time: $(date)"

  if supabase db execute -f "$SQL_DIR/add_story_completion_and_image_persistence.sql" --project-ref "$PROD_PROJECT_REF"; then
    print_success "Migration applied successfully"
    echo "End time: $(date)"
  else
    print_error "Migration failed!"
    print_error "Review error messages and determine if rollback is needed"
    exit 1
  fi
}

verify_migration() {
  print_header "Verifying Migration"

  VERIFICATION_FILE="$BACKUP_DIR/verification_results_${TIMESTAMP}.txt"

  if [ "$DRY_RUN" = true ]; then
    print_warning "DRY RUN: Would run verification queries"
    return 0
  fi

  print_info "Running verification queries..."
  supabase db execute -f "$SQL_DIR/verify_migration.sql" --project-ref "$PROD_PROJECT_REF" > "$VERIFICATION_FILE"

  # Check for errors in verification
  if grep -q "ERROR" "$VERIFICATION_FILE"; then
    print_error "Verification failed! Review results:"
    cat "$VERIFICATION_FILE"
    print_error "Consider running rollback script"
    exit 1
  else
    print_success "Verification passed"
    print_info "Results saved to: $VERIFICATION_FILE"
  fi
}

print_next_steps() {
  print_header "Migration Complete - Next Steps"

  echo -e "${GREEN}✅ Production migration completed successfully!${NC}"
  echo ""
  echo "📋 Next Steps:"
  echo "  1. Monitor database metrics for 1 hour"
  echo "  2. Watch application logs for errors"
  echo "  3. Run smoke tests: npm run test:smoke"
  echo "  4. Check query performance"
  echo "  5. Update team on migration status"
  echo ""
  echo "📊 Monitoring Commands:"
  echo "  # Watch error logs"
  echo "  supabase logs --project-ref $PROD_PROJECT_REF --level error --follow"
  echo ""
  echo "  # Check database metrics"
  echo "  supabase db metrics --project-ref $PROD_PROJECT_REF"
  echo ""
  echo "🔄 Rollback (if needed):"
  echo "  supabase db execute -f $SQL_DIR/rollback_story_completion_and_image_persistence.sql --project-ref $PROD_PROJECT_REF"
  echo ""
  echo "📁 Files Created:"
  echo "  - Backup: $BACKUP_FILE"
  echo "  - Verification: $VERIFICATION_FILE"
  echo ""
  print_info "See sql/PRODUCTION_MIGRATION_GUIDE.md for detailed post-migration steps"
}

show_help() {
  cat <<EOF
Production Database Migration Script - Task 7.1

Usage: $0 [OPTIONS]

Options:
  --project-ref <ref>   Production Supabase project reference (required)
  --dry-run             Run in dry-run mode (verification only, no changes)
  --skip-backup         Skip backup creation (NOT RECOMMENDED)
  --help                Show this help message

Examples:
  # Full migration with backup
  $0 --project-ref abc123def456

  # Dry run to test the process
  $0 --project-ref abc123def456 --dry-run

Prerequisites:
  - Supabase CLI installed (npm install -g supabase)
  - Production access credentials configured
  - All pre-deployment checklist items completed
  - Review sql/PRODUCTION_MIGRATION_GUIDE.md before running

For more information, see:
  sql/PRODUCTION_MIGRATION_GUIDE.md
EOF
}

################################################################################
# Parse Command Line Arguments
################################################################################

while [[ $# -gt 0 ]]; do
  case $1 in
    --project-ref)
      PROD_PROJECT_REF="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --skip-backup)
      SKIP_BACKUP=true
      shift
      ;;
    --help)
      show_help
      exit 0
      ;;
    *)
      print_error "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

################################################################################
# Main Execution
################################################################################

# Validate required arguments
if [ -z "$PROD_PROJECT_REF" ]; then
  print_error "Production project reference is required"
  show_help
  exit 1
fi

# Print banner
print_header "Production Database Migration - Task 7.1"
echo "Project Ref: $PROD_PROJECT_REF"
echo "Timestamp: $TIMESTAMP"
if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}MODE: DRY RUN (no changes will be made)${NC}"
else
  echo -e "${RED}MODE: PRODUCTION (changes will be applied)${NC}"
fi
echo ""

# Final confirmation for production
if [ "$DRY_RUN" = false ]; then
  confirm_action "⚠️  THIS WILL MODIFY THE PRODUCTION DATABASE. Are you sure?"
fi

# Execute migration steps
check_prerequisites
create_backup
run_pre_migration_health_check
apply_migration
verify_migration
print_next_steps

print_success "Migration script completed successfully!"
exit 0
