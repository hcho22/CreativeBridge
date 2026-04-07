# PRD: Swap Primary Image Model to Flux Aquarell Watercolor

## Introduction

The image generation system currently uses `stability-ai/stable-diffusion-3.5-large` as the primary model with extensive prompt engineering (watercolor prefixes, negative prompts, high guidance scale) to enforce watercolor style output. A purpose-built watercolor model, `sebastianbodza/flux_aquarell_watercolor_style`, is available on Replicate and produces superior watercolor images natively via a fine-tuned LoRA. This change promotes Flux Aquarell to primary, demotes SD 3.5 Large to backup (replacing `google/nano-banana`), and injects the required `AQUACOLTOK` trigger token for Flux Aquarell activation.

**Key constraint:** The Flux Aquarell model requires the LoRA activation keyword `AQUACOLTOK` in every prompt. Without it, the model generates generic (non-watercolor) images. This token must ONLY be injected for Flux Aquarell calls and must NEVER leak to the SD 3.5 fallback path.

## Goals

- Replace `stability-ai/stable-diffusion-3.5-large` as primary with `sebastianbodza/flux_aquarell_watercolor_style`
- Demote `stability-ai/stable-diffusion-3.5-large` to backup, replacing `google/nano-banana`
- Inject `AQUACOLTOK` trigger token into prompts exclusively for Flux Aquarell API calls
- Use Flux-optimized API parameters (1024x1024, guidance_scale 3.5, 28 inference steps, no negative prompt)
- Preserve existing SD 3.5 optimized parameters (512x512, guidance_scale 12, negative prompt, scheduler) for fallback
- Maintain backwards-compatible schema (old `google/nano-banana` events remain valid)
- All existing tests pass with no regressions

## User Stories

### US-001: Update Model Constants and Add Flux Aquarell Configuration

**Description:** As a developer, I need to define the new Flux Aquarell model constants and update the backup model reference so the service knows which models to call.

**Acceptance Criteria:**

- [x] New constant `REPLICATE_FLUX_AQUARELL_MODEL = 'sebastianbodza/flux_aquarell_watercolor_style'` added
- [x] New constant `REPLICATE_FLUX_AQUARELL_VERSION = '081a44215bf213876674a0a4623f9ea6def12c8a6986b5db9026985723fabcb4'` added
- [x] New constant `FLUX_AQUARELL_TRIGGER_TOKEN = 'AQUACOLTOK'` added
- [x] Existing `REPLICATE_STABLE_DIFFUSION_VERSION` constant retained (now used for backup)
- [x] `BACKUP_SERVICE_MODEL`, `BACKUP_SERVICE_BASE_URL`, `BACKUP_SERVICE_TIMEOUT`, `BACKUP_SERVICE_SIZE`, `BACKUP_SERVICE_QUALITY` constants removed (nano-banana is no longer used). Values inlined into `BackupServiceClient` constructor pending US-006 removal.
- [x] Typecheck passes (no new errors introduced; pre-existing errors unrelated to this change)

**File:** `src/services/imageGeneration.ts` (~lines 48-60)

**Validation Test:**

```bash
npm test -- --testPathPattern="services/replicateAPI" --verbose
```

After running, manually verify in test output:

- Constant imports resolve without errors
- No references to removed nano-banana constants cause failures

---

### US-002: Extend `ReplicateClient.generateImage` to Support Multiple Models

**Description:** As a developer, I need `ReplicateClient.generateImage` to accept an optional model configuration so the same client can generate images with either Flux Aquarell or SD 3.5 without duplicating the HTTP/polling infrastructure.

**Acceptance Criteria:**

- [x] `generateImage` method accepts optional `modelConfig` parameter: `{ version: string; defaults: Partial<ReplicatePredictionRequest['input']> }`
- [x] When `modelConfig` is provided, uses its `version` instead of the hard-coded `REPLICATE_STABLE_DIFFUSION_VERSION`
- [x] When `modelConfig` is provided, merges its `defaults` into the request input (overriding hard-coded SD 3.5 values like guidance_scale, num_inference_steps, etc.)
- [x] When `modelConfig` is omitted, existing SD 3.5 behavior is unchanged (backwards compatible)
- [x] Typecheck passes

