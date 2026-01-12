# Integration Test Suite - Task 6.2

## Overview

This directory contains comprehensive integration tests for the **Story Completion & Image Persistence** feature as specified in Task 6.2 of the implementation plan.

**Created:** 2026-01-08
**Task Reference:** `.agent/Tasks/TASKS-story-completion-and-image-persistence.md` - Phase 6, Task 6.2
**Total Tests:** 37 integration tests across 5 test suites

---

## Test Suites

### 1. Story Completion Flow (`storyCompletion.integration.test.ts`)

**Purpose:** Tests the complete story writing journey from round 1 to completion at round 5.

**Coverage:**
- ✅ Complete user journey (round 1 → 5)
- ✅ Database persistence after each contribution
- ✅ MAX_ROUNDS boundary enforcement
- ✅ Partial story progress persistence
- ✅ Completion timestamp accuracy

**Tests:** 5/5 passing
**Status:** ✅ **PASSING**

```bash
npm test -- __tests__/integration/storyCompletion.integration.test.ts
```

---

### 2. Image Generation + Upload (`imageGeneration.integration.test.ts`)

**Purpose:** Tests the full image generation workflow including Replicate API and Supabase Storage backup.

**Coverage:**
- Replicate URL saved immediately (non-blocking)
- Background Supabase upload with status tracking
- Replicate URL persistence despite backup failure
- Automatic retry on transient failures
- ✅ Graceful Replicate API failure handling
- Complete happy path flow
- Status queryability during upload
- Concurrent generation isolation

**Tests:** 1/8 passing (7 require service implementation)
**Status:** ⚠️ **PARTIALLY IMPLEMENTED** - Tests ready, awaiting `imageGenerationService` and `imageStorageService` implementation

```bash
npm test -- __tests__/integration/imageGeneration.integration.test.ts
```

**Note:** These tests will pass once Phase 2 (Tasks 2.1-2.2) services are implemented.

---

### 3. Image Display with Fallback (`imageDisplay.integration.test.ts`)

**Purpose:** Tests the image display component with automatic URL fallback and status badges.

**Coverage:**
- Supabase URL prioritization
- Automatic fallback to Replicate URL
- Pending status badge display
- Failed status with retry button
- Placeholder for missing images
- Retry functionality integration
- Real-time status updates
- Stability under rapid re-renders
- Complete fallback chain
- Conditional badge visibility

**Tests:** 10 tests
**Status:** ⚠️ **AWAITING UI COMPONENT** - Tests ready, awaiting `StoryImageDisplay` component (Phase 4, Task 4.2)

```bash
npm test -- __tests__/integration/imageDisplay.integration.test.ts
```

---

### 4. Retry Upload Flow (`retryUpload.integration.test.ts`)

**Purpose:** Tests manual and automatic retry mechanisms for failed image uploads.

**Coverage:**
- Manual retry from UI success
- Automatic retry with exponential backoff
- Retry limit enforcement (max 3 attempts)
- Database updates during retry process
- Concurrent retry isolation
- File size validation on retry
- Accurate attempt counter tracking

**Tests:** 7 tests
**Status:** ⚠️ **AWAITING SERVICE** - Tests ready, awaiting `imageStorageService.retryFailedUpload()` (Phase 2, Task 2.1)

```bash
npm test -- __tests__/integration/retryUpload.integration.test.ts
```

---

### 5. Offline to Online Sync (`offlineSync.integration.test.ts`)

**Purpose:** Tests offline caching and synchronization when connectivity is restored.

**Coverage:**
- Session caching to AsyncStorage when online
- Session retrieval from cache when offline
- Local changes sync when connection restored
- Image URL persistence across transitions
- Conflict resolution (remote wins)
- Multiple session caching
- ✅ Cache cleanup for old sessions

**Tests:** 1/7 passing (6 require service updates)
**Status:** ⚠️ **AWAITING CACHE IMPLEMENTATION** - Tests ready, awaiting Phase 3 Task 3.2 offline caching

```bash
npm test -- __tests__/integration/offlineSync.integration.test.ts
```

---

## Running the Tests

### Run All Integration Tests
```bash
npm run test:integration
```

### Run Specific Test Suite
```bash
npm test -- __tests__/integration/storyCompletion.integration.test.ts
npm test -- __tests__/integration/imageGeneration.integration.test.ts
npm test -- __tests__/integration/imageDisplay.integration.test.ts
npm test -- __tests__/integration/retryUpload.integration.test.ts
npm test -- __tests__/integration/offlineSync.integration.test.ts
```

