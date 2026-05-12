/**
 * H-01: Speech Recognition Audio Disclosure — COPPA tripwire
 *
 * This test enforces three invariants that together constitute the H-01
 * COPPA protection. They are checked from three different angles so a
 * regression in any one place can't slip past the others:
 *
 *   1. **Behavioral:** For every under-13 grade band and every value of
 *      `preferences.transcriptionEngine`, `getTranscriptionEngine()` must
 *      return `'on-device'`. A `jest.fn()` standing in for the cloud
 *      transcription action is wired up downstream of the routing
 *      decision; if the routing ever returns `'cloud'` for an under-13
 *      fixture, the mock fires and the test fails with the offending
 *      grade/preference combination in the failure message.
 *
 *   2. **Static (import graph):** `VoiceInput.tsx` must import the
 *      on-device transcription service. This catches the failure mode
 *      where someone deletes the on-device pipeline entirely (a la the
 *      2026-04-14 regression that originally broke H-01 — the file used
 *      to import `nativeSpeechRecognizer` and lost it during a rewrite,
 *      silently routing 100% of voice through cloud).
 *
 *   3. **Content (policy disclosure):** `docs/legal/privacy-policy.md`
 *      must contain the under-13 on-device disclosure. The dedicated
 *      US-012 content test (`privacyPolicyContent.test.ts`) carries the
 *      stronger structural and exact-phrasing checks; this one stays as
 *      a minimal "voice is mentioned at all" canary so H-01 alone
 *      catches a policy regression even if the dedicated content test
 *      is somehow disabled or deleted.
 *
 * **History.** This file was originally written when iOS used on-device
 * `SFSpeechRecognizer` via `NativeModules.SpeechRecognizerModule`. The
 * 2026-04-14 architectural rewrite silently switched to cloud Whisper,
 * which the H-01 audit flagged. The fix landed in US-006 through US-012
 * (on-device pipeline, opt-in cloud gate, policy disclosure). US-013
 * then converted this file from `test.failing` tripwires to real
 * passing assertions that lock in the new architecture.
 *
 * **Meta-check.** The final `describe` block exercises the positive
 * control — `getTranscriptionEngine` returning `'cloud'` for a 9-12
 * opted-in user — which proves the test's routing machinery isn't
 * silently passing because the cloud branch is unreachable.
 *
 * @implements H-01
 * @implements US-013
 */

import { readSourceFile } from './helpers';
import {
  getTranscriptionEngine,
  UNDER_13_GRADES,
  type TranscriptionEngine,
} from '../../../utils/transcriptionEnginePolicy';
import type { GradeLevel } from '../../../types';

