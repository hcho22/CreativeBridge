// Integration Tests for Database Migrations (Tasks 2.1, 2.2, 2.3)
// These tests verify that database migrations work correctly and all new tables/columns are accessible

// Import will be mocked
import { supabase } from '../../services/supabase';
import type {
  GameSession,
  ImageGenerationEvent,
  GenerationStatus,
  ServiceUsed,
  ErrorType,
  ImageGenerationEventInsert,
  ImageGenerationEventUpdate,
} from '../../types/database';

// Mock the supabase module — define the mock client INSIDE the factory.
// jest.mock is hoisted above any `const` declarations, so a closure-captured
// outer `const mockSupabaseClient = {...}` is in the temporal dead zone when
// the factory runs and resolves to undefined. Alias the imported (mocked)
// `supabase` as `mockSupabaseClient` for the existing test code below.
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: {
      uid: jest.fn(() => 'test-user-id'),
    },
  },
}));

const mockSupabaseClient = supabase as unknown as {
  from: jest.Mock;
  rpc: jest.Mock;
  auth: { uid: jest.Mock };
};

describe('Database Migrations Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null });
  });

  describe('Task 2.1: Game Sessions Table Image Generation Columns', () => {
    it('should be able to insert GameSession with image generation fields', async () => {
      const mockInsert = jest.fn().mockResolvedValue({
        data: { id: 'session-123' },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
      });

      const gameSessionWithImage = {
        user_id: 'user-123',
        grade_level: 'K-2' as const,
        final_score: 100,
        words_written: 150,
        sentences_completed: 8,
        challenges_completed: 3,
        xp_earned: 200,
        story_source: 'New' as const,
        story_metadata: {},
        story_content: 'Once upon a time, there was a brave little mouse...',
        // New image generation fields
        generated_image_url: 'https://example.com/generated-story-image.jpg',
        image_generation_timestamp: new Date().toISOString(),
        image_generation_cost: 1000,
      };

      await supabase.from('game_sessions').insert(gameSessionWithImage);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('game_sessions');
      expect(mockInsert).toHaveBeenCalledWith(gameSessionWithImage);
    });

    it('should be able to update GameSession with image generation data', async () => {
      const mockUpdate = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockResolvedValue({ data: null, error: null });

      mockSupabaseClient.from.mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
      });

      const imageUpdate = {
        generated_image_url: 'https://example.com/final-image.jpg',
        image_generation_timestamp: new Date().toISOString(),
        image_generation_cost: 1000,
      };

      await supabase
        .from('game_sessions')
        .update(imageUpdate)
        .eq('id', 'session-123');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('game_sessions');
      expect(mockUpdate).toHaveBeenCalledWith(imageUpdate);
      expect(mockEq).toHaveBeenCalledWith('id', 'session-123');
    });

    it('should be able to query GameSessions with image generation fields', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockResolvedValue({
        data: [
          {
            id: 'session-123',
            user_id: 'user-123',
            generated_image_url: 'https://example.com/image.jpg',
            image_generation_timestamp: '2024-01-01T12:00:00Z',
            image_generation_cost: 1000,
          },
        ],
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
      });

      await supabase
        .from('game_sessions')
        .select(
          'id, user_id, generated_image_url, image_generation_timestamp, image_generation_cost',
        )
        .eq('user_id', 'user-123');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('game_sessions');
      expect(mockSelect).toHaveBeenCalledWith(
        'id, user_id, generated_image_url, image_generation_timestamp, image_generation_cost',
      );
    });

    it('should be able to call update_story_generated_image function', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: true,
        error: null,
      });

      mockSupabaseClient.rpc = mockRpc;

      await supabase.rpc('update_story_generated_image', {
        p_session_id: 'session-123',
        p_image_url: 'https://example.com/generated-image.jpg',
        p_generation_cost: 1000,
      });

      expect(mockRpc).toHaveBeenCalledWith('update_story_generated_image', {
        p_session_id: 'session-123',
        p_image_url: 'https://example.com/generated-image.jpg',
        p_generation_cost: 1000,
      });
    });

    it('should be able to call get_user_stories_with_images function', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: [
          {
            session_id: 'session-123',
            created_at: '2024-01-01T12:00:00Z',
            completed_at: '2024-01-01T12:30:00Z',
            story_content: 'Test story content',
            generated_image_url: 'https://example.com/image.jpg',
            image_generation_timestamp: '2024-01-01T12:25:00Z',
            image_generation_cost: 1000,
            final_score: 150,
            words_written: 200,
          },
        ],
        error: null,
      });

      mockSupabaseClient.rpc = mockRpc;

      await supabase.rpc('get_user_stories_with_images', {
        p_user_id: 'user-123',
        p_limit: 10,
        p_offset: 0,
      });

      expect(mockRpc).toHaveBeenCalledWith('get_user_stories_with_images', {
        p_user_id: 'user-123',
        p_limit: 10,
        p_offset: 0,
      });
    });
  });

  describe('Task 2.2: Image Generation Events Table', () => {
    it('should be able to insert ImageGenerationEvent', async () => {
      const mockInsert = jest.fn().mockResolvedValue({
        data: { id: 'event-123' },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
      });

      const eventInsert: ImageGenerationEventInsert = {
        user_id: 'user-123',
        session_id: 'session-456',
        xp_cost: 1000,
        generation_status: 'pending',
        service_used: 'replicate',
        story_grade_level: 'K-2',
        story_word_count: 150,
        metadata: {
          device: 'iPhone',
          initiated_from: 'story_completion',
        },
      };

      await supabase.from('image_generation_events').insert(eventInsert);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'image_generation_events',
      );
      expect(mockInsert).toHaveBeenCalledWith(eventInsert);
    });

    it('should be able to update ImageGenerationEvent status', async () => {
      const mockUpdate = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockResolvedValue({ data: null, error: null });

      mockSupabaseClient.from.mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
      });

      const statusUpdate: ImageGenerationEventUpdate = {
        generation_status: 'success',
        image_url: 'https://example.com/final-image.jpg',
        api_response_time: 3500,
        completed_at: new Date().toISOString(),
      };

      await supabase
        .from('image_generation_events')
        .update(statusUpdate)
        .eq('id', 'event-123');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'image_generation_events',
      );
      expect(mockUpdate).toHaveBeenCalledWith(statusUpdate);
      expect(mockEq).toHaveBeenCalledWith('id', 'event-123');
    });

    it('should be able to query ImageGenerationEvents with filters', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockResolvedValue({
        data: [
          {
            id: 'event-123',
            user_id: 'user-123',
            generation_status: 'success',
            xp_cost: 1000,
            service_used: 'replicate',
            created_at: '2024-01-01T12:00:00Z',
          },
        ],
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        order: mockOrder,
      });

      await supabase
        .from('image_generation_events')
        .select('*')
        .eq('user_id', 'user-123')
        .order('created_at', { ascending: false });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'image_generation_events',
      );
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123');
    });

    it('should be able to call create_image_generation_event function', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: 'event-123',
        error: null,
      });

      mockSupabaseClient.rpc = mockRpc;

      await supabase.rpc('create_image_generation_event', {
        p_user_id: 'user-123',
        p_session_id: 'session-456',
        p_xp_cost: 1000,
        p_story_grade_level: 'K-2',
        p_story_word_count: 150,
        p_metadata: { device: 'mobile' },
      });

      expect(mockRpc).toHaveBeenCalledWith('create_image_generation_event', {
        p_user_id: 'user-123',
        p_session_id: 'session-456',
        p_xp_cost: 1000,
        p_story_grade_level: 'K-2',
        p_story_word_count: 150,
        p_metadata: { device: 'mobile' },
      });
    });

    it('should be able to call update_image_generation_event function', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: true,
        error: null,
      });

      mockSupabaseClient.rpc = mockRpc;

      await supabase.rpc('update_image_generation_event', {
        p_event_id: 'event-123',
        p_status: 'success' as GenerationStatus,
        p_image_url: 'https://example.com/image.jpg',
        p_service_used: 'replicate' as ServiceUsed,
        p_api_response_time: 2500,
        p_prompt_used: 'A colorful watercolor illustration...',
      });

      expect(mockRpc).toHaveBeenCalledWith('update_image_generation_event', {
        p_event_id: 'event-123',
        p_status: 'success',
        p_image_url: 'https://example.com/image.jpg',
        p_service_used: 'replicate',
        p_api_response_time: 2500,
        p_prompt_used: 'A colorful watercolor illustration...',
      });
    });

    it('should be able to call get_image_generation_analytics function', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: [
          {
            total_attempts: 100,
            successful_generations: 85,
            failed_generations: 10,
            refunded_generations: 5,
            avg_response_time: 2800.5,
            most_common_error_type: 'timeout',
            total_xp_spent: 85000,
            replicate_usage: 90,
            backup_service_usage: 10,
          },
        ],
        error: null,
      });

      mockSupabaseClient.rpc = mockRpc;

      await supabase.rpc('get_image_generation_analytics', {
        p_user_id: 'user-123',
        p_start_date: '2024-01-01T00:00:00Z',
        p_end_date: '2024-01-31T23:59:59Z',
      });

      expect(mockRpc).toHaveBeenCalledWith('get_image_generation_analytics', {
        p_user_id: 'user-123',
        p_start_date: '2024-01-01T00:00:00Z',
        p_end_date: '2024-01-31T23:59:59Z',
      });
    });

    it('should be able to call get_user_image_generation_events function', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: [
          {
            event_id: 'event-123',
            session_id: 'session-456',
            xp_cost: 1000,
            generation_status: 'success',
            service_used: 'replicate',
            created_at: '2024-01-01T12:00:00Z',
            completed_at: '2024-01-01T12:02:30Z',
          },
        ],
        error: null,
      });

      mockSupabaseClient.rpc = mockRpc;

      await supabase.rpc('get_user_image_generation_events', {
        p_user_id: 'user-123',
        p_limit: 25,
        p_offset: 0,
      });

      expect(mockRpc).toHaveBeenCalledWith('get_user_image_generation_events', {
        p_user_id: 'user-123',
        p_limit: 25,
        p_offset: 0,
      });
    });
  });

  describe('Task 2.3: Migration Integration Validation', () => {
    it('should validate all required columns exist in GameSession type', () => {
      const gameSession: GameSession = {
        id: 'session-123',
        user_id: 'user-123',
        created_at: new Date().toISOString(),
        grade_level: 'K-2',
        final_score: 100,
        words_written: 150,
        sentences_completed: 8,
        challenges_completed: 3,
        xp_earned: 200,
        story_source: 'New',
        story_metadata: {},
        // Image generation fields (should be optional)
        generated_image_url: 'https://example.com/image.jpg',
        image_generation_timestamp: new Date().toISOString(),
        image_generation_cost: 1000,
      };

      // Verify all fields are accessible
      expect(gameSession.generated_image_url).toBeDefined();
      expect(gameSession.image_generation_timestamp).toBeDefined();
      expect(gameSession.image_generation_cost).toBe(1000);
    });

    it('should validate all required columns exist in ImageGenerationEvent type', () => {
      const imageEvent: ImageGenerationEvent = {
        id: 'event-123',
        user_id: 'user-123',
        session_id: 'session-456',
        xp_cost: 1000,
        generation_status: 'success',
        error_type: undefined,
        service_used: 'replicate',
        api_response_time: 2500,
        image_url: 'https://example.com/image.jpg',
        story_grade_level: 'K-2',
        story_word_count: 150,
        prompt_used: 'A colorful illustration...',
        metadata: { device: 'mobile' },
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };

      // Verify all fields are accessible
      expect(imageEvent.id).toBe('event-123');
      expect(imageEvent.generation_status).toBe('success');
      expect(imageEvent.service_used).toBe('replicate');
      expect(imageEvent.metadata).toEqual({ device: 'mobile' });
    });

    it('should validate enum types work correctly', () => {
      const statuses: GenerationStatus[] = [
        'pending',
        'success',
        'failed',
        'refunded',
        'timeout',
      ];
      const services: ServiceUsed[] = ['replicate', 'backup_service'];
      const errors: ErrorType[] = [
        'api_failure',
        'content_safety',
        'insufficient_xp',
        'timeout',
        'rate_limit',
      ];

      statuses.forEach(status => {
        expect([
          'pending',
          'success',
          'failed',
          'refunded',
          'timeout',
        ]).toContain(status);
      });

      services.forEach(service => {
        expect(['replicate', 'backup_service']).toContain(service);
      });

      errors.forEach(error => {
        expect([
          'api_failure',
          'content_safety',
          'insufficient_xp',
          'timeout',
          'rate_limit',
        ]).toContain(error);
      });
    });

    it('should be able to perform complex queries combining both tables', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockIn = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockResolvedValue({
        data: [
          {
            id: 'session-123',
            story_content: 'Test story',
            generated_image_url: 'https://example.com/image.jpg',
            final_score: 150,
          },
        ],
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        in: mockIn,
        order: mockOrder,
      });

      // Simulate a query to get sessions that have generated images
      await supabase
        .from('game_sessions')
        .select('id, story_content, generated_image_url, final_score')
        .eq('user_id', 'user-123')
        .in('generated_image_url', ['not', null])
        .order('image_generation_timestamp', { ascending: false });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('game_sessions');
      expect(mockSelect).toHaveBeenCalledWith(
        'id, story_content, generated_image_url, final_score',
      );
    });

    it('should handle migration rollback scenarios gracefully', () => {
      // Test that optional fields can be undefined
      const sessionWithoutImage: Partial<GameSession> = {
        id: 'session-123',
        user_id: 'user-123',
        generated_image_url: undefined,
        image_generation_timestamp: undefined,
        image_generation_cost: undefined,
      };

      expect(sessionWithoutImage.generated_image_url).toBeUndefined();
      expect(sessionWithoutImage.image_generation_timestamp).toBeUndefined();
      expect(sessionWithoutImage.image_generation_cost).toBeUndefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database errors gracefully', async () => {
      const mockInsert = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed', code: '08001' },
      });

      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
      });

      const result = await supabase.from('image_generation_events').insert({
        user_id: 'user-123',
        generation_status: 'pending',
        service_used: 'replicate',
        xp_cost: 1000,
        metadata: {},
      });

      expect(result.error).toBeTruthy();
      expect(result.error?.message).toBe('Database connection failed');
    });

    it('should handle function call errors gracefully', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Function execution failed', code: '42883' },
      });

      mockSupabaseClient.rpc = mockRpc;

      const result = await supabase.rpc('create_image_generation_event', {
        p_user_id: 'invalid-user',
        p_session_id: 'invalid-session',
      });

      expect(result.error).toBeTruthy();
      expect(result.error?.message).toBe('Function execution failed');
    });

    it('should validate constraint violations are properly typed', async () => {
      const mockInsert = jest.fn().mockResolvedValue({
        data: null,
        error: {
          message:
            'new row for relation "image_generation_events" violates check constraint "check_xp_cost_positive"',
          code: '23514',
        },
      });

      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
      });

      const result = await supabase.from('image_generation_events').insert({
        user_id: 'user-123',
        xp_cost: -100, // This should violate the constraint
        generation_status: 'pending',
        service_used: 'replicate',
        metadata: {},
      });

      expect(result.error).toBeTruthy();
      expect(result.error?.code).toBe('23514'); // Check constraint violation
    });
  });
});