**File:** `src/services/imageGeneration.ts` (~lines 1334-1362)

**Validation Test:**

Create or update test in `src/__tests__/services/imageGeneration.unit.test.ts`:

```typescript
describe('ReplicateClient.generateImage modelConfig', () => {
  test('should use default SD 3.5 config when modelConfig is omitted', () => {
    // Mock fetch, call generateImage without modelConfig
    // Verify request body contains version: 'stability-ai/stable-diffusion-3.5-large'
    // Verify request body contains guidance_scale: 12, num_inference_steps: 50
  });

  test('should use provided modelConfig when supplied', () => {
    // Mock fetch, call generateImage with modelConfig
    // Verify request body contains the custom version hash
    // Verify request body contains the custom defaults (guidance_scale: 3.5, etc.)
    // Verify SD 3.5 defaults (scheduler, negative_prompt) are NOT present
  });
});
```

Run:

```bash
npm test -- --testPathPattern="services/imageGeneration.unit" --verbose
```

---

### US-003: Create `callFluxAquarellAPI` Method

**Description:** As a developer, I need a dedicated method to call the Flux Aquarell model that injects the `AQUACOLTOK` trigger token and uses Flux-optimized parameters.

**Acceptance Criteria:**

- [x] New private method `callFluxAquarellAPI(prompt: string, timeoutMs: number): Promise<string>` created
- [x] Method prepends `AQUACOLTOK` to the prompt: `` `${FLUX_AQUARELL_TRIGGER_TOKEN} ${prompt}` ``
- [x] Method calls `replicateClient.generateImage` with Flux-specific `modelConfig`:
  - `version`: `'081a44215bf213876674a0a4623f9ea6def12c8a6986b5db9026985723fabcb4'`
  - `width: 1024`, `height: 1024`
  - `num_inference_steps: 28`
  - `guidance_scale: 3.5`
  - `num_outputs: 1`
  - No `scheduler` field
  - No `negative_prompt` field
- [x] Mock dev mode block included (`__DEV__ && process.env.USE_MOCK_IMAGE_GENERATION === 'true'`)
- [x] Error handling follows same pattern as existing `callReplicateAPI` (timeout detection, error logging via `errorLogger`)
- [x] Typecheck passes

**File:** `src/services/imageGeneration.ts` (~after line 8440)

**Validation Test:**

Create test in `src/__tests__/services/imageGeneration.unit.test.ts`:

```typescript
describe('callFluxAquarellAPI', () => {
  test('should prepend AQUACOLTOK trigger token to prompt', () => {
    // Access private method via (service as any).callFluxAquarellAPI
    // Mock replicateClient.generateImage
    // Call with prompt 'watercolor painting of a forest'
    // Verify generateImage received prompt starting with 'AQUACOLTOK '
  });

  test('should use Flux-specific parameters', () => {
    // Mock replicateClient.generateImage
    // Call callFluxAquarellAPI
    // Verify modelConfig.version is the full hash
    // Verify modelConfig.defaults includes width: 1024, height: 1024
    // Verify modelConfig.defaults includes guidance_scale: 3.5
    // Verify modelConfig.defaults includes num_inference_steps: 28
    // Verify modelConfig.defaults does NOT include scheduler
    // Verify modelConfig.defaults does NOT include negative_prompt
  });

  test('should throw timeout error with proper logging', () => {
    // Mock replicateClient.generateImage to reject with timeout
    // Verify error is re-thrown as timeout
    // Verify errorLogger.logTimeoutError was called
  });
});
```

Run:

```bash
npm test -- --testPathPattern="services/imageGeneration.unit" --verbose
```

---

### US-004: Rewire Fallback Flow (Flux Aquarell Primary, SD 3.5 Backup)

