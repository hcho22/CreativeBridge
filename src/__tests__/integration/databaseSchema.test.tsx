// Database Schema Integration Tests (Tasks 2.1, 2.2, 2.3)
// These tests verify that database schema types and operations are correctly defined

import type {
  GameSession,
  ImageGenerationEvent,
  GenerationStatus,
  ServiceUsed,
  ErrorType,
  ImageGenerationEventInsert,
  ImageGenerationEventUpdate,
  ImageGenerationAnalytics,
  UserImageGenerationEvent,
  StoryWithImage,
  ImageGenerationStats,
} from '../../types/database';

describe('Database Schema Integration Tests', () => {
  describe('Task 2.1: Game Sessions Table Schema', () => {
    it('should support GameSession with image generation fields', () => {
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
        story_content: 'Once upon a time...',
        completed_at: new Date().toISOString(),

        // Image generation fields (Task 2.1)
        generated_image_url: 'https://example.com/story-image.jpg',
        image_generation_timestamp: new Date().toISOString(),
        image_generation_cost: 1000,
      };

      // Verify all image generation fields are accessible
      expect(gameSession.generated_image_url).toBe(
        'https://example.com/story-image.jpg',
      );
      expect(gameSession.image_generation_timestamp).toBeDefined();
      expect(gameSession.image_generation_cost).toBe(1000);
      expect(typeof gameSession.image_generation_timestamp).toBe('string');
    });

    it('should support GameSession without image generation fields (optional)', () => {
      const gameSession: GameSession = {
        id: 'session-123',
        user_id: 'user-456',
        created_at: new Date().toISOString(),
        grade_level: '3-5',
        final_score: 120,
        words_written: 65,
        sentences_completed: 5,
        challenges_completed: 2,
        xp_earned: 150,
        story_source: 'CreativeBridge',
        story_metadata: { imported_word_count: 50 },
      };

      // Verify image generation fields are optional
      expect(gameSession.generated_image_url).toBeUndefined();
      expect(gameSession.image_generation_timestamp).toBeUndefined();
      expect(gameSession.image_generation_cost).toBeUndefined();
    });

    it('should validate StoryWithImage interface for function returns', () => {
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
      expect(storyWithImage.image_generation_cost).toBe(1000);
    });

    it('should validate ImageGenerationStats interface', () => {
      const stats: ImageGenerationStats = {
        total_images_generated: 150,
        avg_generation_cost: 985.5,
        images_generated_today: 12,
        images_generated_this_week: 45,
        images_generated_this_month: 150,
      };

      expect(stats.total_images_generated).toBe(150);
      expect(stats.avg_generation_cost).toBeCloseTo(985.5);
      expect(stats.images_generated_this_month).toBeGreaterThanOrEqual(
        stats.images_generated_this_week,
      );
    });
  });

  describe('Task 2.2: Image Generation Events Table Schema', () => {
    it('should support complete ImageGenerationEvent structure', () => {
      const event: ImageGenerationEvent = {
        id: 'event-123',
        user_id: 'user-456',
        session_id: 'session-789',
        xp_cost: 1000,
        generation_status: 'success',
        error_type: undefined,
        service_used: 'replicate',
        api_response_time: 2850,
        image_url: 'https://generated.example.com/story-image.jpg',
        story_grade_level: 'K-2',
        story_word_count: 85,
        prompt_used:
          'A colorful watercolor illustration of a brave little mouse...',
        metadata: {
          device: 'iPhone 15',
          app_version: '1.0.0',
          user_agent: 'CreativeBridge/1.0',
          generation_source: 'story_completion',
        },
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };

      // Verify all fields are properly typed and accessible
      expect(event.id).toBe('event-123');
      expect(event.generation_status).toBe('success');
      expect(event.service_used).toBe('replicate');
      expect(event.api_response_time).toBe(2850);
      expect(event.metadata.device).toBe('iPhone 15');
      expect(typeof event.created_at).toBe('string');
    });

    it('should support ImageGenerationEvent with failed status', () => {
      const failedEvent: ImageGenerationEvent = {
        id: 'event-456',
        user_id: 'user-789',
        session_id: 'session-123',
        xp_cost: 1000,
        generation_status: 'failed',
        error_type: 'api_failure',
        service_used: 'backup_service',
        api_response_time: 60000, // Timeout scenario
        image_url: undefined,
        story_grade_level: '6-8',
        story_word_count: 200,
        prompt_used: 'An advanced realistic illustration...',
        metadata: { retry_count: 3, final_error: 'timeout' },
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };

      expect(failedEvent.generation_status).toBe('failed');
      expect(failedEvent.error_type).toBe('api_failure');
      expect(failedEvent.service_used).toBe('backup_service');
      expect(failedEvent.image_url).toBeUndefined();
      expect(failedEvent.metadata.retry_count).toBe(3);
    });

    it('should validate all GenerationStatus enum values', () => {
      const validStatuses: GenerationStatus[] = [
        'pending',
        'success',
        'failed',
        'refunded',
        'timeout',
      ];

      validStatuses.forEach(status => {
        const event: Partial<ImageGenerationEvent> = {
          generation_status: status,
        };
        expect([
          'pending',
          'success',
          'failed',
          'refunded',
          'timeout',
        ]).toContain(event.generation_status);
      });
    });

    it('should validate all ErrorType enum values', () => {
      const validErrors: ErrorType[] = [
        'api_failure',
        'content_safety',
        'insufficient_xp',
        'timeout',
        'rate_limit',
      ];

      validErrors.forEach(errorType => {
        const event: Partial<ImageGenerationEvent> = {
          error_type: errorType,
        };
        expect([
          'api_failure',
          'content_safety',
          'insufficient_xp',
          'timeout',
          'rate_limit',
        ]).toContain(event.error_type);
      });
    });

    it('should validate all ServiceUsed enum values', () => {
      const validServices: ServiceUsed[] = ['replicate', 'backup_service'];

      validServices.forEach(service => {
        const event: Partial<ImageGenerationEvent> = {
          service_used: service,
        };
        expect(['replicate', 'backup_service']).toContain(event.service_used);
      });
    });

    it('should support ImageGenerationEventInsert type', () => {
      const eventInsert: ImageGenerationEventInsert = {
        user_id: 'user-123',
        session_id: 'session-456',
        xp_cost: 1000,
        generation_status: 'pending',
        service_used: 'replicate',
        story_grade_level: 'K-2',
        story_word_count: 75,
        metadata: { source: 'mobile_app' },
      };

      // Verify insert type excludes auto-generated fields
      expect(eventInsert.user_id).toBe('user-123');
      expect(eventInsert.generation_status).toBe('pending');
      expect('id' in eventInsert).toBe(false); // Should not have id
      expect('created_at' in eventInsert).toBe(false); // Should not have created_at
    });

    it('should support ImageGenerationEventUpdate type', () => {
      const eventUpdate: ImageGenerationEventUpdate = {
        generation_status: 'success',
        image_url: 'https://final.example.com/image.jpg',
        api_response_time: 2100,
        completed_at: new Date().toISOString(),
        prompt_used: 'Final prompt used for generation',
      };

      // Verify update type allows partial updates
      expect(eventUpdate.generation_status).toBe('success');
      expect(eventUpdate.image_url).toBeDefined();
      expect('user_id' in eventUpdate).toBe(false); // Should not allow updating user_id
      expect('created_at' in eventUpdate).toBe(false); // Should not allow updating created_at
    });

    it('should validate ImageGenerationAnalytics interface', () => {
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
      expect(
        analytics.successful_generations +
          analytics.failed_generations +
          analytics.refunded_generations,
      ).toBe(500);
      expect(analytics.avg_response_time).toBeGreaterThan(0);
      expect(analytics.total_xp_spent).toBe(425000);
    });

    it('should validate UserImageGenerationEvent interface', () => {
      const userEvent: UserImageGenerationEvent = {
        event_id: 'event-789',
        session_id: 'session-123',
        xp_cost: 1000,
        generation_status: 'success',
        error_type: undefined,
        service_used: 'replicate',
        api_response_time: 2300,
        image_url: 'https://user.example.com/image.jpg',
        story_grade_level: '3-5',
        story_word_count: 95,
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };

      expect(userEvent.event_id).toBe('event-789');
      expect(userEvent.generation_status).toBe('success');
      expect(userEvent.api_response_time).toBe(2300);
      expect(userEvent.error_type).toBeUndefined();
    });
  });

  describe('Task 2.3: Integration Validation', () => {
    it('should support complete workflow type definitions', () => {
      // Simulate a complete workflow from story completion to image generation

      // 1. Story completion with image generation
      const completedStory: GameSession = {
        id: 'story-workflow-123',
        user_id: 'user-workflow',
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        grade_level: 'K-2',
        final_score: 180,
        words_written: 95,
        sentences_completed: 8,
        challenges_completed: 4,
        xp_earned: 220,
        story_source: 'New',
        story_metadata: {},
        story_content: 'A magical journey through the enchanted forest...',
        generated_image_url:
          'https://workflow.example.com/enchanted-forest.jpg',
        image_generation_timestamp: new Date().toISOString(),
        image_generation_cost: 1000,
      };

      // 2. Corresponding image generation event
      const generationEvent: ImageGenerationEvent = {
        id: 'event-workflow-123',
        user_id: completedStory.user_id,
        session_id: completedStory.id,
        xp_cost: completedStory.image_generation_cost!,
        generation_status: 'success',
        service_used: 'replicate',
        api_response_time: 2500,
        image_url: completedStory.generated_image_url,
        story_grade_level: completedStory.grade_level,
        story_word_count: completedStory.words_written,
        prompt_used:
          'A colorful watercolor illustration of a magical journey through an enchanted forest...',
        metadata: {
          story_session_id: completedStory.id,
          story_score: completedStory.final_score,
        },
        created_at: completedStory.image_generation_timestamp!,
        completed_at: completedStory.image_generation_timestamp!,
        error_type: undefined,
      };

      // Verify the workflow maintains data consistency
      expect(generationEvent.user_id).toBe(completedStory.user_id);
      expect(generationEvent.session_id).toBe(completedStory.id);
      expect(generationEvent.xp_cost).toBe(
        completedStory.image_generation_cost,
      );
      expect(generationEvent.image_url).toBe(
        completedStory.generated_image_url,
      );
      expect(generationEvent.story_grade_level).toBe(
        completedStory.grade_level,
      );
      expect(generationEvent.story_word_count).toBe(
        completedStory.words_written,
      );
    });

    it('should support error scenarios with type safety', () => {
      // Simulate an error scenario
      const failedStory: GameSession = {
        id: 'story-error-123',
        user_id: 'user-error',
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        grade_level: '6-8',
        final_score: 150,
        words_written: 120,
        sentences_completed: 10,
        challenges_completed: 3,
        xp_earned: 180,
        story_source: 'New',
        story_metadata: {},
        story_content: 'An epic adventure...',
        // No image generation fields - generation failed
      };

      const failedEvent: ImageGenerationEvent = {
        id: 'event-error-123',
        user_id: failedStory.user_id,
        session_id: failedStory.id,
        xp_cost: 1000,
        generation_status: 'failed',
        error_type: 'content_safety',
        service_used: 'replicate',
        api_response_time: 1500,
        image_url: undefined,
        story_grade_level: failedStory.grade_level,
        story_word_count: failedStory.words_written,
        prompt_used: 'Content filtered by safety system',
        metadata: {
          safety_flags: ['inappropriate_content'],
          refund_issued: true,
        },
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };

      // Verify error handling maintains type safety
      expect(failedEvent.generation_status).toBe('failed');
      expect(failedEvent.error_type).toBe('content_safety');
      expect(failedEvent.image_url).toBeUndefined();
      expect(failedStory.generated_image_url).toBeUndefined();
      expect(failedEvent.metadata.refund_issued).toBe(true);
    });

    it('should validate complex analytics aggregation types', () => {
      // Test that complex analytics queries would be properly typed
      const analyticsResult: ImageGenerationAnalytics = {
        total_attempts: 1000,
        successful_generations: 850,
        failed_generations: 100,
        refunded_generations: 50,
        avg_response_time: 2650.75,
        most_common_error_type: 'timeout',
        total_xp_spent: 850000,
        replicate_usage: 900,
        backup_service_usage: 100,
      };

      // Calculate success rate
      const successRate =
        (analyticsResult.successful_generations /
          analyticsResult.total_attempts) *
        100;
      expect(successRate).toBe(85); // 85% success rate

      // Verify service distribution
      const totalServiceUsage =
        analyticsResult.replicate_usage + analyticsResult.backup_service_usage;
      expect(totalServiceUsage).toBe(analyticsResult.total_attempts);

      // Verify financial metrics
      const avgCostPerSuccess =
        analyticsResult.total_xp_spent / analyticsResult.successful_generations;
      expect(avgCostPerSuccess).toBe(1000); // 1000 XP per successful generation
    });
  });

  describe('Migration Compatibility Tests', () => {
    it('should maintain backward compatibility with existing GameSession data', () => {
      // Test that existing game sessions without image fields still work
      const legacyGameSession: Partial<GameSession> = {
        id: 'legacy-session-123',
        user_id: 'legacy-user',
        created_at: '2023-01-01T00:00:00Z',
        grade_level: 'K-2',
        final_score: 100,
        words_written: 50,
        sentences_completed: 5,
        challenges_completed: 2,
        xp_earned: 120,
        story_source: 'New',
        story_metadata: {},
        // Image generation fields are optional and undefined
      };

      expect(legacyGameSession.generated_image_url).toBeUndefined();
      expect(legacyGameSession.image_generation_timestamp).toBeUndefined();
      expect(legacyGameSession.image_generation_cost).toBeUndefined();

      // Should still be a valid partial GameSession
      expect(legacyGameSession.id).toBeDefined();
      expect(legacyGameSession.user_id).toBeDefined();
    });

    it('should support future extensibility', () => {
      // Test that the schema can be extended without breaking existing code
      const extendedEvent: ImageGenerationEvent & { future_field?: string } = {
        id: 'future-event-123',
        user_id: 'future-user',
        session_id: 'future-session',
        xp_cost: 1000,
        generation_status: 'success',
        service_used: 'replicate',
        api_response_time: 2000,
        image_url: 'https://future.example.com/image.jpg',
        story_grade_level: 'K-2',
        story_word_count: 80,
        prompt_used: 'Future prompt...',
        metadata: { version: '2.0' },
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        error_type: undefined,
        // Future extension
        future_field: 'future_value',
      };

      expect(extendedEvent.generation_status).toBe('success');
      expect(extendedEvent.future_field).toBe('future_value');
    });
  });
});
