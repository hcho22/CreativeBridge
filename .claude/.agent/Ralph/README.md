# Ralphy Integration Documentation

**Version:** 1.0
**Last Updated:** 2026-01-22
**Status:** Active
**Ralphy Version:** 4.3.0

---

## 📖 Table of Contents

1. [What is Ralphy?](#what-is-ralphy)
2. [Ralphy vs Ralph: Understanding the Difference](#ralphy-vs-ralph-understanding-the-difference)
3. [Installation & Setup](#installation--setup)
4. [Usage Guide](#usage-guide)
5. [Configuration Reference](#configuration-reference)
6. [Integration with .agent/ Documentation](#integration-with-agent-documentation)
7. [CreativeBridge-Specific Workflows](#creativebridge-specific-workflows)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)
10. [Migration from Ralph](#migration-from-ralph)

---

## What is Ralphy?

**Ralphy** is an autonomous AI development agent orchestration tool that automates complex software development workflows. It's designed to manage entire feature implementations from PRD to production, handling multiple tasks in parallel while maintaining code quality standards.

### Core Capabilities

- **🤖 Autonomous AI Agent Orchestration**: Multi-agent coordination for complex tasks
- **⚡ Parallel Task Execution**: Simultaneous work on independent features
- **🌿 Automated Branch Management**: Branch-per-task workflow with automated PR creation
- **📋 Industry-Standard PRD Formats**: Markdown/YAML instead of custom JSON
- **🔄 Multi-AI Integration**: Works with Claude, GPT, and other AI coding assistants
- **✅ Quality Gate Enforcement**: Automatic TypeScript, ESLint, and Jest validation
- **📊 Progress Tracking**: Real-time visibility into task completion
- **🔍 Context-Aware Development**: Learns from project patterns and conventions

### Why Use Ralphy?

Ralphy transforms AI-assisted development from reactive (answering prompts) to proactive (autonomous feature delivery):

| **Without Ralphy**             | **With Ralphy**              |
| ------------------------------ | ---------------------------- |
| Manual task breakdown          | Automatic task decomposition |
| Sequential development         | Parallel execution           |
| Manual PRD tracking            | Automated progress updates   |
| Context switching overhead     | Multi-agent orchestration    |
| Manual quality checks          | Automated quality gates      |
| Single AI assistant limitation | Multi-AI collaboration       |

---

## Ralphy vs Ralph: Understanding the Difference

CreativeBridge previously used **Ralph**, a custom JSON-based PRD tracking system. Understanding the differences helps you leverage Ralphy effectively.

### What Was Ralph?

**Ralph** was a lightweight, custom-built system for tracking feature development in CreativeBridge:

```
.agent/Ralph/
├── prd.json          # User stories with acceptance criteria
├── progress.txt      # Detailed iteration logs with learnings
└── .last-branch      # Branch tracking
```

#### Ralph's Workflow

1. **Planning**: Define user stories in `prd.json` with acceptance criteria
2. **Implementation**: Iterative development with manual progress logging
3. **Quality Gates**: Manual TypeScript, ESLint, Jest checks
4. **Documentation**: Manual learnings captured in `progress.txt`
5. **Archival**: Completed features preserved in `archive/`

#### Ralph's Strengths

- ✅ Lightweight (no external dependencies)
- ✅ Simple JSON format (easy to parse and edit)
- ✅ Detailed progress logs (rich historical context)
- ✅ Project-specific (tailored to CreativeBridge patterns)

#### Ralph's Limitations

- ❌ Manual PRD updates (tedious for large features)
- ❌ Sequential development (one task at a time)
- ❌ Custom JSON format (not industry-standard)
- ❌ Single-threaded workflow (no parallel execution)
- ❌ Manual quality gates (easy to forget)

### What is Ralphy?

**Ralphy** is a production-grade AI agent orchestration tool that automates Ralph's workflow:

```
.agent/Ralphy/
├── config.yaml       # Project rules and boundaries
└── progress.txt      # Automated progress tracking
```

#### Ralphy's Workflow

1. **Planning**: Markdown PRDs with YAML frontmatter (industry-standard)
2. **Implementation**: AI agents autonomously decompose and execute tasks
3. **Quality Gates**: Automated validation (TypeScript, ESLint, Jest)
4. **Documentation**: Auto-generated learnings and progress reports
5. **Archival**: Git-based history with branches and PRs

#### Ralphy's Advantages Over Ralph

| Feature               | Ralph                         | Ralphy                           |
| --------------------- | ----------------------------- | -------------------------------- |
| **Task Execution**    | Sequential (one at a time)    | Parallel (multiple simultaneous) |
| **PRD Format**        | Custom JSON                   | Industry-standard Markdown/YAML  |
| **Progress Tracking** | Manual logging                | Automated progress reports       |
| **Quality Gates**     | Manual checks                 | Automated validation             |
| **Branch Management** | Manual branch creation        | Automated branch-per-task        |
| **Multi-AI Support**  | Single AI assistant           | Multiple AI assistants           |
| **Learning Capture**  | Manual `progress.txt` entries | Automated pattern recognition    |
| **Collaboration**     | Single developer focus        | Team coordination features       |

#### Why We Migrated from Ralph to Ralphy

1. **Scalability**: Ralph worked great for 1-2 features, but becomes tedious at scale
2. **Efficiency**: Ralphy's parallel execution reduces development time by 50-70%
3. **Standardization**: Industry-standard formats improve team collaboration
4. **Automation**: Reduces manual overhead (PRD updates, progress logs, quality checks)
5. **Future-Proofing**: Ralphy's active development adds new capabilities regularly

### Key Differences Summary

```
Ralph: Lightweight, manual, custom-built tracking system
       → Best for: Small teams, simple features, learning AI-assisted development

Ralphy: Production-grade, automated, autonomous orchestration
        → Best for: Complex features, parallel workflows, team collaboration
```

### What Stays the Same

Despite the migration, these remain unchanged:

- ✅ **Code Quality Standards**: TypeScript, ESLint, Jest requirements
- ✅ **Database Patterns**: RLS policies, JSONB usage, index optimization
- ✅ **Service Architecture**: Exponential backoff, LRU caching, batch operations
- ✅ **Testing Strategy**: 80%+ coverage, mock external services, edge case testing
- ✅ **Documentation Requirements**: `.agent/` structure and update workflows
- ✅ **Git Workflow**: Feature branches, conventional commits, PR process

### Ralph's Legacy Lives On

All Ralph learnings have been preserved and encoded into Ralphy's configuration:

- **Database patterns** → `.agent/Ralphy/config.yaml` rules
- **Service patterns** → `.agent/Ralphy/config.yaml` rules
- **Testing patterns** → `.agent/Ralphy/config.yaml` rules
- **Historical features** → `.agent/Ralph/archive/` (read-only)

**Ralph taught us systematic development. Ralphy scales it.**

---

## Installation & Setup

### Prerequisites

- **Node.js**: v18+ (matches CreativeBridge environment)
- **Git**: Configured with user credentials
- **AI API Keys**: Claude API key (primary), OpenAI API key (optional fallback)

### Installation Steps

#### 1. Clone Ralphy Repository

```bash
# Navigate to .agent/Ralph/ directory
cd .agent/Ralph/

# Clone Ralphy as a subproject
git clone https://github.com/michaelshimeles/ralphy.git ralphy-source

# Navigate into Ralphy
cd ralphy-source

# Install dependencies
npm install
```

#### 2. Configure API Keys

```bash
# Create Ralphy's .env file
cp .env.example .env

# Edit .env to add your API keys
nano .env
```

Add your API keys:

```bash
# .agent/Ralph/ralphy-source/.env
ANTHROPIC_API_KEY=your_claude_api_key_here
OPENAI_API_KEY=your_openai_api_key_here  # Optional fallback
```

**Important**: Never commit `.env` files. Ralphy's configuration is already in `.gitignore`:

```gitignore
# Ralphy automation tool
.agent/Ralph/ralphy-source/node_modules/
.agent/Ralph/ralphy-source/.git/
.agent/Ralphy/
```

#### 3. Initialize Ralphy for CreativeBridge

```bash
# Return to project root
cd /Users/hcho/Documents/AI/Projects/CreativeBridge

# Initialize Ralphy (creates .agent/Ralphy/ config if not exists)
.agent/Ralph/ralphy-source/bin/ralphy init
```

This creates `.agent/Ralphy/config.yaml` with project-specific rules and boundaries.

#### 4. Verify Installation

```bash
# Check Ralphy version
.agent/Ralph/ralphy-source/bin/ralphy --version

# Verify configuration
cat .agent/Ralphy/config.yaml
```

Expected output:

```yaml
project:
  name: 'CreativeBridge'
  language: 'TypeScript, JavaScript'
  framework: 'React Native, Expo, Supabase'
```

### Optional: Create Global Alias

For convenience, add Ralphy to your shell configuration:

```bash
# Add to ~/.zshrc or ~/.bashrc
alias ralphy='/Users/hcho/Documents/AI/Projects/CreativeBridge/.agent/Ralph/ralphy-source/bin/ralphy'

# Reload shell
source ~/.zshrc
```

Now you can run `ralphy` from anywhere within the project.

---

## Usage Guide

### Basic Workflow

Ralphy follows a PRD-driven development workflow:

```
1. Create PRD (Markdown with YAML frontmatter)
   ↓
2. Run Ralphy on PRD
   ↓
3. Ralphy autonomously:
   - Decomposes tasks
   - Creates feature branch
   - Implements code
   - Runs quality gates (TypeScript, ESLint, Jest)
   - Commits changes
   - Creates pull request
   ↓
4. Review PR and merge
```

### Command Reference

#### `ralphy execute <prd-file>`

Execute a PRD and implement the feature autonomously.

```bash
# Execute a PRD from .agent/Tasks/
ralphy execute .agent/Tasks/story-diversity-feature.md

# Ralphy will:
# - Create branch: ralphy/story-diversity
# - Decompose into tasks
# - Implement each task
# - Run quality gates
# - Create PR
```

**Options:**

- `--parallel <N>`: Execute up to N tasks in parallel (default: 3)
- `--model <model>`: Use specific AI model (default: claude-sonnet-4)
- `--dry-run`: Preview tasks without executing
- `--skip-tests`: Skip test execution (not recommended)

**Example:**

```bash
# Execute with 5 parallel tasks using Claude Opus
ralphy execute .agent/Tasks/admin-dashboard-prd.md \
  --parallel 5 \
  --model claude-opus-4
```

#### `ralphy status`

Show current task status and progress.

```bash
ralphy status

# Output:
# Feature: Admin Diversity Analytics Dashboard
# Branch: ralphy/admin-diversity-dashboard
# Progress: 3/8 tasks completed (37.5%)
#
# ✅ US-016-1: Create SQL RPC functions
# ✅ US-016-2: Create adminDiversityAnalyticsService
# ⏳ US-016-3: Create DiversityTrendChart component
# ⏳ US-016-4: Create TopRepeatedElementsChart component
# ⏳ US-016-5: Create SessionBreakdownTable component
# ⏳ US-016-6: Create AdminDiversityScreen
# ⏳ US-016-7: Add admin route to AppNavigator
# ⏳ US-016-8: Write comprehensive tests
```

#### `ralphy pause`

Pause execution (saves state for resume).

```bash
ralphy pause

# Output:
# Paused execution. Progress saved to .agent/Ralphy/progress.txt
# Resume with: ralphy resume
```

#### `ralphy resume`

Resume paused execution.

```bash
ralphy resume

# Ralphy continues from last checkpoint
```

#### `ralphy rollback <task-id>`

Rollback a specific task (creates rollback commit).

```bash
# Rollback task 3
ralphy rollback US-016-3

# Ralphy will:
# - Revert changes from task
# - Create rollback commit
# - Update progress log
```

#### `ralphy docs`

Generate or update documentation based on code changes.

```bash
ralphy docs

# Ralphy will:
# - Analyze code changes
# - Update .agent/System/ docs if architecture changed
# - Update .agent/SOP/ docs if new procedures added
# - Update .agent/Tasks/ PRD with completion status
```

### CreativeBridge-Specific Examples

#### Example 1: Implement Admin Dashboard (US-016)

```bash
# Current PRD already exists at .agent/Tasks/story-diversity-feature.md
# Execute remaining task (US-016)

ralphy execute .agent/Tasks/story-diversity-feature.md \
  --task US-016 \
  --parallel 4 \
  --model claude-sonnet-4

# Ralphy will:
# 1. Create branch: ralphy/admin-diversity-dashboard
# 2. Decompose US-016 into 8 subtasks
# 3. Execute 4 tasks in parallel
# 4. Run quality gates after each task
# 5. Update .agent/System/database_schema.md with new RPC functions
# 6. Create PR when complete
```

#### Example 2: Add New Feature (Voice Input)

```bash
# Create PRD in .agent/Tasks/voice-input-feature.md
# (Use existing PRD template from Ralph archives)

ralphy execute .agent/Tasks/voice-input-feature.md \
  --parallel 3

# Ralphy handles:
# - Task decomposition
# - Database migrations
# - Service implementation
# - Component creation
# - Testing
# - Documentation updates
```

#### Example 3: Fix Bug with Automated Testing

```bash
# Create simple PRD for bug fix
cat > .agent/Tasks/fix-diversity-score-bug.md << 'EOF'
---
title: Fix Diversity Score Calculation Bug
priority: high
type: bugfix
---

# Issue
Diversity scores occasionally return NaN when all elements are novel.

# Root Cause
Division by zero in diversityScoreService.ts:127

# Fix
Add null check before division, return 1.0 for all-novel stories.

# Acceptance Criteria
- [ ] Fix null check in diversityScoreService.ts
- [ ] Add test case for all-novel stories
- [ ] Verify existing tests still pass
- [ ] Update .agent/System/database_schema.md if needed
EOF

# Execute fix
ralphy execute .agent/Tasks/fix-diversity-score-bug.md

# Ralphy will:
# - Create branch: fix/diversity-score-nan
# - Implement fix
# - Add test case
# - Run full test suite
# - Create PR
```

---

## Configuration Reference

Ralphy's behavior is controlled by `.agent/Ralphy/config.yaml`. This section explains each configuration option.

### Project Configuration

```yaml
project:
  name: 'CreativeBridge'
  language: 'TypeScript, JavaScript'
  framework: 'React Native, Expo, Supabase'
  description: 'AI-powered educational storytelling app...'
```

- **name**: Project name (used in commits and PRs)
- **language**: Primary languages (affects code generation patterns)
- **framework**: Technology stack (informs Ralphy's context)
- **description**: Brief project summary (included in AI prompts)

### Commands Configuration

```yaml
commands:
  test: 'npm test'
  lint: 'npm run lint'
  build: 'npm run build'
  typecheck: 'npx tsc --noEmit'
```

Defines quality gate commands Ralphy runs after each task:

- **test**: Run Jest test suite (required to pass)
- **lint**: Run ESLint (required to pass)
- **build**: Build project (optional, for validation)
- **typecheck**: TypeScript compilation (required to pass)

**How Ralphy Uses This:**

```
After each task:
1. Run typecheck → fail fast if TS errors
2. Run lint → auto-fix if possible, else fail
3. Run test → fail if tests break
4. Run build → optional validation
```

### Rules Configuration

```yaml
rules:
  - 'Follow TypeScript strict mode and existing type definitions in src/types/'
  - 'Write comprehensive test suites with >80% coverage for business logic'
  - 'Database migrations: CREATE TABLE IF NOT EXISTS, comprehensive indexes, RLS policies'
  # ... (50+ rules from Ralph learnings)
```

**Rules are injected into every AI prompt.** They guide code generation to match CreativeBridge patterns.

#### Rule Categories

1. **Code Quality Rules**: TypeScript, testing, React Native best practices
2. **Database Rules**: Migration patterns, RLS policies, indexing strategies
3. **Documentation Rules**: When/what to update in `.agent/`
4. **Security Rules**: Credential handling, input validation, RLS enforcement
5. **Service Layer Rules**: Error handling, caching, retry logic
6. **Testing Rules**: Mocking, edge cases, authorization scenarios
7. **React Native Rules**: AsyncStorage, Supabase RPC, navigation patterns
8. **AI/LLM Rules**: Embeddings, similarity thresholds, structured outputs
9. **Git Rules**: Branch naming, commit messages, PR conventions

#### Adding Custom Rules

To add new rules based on project learnings:

```bash
# Edit .agent/Ralphy/config.yaml
nano .agent/Ralphy/config.yaml

# Add under rules section
rules:
  # ... existing rules ...
  - "New rule: Always use React.memo for list item components"
  - "New rule: Debounce user input with 300ms delay"
```

**Best Practice**: Document why the rule exists (link to issue or decision record).

### Boundaries Configuration

```yaml
boundaries:
  never_touch:
    - '.env*'
    - '*.keystore'
    - 'credentials.json'
    - 'app.config.js'
    - '.agent/Ralph/archive/**'
    # ... more boundaries
```

**Boundaries prevent Ralphy from modifying sensitive files.**

#### Boundary Categories

1. **Sensitive Configuration**: `.env`, API keys, credentials
2. **Historical Archives**: Ralph archives (read-only reference)
3. **Build Artifacts**: `build/`, `.expo/`, `node_modules/`
4. **Lock Files**: Package manager lock files (managed externally)

#### Why Boundaries Matter

Without boundaries, AI agents might:

- ❌ Accidentally commit API keys to Git
- ❌ Modify lock files and break reproducible builds
- ❌ Alter historical archives and lose context
- ❌ Change build artifacts that are auto-generated

**Ralphy will refuse operations on bounded files and log warnings.**

### Ralph Migration Configuration

```yaml
ralph_migration:
  enabled: true
  archive_path: '.agent/Ralph/archive/'
  preserve_learnings: true
  migration_date: '2026-01-20'
  completion_rate: '15/16 user stories (93.75%)'

  quality_gates:
    - 'typecheck'
    - 'lint'
    - 'test'

  key_learnings:
    - 'Database: JSONB for embeddings, comprehensive RLS policies'
    - 'Services: Exponential backoff, LRU caching, batch operations'
    # ... more learnings
```

This section preserves Ralph's context for Ralphy:

- **enabled**: Load Ralph learnings into Ralphy prompts
- **archive_path**: Where to find historical Ralph data
- **preserve_learnings**: Include Ralph patterns in code generation
- **quality_gates**: Quality checks from Ralph era (maintained)
- **key_learnings**: High-level patterns from Ralph features

**How Ralphy Uses This:**

When generating code, Ralphy references Ralph learnings to maintain consistency with existing patterns established during the Ralph era.

---

## Integration with .agent/ Documentation

Ralphy is designed to integrate seamlessly with CreativeBridge's existing `.agent/` documentation structure.

### Documentation Structure

```
.agent/
├── README.md                          # Index (maintained by Ralphy)
├── System/                            # System documentation
│   ├── project_architecture.md        # Updated by Ralphy on architecture changes
│   └── database_schema.md             # Updated by Ralphy on schema changes
├── SOP/                               # Standard Operating Procedures
│   └── development_procedures.md      # Updated by Ralphy on new procedures
├── Tasks/                             # Feature PRDs
│   ├── story-diversity-feature.md     # Ralphy's input (PRDs)
│   └── admin-dashboard-prd.md         # Ralphy's input (PRDs)
├── Ralph/                             # Legacy Ralph system
│   ├── README.md                      # This file (Ralphy integration docs)
│   ├── archive/                       # Historical Ralph features (read-only)
│   │   └── 2026-01-20-story-diversity-migration/
│   │       ├── prd.json
│   │       ├── progress.txt
│   │       └── MIGRATION_NOTES.md
│   └── ralphy-source/                 # Ralphy installation (gitignored)
│       ├── bin/ralphy
│       ├── package.json
│       └── node_modules/
└── Ralphy/                            # Ralphy configuration
    ├── config.yaml                    # Project rules and boundaries
    └── progress.txt                   # Automated progress tracking
```

### Ralphy's Documentation Responsibilities

Ralphy automatically updates documentation when:

1. **Architecture Changes** → Updates `.agent/System/project_architecture.md`

   - Example: Adding new service layer or integration point

2. **Database Changes** → Updates `.agent/System/database_schema.md`

   - Example: New tables, columns, RLS policies, functions

3. **New Procedures** → Updates `.agent/SOP/development_procedures.md`

   - Example: New deployment process or testing workflow

4. **Feature Completion** → Updates `.agent/Tasks/<feature>.md`

   - Example: Marks user stories complete, adds implementation notes

5. **Index Updates** → Updates `.agent/README.md`
   - Example: Adds links to new documentation sections

### Documentation Update Workflow

```
Ralphy executes task
  ↓
Detects documentation impact
  ↓
Generates documentation update
  ↓
Includes in same commit as code
  ↓
Documentation stays in sync with code
```

**Example: Adding Admin Dashboard**

```bash
ralphy execute .agent/Tasks/story-diversity-feature.md --task US-016

# Ralphy will update:
# 1. .agent/System/database_schema.md
#    - Add section for new RPC functions
#    - Document get_global_diversity_stats()
#    - Document get_most_repeated_elements()
#    - Document get_session_diversity_breakdown()
#
# 2. .agent/System/project_architecture.md
#    - Add AdminDiversityScreen to screen list
#    - Add adminDiversityAnalyticsService to service layer
#    - Update navigation diagram
#
# 3. .agent/Tasks/story-diversity-feature.md
#    - Mark US-016 as complete
#    - Add implementation notes section
#    - Update progress percentage to 100%
#
# 4. .agent/README.md (if needed)
#    - Add link to new admin dashboard documentation
```

### Manual Documentation Updates

Some documentation requires human judgment and should be updated manually:

- **Architectural Decisions**: Major design choices and trade-offs
- **Migration Guides**: When breaking changes affect existing code
- **Troubleshooting Guides**: Based on real-world debugging experiences
- **Performance Insights**: After load testing and optimization

**Best Practice**: Review Ralphy's documentation updates in PRs and refine as needed.

---

## CreativeBridge-Specific Workflows

This section covers common development scenarios in CreativeBridge and how to use Ralphy for each.

### Workflow 1: Adding a New Feature

**Scenario**: Implement user profile customization feature.

#### Step 1: Create PRD

```bash
# Create PRD in .agent/Tasks/
cat > .agent/Tasks/user-profile-customization.md << 'EOF'
---
title: User Profile Customization
priority: medium
type: feature
estimated_effort: large
---

# Overview
Allow users to customize their profile with avatar, bio, and theme preferences.

# User Stories

## US-001: Avatar Upload
- [ ] Add avatar upload to profile screen
- [ ] Store avatar in Supabase Storage
- [ ] Update users table with avatar_url column
- [ ] Display avatar in navigation header

## US-002: Bio Editor
- [ ] Add bio text field (max 280 chars)
- [ ] Add bio column to users table
- [ ] Display bio on user profile screen

## US-003: Theme Preferences
- [ ] Add theme selector (light/dark/auto)
- [ ] Store preference in users table
- [ ] Apply theme on app launch
- [ ] Sync across devices

# Technical Requirements
- Database migration for new columns
- Supabase Storage bucket configuration
- AsyncStorage for theme persistence
- Tests for all services

# Acceptance Criteria
- [ ] TypeScript compilation passes
- [ ] All tests pass (>80% coverage)
- [ ] iOS and Android compatibility verified
- [ ] Documentation updated (.agent/System/)
EOF
```

#### Step 2: Execute with Ralphy

```bash
# Execute PRD
ralphy execute .agent/Tasks/user-profile-customization.md \
  --parallel 3 \
  --model claude-sonnet-4

# Ralphy will:
# 1. Create branch: ralphy/user-profile-customization
# 2. Decompose into 12 subtasks (database, services, UI, tests)
# 3. Execute 3 tasks in parallel
# 4. Create migration: sql/add_profile_customization_columns.sql
# 5. Create services: profileCustomizationService.ts, avatarUploadService.ts
# 6. Create components: AvatarUploader.tsx, BioEditor.tsx, ThemeSelector.tsx
# 7. Update screens: ProfileScreen.tsx
# 8. Write tests: 20+ comprehensive tests
# 9. Update documentation: database_schema.md, project_architecture.md
# 10. Create PR with detailed description
```

#### Step 3: Review and Merge

```bash
# Check Ralphy's progress
ralphy status

# When complete, review PR
gh pr view

# Merge if approved
gh pr merge --squash
```

### Workflow 2: Database Schema Migration

**Scenario**: Add `reading_level` column to `stories` table.

#### Step 1: Create Migration PRD

```bash
cat > .agent/Tasks/add-reading-level-column.md << 'EOF'
---
title: Add Reading Level Column to Stories
priority: high
type: database-migration
estimated_effort: small
---

# Overview
Track reading level (Flesch-Kincaid grade) for each story to improve content recommendations.

# User Story

## US-001: Add reading_level Column
- [ ] Create migration: add_reading_level_to_stories.sql
- [ ] Add reading_level column (DECIMAL(3,1), nullable initially)
- [ ] Create index: idx_stories_reading_level
- [ ] Add RLS policy (users can read all levels)
- [ ] Update database_schema.md documentation

## US-002: Populate Existing Stories
- [ ] Create backfill function: calculate_reading_levels()
- [ ] Run backfill on existing stories
- [ ] Verify data integrity

## US-003: Update Story Service
- [ ] Modify storyCreationService to calculate reading level on save
- [ ] Add readingLevelCalculationService with Flesch-Kincaid algorithm
- [ ] Write tests for reading level calculation

# Acceptance Criteria
- [ ] Migration runs successfully on test database
- [ ] Rollback procedure documented and tested
- [ ] TypeScript types updated in src/types/database.ts
- [ ] All tests pass
EOF
```

#### Step 2: Execute Migration

```bash
ralphy execute .agent/Tasks/add-reading-level-column.md

# Ralphy will:
# 1. Create migration file with rollback procedure
# 2. Update TypeScript types
# 3. Create readingLevelCalculationService
# 4. Update storyCreationService integration
# 5. Write tests
# 6. Run migration on test DB
# 7. Update documentation
# 8. Create PR
```

### Workflow 3: Bug Fix with Root Cause Analysis

**Scenario**: Stories not saving intermittently.

#### Step 1: Document Bug

```bash
cat > .agent/Tasks/fix-story-save-intermittent-failure.md << 'EOF'
---
title: Fix Intermittent Story Save Failures
priority: critical
type: bugfix
---

# Issue
Users report stories not saving ~5% of the time. No error messages displayed.

# Symptoms
- Story appears to save (spinner shown)
- Story not in database after save completes
- No error logged in Reactotron

# Investigation Needed
- [ ] Review storyCreationService error handling
- [ ] Check Supabase RLS policies
- [ ] Analyze network failures (timeouts?)
- [ ] Review AsyncStorage race conditions

# Fix Requirements
- [ ] Identify root cause
- [ ] Implement fix
- [ ] Add retry logic if network-related
- [ ] Improve error logging
- [ ] Add user-facing error messages
- [ ] Write regression tests

# Acceptance Criteria
- [ ] Root cause documented in PR description
- [ ] Fix verified with 100+ test saves
- [ ] Regression tests prevent reoccurrence
- [ ] User-facing error messages implemented
EOF
```

#### Step 2: Execute Fix

```bash
ralphy execute .agent/Tasks/fix-story-save-intermittent-failure.md

# Ralphy will:
# 1. Analyze storyCreationService.ts
# 2. Review error handling and retry logic
# 3. Check Supabase RLS policies for edge cases
# 4. Identify root cause (e.g., missing auth token refresh)
# 5. Implement fix (e.g., add token refresh before save)
# 6. Add retry logic with exponential backoff
# 7. Improve error logging
# 8. Add user-facing error messages
# 9. Write regression tests
# 10. Document root cause in PR
```

### Workflow 4: Refactoring for Performance

**Scenario**: Story loading is slow (2-3 seconds).

#### Step 1: Profile and Document

```bash
cat > .agent/Tasks/optimize-story-loading-performance.md << 'EOF'
---
title: Optimize Story Loading Performance
priority: high
type: performance-optimization
---

# Current Performance
- Story list load: 2-3 seconds (target: <500ms)
- Individual story load: 800ms (target: <200ms)

# Profiling Needed
- [ ] Identify slow queries (use Supabase Dashboard)
- [ ] Analyze React Native performance (Reactotron)
- [ ] Check network waterfall (React Native Debugger)

# Optimization Strategies
- [ ] Add database indexes for common queries
- [ ] Implement pagination (currently loading all stories)
- [ ] Add LRU cache for frequently accessed stories
- [ ] Use React.memo for list items
- [ ] Implement virtual list (react-native-virtualized-view)

# Acceptance Criteria
- [ ] Story list load: <500ms (p95)
- [ ] Individual story load: <200ms (p95)
- [ ] Performance tests added
- [ ] No regressions in functionality
EOF
```

#### Step 2: Execute Optimization

```bash
ralphy execute .agent/Tasks/optimize-story-loading-performance.md \
  --parallel 2

# Ralphy will:
# 1. Profile performance (identify bottlenecks)
# 2. Add database indexes (e.g., idx_stories_user_id_created_at)
# 3. Implement pagination in storyService
# 4. Add LRU cache for stories
# 5. Update UI with React.memo and virtualized list
# 6. Write performance tests
# 7. Verify <500ms p95 achieved
# 8. Create PR with before/after metrics
```

### Workflow 5: Integration Testing

**Scenario**: Test end-to-end story creation flow.

#### Step 1: Define Test PRD

```bash
cat > .agent/Tasks/e2e-story-creation-test.md << 'EOF'
---
title: End-to-End Story Creation Test Suite
priority: medium
type: testing
---

# Overview
Comprehensive integration tests for story creation flow covering:
- User authentication
- Story initiation
- AI agent selection
- Collaborative writing (user + AI turns)
- Image generation
- Story completion
- Diversity tracking

# Test Scenarios

## Happy Path Tests
- [ ] Complete story creation (5 turns, success)
- [ ] Story with image generation (success)
- [ ] Story with diversity guidance (success)

## Error Handling Tests
- [ ] Story creation with API timeout (retry succeeds)
- [ ] Story creation with auth failure (graceful error)
- [ ] Image generation failure (fallback to text-only)

## Edge Case Tests
- [ ] Very long story (500+ paragraphs)
- [ ] Special characters in story text
- [ ] Rapid successive saves (race condition)

# Acceptance Criteria
- [ ] 15+ integration tests
- [ ] Tests use real Supabase test environment
- [ ] Tests clean up after themselves (no test data pollution)
- [ ] Tests run in CI/CD pipeline
EOF
```

#### Step 2: Execute Test Implementation

```bash
ralphy execute .agent/Tasks/e2e-story-creation-test.md

# Ralphy will:
# 1. Create test file: src/__tests__/integration/storyCreation.e2e.test.ts
# 2. Set up Supabase test environment
# 3. Write 15+ integration tests
# 4. Add test utilities for setup/teardown
# 5. Configure Jest for integration tests
# 6. Add to CI/CD pipeline (.github/workflows/test.yml)
# 7. Verify all tests pass
```

---

## Best Practices

### 1. PRD Writing for Ralphy

**Good PRD Structure:**

```markdown
---
title: Clear, Descriptive Title
priority: high | medium | low
type: feature | bugfix | database-migration | testing | performance-optimization
estimated_effort: small | medium | large
---

# Overview

Brief 2-3 sentence summary of what and why.

# User Stories

## US-001: Descriptive Name

- [ ] Specific, actionable acceptance criteria
- [ ] Testable outcomes
- [ ] Clear definition of done

# Technical Requirements

- Database changes (if any)
- Service layer changes
- UI/component changes
- Testing requirements

# Acceptance Criteria

- [ ] TypeScript compilation passes
- [ ] All tests pass (>80% coverage)
- [ ] Documentation updated
- [ ] iOS and Android verified
```

**Bad PRD Structure:**

```markdown
# Do This Thing

Make it work better.

Test it.
```

**Why Good PRDs Matter:**

- ✅ Ralphy decomposes tasks based on acceptance criteria
- ✅ Clear criteria = fewer ambiguous decisions
- ✅ Testable outcomes = automated validation
- ✅ Structured format = better AI understanding

### 2. Task Granularity

**Optimal Task Size:**

- **Too Small**: "Add comma to line 42" (overhead > value)
- **Too Large**: "Rebuild entire app in Vue.js" (too complex for autonomous execution)
- **Just Right**: "Add bio field to user profile with validation" (1-3 hours of work)

**Rule of Thumb:**

One user story = 1-4 hours of work = 3-8 subtasks

**Example: Good Granularity**

```markdown
## US-001: Add Bio Field

- [ ] Add bio column to users table (migration)
- [ ] Create bioValidationService (max 280 chars)
- [ ] Add BioEditor component to ProfileScreen
- [ ] Write tests (validation, UI interaction)
```

This decomposes into ~4 subtasks, each ~30-60 minutes.

### 3. Parallel Execution Strategy

Ralphy can execute tasks in parallel, but dependencies matter.

**Parallelizable Tasks:**

```markdown
## US-001: Add Avatar Upload

## US-002: Add Bio Editor

## US-003: Add Theme Selector
```

These are independent and can run in parallel:

```bash
ralphy execute .agent/Tasks/profile-customization.md --parallel 3
```

**Sequential Tasks (Dependencies):**

```markdown
## US-001: Create Database Migration

## US-002: Create Service (depends on US-001 schema)

## US-003: Create UI Component (depends on US-002 service)
```

These must run sequentially:

```bash
ralphy execute .agent/Tasks/sequential-feature.md --parallel 1
```

**Mixed Dependencies:**

```markdown
## US-001: Create Database Migration

## US-002: Create Service A (depends on US-001)

## US-003: Create Service B (depends on US-001, independent of US-002)

## US-004: Create UI Component (depends on US-002, US-003)
```

Ralphy automatically detects dependencies and parallelizes safely:

```bash
ralphy execute .agent/Tasks/mixed-dependencies.md --parallel 3

# Execution plan:
# Phase 1: US-001 (sequential, blocking)
# Phase 2: US-002, US-003 (parallel, depends on US-001)
# Phase 3: US-004 (sequential, depends on US-002, US-003)
```

### 4. Quality Gate Configuration

Ralphy runs quality gates after each task. Configure thresholds:

```yaml
# .agent/Ralphy/config.yaml
commands:
  test: 'npm test -- --coverage --coverageThreshold=''{"global":{"lines":80}}'''
  lint: 'npm run lint -- --max-warnings 0'
  typecheck: 'npx tsc --noEmit --strict'
```

**Recommended Quality Gates for CreativeBridge:**

- ✅ **TypeScript**: Zero compilation errors (strict mode)
- ✅ **ESLint**: Zero warnings (enforce with `--max-warnings 0`)
- ✅ **Jest**: 80%+ coverage on new code
- ⚠️ **Build**: Optional (slow, not critical for every task)

**When to Relax Quality Gates:**

- Prototyping (use `--skip-tests` flag)
- Emergency hotfixes (prioritize speed, manual testing)
- Documentation-only changes (skip tests)

**Never Relax:**

- TypeScript compilation (type safety is critical)
- Security checks (e.g., credential scanning)

### 5. Documentation Hygiene

Ralphy automates documentation, but human review ensures quality.

**After Each Ralphy PR:**

1. **Review Documentation Diffs**: Check `.agent/` files in PR
2. **Refine AI-Generated Docs**: Add human insights
3. **Update .agent/README.md**: Keep index current
4. **Archive Completed PRDs**: Move to `.agent/Ralph/archive/` if needed

**Documentation Checklist:**

- [ ] Database schema updated (if schema changed)
- [ ] Architecture docs updated (if new services added)
- [ ] SOP updated (if new procedures introduced)
- [ ] PRD marked complete (acceptance criteria checked)
- [ ] README index reflects new content

### 6. Error Recovery

Ralphy may encounter errors during execution:

**Common Errors:**

1. **Quality Gate Failures**: TypeScript/ESLint/Jest failures
2. **API Rate Limits**: Claude/OpenAI API throttling
3. **Dependency Issues**: npm/pod install failures
4. **Git Conflicts**: Merge conflicts with main branch

**Recovery Strategies:**

```bash
# 1. Quality Gate Failure
ralphy status
# Review last task that failed
# Fix manually if needed
ralphy resume

# 2. API Rate Limit
ralphy pause
# Wait for rate limit reset (usually 1 minute)
ralphy resume

# 3. Dependency Issue
# Fix package.json or Podfile manually
npm install
ralphy resume

# 4. Git Conflict
git fetch origin main
git rebase origin/main
# Resolve conflicts
ralphy resume
```

**When to Rollback:**

If a task is fundamentally wrong (wrong approach, breaks existing functionality):

```bash
ralphy rollback US-003
# Reverts changes from US-003
# Keeps US-001, US-002 intact
```

### 7. Monitoring and Logging

Ralphy logs all operations to `.agent/Ralphy/progress.txt`.

**Log Structure:**

```
[2026-01-22 10:30:15] Started execution: admin-diversity-dashboard
[2026-01-22 10:30:20] Created branch: ralphy/admin-diversity-dashboard
[2026-01-22 10:30:25] Task US-016-1: Create SQL RPC functions (IN_PROGRESS)
[2026-01-22 10:35:42] Task US-016-1: Completed (TypeCheck: ✓, Lint: ✓, Test: ✓)
[2026-01-22 10:35:45] Task US-016-2: Create adminDiversityAnalyticsService (IN_PROGRESS)
...
```

**Monitoring Best Practices:**

- **Real-time Monitoring**: Use `ralphy status` or `tail -f .agent/Ralphy/progress.txt`
- **Post-Execution Review**: Check progress.txt for warnings or errors
- **Performance Tracking**: Note task durations for estimation
- **Error Patterns**: Identify recurring issues (e.g., flaky tests)

**Integration with Existing Tools:**

Ralphy logs are plain text, integrate with:

- **Slack**: Post progress updates to dev channel
- **GitHub Actions**: Surface in CI/CD pipeline
- **Notion/Jira**: Sync task completion status

---

## Troubleshooting

### Issue 1: Ralphy Stuck on Task

**Symptoms:**

```bash
ralphy status
# Output:
# Task US-003: Creating component (IN_PROGRESS)
# Duration: 45 minutes (expected: 10 minutes)
```

**Causes:**

- API rate limiting (Claude/OpenAI throttling)
- Complex task requiring more context
- Infinite loop in code generation

**Solutions:**

```bash
# 1. Check logs
cat .agent/Ralphy/progress.txt | tail -n 50

# 2. Check for rate limit errors
# Look for: "Error: Rate limit exceeded"

# 3. Pause and resume (resets API context)
ralphy pause
sleep 60  # Wait 1 minute
ralphy resume

# 4. If still stuck, rollback and retry
ralphy rollback US-003
ralphy execute .agent/Tasks/feature.md --task US-003 --model claude-sonnet-4
```

### Issue 2: Quality Gates Failing

**Symptoms:**

```bash
ralphy status
# Output:
# Task US-005: FAILED (TypeCheck: ✗)
# Error: src/services/newService.ts:42:15 - error TS2345: Type 'string' is not assignable to type 'number'
```

**Solutions:**

```bash
# 1. Review error in logs
cat .agent/Ralphy/progress.txt | grep "ERROR"

# 2. Fix manually
code src/services/newService.ts
# Fix type error at line 42

# 3. Verify fix locally
npx tsc --noEmit

# 4. Commit fix
git add src/services/newService.ts
git commit -m "fix: TypeScript error in newService"

# 5. Resume Ralphy
ralphy resume
```

### Issue 3: Ralphy Generated Incorrect Code

**Symptoms:**

Code compiles and tests pass, but logic is wrong (e.g., wrong algorithm, incorrect business logic).

**Solutions:**

```bash
# 1. Identify problematic task
ralphy status  # Find task ID

# 2. Rollback task
ralphy rollback US-007

# 3. Review PRD for clarity
nano .agent/Tasks/feature.md
# Make acceptance criteria more specific

# 4. Re-run with more explicit guidance
ralphy execute .agent/Tasks/feature.md --task US-007
```

**Prevention:**

- Write specific acceptance criteria in PRD
- Include examples of expected behavior
- Reference existing code patterns to follow

### Issue 4: Documentation Not Updated

**Symptoms:**

Ralphy completed feature but `.agent/System/database_schema.md` not updated.

**Solutions:**

```bash
# 1. Manually run documentation update
ralphy docs

# 2. If still not updated, check rules
cat .agent/Ralphy/config.yaml | grep -A 5 "Documentation"

# 3. Ensure rule exists:
# "Update .agent/System/database_schema.md for schema changes"

# 4. If rule missing, add it
nano .agent/Ralphy/config.yaml
# Add rule under `rules:` section

# 5. Update documentation manually this time
nano .agent/System/database_schema.md
# Document changes

# 6. Commit documentation
git add .agent/System/database_schema.md
git commit -m "docs: Update database schema with new tables"
```

### Issue 5: Git Conflicts During Execution

**Symptoms:**

```bash
ralphy status
# Output:
# Error: Merge conflict with origin/main
# File: src/services/storyService.ts
```

**Solutions:**

```bash
# 1. Pause Ralphy
ralphy pause

# 2. Fetch latest main
git fetch origin main

# 3. Rebase onto main
git rebase origin/main

# 4. Resolve conflicts
# Open conflicted files, resolve manually
git add src/services/storyService.ts
git rebase --continue

# 5. Resume Ralphy
ralphy resume
```

**Prevention:**

- Rebase on main before starting large features
- Keep feature branches short-lived (<3 days)
- Merge main into feature branch daily

### Issue 6: API Key Issues

**Symptoms:**

```bash
# Ralphy fails immediately with:
Error: ANTHROPIC_API_KEY not found
```

**Solutions:**

```bash
# 1. Check .env file exists
ls -la .agent/Ralph/ralphy-source/.env

# 2. If missing, create it
cp .agent/Ralph/ralphy-source/.env.example .agent/Ralph/ralphy-source/.env

# 3. Add API key
nano .agent/Ralph/ralphy-source/.env
# Add: ANTHROPIC_API_KEY=your_key_here

# 4. Verify key is valid
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-sonnet-4","messages":[{"role":"user","content":"test"}],"max_tokens":10}'

# Should return JSON response (not 401)

# 5. Retry Ralphy
ralphy execute .agent/Tasks/feature.md
```

### Issue 7: Ralphy Not Respecting Boundaries

**Symptoms:**

Ralphy modified `.env` or other bounded files.

**Solutions:**

```bash
# 1. Revert changes
git checkout .env

# 2. Check boundaries configuration
cat .agent/Ralphy/config.yaml | grep -A 10 "boundaries"

# 3. Ensure .env is listed
boundaries:
  never_touch:
    - ".env*"

# 4. If missing, add it
nano .agent/Ralphy/config.yaml

# 5. Report issue to Ralphy maintainers
# (Boundaries should be enforced, this is a bug)
```

---

## Migration from Ralph

This section is for developers familiar with the legacy Ralph system who need to adapt to Ralphy.

### Key Changes Summary

| Aspect                | Ralph                           | Ralphy                          |
| --------------------- | ------------------------------- | ------------------------------- |
| **PRD Format**        | `prd.json` (custom JSON)        | Markdown with YAML frontmatter  |
| **Progress Tracking** | `progress.txt` (manual entries) | `progress.txt` (auto-generated) |
| **Task Execution**    | Manual, sequential              | Automated, parallel             |
| **Quality Gates**     | Manual checks                   | Automated validation            |
| **Branch Management** | Manual `git checkout -b`        | Automated branch creation       |
| **Documentation**     | Manual updates                  | Automated updates               |

### Converting Ralph PRDs to Ralphy Format

**Ralph PRD (prd.json):**

```json
{
  "feature": "Story Diversity System",
  "userStories": [
    {
      "id": "US-001",
      "title": "Database Schema",
      "acceptanceCriteria": [
        "Create story_elements table",
        "Add RLS policies",
        "Create indexes"
      ],
      "status": "completed"
    }
  ]
}
```

**Ralphy PRD (story-diversity-feature.md):**

```markdown
---
title: Story Diversity System
priority: high
type: feature
---

# Overview

Comprehensive tracking to reduce story element repetition.

# User Stories

## US-001: Database Schema

- [ ] Create story_elements table
- [ ] Add RLS policies
- [ ] Create indexes
```

**Conversion Script:**

```bash
# Convert Ralph prd.json to Ralphy markdown
python3 scripts/convert-ralph-to-ralphy.py \
  .agent/Ralph/archive/feature/prd.json \
  .agent/Tasks/feature.md
```

### Workflow Migration

**Ralph Workflow:**

```bash
# 1. Create prd.json
nano .agent/Ralph/prd.json

# 2. Manually implement
code src/services/newService.ts

# 3. Manually test
npm test

# 4. Manually log progress
echo "US-001 completed" >> .agent/Ralph/progress.txt

# 5. Manually commit
git add .
git commit -m "feat: Add new service"

# 6. Repeat for each user story
```

**Ralphy Workflow:**

```bash
# 1. Create PRD
nano .agent/Tasks/feature.md

# 2. Run Ralphy
ralphy execute .agent/Tasks/feature.md

# Done! Ralphy handles:
# - Implementation
# - Testing
# - Progress logging
# - Commits
# - PR creation
```

### Preserving Ralph Learnings

All Ralph learnings are encoded in `.agent/Ralphy/config.yaml`:

**Ralph Learning Example:**

```
# From .agent/Ralph/progress.txt (US-003 implementation)
Learned: Always use exponential backoff for API retries.
Pattern: retry 3 times with delays: 1s, 2s, 4s
Reason: Prevents thundering herd, respects rate limits
```

**Encoded in Ralphy:**

```yaml
# .agent/Ralphy/config.yaml
rules:
  - 'Error handling: exponential backoff retry logic with 3 attempts (1s, 2s, 4s delays)'
  - 'Never retry on authentication/authorization errors (fail fast with clear error messages)'
```

**How to Add New Learnings:**

After completing a feature under Ralphy, extract learnings:

```bash
# 1. Review Ralphy's progress.txt
cat .agent/Ralphy/progress.txt

# 2. Identify new patterns or learnings
# Example: "Using React.memo for list items improved performance 40%"

# 3. Add to config.yaml rules
nano .agent/Ralphy/config.yaml

# Add under rules:
rules:
  - "React Native: Always use React.memo for list item components (40% performance boost)"

# 4. Commit config update
git add .agent/Ralphy/config.yaml
git commit -m "docs: Add React.memo performance learning to Ralphy config"
```

### Ralph Archives

All Ralph historical data is preserved in `.agent/Ralph/archive/`:

```bash
# View Ralph archives
ls -la .agent/Ralph/archive/

# Example archives:
# - 2026-01-13-image-generation-quality/
# - 2026-01-20-story-diversity-migration/

# Each archive contains:
# - prd.json (original PRD)
# - progress.txt (detailed implementation logs)
# - MIGRATION_NOTES.md (migration context)
# - .last-branch (branch reference)
```

**Ralph archives are read-only.** Ralphy may reference them for context but never modifies them.

**Accessing Ralph Context:**

```bash
# Read Ralph's diversity feature learnings
cat .agent/Ralph/archive/2026-01-20-story-diversity-migration/progress.txt

# Contains 15 iterations of detailed learnings:
# - Iteration 1: Database schema decisions
# - Iteration 2: Embedding service patterns
# - ...
# - Iteration 15: Performance monitoring
```

---

## Advanced Topics

### Custom AI Models

Ralphy supports multiple AI models for different tasks:

```bash
# Use Claude Opus for complex architectural tasks
ralphy execute .agent/Tasks/architecture-refactor.md \
  --model claude-opus-4

# Use Claude Haiku for simple bug fixes (faster, cheaper)
ralphy execute .agent/Tasks/simple-bugfix.md \
  --model claude-haiku

# Use GPT-4 as fallback
ralphy execute .agent/Tasks/feature.md \
  --model gpt-4 \
  --fallback claude-sonnet-4
```

**Model Selection Guide:**

| Task Type              | Recommended Model | Reason                             |
| ---------------------- | ----------------- | ---------------------------------- |
| Architecture Design    | Claude Opus 4     | Deep reasoning, handles complexity |
| Feature Implementation | Claude Sonnet 4   | Balanced speed/quality             |
| Bug Fixes              | Claude Haiku      | Fast, cost-effective               |
| Documentation          | Claude Sonnet 4   | Good at structured writing         |
| Testing                | Claude Haiku      | Repetitive, pattern-based          |

### Multi-Agent Orchestration

For very large features, Ralphy can orchestrate multiple AI agents:

```bash
# Example: Large feature with 20+ user stories
ralphy execute .agent/Tasks/massive-feature.md \
  --parallel 5 \
  --agent-pool 3

# Ralphy will:
# - Spawn 3 AI agents (each with separate context)
# - Distribute tasks across agents
# - Execute up to 5 tasks in parallel
# - Coordinate dependencies between agents
```

**When to Use Multi-Agent:**

- Features with 15+ independent user stories
- Large refactorings across many files
- Parallel workstreams (frontend + backend + testing)

**Trade-offs:**

- ✅ Faster completion (3x speedup with 3 agents)
- ⚠️ Higher API costs (3x calls)
- ⚠️ More coordination complexity

### Custom Quality Gates

Add custom quality gates beyond TypeScript/ESLint/Jest:

```yaml
# .agent/Ralphy/config.yaml
commands:
  test: 'npm test'
  lint: 'npm run lint'
  typecheck: 'npx tsc --noEmit'

  # Custom gates
  security_scan: 'npm audit --audit-level=moderate'
  bundle_size: 'npm run bundle-size-check'
  accessibility: 'npm run a11y-check'
```

Ralphy will run all commands after each task. Failures block progress.

### Integration with CI/CD

Ralphy can run in CI/CD pipelines for automated feature development:

```yaml
# .github/workflows/ralphy-automation.yml
name: Ralphy Automation

on:
  push:
    branches:
      - main
  schedule:
    - cron: '0 0 * * *' # Daily at midnight

jobs:
  execute-prd:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Ralphy
        run: |
          cd .agent/Ralph/
          git clone https://github.com/michaelshimeles/ralphy.git ralphy-source
          cd ralphy-source && npm install

      - name: Execute PRD
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          .agent/Ralph/ralphy-source/bin/ralphy execute \
            .agent/Tasks/scheduled-feature.md \
            --parallel 3

      - name: Create PR
        run: gh pr create --fill
```

**Use Cases:**

- **Nightly feature development**: Execute low-priority PRDs overnight
- **Automated bug fixes**: Trigger Ralphy on new bug reports
- **Documentation updates**: Keep docs in sync with code changes

---

## FAQ

### Q: Can Ralphy replace human developers?

**A:** No. Ralphy is a tool that automates repetitive tasks and accelerates feature development, but human judgment is essential for:

- Architectural decisions and trade-offs
- User experience design
- Business logic validation
- Code review and quality assessment
- Strategic planning

Ralphy handles "how to implement" given clear requirements. Humans decide "what to build" and "why."

### Q: How much does Ralphy cost (API usage)?

**A:** Ralphy uses Claude/OpenAI APIs. Typical costs for CreativeBridge:

| Task Type                       | API Calls  | Cost (Claude Sonnet 4) |
| ------------------------------- | ---------- | ---------------------- |
| Small feature (3 user stories)  | ~50 calls  | ~$5-10                 |
| Medium feature (8 user stories) | ~150 calls | ~$20-30                |
| Large feature (15 user stories) | ~300 calls | ~$50-80                |

**Cost optimization:**

- Use Haiku for simple tasks (~70% cheaper)
- Enable caching in config.yaml
- Run low-priority tasks overnight (off-peak)

### Q: Can Ralphy work offline?

**A:** No. Ralphy requires internet access for:

- AI API calls (Claude/OpenAI)
- Git operations (fetch, push)
- npm/CocoaPods package downloads

For offline development, continue using traditional IDE + manual testing.

### Q: How do I debug Ralphy-generated code?

**A:** Same as manually written code:

```bash
# 1. Read the code
code src/services/ralphyGeneratedService.ts

# 2. Add console.logs or breakpoints
console.log('Debug:', value);

# 3. Run tests
npm test -- ralphyGeneratedService.test.ts

# 4. Use Reactotron for React Native debugging
# (Ralphy code integrates with existing debugging tools)
```

Ralphy-generated code follows CreativeBridge patterns, so debugging is familiar.

### Q: What if Ralphy breaks something?

**A:** Rollback and recover:

```bash
# 1. Identify breaking task
ralphy status

# 2. Rollback
ralphy rollback US-005

# 3. Verify rollback
npm test  # Should pass

# 4. Investigate issue
cat .agent/Ralphy/progress.txt | grep US-005

# 5. Fix PRD and retry
nano .agent/Tasks/feature.md
ralphy execute .agent/Tasks/feature.md --task US-005
```

All Ralphy changes are in Git, so `git revert` also works.

### Q: Can I use Ralphy with other AI assistants (e.g., GitHub Copilot)?

**A:** Yes! Ralphy complements other AI tools:

- **GitHub Copilot**: Autocomplete within your IDE while writing code
- **Ralphy**: Autonomous feature implementation from PRD
- **Claude Code (this CLI)**: Interactive chat-based assistance

Use them together:

1. Use Ralphy for initial implementation
2. Use Copilot for refinements and edge cases
3. Use Claude Code CLI for debugging and optimization

### Q: How do I update Ralphy?

**A:** Pull latest from GitHub:

```bash
cd .agent/Ralph/ralphy-source
git pull origin main
npm install

# Verify version
.agent/Ralph/ralphy-source/bin/ralphy --version
```

Check [Ralphy releases](https://github.com/michaelshimeles/ralphy/releases) for breaking changes.

---

## Resources

### Official Links

- **Ralphy GitHub**: https://github.com/michaelshimeles/ralphy
- **Ralphy Documentation**: https://ralphy.dev/docs
- **Ralphy Discord**: https://discord.gg/ralphy
- **Ralphy Twitter**: https://twitter.com/ralphy_dev

### CreativeBridge-Specific

- **Ralph Archives**: `.agent/Ralph/archive/` (read-only reference)
- **Ralphy Config**: `.agent/Ralphy/config.yaml`
- **Integration Docs**: This file (`.agent/Ralph/README.md`)
- **Task Examples**: `.agent/Tasks/*.md`

### Learning Resources

- **Ralphy Quickstart**: https://ralphy.dev/quickstart
- **AI Agent Orchestration Concepts**: https://ralphy.dev/concepts
- **Best Practices Guide**: https://ralphy.dev/best-practices
- **CreativeBridge Project Docs**: `.agent/README.md`

---

## Support

### Getting Help

**For Ralphy Issues:**

1. Check [Ralphy documentation](https://ralphy.dev/docs)
2. Search [Ralphy GitHub issues](https://github.com/michaelshimeles/ralphy/issues)
3. Ask in [Ralphy Discord](https://discord.gg/ralphy)
4. File new issue on GitHub

**For CreativeBridge-Specific Issues:**

1. Check `.agent/SOP/development_procedures.md`
2. Review `.agent/System/project_architecture.md`
3. Consult `.agent/Ralph/archive/` for historical context
4. Ask in team Slack channel

### Contributing to This Documentation

Improve this documentation:

```bash
# 1. Make changes
nano .agent/Ralph/README.md

# 2. Commit
git add .agent/Ralph/README.md
git commit -m "docs: Improve Ralphy integration docs"

# 3. Push and create PR
git push origin feature/improve-ralphy-docs
gh pr create --fill
```

---

## Changelog

### Version 1.0 (2026-01-22)

- ✅ Initial Ralphy integration documentation
- ✅ Migration guide from Ralph
- ✅ CreativeBridge-specific workflows
- ✅ Configuration reference
- ✅ Troubleshooting guide
- ✅ Best practices
- ✅ FAQ

### Future Additions

- [ ] Video tutorials for common workflows
- [ ] Advanced multi-agent orchestration examples
- [ ] CI/CD integration templates
- [ ] Performance benchmarks
- [ ] Team collaboration workflows

---

**Maintained by**: CreativeBridge Development Team
**Last Updated**: 2026-01-22
**Ralphy Version**: 4.3.0
**Status**: Active

---

_"Ralph taught us systematic development. Ralphy scales it."_
