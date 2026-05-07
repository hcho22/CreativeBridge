/**
 * Fallback Strategy System
 *
 * Provides fallback mechanisms when Claude Skills fail or are unavailable.
 * Ensures service continuity and graceful degradation.
 */

import { SkillError, SkillErrorCode } from '../../types/claudeSkills';

export type FallbackReason =
  | 'skill_error'
  | 'skill_timeout'
  | 'skill_unavailable'
  | 'skill_rate_limited'
  | 'network_error'
  | 'configuration_error'
  | 'unknown_error';

export interface FallbackContext {
  originalRequest: any;
  error?: SkillError;
  reason: FallbackReason;
  attemptNumber: number;
  metadata?: Record<string, any>;
}

export interface FallbackResult<T> {
  success: boolean;
  data?: T;
  usedFallback: boolean;
  fallbackReason?: FallbackReason;
  error?: string;
  metadata?: Record<string, any>;
}

export interface FallbackStrategy<TRequest, TResponse> {
  /**
   * Check if this strategy can handle the given error
   */
  canHandle(error: SkillError, context: FallbackContext): boolean;

  /**
   * Execute the fallback strategy
   */
  execute(
    request: TRequest,
    context: FallbackContext,
  ): Promise<FallbackResult<TResponse>>;

  /**
   * Get strategy priority (higher = tried first)
   */
  getPriority(): number;

  /**
   * Get strategy name for logging
   */
  getName(): string;
}

/**
 * Base fallback strategy implementation
 */
export abstract class BaseFallbackStrategy<TRequest, TResponse>
  implements FallbackStrategy<TRequest, TResponse>
{
  protected priority: number = 0;

  abstract canHandle(error: SkillError, context: FallbackContext): boolean;
  abstract execute(
    request: TRequest,
    context: FallbackContext,
  ): Promise<FallbackResult<TResponse>>;

  getPriority(): number {
    return this.priority;
  }

  abstract getName(): string;
}

/**
 * Retry fallback strategy - retries the original operation
 */
export class RetryFallbackStrategy<
  TRequest,
  TResponse,
> extends BaseFallbackStrategy<TRequest, TResponse> {
  private maxRetries: number = 2;
  private retryDelay: number = 1000; // 1 second

  constructor(maxRetries: number = 2, retryDelay: number = 1000) {
    super();
    this.priority = 10; // High priority - try retry first
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  canHandle(error: SkillError, context: FallbackContext): boolean {
    // Can retry on network errors, timeouts, or rate limits
    return (
      (error.code === SkillErrorCode.NETWORK_ERROR ||
        error.code === SkillErrorCode.SKILL_TIMEOUT ||
        error.code === SkillErrorCode.RATE_LIMIT_EXCEEDED) &&
      context.attemptNumber < this.maxRetries
    );
  }

  async execute(
    request: TRequest,
    context: FallbackContext,
  ): Promise<FallbackResult<TResponse>> {
    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, this.retryDelay));

    return {
      success: false,
      usedFallback: true,
      fallbackReason: context.reason,
      error: 'Retry strategy - should be handled by caller',
      metadata: {
        strategy: 'retry',
        attemptNumber: context.attemptNumber + 1,
      },
    };
  }

  getName(): string {
    return 'RetryFallbackStrategy';
  }
}

/**
 * Original service fallback - uses the original service without skills
 */
export class OriginalServiceFallbackStrategy<
  TRequest,
  TResponse,
> extends BaseFallbackStrategy<TRequest, TResponse> {
  private originalService: {
    execute(request: TRequest): Promise<TResponse>;
  };

  constructor(originalService: {
    execute(request: TRequest): Promise<TResponse>;
  }) {
    super();
    this.priority = 5; // Medium priority
    this.originalService = originalService;
  }

  canHandle(_error: SkillError, _context: FallbackContext): boolean {
    // Can always fall back to original service
    return true;
  }

  async execute(
    request: TRequest,
    context: FallbackContext,
  ): Promise<FallbackResult<TResponse>> {
    try {
      const result = await this.originalService.execute(request);
      return {
        success: true,
        data: result,
        usedFallback: true,
        fallbackReason: context.reason,
        metadata: {
          strategy: 'original_service',
          reason: context.reason,
        },
      };
    } catch (error) {
      return {
        success: false,
        usedFallback: true,
        fallbackReason: context.reason,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          strategy: 'original_service',
          reason: context.reason,
        },
      };
    }
  }

  getName(): string {
    return 'OriginalServiceFallbackStrategy';
  }
}

