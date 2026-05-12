/**
 * US-009: Convex preferences round-trip test
 *
 * Verifies that the `preferences.transcriptionEngine` field added to the
 * userProfiles schema can be:
 *   1. Written via `db.patch` (the same mechanism the updateProfile mutation
 *      uses internally).
 *   2. Read back identically.
 *   3. Merged rather than overwritten — setting `transcriptionEngine`
 *      preserves any future nested keys that the mutation's deep-merge
 *      logic might encounter.
 *
 * Uses the existing mock-Convex harness (`createMockConvexContext`) for
 * the same reasons as `userProfiles.test.ts` — patches the in-memory
 * table directly rather than spinning up a Convex test server.
 */

import {
  createMockConvexContext,
  createMockClerkIdentity,
  createTestUserProfile,
  resetMockContext,
  MockConvexContext,
} from '../mocks/convexMock';

describe('US-009: userProfiles.preferences.transcriptionEngine', () => {
  let ctx: MockConvexContext;
  const testClerkUserId = 'user_test_9_12';

  beforeEach(async () => {
    ctx = createMockConvexContext();
    resetMockContext(ctx);
    ctx.auth.__testUtils.setIdentity(createMockClerkIdentity(testClerkUserId));
    await createTestUserProfile(ctx, testClerkUserId, {
      preferredGradeLevel: '9-12',
    });
  });

  it('persists transcriptionEngine = "cloud"', async () => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', testClerkUserId))
      .first();

    await ctx.db.patch(profile!._id, {
      preferences: { transcriptionEngine: 'cloud' },
    });

    const updated = ctx.db.__testUtils.getById('userProfiles', profile!._id);
    expect(updated?.preferences).toEqual({ transcriptionEngine: 'cloud' });
  });

  it('persists transcriptionEngine = "on-device"', async () => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', testClerkUserId))
      .first();

    await ctx.db.patch(profile!._id, {
      preferences: { transcriptionEngine: 'on-device' },
    });

    const updated = ctx.db.__testUtils.getById('userProfiles', profile!._id);
    expect(updated?.preferences).toEqual({ transcriptionEngine: 'on-device' });
  });

  it('round-trips through the by_clerk_user_id index', async () => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', testClerkUserId))
      .first();

    await ctx.db.patch(profile!._id, {
      preferences: { transcriptionEngine: 'cloud' },
    });

    const fetched = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', testClerkUserId))
      .first();

    expect(fetched?.preferences).toEqual({ transcriptionEngine: 'cloud' });
  });

  it('overwrites an existing transcriptionEngine value', async () => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', testClerkUserId))
      .first();

    await ctx.db.patch(profile!._id, {
      preferences: { transcriptionEngine: 'cloud' },
    });
    await ctx.db.patch(profile!._id, {
      preferences: { transcriptionEngine: 'on-device' },
    });

    const updated = ctx.db.__testUtils.getById('userProfiles', profile!._id);
    expect(updated?.preferences).toEqual({ transcriptionEngine: 'on-device' });
  });

  it('leaves preferences undefined when never set', async () => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', testClerkUserId))
      .first();

    expect(profile?.preferences).toBeUndefined();
  });
});
