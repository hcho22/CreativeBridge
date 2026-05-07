// Claude Skills Mock Implementation
// Provides consistent mock responses for testing

import {
  SkillManager,
  SkillConfig,
  SkillResult,
  SkillInput,
  SkillType,
  SkillError,
  SkillErrorCode,
  SkillExecutionState,
} from '../../types/claudeSkills';

// Mock skill responses for consistent testing
export const MOCK_SKILL_RESPONSES = {
  ContentPredictionSkill: {
    predictions: [
      {
        content:
          'The adventure continued as they discovered a hidden pathway leading to a magical garden filled with talking flowers.',
        confidence: 0.85,
        reasoning: 'Based on story context and grade level patterns',
        metadata: {
          gradeLevel: 'K-2',
          theme: 'adventure',
          estimatedEngagement: 0.9,
        },
      },
      {
        content:
          "Ruby felt the stone's warm glow and knew it was trying to show her something important about friendship.",
        confidence: 0.78,
        reasoning: 'Contextual analysis suggests friendship theme development',
        metadata: {
          gradeLevel: 'K-2',
          theme: 'friendship',
          estimatedEngagement: 0.85,
        },
      },
    ],
    cacheKey: 'prediction_mock_123',
    confidence: 0.85,
  },

  ResourceOptimizationSkill: {
    recommendations: [
      {
        type: 'memory' as const,
        action: 'Reduce cache size to 30MB based on available memory',
        priority: 'medium' as const,
        estimatedImpact: 20,
      },
      {
        type: 'battery' as const,
        action: 'Disable background processing during low battery',
        priority: 'high' as const,
        estimatedImpact: 15,
      },
    ],
    optimizations: [
      {
        parameter: 'cacheSize',
        currentValue: 50,
        recommendedValue: 30,
        reason: 'Device has limited available memory (1GB available)',
      },
      {
        parameter: 'concurrentRequests',
        currentValue: 3,
        recommendedValue: 2,
        reason: 'Reduce CPU load for better battery life',
      },
    ],
    estimatedImpact: {
      memorySavings: 20,
      batterySavings: 15,
      performanceImprovement: 12,
    },
  },

  QualityAssessmentSkill: {
    overallScore: 0.92,
    scores: {
      appropriateness: 0.95,
      coherence: 0.88,
      engagement: 0.9,
      educationalValue: 0.85,
    },
    feedback: [
      {
        category: 'engagement' as const,
        message: 'Story maintains excellent engagement for K-2 grade level',
        severity: 'info' as const,
        suggestions: [
          'Consider adding more sensory details',
          'Include interactive elements',
        ],
      },
      {
        category: 'appropriateness' as const,
        message: 'Content is perfectly suitable for target age group',
        severity: 'info' as const,
      },
    ],
    recommendations: [
      'Content meets all educational standards for K-2',
      'Story promotes positive values and creativity',
      'Language complexity is appropriate for reading level',
    ],
    approved: true,
  },

  BehaviorAnalysisSkill: {
    patterns: [
      {
        pattern: 'Frequent story navigation - user prefers shorter segments',
        frequency: 0.8,
        confidence: 0.9,
        implications: [
          'User may have shorter attention span',
          'Consider breaking content into smaller chunks',
          'Provide more frequent interaction points',
        ],
      },
      {
        pattern: 'High engagement with adventure themes',
        frequency: 0.75,
        confidence: 0.85,
        implications: [
          'User prefers active, exciting content',
          'Adventure elements increase completion rate',
          'Consider adventure-based personalization',
        ],
      },
    ],
    predictions: [
      {
        event: 'Story completion',
        probability: 0.85,
        timeframe: 300000, // 5 minutes
        confidence: 0.8,
      },
      {
        event: 'Request for new story',
        probability: 0.7,
        timeframe: 600000, // 10 minutes
        confidence: 0.75,
      },
    ],
    recommendations: [
      {
        type: 'ui_adjustment' as const,
        recommendation: 'Reduce story segment length to 2-3 sentences',
        confidence: 0.85,
        expectedImpact: 0.15,
      },
      {
        type: 'content_preference' as const,
        recommendation: 'Increase adventure theme elements',
        confidence: 0.8,
        expectedImpact: 0.2,
      },
    ],
    engagementScore: 0.82,
  },

  ErrorRecoverySkill: {
    recoveryStrategy: {
      type: 'fallback' as const,
      action: 'Use cached content with context preservation',
      parameters: {
        preserveUserInput: true,
        useLastKnownGoodState: true,
        generateContextualFallback: true,
      },
      confidence: 0.9,
    },
    fallbackContent: {
      story:
        "Let's continue your wonderful story about Ruby! The magical stone showed her a new path through the forest, filled with friendly creatures who wanted to help.",
      context: {
        characters: ['Ruby', 'friendly creatures'],
        setting: 'magical forest',
        theme: 'adventure and friendship',
      },
    },
    userMessage:
      "We've restored your story and added some magical elements. You can keep creating!",
    preservedContext: {
      storyState: { currentContent: 'Ruby picked up the glowing stone...' },
      userState: { gradeLevel: 'K-2', preferences: { theme: 'adventure' } },
      sessionState: { sessionId: 'test_session', progress: 0.6 },
    },
    recoverySuccess: true,
  },
};

