# PRD: Upgrade OpenAI Model from gpt-4-turbo-preview to gpt-4o-mini

## Introduction

The story generation system currently uses `gpt-4-turbo-preview` as its LLM, hardcoded in **4 separate locations** across the codebase. This model is scheduled for deprecation by OpenAI. This PRD covers:

1. **Avoiding deprecation breakage** before the model is retired
2. **Reducing cost** — `gpt-4o-mini` is significantly cheaper per token
3. **Improving response speed** — `gpt-4o-mini` has lower latency
4. **Consolidating model config** — removing hardcoded model strings so future model swaps are a 1-line change
5. **Adding env variable override** — allowing model switching via `OPENAI_MODEL` without code changes

## Goals

- Replace all `gpt-4-turbo-preview` references with a single centralized config defaulting to `gpt-4o-mini`
- Add `OPENAI_MODEL` environment variable support for runtime override
- Ensure all 3 code paths (story generation, element extraction, image analysis) use the central config
- Unit tests verify the correct model is passed to the API client at each code path
- Zero breaking changes to API request/response format

## User Stories

### US-001: Add OPENAI_MODEL environment variable and update default model

**Description:** As a developer, I want to configure the OpenAI model via an environment variable so that I can switch models without code changes and the default is `gpt-4o-mini`.

**Acceptance Criteria:**

- [x] Add `OPENAI_MODEL` to `@env` import in `src/config/environment.ts` (line 6-14)
- [x] Add `OPENAI_MODEL` type declaration in `src/types/env.d.ts` (after line 12)
- [x] Update config model value from `'gpt-4-turbo-preview'` to `OPENAI_MODEL || 'gpt-4o-mini'` in `src/config/environment.ts` (line 80)
- [x] Add `OPENAI_MODEL=gpt-4o-mini` entry with descriptive comment to `.env.example` (after line 22)
- [x] Typecheck passes (`npx tsc --noEmit`)

**Implementation Notes (US-001):**

- Added `@env` moduleNameMapper + default mock file (`src/__tests__/__mocks__/@env.ts`) to jest.config.js for test infrastructure
- Test uses direct `Environment` import pattern (matching `clerkConfiguration.test.ts`) since `react-native-dotenv` Babel plugin inlines `@env` values at compile time, making `jest.doMock('@env', ...)` ineffective
- All 4 validation tests pass: default model, no deprecated model, env var override, model property existence

**Validation Test:**

```typescript
// File: src/__tests__/config/environmentModelConfig.test.ts

describe('Environment OpenAI model config', () => {
  it('should default model to gpt-4o-mini when OPENAI_MODEL env var is not set', () => {
    // Re-import after resetting module to pick up default
    jest.resetModules();
    jest.mock('@env', () => ({
      OPENAI_API_KEY: 'sk-test',
      OPENAI_MODEL: undefined, // Not set
      SUPABASE_URL: '',
      SUPABASE_ANON_KEY: '',
      ELEVENLABS_API_KEY: '',
      CLERK_PUBLISHABLE_KEY: '',
      CLERK_SECRET_KEY: '',
      CLERK_JWKS_URL: '',
      CONVEX_URL: '',
    }));
    const { Environment } = require('../../config/environment');
    expect(Environment.openai.model).toBe('gpt-4o-mini');
  });

  it('should use OPENAI_MODEL env var when set', () => {
    jest.resetModules();
    jest.mock('@env', () => ({
      OPENAI_API_KEY: 'sk-test',
      OPENAI_MODEL: 'gpt-4o',
      SUPABASE_URL: '',
      SUPABASE_ANON_KEY: '',
      ELEVENLABS_API_KEY: '',
      CLERK_PUBLISHABLE_KEY: '',
      CLERK_SECRET_KEY: '',
      CLERK_JWKS_URL: '',
      CONVEX_URL: '',
    }));
    const { Environment } = require('../../config/environment');
    expect(Environment.openai.model).toBe('gpt-4o');
  });
});
```

**Files to modify:**

- `src/config/environment.ts` (lines 6-14, 80)
- `src/types/env.d.ts` (after line 12)
- `.env.example` (after line 22)

**Files to create:**

- `src/__tests__/config/environmentModelConfig.test.ts`

---

### US-002: Consolidate storyGenerationService to use central config

**Description:** As a developer, I want the story generation service to read the model from the central config so that model changes propagate automatically without touching this file.

**Acceptance Criteria:**

- [x] Add `import { Environment } from '../config/environment';` to `src/services/storyGenerationService.ts`
- [x] Replace `model: 'gpt-4-turbo-preview'` (line 34) with `model: Environment.openai.model`
- [x] No other behavior changes to the service (all 5 existing tests pass)
- [x] Lint passes (no new errors/warnings)
- [x] Validation test created and passes

