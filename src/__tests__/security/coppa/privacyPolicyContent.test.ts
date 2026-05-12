/**
 * US-012: Privacy policy voice-processing disclosure
 *
 * Automated check that `docs/legal/privacy-policy.md` contains the
 * required language for voice/audio processing. This is the *engineering*
 * gate — it catches accidental regressions (e.g., a future edit deleting
 * the "on-device" guarantee) but it is NOT a substitute for legal
 * readback. The PRD's pass condition explicitly includes a manual
 * legal-review step that this file cannot automate.
 *
 * The assertions are split into three layers:
 *
 *   1. **Keyword presence.** Every load-bearing phrase from the AC list
 *      must appear in the file. If any of these strings disappears, the
 *      policy no longer claims what the implementation actually does, and
 *      we want a hard CI failure (not a quiet drift).
 *
 *   2. **Structural anchors.** The "Voice and Audio Data" section
 *      header, the OpenAI Whisper third-party row, and the voice
 *      retention row must all exist. Keyword presence alone could be
 *      satisfied by stray prose; structural anchors prove the words are
 *      in the right *place*.
 *
 *   3. **COPPA invariants.** The under-13 on-device statement is the
 *      single most important sentence in the policy from a COPPA §312.2
 *      perspective. It gets its own assertion that pins the exact
 *      phrasing required by US-012 AC #1.
 *
 * @implements US-012: Privacy policy update — voice processing disclosure
 */

import { readSourceFile } from './helpers';

describe('US-012: Privacy policy voice-processing disclosure', () => {
  let policy: string;

  beforeAll(() => {
    policy = readSourceFile('docs/legal/privacy-policy.md');
  });

  describe('keyword presence', () => {
    // Lower-cased substrings the policy must mention. Case-insensitive
    // check so a future stylistic recasing ("Voice" vs "voice") doesn't
    // false-negative on us, but the substring itself must match exactly.
    const requiredKeywords = [
      'voice',
      'on-device',
      'openai whisper',
      'under 13',
      'opt-in',
      'audio',
      'dictation',
      'whisper',
    ];

    it.each(requiredKeywords)('mentions "%s"', keyword => {
      expect(policy.toLowerCase()).toContain(keyword);
    });
  });

  describe('structural anchors', () => {
    it('has a top-level "Voice and Audio Data" section', () => {
      expect(policy).toMatch(/^## Voice and Audio Data\b/m);
    });

    it('has a sub-section for under-13 users', () => {
      // Heading wording is locked in: "For users under 13". A reword
      // would change the legal commitment, so the test pins the phrase.
      expect(policy).toMatch(/### For users under 13/);
    });

    it('has a sub-section for 13+ users', () => {
      expect(policy).toMatch(/### For users 13 and older/);
    });

    it('includes OpenAI Whisper in the Third-Party Services table', () => {
      // The row's first column must mention Whisper. Pinning by the
      // table row's leading pipe + bold marker so stray prose
      // mentions don't pass this assertion.
      expect(policy).toMatch(/\|\s+\*\*OpenAI Whisper\*\*/);
    });

    it('marks the Whisper row as applying only to opted-in 9-12 users', () => {
      // The "Applies To" column must explicitly carve out under-13.
      // This is the column that enforces the COPPA boundary visually.
      const whisperRowMatch = policy.match(/\|\s+\*\*OpenAI Whisper\*\*[^\n]+/);
      expect(whisperRowMatch).not.toBeNull();
      const row = whisperRowMatch![0];
      expect(row).toMatch(/opted in/i);
      expect(row).toMatch(/9-?12/);
      expect(row).toMatch(/Never under-13/i);
    });

    it('has a voice recordings retention row stating non-retention', () => {
      // The retention table's voice row must use "Not retained" as a
      // leading promise (not buried in a paragraph). This is the
      // assertion C-05 will eventually piggyback on once that test
      // converts from .failing to passing.
      expect(policy).toMatch(
        /Voice recordings[^|]+\|\s+\*\*Not retained\.\*\*/,
      );
    });
  });

  describe('COPPA invariants', () => {
    it('states that under-13 voice transcription is entirely on-device', () => {
      // US-012 AC #1 quotes this exact phrasing. Pin the noun-phrase
      // pair so a future edit can't accidentally weaken the claim
      // (e.g., "mostly on-device", "primarily on-device").
      expect(policy).toMatch(
        /voice transcription is performed \*\*entirely on-device\*\*/i,
      );
    });

    it('states that under-13 audio is not transmitted, retained, or shared', () => {
      // The three verbs are conjoined in the AC ("not transmitted
      // off-device, retained, or shared with any third party") and
      // together they cover the COPPA §312.2 voice-as-PII obligations.
      // Match flexibly on whitespace/markdown but require all three
      // verbs in order.
      expect(policy).toMatch(
        /not transmitted off-device,\s*retained,\s*or shared with any third party/i,
      );
    });

    it('confirms no override can route an under-13 user to cloud', () => {
      // Defensive assertion mirroring the implementation's
      // transcriptionEnginePolicy.ts comment: under-13 users have no
      // setting, flag, or admin override that flips them to cloud.
      // The policy text needs to say this explicitly so an auditor
      // reading the doc can verify it without reading the code.
      expect(policy).toMatch(
        /no setting,\s*A\/B test,\s*feature flag,\s*or admin override/i,
      );
    });

    it('discloses iOS-only voice availability and no Android collection', () => {
      // US-011 + US-012 together: Android does not surface a voice UI
      // and does not collect voice data. The policy needs to disclose
      // this so an Android user reading it understands why they don't
      // see the feature.
      expect(policy).toMatch(/iOS-only/i);
      // `\s+` rather than a literal space so the assertion is robust
      // to markdown auto-wrapping the sentence across lines (Prettier
      // hard-wraps long paragraphs in this file).
      expect(policy).toMatch(
        /No voice or audio\s+data is collected on Android/i,
      );
    });
  });

  describe('metadata', () => {
    it('declares version 1.1', () => {
      expect(policy).toMatch(/\*\*Version:\*\*\s*1\.1/);
    });

    it('has an Effective Date that is a real date, not a placeholder', () => {
      // The C-05 audit owns the broader placeholder check across the
      // whole file; here we just verify the *Effective Date* line for
      // US-012's specific AC ("Effective Date and Last Updated fields
      // refreshed").
      const header = policy.split('\n').slice(0, 10).join('\n');
      expect(header).toMatch(/\*\*Effective Date:\*\*\s*\d{4}-\d{2}-\d{2}/);
      expect(header).toMatch(/\*\*Last Updated:\*\*\s*\d{4}-\d{2}-\d{2}/);
    });
  });
});
