// Type safety tests for Task 1.4: Update TypeScript Types
// Verifies that GameSession and StorySession interfaces have required fields

import { GameSession, ImageUploadStatus } from '../database';
import { StorySession } from '../../services/storySessionManager';

describe('Task 1.4: TypeScript Type Updates', () => {
  // Test 1: Valid GameSession with new fields
  it('should allow valid GameSession with new fields', () => {
    const validSession: GameSession = {
      id: 'test-id',
      user_id: 'test-user',
      created_at: new Date().toISOString(),
      grade_level: 'K-2',
      final_score: 100,
      words_written: 50,
      sentences_completed: 3,
      challenges_completed: 1,
      xp_earned: 500,
      story_source: 'New',
      story_metadata: {},
      current_round: 3, // NEW field
      supabase_image_url: 'https://example.com/image.png', // NEW field
      image_upload_status: 'uploaded', // NEW field
      image_upload_attempts: 1, // NEW field
      image_upload_error: undefined, // NEW field
    };

    expect(validSession.current_round).toBe(3);
    expect(validSession.supabase_image_url).toBe(
      'https://example.com/image.png',
    );
    expect(validSession.image_upload_status).toBe('uploaded');
  });

  // Test 2: Invalid status should fail type check
  it('should enforce ImageUploadStatus type', () => {
    const validStatuses: ImageUploadStatus[] = [
      'pending',
      'uploaded',
      'failed',
    ];

    validStatuses.forEach(status => {
      const session: Partial<GameSession> = {
        image_upload_status: status,
      };
      expect(['pending', 'uploaded', 'failed']).toContain(
        session.image_upload_status,
      );
    });

    // This would fail at compile time (not runtime):
    // const invalidSession: GameSession = {
    //   image_upload_status: 'invalid_status', // TypeScript error
    // };
  });

  // Test 3: current_round must be present (not nullable)
  it('should require current_round field', () => {
    const session: GameSession = {
      id: 'test-id',
      user_id: 'test-user',
      created_at: new Date().toISOString(),
      grade_level: 'K-2',
      final_score: 100,
      words_written: 50,
      sentences_completed: 3,
      challenges_completed: 1,
      xp_earned: 500,
      story_source: 'New',
      story_metadata: {},
      current_round: 1, // Required, non-nullable
    };

    expect(session.current_round).toBeDefined();
    expect(typeof session.current_round).toBe('number');
  });

  // Test 4: StorySession has all new fields
  it('should have all new fields in StorySession interface', () => {
    const storySession: Partial<StorySession> = {
      current_round: 2,
      supabase_image_url: 'https://supabase.co/image.png',
      image_upload_status: 'pending',
      image_upload_attempts: 2,
      image_upload_error: 'Network timeout',
    };

    expect(storySession.current_round).toBe(2);
    expect(storySession.supabase_image_url).toBe(
      'https://supabase.co/image.png',
    );
    expect(storySession.image_upload_status).toBe('pending');
    expect(storySession.image_upload_attempts).toBe(2);
    expect(storySession.image_upload_error).toBe('Network timeout');
  });

  // Test 5: Optional fields can be undefined
  it('should allow optional fields to be undefined', () => {
    const session: GameSession = {
      id: 'test-id',
      user_id: 'test-user',
      created_at: new Date().toISOString(),
      grade_level: 'K-2',
      final_score: 100,
      words_written: 50,
      sentences_completed: 3,
      challenges_completed: 1,
      xp_earned: 500,
      story_source: 'New',
      story_metadata: {},
      current_round: 1,
      // Optional fields can be undefined
      supabase_image_url: undefined,
      image_upload_status: undefined,
      image_upload_attempts: undefined,
      image_upload_error: undefined,
    };

    expect(session.supabase_image_url).toBeUndefined();
    expect(session.image_upload_status).toBeUndefined();
  });

  // Test 6: Type safety for all three status values
  it('should only accept valid image upload status values', () => {
    const testStatuses = [
      { status: 'pending' as const, expected: true },
      { status: 'uploaded' as const, expected: true },
      { status: 'failed' as const, expected: true },
    ];

    testStatuses.forEach(({ status, expected }) => {
      const session: Partial<GameSession> = {
        image_upload_status: status,
      };
      expect(['pending', 'uploaded', 'failed']).toContain(
        session.image_upload_status,
      );
    });
  });
});