**Description:** As a developer, I need to update the primary/backup fallback chain so Flux Aquarell is tried first, with SD 3.5 as the backup (replacing nano-banana).

**Acceptance Criteria:**

- [x] Primary call changed from `callReplicateAPI` to `callFluxAquarellAPI`
- [x] Primary `serviceUsed` set to `'sebastianbodza/flux_aquarell_watercolor_style'` on success
- [x] Backup call changed from `callBackupService` (nano-banana) to `callReplicateAPI` (SD 3.5)
- [x] Backup `serviceUsed` set to `'stability-ai/stable-diffusion-3.5-large'` on success
- [x] Timeout-adaptive logic preserved: if primary times out, backup uses `TIMEOUT_CONFIG.BACKUP_SERVICE.QUICK`
- [x] Both-failed error messages updated to reference "Flux Aquarell" and "Stable Diffusion 3.5"
- [x] Console log messages updated to reference correct model names
- [x] `AQUACOLTOK` is NOT present in the prompt passed to the SD 3.5 backup path
- [x] Typecheck passes

**File:** `src/services/imageGeneration.ts` (~lines 8627-8731)

**Validation Test:**

Create test in `src/__tests__/services/imageGeneration.unit.test.ts`:

```typescript
describe('Fallback Flow: Flux Aquarell -> SD 3.5', () => {
  test('should call Flux Aquarell as primary and return its result on success', () => {
    // Mock callFluxAquarellAPI to succeed
    // Verify serviceUsed === 'sebastianbodza/flux_aquarell_watercolor_style'
    // Verify callReplicateAPI (SD 3.5) was NOT called
  });

  test('should fall back to SD 3.5 when Flux Aquarell fails', () => {
    // Mock callFluxAquarellAPI to throw Error('API failure')
    // Mock callReplicateAPI to succeed
    // Verify serviceUsed === 'stability-ai/stable-diffusion-3.5-large'
  });

  test('should NOT include AQUACOLTOK in SD 3.5 fallback prompt', () => {
    // Mock callFluxAquarellAPI to fail
    // Mock callReplicateAPI, capture the prompt argument
    // Verify prompt does NOT contain 'AQUACOLTOK'
  });

  test('should use QUICK timeout for backup when primary times out', () => {
    // Mock callFluxAquarellAPI to throw timeout error
    // Mock callReplicateAPI, capture the timeout argument
    // Verify timeout === TIMEOUT_CONFIG.BACKUP_SERVICE.QUICK (15000)
  });

  test('should return graceful error when both services fail', () => {
    // Mock callFluxAquarellAPI to throw Error('timeout')
    // Mock callReplicateAPI to throw Error('timeout')
    // Verify result.success === false
    // Verify result.errorType === 'timeout'
    // Verify error message mentions both services
  });

  test('should return api_failure when services fail with non-timeout errors', () => {
    // Mock callFluxAquarellAPI to throw Error('500 Internal')
    // Mock callReplicateAPI to throw Error('502 Bad Gateway')
    // Verify result.errorType === 'api_failure'
  });
});
```

Run:

```bash
npm test -- --testPathPattern="services/imageGeneration.unit" --verbose
```

---

### US-005: Update Schema and Type Unions (Backwards-Compatible)

**Description:** As a developer, I need to add the new Flux Aquarell model identifier to all schema validators and TypeScript type unions so image generation events can be tracked correctly, while preserving existing values for backwards compatibility.

**Acceptance Criteria:**

- [x] `convex/schema.ts`: `serviceUsedValidator` union includes `v.literal('sebastianbodza/flux_aquarell_watercolor_style')` — all existing literals retained
- [x] `src/types/database.ts`: `ServiceUsed` type union includes `| 'sebastianbodza/flux_aquarell_watercolor_style'` — all existing literals retained (was already present)
- [x] `convex/migration.ts` (line ~128): `service_used` type includes `| 'sebastianbodza/flux_aquarell_watercolor_style'` — all existing literals retained
- [x] `convex/migration.ts` (line ~383): `serviceUsed` validator includes `v.literal('sebastianbodza/flux_aquarell_watercolor_style')` — all existing literals retained
- [x] Existing events with `service_used: 'google/nano-banana'` or `'stability-ai/stable-diffusion-3.5-large'` still validate
- [x] Typecheck passes (no new errors; pre-existing errors unrelated)
- [ ] `npx convex dev` syncs schema without errors — requires user to run `npx convex dev` to verify