**Validation Test:**

```typescript
// File: src/__tests__/services/storyGenerationModelConfig.test.ts

jest.mock('@env', () => ({
  OPENAI_API_KEY: 'sk-test',
  OPENAI_MODEL: 'gpt-4o-mini',
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  ELEVENLABS_API_KEY: '',
  CLERK_PUBLISHABLE_KEY: '',
  CLERK_SECRET_KEY: '',
  CLERK_JWKS_URL: '',
  CONVEX_URL: '',
}));

describe('StoryGenerationService model config', () => {
  it('should use model from Environment config instead of hardcoded value', () => {
    // Access internal config to verify model is read from Environment
    const {
      storyGenerationService,
    } = require('../../services/storyGenerationService');
    const config = (storyGenerationService as any).config;
    expect(config.model).toBe('gpt-4o-mini');
    expect(config.model).not.toBe('gpt-4-turbo-preview');
  });
});
```

**Files to modify:**

- `src/services/storyGenerationService.ts` (add import at line 5, update line 34)

**Files to create:**

- `src/__tests__/services/storyGenerationModelConfig.test.ts`

---

### US-003: Remove hardcoded model from storyElementExtractionService

**Description:** As a developer, I want the element extraction service to defer to the openaiClient's Environment fallback so that model changes propagate automatically.

**Acceptance Criteria:**

- [x] Remove the `model: 'gpt-4-turbo-preview'` property from the options object at line 215 of `src/services/storyElementExtractionService.ts`
- [x] `openaiClient.generateStoryCompletion()` will automatically fall back to `Environment.openai.model` (already implemented at `openaiClient.ts` line 129: `options.model || Environment.openai.model`)
- [x] Keep `maxTokens: 800` and `temperature: 0.3` unchanged — these are intentionally different for structured JSON output
- [x] Typecheck passes (no new errors introduced; pre-existing errors in unrelated files)

**Validation Test:**

```typescript
// File: src/__tests__/services/storyElementExtractionModelConfig.test.ts

import { openaiClient } from '../../services/openaiClient';

jest.mock('../../services/openaiClient', () => ({
  openaiClient: {
    generateStoryCompletion: jest
      .fn()
      .mockResolvedValue(
        '{"characters":[],"settings":[],"objects":[],"plotPatterns":[]}',
      ),
  },
}));

describe('StoryElementExtractionService model config', () => {
  it('should NOT pass a hardcoded model to generateStoryCompletion', async () => {
    const {
      storyElementExtractionService,
    } = require('../../services/storyElementExtractionService');
    await storyElementExtractionService.extractElements(
      'Once upon a time in a magical forest...',
    );

    const callArgs = (openaiClient.generateStoryCompletion as jest.Mock).mock
      .calls[0][2];
    // model should be undefined — let openaiClient fall back to Environment.openai.model
    expect(callArgs.model).toBeUndefined();
  });

  it('should still pass custom maxTokens and temperature for structured output', async () => {
    const {
      storyElementExtractionService,
    } = require('../../services/storyElementExtractionService');
    await storyElementExtractionService.extractElements(
      'Once upon a time in a magical forest...',
    );

    const callArgs = (openaiClient.generateStoryCompletion as jest.Mock).mock
      .calls[0][2];
    expect(callArgs.maxTokens).toBe(800);
    expect(callArgs.temperature).toBe(0.3);
  });
});
```

**Files to modify:**

- `src/services/storyElementExtractionService.ts` (remove model property at line 215)

**Files to create:**

- `src/__tests__/services/storyElementExtractionModelConfig.test.ts`

---

### US-004: Replace hardcoded model in openaiClient image analysis

**Description:** As a developer, I want the image analysis method in the OpenAI client to use the central config model so all OpenAI calls are consistent and configurable.

**Acceptance Criteria:**

- [ ] Replace `model: 'gpt-4-turbo-preview'` (line 231) with `model: Environment.openai.model` in `src/services/openaiClient.ts`
- [ ] File already imports `Environment` from `../config/environment` — no new import needed
- [ ] Update the inline comment from `// Use GPT-4 Turbo for cost efficiency` to `// Uses model from central config`
- [ ] Typecheck passes

**Validation Test:**

