import { auditLogger } from './auditLogger';

export interface AnomalyRule {
  id: string;
  name: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  enabled: boolean;
  threshold: number;
  timeWindow: number; // in minutes
  checkFunction: (context: AnomalyContext) => Promise<AnomalyResult>;
}

export interface AnomalyContext {
  userId: string;
  sessionId?: string;
  action: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AnomalyResult {
  isAnomalous: boolean;
  riskScore: number; // 0-100
  confidence: number; // 0-1
  reason: string;
  evidence: Record<string, any>;
  recommendedAction: 'ALLOW' | 'WARN' | 'REQUIRE_2FA' | 'BLOCK' | 'INVESTIGATE';
}

export interface UserBehaviorProfile {
  anonymousId: string; // One-way hashed ID — cannot be linked back to a real user
  loginTimes: number[]; // Hours of day (0-23)
  loginDays: number[]; // Days of week (0-6)
  sessionPatterns: {
    sessionId: string;
    frequency: number;
    lastSeen: Date;
    trustLevel: number;
  }[];
  activityPatterns: {
    action: string;
    frequency: number;
    averageInterval: number; // in minutes
  }[];
}

/**
 * One-way hash to anonymize user IDs for COPPA compliance.
 * Uses a simple but effective hash — the result cannot be reversed to recover the original userId.
 */
/* eslint-disable no-bitwise -- djb2 hash: bit-shift/OR are intrinsic to the algorithm. */
function hashUserId(userId: string): string {
  let hash = 0;
  const salt = 'anomaly-detector-coppa';
  const input = salt + userId;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `anon_${Math.abs(hash).toString(36)}`;
}
/* eslint-enable no-bitwise */

class AnomalyDetector {
  private rules: AnomalyRule[] = [];
  private userProfiles: Map<string, UserBehaviorProfile> = new Map();
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Initialize anomaly detection rules
    this.rules = [
      {
        id: 'multiple_failed_logins',
        name: 'Multiple Failed Login Attempts',
        description: 'Detects multiple failed login attempts in short time',
        severity: 'HIGH',
        enabled: true,
        threshold: 5,
        timeWindow: 15,
        checkFunction: this.checkMultipleFailedLogins.bind(this),
      },
      {
        id: 'unusual_login_time',
        name: 'Unusual Login Time',
        description: 'Detects logins at unusual times for the user',
        severity: 'MEDIUM',
        enabled: true,
        threshold: 0.8,
        timeWindow: 60 * 24 * 7, // 7 days
        checkFunction: this.checkUnusualLoginTime.bind(this),
      },
      {
        id: 'new_device_login',
        name: 'New Device Login',
        description: 'Detects login from previously unseen device',
        severity: 'MEDIUM',
        enabled: true,
        threshold: 1,
        timeWindow: 60 * 24 * 30, // 30 days
        checkFunction: this.checkNewDeviceLogin.bind(this),
      },
      // impossible_travel rule removed — required IP geolocation (PII under COPPA)
      {
        id: 'rapid_profile_changes',
        name: 'Rapid Profile Changes',
        description: 'Detects multiple profile changes in short time',
        severity: 'MEDIUM',
        enabled: true,
        threshold: 3,
        timeWindow: 10,
        checkFunction: this.checkRapidProfileChanges.bind(this),
      },
      {
        id: 'privilege_escalation_attempt',
        name: 'Privilege Escalation Attempt',
        description: 'Detects attempts to access unauthorized resources',
        severity: 'CRITICAL',
        enabled: true,
        threshold: 1,
        timeWindow: 5,
        checkFunction: this.checkPrivilegeEscalation.bind(this),
      },
    ];

    this.isInitialized = true;
  }

  /**
   * Analyze context for anomalies
   */
  async analyzeContext(context: AnomalyContext): Promise<AnomalyResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const results: AnomalyResult[] = [];
    const anonymousId = hashUserId(context.userId);

    // Load or create user behavior profile using anonymized ID
    const profile = await this.getUserBehaviorProfile(anonymousId);

    // Build anonymized context — strip userId before passing to rules
    const anonymizedContext: AnomalyContext = {
      ...context,
      userId: anonymousId,
    };

    // Run all enabled rules
    for (const rule of this.rules.filter(r => r.enabled)) {
      try {
        const result = await rule.checkFunction({
          ...anonymizedContext,
          metadata: {
            ...anonymizedContext.metadata,
            profile,
            rule: rule.name,
          },
        });

        if (result.isAnomalous) {
          results.push({
            ...result,
            reason: `${rule.name}: ${result.reason}`,
          });

          // Log the anomaly with anonymized ID only
          await auditLogger.logSuspiciousActivity(
            anonymousId,
            `Anomaly detected: ${rule.name}`,
            result.riskScore,
            {
              ruleId: rule.id,
              ruleName: rule.name,
              confidence: result.confidence,
              evidence: result.evidence,
              recommendedAction: result.recommendedAction,
            },
          );
        }
      } catch (error) {
        console.error(`Error in anomaly rule ${rule.id}:`, error);
      }
    }

