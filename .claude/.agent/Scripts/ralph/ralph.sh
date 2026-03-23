#!/bin/bash
# Ralph Wiggum - Long-running AI agent loop for CreativeBridge
# Adapted for Claude Code CLI with CreativeBridge quality gates
# Usage: ./ralph.sh [max_iterations]

set -e

MAX_ITERATIONS=${1:-10}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PRD_FILE="$PROJECT_ROOT/.agent/Ralph/prd.json"
PROGRESS_FILE="$PROJECT_ROOT/.agent/Ralph/progress.txt"
ARCHIVE_DIR="$PROJECT_ROOT/.agent/Ralph/archive"
LAST_BRANCH_FILE="$PROJECT_ROOT/.agent/Ralph/.last-branch"
QUALITY_GATES_SCRIPT="$SCRIPT_DIR/quality-gates.sh"

# Archive previous run if branch changed
if [ -f "$PRD_FILE" ] && [ -f "$LAST_BRANCH_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")
  
  if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
    # Archive the previous run
    DATE=$(date +%Y-%m-%d)
    # Strip "ralph/" prefix from branch name for folder
    FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||')
    ARCHIVE_FOLDER="$ARCHIVE_DIR/$DATE-$FOLDER_NAME"
    
    echo "Archiving previous run: $LAST_BRANCH"
    mkdir -p "$ARCHIVE_FOLDER"
    [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$ARCHIVE_FOLDER/"
    [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
    echo "   Archived to: $ARCHIVE_FOLDER"
    
    # Reset progress file for new run
    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    echo "---" >> "$PROGRESS_FILE"
  fi
fi

# Track current branch
if [ -f "$PRD_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  if [ -n "$CURRENT_BRANCH" ]; then
    echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"
  fi
fi

# Initialize progress file if it doesn't exist
if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Ralph Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

echo "Starting Ralph - Max iterations: $MAX_ITERATIONS"

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo "  Ralph Iteration $i of $MAX_ITERATIONS"
  echo "═══════════════════════════════════════════════════════"

  # Change to project root for Claude execution
  cd "$PROJECT_ROOT"

  # Run Claude with the ralph prompt (bypass permissions for autonomous operation)
  echo "🤖 Invoking Claude CLI with auto-approval..."
  OUTPUT=$(cat "$SCRIPT_DIR/prompt.md" | claude --permission-mode bypassPermissions 2>&1 | tee /dev/stderr) || true

  # Run CreativeBridge quality gates if script exists
  if [ -f "$QUALITY_GATES_SCRIPT" ]; then
    echo ""
    echo "🧪 Running CreativeBridge quality gates..."
    if bash "$QUALITY_GATES_SCRIPT"; then
      echo "✅ Quality gates passed!"
    else
      echo "❌ Quality gates failed. Iteration $i incomplete."
      echo "Fix errors and run Ralph again."
      exit 1
    fi
  else
    echo "⚠️  Quality gates script not found at $QUALITY_GATES_SCRIPT"
    echo "Skipping quality checks (not recommended for production)"
  fi

  # Check for completion signal
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    echo "✅ Ralph completed all tasks!"
    echo "Completed at iteration $i of $MAX_ITERATIONS"
    exit 0
  fi

  echo "✓ Iteration $i complete. Continuing..."
  sleep 2
done

echo ""
echo "Ralph reached max iterations ($MAX_ITERATIONS) without completing all tasks."
echo "Check $PROGRESS_FILE for status."
exit 1
