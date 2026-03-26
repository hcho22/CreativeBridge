/**
 * H-02: DPA Acknowledgment in Consent Materials Test
 *
 * Verifies that the privacy policy and consent verification page
 * disclose data sharing with third-party AI service providers,
 * and documents the absence of actual DPA documents.
 *
 * @finding H-02: No DPAs with AI services
 * @status Partially addressed — disclosures exist, but actual DPA documents are missing
 */

import * as fs from 'fs';
import * as path from 'path';
import { readSourceFile } from './helpers';

describe('H-02: DPA acknowledgment in consent materials', () => {
  let privacyPolicy: string;
  let httpSource: string;

  beforeAll(() => {
    privacyPolicy = readSourceFile('docs/legal/privacy-policy.md');
    httpSource = readSourceFile('convex/http.ts');
  });

  test('H-02: Privacy policy mentions third-party AI service providers', () => {
    // The privacy policy should disclose that data is shared with AI providers
    const mentionsOpenAI = /OpenAI/i.test(privacyPolicy);
    const mentionsThirdParty = /third[- ]party/i.test(privacyPolicy);

    expect(mentionsOpenAI || mentionsThirdParty).toBe(true);
    // Verify both are present for completeness
    expect(mentionsOpenAI).toBe(true);
    expect(mentionsThirdParty).toBe(true);
  });

  test('H-02: Consent verification page lists data sharing with AI providers', () => {
    // The HTML consent page rendered by http.ts should mention third-party AI services
    const mentionsThirdParty = /[Tt]hird[- ][Pp]arty/.test(httpSource);
    const mentionsAIProvider =
      /OpenAI|Replicate|AI\s+service|AI\s+provider/i.test(httpSource);

    expect(mentionsThirdParty || mentionsAIProvider).toBe(true);
  });

  test.failing('[H-02] DPA documents directory or references exist', () => {
    // Actual Data Processing Agreement documents should be stored
    // in docs/legal/dpa/ or referenced with links/filenames
    const dpaDir = path.resolve(__dirname, '../../../../docs/legal/dpa');
    const dpaDirExists = fs.existsSync(dpaDir);

    if (dpaDirExists) {
      // If directory exists, it should contain at least one DPA document
      const files = fs.readdirSync(dpaDir);
      expect(files.length).toBeGreaterThan(0);
    } else {
      // Directory doesn't exist — DPA documents are missing
      expect(dpaDirExists).toBe(true);
    }
  });
});
