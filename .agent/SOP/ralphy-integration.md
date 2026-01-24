# Ralphy Integration Guide for CreativeBridge

## Overview

This guide explains how to use Ralphy, the AI-powered development automation tool, for CreativeBridge development. Ralphy enforces project-specific rules, maintains code quality, and integrates seamlessly with our existing documentation system and git workflow.

**Prerequisites:**

- Ralphy configured in [`.agent/Ralphy/config.yaml`](../.agent/Ralphy/config.yaml)
- Familiarity with [Development SOPs](./development_procedures.md)
- Understanding of [Project Architecture](../System/project_architecture.md)

---

## Table of Contents

1. [Single-Task Execution Examples](#single-task-execution-examples)
2. [PRD-Based Development Workflows](#prd-based-development-workflows)
3. [Task Structuring for Ralphy](#task-structuring-for-ralphy)
4. [Parallel Agent Execution](#parallel-agent-execution)
5. [Git Workflow Integration](#git-workflow-integration)
6. [Documentation System Complementarity](#documentation-system-complementarity)

---

## Single-Task Execution Examples

### Example 1: Add a New Service Method

**Task Description:**

```
Add a method to storyService.ts that retrieves story statistics for a user.
```

**What Ralphy Does:**

1. ✅ Reads existing `storyService.ts` to understand patterns
2. ✅ Follows TypeScript strict mode and existing code patterns
3. ✅ Implements error handling with exponential backoff (3 retries)
4. ✅ Adds comprehensive JSDoc comments
5. ✅ Creates unit tests with >80% coverage
6. ✅ Updates TypeScript types if needed
7. ✅ Runs typecheck, lint, and tests
8. ✅ **Does NOT** update documentation (single-task scope)

**Expected Output:**

```typescript
// src/services/storyService.ts
/**
 * Retrieves story statistics for a specific user
 * @param userId - The user's ID
 * @returns Promise<StoryStats> - Statistics including total stories, completion rate, avg score
 * @throws Error if user not found or database error occurs
 */
async getStoryStatistics(userId: string): Promise<StoryStats> {
  // Implementation with retry logic, error handling, caching
}
```

**Files Modified:**

- `src/services/storyService.ts` (method added)
- `src/types/database.ts` (StoryStats type added)
- `src/__tests__/services/storyService.test.ts` (5+ tests added)

---

### Example 2: Fix a Bug with Type Safety

**Task Description:**

```
Fix the bug where XP points aren't updating correctly in the gamification service.
The issue is in src/services/gamificationService.ts line 127.
```

**What Ralphy Does:**

1. ✅ Reads the specific file and identifies the bug
2. ✅ Analyzes the root cause (likely async race condition)
3. ✅ Proposes fix with proper async/await handling
4. ✅ Ensures TypeScript strict mode compliance
5. ✅ Adds test case to prevent regression
6. ✅ Validates fix doesn't break existing tests
7. ✅ **Does NOT** refactor surrounding code unnecessarily

**Expected Fix:**

```typescript
// Before (buggy)
updateXP(userId: string, points: number) {
  const current = this.getUserXP(userId); // Missing await!
  this.setUserXP(userId, current + points);
}

// After (fixed by Ralphy)
async updateXP(userId: string, points: number): Promise<void> {
  const current = await this.getUserXP(userId);
  await this.setUserXP(userId, current + points);
}
```

---

### Example 3: Database Migration

**Task Description:**

```
Create a migration to add a 'last_login' timestamp column to the users table.
```

**What Ralphy Does:**

1. ✅ Creates migration file in `sql/` directory with timestamp prefix
2. ✅ Uses `CREATE TABLE IF NOT EXISTS` pattern (even for ALTER)
3. ✅ Adds proper indexes if needed
4. ✅ Includes RLS policy updates if column affects security
5. ✅ Provides rollback procedure in comments
6. ✅ Updates `database_schema.md` documentation
7. ✅ Updates TypeScript types in `src/types/database.ts`
8. ✅ Adds COMMENT ON COLUMN statement for documentation

**Expected Output:**

```sql
-- sql/20260122_add_last_login_to_users.sql
-- Migration: Add last_login timestamp to users table
-- Created: 2026-01-22
-- Author: Ralphy

BEGIN;

-- Add last_login column
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ DEFAULT NOW();

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);

-- Add documentation
COMMENT ON COLUMN users.last_login IS 'Timestamp of user''s last login for analytics and engagement tracking';

-- Test the migration
SELECT 1;

COMMIT;

-- Rollback procedure (if needed)
-- BEGIN;
-- DROP INDEX IF EXISTS idx_users_last_login;
-- ALTER TABLE users DROP COLUMN IF EXISTS last_login;
-- COMMIT;
```

---

## PRD-Based Development Workflows

### Workflow Overview

PRDs (Product Requirement Documents) in CreativeBridge follow a structured format with user stories (US-001, US-002, etc.). Ralphy can execute these systematically.

### Step 1: Create the PRD

**Location:** `.agent/Tasks/[feature-name]-PRD.md`

**Structure:**

```markdown
# [Feature Name] - CreativeBridge

**Status:** Planning
**Branch:** `feature/[feature-name]`
**Priority:** High/Medium/Low

## 🎯 Overview

[Description, business value, technical approach]

## User Stories

### US-001: [Story Name]

**Priority:** 1
**Acceptance Criteria:**

- [ ] Criterion 1
- [ ] Criterion 2

### US-002: [Story Name]

**Priority:** 2
**Acceptance Criteria:**

- [ ] Criterion 1
```

**Example PRD:** See [story-diversity-feature.md](../Tasks/story-diversity-feature.md)

---

### Step 2: Execute User Stories with Ralphy

#### Single User Story Execution

**Task Format:**

```
Implement US-001 from .agent/Tasks/story-diversity-PRD.md:
Create database schema for story elements tracking.
```

**Ralphy's Execution Plan:**

1. ✅ Read PRD to understand acceptance criteria
2. ✅ Read `database_schema.md` to understand existing schema
3. ✅ Create migration file following naming conventions
4. ✅ Implement all tables, indexes, RLS policies from acceptance criteria
5. ✅ Update `database_schema.md` with new schema
6. ✅ Update TypeScript types
7. ✅ Run quality gates (typecheck, lint, test)
8. ✅ Mark acceptance criteria as complete in PRD

**Files Modified:**

- `sql/[timestamp]_create_story_diversity_tables.sql` (new)
- `.agent/System/database_schema.md` (updated)
- `src/types/database.ts` (updated)
- `.agent/Tasks/story-diversity-PRD.md` (acceptance criteria marked)

---

#### Sequential User Story Execution

**Task Format:**

```
Implement US-001 through US-003 from story-diversity-PRD.md in sequence:
1. US-001: Database schema
2. US-002: Story element extraction service
3. US-003: Semantic similarity service
```

**Ralphy's Approach:**

1. **US-001 (Database)**

   - Execute database migration workflow
   - Run tests, verify schema
   - Update documentation
   - **Checkpoint:** Commit changes before proceeding

2. **US-002 (Service)**

   - Read database schema from US-001
   - Implement service following existing patterns
   - Create comprehensive tests (>80% coverage)
   - Mock external services (OpenAI)
   - **Checkpoint:** Commit changes

3. **US-003 (Service)**
   - Read US-002 service to understand integration points
   - Implement similarity calculations
   - Add caching layer (LRU, 24hr TTL)
   - Test with various inputs
   - **Checkpoint:** Commit changes

**Benefits:**

- Each US is self-contained with tests
- Checkpoint commits enable easy rollback
- Dependencies are explicitly managed
- Documentation updates happen per US

---

### Step 3: Feature Completion and Documentation

**Final Task:**

```
Complete story-diversity feature:
1. Update PRD with completion status
2. Update project architecture docs
3. Create integration tests
4. Update README if new commands added
```

**Ralphy's Completion Checklist:**

1. ✅ All acceptance criteria marked complete in PRD
2. ✅ All quality gates pass (typecheck, lint, test)
3. ✅ Integration tests demonstrate end-to-end flow
4. ✅ `.agent/System/project_architecture.md` updated with new components
5. ✅ `.agent/System/database_schema.md` reflects all schema changes
6. ✅ `.agent/Tasks/[feature]-PRD.md` updated with completion status
7. ✅ Branch ready for PR review

---

## Task Structuring for Ralphy

### Effective Task Descriptions

#### ✅ Good Task Structure

```
Add email verification to user registration flow.

Requirements:
- Send verification email using Supabase Auth
- Update database with verification_sent_at timestamp
- Add verified_email boolean to users table
- Create migration with rollback procedure
- Update AuthContext to handle verification state
- Add tests for verification flow
- Update documentation: database_schema.md, project_architecture.md

Constraints:
- Follow existing auth patterns in src/context/AuthContext.tsx
- Use Supabase email templates (don't create custom HTML)
- Migration must include RLS policies
- Tests must mock Supabase client
```

**Why This Works:**

1. ✅ Clear, specific requirements
2. ✅ Explicit documentation update requirements
3. ✅ Constraints prevent over-engineering
4. ✅ References existing patterns to follow
5. ✅ Quality expectations (tests, migrations)

---

#### ❌ Poor Task Structure

```
Make the app better by improving user authentication.
```

**Why This Fails:**

1. ❌ Vague requirements ("better", "improving")
2. ❌ No specific acceptance criteria
3. ❌ No documentation requirements
4. ❌ No constraints or patterns to follow
5. ❌ Risk of over-engineering with unnecessary features

---

### Task Sizing Guidelines

#### Small Tasks (1-2 hours)

- Single method addition
- Simple bug fixes
- Configuration updates
- Documentation-only changes

**Example:**

```
Add a helper function to format XP points with commas.
Location: src/utils/formatting.ts
Include tests in src/__tests__/utils/formatting.test.ts
```

---

#### Medium Tasks (2-8 hours)

- New service implementation
- Database migration with multiple tables
- Component refactoring
- Feature enhancements

**Example:**

```
Implement user story US-002 from story-diversity-PRD.md:
Create story element extraction service with LLM integration.

Deliverables:
- src/services/storyElementExtractionService.ts
- Unit tests with >80% coverage
- Mock OpenAI API calls
- Update project_architecture.md with service description
```

---

#### Large Tasks (8+ hours)

- Complete feature implementation (multiple user stories)
- Major refactoring across multiple files
- Complex integration work
- End-to-end feature with database, services, UI

**Recommendation:** Break large tasks into sequential user stories for better checkpointing.

**Example:**

```
Implement complete story diversity feature (US-001 through US-008).
Execute user stories sequentially with commit checkpoints.

Approach:
1. US-001 & US-002: Database foundation (commit)
2. US-003 & US-004: Core services (commit)
3. US-005 & US-006: Integration layer (commit)
4. US-007 & US-008: Testing & documentation (commit)
```

---

## Parallel Agent Execution

### When to Use Parallel Execution

Parallel execution is beneficial when tasks are **independent** and don't share resources or dependencies.

#### ✅ Good Candidates for Parallel Execution

1. **Independent Service Implementations**

   ```
   Agent 1: Implement storyAnalyticsService.ts
   Agent 2: Implement userPreferencesService.ts
   Agent 3: Implement notificationService.ts
   ```

2. **Test Suite Creation for Existing Code**

   ```
   Agent 1: Write tests for src/services/story*.ts files
   Agent 2: Write tests for src/services/user*.ts files
   Agent 3: Write tests for src/services/gamification*.ts files
   ```

3. **Documentation Updates**
   ```
   Agent 1: Update database_schema.md with new tables
   Agent 2: Update project_architecture.md with new services
   Agent 3: Create API documentation for new endpoints
   ```

---

#### ❌ Poor Candidates for Parallel Execution

1. **Sequential Dependencies**

   ```
   ❌ Agent 1: Create database migration
   ❌ Agent 2: Create service using new tables (needs Agent 1 to finish!)
   ```

2. **Shared File Modifications**

   ```
   ❌ Agent 1: Update AuthContext.tsx with login logic
   ❌ Agent 2: Update AuthContext.tsx with logout logic (merge conflict!)
   ```

3. **Database Migrations**
   ```
   ❌ Agent 1: Add column to users table
   ❌ Agent 2: Add different column to users table (schema conflict!)
   ```

---

### Parallel Execution Example

**Scenario:** Create comprehensive test coverage for existing services

**Task Structure:**

```
Create test suites for all story-related services (3 agents in parallel):

Agent 1:
- Test storyService.ts
- Test storyCompletionService.ts
- Coverage: >80% for both files

Agent 2:
- Test storyElementExtractionService.ts
- Test storyDiversityService.ts
- Coverage: >80% for both files

Agent 3:
- Test storySimilarityService.ts
- Test storyGuidanceService.ts
- Coverage: >80% for both files

Requirements for all agents:
- Mock external services (OpenAI, Replicate, Supabase RPC)
- Test edge cases: empty inputs, null values, error conditions
- Test authorization scenarios
- Follow existing test patterns in src/__tests__/
```

**Benefits:**

- ✅ 3x faster completion (parallel vs sequential)
- ✅ No file conflicts (each agent works on different test files)
- ✅ Consistent test patterns (shared requirements)
- ✅ Independent verification (each agent runs its own tests)

**Coordination:**

```bash
# Agent 1 creates: src/__tests__/services/storyService.test.ts
# Agent 2 creates: src/__tests__/services/storyElementExtractionService.test.ts
# Agent 3 creates: src/__tests__/services/storySimilarityService.test.ts

# No conflicts - different files!
git add src/__tests__/services/*.test.ts
git commit -m "test: add comprehensive test suites for story services

- storyService: 15 tests, 85% coverage
- storyElementExtractionService: 20 tests, 92% coverage
- storySimilarityService: 12 tests, 88% coverage

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Parallel Execution Anti-Pattern

**❌ Don't Do This:**

```
Agent 1: Implement user authentication (modifies AuthContext.tsx)
Agent 2: Implement user profile updates (modifies AuthContext.tsx)
Agent 3: Implement session management (modifies AuthContext.tsx)
```

**Why This Fails:**

- All three agents modify the same file
- Merge conflicts guaranteed
- Wasted effort resolving conflicts
- Risk of logic errors in merged code

**✅ Better Approach:**

```
Sequential execution with logical grouping:
1. Implement authentication foundation (AuthContext.tsx)
2. Implement profile updates (separate ProfileService.ts)
3. Implement session management (separate SessionService.ts)
```

---

## Git Workflow Integration

### Branch Strategy with Ralphy

Ralphy integrates seamlessly with the existing git workflow defined in [development_procedures.md](./development_procedures.md).

#### Feature Branch Workflow

**Step 1: Create Feature Branch**

```bash
git checkout main
git pull origin main
git checkout -b feature/story-diversity
```

**Step 2: Execute User Stories with Ralphy**

```
Implement US-001: Database schema for story elements tracking
(from story-diversity-PRD.md)
```

**Step 3: Review Ralphy's Changes**

```bash
git status
git diff

# Ralphy should have modified:
# - sql/[timestamp]_create_story_diversity_tables.sql (new)
# - .agent/System/database_schema.md (updated)
# - src/types/database.ts (updated)
# - .agent/Tasks/story-diversity-PRD.md (acceptance criteria marked)
```

**Step 4: Commit Changes**

```bash
git add sql/ .agent/ src/types/
git commit -m "feat: add database schema for story diversity tracking

- Create story_elements table with embeddings (JSONB)
- Create user_sessions table with 24hr expiration
- Create story_diversity_scores table
- Add comprehensive indexes and RLS policies
- Update database schema documentation

Implements: US-001
Acceptance criteria: 6/6 complete

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Checkpoint Commits

For multi-user-story features, create checkpoint commits after each user story.

**Benefits:**

- ✅ Easy rollback if a user story needs rework
- ✅ Clear commit history showing incremental progress
- ✅ Smaller, focused commits are easier to review
- ✅ Each commit passes all quality gates independently

**Example Commit Sequence:**

```bash
# US-001: Database schema
git commit -m "feat: add story diversity database schema (US-001)"

# US-002: Extraction service
git commit -m "feat: implement story element extraction service (US-002)"

# US-003: Similarity service
git commit -m "feat: implement semantic similarity service (US-003)"

# US-004: Diversity scoring
git commit -m "feat: implement diversity scoring service (US-004)"
```

---

### Commit Message Conventions

Ralphy follows [Conventional Commits](https://www.conventionalcommits.org/) as defined in `config.yaml`.

**Format:**

```
<type>: <description>

[optional body]

[optional footer]

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Types:**

- `feat:` - New feature implementation
- `fix:` - Bug fix
- `chore:` - Maintenance, dependencies, tooling
- `docs:` - Documentation-only changes
- `refactor:` - Code refactoring without behavior change
- `test:` - Adding or updating tests
- `perf:` - Performance improvements

**Examples:**

```bash
# Feature with user story reference
git commit -m "feat: implement story element extraction with LLM (US-002)

- Use GPT-4 Turbo with structured output prompting
- Extract characters, settings, objects, plot patterns
- Normalize to lowercase and singular forms
- Add exponential backoff retry logic (3 attempts)
- Implement fallback regex extraction
- Add 20 comprehensive unit tests (all passing)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Bug fix
git commit -m "fix: resolve XP update race condition in gamification service

- Add proper async/await to updateXP method
- Add test case to prevent regression
- Fixes issue where XP points weren't updating correctly

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Documentation update
git commit -m "docs: update database schema with story diversity tables

- Add story_elements table documentation
- Add user_sessions table documentation
- Add story_diversity_scores table documentation
- Document helper functions and RLS policies

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Pull Request Creation

After completing all user stories for a feature, create a pull request.

**Using `gh` CLI (recommended):**

```bash
# Push feature branch
git push -u origin feature/story-diversity

# Create PR with comprehensive description
gh pr create --title "feat: Story Diversity Tracking System" --body "$(cat <<'EOF'
## Summary
Implements comprehensive story diversity tracking and enforcement system to reduce repetition and increase creative variety.

**Completed User Stories:** 15/16 (93.75%)
- ✅ US-001: Database schema for story elements
- ✅ US-002: Story element extraction service
- ✅ US-003: Semantic similarity service
- ✅ US-004: Diversity scoring service
- ✅ US-005: Story guidance service
- ✅ US-006-015: Integration, testing, documentation
- ⏳ US-016: Final optimization (follow-up PR)

## Technical Implementation
- **Database:** PostgreSQL with JSONB embeddings, RLS policies
- **Services:** 8 specialized services with caching and retry logic
- **AI Integration:** GPT-4 Turbo + text-embedding-3-small
- **Test Coverage:** >85% across all new services

## Test Plan
- [x] All unit tests passing (120+ tests)
- [x] Integration tests demonstrate end-to-end flow
- [x] Typecheck passes
- [x] Lint passes
- [x] Manual testing on iOS and Android

## Documentation
- [x] Database schema updated
- [x] Project architecture updated
- [x] PRD marked complete
- [x] API documentation added

## Breaking Changes
None - feature is additive, existing functionality unchanged.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

### Pre-PR Checklist

Before creating a PR, ensure Ralphy has completed all quality gates:

```bash
# 1. Type checking
npx tsc --noEmit

# 2. Linting
npm run lint

# 3. Tests
npm test

# 4. Build verification
npm run build

# 5. Documentation check
# Verify all .agent/ docs are updated:
git diff .agent/System/database_schema.md
git diff .agent/System/project_architecture.md
git diff .agent/Tasks/[feature]-PRD.md
```

**Ralphy's Quality Gates (from config.yaml):**

- ✅ `typecheck` - No TypeScript errors
- ✅ `lint` - No ESLint violations
- ✅ `test` - All tests passing, >80% coverage

---

## Documentation System Complementarity

### How Ralphy Complements Existing Docs

Ralphy **enforces** the documentation requirements defined in [CLAUDE.md](../../CLAUDE.md) and the `.agent/` structure.

#### Documentation Update Flow

**Before Ralphy:**

```
Developer implements feature → Manually updates docs (often forgotten)
```

**With Ralphy:**

```
Developer requests feature → Ralphy implements AND updates docs automatically
```

---

### Automatic Documentation Updates

#### Database Schema Changes

**Task:**

```
Add a 'streak_count' column to users table for gamification.
```

**Ralphy Automatically Updates:**

1. ✅ `sql/[timestamp]_add_streak_count.sql` - Migration file
2. ✅ `.agent/System/database_schema.md` - Schema documentation
3. ✅ `src/types/database.ts` - TypeScript types
4. ✅ SQL COMMENT statements for database documentation

**Manual Review Required:**

- Verify documentation accuracy
- Add usage examples if complex
- Update related services documentation

---

#### Service Implementation

**Task:**

```
Implement US-002: Story element extraction service (from story-diversity-PRD.md)
```

**Ralphy Automatically Updates:**

1. ✅ `src/services/storyElementExtractionService.ts` - Service implementation
2. ✅ `src/__tests__/services/storyElementExtractionService.test.ts` - Tests
3. ✅ `.agent/Tasks/story-diversity-PRD.md` - Mark acceptance criteria complete
4. ✅ JSDoc comments in service file

**Manual Follow-Up:**

- Update `.agent/System/project_architecture.md` if new integration patterns
- Add to README if new developer setup required

---

### Documentation Hierarchy

```
CLAUDE.md (Project Instructions)
    ↓
.agent/README.md (Documentation Index)
    ↓
├── .agent/Ralphy/config.yaml (Enforces documentation rules)
├── .agent/System/ (Architecture & Schema)
├── .agent/SOP/ (Development Procedures)
└── .agent/Tasks/ (Feature PRDs)
```

**Ralphy's Role:**

- **Reads:** All documentation to understand context
- **Enforces:** Documentation update requirements from config.yaml
- **Updates:** System docs, Task PRDs, schema docs
- **Does NOT Update:** CLAUDE.md, SOP procedures (require human review)

---

### Documentation Update Examples

#### Example 1: New Service

**Ralphy Updates:**

```markdown
# .agent/System/project_architecture.md

## Services Layer (Updated)

### Story Element Extraction Service

**File:** `src/services/storyElementExtractionService.ts`
**Purpose:** Extract story elements using LLM for diversity tracking
**Dependencies:** OpenAI API (GPT-4 Turbo)
**Key Methods:**

- `extractStoryElements(text: string): Promise<StoryElements>`
- `normalizeElements(elements: RawElements): StoryElements`
  **Error Handling:** Exponential backoff (3 retries), fallback regex extraction
  **Caching:** LRU cache, 1000 entries, 24hr TTL
  **Tests:** 20 unit tests, 92% coverage
```

---

#### Example 2: Database Migration

**Ralphy Updates:**

```markdown
# .agent/System/database_schema.md

## Tables (Updated)

### story_elements

**Purpose:** Track story elements for diversity analysis
**Columns:**

- `id` (UUID, PK) - Primary key
- `story_id` (UUID, FK) - References stories.id
- `session_id` (UUID, FK) - References user_sessions.id
- `element_type` (ENUM) - 'character' | 'setting' | 'object' | 'plot_pattern'
- `element_text` (TEXT) - Normalized element text
- `embedding_vector` (JSONB) - 1536-dimensional embedding from OpenAI
- `created_at` (TIMESTAMPTZ) - Creation timestamp

**Indexes:**

- `idx_story_elements_session_id_created_at` - Session queries with time ordering
- `idx_story_elements_story_id` - Story-specific element lookups
- `idx_story_elements_embedding_gin` - GIN index for JSONB embedding queries

**RLS Policies:**

- `story_elements_select_policy` - Users can only read their own elements
```

---

### Documentation Review Workflow

**After Ralphy Completes a Task:**

1. **Review Generated Code**

   ```bash
   git diff src/
   ```

2. **Review Documentation Updates**

   ```bash
   git diff .agent/
   ```

3. **Verify Completeness**

   - [ ] All acceptance criteria marked in PRD?
   - [ ] Database schema docs reflect schema changes?
   - [ ] Project architecture updated with new components?
   - [ ] Types updated for new database fields?

4. **Manual Enhancements (if needed)**

   - Add usage examples for complex services
   - Update README if new developer setup steps
   - Add migration notes if breaking changes
   - Update deployment docs if config changes

5. **Commit**
   ```bash
   git add .agent/ src/
   git commit -m "feat: implement story element extraction (US-002)"
   ```

---

## Best Practices Summary

### ✅ Do's

1. **Be Specific with Tasks**

   - Include acceptance criteria
   - Reference existing patterns
   - Specify documentation updates
   - Define quality expectations

2. **Use PRD-Based Workflows**

   - Create comprehensive PRDs in `.agent/Tasks/`
   - Break features into user stories
   - Execute user stories sequentially with checkpoints
   - Mark acceptance criteria as you progress

3. **Leverage Parallel Execution**

   - Use for independent tasks (tests, docs, separate services)
   - Avoid for sequential dependencies or shared files
   - Coordinate with clear task boundaries

4. **Follow Git Workflow**

   - Create feature branches
   - Commit after each user story (checkpoints)
   - Use conventional commit messages
   - Include Co-Authored-By tag

5. **Review Documentation**
   - Verify Ralphy updated all required docs
   - Add manual enhancements where needed
   - Ensure documentation accuracy
   - Keep `.agent/` docs in sync with code

---

### ❌ Don'ts

1. **Vague Task Descriptions**

   - Don't say "improve the code" or "make it better"
   - Don't omit acceptance criteria
   - Don't forget to specify documentation requirements

2. **Over-Engineering**

   - Don't ask for features beyond requirements
   - Don't request unnecessary abstractions
   - Don't add "nice to have" features to core tasks
   - Trust Ralphy's boundaries to prevent scope creep

3. **Parallel Execution Mistakes**

   - Don't parallelize sequential dependencies
   - Don't have multiple agents modify the same file
   - Don't parallelize database migrations

4. **Git Workflow Violations**

   - Don't commit without running quality gates
   - Don't skip documentation updates
   - Don't force push to main/master
   - Don't forget Co-Authored-By tag

5. **Documentation Gaps**
   - Don't skip `.agent/` documentation updates
   - Don't forget to update PRDs with completion status
   - Don't leave database schema docs out of sync
   - Don't modify CLAUDE.md or SOPs without discussion

---

## Quick Reference

### Common Task Templates

#### Database Migration

```
Create a migration to [description].

Requirements:
- Migration file: sql/[timestamp]_[descriptive_name].sql
- Use CREATE TABLE IF NOT EXISTS pattern
- Add indexes: [list indexes]
- Add RLS policies: [list policies]
- Include rollback procedure in comments
- Update database_schema.md
- Update src/types/database.ts
- Add COMMENT statements
```

#### New Service

```
Implement [service name] service.

Requirements:
- File: src/services/[serviceName].ts
- Methods: [list methods with signatures]
- Error handling: exponential backoff (3 retries)
- Caching: LRU cache, 1000 entries, 24hr TTL
- Tests: >80% coverage, mock external services
- Follow patterns in src/services/[similarService].ts
- Update project_architecture.md
```

#### Bug Fix

```
Fix bug in [file path] at line [number].

Issue: [description]
Root cause: [if known]

Requirements:
- Fix the bug with minimal changes
- Add test case to prevent regression
- Ensure TypeScript strict mode compliance
- Don't refactor surrounding code
- Run all existing tests to ensure no breakage
```

---

## Resources

- [Ralphy Configuration](../Ralphy/config.yaml)
- [Ralphy README](../Ralphy/README.md)
- [Development SOPs](./development_procedures.md)
- [Project Architecture](../System/project_architecture.md)
- [Database Schema](../System/database_schema.md)
- [Example PRD: Story Diversity](../Tasks/story-diversity-feature.md)

---

**Last Updated:** 2026-01-22
**Version:** 1.0
**Maintainer:** Development Team

> 💡 **Pro Tip:** Start with small, focused tasks to build familiarity with Ralphy's capabilities. As you gain confidence, move to PRD-based workflows for complex features.
