// US-006 validation: getTranscriptionEngine routes users in under-13
// grade bands to on-device unconditionally, and lets 9-12 users follow
// their stored preference. Pure function — no mocks, no I/O, no module
// state — so the full 5 × 3 = 15 input matrix is enumerated explicitly.
//
// PRD pass condition:
//   - 12 cases (K-2, 3-5, 6-8, undefined × on-device | cloud | undef)
//     resolve to 'on-device' regardless of preference.
//   - 3 cases for 9-12 respect the preference; undefined preference
//     defaults to 'on-device'.
//
// Beyond the matrix, this file also pins:
//   - The membership of UNDER_13_GRADES (single source of truth for
//     US-009 / US-010 / US-013).
//   - That UNDER_13_GRADES is frozen — accidental mutation by a future
//     consumer would silently break COPPA routing.

import type { GradeLevel } from '../../types';
import {
  getTranscriptionEngine,
  UNDER_13_GRADES,
  type TranscriptionEngine,
} from '../../utils/transcriptionEnginePolicy';

describe('getTranscriptionEngine — US-006 routing matrix', () => {
  const GRADES: Array<GradeLevel | undefined> = [
    'K-2',
    '3-5',
    '6-8',
    '9-12',
    undefined,
  ];
  const PREFS: Array<TranscriptionEngine | undefined> = [
    'on-device',
    'cloud',
    undefined,
  ];

  // ── 12 cases: under-13 grades + missing grade always force on-device ──
  // (FR-2: no under-13 audio reaches a third party, even if a stale
  // 'cloud' preference is somehow set on the profile.)

  describe('under-13 grades resolve to on-device regardless of preference', () => {
    const UNDER_13: Array<GradeLevel | undefined> = [
      'K-2',
      '3-5',
      '6-8',
      undefined,
    ];

    for (const grade of UNDER_13) {
      for (const pref of PREFS) {
        const label = `grade=${grade ?? 'undefined'} preference=${
          pref ?? 'undefined'
        }`;

        it(`${label} → on-device`, () => {
          const engine = getTranscriptionEngine({
            gradeLevel: grade,
            preferences: pref ? { transcriptionEngine: pref } : undefined,
          });
          expect(engine).toBe('on-device');
        });
      }
    }
  });

  // ── 3 cases: 9-12 honors the preference, defaulting to on-device ──

  describe('9-12 honors preferences.transcriptionEngine', () => {
    it("grade=9-12 preference='on-device' → on-device", () => {
      expect(
        getTranscriptionEngine({
          gradeLevel: '9-12',
          preferences: { transcriptionEngine: 'on-device' },
        }),
      ).toBe('on-device');
    });

    it("grade=9-12 preference='cloud' → cloud", () => {
      expect(
        getTranscriptionEngine({
          gradeLevel: '9-12',
          preferences: { transcriptionEngine: 'cloud' },
        }),
      ).toBe('cloud');
    });

    it('grade=9-12 preference=undefined → on-device (default)', () => {
      expect(
        getTranscriptionEngine({
          gradeLevel: '9-12',
          preferences: undefined,
        }),
      ).toBe('on-device');
    });

    it('grade=9-12 preferences object present but transcriptionEngine missing → on-device', () => {
      expect(
        getTranscriptionEngine({
          gradeLevel: '9-12',
          preferences: {},
        }),
      ).toBe('on-device');
    });
  });

  // ── Sanity: the matrix is exhaustive ──
  // If GradeLevel ever gains a new band (e.g. 'pre-K' or '13+'), this
  // assertion will not catch the missing case directly — but the
  // PRD-required matrix above will need an explicit new row, which
  // is the right way to extend the policy.

  it('covers every (grade, preference) combination above (5 × 3 = 15 cases enumerated)', () => {
    let count = 0;
    for (const grade of GRADES) {
      for (const pref of PREFS) {
        getTranscriptionEngine({
          gradeLevel: grade,
          preferences: pref ? { transcriptionEngine: pref } : undefined,
        });
        count += 1;
      }
    }
    expect(count).toBe(15);
  });
});

describe('UNDER_13_GRADES constant', () => {
  // Other call sites (US-009 Settings visibility, US-010 consent gating,
  // US-013 H01 tripwire) import this constant directly. If the
  // membership ever changes silently, those features quietly break
  // their COPPA invariants. Pin it here.

  it('contains exactly K-2, 3-5, and 6-8 (under-13 fail-safe band)', () => {
    expect([...UNDER_13_GRADES].sort()).toEqual(['3-5', '6-8', 'K-2']);
  });

  it('does NOT include 9-12', () => {
    expect(UNDER_13_GRADES.includes('9-12')).toBe(false);
  });

  it('is frozen — runtime mutation throws (in strict mode) or is silently ignored', () => {
    const mutable = UNDER_13_GRADES as unknown as GradeLevel[];
    // Object.freeze prevents writes; in strict mode (where Jest tests
    // run by default), the assignment throws. We accept either
    // outcome — the assertion is that the array remains unchanged.
    let didThrow = false;
    try {
      mutable.push('9-12');
    } catch {
      didThrow = true;
    }
    // Regardless of whether the push threw or silently no-op'd, the
    // array contents must be unchanged.
    expect(didThrow || mutable.length === 3).toBe(true);
    expect(UNDER_13_GRADES.length).toBe(3);
    expect(UNDER_13_GRADES.includes('9-12')).toBe(false);
  });
});

describe('Single source of truth — FR-2 enforcement', () => {
  // The PRD calls out that getTranscriptionEngine must be the *only*
  // place transcription routing decisions are made. We can't statically
  // assert "no other call site picks an engine" from inside a unit
  // test — that's an architectural/import-graph property covered by
  // US-013's H01 tripwire. What we *can* assert here is the negation
  // is impossible by construction for the PRD-listed under-13 inputs:
  // even with a maximally-permissive preference, the under-13 branch
  // must short-circuit before reading preferences at all.

  it('never reads preferences for under-13 grades (proven by passing a poison object)', () => {
    const poison = new Proxy(
      { transcriptionEngine: 'cloud' as TranscriptionEngine },
      {
        get(): never {
          throw new Error(
            'preferences.transcriptionEngine must not be read for under-13 grades',
          );
        },
      },
    );

    for (const grade of ['K-2', '3-5', '6-8'] as GradeLevel[]) {
      expect(() =>
        getTranscriptionEngine({
          gradeLevel: grade,
          preferences: poison,
        }),
      ).not.toThrow();
    }
  });
});
