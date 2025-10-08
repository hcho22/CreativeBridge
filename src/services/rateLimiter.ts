import { supabase } from './supabase';
import { auditLogger } from './auditLogger';

export enum ActionType {
  LOGIN_ATTEMPT = 'LOGIN_ATTEMPT',
  PASSWORD_RESET = 'PASSWORD_RESET',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PROFILE_UPDATE = 'PROFILE_UPDATE',
  DEVICE_REGISTRATION = 'DEVICE_REGISTRATION',
}

export interface RateLimitConfig {
  windowMinutes: number;
  maxAttempts: number;
  blockDurationMinutes: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  windowResetTime: Date;
  isBlocked: boolean;
  blockedUntil?: Date;
}

class RateLimiter {
  private static readonly DEFAULT_CONFIGS: Record<ActionType, RateLimitConfig> =
    {
      [ActionType.LOGIN_ATTEMPT]: {
        windowMinutes: 15,
        maxAttempts: 5,
        blockDurationMinutes: 60,
      },
      [ActionType.PASSWORD_RESET]: {
        windowMinutes: 60,
        maxAttempts: 3,
        blockDurationMinutes: 120,
      },
      [ActionType.EMAIL_VERIFICATION]: {
        windowMinutes: 60,
        maxAttempts: 5,
        blockDurationMinutes: 60,
      },
      [ActionType.PROFILE_UPDATE]: {
        windowMinutes: 60,
        maxAttempts: 10,
        blockDurationMinutes: 30,
      },
      [ActionType.DEVICE_REGISTRATION]: {
        windowMinutes: 60,
        maxAttempts: 3,
        blockDurationMinutes: 120,
      },
    };

  /**
   * Check if an action is allowed based on rate limiting rules
   */
  async checkRateLimit(
    identifier: string,
    actionType: ActionType,
    config?: Partial<RateLimitConfig>,
  ): Promise<RateLimitResult> {
    const fullConfig = {
      ...RateLimiter.DEFAULT_CONFIGS[actionType],
      ...config,
    };

    try {
      const { data, error } = await supabase.rpc('check_rate_limit', {
        p_identifier: identifier,
        p_action_type: actionType,
        p_window_minutes: fullConfig.windowMinutes,
        p_max_attempts: fullConfig.maxAttempts,
      });

      if (error) {
        console.error('Rate limit check failed:', error);
        // Fail open - allow the action if we can't check
        return this.createAllowedResult(fullConfig);
      }

      const isAllowed = data as boolean;

      if (!isAllowed) {
        // Log rate limit exceeded
        await auditLogger.logRateLimitExceeded(identifier, actionType, {
          config: fullConfig,
        });

        return this.createBlockedResult(fullConfig);
      }

      return this.createAllowedResult(fullConfig);
    } catch (error) {
      console.error('Rate limit check error:', error);
      // Fail open - allow the action if we can't check
      return this.createAllowedResult(fullConfig);
    }
  }

  /**
   * Record an attempt for rate limiting purposes
   */
  async recordAttempt(
    identifier: string,
    actionType: ActionType,
    success: boolean = false,
  ): Promise<void> {
    try {
      // The check_rate_limit function already records the attempt
      // This method can be used for additional logging or custom logic

      if (!success) {
        // For failed attempts, we might want additional logging
        await auditLogger.logEvent({
          eventType: 'RATE_LIMIT_ATTEMPT' as any,
          eventCategory: 'SECURITY',
          severity: 'LOW',
          description: `Rate limit attempt recorded for ${actionType}`,
          metadata: {
            identifier,
            actionType,
            success,
          },
        });
      }
    } catch (error) {
      console.error('Failed to record rate limit attempt:', error);
    }
  }

  /**
   * Get current rate limit status without incrementing counter
   */
  async getRateLimitStatus(
    identifier: string,
    actionType: ActionType,
  ): Promise<RateLimitResult> {
    const config = RateLimiter.DEFAULT_CONFIGS[actionType];

    try {
      const currentWindow = this.getCurrentWindow(config.windowMinutes);

      const { data, error } = await supabase
        .from('rate_limits')
        .select('attempt_count, is_blocked, blocked_until')
        .eq('identifier', identifier)
        .eq('action_type', actionType)
        .eq('window_start', currentWindow.toISOString())
        .single();

      if (error || !data) {
        // No existing record means no attempts yet
        return this.createAllowedResult(config, config.maxAttempts);
      }

      const { attempt_count, is_blocked, blocked_until } = data;

      if (is_blocked && blocked_until && new Date(blocked_until) > new Date()) {
        return {
          allowed: false,
          remainingAttempts: 0,
          windowResetTime: this.getWindowResetTime(
            currentWindow,
            config.windowMinutes,
          ),
          isBlocked: true,
          blockedUntil: new Date(blocked_until),
        };
      }

      const remainingAttempts = Math.max(0, config.maxAttempts - attempt_count);

      return {
        allowed: remainingAttempts > 0,
        remainingAttempts,
        windowResetTime: this.getWindowResetTime(
          currentWindow,
          config.windowMinutes,
        ),
        isBlocked: false,
      };
    } catch (error) {
      console.error('Failed to get rate limit status:', error);
      return this.createAllowedResult(config);
    }
  }

  /**
   * Clear rate limit for an identifier (admin function)
   */
  async clearRateLimit(
    identifier: string,
    actionType: ActionType,
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('rate_limits')
        .delete()
        .eq('identifier', identifier)
        .eq('action_type', actionType);

      if (error) {
        console.error('Failed to clear rate limit:', error);
        return false;
      }

      await auditLogger.logEvent({
        eventType: 'RATE_LIMIT_CLEARED' as any,
        eventCategory: 'SECURITY',
        severity: 'MEDIUM',
        description: `Rate limit cleared for ${actionType}`,
        metadata: {
          identifier,
          actionType,
        },
      });

      return true;
    } catch (error) {
      console.error('Failed to clear rate limit:', error);
      return false;
    }
  }

  private getCurrentWindow(windowMinutes: number): Date {
    const now = new Date();
    const minutesSinceEpoch = Math.floor(now.getTime() / (1000 * 60));
    const windowStart =
      Math.floor(minutesSinceEpoch / windowMinutes) * windowMinutes;
    return new Date(windowStart * 60 * 1000);
  }

  private getWindowResetTime(windowStart: Date, windowMinutes: number): Date {
    return new Date(windowStart.getTime() + windowMinutes * 60 * 1000);
  }

  private createAllowedResult(
    config: RateLimitConfig,
    remainingAttempts?: number,
  ): RateLimitResult {
    const currentWindow = this.getCurrentWindow(config.windowMinutes);

    return {
      allowed: true,
      remainingAttempts: remainingAttempts ?? config.maxAttempts,
      windowResetTime: this.getWindowResetTime(
        currentWindow,
        config.windowMinutes,
      ),
      isBlocked: false,
    };
  }

  private createBlockedResult(config: RateLimitConfig): RateLimitResult {
    const currentWindow = this.getCurrentWindow(config.windowMinutes);
    const blockedUntil = new Date(
      Date.now() + config.blockDurationMinutes * 60 * 1000,
    );

    return {
      allowed: false,
      remainingAttempts: 0,
      windowResetTime: this.getWindowResetTime(
        currentWindow,
        config.windowMinutes,
      ),
      isBlocked: true,
      blockedUntil,
    };
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();
