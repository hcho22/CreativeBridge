# Tests (`src/__tests__/`)

## Commands

```bash
npm test                                              # Run all tests
npm test -- --watch                                   # Watch mode
npm test -- --testPathPattern=services/imageGeneration # Single file
npm run test:coverage                                 # Coverage report
npm run test:unit                                     # Unit tests only
npm run test:integration                              # Integration tests only
npm run test:image-generation                         # Image generation tests
npm run test:claude-skills                            # Claude Skills tests
```

## Jest Configuration

- Preset: `react-native`
- Coverage threshold: **70%** (branches, functions, lines, statements)
- Test flag: Set `DISABLE_XP_COSTS_FOR_TESTING=true` in `.env` to bypass XP cost checks

## Setup Files

- `setup.ts` - Global mocks for React Native modules (Platform, Dimensions, Alert, Linking)
- `setupAfterEnv.ts` - Comprehensive mocks for Clerk, Supabase, AsyncStorage, React Navigation, and RN modules

## Mock Locations

- `__mocks__/` - Module-level mocks (e.g., `@react-native-async-storage/`)
- `mocks/` - Custom test utilities and shared mock helpers

## Test Directory Structure

| Directory        | Purpose                                                               |
| ---------------- | --------------------------------------------------------------------- |
| `services/`      | Service unit tests                                                    |
| `integration/`   | Cross-service integration tests (convexFlows, xpSystem, claudeSkills) |
| `components/`    | Component unit tests                                                  |
| `screens/`       | Screen component tests                                                |
| `features/`      | Feature-level tests (imageGenerationXP, xpBalance)                    |
| `acceptance/`    | User acceptance tests                                                 |
| `accessibility/` | a11y compliance tests                                                 |
| `performance/`   | Performance benchmarks                                                |
| `security/`      | Security vulnerability tests                                          |
| `privacy/`       | Privacy compliance tests (COPPA)                                      |
| `bugfixes/`      | Regression tests for fixed bugs                                       |

## Naming Convention

- Unit tests: `*.test.ts` or `*.test.tsx`
- Integration tests: `*.integration.test.ts`