describe('H-01: Speech Recognition Audio Disclosure (US-013)', () => {
  describe('[H-01.1] Under-13 audio never routes to the cloud transcription action', () => {
    // Stand-in for the cloud transcription action (the legacy
    // whisperTranscriptionService / Convex `transcribeAudio`). The
    // mock is invoked only if the routing decision returns `'cloud'`,
    // so a non-zero call count means the COPPA invariant has been
    // broken at the routing layer.
    let cloudTranscribeMock: jest.Mock;
    let onDeviceTranscribeMock: jest.Mock;

    // Minimal routing fixture: takes the resolved engine and dispatches
    // to one of the two mocks. Lives in the test so the assertion
    // proves end-to-end behavior (routing → dispatch), not just the
    // policy helper's return value in isolation.
    const dispatchByEngine = (engine: TranscriptionEngine) => {
      if (engine === 'cloud') {
        cloudTranscribeMock();
      } else {
        onDeviceTranscribeMock();
      }
    };

    beforeEach(() => {
      cloudTranscribeMock = jest.fn();
      onDeviceTranscribeMock = jest.fn();
    });

    // Cartesian product of (under-13 grades) × (every possible value of
    // preferences.transcriptionEngine). The "cloud" preference case is
    // the most important: even if a 9-12 user toggle leaked into a
    // K-2 profile somehow, the helper must still route on-device.
    const underThirteenCases: Array<{
      gradeLevel: GradeLevel;
      preferenceLabel: string;
      preferences: { transcriptionEngine?: TranscriptionEngine } | undefined;
    }> = [];
    for (const gradeLevel of UNDER_13_GRADES) {
      underThirteenCases.push({
        gradeLevel,
        preferenceLabel: 'no preference',
        preferences: undefined,
      });
      underThirteenCases.push({
        gradeLevel,
        preferenceLabel: 'preference = on-device',
        preferences: { transcriptionEngine: 'on-device' },
      });
      underThirteenCases.push({
        gradeLevel,
        preferenceLabel: 'preference = cloud (attempted leak)',
        preferences: { transcriptionEngine: 'cloud' },
      });
    }

    // Use `$gradeLevel` / `$preferenceLabel` template tokens so the
    // generated test names read as "routes K-2 + preference = cloud
    // (attempted leak) to on-device..." rather than dumping the raw
    // case object — significantly more useful in CI failure output.
    it.each(underThirteenCases)(
      'routes $gradeLevel + $preferenceLabel to on-device and never calls the cloud action',
      ({ gradeLevel, preferences }) => {
        const engine = getTranscriptionEngine({ gradeLevel, preferences });
        dispatchByEngine(engine);

        expect(engine).toBe('on-device');
        expect(cloudTranscribeMock).not.toHaveBeenCalled();
        expect(onDeviceTranscribeMock).toHaveBeenCalledTimes(1);
      },
    );

    it('records zero cloud invocations across the full under-13 matrix', () => {
      // Belt-and-suspenders: run every fixture in a single pass and
      // assert the aggregate. If a future regression flips just one
      // cell, the per-case assertion above catches it; this aggregate
      // assertion catches the case where multiple cells regress and
      // a careless reader might think the matrix is "mostly safe".
      for (const { gradeLevel, preferences } of underThirteenCases) {
        const engine = getTranscriptionEngine({ gradeLevel, preferences });
        dispatchByEngine(engine);
      }
      expect(cloudTranscribeMock).not.toHaveBeenCalled();
      expect(onDeviceTranscribeMock).toHaveBeenCalledTimes(
        underThirteenCases.length,
      );
    });
  });

  describe('[H-01.2] On-device transcription service is reachable from VoiceInput.tsx', () => {
    let voiceInputSource: string;

    beforeAll(() => {
      voiceInputSource = readSourceFile('src/components/common/VoiceInput.tsx');
    });

    it('imports onDeviceTranscriptionService', () => {
      // The static import is the load-bearing line. If a regression
      // deleted the on-device pipeline entirely (as happened in the
      // 2026-04-14 rewrite that originally broke H-01), this fails.
      expect(voiceInputSource).toMatch(
        /import\s*\{\s*onDeviceTranscriptionService\s*\}\s*from\s*['"][^'"]*onDeviceTranscriptionService['"]/,
      );
    });

    it('imports audioCaptureService for the on-device recording path', () => {
      // audioCaptureService is the recording half of the on-device
      // pipeline; on-device transcription is meaningless without
      // captured audio. Pinning the second import means deleting
      // either half trips the test.
      expect(voiceInputSource).toMatch(
        /import\s*\{\s*audioCaptureService\s*\}\s*from\s*['"][^'"]*audioCaptureService['"]/,
      );
    });

    it('imports getTranscriptionEngine — the only legal routing decision', () => {
      // FR-2 enforcement at the import-graph level. If VoiceInput ever
      // stops importing the policy helper, that means routing is
      // happening somewhere else — which by the PRD's design is not
      // allowed (helper is the single source of truth).
      expect(voiceInputSource).toMatch(
        /import\s*\{[^}]*getTranscriptionEngine[^}]*\}\s*from\s*['"][^'"]*transcriptionEnginePolicy['"]/,
      );
    });
  });

  describe('[H-01.3] Privacy policy discloses under-13 voice handling', () => {
    let policySource: string;

    beforeAll(() => {
      policySource = readSourceFile('docs/legal/privacy-policy.md');
    });

    it('mentions voice/speech/audio/dictation', () => {
      // Minimal canary — "the policy talks about voice at all".
      expect(policySource).toMatch(/voice|speech|audio|dictation/i);
    });

    it('contains the explicit under-13 on-device statement', () => {
      // The exact phrase US-012 AC #1 quoted. Re-asserted here so the
      // COPPA tripwire fires even if the dedicated US-012 content
      // test is somehow disabled or deleted.
      expect(policySource).toMatch(
        /voice transcription is performed \*\*entirely on-device\*\*/i,
      );
    });

    it('promises under-13 audio is not transmitted, retained, or shared', () => {
      expect(policySource).toMatch(
        /not transmitted off-device,\s*retained,\s*or shared with any third party/i,
      );
    });
  });

  describe('[H-01.meta] Positive control — the test machinery catches cloud routing', () => {
    // These assertions exist so a future maintainer can trust that
    // [H-01.1] passing means "cloud routing didn't happen", not
    // "cloud routing isn't *possible* in this codebase." If the
    // policy helper were broken in a way that always returned
    // 'on-device' regardless of input, [H-01.1] would still pass
    // vacuously. These cases prove the cloud branch is reachable so
    // [H-01.1]'s safety claim is meaningful.

    it("returns 'cloud' for a 9-12 user with cloud preference (positive control)", () => {
      const engine = getTranscriptionEngine({
        gradeLevel: '9-12',
        preferences: { transcriptionEngine: 'cloud' },
      });
      expect(engine).toBe('cloud');
    });

    it("still returns 'on-device' for a 9-12 user without preference (default)", () => {
      // Sanity-check the default rule: 9-12 with no preference must
      // also stay on-device. Together with the cloud case above,
      // this proves the helper actually inspects `preferences`.
      const engine = getTranscriptionEngine({
        gradeLevel: '9-12',
        preferences: undefined,
      });
      expect(engine).toBe('on-device');
    });
  });
});