```typescript
// File: src/__tests__/services/openaiClientModelConfig.test.ts

jest.mock('@env', () => ({
  OPENAI_API_KEY: 'sk-test-key',
  OPENAI_MODEL: 'gpt-4o-mini',
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  ELEVENLABS_API_KEY: '',
  CLERK_PUBLISHABLE_KEY: '',
  CLERK_SECRET_KEY: '',
  CLERK_JWKS_URL: '',
  CONVEX_URL: '',
}));

describe('OpenAIClient.analyzeStoryForImageGeneration model config', () => {
  it('should pass Environment.openai.model to createChatCompletion', async () => {
    const { OpenAIClient } = require('../../services/openaiClient');
    const client = new OpenAIClient();

    const spy = jest
      .spyOn(client as any, 'createChatCompletion')
      .mockResolvedValue({
        choices: [
          { message: { content: 'A watercolor painting of a magical forest' } },
        ],
        usage: { total_tokens: 50 },
      });

    await client.analyzeStoryForImageGeneration(
      'A story about a magical forest',
      'K-2',
    );

    expect(spy.mock.calls[0][0].model).toBe('gpt-4o-mini');
    expect(spy.mock.calls[0][0].model).not.toBe('gpt-4-turbo-preview');
    spy.mockRestore();
  });
});
```

**Files to modify:**

- `src/services/openaiClient.ts` (line 231)

**Files to create:**

- `src/__tests__/services/openaiClientModelConfig.test.ts`

---

### US-005: Global validation — no gpt-4-turbo-preview references remain

**Description:** As a developer, I want to confirm that the entire source tree has been fully migrated with no stale model references.

**Acceptance Criteria:**

- [ ] `grep -r 'gpt-4-turbo-preview' src/` returns zero matches
- [ ] `npm run lint` passes with no errors
- [ ] `npm test` passes — all existing tests + all new validation tests
- [ ] All new test files follow existing naming conventions in `src/__tests__/`

**Validation Test:**

```typescript
// File: src/__tests__/config/noHardcodedModels.test.ts

import * as fs from 'fs';
import * as path from 'path';

function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (
      entry.isDirectory() &&
      entry.name !== 'node_modules' &&
      entry.name !== '__tests__'
    ) {
      results.push(...getAllTsFiles(fullPath));
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('No hardcoded OpenAI model strings in source code', () => {
  it('should not contain gpt-4-turbo-preview in any source file under src/', () => {
    const srcDir = path.resolve(__dirname, '../../');
    const files = getAllTsFiles(srcDir);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('gpt-4-turbo-preview')) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });
});
```

**Files to create:**

- `src/__tests__/config/noHardcodedModels.test.ts`

---

## Functional Requirements

- **FR-1:** The central config (`environment.ts`) must set the default model to `gpt-4o-mini`
- **FR-2:** The `OPENAI_MODEL` environment variable, when set, must override the default model
- **FR-3:** `storyGenerationService` must read the model from `Environment.openai.model`, not a hardcoded string
- **FR-4:** `storyElementExtractionService` must omit the model option, deferring to `openaiClient`'s Environment fallback at `openaiClient.ts:129`
- **FR-5:** `openaiClient.analyzeStoryForImageGeneration()` must use `Environment.openai.model`
- **FR-6:** No source file under `src/` (excluding test files) may contain the string `gpt-4-turbo-preview` after implementation

## Non-Goals (Out of Scope)

- No changes to `maxTokens`, `temperature`, or stop sequence parameters
- No changes to the API endpoint (`/v1/chat/completions`) or request/response format
- No per-grade-level model selection (potential future enhancement)
- No Convex feature flag for model switching — env var override is sufficient
- No integration tests against the live OpenAI API
- No changes to the Replicate image generation model or ElevenLabs voice model

## Technical Considerations

- **API compatibility:** `gpt-4o-mini` uses the same `/v1/chat/completions` endpoint and identical request schema — it is a drop-in replacement
- **Fallback mechanism:** The key enabler for US-003 is `openaiClient.ts:129` which already implements `options.model || Environment.openai.model`. Removing the hardcoded model from callers automatically defers to the central config
- **react-native-dotenv pipeline:** Adding `OPENAI_MODEL` requires updating both the `@env` import in `environment.ts` and the type declaration in `env.d.ts` — this is the same pattern used for `OPENAI_API_KEY`
- **Constructor timing:** `storyGenerationService` reads the model in its constructor (singleton pattern). The `Environment` config is initialized at module load time, so the value will be available

## Success Metrics

- Zero references to `gpt-4-turbo-preview` in source code
- All existing tests pass without modification
- 6 new validation test files pass (one per user story + global sweep)
- Model can be swapped by changing a single env var — verified by unit test in US-001

## Implementation Order

1. **US-001** first — establishes the env var infrastructure and updates the central default
2. **US-002, US-003, US-004** in any order — each removes one hardcoded string
3. **US-005** last — global validation sweep confirming clean migration

## Open Questions

- None remaining — all clarified via user answers (1D, 2A, 3B, 4A)
