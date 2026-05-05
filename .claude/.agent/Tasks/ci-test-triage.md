# CI Test Triage — US-011 Categorization Report

_Generated: 2026-05-05T00:19:30.356Z_  
_Source: `/tmp/jest-results.json`_  
_Run command: `npm test -- --watchAll=false --json --outputFile=/tmp/jest-results.json --bail=0`_

## Headline counts

| Metric                | Count |
| --------------------- | ----- |
| Total test suites     | 309   |
| Suites passed         | 156   |
| Suites failed         | 152   |
| Total tests           | 3907  |
| Tests passed          | 3110  |
| Tests failed          | 778   |
| Tests pending/skipped | 19    |

## Categorization of the 778 failing tests (PRD buckets)

Per US-011 acceptance criteria, every failing assertion is bucketed into one of three causes.

| Bucket                     |   Count | % of 778 | What it means                                                                                                                                                                                 |
| -------------------------- | ------: | -------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mock divergence**        |     104 |    13.4% | TypeError on undefined access, not-a-function, not-iterable, or destructure — the runtime signature of a mock returning the wrong shape. **Cheapest to fix** (per US-013 Mocks-First policy). |
| **Real assertion failure** |     652 |    83.8% | Default bucket — covers `expect(X).toEqual(Y)` value mismatches, missing fields, etc., where there is no upstream TypeError. Resolution requires reading source code (US-015).                |
| **Flake / timeout**        |      22 |     2.8% | `Exceeded timeout` — Jest's per-test timeout fired. Mostly retry/circuit-breaker tests that intentionally exercise slow paths.                                                                |
| **Total categorized**      | **778** | **100%** |                                                                                                                                                                                               |

## Top 20 files by inner-test failure count

| Rank | File                                                              | Failed tests |
| ---: | ----------------------------------------------------------------- | -----------: |
|    1 | `src/__tests__/components/StoryPreviewEdit.test.tsx`              |           37 |
|    2 | `src/__tests__/integration/finalStoryDownloadIntegration.test.ts` |           26 |
|    3 | `src/__tests__/components/StorySelectionModal.test.tsx`           |           24 |
|    4 | `src/__tests__/components/StoryImageDisplay.test.tsx`             |           22 |
|    5 | `src/__tests__/story/errorHandling.test.ts`                       |           22 |
|    6 | `src/__tests__/integration/clerkSignUpFlow.test.tsx`              |           21 |
|    7 | `src/__tests__/security/imageStorageSecurity.test.ts`             |           21 |
|    8 | `src/__tests__/components/EnhancedStoryImageDisplay.test.tsx`     |           20 |
|    9 | `src/__tests__/integration/syncIntegration.test.ts`               |           18 |
|   10 | `src/__tests__/screens/SettingsScreen.genre.test.tsx`             |           17 |
|   11 | `src/__tests__/services/imageStorageService.test.ts`              |           17 |
|   12 | `src/__tests__/integration/databaseMigrations.test.tsx`           |           16 |
|   13 | `src/__tests__/acceptance/errorHandlingScenarios.test.ts`         |           14 |
|   14 | `src/__tests__/integration/comprehensiveValidation.test.ts`       |           14 |
|   15 | `src/__tests__/integration/databaseOperations.test.tsx`           |           14 |
|   16 | `src/__tests__/services/diversityScoreStorageService.test.ts`     |           14 |
|   17 | `src/__tests__/services/progressiveEnhancement.test.ts`           |           14 |
|   18 | `src/__tests__/services/storyContentExtraction.test.ts`           |           14 |
|   19 | `__tests__/storage/storageRLS.test.ts`                            |           13 |
|   20 | `src/__tests__/components/FullScreenImageModal.test.tsx`          |           13 |

## ⚠️ Side finding — 50 suite-load failures (out of scope for the 3 PRD buckets)

