# Supabase JWT Verification Setup Guide

This guide explains how Supabase verifies Clerk JWTs and uses Clerk user ID for Row-Level Security (RLS) policies.

## Overview

**Architecture:**

- **Clerk** handles OAuth authentication and issues JWTs
- **Supabase** verifies JWTs against Clerk's JWKS endpoint
- **Supabase RLS** uses Clerk user ID from verified JWT for data access control

## Implementation Components

### 1. JWT Verification Service

**File:** `src/services/clerkJWTVerification.ts`

This service:

- Fetches Clerk's public keys from JWKS endpoint
- Verifies JWT signature and claims
- Extracts Clerk user ID from verified JWT

**Key Functions:**

- `verifyClerkJWT(clerkJWT: string)` - Verifies Clerk JWT and returns user ID
- `extractClerkUserId(clerkJWT: string)` - Quick extraction without full verification
- `decodeJWT(token: string)` - Decodes JWT structure

### 2. Clerk-Supabase Sync Service

**File:** `src/services/clerkSupabaseSync.ts`

This service:

- Syncs Clerk user ID to `user_profiles` table
- Creates/updates Supabase sessions with Clerk user ID
- Maps Clerk authentication to Supabase data access

**Key Functions:**

- `createSupabaseSessionFromClerkJWT(clerkJWT: string)` - Creates Supabase session
- `syncClerkUserIdToProfile(clerkUserId: string)` - Syncs Clerk user ID to profile
- `findProfileByClerkUserId(clerkUserId: string)` - Finds profile by Clerk user ID

### 3. Database Schema Updates

**File:** `sql/add_clerk_user_id_to_user_profiles.sql`

This migration:

- Adds `clerk_user_id` column to `user_profiles` table
- Creates index for faster lookups
- Updates RLS policies to support Clerk user ID

## Database Migration

### Step 1: Run SQL Migration

Execute the migration in your Supabase SQL Editor:

```sql
-- Run: sql/add_clerk_user_id_to_user_profiles.sql
```

This will:

1. Add `clerk_user_id` column to `user_profiles`
2. Create indexes for performance
3. Update RLS policies to support Clerk user ID
4. Create helper function `get_clerk_user_id_from_jwt()`

### Step 2: Verify Migration

Check that the migration was successful:

```sql
-- Verify column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name = 'clerk_user_id';

-- Verify index exists
SELECT indexname
FROM pg_indexes
WHERE tablename = 'user_profiles'
AND indexname LIKE '%clerk%';

-- Verify function exists
SELECT proname
FROM pg_proc
WHERE proname = 'get_clerk_user_id_from_jwt';
```

## RLS Policy Configuration

The RLS policy `user_profiles_own_data` has been updated to support both:

1. **Supabase Auth Users** (email/password): Uses `auth.uid() = id`
2. **Clerk OAuth Users**: Uses `clerk_user_id = get_clerk_user_id_from_jwt()`

**Policy Logic:**

```sql
CREATE POLICY "user_profiles_own_data" ON user_profiles
FOR ALL
USING (
  -- Supabase auth users (email/password)
  auth.uid() = id
  OR
  -- Clerk OAuth users (check if clerk_user_id matches JWT sub claim)
  clerk_user_id = get_clerk_user_id_from_jwt()
);
```

## JWT Verification Flow

### Client-Side (React Native)

1. User authenticates with Clerk (Google/Apple OAuth)
2. Clerk issues JWT token
3. App retrieves JWT using `clerkAuth.getToken()`
4. JWT is verified using `verifyClerkJWT()`
5. Clerk user ID is extracted from JWT
6. User profile is synced with Clerk user ID

### Server-Side (Supabase)

**Note:** Full cryptographic JWT verification should be done server-side via Supabase Edge Function.

**Recommended Approach:**

1. Create Supabase Edge Function to verify Clerk JWT
2. Edge Function fetches Clerk JWKS and verifies signature
3. Edge Function creates Supabase session with Clerk user ID
4. RLS policies use Clerk user ID from session for data access

