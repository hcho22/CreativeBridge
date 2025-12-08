# Image Generation TestFlight Fix

## Issue Summary

Image generation was failing in TestFlight builds with commit `c8219dba4cc2a43c363d7abcdd0d87b507f00d90` with the error:

```
Image Generation Failed: No image generation API tokens configured
```

## Root Cause

The `imageGeneration.ts` service was using `process.env.REPLICATE_API_TOKEN` and `process.env.BACKUP_IMAGE_API_TOKEN` directly, which **does not work in React Native**. In React Native, environment variables must be loaded through `react-native-dotenv` and accessed via the `@env` module.

## Fix Applied

Updated `src/services/imageGeneration.ts` to use the environment service instead of `process.env`:

### Before:

```typescript
// Environment variables for API keys
const REPLICATE_API_TOKEN =
  process.env.REPLICATE_API_TOKEN || (__DEV__ ? 'dev-token' : undefined);
const BACKUP_IMAGE_API_TOKEN =
  process.env.BACKUP_IMAGE_API_TOKEN ||
  (__DEV__ ? 'dev-backup-token' : undefined);
const IMAGE_GENERATION_ENABLED =
  process.env.IMAGE_GENERATION_ENABLED !== 'false';
```

### After:

```typescript
import {
  getImageGenerationConfig,
  isImageGenerationEnabled,
} from './environment';

// Get environment variables for API keys from environment service
// This ensures proper loading from @env in React Native
const imageConfig = getImageGenerationConfig();
const REPLICATE_API_TOKEN = imageConfig.primaryApiToken || undefined;
const BACKUP_IMAGE_API_TOKEN = imageConfig.backupApiToken || undefined;
const IMAGE_GENERATION_ENABLED = imageConfig.enabled;
```

## Why This Fixes the Issue

1. **React Native Environment Variables**: React Native doesn't support `process.env` the same way Node.js does. The `react-native-dotenv` plugin (configured in `babel.config.js`) loads environment variables from `.env` files and makes them available via the `@env` module.

2. **Environment Service**: The `environment.ts` service properly loads variables from `@env` and provides a centralized configuration interface that works in both development and production builds.

3. **EAS Builds**: For EAS builds (TestFlight), environment variables need to be configured as EAS secrets, which are then injected during the build process and accessible via `@env`.

## Additional Steps Required

For TestFlight builds to work, you must ensure environment variables are configured in EAS:

### 1. Set EAS Secrets

```bash
# Set Replicate API token
eas secret:create --scope project --name REPLICATE_API_TOKEN --value r8_your_token_here

# Set backup image API token
eas secret:create --scope project --name BACKUP_IMAGE_API_TOKEN --value r8_your_backup_token_here

# Enable image generation
eas secret:create --scope project --name IMAGE_GENERATION_ENABLED --value true
```

### 2. Verify Secrets

```bash
# List all secrets
eas secret:list
```

### 3. Rebuild for TestFlight

After setting secrets, rebuild the app:

```bash
eas build --platform ios --profile production
```

## Verification

After the fix and rebuild, verify that:

1. ✅ Environment variables are loaded correctly
2. ✅ Image generation works in TestFlight
3. ✅ Error message "No image generation API tokens configured" no longer appears

## Files Changed

- `src/services/imageGeneration.ts`: Updated to use environment service instead of `process.env`

## Related Files

- `src/services/environment.ts`: Environment configuration service
- `babel.config.js`: React Native dotenv configuration
- `eas.json`: EAS build configuration

## Testing

To test locally before building for TestFlight:

1. Create a `.env` file in the project root with:

   ```
   REPLICATE_API_TOKEN=r8_your_token_here
   BACKUP_IMAGE_API_TOKEN=r8_your_backup_token_here
   IMAGE_GENERATION_ENABLED=true
   ```

2. Test image generation in development:

   ```bash
   npm start
   ```

3. Verify the fix works before building for TestFlight.

## Notes

- The fix maintains backward compatibility with development mode
- Empty strings from `getEnvVar()` are properly handled (converted to `undefined`)
- All existing validation logic remains intact
- The error message "No image generation API tokens configured" will only appear if tokens are truly missing