// Mock skill execution times (in milliseconds)
// Keep these small to avoid test timeouts in performance regression suites
export const MOCK_EXECUTION_TIMES = {
  ContentPredictionSkill: 5,
  ResourceOptimizationSkill: 3,
  QualityAssessmentSkill: 8,
  BehaviorAnalysisSkill: 6,
  ErrorRecoverySkill: 4,
};

// Mock error scenarios for testing
export const MOCK_ERROR_SCENARIOS = {
  networkError: {
    code: SkillErrorCode.NETWORK_ERROR,
    message: 'Network connection failed',
    details: {
      endpoint: 'https://api.claude-skills.com/v1/predict',
      statusCode: 0,
      timeout: true,
    },
    retryable: true,
  },

  authError: {
    code: SkillErrorCode.AUTHENTICATION_ERROR,
    message: 'Invalid API key',
    details: {
      endpoint: 'https://api.claude-skills.com/v1/auth',
      statusCode: 401,
    },
    retryable: false,
  },

  rateLimitError: {
    code: SkillErrorCode.RATE_LIMIT_EXCEEDED,
    message: 'Rate limit exceeded - 1000 requests per minute',
    details: {
      retryAfter: 60,
      currentLimit: 1000,
      resetTime: Date.now() + 60000,
    },
    retryable: true,
  },

  timeoutError: {
    code: SkillErrorCode.SKILL_TIMEOUT,
    message: 'Skill execution timed out after 30 seconds',
    details: {
      timeout: 30000,
      skillType: 'ContentPredictionSkill',
    },
    retryable: true,
  },
};

// Mock SkillManager implementation for testing
export class MockSkillManager implements SkillManager {
  getMetrics(): any {
    return {
      totalExecutions: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
      errorRate: 0,
      skillMetrics: {},
    };
  }
  private isInitializedFlag = false;
  private config: SkillConfig | null = null;
  private skills: Map<string, any> = new Map();
  private executionStates: Map<string, SkillExecutionState> = new Map();
  private simulateErrors = false;
  private errorScenario: keyof typeof MOCK_ERROR_SCENARIOS | null = null;

  async initialize(config: SkillConfig): Promise<void> {
    this.config = config;
    this.isInitializedFlag = true;

    // Register mock skills
    for (const skillType of config.enabledSkills) {
      const skillId = `${skillType}_mock`;
      this.skills.set(skillId, {
        id: skillId,
        type: skillType,
        version: '1.0.0-mock',
        description: `Mock ${skillType} for testing`,
      });
      this.executionStates.set(skillId, 'idle');
    }
  }