/**
 * Cached response fallback - uses cached data if available
 */
export class CachedResponseFallbackStrategy<
  TRequest,
  TResponse,
> extends BaseFallbackStrategy<TRequest, TResponse> {
  private cache: Map<string, { data: TResponse; timestamp: number }> =
    new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  constructor(cacheTTL: number = 5 * 60 * 1000) {
    super();
    this.priority = 8; // High priority - cache is fast
    this.cacheTTL = cacheTTL;
  }

  canHandle(error: SkillError, context: FallbackContext): boolean {
    // Can use cache for any error if cache key is available
    return context.metadata?.cacheKey !== undefined;
  }

  async execute(
    request: TRequest,
    context: FallbackContext,
  ): Promise<FallbackResult<TResponse>> {
    const cacheKey = context.metadata?.cacheKey as string | undefined;
    if (!cacheKey) {
      return {
        success: false,
        usedFallback: false,
        error: 'No cache key available',
      };
    }

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return {
        success: true,
        data: cached.data,
        usedFallback: true,
        fallbackReason: context.reason,
        metadata: {
          strategy: 'cached_response',
          cacheKey,
          age: Date.now() - cached.timestamp,
        },
      };
    }

    return {
      success: false,
      usedFallback: false,
      error: 'Cache miss or expired',
    };
  }

  getName(): string {
    return 'CachedResponseFallbackStrategy';
  }

  /**
   * Store response in cache
   */
  setCache(key: string, data: TResponse): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Clear expired cache entries
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Default/static response fallback - returns a default response
 */
export class DefaultResponseFallbackStrategy<
  TRequest,
  TResponse,
> extends BaseFallbackStrategy<TRequest, TResponse> {
  private defaultResponse: TResponse | (() => TResponse);

  constructor(defaultResponse: TResponse | (() => TResponse)) {
    super();
    this.priority = 1; // Low priority - last resort
    this.defaultResponse = defaultResponse;
  }

  canHandle(_error: SkillError, _context: FallbackContext): boolean {
    // Can always provide default response
    return true;
  }

  async execute(
    request: TRequest,
    context: FallbackContext,
  ): Promise<FallbackResult<TResponse>> {
    const response =
      typeof this.defaultResponse === 'function'
        ? (this.defaultResponse as () => TResponse)()
        : this.defaultResponse;

    return {
      success: true,
      data: response,
      usedFallback: true,
      fallbackReason: context.reason,
      metadata: {
        strategy: 'default_response',
        reason: context.reason,
      },
    };
  }

  getName(): string {
    return 'DefaultResponseFallbackStrategy';
  }
}

/**
 * Fallback strategy manager - coordinates multiple fallback strategies
 */
export class FallbackStrategyManager<TRequest, TResponse> {
  private strategies: FallbackStrategy<TRequest, TResponse>[] = [];

  /**
   * Register a fallback strategy
   */
  registerStrategy(strategy: FallbackStrategy<TRequest, TResponse>): void {
    this.strategies.push(strategy);
    // Sort by priority (highest first)
    this.strategies.sort((a, b) => b.getPriority() - a.getPriority());
  }

  /**
   * Execute fallback strategies in priority order
   */
  async executeFallback(
    request: TRequest,
    context: FallbackContext,
  ): Promise<FallbackResult<TResponse>> {
    for (const strategy of this.strategies) {
      if (context.error && strategy.canHandle(context.error, context)) {
        try {
          const result = await strategy.execute(request, context);
          if (result.success) {
            console.log(
              `✅ Fallback strategy '${strategy.getName()}' succeeded`,
            );
            return result;
          }
        } catch (error) {
          console.warn(
            `⚠️ Fallback strategy '${strategy.getName()}' failed:`,
            error,
          );
          // Continue to next strategy
        }
      }
    }

    // All strategies failed
    return {
      success: false,
      usedFallback: true,
      fallbackReason: context.reason,
      error: 'All fallback strategies failed',
      metadata: {
        strategiesAttempted: this.strategies.map(s => s.getName()),
      },
    };
  }

  /**
   * Get all registered strategies
   */
  getStrategies(): FallbackStrategy<TRequest, TResponse>[] {
    return [...this.strategies];
  }

  /**
   * Clear all strategies
   */
  clear(): void {
    this.strategies = [];
  }
}
