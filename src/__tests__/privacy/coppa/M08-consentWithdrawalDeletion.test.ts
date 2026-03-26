/**
 * M-08: Consent Withdrawal Data Deletion Tests
 *
 * Audit finding: When a parent withdraws consent, the app must delete
 * the child's personal data — not just change a status flag. Currently
 * withdrawConsent only sets status to 'withdrawn' without triggering
 * a data deletion cascade.
 *
 * COPPA requires consent records themselves to be retained for 3 years
 * after account deletion (handled by separate cron in consent.ts).
 *
 * @implements M-08
 */

import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../../../../');

function readSourceFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(PROJECT_ROOT, relativePath), 'utf-8');
}

function extractFunctionBlock(source: string, fnName: string): string {
  // Convex mutation/action pattern
  const convexPattern = new RegExp(
    `export const ${fnName} = (?:query|mutation|action|internalQuery|internalMutation|internalAction)\\(\\{[\\s\\S]*?^\\}\\);`,
    'm',
  );
  const convexMatch = source.match(convexPattern);
  if (convexMatch) return convexMatch[0];
  return '';
}

describe('M-08: Consent Withdrawal Data Deletion', () => {
  let consentSource: string;
  let withdrawBlock: string;

  beforeAll(() => {
    consentSource = readSourceFile('convex/consent.ts');
    withdrawBlock = extractFunctionBlock(consentSource, 'withdrawConsent');
  });

  test('[M-08] withdrawConsent sets status to withdrawn', () => {
    // Basic verification that the function exists and sets the status
    expect(withdrawBlock).toContain("status: 'withdrawn'");
    expect(withdrawBlock).toContain('withdrawnAt');
  });

  test.failing(
    '[M-08] withdrawConsent calls data deletion cascade (not just status change)',
    () => {
      // After setting status to 'withdrawn', the function must also trigger
      // deletion of the child's personal data (stories, images, analytics)
      expect(withdrawBlock).toMatch(
        /deleteAllUserData|deleteUserData|dataDeletion|cascadeDelete/i,
      );
    },
  );

  test.failing(
    '[M-08] User stories, images, and analytics deleted after consent withdrawal',
    () => {
      // The withdrawal handler (or a triggered function) must delete:
      // 1. Game sessions / stories
      // 2. Generated images (storage files)
      // 3. Analytics events
      expect(withdrawBlock).toMatch(
        /gameSessions|storyElements|imageGeneration|analytics/,
      );
      // Must actually call ctx.db.delete or a deletion function
      expect(withdrawBlock).toMatch(
        /ctx\.db\.delete|deleteAllUserData|scheduler\.runAfter/,
      );
    },
  );

  test('[M-08] Consent record itself is retained (3-year COPPA requirement)', () => {
    // The withdrawConsent function must NOT delete the consent record
    // It should only patch the status — deletion is handled by the 3-year cron
    expect(withdrawBlock).toContain('ctx.db.patch');
    // Verify the cron exists for old consent record cleanup
    const cronsSource = readSourceFile('convex/crons.ts');
    expect(cronsSource).toContain('old consent record cleanup');
    // The cron should reference the consent cleanup function
    expect(cronsSource).toMatch(/consent\.cleanupOldConsentRecords/);
  });
});
