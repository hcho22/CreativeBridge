import { auditLogger, EventType, EventCategory, Severity } from './auditLogger';
import { SkillError, SkillErrorCode, SkillType } from '../types/claudeSkills';
import { structuredLogger } from '../utils/logger';
import {
  ContextualFallbackService,
  ErrorRecoveryContext,
  ContextualFallbackResult,
} from './contextualFallback';
import {
  SeamlessErrorMaskingService,
  UserProfile,
  SessionContext,
} from './seamlessErrorMasking';
import { PredictiveFailurePreventionService } from './predictiveFailurePrevention';
import { ProgressiveEnhancementService } from './progressiveEnhancement';
import { NetworkAdapterService } from './networkAdapter';

export enum ErrorLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export enum ErrorCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  PERMISSION = 'PERMISSION',
  DATABASE = 'DATABASE',
  UI = 'UI',
  SYSTEM = 'SYSTEM',
  SECURITY = 'SECURITY',
  CLAUDE_SKILLS = 'CLAUDE_SKILLS', // New category for Claude Skills errors
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
  userAgent?: string;
  timestamp?: Date;
}

export interface ProcessedError {
  id: string;
  message: string;
  userMessage: string;
  level: ErrorLevel;
  category: ErrorCategory;
  isRetryable: boolean;
  context: ErrorContext;
  originalError?: Error;
}

class ErrorHandler {
  private errorCount = 0;
  private contextualFallbackService?: ContextualFallbackService;
  private seamlessErrorMaskingService?: SeamlessErrorMaskingService;
  private predictiveFailurePreventionService?: PredictiveFailurePreventionService;
  private progressiveEnhancementService?: ProgressiveEnhancementService;
  private networkAdapterService?: NetworkAdapterService;

  /**
   * Process and log an error with appropriate security measures
   */
  async handleError(
    error: Error | string,
    level: ErrorLevel = ErrorLevel.ERROR,
    category: ErrorCategory = ErrorCategory.SYSTEM,
    context: ErrorContext = {},
  ): Promise<ProcessedError> {
    const errorId = this.generateErrorId();
    const timestamp = new Date();

    // Create processed error object
    const processedError: ProcessedError = {
      id: errorId,
      message: typeof error === 'string' ? error : error.message,
      userMessage: this.getUserFriendlyMessage(error, category),
      level,
      category,
      isRetryable: this.isRetryable(error, category),
      context: {
        ...context,
        timestamp,
      },
      originalError: typeof error === 'string' ? undefined : error,
    };

    // Sanitize for production logging
    const sanitizedError = this.sanitizeError(processedError);

    // Log to audit system
    await this.logToAuditSystem(sanitizedError);

    // Log to console in development
    if (__DEV__) {
      this.logToConsole(processedError);
    }

    // Send to crash reporting in production
    if (!__DEV__) {
      this.sendToCrashReporting(sanitizedError);
    }

    return processedError;
  }

  /**
   * Handle authentication-specific errors
   */
  async handleAuthError(
    error: Error | string,
    context: ErrorContext = {},
  ): Promise<ProcessedError> {
    const authContext = {
      ...context,
      category: ErrorCategory.AUTHENTICATION,
    };

    // Check for suspicious patterns
    const isSuspicious = this.detectSuspiciousAuthActivity(error, context);

    if (isSuspicious) {
      await auditLogger.logSuspiciousActivity(
        context.userId,
        `Suspicious authentication error: ${
          typeof error === 'string' ? error : error.message
        }`,
        70,
        authContext.metadata,
      );
    }

    return this.handleError(
      error,
      ErrorLevel.WARNING,
      ErrorCategory.AUTHENTICATION,
      authContext,
    );
  }

