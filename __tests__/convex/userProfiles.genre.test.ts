/**
 * US-002: Genre preference in updateProfile mutation
 *
 * Verifies that the updateProfile mutation correctly handles
 * the preferredGenre field — including it in patched fields
 * when provided, and excluding it when omitted.
 */

// Valid genre values matching genreValidator in convex/schema.ts
const VALID_GENRES = [
  'Mystery',
  'Fantasy',
  'Comedy',
  'Horror',
  'Fiction',
  'Fairy Tale',
] as const;

// --- Mock infrastructure ---

const mockPatch = jest.fn();
const mockFirst = jest.fn();

// Simulate the Convex db and auth context
const createMockCtx = (profile: Record<string, unknown> | null = null) => {
  mockFirst.mockResolvedValue(profile);
  mockPatch.mockResolvedValue(undefined);

  return {
    db: {
      query: jest.fn(() => ({
        withIndex: jest.fn(() => ({
          first: mockFirst,
        })),
      })),
      patch: mockPatch,
    },
    auth: {
      getUserIdentity: jest.fn().mockResolvedValue({
        subject: 'user_test123',
        tokenIdentifier: 'https://clerk.dev|user_test123',
      }),
    },
  };
};

// Mock auth module
jest.mock('../../convex/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue(undefined),
  getClerkUserId: jest.fn().mockResolvedValue('user_test123'),
}));

// Mock Convex server to extract handler logic
jest.mock('../../convex/_generated/server', () => ({
  query: jest.fn((config: { handler: Function }) => config),
  mutation: jest.fn((config: { handler: Function }) => config),
}));

// Import after mocks are set up
import * as userProfiles from '../../convex/userProfiles';

const existingProfile = {
  _id: 'profile_abc123' as unknown,
  clerkUserId: 'user_test123',
  username: 'testuser',
  displayName: 'Test User',
  totalXp: 500,
  currentStreak: 3,
  longestStreak: 5,
  lastActivityDate: '2026-03-01',
  bestScore: 100,
  totalGamesPlayed: 10,
  totalStoriesCompleted: 5,
  totalWordsWritten: 2000,
  preferredGradeLevel: 'K-2',
  speechEnabled: true,
  onboardingCompleted: true,
  onboardingProgress: {
    create_account: true,
    first_story: true,
    first_image: false,
    first_voice: false,
    first_streak: true,
  },
};

describe('US-002: updateProfile with preferredGenre', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('includes preferredGenre in patched fields when provided', async () => {
    const ctx = createMockCtx(existingProfile);
    const updateProfile = userProfiles.updateProfile as unknown as {
      handler: Function;
    };

    await updateProfile.handler(ctx, {
      clerkUserId: 'user_test123',
      updates: { preferredGenre: 'Mystery' },
    });

    expect(mockPatch).toHaveBeenCalledWith(existingProfile._id, {
      preferredGenre: 'Mystery',
    });
  });

  it('excludes preferredGenre from patched fields when not provided', async () => {
    const ctx = createMockCtx(existingProfile);
    const updateProfile = userProfiles.updateProfile as unknown as {
      handler: Function;
    };

    await updateProfile.handler(ctx, {
      clerkUserId: 'user_test123',
      updates: { speechEnabled: false },
    });

    expect(mockPatch).toHaveBeenCalledWith(existingProfile._id, {
      speechEnabled: false,
    });
    // preferredGenre should NOT be in the patch
    const patchedFields = mockPatch.mock.calls[0][1];
    expect(patchedFields).not.toHaveProperty('preferredGenre');
  });

  it.each(VALID_GENRES)(
    'accepts genre "%s" and patches it correctly',
    async genre => {
      const ctx = createMockCtx(existingProfile);
      const updateProfile = userProfiles.updateProfile as unknown as {
        handler: Function;
      };

      await updateProfile.handler(ctx, {
        clerkUserId: 'user_test123',
        updates: { preferredGenre: genre },
      });

      expect(mockPatch).toHaveBeenCalledWith(existingProfile._id, {
        preferredGenre: genre,
      });
    },
  );

  it('patches preferredGenre alongside other fields', async () => {
    const ctx = createMockCtx(existingProfile);
    const updateProfile = userProfiles.updateProfile as unknown as {
      handler: Function;
    };

    await updateProfile.handler(ctx, {
      clerkUserId: 'user_test123',
      updates: {
        preferredGenre: 'Fantasy',
        displayName: 'New Name',
        speechEnabled: false,
      },
    });

    expect(mockPatch).toHaveBeenCalledWith(existingProfile._id, {
      preferredGenre: 'Fantasy',
      displayName: 'New Name',
      speechEnabled: false,
    });
  });

  it('throws when profile is not found', async () => {
    const ctx = createMockCtx(null);
    const updateProfile = userProfiles.updateProfile as unknown as {
      handler: Function;
    };

    await expect(
      updateProfile.handler(ctx, {
        clerkUserId: 'user_test123',
        updates: { preferredGenre: 'Comedy' },
      }),
    ).rejects.toThrow('Profile not found');
  });

  it("throws when updating another user's profile", async () => {
    const ctx = createMockCtx(existingProfile);
    const updateProfile = userProfiles.updateProfile as unknown as {
      handler: Function;
    };

    // getClerkUserId returns 'user_test123' but we're trying to update 'user_other'
    await expect(
      updateProfile.handler(ctx, {
        clerkUserId: 'user_other',
        updates: { preferredGenre: 'Horror' },
      }),
    ).rejects.toThrow('Unauthorized');
  });
});
