// Claude Skills TypeScript Definitions
// Type definitions for Claude Skills SDK integration

export type SkillType =
  | 'ContentPredictionSkill'
  | 'ResourceOptimizationSkill'
  | 'QualityAssessmentSkill'
  | 'BehaviorAnalysisSkill'
  | 'ErrorRecoverySkill';

export type PerformanceMode = 'balanced' | 'performance' | 'battery';

export type SkillExecutionState =
  | 'idle'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'timeout';

// Core SDK Interfaces
export interface SkillConfig {
  apiKey: string;
  environment: 'development' | 'staging' | 'production';
  enabledSkills: SkillType[];
  performanceMode: PerformanceMode;
}

export interface SkillResult<T = any> {
  success: boolean;
  data?: T;
  error?: SkillError;
  executionTimeMs: number;
  skillType: SkillType;
  confidence?: number; // 0-1 confidence score for ML-based skills
  metadata?: Record<string, any>;
}

export interface SkillError {
  code: SkillErrorCode;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
}

export enum SkillErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SKILL_TIMEOUT = 'SKILL_TIMEOUT',
  INVALID_INPUT = 'INVALID_INPUT',
  SKILL_UNAVAILABLE = 'SKILL_UNAVAILABLE',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// Skill Manager Interface
export interface SkillManager {
  initialize(config: SkillConfig): Promise<void>;
  registerSkill(skill: Skill): Promise<SkillInstance>;
  executeSkill<T>(skillId: string, input: SkillInput): Promise<SkillResult<T>>;
  getSkillStatus(skillId: string): SkillExecutionState;
  shutdown(): Promise<void>;
  isInitialized(): boolean;
}

// Skill Definitions
export interface Skill {
  id: string;
  type: SkillType;
  version: string;
  description: string;
  inputSchema: any; // JSON Schema for input validation
  outputSchema: any; // JSON Schema for output validation
}

export interface SkillInstance {
  skill: Skill;
  isEnabled: boolean;
  lastExecutionTime?: Date;
  executionCount: number;
  averageExecutionTime: number;
  successRate: number;
}

export interface SkillInput {
  [key: string]: any;
}

// Content Prediction Skill Types
export interface ContentPredictionInput extends SkillInput {
  context: {
    storyContext: string;
    userInput: string;
    gradeLevel: string;
    previousPredictions?: string[];
  };
  options: {
    maxPredictions: number;
    confidenceThreshold: number;
  };
}

export interface ContentPredictionResult {
  predictions: ContentPrediction[];
  cacheKey: string;
  confidence: number;
}

export interface ContentPrediction {
  content: string;
  confidence: number;
  reasoning: string;
  metadata: {
    gradeLevel: string;
    theme: string;
    estimatedEngagement: number;
  };
}

// Resource Optimization Skill Types
export interface ResourceOptimizationInput extends SkillInput {
  deviceInfo: {
    totalMemory: number;
    availableMemory: number;
    batteryLevel: number;
    networkType: string;
    deviceTier: 'low' | 'medium' | 'high';
  };
  currentUsage: {
    memoryUsage: number;
    cpuUsage: number;
    activeBackgroundTasks: number;
  };
}

export interface ResourceOptimizationResult {
  recommendations: ResourceRecommendation[];
  optimizations: ResourceOptimization[];
  estimatedImpact: {
    memorySavings: number;
    batterySavings: number;
    performanceImprovement: number;
  };
}

export interface ResourceRecommendation {
  type: 'memory' | 'cpu' | 'battery' | 'network';
  action: string;
  priority: 'low' | 'medium' | 'high';
  estimatedImpact: number;
}

export interface ResourceOptimization {
  parameter: string;
  currentValue: any;
  recommendedValue: any;
  reason: string;
}

// Quality Assessment Skill Types
export interface QualityAssessmentInput extends SkillInput {
  content: {
    story: string;
    context: string;
    gradeLevel: string;
  };
  criteria: {
    checkAppropriatenesss: boolean;
    checkCoherence: boolean;
    checkEngagement: boolean;
    checkEducationalValue: boolean;
  };
}

export interface QualityAssessmentResult {
  overallScore: number; // 0-1
  scores: {
    appropriateness: number;
    coherence: number;
    engagement: number;
    educationalValue: number;
  };
  feedback: QualityFeedback[];
  recommendations: string[];
  approved: boolean;
}

export interface QualityFeedback {
  category: 'appropriateness' | 'coherence' | 'engagement' | 'educational';
  message: string;
  severity: 'info' | 'warning' | 'error';
  suggestions?: string[];
}

