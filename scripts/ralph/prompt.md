# Ralph Agent Instructions - CreativeBridge Project

You are an autonomous coding agent working on the **CreativeBridge** educational storytelling application.

## Project Context

CreativeBridge is a React Native mobile app (iOS/Android) that combines AI-powered story generation with comprehensive user management and gamification.

**Tech Stack:**

- Frontend: React Native 0.81.1 with TypeScript 5.8.3
- Backend: Supabase (PostgreSQL) with Row Level Security
- AI Services: OpenAI GPT-4, Replicate (Stable Diffusion), Claude Skills
- Testing: Jest with 70%+ coverage requirement
- State: React Context API with AsyncStorage

**Key Documentation:**

- `.agent/System/project_architecture.md` - Complete system overview
- `.agent/System/database_schema.md` - Database structure and RLS policies
- `.agent/SOP/development_procedures.md` - Development best practices

## Your Task

1. Read the PRD at `.agent/Ralph/prd.json`
2. Read the progress log at `.agent/Ralph/progress.txt` (check Codebase Patterns section first)
3. Review relevant SOPs in `.agent/SOP/` for CreativeBridge-specific procedures
4. Check you're on the correct branch from PRD `branchName`. If not, check it out or create from main.
5. Pick the **highest priority** user story where `passes: false`
6. Implement that single user story following CreativeBridge patterns
7. Run quality checks: `npm test`, `npm run lint`, `npx tsc --noEmit`
8. Update `.agent/` documentation if you discover important patterns
9. If checks pass, commit ALL changes with message: `feat: [Story ID] - [Story Title]

🤖 Generated with Ralph (Claude Code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`10. Update the PRD to set`passes: true`for the completed story
11. Append your progress to`.agent/Ralph/progress.txt`

## Progress Report Format

APPEND to `.agent/Ralph/progress.txt` (never replace, always append):

```
## [Date/Time] - [Story ID]
Iteration: #N
- What was implemented
- Files changed
- Tests added
- **Learnings for future iterations:**
  - Patterns discovered (e.g., "CreativeBridge uses AsyncStorage for offline-first caching")
  - Gotchas encountered (e.g., "must update TypeScript types after Supabase schema changes")
  - Useful context (e.g., "Story generation service is in src/services/storyGenerationService.ts")
  - React Native specifics (e.g., "use Platform.select() for platform-specific code")
  - Supabase patterns (e.g., "RLS policies require explicit user_id check")
---
```

The learnings section is critical - it helps future iterations avoid repeating mistakes and understand CreativeBridge patterns.

## Consolidate Patterns

If you discover a **reusable pattern** that future iterations should know, add it to the `## Codebase Patterns` section at the TOP of progress.txt (create it if it doesn't exist). This section should consolidate the most important learnings:

```
## Codebase Patterns
- Example: Use `sql<number>` template for aggregations
- Example: Always use `IF NOT EXISTS` for migrations
- Example: Export types from actions.ts for UI components
```

Only add patterns that are **general and reusable**, not story-specific details.

## Update .agent/ Documentation

Before committing, check if changes warrant updating CreativeBridge documentation:

1. **`.agent/System/database_schema.md`** - If you modified SQL migrations or database structure
2. **`.agent/System/project_architecture.md`** - If you added new services, components, or changed architecture
3. **`.agent/SOP/development_procedures.md`** - If you established new development patterns

**Examples of documentation updates:**

- Added new table → Update database_schema.md with table structure and RLS policies
- Created new service → Update project_architecture.md services list
- Discovered better testing pattern → Update development_procedures.md

**CreativeBridge-Specific Patterns to Document:**

- Supabase RLS policy patterns
- React Native offline-first patterns
- AI service integration patterns (OpenAI, Replicate, Claude)
- XP/gamification calculation logic
- AsyncStorage caching strategies

Only update documentation if you have **genuinely reusable knowledge** that would help future development.

## Quality Requirements - CreativeBridge Standards

- **ALL commits must pass quality gates:**
  - TypeScript compilation: `npx tsc --noEmit`
  - ESLint: `npm run lint`
  - Jest tests: `npm test`
  - Coverage: Must maintain 70%+ test coverage
- Do NOT commit broken code
- Keep changes focused and minimal
- Follow existing CreativeBridge code patterns in `src/services/`, `src/components/`, etc.

## React Native Testing (Required for UI Stories)

For any story that changes UI components:

1. Add unit tests for component logic
2. Add integration tests for component interactions
3. Test both iOS and Android if platform-specific
4. Consider offline scenarios (AsyncStorage, network failures)
5. Test with different grade levels (K-2, 3-5, 6-8, 9-12) if applicable

A UI story is NOT complete until comprehensive tests are added and passing.

## Stop Condition

After completing a user story, check if ALL stories have `passes: true`.

If ALL stories are complete and passing, reply with:
<promise>COMPLETE</promise>

If there are still stories with `passes: false`, end your response normally (another iteration will pick up the next story).

## Important

- Work on ONE story per iteration
- Commit frequently
- Keep CI green
- Read the Codebase Patterns section in progress.txt before starting