  async registerSkill(skill: any): Promise<any> {
    if (!this.isInitializedFlag) {
      throw new Error('SkillManager not initialized');
    }

    const skillInstance = {
      skill,
      isEnabled: true,
      lastExecutionTime: undefined,
      executionCount: 0,
      averageExecutionTime: 0,
      successRate: 1.0,
    };

    this.skills.set(skill.id, skillInstance);
    this.executionStates.set(skill.id, 'idle');

    return skillInstance;
  }

  async executeSkill<T>(
    skillId: string,
    _input: SkillInput,
  ): Promise<SkillResult<T>> {
    const startTime = Date.now();

    if (!this.isInitializedFlag) {
      throw new Error('SkillManager not initialized');
    }

    // Find skill by type (for mock purposes)
    let skillType: SkillType | null = null;
    if (skillId.includes('ContentPredictionSkill'))
      skillType = 'ContentPredictionSkill';
    else if (skillId.includes('ResourceOptimizationSkill'))
      skillType = 'ResourceOptimizationSkill';
    else if (skillId.includes('QualityAssessmentSkill'))
      skillType = 'QualityAssessmentSkill';
    else if (skillId.includes('BehaviorAnalysisSkill'))
      skillType = 'BehaviorAnalysisSkill';
    else if (skillId.includes('ErrorRecoverySkill'))
      skillType = 'ErrorRecoverySkill';
    else skillType = skillId as SkillType; // Fallback

    if (!skillType || !(skillType in MOCK_SKILL_RESPONSES)) {
      const error: SkillError = {
        code: SkillErrorCode.SKILL_UNAVAILABLE,
        message: `Unknown skill type: ${skillType}`,
        retryable: false,
      };

      return {
        success: false,
        error,
        executionTimeMs: Date.now() - startTime,
        skillType: skillType || ('unknown' as SkillType),
      };
    }

    this.executionStates.set(skillId, 'executing');

    // Simulate execution time
    const executionTime = MOCK_EXECUTION_TIMES[skillType] || 200;
    await this.delay(executionTime);

    // Simulate error scenarios if configured
    if (this.simulateErrors && this.errorScenario) {
      this.executionStates.set(skillId, 'failed');

      return {
        success: false,
        error: MOCK_ERROR_SCENARIOS[this.errorScenario],
        executionTimeMs: Date.now() - startTime,
        skillType,
      };
    }

    this.executionStates.set(skillId, 'completed');

    const mockData = MOCK_SKILL_RESPONSES[skillType];

    return {
      success: true,
      data: mockData as T,
      executionTimeMs: Date.now() - startTime,
      skillType,
      confidence: this.getConfidenceForSkill(skillType, mockData),
      metadata: {
        skillId,
        timestamp: new Date().toISOString(),
        environment: this.config?.environment,
        mockResponse: true,
      },
    };
  }

  getSkillStatus(skillId: string): SkillExecutionState {
    return this.executionStates.get(skillId) || 'idle';
  }

  async shutdown(): Promise<void> {
    this.skills.clear();
    this.executionStates.clear();
    this.isInitializedFlag = false;
    this.config = null;
  }

  isInitialized(): boolean {
    return this.isInitializedFlag;
  }

  // Mock-specific methods for testing
  setErrorSimulation(
    enabled: boolean,
    scenario?: keyof typeof MOCK_ERROR_SCENARIOS,
  ): void {
    this.simulateErrors = enabled;
    this.errorScenario = scenario || null;
  }

  getExecutionHistory(): Map<string, SkillExecutionState> {
    return new Map(this.executionStates);
  }

