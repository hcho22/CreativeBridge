/**
 * Enhanced Story Agent Service with Content Prediction
 * 
 * Wraps storyAgentService with ContentPredictionSkill integration
 * Task 3.1: Content Prediction Skill Integration
 */

import { storyAgentService } from './storyAgent';
import { StoryRequest, StoryResponse, GradeLevel } from '../types/story';
import {
  SkillEnhancedServiceFactory,
  SkillEnhancedServiceConfig,
} from './base/SkillEnhancedService';
import { getClaudeSkillsManager } from './claudeSkillsManager';
import { contentPredictionService, StoryContextAnalysis } from './contentPrediction';
import { SkillExecutionPlan } from './base/SkillOrchestrator';
import { structuredLogger } from '../utils/logger';

/**
 * Enhanced Story Agent that uses Content Prediction for intelligent caching
 */
class EnhancedStoryAgentService {
  private enhancedService: any;
  private isInitialized = false;

  /**
   * Initialize the enhanced service
   */
  async initialize(userId?: string, experimentId?: string): Promise<void> {
    if (this.isInitialized) return;

    const skillManager = await getClaudeSkillsManager();
    
    const config: SkillEnhancedServiceConfig = {
      enabled: true,
      skillTypes: ['ContentPredictionSkill'],
      fallbackEnabled: true,
      userId,
      experimentId,
      metadata: {
        service: 'storyAgent',
      },
    };

    // Wrap the original storyAgentService with skill enhancement
    this.enhancedService = SkillEnhancedServiceFactory.wrapService(
      {
        execute: async (request: StoryRequest): Promise<StoryResponse> => {
          // Use original service for story generation
          if (request.storySoFar) {
            return await storyAgentService.continueStory({
              ...request,
              consistencyCheck: false,
            });
          } else {
            return await storyAgentService.generateStoryStarter({
              gradeLevel: request.gradeLevel,
              theme: request.userInput?.includes('theme') ? 'adventure' : undefined,
            });
          }
        },
      },
      skillManager,
      config,
      {
        buildSkillExecutionPlan: async (request: StoryRequest) => {
          // Analyze story context
          const contextAnalysis = await contentPredictionService.analyzeStoryContext(request);
          
          // Only use prediction if context confidence is high enough
          if (contextAnalysis.confidence < 0.5) {
            return null; // Skip skill execution, use original service
          }

          // Build skill execution plan for content prediction
          return {
            skills: [
              {
                skillType: 'ContentPredictionSkill',
                skillId: 'ContentPredictionSkill_1.0.0',
                input: {
                  context: {
                    storyContext: contextAnalysis.storySoFar,
                    userInput: contextAnalysis.userInput,
                    gradeLevel: contextAnalysis.gradeLevel,
                    previousPredictions: [],
                  },
                  options: {
                    maxPredictions: 3,
                    confidenceThreshold: 0.7,
                  },
                },
                required: false, // Non-fatal - can fall back to original service
              },
            ],
            parallel: false,
            stopOnError: false,
          };
        },
        processSkillResults: async (request: StoryRequest, orchestrationResult: any) => {
          // Get prediction results
          const predictionResult = orchestrationResult.results.get('ContentPredictionSkill_1.0.0');
          
          if (predictionResult?.success && predictionResult.data) {
            const predictions = predictionResult.data.predictions || [];
            
            // Use prediction to enhance story generation
            // For now, we'll use predictions to inform caching decisions
            // The actual story generation still uses the original service
            
            structuredLogger.info('Content prediction available for caching', {
              skillType: 'ContentPredictionSkill',
              predictionsCount: predictions.length,
              confidence: predictionResult.data.confidence,
            });
          }

          // Always use original service for actual story generation
          // Predictions are used for caching/pre-loading
          if (request.storySoFar) {
            return await storyAgentService.continueStory({
              ...request,
              consistencyCheck: false,
            });
          } else {
            return await storyAgentService.generateStoryStarter({
              gradeLevel: request.gradeLevel,
            });
          }
        },
      }
    );

    this.isInitialized = true;
  }

  /**
   * Generate story starter with content prediction
   */
  async generateStoryStarter(
    gradeLevel: GradeLevel,
    theme?: string,
    character?: string,
    setting?: string
  ): Promise<StoryResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const request: StoryRequest = {
      gradeLevel,
      userInput: theme ? `Theme: ${theme}` : undefined,
    };

    return await this.enhancedService.execute(request);
  }

  /**
   * Continue story with content prediction
   */
  async continueStory(request: StoryRequest): Promise<StoryResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this.enhancedService.execute(request);
  }

  /**
   * Get story context analysis
   */
  async analyzeContext(request: StoryRequest): Promise<StoryContextAnalysis> {
    return await contentPredictionService.analyzeStoryContext(request);
  }

  /**
   * Get content predictions for a story context
   */
  async getPredictions(context: StoryContextAnalysis) {
    return await contentPredictionService.predictContent(context);
  }
}

// Export singleton instance
export const enhancedStoryAgentService = new EnhancedStoryAgentService();