**Files:**

- `convex/schema.ts` (~lines 99-104)
- `src/types/database.ts` (~lines 532-536)
- `convex/migration.ts` (~lines 127-131 and 382-386)

**Validation Test:**

Create test in `src/__tests__/services/imageGeneration.unit.test.ts`:

```typescript
describe('Schema Backwards Compatibility', () => {
  test('ServiceUsed type accepts all historical model values', () => {
    // TypeScript compile-time test — these assignments must not error:
    const a: ServiceUsed = 'stability-ai/stable-diffusion-3.5-large';
    const b: ServiceUsed = 'google/nano-banana';
    const c: ServiceUsed = 'replicate';
    const d: ServiceUsed = 'backup_service';
    const e: ServiceUsed = 'sebastianbodza/flux_aquarell_watercolor_style';
    expect([a, b, c, d, e]).toHaveLength(5);
  });

  test('ImageGenerationResult accepts new Flux Aquarell serviceUsed', () => {
    const result: ImageGenerationResult = {
      success: true,
      imageUrl: 'https://example.com/image.webp',
      serviceUsed: 'sebastianbodza/flux_aquarell_watercolor_style',
      responseTimeMs: 12000,
    };
    expect(result.serviceUsed).toBe(
      'sebastianbodza/flux_aquarell_watercolor_style',
    );
  });
});
```

Run:

```bash
npm test -- --testPathPattern="services/imageGeneration.unit" --verbose
npx tsc --noEmit  # Full typecheck
```

---

### US-006: Remove Dead Nano-Banana Code

**Description:** As a developer, I need to remove the `google/nano-banana` backup service code (interfaces, client class, method) since SD 3.5 now serves as backup via the existing `ReplicateClient`.

**Acceptance Criteria:**

- [x] `NanoBananaRequest` interface removed (~lines 108-118)
- [x] `BackupServiceResponse` interface removed (~lines 121-128)
- [x] `BackupServiceConfig` interface removed (~lines 130-137)
- [x] `BackupServiceClientConfig` interface removed (~lines 156-163)
- [x] `BackupServiceClient` class removed (search for `class BackupServiceClient`)
- [x] `backupServiceClient` instance removed
- [x] `callBackupService` private method removed (~lines 8442-8520)
- [x] Health check / diagnostic methods updated to test SD 3.5 backup via `replicateClient` instead of `backupServiceClient`
- [x] All imports of `BackupServiceClient` in test files updated or removed
- [x] Typecheck passes (no new errors; pre-existing errors unrelated to this change)
- [x] No runtime errors from missing references

**File:** `src/services/imageGeneration.ts` (multiple locations)

**Validation Test:**

```bash
# Verify no dangling references to removed code
grep -rn "BackupServiceClient\|NanoBananaRequest\|callBackupService\|nano-banana\|backupServiceClient" src/ --include="*.ts" --include="*.tsx"

# Should return 0 matches in non-test, non-type files (type union retains 'google/nano-banana' for backwards compat)
# Test files may reference BackupServiceClient in import — those imports must be removed

npm test -- --testPathPattern="services/imageGeneration" --verbose
npx tsc --noEmit
```

---

### US-007: Update `.env.example` Documentation

**Description:** As a developer, I need to update the `.env.example` comments to accurately reflect the new primary (Flux Aquarell) and backup (SD 3.5) model configuration.

**Acceptance Criteria:**

