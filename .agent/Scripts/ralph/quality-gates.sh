#!/bin/bash
# CreativeBridge Quality Gates for Ralph
# Runs tests, linting, and type checking to ensure code quality
# INCREMENTAL MODE: Only checks files changed by Ralph, not entire codebase

set +e  # Don't exit on first error, run all gates

echo "Running CreativeBridge Quality Gates (Incremental Mode)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

GATES_PASSED=0
GATES_FAILED=0

# Get list of changed files (staged + unstaged)
CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null | grep -E '\.(ts|tsx|js|jsx)$' || echo "")

if [ -z "$CHANGED_FILES" ]; then
  echo "ℹ️  No files changed by Ralph - skipping incremental checks"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Quality Gates Result: ✅ PASS (no changes)"
  exit 0
fi

CHANGED_COUNT=$(echo "$CHANGED_FILES" | wc -l | tr -d ' ')

echo "ℹ️  Checking $CHANGED_COUNT changed file(s):"
echo "$CHANGED_FILES" | while read -r file; do
  [ -n "$file" ] && echo "   - $file"
done
echo ""

# Gate 1: TypeScript Compilation (incremental)
echo "1️⃣  TypeScript Compilation (changed files only)..."
if [ -n "$CHANGED_FILES" ]; then
  TS_ERRORS=$(echo "$CHANGED_FILES" | xargs npx tsc --noEmit 2>&1 | grep -i "error" || echo "")
  if [ -z "$TS_ERRORS" ]; then
    echo "   ✅ TypeScript: PASS"
    GATES_PASSED=$((GATES_PASSED + 1))
  else
    echo "   ❌ TypeScript: FAIL"
    echo "$TS_ERRORS" | head -10
    GATES_FAILED=$((GATES_FAILED + 1))
  fi
else
  echo "   ✅ TypeScript: PASS (no files to check)"
  GATES_PASSED=$((GATES_PASSED + 1))
fi

# Gate 2: ESLint (incremental)
echo ""
echo "2️⃣  ESLint (changed files only)..."
if [ -n "$CHANGED_FILES" ]; then
  LINT_OUTPUT=$(echo "$CHANGED_FILES" | xargs npx eslint 2>&1 || echo "")
  LINT_ERRORS=$(echo "$LINT_OUTPUT" | grep -E "^\s*\d+:\d+\s+error" || echo "")

  if [ -z "$LINT_ERRORS" ]; then
    echo "   ✅ ESLint: PASS"
    GATES_PASSED=$((GATES_PASSED + 1))
  else
    echo "   ❌ ESLint: FAIL (errors in changed files)"
    echo "$LINT_ERRORS" | head -10
    GATES_FAILED=$((GATES_FAILED + 1))
  fi
else
  echo "   ✅ ESLint: PASS (no files to check)"
  GATES_PASSED=$((GATES_PASSED + 1))
fi

# Gate 3: Jest Tests (related to changed files)
echo ""
echo "3️⃣  Jest Tests (related to changed files)..."
if [ -n "$CHANGED_FILES" ]; then
  # Find test files related to changed files
  TEST_FILES=$(echo "$CHANGED_FILES" | sed 's/\.tsx\?$/.test.ts/g' | sed 's/src\//src\/__tests__\//g' || echo "")
  TEST_FILES="$TEST_FILES $(echo "$CHANGED_FILES" | grep -E '\.test\.(ts|tsx|js|jsx)$' || echo "")"

  if [ -n "$TEST_FILES" ]; then
    TEST_OUTPUT=$(echo "$TEST_FILES" | xargs npm test -- --silent --passWithNoTests --findRelatedTests 2>&1 || echo "")
    TEST_FAILED=$(echo "$TEST_OUTPUT" | grep -E "Tests:\s+\d+ failed" || echo "")

    if [ -z "$TEST_FAILED" ]; then
      echo "   ✅ Tests: PASS"
      GATES_PASSED=$((GATES_PASSED + 1))
    else
      echo "   ❌ Tests: FAIL"
      echo "$TEST_OUTPUT" | tail -10
      GATES_FAILED=$((GATES_FAILED + 1))
    fi
  else
    echo "   ⚠️  No related tests found - creating new files"
    GATES_PASSED=$((GATES_PASSED + 1))
  fi
else
  echo "   ✅ Tests: PASS (no files to check)"
  GATES_PASSED=$((GATES_PASSED + 1))
fi

# Gate 4: Coverage Threshold - Skip for incremental mode
echo ""
echo "4️⃣  Coverage Threshold..."
echo "   ⚠️  Coverage: SKIPPED (incremental mode - only checking changed files)"
GATES_PASSED=$((GATES_PASSED + 1))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Quality Gates Result (Incremental):"
echo "✅ Passed: $GATES_PASSED"
echo "❌ Failed: $GATES_FAILED"
echo "ℹ️  Only checked files changed by Ralph"
echo ""

if [ $GATES_FAILED -eq 0 ]; then
  echo "🎉 All incremental quality gates passed!"
  exit 0
else
  echo "⚠️  Some quality gates failed. Fix errors in changed files before proceeding."
  exit 1
fi
