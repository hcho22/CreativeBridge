# E2E Tests (`e2e/`)

See `e2e/README.md` for full E2E testing documentation, helper functions, and test suite details.

## Detox Commands

```bash
npx detox build -c ios.sim.debug     # Build for iOS simulator
npx detox test -c ios.sim.debug      # Run E2E tests on iOS simulator
npx detox build -c android.emu.debug # Build for Android emulator
npx detox test -c android.emu.debug  # Run E2E tests on Android emulator
```

## Conventions

- Add `testID` props to components for E2E targeting (kebab-case, e.g., `testID="story-card"`)
- Test helpers in `helpers/testHelpers.ts` (waitForElement, tapByTestID, startNewStory, etc.)