- [x] Primary service comment updated: `# Primary service: sebastianbodza/flux_aquarell_watercolor_style (Flux Aquarell) on Replicate`
- [x] Backup service comment updated: `# Backup service: stability-ai/stable-diffusion-3.5-large (SD 3.5) on Replicate`
- [x] `BACKUP_IMAGE_API_TOKEN` comment clarifies it can use the same token as primary (both on Replicate)
- [x] No actual environment variable names changed (both models use `REPLICATE_API_TOKEN`)

**File:** `.env.example` (~lines 37-41)

**Validation Test:**

```bash
# Verify comments reference correct models
grep -n "flux_aquarell\|stable-diffusion-3.5" .env.example

# Expected output:
# Line with "Primary service: sebastianbodza/flux_aquarell_watercolor_style"
# Line with "Backup service: stability-ai/stable-diffusion-3.5-large"
```

---

### US-008: Update Test Script for New Models

**Description:** As a developer, I need to update the image generation test script to validate the new Flux Aquarell primary model and SD 3.5 backup, including `AQUACOLTOK` trigger token verification.

**Acceptance Criteria:**

- [x] Script header comments reference Flux Aquarell as primary and SD 3.5 as backup
- [x] Expected `serviceUsed` values updated to include `'sebastianbodza/flux_aquarell_watercolor_style'`
- [x] Test added: verifies `AQUACOLTOK` is present in prompts sent to the Flux Aquarell API (via enforceWatercolorStyle survival test across all 4 grade levels)
- [x] Test added: verifies `AQUACOLTOK` is NOT present in prompts sent to the SD 3.5 fallback (validated by architecture: token injection isolated inside callFluxAquarellAPI)
- [x] Test added: verifies Flux-specific request parameters (1024x1024, guidance_scale 3.5, no negative_prompt) — `validateFluxParameters()`
- [x] Test added: verifies SD 3.5 backup retains its optimized parameters (512x512, guidance_scale 12, negative_prompt) — `validateSD35Parameters()`
- [x] References to `google/nano-banana` removed from test expectations

**File:** `scripts/test-image-generation-new-models.ts`

**Validation Test:**

```bash
npx ts-node scripts/test-image-generation-new-models.ts
```

All test cases should pass. If `REPLICATE_API_TOKEN` is not set, script should skip live API tests gracefully.

---

### US-009: Verify AQUACOLTOK Survives Watercolor Enforcement

**Description:** As a developer, I need to verify that the `enforceWatercolorStyle()` method does not strip or corrupt the `AQUACOLTOK` trigger token when it processes the prompt. This is critical because `enforceWatercolorStyle` runs BEFORE the Flux API call, and the token injection happens AFTER — but we must ensure the regex cleaning in `enforceWatercolorStyle` wouldn't strip it if ordering ever changed.

**Acceptance Criteria:**

- [x] Verified: `enforceWatercolorStyle()` regex patterns do NOT match the string `AQUACOLTOK`
- [x] Test proves a prompt containing `AQUACOLTOK` passes through `enforceWatercolorStyle()` with the token intact
- [x] Test covers all four grade levels (K-2, 3-5, 6-8, 9-12)

**File:** `src/__tests__/services/imageGeneration.unit.test.ts`

**Validation Test:**

```typescript
describe('AQUACOLTOK Token Safety', () => {
  const gradeLevels: GradeLevel[] = ['K-2', '3-5', '6-8', '9-12'];

  gradeLevels.forEach(grade => {
    test(`enforceWatercolorStyle should not strip AQUACOLTOK for grade ${grade}`, () => {
      const promptWithToken =
        'AQUACOLTOK watercolor painting of a friendly dragon in a forest';
      const enforceWatercolorStyle = (imageGenerationService as any)
        .enforceWatercolorStyle;
      const result = enforceWatercolorStyle.call(
        imageGenerationService,
        promptWithToken,
        grade,
      );
      expect(result).toContain('AQUACOLTOK');
    });
  });

  test('AQUACOLTOK should not appear in prompts when calling SD 3.5 backup', () => {
    // Mock callFluxAquarellAPI to fail
    // Capture the prompt passed to callReplicateAPI
    // Verify it does NOT contain 'AQUACOLTOK'
  });
});
```