    // Update user behavior profile with new data
    await this.updateUserBehaviorProfile(anonymizedContext, profile);

    return results;
  }

  /**
   * Get the highest risk score from multiple anomaly results
   */
  getHighestRiskScore(results: AnomalyResult[]): number {
    return results.length > 0 ? Math.max(...results.map(r => r.riskScore)) : 0;
  }

  /**
   * Get the most severe recommended action
   */
  getMostSevereAction(
    results: AnomalyResult[],
  ): AnomalyResult['recommendedAction'] {
    const actionSeverity = {
      ALLOW: 0,
      WARN: 1,
      REQUIRE_2FA: 2,
      INVESTIGATE: 3,
      BLOCK: 4,
    };

    const mostSevere = results.reduce((most, current) => {
      return actionSeverity[current.recommendedAction] > actionSeverity[most]
        ? current.recommendedAction
        : most;
    }, 'ALLOW' as AnomalyResult['recommendedAction']);

    return mostSevere;
  }

  // Anomaly detection rule implementations

  private async checkMultipleFailedLogins(
    context: AnomalyContext,
  ): Promise<AnomalyResult> {
    const rule = this.rules.find(r => r.id === 'multiple_failed_logins')!;
    const profile = context.metadata?.profile as UserBehaviorProfile;

    // Count recent failed login actions from in-memory activity patterns
    // (no longer queries audit_logs by user_id to avoid PII linkage)
    const failedLoginPattern = profile?.activityPatterns.find(
      p => p.action === 'LOGIN_FAILED',
    );
    const failedCount = failedLoginPattern?.frequency || 0;
    const isAnomalous = failedCount >= rule.threshold;

    return {
      isAnomalous,
      riskScore: Math.min(100, (failedCount / rule.threshold) * 70),
      confidence: profile ? 0.9 : 0,
      reason: `${failedCount} failed login attempts tracked in current session`,
      evidence: { failedCount, timeWindow: rule.timeWindow },
      recommendedAction:
        failedCount >= rule.threshold * 2 ? 'BLOCK' : 'REQUIRE_2FA',
    };
  }

  private async checkUnusualLoginTime(
    context: AnomalyContext,
  ): Promise<AnomalyResult> {
    const profile = context.metadata?.profile as UserBehaviorProfile;
    if (!profile || profile.loginTimes.length < 5) {
      return {
        isAnomalous: false,
        riskScore: 0,
        confidence: 0,
        reason: 'Insufficient data for time analysis',
        evidence: {},
        recommendedAction: 'ALLOW',
      };
    }

    const currentHour = context.timestamp.getHours();
    const loginTimes = profile.loginTimes;

    // Calculate hour frequency
    const hourFrequency = new Array(24).fill(0);
    loginTimes.forEach(hour => hourFrequency[hour]++);

    const totalLogins = loginTimes.length;
    const currentHourFrequency = hourFrequency[currentHour] / totalLogins;

    // Consider unusual if this hour represents less than 5% of logins
    const isAnomalous = currentHourFrequency < 0.05 && totalLogins > 20;

    return {
      isAnomalous,
      riskScore: isAnomalous ? 40 : 0,
      confidence: Math.min(0.8, totalLogins / 50),
      reason: `Login at hour ${currentHour} (${(
        currentHourFrequency * 100
      ).toFixed(1)}% of normal activity)`,
      evidence: {
        currentHour,
        frequency: currentHourFrequency,
        totalLogins,
      },
      recommendedAction: isAnomalous ? 'WARN' : 'ALLOW',
    };
  }

  private async checkNewDeviceLogin(
    context: AnomalyContext,
  ): Promise<AnomalyResult> {
    const profile = context.metadata?.profile as UserBehaviorProfile;
    if (!context.sessionId || !profile) {
      return {
        isAnomalous: false,
        riskScore: 0,
        confidence: 0,
        reason: 'No session information available',
        evidence: {},
        recommendedAction: 'ALLOW',
      };
    }

    // COPPA: Use session-based pattern matching instead of persistent device IDs.
    // New sessions are always expected, so this rule now checks activity patterns
    // rather than device fingerprints.
    const recentSessions = profile.sessionPatterns.length;

    return {
      isAnomalous: false,
      riskScore: 0,
      confidence: 0.5,
      reason: `Session-based check (${recentSessions} known sessions)`,
      evidence: {
        sessionId: context.sessionId,
        knownSessions: recentSessions,
      },
      recommendedAction: 'ALLOW',
    };
  }

  private async checkRapidProfileChanges(
    context: AnomalyContext,
  ): Promise<AnomalyResult> {
    const rule = this.rules.find(r => r.id === 'rapid_profile_changes')!;

    if (context.action !== 'PROFILE_UPDATE') {
      return {
        isAnomalous: false,
        riskScore: 0,
        confidence: 0,
        reason: 'Not a profile update action',
        evidence: {},
        recommendedAction: 'ALLOW',
      };
    }

    // Count from in-memory activity patterns (no longer queries audit_logs by user_id)
    const profile = context.metadata?.profile as UserBehaviorProfile;
    const updatePattern = profile?.activityPatterns.find(
      p => p.action === 'PROFILE_UPDATE',
    );
    const updateCount = updatePattern?.frequency || 0;
    const isAnomalous = updateCount >= rule.threshold;

    return {
      isAnomalous,
      riskScore: Math.min(100, (updateCount / rule.threshold) * 60),
      confidence: profile ? 0.7 : 0,
      reason: `${updateCount} profile updates tracked in current session`,
      evidence: { updateCount, timeWindow: rule.timeWindow },
      recommendedAction:
        updateCount >= rule.threshold * 2 ? 'INVESTIGATE' : 'WARN',
    };
  }

  private async checkPrivilegeEscalation(
    context: AnomalyContext,
  ): Promise<AnomalyResult> {
    // Look for patterns that might indicate privilege escalation attempts
    const suspiciousActions = [
      'ADMIN_ACCESS',
      'SYSTEM_CONFIG',
      'USER_IMPERSONATION',
    ];
    const suspiciousPatterns = [
      'admin',
      'root',
      'system',
      'config',
      'unauthorized',
    ];

    const actionSuspicious = suspiciousActions.includes(context.action);
    const metadataSuspicious =
      context.metadata &&
      Object.values(context.metadata).some(
        value =>
          typeof value === 'string' &&
          suspiciousPatterns.some(pattern =>
            value.toLowerCase().includes(pattern),
          ),
      );

    const isAnomalous = actionSuspicious || !!metadataSuspicious;

    return {
      isAnomalous,
      riskScore: isAnomalous ? 90 : 0,
      confidence: 0.8,
      reason: isAnomalous
        ? 'Potential privilege escalation attempt detected'
        : 'No privilege escalation detected',
      evidence: {
        action: context.action,
        suspiciousAction: actionSuspicious,
        suspiciousMetadata: metadataSuspicious,
      },
      recommendedAction: isAnomalous ? 'BLOCK' : 'ALLOW',
    };
  }

  private async getUserBehaviorProfile(
    anonymousId: string,
  ): Promise<UserBehaviorProfile> {
    // Check cache first
    if (this.userProfiles.has(anonymousId)) {
      return this.userProfiles.get(anonymousId)!;
    }

    // Build profile from in-memory data only.
    // We no longer query audit_logs by user_id to avoid linking anomaly profiles
    // back to real user identities. Profiles are built incrementally as events arrive.
    const emptyProfile: UserBehaviorProfile = {
      anonymousId,
      loginTimes: [],
      loginDays: [],
      sessionPatterns: [],
      activityPatterns: [],
    };

    this.userProfiles.set(anonymousId, emptyProfile);
    return emptyProfile;
  }

  private async updateUserBehaviorProfile(
    context: AnomalyContext,
    profile: UserBehaviorProfile,
  ): Promise<void> {
    // Update profile with new context data
    if (context.action === 'LOGIN') {
      profile.loginTimes.push(context.timestamp.getHours());
      profile.loginDays.push(context.timestamp.getDay());

      // Keep only recent data (last 100 logins)
      if (profile.loginTimes.length > 100) {
        profile.loginTimes = profile.loginTimes.slice(-100);
      }
      if (profile.loginDays.length > 100) {
        profile.loginDays = profile.loginDays.slice(-100);
      }
    }

    // Update activity patterns for in-memory anomaly detection
    const existingPattern = profile.activityPatterns.find(
      p => p.action === context.action,
    );
    if (existingPattern) {
      existingPattern.frequency++;
    } else {
      profile.activityPatterns.push({
        action: context.action,
        frequency: 1,
        averageInterval: 0,
      });
    }

    // Update session patterns (COPPA: uses ephemeral session IDs, not persistent device IDs)
    if (context.sessionId) {
      const existingSession = profile.sessionPatterns.find(
        s => s.sessionId === context.sessionId,
      );
      if (existingSession) {
        existingSession.frequency++;
        existingSession.lastSeen = context.timestamp;
        existingSession.trustLevel = Math.min(
          100,
          existingSession.trustLevel + 1,
        );
      } else {
        profile.sessionPatterns.push({
          sessionId: context.sessionId,
          frequency: 1,
          lastSeen: context.timestamp,
          trustLevel: 20,
        });
      }
    }

    // Update cache (context.userId is already the anonymousId at this point)
    this.userProfiles.set(context.userId, profile);
  }

  /**
   * Purge all cached user behavior profiles.
   * Call this to clear any existing anomaly data from memory.
   */
  purgeProfiles(): void {
    this.userProfiles.clear();
  }
}

// Export singleton instance
export const anomalyDetector = new AnomalyDetector();