// Behavior Analysis Skill Types
export interface BehaviorAnalysisInput extends SkillInput {
  userInteractions: UserInteraction[];
  sessionContext: {
    sessionId: string;
    sessionDuration: number;
    gradeLevel: string;
    deviceType: string;
  };
  analysisOptions: {
    includeEngagementPrediction: boolean;
    includePersonalizationSuggestions: boolean;
    includeDifficultyAdjustment: boolean;
  };
}

export interface UserInteraction {
  type: 'tap' | 'swipe' | 'scroll' | 'text_input' | 'voice_input';
  timestamp: Date;
  element: string;
  duration?: number;
  data?: Record<string, any>;
}

export interface BehaviorAnalysisResult {
  patterns: BehaviorPattern[];
  predictions: BehaviorPrediction[];
  recommendations: PersonalizationRecommendation[];
  engagementScore: number; // 0-1
}

export interface BehaviorPattern {
  pattern: string;
  frequency: number;
  confidence: number;
  implications: string[];
}

export interface BehaviorPrediction {
  event: string;
  probability: number;
  timeframe: number; // ms until predicted event
  confidence: number;
}

export interface PersonalizationRecommendation {
  type: 'ui_adjustment' | 'content_preference' | 'difficulty_adjustment';
  recommendation: string;
  confidence: number;
  expectedImpact: number;
}

// Error Recovery Skill Types
export interface ErrorRecoveryInput extends SkillInput {
  error: {
    type: string;
    message: string;
    context: Record<string, any>;
    stackTrace?: string;
  };
  recoveryContext: {
    storyState: any;
    userState: any;
    sessionState: any;
  };
  options: {
    preserveContext: boolean;
    generateFallback: boolean;
    userFriendlyMessage: boolean;
  };
}

export interface ErrorRecoveryResult {
  recoveryStrategy: RecoveryStrategy;
  fallbackContent?: any;
  userMessage?: string;
  preservedContext: Record<string, any>;
  recoverySuccess: boolean;
}

export interface RecoveryStrategy {
  type: 'retry' | 'fallback' | 'graceful_degradation' | 'user_notification';
  action: string;
  parameters: Record<string, any>;
  confidence: number;
}

// Monitoring and Analytics Types
export interface SkillMetrics {
  skillType: SkillType;
  executionCount: number;
  successRate: number;
  averageExecutionTime: number;
  errorRate: number;
  lastExecuted?: Date;
}

export interface PerformanceMetrics {
  totalExecutions: number;
  averageResponseTime: number;
  memoryUsage: number;
  errorRate: number;
  skillMetrics: Record<SkillType, SkillMetrics>;
}

// Event Types for Monitoring
export type SkillEvent =
  | SkillExecutionStartEvent
  | SkillExecutionCompleteEvent
  | SkillErrorEvent
  | SkillConfigurationEvent;

export interface SkillExecutionStartEvent {
  type: 'skill_execution_start';
  skillType: SkillType;
  skillId: string;
  timestamp: Date;
  input: SkillInput;
}

export interface SkillExecutionCompleteEvent {
  type: 'skill_execution_complete';
  skillType: SkillType;
  skillId: string;
  timestamp: Date;
  executionTimeMs: number;
  success: boolean;
  result?: SkillResult;
}

export interface SkillErrorEvent {
  type: 'skill_error';
  skillType: SkillType;
  skillId: string;
  timestamp: Date;
  error: SkillError;
  context: Record<string, any>;
}

export interface SkillConfigurationEvent {
  type: 'skill_configuration_change';
  timestamp: Date;
  changes: Record<string, any>;
  reason: string;
}

// Health Check Types
export interface SkillHealthStatus {
  skillType: SkillType;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'disabled';
  lastCheck: Date;
  responseTime?: number;
  errorRate: number;
  message?: string;
}

export interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  skills: SkillHealthStatus[];
  lastUpdated: Date;
  issues: string[];
}

// Fallback Strategy Types
export interface FallbackStrategy {
  name: string;
  description: string;
  execute(input: SkillInput, error: SkillError): Promise<SkillResult>;
  canHandle(error: SkillError): boolean;
  priority: number; // Higher number = higher priority
}

export interface CircuitBreakerState {
  skillType: SkillType;
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  lastFailure?: Date;
  nextRetryTime?: Date;
}

// Cache Types
export interface SkillCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  size(): Promise<number>;
}

export interface CacheEntry<T> {
  value: T;
  timestamp: Date;
  ttl: number;
  hits: number;
  size: number; // in bytes
}