  /**
   * Handle validation errors with input logging
   */
  async handleValidationError(
    error: Error | string,
    fieldName?: string,
    inputValue?: any,
    context: ErrorContext = {},
  ): Promise<ProcessedError> {
    const validationContext = {
      ...context,
      metadata: {
        ...context.metadata,
        fieldName,
        inputLength:
          typeof inputValue === 'string' ? inputValue.length : undefined,
        inputType: typeof inputValue,
        // Don't log actual values in production for security
        inputSample: __DEV__ ? inputValue : undefined,
      },
    };

    // Log validation error for security monitoring
    await auditLogger.logEvent({
      userId: context.userId,
      eventType: EventType.VALIDATION_ERROR,
      eventCategory: EventCategory.ERROR,
      severity: Severity.LOW,
      description: `Validation error on field: ${fieldName || 'unknown'}`,
      metadata: validationContext.metadata,
    });

    return this.handleError(
      error,
      ErrorLevel.WARNING,
      ErrorCategory.VALIDATION,
      validationContext,
    );
  }

  /**
   * Handle network errors with retry logic
   */
  async handleNetworkError(
    error: Error | string,
    endpoint?: string,
    method?: string,
    context: ErrorContext = {},
  ): Promise<ProcessedError> {
    const networkContext = {
      ...context,
      metadata: {
        ...context.metadata,
        endpoint,
        method,
        timestamp: new Date().toISOString(),
      },
    };

    return this.handleError(
      error,
      ErrorLevel.ERROR,
      ErrorCategory.NETWORK,
      networkContext,
    );
  }

  /**
   * Handle security-related errors
   */
  async handleSecurityError(
    error: Error | string,
    securityEvent: string,
    riskScore: number = 50,
    context: ErrorContext = {},
  ): Promise<ProcessedError> {
    const securityContext = {
      ...context,
      metadata: {
        ...context.metadata,
        securityEvent,
        riskScore,
        timestamp: new Date().toISOString(),
      },
    };

    // Always log security errors as suspicious
    await auditLogger.logSuspiciousActivity(
      context.userId,
      `Security error: ${securityEvent}`,
      riskScore,
      securityContext.metadata,
    );

    return this.handleError(
      error,
      riskScore > 70 ? ErrorLevel.CRITICAL : ErrorLevel.ERROR,
      ErrorCategory.SECURITY,
      securityContext,
    );
  }

  /**
   * Handle Claude Skills-specific errors
   */
  async handleSkillError(
    skillError: SkillError,
    skillType: SkillType,
    skillId: string,
    context: ErrorContext = {},
  ): Promise<ProcessedError> {
    const skillContext = {
      ...context,
      metadata: {
        ...context.metadata,
        skillType,
        skillId,
        errorCode: skillError.code,
        retryable: skillError.retryable,
        errorDetails: skillError.details,
        timestamp: new Date().toISOString(),
      },
    };

    // Map skill error code to error level
    const errorLevel = this.mapSkillErrorToLevel(skillError.code);

    // Log using structured logger
    structuredLogger.logSkillError(skillType, skillId, skillError, {
      correlationId: context.metadata?.correlationId as string,
      userId: context.userId,
      sessionId: context.sessionId,
      skillType,
      skillId,
    });

    return this.handleError(
      new Error(skillError.message),
      errorLevel,
      ErrorCategory.CLAUDE_SKILLS,
      skillContext,
    );
  }

  /**
   * Initialize context-aware error handling services with progressive enhancement
   */
  initializeContextAwareHandling(skillManager: any): void {
    this.contextualFallbackService = new ContextualFallbackService(
      skillManager,
    );
    this.seamlessErrorMaskingService = new SeamlessErrorMaskingService();
    this.predictiveFailurePreventionService =
      new PredictiveFailurePreventionService(skillManager);
    this.progressiveEnhancementService = new ProgressiveEnhancementService(
      skillManager,
    );
    this.networkAdapterService = new NetworkAdapterService();
  }