These files crash at **import time**, before any individual test runs. They contribute 0 to the 778-failures count (Jest can't mark inner tests as failed when the suite never loaded). They are the primary reason `numFailedTestSuites: 152` is far higher than the 102 files with inner failures (152 = 102 + 50 load failures).

| Cause                  | Count | What it usually means                                                                                                                                                                   |
| ---------------------- | ----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `transform-error`      |    26 | `Jest encountered an unexpected token` — usually TS/JSX transformIgnorePatterns gap                                                                                                     |
| `typeerror-at-load`    |    19 | Generic TypeError thrown during module init                                                                                                                                             |
| `missing-module`       |     4 | Module path not found (e.g. typo `@react-native-netinfo/netinfo` instead of `@react-native-community/netinfo`)                                                                          |
| `convex-mock-conflict` |     1 | Convex `_server.internalMutation` etc. is not a function — global `convex/react` mock conflicts with files that mock `convex/server` or import directly from `convex/_generated/server` |

Sample files (first 5 per cause):

**`transform-error` (26 files)**

- `__tests__/context/authContextGenreMapping.test.ts`
  - `  ● Test suite failed to run |     Jest encountered an unexpected token`
- `src/__tests__/utils/rememberMeStorage.test.ts`
  - `  ● Test suite failed to run |     Jest encountered an unexpected token`
- `src/__tests__/integration/xpRefundIntegration.test.tsx`
  - `  ● Test suite failed to run |     Jest encountered an unexpected token`
- `src/__tests__/integration/xpDeductionIntegration.test.tsx`
  - `  ● Test suite failed to run |     Jest encountered an unexpected token`
- `src/__tests__/integration/authFlow.test.tsx`
  - `  ● Test suite failed to run |     Jest encountered an unexpected token`

**`typeerror-at-load` (19 files)**

- `src/__tests__/screens/ImportOptionsScreen.test.tsx`
  - `  ● Test suite failed to run |     TypeError: Cannot read properties of undefined (reading 'getViewManagerConfig')`
- `src/__tests__/navigation/AppNavigator.test.tsx`
  - `  ● Test suite failed to run |     TypeError: Cannot read properties of undefined (reading 'getViewManagerConfig')`
- `src/__tests__/platform/voiceFeaturesPlatform.test.tsx`
  - `  ● Test suite failed to run |     TypeError: Cannot read properties of undefined (reading 'getViewManagerConfig')`
- `src/__tests__/screens/HomeScreen.test.tsx`
  - `  ● Test suite failed to run |     TypeError: Cannot read properties of undefined (reading 'getViewManagerConfig')`
- `src/__tests__/technical/voiceFeaturesTechnical.test.tsx`
  - `  ● Test suite failed to run |     TypeError: Cannot read properties of undefined (reading 'getViewManagerConfig')`

**`missing-module` (4 files)**

- `src/__tests__/story/apiIntegration.test.ts`
  - `  ● Test suite failed to run |     Cannot find module '@react-native-netinfo/netinfo' from 'src/__tests__/story/apiIntegration.test.ts'`
- `src/__tests__/integration/formValidation.test.tsx`
  - `  ● Test suite failed to run |     Cannot find module '../../context/StableAuthContext' from 'src/__tests__/integration/formValidation.test.tsx'`
- `src/__tests__/security/encryptionAndDataProtection.test.ts`
  - `  ● Test suite failed to run |     Cannot find module '../../services/ClaudeSkillsCredentialRotationService' from 'src/__tests__/security/encryptionAndDataProtection.test.ts'`
- `src/__tests__/security/comprehensiveSecurityAudit.test.ts`
  - `  ● Test suite failed to run |     Cannot find module '../../services/claudeSkillsConfig' from 'src/__tests__/security/comprehensiveSecurityAudit.test.ts'`

**`convex-mock-conflict` (1 files)**

- `__tests__/convex/userProfiles.genre.test.ts`
  - `  ● Test suite failed to run |     TypeError: (0 , _server.internalMutation) is not a function`

Recommendation: address suite-load failures separately (e.g., a follow-up ticket "Fix 50 suite-load failures") before US-013's Mocks-First sweep — fixing a load failure in one file may unmask additional inner-test failures that should then be re-categorized.

## Bucket samples (first 10 each — for US-012 spot-check)

### Flake / timeout (sample)

- **Integration Test: Retry Upload Flow should enforce file size limit on retry**
  - File: `__tests__/integration/retryUpload.integration.test.ts`
  - First failure line: `Error: thrown: "Exceeded timeout of 10000 ms for a test.`
- **Task 3.4: Story Content Extraction and Prompt Generation Tests Integration with Image Generation Service should use enhanced prompts in full image generation flow**
  - File: `src/__tests__/services/storyContentExtraction.test.ts`
  - First failure line: `Error: thrown: "Exceeded timeout of 10000 ms for a test.`
- **Task 3.4: Story Content Extraction and Prompt Generation (Simplified) End-to-End Integration should work with the image generation service**
  - File: `src/__tests__/services/contentExtractionSimple.test.ts`
  - First failure line: `Error: thrown: "Exceeded timeout of 10000 ms for a test.`
- **Security Testing - Image Storage & Persistence File Upload Validation should timeout downloads after 30 seconds**
  - File: `src/__tests__/security/imageStorageSecurity.test.ts`
  - First failure line: `Error: thrown: "Exceeded timeout of 10000 ms for a test.`
- **Performance Tests: Image Upload Speed should have high success rate for valid uploads**
  - File: `__tests__/performance/imageUpload.performance.test.ts`
  - First failure line: `Error: thrown: "Exceeded timeout of 30000 ms for a test.`
- **Regression Tests - Bug Fixes [BUG-123] Upload Timeout Handling should handle slow network with increased timeout**
  - File: `src/__tests__/bugfixes/regression.test.ts`
  - First failure line: `Error: thrown: "Exceeded timeout of 10000 ms for a test.`
- **Regression Tests - Bug Fixes [BUG-123] Upload Timeout Handling should retry with exponential backoff on timeout**
  - File: `src/__tests__/bugfixes/regression.test.ts`
  - First failure line: `Error: thrown: "Exceeded timeout of 10000 ms for a test.`
- **Regression Tests - Bug Fixes [BUG-123] Upload Timeout Handling should fail gracefully after max retry attempts**
  - File: `src/__tests__/bugfixes/regression.test.ts`
  - First failure line: `Error: thrown: "Exceeded timeout of 10000 ms for a test.`
- **Regression Tests - Bug Fixes [BUG-567] Performance Optimizations should handle concurrent uploads efficiently**
  - File: `src/__tests__/bugfixes/regression.test.ts`
  - First failure line: `Error: thrown: "Exceeded timeout of 10000 ms for a test.`
- **Task 3.2: Replicate.com API Integration Tests API Integration with Timeout Handling should generate image with proper request flow in development**
  - File: `src/__tests__/services/replicateAPI.test.ts`
  - First failure line: `Error: thrown: "Exceeded timeout of 10000 ms for a test.`

### Mock divergence (sample)

- **Final Story Download Integration Tests Complete Feature End-to-End Tests should handle complete download flow for short story**
  - File: `src/__tests__/integration/finalStoryDownloadIntegration.test.ts`
  - First failure line: `TypeError: _enhancedErrorHandling.enhancedErrorHandling.initialize is not a function`
- **Final Story Download Integration Tests Complete Feature End-to-End Tests should handle complete download flow for medium story with compression**
  - File: `src/__tests__/integration/finalStoryDownloadIntegration.test.ts`
  - First failure line: `TypeError: _enhancedErrorHandling.enhancedErrorHandling.initialize is not a function`
- **Final Story Download Integration Tests Complete Feature End-to-End Tests should handle complete download flow for large story with all optimizations**
  - File: `src/__tests__/integration/finalStoryDownloadIntegration.test.ts`
  - First failure line: `TypeError: _enhancedErrorHandling.enhancedErrorHandling.initialize is not a function`
- **Final Story Download Integration Tests Error Scenario Integration Tests should handle permission denied error with recovery**
  - File: `src/__tests__/integration/finalStoryDownloadIntegration.test.ts`
  - First failure line: `TypeError: _enhancedErrorHandling.enhancedErrorHandling.initialize is not a function`
- **Final Story Download Integration Tests Error Scenario Integration Tests should handle storage full error**
  - File: `src/__tests__/integration/finalStoryDownloadIntegration.test.ts`
  - First failure line: `TypeError: _enhancedErrorHandling.enhancedErrorHandling.initialize is not a function`
- **Final Story Download Integration Tests Error Scenario Integration Tests should handle network errors with offline queueing**
  - File: `src/__tests__/integration/finalStoryDownloadIntegration.test.ts`
  - First failure line: `TypeError: _enhancedErrorHandling.enhancedErrorHandling.initialize is not a function`
- **Final Story Download Integration Tests Error Scenario Integration Tests should handle file system errors with graceful degradation**
  - File: `src/__tests__/integration/finalStoryDownloadIntegration.test.ts`
  - First failure line: `TypeError: _enhancedErrorHandling.enhancedErrorHandling.initialize is not a function`
- **Final Story Download Integration Tests Performance Integration Tests should maintain performance benchmarks under normal load**
  - File: `src/__tests__/integration/finalStoryDownloadIntegration.test.ts`
  - First failure line: `TypeError: _enhancedErrorHandling.enhancedErrorHandling.initialize is not a function`
- **Final Story Download Integration Tests Performance Integration Tests should maintain memory efficiency during large operations**
  - File: `src/__tests__/integration/finalStoryDownloadIntegration.test.ts`
  - First failure line: `TypeError: _enhancedErrorHandling.enhancedErrorHandling.initialize is not a function`
- **Final Story Download Integration Tests Performance Integration Tests should provide accurate performance analytics**
  - File: `src/__tests__/integration/finalStoryDownloadIntegration.test.ts`
  - First failure line: `TypeError: _enhancedErrorHandling.enhancedErrorHandling.initialize is not a function`

### Real assertion failure (sample)

- **ImageGeneration Component - Tasks 5.2-5.5 Task 5.3: Implement XP balance display should display current XP balance with sufficient funds**
  - File: `src/__tests__/components/ImageGeneration.test.tsx`
  - First failure line: `Error: Unable to find an element with text: (Cost: 1,000 XP)`
- **ImageGeneration Component - Tasks 5.2-5.5 Task 5.5: Implement loading state UI for image generation should show loading state during image generation**
  - File: `src/__tests__/components/ImageGeneration.test.tsx`
  - First failure line: `Error: Unable to find an element with text: Creating Your Illustration`
- **ImageGeneration Component - Tasks 5.2-5.5 Task 5.5: Implement loading state UI for image generation should show progress updates during generation**
  - File: `src/__tests__/components/ImageGeneration.test.tsx`
  - First failure line: `Error: Unable to find an element with text: 100%`
- **ImageGeneration Component - Tasks 5.2-5.5 Error handling and recovery should show error state and retry button on failure**
  - File: `src/__tests__/components/ImageGeneration.test.tsx`
  - First failure line: `Error: Unable to find an element with text: ⚠️`
- **ImageGeneration Error Handling UI - Tasks 7.1-7.4 Task 7.1: Enhanced Error Message Display Components should display enhanced error UI for content safety issues**
  - File: `src/__tests__/components/ImageGenerationErrorHandling.test.tsx`
  - First failure line: `Error: Unable to find an element with text: Content Safety Check`
- **ImageGeneration Error Handling UI - Tasks 7.1-7.4 Task 7.2: Specific Error Message Testing should show correct error messages for each error type**
  - File: `src/__tests__/components/ImageGenerationErrorHandling.test.tsx`
  - First failure line: `Error: Unable to find an element with text: Content Safety Check`
- **ImageGeneration Error Handling UI - Tasks 7.1-7.4 Task 7.3: Retry Mechanism UI should not display retry button for non-retryable errors**
  - File: `src/__tests__/components/ImageGenerationErrorHandling.test.tsx`
  - First failure line: `Error: Unable to find an element with text: Content Safety Check`
- **ImageGeneration Error Handling UI - Tasks 7.1-7.4 Task 7.4: Error State Recovery Flows should properly handle different error types in sequence**
  - File: `src/__tests__/components/ImageGenerationErrorHandling.test.tsx`
  - First failure line: `Error: Unable to find an element with text: Content Safety Check`
- **Integration Test: Image Display with Fallback should prioritize Supabase URL over Replicate URL**
  - File: `__tests__/integration/imageDisplay.integration.test.tsx`
  - First failure line: `Error: Unable to find an element with testID: story-image`
- **Integration Test: Image Display with Fallback should fall back to Replicate URL if Supabase URL fails to load**
  - File: `__tests__/integration/imageDisplay.integration.test.tsx`
  - First failure line: `Error: Unable to find an element with testID: story-image`

## Method

Each failed assertion was bucketed using the **first line** of its `failureMessages[0]`:

1. **Flake / timeout** — first line matches `Exceeded timeout of Nms` (Jest's explicit timeout signal).
2. **Mock divergence** — first line matches one of:
   - `TypeError: Cannot read properties of undefined|null`
   - `TypeError: ... is not a function`
   - `TypeError: ... is not iterable`
   - `TypeError: Cannot destructure property`
   - These are the runtime signatures of a mock returning the wrong shape (the source code accesses a field that the mock didn't provide).
3. **Real assertion failure** — everything else, including `.toEqual` / `.toBe` value mismatches without an upstream TypeError. Some of these may _also_ be mock-divergence in disguise (a `toEqual` mismatch where the test's expected value is a stale mock shape), but absent further context the conservative bucket is "real."

Per the PRD's US-012 grading criterion (10-sample spot check, ≤2 miscategorized = pass), the heuristic is intentionally simple. The next stories use the buckets as a roadmap, not a contract.

**Note on suite-load failures**: The 50 files in the side-finding section are **not** counted in the 778-failure buckets. They're a fourth class of problem (whole-suite import crashes) that the PRD's 3 buckets don't cover. Surfaced separately to avoid undercounting suite-level damage.
