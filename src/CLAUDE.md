# Frontend Source (`src/`)

## Authentication Flow

**OAuth Users (Clerk IDs):**

- Clerk handles OAuth (Google/Apple) and issues JWT
- Convex verifies Clerk JWT via `ConvexProviderWithClerk` in `App.tsx`
- User profiles stored in Convex `userProfiles` table

**Legacy Users (Supabase UUIDs):**

- Supabase email/password authentication
- `context/AuthContext.tsx` manages session state
- Email confirmation via deep links

## Database Strategy

- **Convex (PRIMARY):** For OAuth users. Schema in `convex/schema.ts`, types auto-generated.
- **Supabase (FALLBACK):** For legacy users. Types in `types/database.ts`, RLS policies for data isolation.

## Key Entry Points

- `App.tsx` - Root entry with `ConvexProviderWithClerk`
- `context/AuthContext.tsx` - Auth state management (148KB, handles both auth paths)
- `navigation/AppNavigator.tsx` - Tab + stack navigation (HomeStack, SettingsStack, Profile)

## Component Organization (`components/`)

| Directory     | Purpose                               |
| ------------- | ------------------------------------- |
| `analytics/`  | Analytics dashboard components        |
| `auth/`       | Login, signup, auth-related UI        |
| `common/`     | Shared UI (modals, buttons, displays) |
| `onboarding/` | Onboarding flow components            |
| `story/`      | Story-specific components             |
| `test/`       | Test utilities and TestID components  |

## Feature Flags

- **OAuth users:** Convex `featureFlags` table
- **Legacy users:** Supabase `feature_management` tables
