# Performance Test Suite

Comprehensive performance tests for the Story Completion & Image Persistence feature.

## Overview

This test suite validates that the system meets the Non-Functional Requirements (NFRs) defined in the PRD:

- **Image Upload Speed**: 5MB images upload in < 10 seconds
- **Database Query Performance**: Completion tracking adds < 50ms overhead
- **UI Performance**: State updates complete in < 16ms for 60 FPS
- **Concurrent Load**: System handles 100 concurrent uploads with 95%+ success rate

## Test Files

### 1. `imageUpload.performance.test.ts`

Tests image upload performance to Supabase Storage.

**Tests:**
- ✓ Upload 5MB image in < 10 seconds
- ✓ Upload typical 2MB image in < 5 seconds
- ✓ Retry logic overhead is minimal
- ✓ Replicate download is fast
- ✓ High success rate for valid uploads

**Run:**
```bash
npm run test:performance -- imageUpload.performance.test.ts
```

### 2. `databaseQuery.performance.test.ts`

Tests database operation performance for completion tracking.

**Tests:**
- ✓ Completion tracking adds < 50ms overhead
- ✓ Session retrieval in < 100ms
- ✓ Session update in < 100ms
- ✓ Efficient indexed queries for completed sessions
- ✓ Fast image upload status queries
- ✓ 5-round story completion is efficient
- ✓ Concurrent session updates are fast

**Run:**
```bash
npm run test:performance -- databaseQuery.performance.test.ts
```

### 3. `uiStateUpdate.performance.test.tsx`

Tests UI component rendering performance.

**Tests:**
- ✓ Round progress updates in < 16ms (60 FPS)
- ✓ Completion state transition is smooth
- ✓ StoryImageDisplay renders quickly
- ✓ Upload status badge updates efficiently
- ✓ Handles rapid state updates
- ✓ No unnecessary re-renders
- ✓ Efficient with large story content

**Run:**
```bash
npm run test:performance -- uiStateUpdate.performance.test.tsx
```

### 4. `concurrentUploads.performance.test.ts`

Tests system behavior under high concurrent load.

**Tests:**
- ✓ 100 concurrent uploads with 95%+ success rate
- ✓ Concurrent vs sequential performance comparison
- ✓ Handles retry spikes without resource exhaustion
- ✓ Mixed success/failure scenarios handled efficiently
- ✓ Graceful rate limiting behavior

**Run:**
```bash
npm run test:performance -- concurrentUploads.performance.test.ts
```

## Running Tests

### Run All Performance Tests

```bash
npm run test:performance
```

### Run with Verbose Output

```bash
npm run test:performance -- --verbose
```

### Run Specific Test File

```bash
npm run test:performance -- imageUpload.performance.test.ts
```

### Run with HTML Report

```bash
./scripts/run-performance-tests.sh --report
```

The report will be generated at: `test-results/performance/report.html`

## Configuration

Performance tests use a separate Jest configuration: `jest.performance.config.js`

**Key settings:**
- **Test timeout**: 120 seconds (2 minutes)
- **Max workers**: 1 (sequential execution to avoid resource contention)
- **Verbose output**: Enabled by default

## Performance Benchmarks

### Expected Results

| Metric | Target | Typical Result |
|--------|--------|---------------|
| 5MB Image Upload | < 10s | ~8s |
| 2MB Image Upload | < 5s | ~3s |
| DB Query Overhead | < 50ms | ~30ms |
| UI State Update | < 16ms | ~5ms |
| 100 Concurrent Uploads | 95%+ success | ~97% |
| Session Retrieval | < 100ms | ~50ms |
| Indexed Query | < 150ms | ~80ms |

### Performance Grading

- **🟢 Excellent**: Meets NFR with 50%+ margin
- **🟡 Good**: Meets NFR within 10% margin
- **🔴 Needs Improvement**: Does not meet NFR

## Troubleshooting

### Tests Timing Out

If tests timeout, check:
1. Network connectivity to Supabase
2. Database query performance (check indexes)
3. Supabase Storage configuration

### Inconsistent Results

Performance tests can be affected by:
- Network conditions
- Database load
- System resources (CPU, memory)
- Other running processes

**Tip**: Run tests multiple times and average results for reliable benchmarks.

### Failing Concurrent Upload Tests

If concurrent upload tests fail:
1. Check Supabase rate limits
2. Verify connection pool settings
3. Review Supabase Storage quotas
4. Check for database connection leaks

## Best Practices

1. **Run tests in isolation**: Don't run performance tests alongside other resource-intensive tasks
2. **Baseline measurements**: Establish baseline performance before making changes
3. **Regular monitoring**: Run performance tests before each release
4. **Document changes**: If performance degrades, investigate and document the cause
5. **Optimize incrementally**: Focus on the biggest bottlenecks first

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Performance Tests

on:
  pull_request:
    branches: [main]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:performance
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: performance-results
          path: test-results/performance/
```

## Monitoring in Production

After deployment, monitor these metrics:

1. **Image Upload Times**: P50, P95, P99 percentiles
2. **Database Query Times**: Track slow queries
3. **Error Rates**: Upload failures, timeouts
4. **User Experience**: Time to image generation

Use Supabase Dashboard and application logs to track these metrics.

## References

- [Task 6.4: Performance Testing](../../.agent/Tasks/TASKS-story-completion-and-image-persistence.md)
- [PRD: Story Completion & Image Persistence](../../.agent/Tasks/story-completion-and-image-persistence-PRD.md)
- [Jest Configuration](../../jest.performance.config.js)

---

**Last Updated**: 2026-01-08
**Version**: 1.0.0
