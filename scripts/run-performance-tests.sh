#!/bin/bash

###############################################################################
# Performance Test Runner Script
#
# Runs comprehensive performance tests and generates a detailed report
#
# Usage:
#   ./scripts/run-performance-tests.sh [options]
#
# Options:
#   --verbose    Show detailed output
#   --report     Generate HTML report
#   --skip-setup Skip environment setup
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Options
VERBOSE=false
GENERATE_REPORT=false
SKIP_SETUP=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --verbose)
      VERBOSE=true
      shift
      ;;
    --report)
      GENERATE_REPORT=true
      shift
      ;;
    --skip-setup)
      SKIP_SETUP=true
      shift
      ;;
    *)
      echo "Unknown option: $arg"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                        ║${NC}"
echo -e "${BLUE}║       Performance Test Suite - CreativeBridge         ║${NC}"
echo -e "${BLUE}║                                                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Environment setup
if [ "$SKIP_SETUP" = false ]; then
  echo -e "${YELLOW}⚙️  Setting up test environment...${NC}"

  # Check if dependencies are installed
  if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
  fi

  # Check if jest is installed
  if ! npm list jest &> /dev/null; then
    echo -e "${YELLOW}📦 Installing test dependencies...${NC}"
    npm install --save-dev jest @types/jest
  fi

  echo -e "${GREEN}✓ Environment ready${NC}"
  echo ""
fi

# Create test results directory
mkdir -p test-results/performance

# Run performance tests
echo -e "${YELLOW}🚀 Running performance tests...${NC}"
echo ""

START_TIME=$(date +%s)

# Run tests with appropriate verbosity
if [ "$VERBOSE" = true ]; then
  npm run test:performance -- --verbose --detectOpenHandles
else
  npm run test:performance
fi

TEST_EXIT_CODE=$?

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

# Check test results
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✅ All performance tests passed!${NC}"
  echo ""
  echo -e "${GREEN}Test Duration: ${DURATION}s${NC}"

  # Generate report if requested
  if [ "$GENERATE_REPORT" = true ]; then
    echo ""
    echo -e "${YELLOW}📊 Generating performance report...${NC}"

    # Create a simple HTML report
    cat > test-results/performance/report.html << EOF
<!DOCTYPE html>
<html>
<head>
  <title>Performance Test Report - CreativeBridge</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 1200px;
      margin: 40px auto;
      padding: 0 20px;
      background: #f5f5f5;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 10px;
      margin-bottom: 30px;
    }
    .summary {
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    .metric {
      display: inline-block;
      margin: 10px 20px;
    }
    .metric-value {
      font-size: 32px;
      font-weight: bold;
      color: #667eea;
    }
    .metric-label {
      color: #666;
      font-size: 14px;
    }
    .pass {
      color: #10b981;
    }
    .fail {
      color: #ef4444;
    }
    table {
      width: 100%;
      background: white;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    th {
      background: #667eea;
      color: white;
      padding: 15px;
      text-align: left;
    }
    td {
      padding: 12px 15px;
      border-bottom: 1px solid #e5e7eb;
    }
    tr:hover {
      background: #f9fafb;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Performance Test Report</h1>
    <p>CreativeBridge - Story Completion & Image Persistence</p>
    <p>Generated: $(date)</p>
  </div>

  <div class="summary">
    <h2>Test Summary</h2>
    <div class="metric">
      <div class="metric-value pass">✓ PASS</div>
      <div class="metric-label">Status</div>
    </div>
    <div class="metric">
      <div class="metric-value">${DURATION}s</div>
      <div class="metric-label">Duration</div>
    </div>
  </div>

  <h2>Performance Benchmarks</h2>
  <table>
    <thead>
      <tr>
        <th>Test Category</th>
        <th>Requirement</th>
        <th>Result</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Image Upload (5MB)</td>
        <td>&lt; 10 seconds</td>
        <td>See test output</td>
        <td class="pass">✓ Pass</td>
      </tr>
      <tr>
        <td>DB Query Overhead</td>
        <td>&lt; 50ms</td>
        <td>See test output</td>
        <td class="pass">✓ Pass</td>
      </tr>
      <tr>
        <td>UI State Update</td>
        <td>&lt; 16ms (60 FPS)</td>
        <td>See test output</td>
        <td class="pass">✓ Pass</td>
      </tr>
      <tr>
        <td>Concurrent Uploads (100)</td>
        <td>95%+ success rate</td>
        <td>See test output</td>
        <td class="pass">✓ Pass</td>
      </tr>
    </tbody>
  </table>

  <p style="margin-top: 30px; color: #666; font-size: 14px;">
    For detailed timing information, see the test console output.
  </p>
</body>
</html>
EOF

    echo -e "${GREEN}✓ Report generated: test-results/performance/report.html${NC}"
  fi

else
  echo -e "${RED}❌ Some performance tests failed${NC}"
  echo ""
  echo -e "${RED}Test Duration: ${DURATION}s${NC}"
  echo ""
  echo -e "${YELLOW}💡 Tips for debugging:${NC}"
  echo "   - Run with --verbose for detailed output"
  echo "   - Check individual test files in __tests__/performance/"
  echo "   - Review NFR requirements in task documentation"
  exit 1
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""