  private getConfidenceForSkill(skillType: SkillType, data: any): number {
    switch (skillType) {
      case 'ContentPredictionSkill':
        return data.confidence || 0.8;
      case 'QualityAssessmentSkill':
        return data.overallScore || 0.9;
      case 'BehaviorAnalysisSkill':
        return data.engagementScore || 0.8;
      case 'ErrorRecoverySkill':
        return data.recoveryStrategy?.confidence || 0.9;
      default:
        return 0.85;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function for creating mock skill manager
export function createMockSkillManager(): MockSkillManager {
  return new MockSkillManager();
}

// Test utilities
export const SkillTestUtils = {
  // Create valid test input for each skill type
  createTestInput: {
    ContentPredictionSkill: () => ({
      context: {
        storyContext:
          'Once upon a time, in a magical forest, there lived a brave little rabbit named Ruby.',
        userInput: 'Ruby found a mysterious glowing stone',
        gradeLevel: 'K-2',
        previousPredictions: [],
      },
      options: {
        maxPredictions: 3,
        confidenceThreshold: 0.7,
      },
    }),

    ResourceOptimizationSkill: () => ({
      deviceInfo: {
        totalMemory: 4 * 1024 * 1024 * 1024,
        availableMemory: 1 * 1024 * 1024 * 1024,
        batteryLevel: 0.3,
        networkType: 'wifi',
        deviceTier: 'medium' as const,
      },
      currentUsage: {
        memoryUsage: 150 * 1024 * 1024,
        cpuUsage: 0.25,
        activeBackgroundTasks: 3,
      },
    }),

    QualityAssessmentSkill: () => ({
      content: {
        story:
          'Ruby picked up the glowing stone and felt its warm magic. The stone showed her a path through the forest that sparkled with golden light.',
        context:
          'Educational story for K-2 grade level focusing on adventure and friendship',
        gradeLevel: 'K-2',
      },
      criteria: {
        checkAppropriatenesss: true,
        checkCoherence: true,
        checkEngagement: true,
        checkEducationalValue: true,
      },
    }),

    BehaviorAnalysisSkill: () => ({
      userInteractions: [
        {
          type: 'tap' as const,
          timestamp: new Date(Date.now() - 10000),
          element: 'continue_button',
          duration: 100,
        },
        {
          type: 'scroll' as const,
          timestamp: new Date(Date.now() - 5000),
          element: 'story_content',
          duration: 2000,
        },
      ],
      sessionContext: {
        sessionId: 'test_session_123',
        sessionDuration: 300000,
        gradeLevel: 'K-2',
        deviceType: 'tablet',
      },
      analysisOptions: {
        includeEngagementPrediction: true,
        includePersonalizationSuggestions: true,
        includeDifficultyAdjustment: false,
      },
    }),

    ErrorRecoverySkill: () => ({
      error: {
        type: 'NETWORK_ERROR',
        message: 'Failed to generate story content',
        context: {
          endpoint: '/api/story/generate',
          attempts: 2,
        },
      },
      recoveryContext: {
        storyState: {
          currentContent: 'Ruby picked up the glowing stone...',
          characterState: { name: 'Ruby', location: 'forest' },
        },
        userState: {
          gradeLevel: 'K-2',
          preferences: { theme: 'adventure' },
        },
        sessionState: {
          sessionId: 'test_session_123',
          progress: 0.6,
        },
      },
      options: {
        preserveContext: true,
        generateFallback: true,
        userFriendlyMessage: true,
      },
    }),
  },

  // Validate skill responses match expected structure
  validateResponse: {
    ContentPredictionSkill: (data: any): boolean => {
      return !!(
        data.predictions &&
        Array.isArray(data.predictions) &&
        data.cacheKey &&
        typeof data.confidence === 'number'
      );
    },

    ResourceOptimizationSkill: (data: any): boolean => {
      return !!(
        data.recommendations &&
        data.optimizations &&
        data.estimatedImpact
      );
    },

    QualityAssessmentSkill: (data: any): boolean => {
      return !!(
        typeof data.overallScore === 'number' &&
        data.scores &&
        Array.isArray(data.feedback) &&
        typeof data.approved === 'boolean'
      );
    },

    BehaviorAnalysisSkill: (data: any): boolean => {
      return !!(
        Array.isArray(data.patterns) &&
        Array.isArray(data.predictions) &&
        Array.isArray(data.recommendations) &&
        typeof data.engagementScore === 'number'
      );
    },

    ErrorRecoverySkill: (data: any): boolean => {
      return !!(
        data.recoveryStrategy &&
        data.preservedContext &&
        typeof data.recoverySuccess === 'boolean'
      );
    },
  },
};