  /**
   * Handle context-aware story generation errors with intelligent fallback
   */
  async handleStoryGenerationError(
    error: SkillError | Error,
    request: any, // StoryRequest type
    storyContext?: any, // StoryContext type
    attemptNumber: number = 1,
    userExperienceState?: {
      isFirstInteraction: boolean;
      sessionDuration: number;
      previousSuccesses: number;
      consecutiveFailures: number;
    },
    userProfile?: UserProfile,
    sessionContext?: SessionContext,
  ): Promise<
    ProcessedError & {
      fallbackResult?: ContextualFallbackResult;
      userMasking?: {
        userMessage: string | null;
        showProgress: boolean;
        delayResponse: boolean;
        alternativeAction?: string;
      };
    }
  > {
    // Create SkillError from regular Error if needed
    const isSkillError = (err: any): err is SkillError => {
      return (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        'retryable' in err &&
        'message' in err
      );
    };

    const skillError: SkillError = isSkillError(error)
      ? error
      : {
          code: 'UNKNOWN_ERROR' as any,
          message:
            error instanceof Error ? error.message : 'Unknown error occurred',
          retryable: true,
          details: {
            originalError:
              error instanceof Error ? error.message : String(error),
          },
        };

    const baseProcessedError = await this.handleSkillError(
      skillError,
      'StoryGenerationSkill' as any,
      'story-generation',
      {
        component: 'StoryGeneration',
        action: 'generateContinuation',
        metadata: {
          attemptNumber,
          hasStoryContext: !!storyContext,
          requestGradeLevel: request?.gradeLevel,
          storyLength: request?.storySoFar?.length || 0,
          userExperienceState,
        },
      },
    );

    let fallbackResult: ContextualFallbackResult | undefined;
    let userMasking: any = {
      userMessage: null,
      showProgress: false,
      delayResponse: false,
    };

    // Execute context-aware error recovery if services are available
    if (this.contextualFallbackService && userExperienceState) {
      try {
        const recoveryContext: ErrorRecoveryContext = {
          originalRequest: request,
          storyContext: storyContext || null,
          errorType: skillError.code,
          errorMessage: skillError.message,
          attemptNumber,
          previousFailures: [],
          userExperienceState,
        };

        fallbackResult = await this.contextualFallbackService.recoverFromError(
          skillError,
          recoveryContext,
        );

        // Apply seamless error masking if user profile is available
        if (this.seamlessErrorMaskingService && userProfile && sessionContext) {
          const maskingStrategy =
            await this.seamlessErrorMaskingService.maskErrorForUser(
              skillError,
              fallbackResult,
              userProfile,
              sessionContext,
              recoveryContext,
            );

          userMasking = {
            userMessage: maskingStrategy.userMessage,
            showProgress: maskingStrategy.showProgress,
            delayResponse: maskingStrategy.delayResponse,
            alternativeAction: maskingStrategy.alternativeAction,
          };
        }
      } catch (contextualError) {
        structuredLogger.warn(
          'Contextual error handling failed, using basic recovery',
          {},
          contextualError as Error,
        );
      }
    }

    return {
      ...baseProcessedError,
      fallbackResult,
      userMasking,
    };
  }

