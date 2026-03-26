/**
 * Consent Security Validation Tests
 *
 * Verifies that consent flow does not expose consentToken or parentEmail
 * to the client, and that verifyAndGrantConsent requires email verification.
 *
 * @implements US-002: S-2.6, S-2.7, S-2.8
 */

import * as fs from 'fs';
import * as path from 'path';

const CONVEX_DIR = path.resolve(__dirname, '../../../convex');

function readConvexFile(filename: string): string {
  return fs.readFileSync(path.join(CONVEX_DIR, filename), 'utf-8');
}

describe('Consent Security Validation (US-002 S-2.6/S-2.7/S-2.8)', () => {
  let consentSource: string;

  beforeAll(() => {
    consentSource = readConvexFile('consent.ts');
  });

  test('getConsentStatus does not return consentToken as a key', () => {
    // Find the getConsentStatus return block
    const fnBlock = extractFunctionBlock(consentSource, 'getConsentStatus');
    // The return object should not contain consentToken as a key
    // (consentTokenExpiresAt as a source field is fine, but consentToken: as a return key is not)
    const returnMatch = fnBlock.match(/return\s*\{[\s\S]*?\};/g);
    expect(returnMatch).not.toBeNull();
    const returnStatements = returnMatch!.join('\n');
    const objectReturns = returnStatements.replace(/return null;/g, '');
    // Check that consentToken is not used as a return key (key: value pattern)
    expect(objectReturns).not.toMatch(/^\s*consentToken\s*:/m);
  });

  test('getConsentStatus does not return parentEmail', () => {
    const fnBlock = extractFunctionBlock(consentSource, 'getConsentStatus');
    const returnMatch = fnBlock.match(/return\s*\{[\s\S]*?\};/g);
    expect(returnMatch).not.toBeNull();
    const objectReturns = returnMatch!.join('\n').replace(/return null;/g, '');
    expect(objectReturns).not.toContain('parentEmail');
  });

  test('getConsentStatus derives user from auth context', () => {
    const fnBlock = extractFunctionBlock(consentSource, 'getConsentStatus');
    expect(fnBlock).toContain('getClerkUserId(ctx)');
    expect(fnBlock).not.toMatch(/args:\s*\{[^}]*clerkUserId/);
  });

  test('submitParentEmail does not return consentToken', () => {
    const fnBlock = extractFunctionBlock(consentSource, 'submitParentEmail');
    // Find the final return statement in the function
    const returnStatements = fnBlock.match(/return\s*\{[\s\S]*?\};/g);
    expect(returnStatements).not.toBeNull();
    const lastReturn = returnStatements![returnStatements!.length - 1];
    expect(lastReturn).not.toContain('consentToken');
  });

  test('verifyAndGrantConsent requires parentEmail argument', () => {
    const fnBlock = extractFunctionBlock(
      consentSource,
      'verifyAndGrantConsent',
    );
    // Should have parentEmail in args
    expect(fnBlock).toMatch(/args:\s*\{[\s\S]*parentEmail:\s*v\.string\(\)/);
  });

  test('verifyAndGrantConsent verifies email matches record', () => {
    const fnBlock = extractFunctionBlock(
      consentSource,
      'verifyAndGrantConsent',
    );
    // Should compare parentEmail from args with record
    expect(fnBlock).toMatch(/parentEmail.*toLowerCase|email.*verification/i);
  });

  test('sendConsentEmail does not accept consentToken as argument', () => {
    const fnBlock = extractFunctionBlock(consentSource, 'sendConsentEmail');
    const argsMatch = fnBlock.match(/args:\s*\{([\s\S]*?)\}/);
    expect(argsMatch).not.toBeNull();
    expect(argsMatch![1]).not.toContain('consentToken');
  });
});

function extractFunctionBlock(source: string, fnName: string): string {
  const pattern = new RegExp(
    `export const ${fnName} = (?:query|mutation|action)\\(\\{[\\s\\S]*?^\\}\\);`,
    'm',
  );
  const match = source.match(pattern);
  return match ? match[0] : '';
}
