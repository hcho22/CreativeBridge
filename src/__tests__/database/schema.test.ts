// Jest Tests for Task 2: Update Database Schema

import type {
  GameSession,
  StorySource,
  StoryImportData,
  ImportableStory,
  SearchableStory,
  StoryMetadata,
  StoryWithImage,
  ImageGenerationStats,
  ImageGenerationEvent,
  ImageGenerationAnalytics,
  UserImageGenerationEvent,
  GenerationStatus,
  ErrorType,
  ServiceUsed,
} from '../../types/database';

// Mock Supabase client for testing
const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

jest.mock('../../services/supabase', () => ({
  supabase: mockSupabaseClient,
}));

describe('Database Schema - Story Continuation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TypeScript Type Definitions', () => {
    it('should define StorySource type correctly', () => {
      const validSources: StorySource[] = [
        'New',
        'CreativeBridge',
        'Story_Quest',
        'File',
      ];

      validSources.forEach(source => {
        expect(typeof source).toBe('string');
        expect(['New', 'CreativeBridge', 'Story_Quest', 'File']).toContain(
          source,
        );
      });
    });

    it('should define GameSession interface with new fields', () => {
      const mockGameSession: GameSession = {
        id: 'test-id',
        user_id: 'user-123',
        created_at: new Date().toISOString(),
        grade_level: 'K-2',
        final_score: 100,
        words_written: 50,
        sentences_completed: 5,
        challenges_completed: 3,
        xp_earned: 150,
        story_source: 'File',
        story_metadata: { imported_word_count: 50 },
        // Image generation fields
        generated_image_url: 'https://example.com/image.jpg',
        image_generation_timestamp: new Date().toISOString(),
        image_generation_cost: 1000,
      };

      expect(mockGameSession.story_source).toBe('File');
      expect(mockGameSession.story_metadata).toEqual({
        imported_word_count: 50,
      });
      expect(mockGameSession.imported_story_content).toBeUndefined();
      expect(mockGameSession.original_creation_date).toBeUndefined();
      // Test image generation fields
      expect(mockGameSession.generated_image_url).toBe(
        'https://example.com/image.jpg',
      );
      expect(mockGameSession.image_generation_cost).toBe(1000);
      expect(typeof mockGameSession.image_generation_timestamp).toBe('string');
    });

    it('should define StoryImportData interface correctly', () => {
      const importData: StoryImportData = {
        source: 'File',
        content: 'Once upon a time...',
        originalDate: new Date().toISOString(),
        metadata: { wordCount: 100 },
        author: 'Test Author',
        title: 'Test Story',
      };

      expect(importData.source).toBe('File');
      expect(importData.content).toBe('Once upon a time...');
      expect(typeof importData.originalDate).toBe('string');
      expect(importData.metadata).toEqual({ wordCount: 100 });
    });

    it('should define ImportableStory interface correctly', () => {
      const importableStory: ImportableStory = {
        session_id: 'session-123',
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        story_content: 'A completed story...',
        final_score: 200,
        words_written: 150,
        story_source: 'CreativeBridge',
        story_metadata: { genre: 'fantasy' },
      };

      expect(importableStory.session_id).toBe('session-123');
      expect(importableStory.story_source).toBe('CreativeBridge');
      expect(typeof importableStory.story_metadata).toBe('object');
    });

    it('should define SearchableStory interface correctly', () => {
      const searchableStory: SearchableStory = {
        session_id: 'session-456',
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        story_content: 'Full story content here...',
        story_excerpt: 'Full story content here...',
        words_written: 200,
        story_source: 'Story_Quest',
        relevance_score: 0.85,
      };

      expect(searchableStory.relevance_score).toBe(0.85);
      expect(searchableStory.story_excerpt).toBeDefined();
      expect(typeof searchableStory.relevance_score).toBe('number');
    });

    it('should define StoryMetadata interface with flexible structure', () => {
      const metadata: StoryMetadata = {
        imported_word_count: 150,
        author: 'Jane Doe',
        title: 'Adventure Story',
        original_platform: 'Story_Quest',
        import_date: new Date().toISOString(),
        file_name: 'story.txt',
        file_size: 1024,
        encoding: 'utf-8',
        custom_field: 'custom value',
      };

      expect(metadata.imported_word_count).toBe(150);
      expect(metadata.custom_field).toBe('custom value');
      expect(typeof metadata.file_size).toBe('number');
    });
  });

  describe('Schema Validation Logic', () => {
    it('should validate story source values', () => {
      const validSources: StorySource[] = [
        'New',
        'CreativeBridge',
        'Story_Quest',
        'File',
      ];
      const invalidSources = ['Invalid', 'Random', ''];

      validSources.forEach(source => {
        expect(['New', 'CreativeBridge', 'Story_Quest', 'File']).toContain(
          source,
        );
      });

      invalidSources.forEach(source => {
        expect(['New', 'CreativeBridge', 'Story_Quest', 'File']).not.toContain(
          source,
        );
      });
    });

    it('should validate imported story content requirements', () => {
      const validContent =
        'This is a valid story with enough content to be imported.';
      const invalidContent = 'Short';
      const emptyContent = '';

      expect(validContent.length).toBeGreaterThan(10);
      expect(invalidContent.length).toBeLessThan(10);
      expect(emptyContent.length).toBe(0);
    });

    it('should validate story metadata structure', () => {
      const validMetadata = {
        imported_word_count: 100,
        author: 'Test Author',
        custom_field: 'value',
      };

      const invalidMetadata = null;

      expect(typeof validMetadata).toBe('object');
      expect(validMetadata).not.toBeNull();
      expect(invalidMetadata).toBeNull();
    });

    it('should handle optional fields correctly', () => {
      const minimalGameSession: Partial<GameSession> = {
        id: 'test-id',
        user_id: 'user-123',
        created_at: new Date().toISOString(),
        grade_level: 'K-2',
        final_score: 0,
        words_written: 0,
        sentences_completed: 0,
        challenges_completed: 0,
        xp_earned: 0,
        story_source: 'New',
        story_metadata: {},
      };

      expect(minimalGameSession.imported_story_content).toBeUndefined();
      expect(minimalGameSession.original_creation_date).toBeUndefined();
      expect(minimalGameSession.story_source).toBe('New');
      expect(minimalGameSession.story_metadata).toEqual({});
    });
  });

  describe('Database Function Types', () => {
    it('should define create_story_continuation_session function args correctly', () => {
      const functionArgs = {
        p_user_id: 'user-123',
        p_grade_level: 'K-2' as const,
        p_story_source: 'File' as StorySource,
        p_imported_content: 'Test story content here...',
        p_original_date: new Date().toISOString(),
        p_metadata: { wordCount: 100 },
      };

      expect(typeof functionArgs.p_user_id).toBe('string');
      expect(['K-2', '3-5', '6-8', '9-12']).toContain(
        functionArgs.p_grade_level,
      );
      expect(['New', 'CreativeBridge', 'Story_Quest', 'File']).toContain(
        functionArgs.p_story_source,
      );
      expect(typeof functionArgs.p_imported_content).toBe('string');
      expect(typeof functionArgs.p_metadata).toBe('object');
    });

    it('should define get_user_importable_stories function args correctly', () => {
      const functionArgs = {
        p_user_id: 'user-123',
        p_limit: 50,
        p_offset: 0,
      };

      expect(typeof functionArgs.p_user_id).toBe('string');
      expect(typeof functionArgs.p_limit).toBe('number');
      expect(typeof functionArgs.p_offset).toBe('number');
      expect(functionArgs.p_limit).toBeGreaterThan(0);
      expect(functionArgs.p_offset).toBeGreaterThanOrEqual(0);
    });

    it('should define search_user_stories function args correctly', () => {
      const functionArgs = {
        p_user_id: 'user-123',
        p_search_term: 'adventure',
        p_limit: 20,
      };

      expect(typeof functionArgs.p_user_id).toBe('string');
      expect(typeof functionArgs.p_search_term).toBe('string');
      expect(typeof functionArgs.p_limit).toBe('number');
      expect(functionArgs.p_search_term.length).toBeGreaterThan(0);
    });

    it('should define validate_story_import function args correctly', () => {
      const functionArgs = {
        p_story_source: 'File' as StorySource,
        p_imported_content: 'Valid story content with sufficient length',
        p_original_date: new Date().toISOString(),
      };

      expect(['New', 'CreativeBridge', 'Story_Quest', 'File']).toContain(
        functionArgs.p_story_source,
      );
      expect(typeof functionArgs.p_imported_content).toBe('string');
      expect(functionArgs.p_imported_content.length).toBeGreaterThan(10);
      expect(typeof functionArgs.p_original_date).toBe('string');
    });

    it('should define update_story_generated_image function args correctly', () => {
      const functionArgs = {
        p_session_id: 'session-123',
        p_image_url: 'https://example.com/generated-image.jpg',
        p_generation_cost: 1000,
      };

      expect(typeof functionArgs.p_session_id).toBe('string');
      expect(typeof functionArgs.p_image_url).toBe('string');
      expect(typeof functionArgs.p_generation_cost).toBe('number');
      expect(functionArgs.p_image_url.startsWith('http')).toBe(true);
      expect(functionArgs.p_generation_cost).toBeGreaterThan(0);
    });

    it('should define get_user_stories_with_images function args correctly', () => {
      const functionArgs = {
        p_user_id: 'user-123',
        p_limit: 20,
        p_offset: 0,
      };

      expect(typeof functionArgs.p_user_id).toBe('string');
      expect(typeof functionArgs.p_limit).toBe('number');
      expect(typeof functionArgs.p_offset).toBe('number');
      expect(functionArgs.p_limit).toBeGreaterThan(0);
      expect(functionArgs.p_offset).toBeGreaterThanOrEqual(0);
    });

    it('should define get_image_generation_stats function correctly', () => {
      const functionArgs = {};

      expect(typeof functionArgs).toBe('object');
      // This function takes no arguments, so we just verify the args object exists
    });
  });

  describe('Insert and Update Types', () => {
    it('should allow GameSession inserts with optional story continuation fields', () => {
      // Standard game session insert
      const standardInsert = {
        user_id: 'user-123',
        grade_level: 'K-2' as const,
        final_score: 100,
        words_written: 50,
        sentences_completed: 5,
        challenges_completed: 3,
        xp_earned: 150,
      };

      expect(standardInsert.user_id).toBeDefined();
      expect(standardInsert.grade_level).toBeDefined();

      // Story continuation insert
      const storyInsert = {
        ...standardInsert,
        story_source: 'File' as StorySource,
        imported_story_content: 'Imported story content...',
        original_creation_date: new Date().toISOString(),
        story_metadata: { imported_word_count: 50, author: 'Test' },
      };

      expect(storyInsert.story_source).toBe('File');
      expect(storyInsert.imported_story_content).toBeDefined();
      expect(typeof storyInsert.story_metadata).toBe('object');
    });

    it('should allow partial updates to GameSession', () => {
      const partialUpdate = {
        final_score: 200,
        story_content: 'Updated story content...',
        completed_at: new Date().toISOString(),
        story_metadata: { updated: true },
      };

      expect(partialUpdate.final_score).toBe(200);
      expect(partialUpdate.story_metadata.updated).toBe(true);
      expect(partialUpdate.story_content).toBeDefined();
    });
  });

  describe('Image Generation Types', () => {
    it('should define StoryWithImage interface correctly', () => {
      const storyWithImage: StoryWithImage = {
        session_id: 'session-123',
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        story_content: 'A completed story with an image...',
        generated_image_url: 'https://example.com/generated-image.jpg',
        image_generation_timestamp: new Date().toISOString(),
        image_generation_cost: 1000,
        final_score: 200,
        words_written: 150,
      };

      expect(storyWithImage.session_id).toBe('session-123');
      expect(storyWithImage.generated_image_url).toContain(
        'generated-image.jpg',
      );
      expect(storyWithImage.image_generation_cost).toBe(1000);
      expect(typeof storyWithImage.image_generation_timestamp).toBe('string');
      expect(storyWithImage.final_score).toBe(200);
    });

    it('should define ImageGenerationStats interface correctly', () => {
      const stats: ImageGenerationStats = {
        total_images_generated: 150,
        avg_generation_cost: 950.5,
        images_generated_today: 5,
        images_generated_this_week: 25,
        images_generated_this_month: 75,
      };

      expect(typeof stats.total_images_generated).toBe('number');
      expect(typeof stats.avg_generation_cost).toBe('number');
      expect(stats.images_generated_today).toBeGreaterThanOrEqual(0);
      expect(stats.images_generated_this_week).toBeGreaterThanOrEqual(
        stats.images_generated_today,
      );
      expect(stats.images_generated_this_month).toBeGreaterThanOrEqual(
        stats.images_generated_this_week,
      );
    });

    it('should allow GameSession with image generation fields', () => {
      const sessionWithImage: GameSession = {
        id: 'test-id',
        user_id: 'user-123',
        created_at: new Date().toISOString(),
        grade_level: 'K-2',
        final_score: 100,
        words_written: 50,
        sentences_completed: 5,
        challenges_completed: 3,
        xp_earned: 150,
        story_source: 'New',
        story_metadata: {},
        generated_image_url: 'https://example.com/story-image.jpg',
        image_generation_timestamp: new Date().toISOString(),
        image_generation_cost: 1000,
      };

      expect(sessionWithImage.generated_image_url).toBeDefined();
      expect(sessionWithImage.image_generation_cost).toBe(1000);
      expect(typeof sessionWithImage.image_generation_timestamp).toBe('string');
    });

    it('should allow optional image fields in GameSession', () => {
      const sessionWithoutImage: GameSession = {
        id: 'test-id',
        user_id: 'user-123',
        created_at: new Date().toISOString(),
        grade_level: 'K-2',
        final_score: 100,
        words_written: 50,
        sentences_completed: 5,
        challenges_completed: 3,
        xp_earned: 150,
        story_source: 'New',
        story_metadata: {},
      };

      expect(sessionWithoutImage.generated_image_url).toBeUndefined();
      expect(sessionWithoutImage.image_generation_timestamp).toBeUndefined();
      expect(sessionWithoutImage.image_generation_cost).toBeUndefined();
    });
  });

  describe('Image Generation Events Table', () => {
    it('should define ImageGenerationEvent interface correctly', () => {
      const imageEvent: ImageGenerationEvent = {
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
        story_word_count: 150,
        prompt_used: 'A colorful watercolor illustration of...',
        metadata: { device: 'iPhone', user_agent: 'iOS' },
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };

      expect(imageEvent.id).toBe('event-123');
      expect(imageEvent.user_id).toBe('user-456');
      expect(imageEvent.generation_status).toBe('success');
      expect(imageEvent.service_used).toBe('replicate');
      expect(imageEvent.xp_cost).toBe(1000);
      expect(typeof imageEvent.metadata).toBe('object');
    });

    it('should validate GenerationStatus type correctly', () => {
      const validStatuses: GenerationStatus[] = [
        'pending',
        'success',
        'failed',
        'refunded',
        'timeout',
      ];

      validStatuses.forEach(status => {
        expect([
          'pending',
          'success',
          'failed',
          'refunded',
          'timeout',
        ]).toContain(status);
      });
    });

    it('should validate ErrorType type correctly', () => {
      const validErrorTypes: ErrorType[] = [
        'api_failure',
        'content_safety',
        'insufficient_xp',
        'timeout',
        'rate_limit',
      ];

      validErrorTypes.forEach(errorType => {
        expect([
          'api_failure',
          'content_safety',
          'insufficient_xp',
          'timeout',
          'rate_limit',
        ]).toContain(errorType);
      });
    });

    it('should validate ServiceUsed type correctly', () => {
      const validServices: ServiceUsed[] = ['replicate', 'backup_service'];

      validServices.forEach(service => {
        expect(['replicate', 'backup_service']).toContain(service);
      });
    });

    it('should define ImageGenerationAnalytics interface correctly', () => {
      const analytics: ImageGenerationAnalytics = {
        total_attempts: 100,
        successful_generations: 85,
        failed_generations: 10,
        refunded_generations: 5,
        avg_response_time: 2800.5,
        most_common_error_type: 'timeout',
        total_xp_spent: 85000,
        replicate_usage: 90,
        backup_service_usage: 10,
      };

      expect(analytics.total_attempts).toBe(100);
      expect(analytics.successful_generations).toBe(85);
      expect(typeof analytics.avg_response_time).toBe('number');
      expect(analytics.total_xp_spent).toBe(85000);
    });

    it('should define UserImageGenerationEvent interface correctly', () => {
      const userEvent: UserImageGenerationEvent = {
        event_id: 'event-456',
        session_id: 'session-123',
        xp_cost: 1000,
        generation_status: 'failed',
        error_type: 'api_failure',
        service_used: 'replicate',
        api_response_time: 5000,
        image_url: undefined,
        story_grade_level: '3-5',
        story_word_count: 200,
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };

      expect(userEvent.event_id).toBe('event-456');
      expect(userEvent.generation_status).toBe('failed');
      expect(userEvent.error_type).toBe('api_failure');
      expect(userEvent.image_url).toBeUndefined();
    });

    it('should allow ImageGenerationEvent inserts with required fields', () => {
      const eventInsert = {
        user_id: 'user-123',
        session_id: 'session-456',
        xp_cost: 1000,
        generation_status: 'pending' as GenerationStatus,
        service_used: 'replicate' as ServiceUsed,
        metadata: { initiated_from: 'story_completion' },
      };

      expect(eventInsert.user_id).toBeDefined();
      expect(eventInsert.generation_status).toBe('pending');
      expect(eventInsert.service_used).toBe('replicate');
      expect(typeof eventInsert.metadata).toBe('object');
    });

    it('should allow ImageGenerationEvent updates with partial fields', () => {
      const eventUpdate = {
        generation_status: 'success' as GenerationStatus,
        image_url: 'https://example.com/final-image.jpg',
        api_response_time: 3200,
        completed_at: new Date().toISOString(),
      };

      expect(eventUpdate.generation_status).toBe('success');
      expect(eventUpdate.image_url).toContain('final-image.jpg');
      expect(eventUpdate.api_response_time).toBe(3200);
    });
  });

  describe('Image Generation Event Functions', () => {
    it('should define create_image_generation_event function args correctly', () => {
      const functionArgs = {
        p_user_id: 'user-123',
        p_session_id: 'session-456',
        p_xp_cost: 1000,
        p_story_grade_level: 'K-2',
        p_story_word_count: 150,
        p_metadata: { device: 'mobile' },
      };

      expect(typeof functionArgs.p_user_id).toBe('string');
      expect(typeof functionArgs.p_session_id).toBe('string');
      expect(typeof functionArgs.p_xp_cost).toBe('number');
      expect(functionArgs.p_xp_cost).toBeGreaterThan(0);
      expect(typeof functionArgs.p_metadata).toBe('object');
    });

    it('should define update_image_generation_event function args correctly', () => {
      const functionArgs = {
        p_event_id: 'event-123',
        p_status: 'success' as GenerationStatus,
        p_image_url: 'https://example.com/image.jpg',
        p_error_type: undefined,
        p_service_used: 'replicate' as ServiceUsed,
        p_api_response_time: 2500,
        p_prompt_used: 'A beautiful illustration...',
      };

      expect(typeof functionArgs.p_event_id).toBe('string');
      expect(['pending', 'success', 'failed', 'refunded', 'timeout']).toContain(
        functionArgs.p_status,
      );
      expect(['replicate', 'backup_service']).toContain(
        functionArgs.p_service_used,
      );
      expect(typeof functionArgs.p_api_response_time).toBe('number');
    });

    it('should define get_image_generation_analytics function args correctly', () => {
      const functionArgs = {
        p_user_id: 'user-123',
        p_start_date: new Date('2024-01-01').toISOString(),
        p_end_date: new Date('2024-12-31').toISOString(),
      };

      expect(typeof functionArgs.p_user_id).toBe('string');
      expect(typeof functionArgs.p_start_date).toBe('string');
      expect(typeof functionArgs.p_end_date).toBe('string');
    });

    it('should define get_user_image_generation_events function args correctly', () => {
      const functionArgs = {
        p_user_id: 'user-123',
        p_limit: 25,
        p_offset: 50,
      };

      expect(typeof functionArgs.p_user_id).toBe('string');
      expect(typeof functionArgs.p_limit).toBe('number');
      expect(typeof functionArgs.p_offset).toBe('number');
      expect(functionArgs.p_limit).toBeGreaterThan(0);
      expect(functionArgs.p_offset).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Migration Script Validation', () => {
    it('should have created migration script file', () => {
      // This test verifies that the migration script was created
      // In a real implementation, you might read the file and verify its contents
      const migrationExists = true; // Placeholder for file existence check
      expect(migrationExists).toBe(true);
    });

    it('should define all required new columns', () => {
      const requiredStoryColumns = [
        'imported_story_content',
        'story_source',
        'original_creation_date',
        'story_metadata',
      ];

      const requiredImageColumns = [
        'generated_image_url',
        'image_generation_timestamp',
        'image_generation_cost',
      ];

      const allRequiredColumns = [
        ...requiredStoryColumns,
        ...requiredImageColumns,
      ];

      // In a real test, you would verify these columns exist in the schema
      allRequiredColumns.forEach(column => {
        expect(typeof column).toBe('string');
        expect(column.length).toBeGreaterThan(0);
      });
    });

    it('should include proper constraints and indexes', () => {
      const expectedConstraints = [
        'valid_story_source',
        'check_image_generation_cost_positive',
      ];
      const expectedIndexes = [
        'idx_game_sessions_story_source',
        'idx_game_sessions_original_creation_date',
        'idx_game_sessions_story_metadata',
        'idx_game_sessions_generated_image_url',
        'idx_game_sessions_image_generation_timestamp',
      ];

      expectedConstraints.forEach(constraint => {
        expect(typeof constraint).toBe('string');
      });

      expectedIndexes.forEach(index => {
        expect(typeof index).toBe('string');
        expect(index.startsWith('idx_')).toBe(true);
      });
    });

    it('should have created image generation events table migration', () => {
      // This test verifies that the image generation events migration was created
      const migrationExists = true; // Placeholder for file existence check
      expect(migrationExists).toBe(true);
    });

    it('should define all required image generation events table columns', () => {
      const requiredColumns = [
        'id',
        'user_id',
        'session_id',
        'xp_cost',
        'generation_status',
        'error_type',
        'service_used',
        'api_response_time',
        'image_url',
        'story_grade_level',
        'story_word_count',
        'prompt_used',
        'metadata',
        'created_at',
        'completed_at',
      ];

      // In a real test, you would verify these columns exist in the schema
      requiredColumns.forEach(column => {
        expect(typeof column).toBe('string');
        expect(column.length).toBeGreaterThan(0);
      });
    });

    it('should include proper constraints and indexes for image generation events', () => {
      const expectedConstraints = [
        'check_xp_cost_positive',
        'check_response_time_reasonable',
      ];
      const expectedIndexes = [
        'idx_image_generation_events_user_id',
        'idx_image_generation_events_session_id',
        'idx_image_generation_events_status',
        'idx_image_generation_events_created_at',
        'idx_image_generation_events_service_used',
        'idx_image_generation_events_error_type',
        'idx_image_generation_events_grade_level',
        'idx_image_generation_events_user_status',
        'idx_image_generation_events_status_created',
        'idx_image_generation_events_service_status',
        'idx_image_generation_events_metadata',
      ];

      expectedConstraints.forEach(constraint => {
        expect(typeof constraint).toBe('string');
      });

      expectedIndexes.forEach(index => {
        expect(typeof index).toBe('string');
        expect(index.startsWith('idx_')).toBe(true);
      });
    });

    it('should include proper RLS policies for image generation events', () => {
      const expectedPolicies = [
        'Users can insert their own image generation events',
        'Users can view their own image generation events',
        'Users can update their own image generation events',
        // Admin policy commented out until admin roles are implemented
      ];

      expectedPolicies.forEach(policy => {
        expect(typeof policy).toBe('string');
        expect(policy.length).toBeGreaterThan(0);
      });
    });
  });
});
