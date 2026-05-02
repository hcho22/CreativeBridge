/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminAnalytics from '../adminAnalytics.js';
import type * as ai from '../ai.js';
import type * as auth from '../auth.js';
import type * as consent from '../consent.js';
import type * as crons from '../crons.js';
import type * as dataRetention from '../dataRetention.js';
import type * as gameSessions from '../gameSessions.js';
import type * as http from '../http.js';
import type * as imageGeneration from '../imageGeneration.js';
import type * as migration from '../migration.js';
import type * as onboarding from '../onboarding.js';
import type * as storage from '../storage.js';
import type * as userProfiles from '../userProfiles.js';

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from 'convex/server';

declare const fullApi: ApiFromModules<{
  adminAnalytics: typeof adminAnalytics;
  ai: typeof ai;
  auth: typeof auth;
  consent: typeof consent;
  crons: typeof crons;
  dataRetention: typeof dataRetention;
  gameSessions: typeof gameSessions;
  http: typeof http;
  imageGeneration: typeof imageGeneration;
  migration: typeof migration;
  onboarding: typeof onboarding;
  storage: typeof storage;
  userProfiles: typeof userProfiles;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, 'public'>
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, 'internal'>
>;

export declare const components: {};
