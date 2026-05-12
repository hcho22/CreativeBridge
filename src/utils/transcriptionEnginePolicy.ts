/**
 * Transcription Engine Policy (US-006)
 *
 * Single source of truth for "which transcription engine should we use
 * for this user?" — enforces FR-2 (no under-13 audio to third parties)
 * at the architectural level rather than scattered call sites.
 *
 * Routing rules:
 *   - `K-2`, `3-5`, `6-8` → always on-device. `6-8` is conservatively
 *     grouped with under-13 because the band spans ages ~11–14 and we
 *     can't distinguish 12-year-olds from 14-year-olds from grade alone.
 *   - `9-12` → respects `preferences.transcriptionEngine`, defaulting
 *     to on-device when no preference is set.
 *   - `undefined` / missing grade → on-device (fail-safe).
 *
 * **Fail-safe asymmetry.** The missing-grade default is `'on-device'`,
 * not `'cloud'`. Getting this wrong toward privacy ("13+ user with no
 * grade set gets slightly lower transcription quality") is a UX
 * degradation the user can fix by completing onboarding. Getting it
 * wrong toward cloud ("under-13 user with no grade set leaks audio to
 * OpenAI") is the FR-2 violation the entire PRD is preventing. The
 * asymmetry of consequences picks the default.
 *
 * **Storage-field name vs. parameter name.** This helper's input field
 * is named `gradeLevel` (matching the `GradeLevel` type literal). The
 * canonical user-profile field in Convex is actually
 * `userProfiles.preferredGradeLevel` — see the D-1 note in the PRD;
 * the original PRD draft had this name reversed. Callers map their
 * stored field onto the helper's parameter:
 *
 *     getTranscriptionEngine({
 *       gradeLevel: userProfile.preferredGradeLevel,
 *       preferences: { transcriptionEngine: userProfile.preferences?.transcriptionEngine },
 *     });
 *
 * Decoupling the helper's parameter name from the storage field keeps
 * the helper stable across future schema renames and avoids leaking
 * Convex-vs-Supabase field-naming conventions (camelCase vs snake_case)
 * into a pure utility.
 *
 * Purity: no I/O, no module-level mutable state, no time/random
 * dependencies — easy to exhaustively test with a 15-case matrix.
 */

import type { GradeLevel } from '../types';

export type TranscriptionEngine = 'on-device' | 'cloud';

/**
 * Grade bands that contain (or may contain) children under 13. Reused
 * by:
 *   - US-006 (this file) — routing decisions
 *   - US-009 — Settings toggle visibility ("only show for 9-12")
 *   - US-010 — consent modal gating
 *   - US-013 — H01 tripwire assertion (under-13 users → zero cloud calls)
 *
 * Frozen at module load to prevent accidental mutation by consumers.
 * Typed as `readonly GradeLevel[]` so `Array.prototype.includes` is
 * type-checked against the literal union.
 */
export const UNDER_13_GRADES: readonly GradeLevel[] = Object.freeze([
  'K-2',
  '3-5',
  '6-8',
]);

const DEFAULT_ENGINE: TranscriptionEngine = 'on-device';

export interface TranscriptionEnginePolicyInput {
  gradeLevel?: GradeLevel;
  preferences?: {
    transcriptionEngine?: TranscriptionEngine;
  };
}

export function getTranscriptionEngine(
  input: TranscriptionEnginePolicyInput,
): TranscriptionEngine {
  const { gradeLevel, preferences } = input;

  if (!gradeLevel) {
    return DEFAULT_ENGINE;
  }

  if (UNDER_13_GRADES.includes(gradeLevel)) {
    return DEFAULT_ENGINE;
  }

  return preferences?.transcriptionEngine ?? DEFAULT_ENGINE;
}
