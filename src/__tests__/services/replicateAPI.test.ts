// Task 3.2-T: Test Replicate.com API integration with mock data
// This test verifies that the Replicate API integration works correctly

import {
  imageGenerationService,
  ReplicatePredictionRequest,
  ReplicatePrediction,
  ReplicateError,
  ImageGenerationRequest,
} from '../../services/imageGeneration';

describe('Task 3.2: Replicate.com API Integration Tests', () => {
  describe('Request/Response Type Definitions', () => {
    it('should validate ReplicatePredictionRequest structure', () => {
      const request: ReplicatePredictionRequest = {
        version: 'stability-ai/stable-diffusion:test-version',
        input: {
          prompt: 'A test prompt for image generation',
          width: 512,
          height: 512,
          num_inference_steps: 20,
          guidance_scale: 7.5,
          scheduler: 'K_EULER',
          negative_prompt: 'blurry, low quality',
          num_outputs: 1,
        },
      };

      expect(request.version).toContain('stability-ai');
      expect(request.input.prompt).toBe('A test prompt for image generation');
      expect(request.input.width).toBe(512);
      expect(request.input.height).toBe(512);
      expect(request.input.num_inference_steps).toBe(20);
      expect(request.input.guidance_scale).toBe(7.5);
      expect(request.input.scheduler).toBe('K_EULER');
      expect(request.input.num_outputs).toBe(1);
    });

    it('should validate ReplicatePrediction structure', () => {
      const prediction: ReplicatePrediction = {
        id: 'prediction-123',
        status: 'succeeded',
        input: {
          prompt: 'Test prompt',
          width: 512,
          height: 512,
        },
        output: ['https://example.com/generated-image.jpg'],
        created_at: '2023-01-01T00:00:00Z',
        started_at: '2023-01-01T00:00:01Z',
        completed_at: '2023-01-01T00:00:30Z',
        urls: {
          get: 'https://api.replicate.com/v1/predictions/prediction-123',
          cancel:
            'https://api.replicate.com/v1/predictions/prediction-123/cancel',
        },
        metrics: {
          predict_time: 25.5,
          total_time: 30.0,
        },
      };

      expect(prediction.id).toBe('prediction-123');
      expect(prediction.status).toBe('succeeded');
      expect(prediction.output).toHaveLength(1);
      expect(prediction.output![0]).toContain('generated-image.jpg');
      expect(prediction.urls.get).toContain('predictions/prediction-123');
      expect(prediction.metrics?.predict_time).toBe(25.5);
      expect(prediction.metrics?.total_time).toBe(30.0);
    });

    it('should validate ReplicateError structure', () => {
      const error: ReplicateError = {
        detail: 'Invalid API token provided',
        type: 'authentication_error',
        param: 'authorization',
        code: 'invalid_token',
      };

      expect(error.detail).toBe('Invalid API token provided');
      expect(error.type).toBe('authentication_error');
      expect(error.param).toBe('authorization');
      expect(error.code).toBe('invalid_token');
    });

    it('should validate all required ReplicatePrediction status values', () => {
      const validStatuses: ReplicatePrediction['status'][] = [
        'starting',
        'processing',
        'succeeded',
        'failed',
        'canceled',
      ];

      validStatuses.forEach(status => {
        const prediction: Partial<ReplicatePrediction> = {
          id: 'test-id',
          status: status,
          urls: { get: '', cancel: '' },
          created_at: '2023-01-01T00:00:00Z',
        };

        expect([
          'starting',
          'processing',
          'succeeded',
          'failed',
          'canceled',
        ]).toContain(prediction.status);
      });
    });
  });

  describe('API Client Configuration', () => {
    it('should get Replicate configuration with proper defaults', () => {
      const config = imageGenerationService.getReplicateConfig();

      expect(config.baseUrl).toBe('https://api.replicate.com/v1');
      expect(config.timeout).toBe(60000); // 60 seconds
      expect(config.pollingInterval).toBe(1000); // 1 second
      expect(config.maxPollingAttempts).toBe(60); // 60 attempts
    });

    it('should get correct XP cost for image generation', () => {
      const cost = imageGenerationService.getImageGenerationCost();
      expect(cost).toBe(1000);
    });

    it('should validate timeout handling configuration', () => {
      const config = imageGenerationService.getReplicateConfig();

      // Verify timeout values are reasonable
      expect(config.timeout).toBeLessThanOrEqual(60000); // Max 60 seconds
      expect(config.pollingInterval).toBeGreaterThanOrEqual(500); // Min 0.5 seconds
      expect(config.maxPollingAttempts).toBeGreaterThanOrEqual(10); // Min 10 attempts

      // Verify total max time is reasonable (interval * attempts)
      const maxTotalTime = config.pollingInterval * config.maxPollingAttempts;
      expect(maxTotalTime).toBeLessThanOrEqual(120000); // Max 2 minutes total polling
    });
  });

  describe('Grade-Level Art Style Integration', () => {
    it('should generate appropriate prompts for different grade levels', () => {
      const k2Style = imageGenerationService.getArtStyleForGrade('K-2');
      expect(k2Style).toContain('watercolor');
      expect(k2Style).toContain('children');
      expect(k2Style).toContain('bright colors');
      expect(k2Style).toContain('whimsical');

      const elementaryStyle = imageGenerationService.getArtStyleForGrade('3-5');
      expect(elementaryStyle).toContain('detailed');
      expect(elementaryStyle).toContain('children');
      expect(elementaryStyle).toContain('vibrant');

      const middleSchoolStyle =
        imageGenerationService.getArtStyleForGrade('6-8');
      expect(middleSchoolStyle).toContain('realistic');
      expect(middleSchoolStyle).toContain('digital illustration');
      expect(middleSchoolStyle).toContain('adventure');

      const highSchoolStyle =
        imageGenerationService.getArtStyleForGrade('9-12');
      expect(highSchoolStyle).toContain('sophisticated');
      expect(highSchoolStyle).toContain('realistic');
      expect(highSchoolStyle).toContain('detailed environments');
    });
  });

  describe('API Integration with Timeout Handling', () => {
    it('should test Replicate connection in development mode', async () => {
      // This should work in dev mode with mock responses
      const result = await imageGenerationService.testReplicateConnection();

      expect(result.success).toBe(true);
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.responseTime).toBeLessThan(10000); // Should be quick in dev mode
      expect(result.error).toBeUndefined();
    });

    it('should generate image with proper request flow in development', async () => {
      const request: ImageGenerationRequest = {
        storyContent:
          'Once upon a time, there was a brave little mouse who discovered a magical forest filled with talking animals and glowing flowers that granted wishes to those pure of heart.',
        gradeLevel: 'K-2',
        sessionId: 'session-123',
        userId: 'user-456',
        metadata: { source: 'test', device: 'mobile' },
      };

      const result = await imageGenerationService.generateImage(request);

      // Check if service is enabled in test environment
      if (!imageGenerationService.isFeatureEnabled()) {
        expect(result.success).toBe(false);
        expect(result.error).toContain('disabled');
        return;
      }

      // In development mode, this should succeed with mock data
      expect(result.success).toBe(true);
      expect(result.imageUrl).toBeDefined();
      expect(result.imageUrl).toContain('http');
      expect(result.serviceUsed).toBe('replicate');
      expect(result.responseTimeMs).toBeGreaterThan(0);
      expect(result.eventId).toBeDefined();
    });

    it('should generate different styles for different requests', async () => {
      const storyContent =
        'A magical adventure through an enchanted forest where brave heroes discover ancient secrets and forge lasting friendships.';

      const k2Request: ImageGenerationRequest = {
        storyContent,
        gradeLevel: 'K-2',
        sessionId: 'session-k2',
        userId: 'user-test',
      };

      const highSchoolRequest: ImageGenerationRequest = {
        storyContent,
        gradeLevel: '9-12',
        sessionId: 'session-hs',
        userId: 'user-test',
      };

      const [k2Result, hsResult] = await Promise.all([
        imageGenerationService.generateImage(k2Request),
        imageGenerationService.generateImage(highSchoolRequest),
      ]);

      // Check if service is enabled in test environment
      if (!imageGenerationService.isFeatureEnabled()) {
        expect(k2Result.success).toBe(false);
        expect(hsResult.success).toBe(false);
        return;
      }

      expect(k2Result.success).toBe(true);
      expect(hsResult.success).toBe(true);

      // Both should succeed but potentially with different processing
      expect(k2Result.serviceUsed).toBe('replicate');
      expect(hsResult.serviceUsed).toBe('replicate');
    });
  });

  describe('Error Handling and Content Validation', () => {
    it('should handle content validation before API calls', () => {
      const validContent =
        'This is a valid story with enough characters to pass the minimum length requirement for image generation testing purposes.';
      const validation =
        imageGenerationService.validateStoryContent(validContent);
      expect(validation.isValid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    it('should reject content that is too short', () => {
      const shortContent = 'Too short';
      const validation =
        imageGenerationService.validateStoryContent(shortContent);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('too short');
    });

    it('should reject empty content', () => {
      const emptyContent = '';
      const validation =
        imageGenerationService.validateStoryContent(emptyContent);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('cannot be empty');
    });

    it('should reject content that is too long', () => {
      const longContent = 'A'.repeat(5001); // Exceed 5000 character limit
      const validation =
        imageGenerationService.validateStoryContent(longContent);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('too long');
    });

    it('should handle insufficient XP scenario', async () => {
      // Check if service is enabled first
      if (!imageGenerationService.isFeatureEnabled()) {
        // Test that disabled service fails gracefully
        const request: ImageGenerationRequest = {
          storyContent:
            'A story for testing insufficient XP scenario with enough content to pass validation requirements.',
          gradeLevel: 'K-2',
          sessionId: 'session-no-xp',
          userId: 'user-poor',
        };

        const result = await imageGenerationService.generateImage(request);
        expect(result.success).toBe(false);
        expect(result.error).toContain('disabled');
        return;
      }

      // Mock the XP check to return insufficient balance
      const originalCheckXP = imageGenerationService.checkUserXPBalance;
      imageGenerationService.checkUserXPBalance = jest
        .fn()
        .mockResolvedValue(500); // Less than 1000

      const request: ImageGenerationRequest = {
        storyContent:
          'A story for testing insufficient XP scenario with enough content to pass validation requirements.',
        gradeLevel: 'K-2',
        sessionId: 'session-no-xp',
        userId: 'user-poor',
      };

      const result = await imageGenerationService.generateImage(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient XP');
      expect(result.error).toContain('Need 1000 XP, have 500 XP');
      expect(result.errorType).toBe('insufficient_xp');

      // Restore original method
      imageGenerationService.checkUserXPBalance = originalCheckXP;
    });
  });

  describe('Response Validation', () => {
    it('should validate ImageGenerationResult structure', async () => {
      const request: ImageGenerationRequest = {
        storyContent:
          'A comprehensive test story that meets all the validation requirements for length and content quality testing.',
        gradeLevel: 'K-2',
        sessionId: 'session-validation',
        userId: 'user-validation',
      };

      const result = await imageGenerationService.generateImage(request);

      // Validate result structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('serviceUsed');
      expect(result).toHaveProperty('responseTimeMs');
      expect(typeof result.success).toBe('boolean');
      expect(['replicate', 'backup_service']).toContain(result.serviceUsed);
      expect(typeof result.responseTimeMs).toBe('number');
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0); // Changed to >= 0 for disabled service

      if (result.success) {
        expect(result).toHaveProperty('imageUrl');
        expect(typeof result.imageUrl).toBe('string');
        expect(result.imageUrl).toMatch(/^https?:\/\//);
        expect(result.eventId).toBeDefined();
      } else {
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
        if (result.errorType) {
          expect([
            'api_failure',
            'content_safety',
            'insufficient_xp',
            'timeout',
            'rate_limit',
          ]).toContain(result.errorType);
        }
      }
    });
  });
});
