# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation

Before starting any task, read `.claude/.agent/README.md` for context. All important documentation lives in `.claude/.agent/` (Tasks/, System/, SOP/). Always update `.claude/.agent/` docs after implementing features.

## Environment Setup

- Copy `.env.example` to `.env` and fill in API keys (Convex, Supabase, OpenAI, Replicate)
- `.npmrc` has `legacy-peer-deps=true` — required for dependency installation
- Convex dev deployment: run `npx convex dev` alongside Metro

## Quick Commands

```bash
npm start                    # Start Expo/Metro bundler
npm run ios                  # Run on iOS simulator
npm run android              # Run on Android emulator
npx convex dev               # Start Convex dev server (run alongside Metro)
npm test                     # Run all tests
npm run lint                 # ESLint (warnings only, won't fail build)
```

## Tech Stack

React Native 0.81.5 + Expo 54 + TypeScript 5.8 | Convex (primary backend, OAuth/Clerk) + Supabase (fallback, legacy users) | OpenAI GPT-4 (stories) + Replicate SD 3.5 (images) + Claude Skills SDK | Clerk OAuth > Convex JWT | React Navigation v7

## Path Aliases

`@/*` maps to `src/*` (defined in `tsconfig.json`)

## Grade Level System

Content adapts across four levels (K-2, 3-5, 6-8, 9-12): vocabulary complexity, art style (watercolor > sophisticated), and prompt difficulty.

## Code Quality

- **Pre-commit hooks**: Husky + lint-staged runs Prettier and ESLint on staged files
- **ESLint**: All rules configured as warnings (not errors) to allow autonomous agent workflows

## CI/CD

- **PR Code Review**: GitHub Actions runs automated Claude code review (`.github/workflows/claude-code-review.yml`)
- **Interactive Claude**: Mention `@claude` in PR comments or issues (`.github/workflows/claude.yml`)
- **EAS Build**: Version source is `remote` (EAS-managed). Three profiles: development, preview, production.

## Directory Context

Each major directory has its own CLAUDE.md with area-specific guidance:

- `src/CLAUDE.md` — Frontend architecture, auth flow, database strategy, component organization
- `src/services/CLAUDE.md` — Service patterns, error handling, categorized service catalog
- `src/__tests__/CLAUDE.md` — Test commands, Jest config, mock setup, directory structure
- `convex/CLAUDE.md` — Backend commands, auth patterns, key tables
- `scripts/CLAUDE.md` — Build, deploy, monitoring commands and scripts
- `e2e/CLAUDE.md` — E2E testing with Detox, commands and conventions