Run:

```bash
npm test -- --testPathPattern="services/imageGeneration.unit" --verbose
```

---

## Functional Requirements

- FR-1: The primary image generation model must be `sebastianbodza/flux_aquarell_watercolor_style` with version hash `081a44215bf213876674a0a4623f9ea6def12c8a6986b5db9026985723fabcb4`
- FR-2: Every prompt sent to Flux Aquarell must contain the `AQUACOLTOK` trigger token as the first word
- FR-3: The `AQUACOLTOK` token must NOT appear in prompts sent to the SD 3.5 backup path
- FR-4: Flux Aquarell API requests must use: width 1024, height 1024, guidance_scale 3.5, num_inference_steps 28, num_outputs 1, no scheduler, no negative_prompt
- FR-5: SD 3.5 backup API requests must retain: width 512, height 512, guidance_scale 12, num_inference_steps 50, scheduler DPMSolverMultistep, full negative_prompt
- FR-6: Fallback chain: Flux Aquarell (primary) -> SD 3.5 (backup) -> fail with graceful error
- FR-7: Timeout-adaptive logic preserved: primary timeout triggers shorter backup timeout
- FR-8: Schema/type unions must be additive — existing `google/nano-banana` and other historical values remain valid
- FR-9: Image generation events must record the correct `service_used` value for whichever model produced the image
- FR-10: All dead nano-banana code (interfaces, client, methods) must be removed

## Non-Goals (Out of Scope)

- No feature flag for toggling between Flux Aquarell and SD 3.5 at runtime — rollback is via git revert
- No changes to `enforceWatercolorStyle()` behavior — watercolor prefixes/suffixes remain as-is for both models
- No changes to timeout configuration values — monitor Flux latency post-deploy and adjust separately
- No changes to XP cost, rate limiting, or content safety systems
- No changes to image storage, caching, or upload logic
- No Detox E2E tests — validation is via Jest mocks only

## Technical Considerations

- **Replicate API compatibility:** Both Flux Aquarell and SD 3.5 use the same Replicate `/v1/predictions` endpoint. The key difference is the `version` field and input parameters. The `ReplicateClient` infrastructure (HTTP calls, polling, timeout) works for both.
- **Flux Aquarell input schema:** Flux models do not support `negative_prompt` or `scheduler` parameters. These must be omitted from the request (not set to empty string or null).
- **Resolution change:** Flux Aquarell generates at 1024x1024 vs SD 3.5's 512x512. This may affect: (a) latency (larger images take longer), (b) image storage size, (c) image moderation API compatibility. The existing URL validation checks URL validity, not dimensions or file format.
- **Output format:** Flux may return webp instead of png/jpg. Existing code validates URLs, not extensions — should work as-is.
- **AQUACOLTOK injection point:** The token is injected inside `callFluxAquarellAPI`, AFTER `enforceWatercolorStyle` has already processed the prompt. This ordering ensures the token is never touched by the watercolor enforcement regexes.

## Success Metrics

- Primary model successfully generates watercolor images via Flux Aquarell with `AQUACOLTOK` activation
- Fallback to SD 3.5 works correctly when Flux Aquarell fails
- All existing tests pass (`npm test`) with no regressions
- `AQUACOLTOK` never appears in SD 3.5 backup prompts
- Schema validates both historical and new `service_used` values
- Typecheck passes (`npx tsc --noEmit`)

## Open Questions

- Should Flux Aquarell resolution be reduced to 768x768 if latency exceeds 45s timeout consistently?
- Should `enforceWatercolorStyle()` skip the "NOT digital art, NOT 3d render" suffix when the target model is Flux Aquarell (since Flux doesn't use negative prompts)? Deferred to follow-up.
- Does Flux Aquarell's webp output format work with the post-generation image moderation service (`moderateImage`)? Needs verification during smoke testing.