  /**
   * Handle story generation with progressive enhancement and network adaptation
   */
  async handleStoryGenerationWithEnhancement(
    storyOperation: () => Promise<any>,
    request: any, // StoryRequest type
    userProfile?: UserProfile,
    sessionContext?: SessionContext,
    options: {
      retryStrategy?: string;
      fallbackChain?: string;
      preserveUserExperience?: boolean;
    } = {},
  ): Promise<{
    result?: any;
    progressiveEnhancementUsed: boolean;
    networkAdaptationApplied: boolean;
    degradationLevel: number;
    userExperiencePreserved: boolean;
    performance: {
      totalTime: number;
      adaptationTime?: number;
      enhancementTime?: number;
    };
    errors?: ProcessedError[];
  }> {
    const startTime = Date.now();
    const errors: ProcessedError[] = [];

    try {
      structuredLogger.info(
        'Starting progressive enhancement for story generation',
        {
          requestGradeLevel: request.gradeLevel,
          hasUserProfile: !!userProfile,
          hasSessionContext: !!sessionContext,
          preserveUserExperience: options.preserveUserExperience,
        },
      );

      // Check if progressive enhancement is available
      if (!this.progressiveEnhancementService || !this.networkAdapterService) {
        structuredLogger.warn(
          'Progressive enhancement services not initialized, using basic story generation',
        );
        return await this.handleBasicStoryGeneration(
          storyOperation,
          request,
          startTime,
        );
      }

      // Step 1: Network condition assessment and adaptation
      const adaptationStartTime = Date.now();
      let networkAdaptationApplied = false;
      let adaptedRequest = request;

      try {
        const networkViability =
          await this.networkAdapterService.checkNetworkViability(
            'story_generation',
          );

        if (networkViability.recommendation === 'adapt') {
          const adaptationResult =
            await this.networkAdapterService.adaptRequestForNetwork(request);
          adaptedRequest = adaptationResult.modifiedRequest;
          networkAdaptationApplied = adaptationResult.adaptations.length > 0;

          structuredLogger.info('Network adaptation applied', {
            adaptationCount: adaptationResult.adaptations.length,
            expectedLatencyReduction:
              adaptationResult.expectedBehavior.reducedLatency,
            qualityImpact: adaptationResult.expectedBehavior.qualityImpact,
          });
        } else if (networkViability.recommendation === 'offline') {
          // Handle connection loss
          await this.networkAdapterService.handleConnectionLoss();
          networkAdaptationApplied = true;
        }
      } catch (adaptationError) {
        const processedError = await this.handleError(
          adaptationError as Error,
          ErrorLevel.WARNING,
          ErrorCategory.NETWORK,
        );
        errors.push(processedError);
      }

      const adaptationTime = Date.now() - adaptationStartTime;

      // Step 2: Progressive enhancement execution
      const enhancementStartTime = Date.now();

      const enhancementResult =
        await this.progressiveEnhancementService.executeWithEnhancement(
          () => storyOperation(),
          'story_generation',
          adaptedRequest,
          {
            retryStrategy: options.retryStrategy || 'adaptive',
            fallbackChain: options.fallbackChain || 'story_generation',
            preserveUserExperience: options.preserveUserExperience !== false,
          },
        );

      const enhancementTime = Date.now() - enhancementStartTime;
      const totalTime = Date.now() - startTime;

      // Step 3: Apply user experience preservation if context-aware services are available
      let finalUserExperiencePreserved =
        enhancementResult.userExperiencePreserved;

      if (
        enhancementResult.fallbackUsed &&
        this.seamlessErrorMaskingService &&
        userProfile &&
        sessionContext
      ) {
        try {
          // Create a mock recovery result for the masking service
          const mockRecoveryResult = {
            story: enhancementResult.result?.story || '',
            preservedContext: enhancementResult.degradationLevel < 50,
            contextPreservationScore: Math.max(
              0,
              100 - enhancementResult.degradationLevel,
            ),
            fallbackStrategy: 'progressive_enhancement',
            qualityScore: Math.max(
              0,
              100 - enhancementResult.degradationLevel * 1.5,
            ),
            seamless: enhancementResult.userExperiencePreserved,
            continuityMaintained: enhancementResult.degradationLevel < 30,
            recommendations: [
              `Progressive enhancement level: ${enhancementResult.degradationLevel}`,
            ],
          };

          const mockRecoveryContext = {
            originalRequest: request,
            storyContext: null,
            errorType: 'UNKNOWN_ERROR' as any,
            errorMessage: `Service degraded to level ${enhancementResult.degradationLevel}`,
            attemptNumber: enhancementResult.retryAttempts + 1,
            previousFailures: [],
            userExperienceState: {
              isFirstInteraction: sessionContext.isFirstSession,
              sessionDuration: sessionContext.currentDuration,
              previousSuccesses: sessionContext.successfulInteractions,
              consecutiveFailures: sessionContext.errorCount,
            },
          };

          const maskingStrategy =
            await this.seamlessErrorMaskingService.maskErrorForUser(
              new Error(
                `Progressive degradation level ${enhancementResult.degradationLevel}`,
              ),
              mockRecoveryResult,
              userProfile,
              sessionContext,
              mockRecoveryContext,
            );

          // Execute masking strategy to further improve user experience
          const maskingExecution =
            await this.seamlessErrorMaskingService.executeMaskingStrategy(
              maskingStrategy,
              userProfile,
              sessionContext,
            );

          finalUserExperiencePreserved =
            maskingExecution.userExperienceScore > 70;

          structuredLogger.info('User experience masking applied', {
            maskingStrategy: maskingStrategy.strategy,
            userExperienceScore: maskingExecution.userExperienceScore,
            maskingExecuted: maskingExecution.executed,
          });
        } catch (maskingError) {
          structuredLogger.warn(
            'User experience masking failed',
            {},
            maskingError as Error,
          );
        }
      }

      structuredLogger.info('Progressive enhancement completed', {
        enhancementUsed: true,
        networkAdapted: networkAdaptationApplied,
        degradationLevel: enhancementResult.degradationLevel,
        retryAttempts: enhancementResult.retryAttempts,
        fallbackUsed: enhancementResult.fallbackUsed,
        userExperiencePreserved: finalUserExperiencePreserved,
        totalTime,
        adaptationTime,
        enhancementTime,
      });

      return {
        result: enhancementResult.result,
        progressiveEnhancementUsed: true,
        networkAdaptationApplied,
        degradationLevel: enhancementResult.degradationLevel,
        userExperiencePreserved: finalUserExperiencePreserved,
        performance: {
          totalTime,
          adaptationTime,
          enhancementTime,
        },
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      structuredLogger.error(
        'Progressive enhancement failed completely',
        {},
        error as Error,
      );

      const processedError = await this.handleError(
        error as Error,
        ErrorLevel.ERROR,
        ErrorCategory.CLAUDE_SKILLS,
      );
      errors.push(processedError);

      // Fall back to basic story generation
      const basicResult = await this.handleBasicStoryGeneration(
        storyOperation,
        request,
        startTime,
      );

      return {
        ...basicResult,
        progressiveEnhancementUsed: false,
        networkAdaptationApplied: false,
        errors,
      };
    }
  }

  /**
   * Handle basic story generation without progressive enhancement (fallback)
   */
  private async handleBasicStoryGeneration(
    storyOperation: () => Promise<any>,
    request: any,
    startTime: number,
  ): Promise<{
    result?: any;
    progressiveEnhancementUsed: boolean;
    networkAdaptationApplied: boolean;
    degradationLevel: number;
    userExperiencePreserved: boolean;
    performance: {
      totalTime: number;
    };
  }> {
    try {
      const result = await storyOperation();
      const totalTime = Date.now() - startTime;

      return {
        result,
        progressiveEnhancementUsed: false,
        networkAdaptationApplied: false,
        degradationLevel: 0,
        userExperiencePreserved: true,
        performance: {
          totalTime,
        },
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;

      // Try context-aware fallback if available
      if (this.contextualFallbackService) {
        try {
          const isSkillError = (err: any): err is SkillError => {
            return (
              err &&
              typeof err === 'object' &&
              'code' in err &&
              'retryable' in err
            );
          };

          const recoveryContext = {
            originalRequest: request,
            storyContext: null,
            errorType: isSkillError(error)
              ? error.code
              : ('UNKNOWN_ERROR' as any),
            errorMessage: (error as Error).message,
            attemptNumber: 1,
            previousFailures: [],
            userExperienceState: {
              isFirstInteraction: true,
              sessionDuration: 0,
              previousSuccesses: 0,
              consecutiveFailures: 1,
            },
          };

          const fallbackResult =
            await this.contextualFallbackService.recoverFromError(
              error as SkillError,
              recoveryContext,
            );

          return {
            result: { content: fallbackResult.story },
            progressiveEnhancementUsed: false,
            networkAdaptationApplied: false,
            degradationLevel: 80, // High degradation for basic fallback
            userExperiencePreserved: fallbackResult.seamless,
            performance: {
              totalTime,
            },
          };
        } catch (fallbackError) {
          structuredLogger.error(
            'Basic fallback also failed',
            {},
            fallbackError as Error,
          );
        }
      }

      // Emergency fallback
      return {
        result: {
          content:
            request.gradeLevel === 'K-2'
              ? "Let's continue this story together! What would you like to happen next?"
              : 'The story continues with new possibilities. What direction should it take?',
        },
        progressiveEnhancementUsed: false,
        networkAdaptationApplied: false,
        degradationLevel: 95, // Maximum degradation
        userExperiencePreserved: false,
        performance: {
          totalTime,
        },
      };
    }
  }

  /**
   * Get current progressive enhancement metrics
   */
  public getProgressiveEnhancementMetrics(): {
    available: boolean;
    networkMetrics?: any;
    enhancementMetrics?: any;
  } {
    if (!this.progressiveEnhancementService || !this.networkAdapterService) {
      return { available: false };
    }

    return {
      available: true,
      networkMetrics: this.networkAdapterService.getNetworkMetrics(),
      enhancementMetrics: this.progressiveEnhancementService.getMetrics(),
    };
  }

  /**
   * Map skill error code to error level
   */
  private mapSkillErrorToLevel(errorCode: SkillErrorCode): ErrorLevel {
    switch (errorCode) {
      case SkillErrorCode.CONFIGURATION_ERROR:
      case SkillErrorCode.AUTHENTICATION_ERROR:
        return ErrorLevel.CRITICAL;
      case SkillErrorCode.SKILL_TIMEOUT:
      case SkillErrorCode.RATE_LIMIT_EXCEEDED:
        return ErrorLevel.ERROR;
      case SkillErrorCode.NETWORK_ERROR:
        return ErrorLevel.WARNING; // Network errors are often transient
      case SkillErrorCode.SKILL_UNAVAILABLE:
        return ErrorLevel.WARNING;
      default:
        return ErrorLevel.ERROR;
    }
  }

  private generateErrorId(): string {
    this.errorCount++;
    return `err_${Date.now()}_${this.errorCount}_${Math.random()
      .toString(36)
      .substr(2, 5)}`;
  }

  private getUserFriendlyMessage(
    error: Error | string,
    category: ErrorCategory,
  ): string {
    const message = typeof error === 'string' ? error : error.message;

    // Don't expose sensitive error details to users
    switch (category) {
      case ErrorCategory.AUTHENTICATION:
        if (message.toLowerCase().includes('password')) {
          return 'Invalid email or password. Please try again.';
        }
        if (message.toLowerCase().includes('email')) {
          return 'Please check your email address and try again.';
        }
        return 'Authentication failed. Please try again.';

      case ErrorCategory.NETWORK:
        if (message.toLowerCase().includes('timeout')) {
          return 'Request timed out. Please check your connection and try again.';
        }
        return 'Network error. Please check your connection and try again.';

      case ErrorCategory.VALIDATION:
        return 'Please check your input and try again.';

      case ErrorCategory.PERMISSION:
        return "You don't have permission to perform this action.";

      case ErrorCategory.DATABASE:
        return 'A temporary issue occurred. Please try again.';

      case ErrorCategory.SECURITY:
        return 'Security check failed. Please contact support if this continues.';

      case ErrorCategory.CLAUDE_SKILLS:
        return 'AI feature temporarily unavailable. Please try again in a moment.';

      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  private isRetryable(error: Error | string, category: ErrorCategory): boolean {
    const message = typeof error === 'string' ? error : error.message;

    switch (category) {
      case ErrorCategory.NETWORK:
        return !message.toLowerCase().includes('unauthorized');

      case ErrorCategory.DATABASE:
        return true;

      case ErrorCategory.AUTHENTICATION:
        return false; // Don't auto-retry auth errors

      case ErrorCategory.SECURITY:
        return false; // Don't auto-retry security errors

      case ErrorCategory.VALIDATION:
        return false; // User needs to fix input

      case ErrorCategory.CLAUDE_SKILLS:
        // Retryable based on skill error code
        return true; // Most skill errors are retryable

      default:
        return true;
    }
  }

  private sanitizeError(error: ProcessedError): ProcessedError {
    const sanitized = { ...error };

    if (!__DEV__) {
      // Remove potentially sensitive information in production
      if (sanitized.context.metadata) {
        const cleanMetadata = { ...sanitized.context.metadata };

        // Remove sensitive fields
        delete cleanMetadata.password;
        delete cleanMetadata.token;
        delete cleanMetadata.secret;
        delete cleanMetadata.key;
        delete cleanMetadata.credential;
        delete cleanMetadata.inputSample;

        // Truncate long values
        Object.keys(cleanMetadata).forEach(key => {
          if (
            typeof cleanMetadata[key] === 'string' &&
            cleanMetadata[key].length > 200
          ) {
            cleanMetadata[key] = cleanMetadata[key].substring(0, 200) + '...';
          }
        });

        sanitized.context.metadata = cleanMetadata;
      }

      // Sanitize error message
      if (sanitized.message.length > 500) {
        sanitized.message = sanitized.message.substring(0, 500) + '...';
      }

      // Remove stack trace in production
      if (sanitized.originalError) {
        sanitized.originalError = {
          ...sanitized.originalError,
          stack: undefined,
        };
      }
    }

    return sanitized;
  }

  private async logToAuditSystem(error: ProcessedError): Promise<void> {
    try {
      const eventType = this.mapErrorToEventType(error.category);
      const severity = this.mapErrorLevelToSeverity(error.level);

      await auditLogger.logEvent({
        userId: error.context.userId,
        eventType,
        eventCategory: EventCategory.ERROR,
        severity,
        description: `${error.category}: ${error.message}`,
        metadata: {
          errorId: error.id,
          level: error.level,
          category: error.category,
          isRetryable: error.isRetryable,
          component: error.context.component,
          action: error.context.action,
          ...error.context.metadata,
        },
        sessionId: error.context.sessionId,
      });
    } catch (auditError) {
      // Don't let audit logging errors crash the app
      if (__DEV__) {
        console.error('Failed to log error to audit system:', auditError);
      }
    }
  }

  private logToConsole(error: ProcessedError): void {
    const logMethod =
      error.level === ErrorLevel.CRITICAL || error.level === ErrorLevel.ERROR
        ? console.error
        : error.level === ErrorLevel.WARNING
        ? console.warn
        : console.log;

    logMethod(`[${error.level}] ${error.category}: ${error.message}`, {
      id: error.id,
      context: error.context,
      originalError: error.originalError,
    });
  }

  private sendToCrashReporting(error: ProcessedError): void {
    // Placeholder for crash reporting service integration
    // In a real app, you would integrate with services like:
    // - Sentry
    // - Bugsnag
    // - Firebase Crashlytics
    // - Custom logging service

    if (
      error.level === ErrorLevel.CRITICAL ||
      error.level === ErrorLevel.ERROR
    ) {
      // Send to crash reporting service
      // Example: Sentry.captureException(error.originalError, { extra: error.context });
    }
  }

  private detectSuspiciousAuthActivity(
    error: Error | string,
    _context: ErrorContext,
  ): boolean {
    const message = typeof error === 'string' ? error : error.message;
    const lowercaseMessage = message.toLowerCase();

    // Patterns that might indicate malicious activity
    const suspiciousPatterns = [
      'too many attempts',
      'rate limit',
      'blocked',
      'suspicious',
      'sql injection',
      'script',
      'xss',
      'payload',
    ];

    return suspiciousPatterns.some(pattern =>
      lowercaseMessage.includes(pattern),
    );
  }

  private mapErrorToEventType(category: ErrorCategory): EventType {
    switch (category) {
      case ErrorCategory.AUTHENTICATION:
        return EventType.LOGIN_FAILED;
      case ErrorCategory.NETWORK:
        return EventType.NETWORK_ERROR;
      case ErrorCategory.VALIDATION:
        return EventType.VALIDATION_ERROR;
      case ErrorCategory.SECURITY:
        return EventType.SUSPICIOUS_ACTIVITY;
      case ErrorCategory.CLAUDE_SKILLS:
        return EventType.APP_ERROR; // Could add specific event type for skills
      default:
        return EventType.APP_ERROR;
    }
  }

  private mapErrorLevelToSeverity(level: ErrorLevel): Severity {
    switch (level) {
      case ErrorLevel.CRITICAL:
        return Severity.CRITICAL;
      case ErrorLevel.ERROR:
        return Severity.HIGH;
      case ErrorLevel.WARNING:
        return Severity.MEDIUM;
      default:
        return Severity.LOW;
    }
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();