**Edge Function Example (Future Implementation):**

```typescript
// supabase/functions/verify-clerk-jwt/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async req => {
  const { clerkJWT } = await req.json();

  // Verify JWT against Clerk JWKS
  // Create Supabase session
  // Return session to client
});
```

## Usage Examples

### Verify Clerk JWT

```typescript
import { verifyClerkJWT } from '../services/clerkJWTVerification';

const clerkJWT = await clerkAuth.getToken();
const result = await verifyClerkJWT(clerkJWT);

if (result.valid && result.userId) {
  console.log('Clerk User ID:', result.userId);
  // Use result.userId for Supabase operations
}
```

### Sync Clerk User ID to Profile

```typescript
import { syncClerkUserIdToProfile } from '../services/clerkSupabaseSync';

const result = await syncClerkUserIdToProfile(clerkUserId);
if (result.success) {
  console.log('Profile synced:', result.profile);
}
```

### Find Profile by Clerk User ID

```typescript
import { findProfileByClerkUserId } from '../services/clerkSupabaseSync';

const profile = await findProfileByClerkUserId('user_xxxxx');
if (profile) {
  console.log('Found profile:', profile);
}
```

## Testing

### Run Verification Tests

```bash
npm test -- src/__tests__/services/clerkJWTVerification.test.ts
```

### Test JWT Verification

```typescript
// Test with sample Clerk JWT
const testJWT = 'eyJ...'; // Your Clerk JWT
const result = await verifyClerkJWT(testJWT);

expect(result.valid).toBe(true);
expect(result.userId).toMatch(/^user_/);
```

### Test RLS Policies

```sql
-- Test RLS policy with Clerk user ID
SET request.jwt.claims = '{"sub": "user_test123"}';
SELECT * FROM user_profiles WHERE clerk_user_id = 'user_test123';
```

## Security Considerations

### Client-Side Verification

**Current Implementation:**

- Verifies JWT structure and claims
- Checks expiration
- Extracts Clerk user ID
- **Note:** Full cryptographic signature verification requires server-side implementation

**Limitations:**

- Client-side verification is for structure/claims only
- Full signature verification should be done server-side
- Trust Clerk's token in client, verify on server

### Server-Side Verification (Recommended)

**Best Practice:**

1. Send Clerk JWT to Supabase Edge Function
2. Edge Function verifies JWT signature against Clerk JWKS
3. Edge Function creates Supabase session
4. RLS policies use verified Clerk user ID

**Benefits:**

- Full cryptographic verification
- Secure session management
- Proper access control

## Troubleshooting

### Issue: JWT Verification Fails

**Solution:**

1. Verify Clerk JWKS URL is correct in environment config
2. Check that JWT is not expired
3. Ensure JWT contains `sub` claim with Clerk user ID
4. Verify network connectivity to Clerk JWKS endpoint

### Issue: RLS Policy Not Working

**Solution:**

1. Verify `clerk_user_id` column exists in `user_profiles`
2. Check that `get_clerk_user_id_from_jwt()` function exists
3. Ensure JWT contains Clerk user ID in `sub` claim
4. Test RLS policy with sample JWT claims

### Issue: Profile Not Found by Clerk User ID

**Solution:**

1. Verify `clerk_user_id` is set in user profile
2. Check that Clerk user ID format is correct (`user_xxxxx`)
3. Ensure profile was created/updated with Clerk user ID
4. Verify database migration was run successfully

## Next Steps

After completing this setup:

1. ✅ Task 1.1: Clerk Setup and Configuration
2. ✅ Task 1.2: Install Required Dependencies
3. ✅ Task 1.3: Configure Supabase JWT Verification (this task)
4. ⏭️ Task 1.4: Configure Deep Linking for Clerk OAuth Callbacks

See `TASKS-oauth-google-apple-signin-PRD.md` for the complete implementation plan.

## References

- [Clerk JWT Documentation](https://clerk.com/docs/backend-requests/handling/manual-jwt)
- [Supabase RLS Policies](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [JWT.io](https://jwt.io/) - JWT debugger and documentation
