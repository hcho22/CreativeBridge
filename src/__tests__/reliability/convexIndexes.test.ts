/**
 * Convex Index Tests (US-004 R-4.5/R-4.6)
 *
 * Tests that Convex queries use correct indexes and avoid full table scans:
 * - getUserImageGenerationEvents uses by_clerk_user index
 * - getImageGenerationAnalytics does not use bare .collect()
 * - getDailyImageGenerationStats uses indexed filtering
 * - dataRetention uses paginated queries, not .collect()
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Convex Index Tests (R-4.5/R-4.6)', () => {
  const convexDir = path.join(__dirname, '..', '..', '..', 'convex');

  test('getUserImageGenerationEvents uses by_clerk_user index', () => {
    const imageGenCode = fs.readFileSync(
      path.join(convexDir, 'imageGeneration.ts'),
      'utf-8',
    );

    // Find the getUserImageGenerationEvents function
    const funcMatch = imageGenCode.match(
      /export const getUserImageGenerationEvents[\s\S]*?handler:[\s\S]*?(?=export const|$)/,
    );
    expect(funcMatch).toBeTruthy();

    const funcCode = funcMatch![0];

    // Should use by_clerk_user index
    expect(funcCode).toContain("withIndex('by_clerk_user'");
    // Should NOT use old by_user index with clerkUserId filter
    expect(funcCode).not.toContain("withIndex('by_user')");
  });

  test('getImageGenerationAnalytics does NOT use bare .collect() without filtering', () => {
    const imageGenCode = fs.readFileSync(
      path.join(convexDir, 'imageGeneration.ts'),
      'utf-8',
    );

    // Find the getImageGenerationAnalytics function
    const funcMatch = imageGenCode.match(
      /export const getImageGenerationAnalytics[\s\S]*?handler:[\s\S]*?(?=export const|$)/,
    );
    expect(funcMatch).toBeTruthy();

    const funcCode = funcMatch![0];

    // Should NOT have a bare query('imageGenerationEvents').collect() pattern
    expect(funcCode).not.toMatch(
      /query\(['"]imageGenerationEvents['"]\)\s*\.collect\(\)/,
    );

    // Should use either by_clerk_user index or .take() for bounded queries
    const usesIndex = funcCode.includes("withIndex('by_clerk_user'");
    const usesTake = funcCode.includes('.take(');
    expect(usesIndex || usesTake).toBe(true);
  });

  test('getDailyImageGenerationStats uses indexed filtering when user specified', () => {
    const imageGenCode = fs.readFileSync(
      path.join(convexDir, 'imageGeneration.ts'),
      'utf-8',
    );

    // Find the getDailyImageGenerationStats function
    const funcMatch = imageGenCode.match(
      /export const getDailyImageGenerationStats[\s\S]*?handler:[\s\S]*?(?=export const|$)/,
    );
    expect(funcMatch).toBeTruthy();

    const funcCode = funcMatch![0];

    // Should use by_clerk_user index when clerkUserId is provided
    expect(funcCode).toContain("withIndex('by_clerk_user'");
  });

  test('dataRetention uses paginated queries, not bare .collect() on full tables', () => {
    const dataRetentionCode = fs.readFileSync(
      path.join(convexDir, 'dataRetention.ts'),
      'utf-8',
    );

    // Should NOT have bare query('gameSessions').collect() or query('imageGenerationEvents').collect()
    expect(dataRetentionCode).not.toMatch(
      /query\(['"]gameSessions['"]\)\s*\.collect\(\)/,
    );
    expect(dataRetentionCode).not.toMatch(
      /query\(['"]imageGenerationEvents['"]\)\s*\.collect\(\)/,
    );
    expect(dataRetentionCode).not.toMatch(
      /query\(['"]migrationEvents['"]\)\s*\.collect\(\)/,
    );

    // Should use .take() or bounded queries
    expect(dataRetentionCode).toContain('.take(');
  });
});
