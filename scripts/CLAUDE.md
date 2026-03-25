# Scripts (`scripts/`)

## Build Commands

```bash
npm run prebuild             # Generate native projects (after dependency changes)
npm run prebuild:clean       # Clean rebuild of native projects
cd ios && pod install        # Install iOS dependencies (after prebuild)
npm run eas:build:ios        # EAS Build for iOS
npm run eas:build:android    # EAS Build for Android
npm run eas:submit:testflight # Submit to TestFlight
```

## EAS Build Configuration

- Version source: `remote` (EAS-managed, auto-increments for production)
- Three profiles: `development`, `preview`, `production`

## Deployment Scripts

- `pre-deployment-check.sh` - Run before any deploy
- `deploy-production.js` - Production deployment
- `submit-testflight.sh` - TestFlight submission
- Full TestFlight procedure: `.claude/.agent/SOP/testflight-deployment-procedure.md`

## Monitoring Scripts

- `smoke-tests-production.ts` - Post-deploy smoke tests
- `monitor-deployment.ts` - Deployment monitoring
- `monitor-errors-daily.ts` - Daily error monitoring

## Utility Scripts

- `validate-art-styles.ts` - Art style validation
- `test-image-generation-new-models.ts` - Image model testing
- `debug-session-completion.js` - Session debugging

## SQL Scripts

- `check-database-functions.sql`, `verify-database-functions.sql` - DB function verification
- `anonymize-analytics-userids.sql` - Analytics anonymization
- `cleanup-supabase-retention.sql` - Data retention cleanup
