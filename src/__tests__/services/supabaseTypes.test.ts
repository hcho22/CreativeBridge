// Test file to validate Task 2.4: Updated Supabase types
// This test verifies that all new image generation types can be imported from supabase service

import {
  // Core types (existing)
  supabase,
  UserProfile,
  GameSession,
  GradeLevel,
  // Image generation types (Task 2.1 & 2.2 - NEW)
  ImageGenerationEvent,
  ImageGenerationEventInsert,
  ImageGenerationEventUpdate,
  ImageGenerationAnalytics,
  UserImageGenerationEvent,
  StoryWithImage,
  ImageGenerationStats,
  GenerationStatus,
  ErrorType,
  ServiceUsed,
} from '../../services/supabase';

describe('Task 2.4: Updated Supabase Types Validation', () => {
  describe('Core Types (Existing)', () => {
    it('should import core Supabase types successfully', () => {
      // Test that existing types are still available
      expect(typeof supabase).toBe('object');
      expect(supabase.from).toBeDefined();
      expect(supabase.rpc).toBeDefined();
    });

    it('should validate existing UserProfile type', () => {
      const userProfile: UserProfile = {
        id: 'user-123',
        username: 'testuser',
        display_name: 'Test User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        total_xp: 5000,
        current_streak: 7,
        longest_streak: 15,
        last_activity_date: new Date().toISOString(),
        best_score: 200,
        total_games_played: 25,
        total_stories_completed: 20,
        total_words_written: 1500,
        preferred_grade_level: 'K-2',
        speech_enabled: true,
      };

      expect(userProfile.username).toBe('testuser');
      expect(userProfile.preferred_grade_level).toBe('K-2');
    });

    it('should validate existing GameSession type with new image fields', () => {
      const gameSession: GameSession = {
        id: 'session-123',
        user_id: 'user-456',
        created_at: new Date().toISOString(),
        grade_level: 'K-2',
        final_score: 150,
        words_written: 85,
        sentences_completed: 7,
        challenges_completed: 3,
        xp_earned: 180,
        story_source: 'New',
        story_metadata: {},
        // NEW: Image generation fields from Task 2.1
        generated_image_url: 'https://example.com/image.jpg',
        image_generation_timestamp: new Date().toISOString(),
        image_generation_cost: 1000,
      };

      expect(gameSession.generated_image_url).toBeDefined();
      expect(gameSession.image_generation_cost).toBe(1000);
    });

    it('should validate GradeLevel enum type', () => {
      const gradeLevels: GradeLevel[] = ['K-2', '3-5', '6-8', '9-12'];

      gradeLevels.forEach(level => {
        expect(['K-2', '3-5', '6-8', '9-12']).toContain(level);
      });
    });
  });

  describe('Image Generation Types (Task 2.1 & 2.2 - NEW)', () => {
    it('should import ImageGenerationEvent type successfully', () => {
      const event: ImageGenerationEvent = {
        id: 'event-123',
        user_id: 'user-456',
        session_id: 'session-789',
        xp_cost: 1000,
        generation_status: 'success',
        error_type: undefined,
        service_used: 'replicate',
        api_response_time: 2500,
        image_url: 'https://example.com/generated-image.jpg',
        story_grade_level: 'K-2',
        story_word_count: 85,
        prompt_used: 'A colorful watercolor illustration...',
        metadata: { device: 'mobile' },
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };

      expect(event.generation_status).toBe('success');
      expect(event.service_used).toBe('replicate');
    });

    it('should import ImageGenerationEventInsert type successfully', () => {
      const eventInsert: ImageGenerationEventInsert = {
        user_id: 'user-123',
        session_id: 'session-456',
        xp_cost: 1000,
        generation_status: 'pending',
        service_used: 'replicate',
        story_grade_level: 'K-2',
        story_word_count: 75,
        metadata: { source: 'story_completion' },
      };

      expect(eventInsert.generation_status).toBe('pending');
      expect(eventInsert.service_used).toBe('replicate');
    });

    it('should import ImageGenerationEventUpdate type successfully', () => {
      const eventUpdate: ImageGenerationEventUpdate = {
        generation_status: 'success',
        image_url: 'https://example.com/final-image.jpg',
        api_response_time: 2100,
        completed_at: new Date().toISOString(),
      };

      expect(eventUpdate.generation_status).toBe('success');
      expect(eventUpdate.image_url).toBeDefined();
    });

    it('should import ImageGenerationAnalytics type successfully', () => {
      const analytics: ImageGenerationAnalytics = {
        total_attempts: 500,
        successful_generations: 425,
        failed_generations: 50,
        refunded_generations: 25,
        avg_response_time: 2750.5,
        most_common_error_type: 'timeout',
        total_xp_spent: 425000,
        replicate_usage: 450,
        backup_service_usage: 50,
      };

      expect(analytics.total_attempts).toBe(500);
      expect(analytics.successful_generations).toBe(425);
    });

    it('should import UserImageGenerationEvent type successfully', () => {
      const userEvent: UserImageGenerationEvent = {
        event_id: 'event-789',
        session_id: 'session-123',
        xp_cost: 1000,
        generation_status: 'success',
        error_type: undefined,
        service_used: 'replicate',
        api_response_time: 2300,
        image_url: 'https://example.com/image.jpg',
        story_grade_level: '3-5',
        story_word_count: 95,
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };

      expect(userEvent.event_id).toBe('event-789');
      expect(userEvent.generation_status).toBe('success');
    });

    it('should import StoryWithImage type successfully', () => {
      const storyWithImage: StoryWithImage = {
        session_id: 'session-789',
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        story_content: 'A magical adventure...',
        generated_image_url: 'https://example.com/magic-adventure.jpg',
        image_generation_timestamp: new Date().toISOString(),
        image_generation_cost: 1000,
        final_score: 200,
        words_written: 120,
      };

      expect(storyWithImage.session_id).toBe('session-789');
      expect(storyWithImage.generated_image_url).toContain(
        'magic-adventure.jpg',
      );
    });

    it('should import ImageGenerationStats type successfully', () => {
      const stats: ImageGenerationStats = {
        total_images_generated: 150,
        avg_generation_cost: 985.5,
        images_generated_today: 12,
        images_generated_this_week: 45,
        images_generated_this_month: 150,
      };

      expect(stats.total_images_generated).toBe(150);
      expect(stats.avg_generation_cost).toBeCloseTo(985.5);
    });

    it('should import enum types successfully', () => {
      const validStatuses: GenerationStatus[] = [
        'pending',
        'success',
        'failed',
        'refunded',
        'timeout',
      ];
      const validErrors: ErrorType[] = [
        'api_failure',
        'content_safety',
        'insufficient_xp',
        'timeout',
        'rate_limit',
      ];
      const validServices: ServiceUsed[] = ['replicate', 'backup_service'];

      validStatuses.forEach(status => {
        expect([
          'pending',
          'success',
          'failed',
          'refunded',
          'timeout',
        ]).toContain(status);
      });

      validErrors.forEach(error => {
        expect([
          'api_failure',
          'content_safety',
          'insufficient_xp',
          'timeout',
          'rate_limit',
        ]).toContain(error);
      });

      validServices.forEach(service => {
        expect(['replicate', 'backup_service']).toContain(service);
      });
    });
  });

  describe('Database Type Integration', () => {
    it('should validate Database type includes new tables and functions', () => {
      // Test that the Database type is properly structured
      // This validates that our type system is correctly integrated

      // Mock a database operation to test type inference
      const mockDatabaseOperation = async () => {
        // These should all have proper type inference from our Database type
        const gameSessionQuery = supabase.from('game_sessions').select('*');
        const imageEventsQuery = supabase
          .from('image_generation_events')
          .select('*');

        const createEventRpc = supabase.rpc('create_image_generation_event', {
          p_user_id: 'user-123',
          p_session_id: 'session-456',
          p_xp_cost: 1000,
          p_story_grade_level: 'K-2',
          p_story_word_count: 75,
          p_metadata: {},
        });

        const updateEventRpc = supabase.rpc('update_image_generation_event', {
          p_event_id: 'event-123',
          p_status: 'success' as GenerationStatus,
          p_image_url: 'https://example.com/image.jpg',
          p_service_used: 'replicate' as ServiceUsed,
          p_api_response_time: 2500,
        });

        // These operations should be properly typed
        expect(gameSessionQuery).toBeDefined();
        expect(imageEventsQuery).toBeDefined();
        expect(createEventRpc).toBeDefined();
        expect(updateEventRpc).toBeDefined();
      };

      expect(mockDatabaseOperation).toBeDefined();
    });

    it('should validate backward compatibility with existing code', () => {
      // Test that existing code still works after adding new types
      const existingUserProfileQuery = supabase
        .from('user_profiles')
        .select('*');
      const existingGameSessionQuery = supabase
        .from('game_sessions')
        .select('*');

      expect(existingUserProfileQuery).toBeDefined();
      expect(existingGameSessionQuery).toBeDefined();
    });
  });
});