### Run with Verbose Output
```bash
npm test -- __tests__/integration/storyCompletion.integration.test.ts --verbose
```

### Watch Mode for Development
```bash
npm test -- __tests__/integration/ --watch
```

---

## Test Architecture

### Design Principles

1. **Comprehensive Coverage**: Each test suite covers complete user flows, not just isolated functions
2. **Realistic Scenarios**: Tests simulate real-world conditions including network failures, offline states, and concurrent operations
3. **Clear Documentation**: Every test includes descriptive console logs explaining what's being tested
4. **Independent Execution**: Tests don't depend on each other and can run in any order
5. **Mock Isolation**: External dependencies (Supabase, AsyncStorage, fetch) are properly mocked

### Test Structure

Each integration test follows this pattern:

```typescript
/**
 * Test N: Clear description of what's being tested
 * Explains the importance and expected behavior
 */
it('should do something specific', async () => {
  console.log('🧪 Test N: Short description');

  // Setup
  // ... mock configuration ...

  // Execute
  // ... perform integration operations ...

  // Verify
  // ... assert expected outcomes ...

  // Report
  console.log('  ✅ Test passed with details');
});
```

---

## Current Status

### ✅ Completed (6/37 tests passing)
- Story completion flow (5 tests)
- Replicate failure handling (1 test)
- Cache cleanup (1 test)

### ⚠️ Ready but Awaiting Implementation (31/37 tests)
These tests are fully written and will pass once the corresponding services are implemented:

**Phase 2 Dependencies (Image Storage Service):**
- Image generation integration (7 tests)
- Retry upload flow (7 tests)

**Phase 3 Dependencies (Offline Caching):**
- Offline sync (6 tests)

**Phase 4 Dependencies (UI Components):**
- Image display with fallback (10 tests)

---

## Next Steps

To achieve full test coverage:

1. **Complete Phase 2 (Tasks 2.1-2.2):**
   - Implement `imageStorageService.ts` with upload and retry logic
   - Integrate with `imageGenerationService.ts`
   - Expected: +14 tests passing

2. **Complete Phase 3 (Task 3.2):**
   - Implement offline caching in `storySessionManager.ts`
   - Add AsyncStorage persistence for image URLs
   - Expected: +6 tests passing

3. **Complete Phase 4 (Task 4.2):**
   - Implement `StoryImageDisplay` component
   - Add URL fallback logic and status badges
   - Expected: +10 tests passing

---

## Integration Test Coverage Report

| Phase | Feature | Tests | Status |
|-------|---------|-------|--------|
| Phase 3 | Story Completion Tracking | 5 | ✅ PASSING |
| Phase 2 | Image Generation & Upload | 8 | ⚠️ 1/8 passing |
| Phase 4 | Image Display | 10 | ⚠️ Awaiting component |
| Phase 2 | Retry Upload | 7 | ⚠️ Awaiting service |
| Phase 3 | Offline Sync | 7 | ⚠️ 1/7 passing |
| **TOTAL** | | **37** | **6/37 passing (16%)** |

**Target:** 37/37 passing (100%) by end of Phase 4

---

## Troubleshooting

### Common Issues

**Issue:** Tests timeout
**Solution:** Increase timeout in jest.config.js or specific test:
```typescript
it('should do something', async () => { ... }, 30000); // 30 second timeout
```

**Issue:** Mock not working
**Solution:** Ensure mocks are cleared in `beforeEach`:
```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

**Issue:** AsyncStorage not persisting
**Solution:** Verify mock implementation tracks state:
```typescript
const mockCache: Record<string, any> = {};
(AsyncStorage.setItem as jest.Mock).mockImplementation((key, value) => {
  mockCache[key] = value;
  return Promise.resolve();
});
```

---

## Definition of Done (Task 6.2)

Per the implementation plan, Task 6.2 is complete when:

- ✅ All 23+ integration tests written and documented
- ⚠️ Tests cover all major user flows (ready, awaiting implementation)
- ⚠️ Database state verified after each test (ready, awaiting implementation)
- ⚠️ No test data pollution with proper cleanup (implemented)

**Current Status:** Tests written and ready. Will be marked complete when dependent services are implemented and all tests pass.

---

## Additional Resources

- **Implementation Plan:** `.agent/Tasks/TASKS-story-completion-and-image-persistence.md`
- **Unit Tests:** `__tests__/storySessionManager.completion.test.ts`
- **Service Documentation:** See implementation plan Phase 2-4
- **CI/CD:** Tests automatically run on PR creation

---

**Last Updated:** 2026-01-08
**Maintained By:** Development Team
**Test Framework:** Jest + React Native Testing Library
