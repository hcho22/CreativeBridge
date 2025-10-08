import { supabase } from './supabase';
import { auditLogger } from './auditLogger';
import { DeviceFingerprint } from './auditLogger';

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
  deviceId?: string;
  ipAddress?: string;
  sessionId?: string;
  action: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  userAgent?: string;
  deviceInfo?: DeviceFingerprint;
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
  userId: string;
  loginTimes: number[]; // Hours of day (0-23)
  loginDays: number[]; // Days of week (0-6)
  devicePatterns: {
    deviceId: string;
    frequency: number;
    lastSeen: Date;
    trustLevel: number;
  }[];
  locationPatterns: {
    country?: string;
    city?: string;
    frequency: number;
    lastSeen: Date;
  }[];
  activityPatterns: {
    action: string;
    frequency: number;
    averageInterval: number; // in minutes
  }[];
}

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
      {
        id: 'impossible_travel',
        name: 'Impossible Travel',
        description: 'Detects logins from geographically impossible locations',
        severity: 'HIGH',
        enabled: true,
        threshold: 500, // km/h
        timeWindow: 60,
        checkFunction: this.checkImpossibleTravel.bind(this),
      },
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

    // Load or create user behavior profile
    const profile = await this.getUserBehaviorProfile(context.userId);

    // Run all enabled rules
    for (const rule of this.rules.filter(r => r.enabled)) {
      try {
        const result = await rule.checkFunction({
          ...context,
          metadata: {
            ...context.metadata,
            profile,
            rule: rule.name,
          },
        });

        if (result.isAnomalous) {
          results.push({
            ...result,
            reason: `${rule.name}: ${result.reason}`,
          });

          // Log the anomaly
          await auditLogger.logSuspiciousActivity(
            context.userId,
            `Anomaly detected: ${rule.name}`,
            result.riskScore,
            {
              ruleId: rule.id,
              ruleName: rule.name,
              confidence: result.confidence,
              evidence: result.evidence,
              recommendedAction: result.recommendedAction,
              context: context,
            },
          );
        }
      } catch (error) {
        console.error(`Error in anomaly rule ${rule.id}:`, error);
      }
    }

    // Update user behavior profile with new data
    await this.updateUserBehaviorProfile(context, profile);

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

    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id')
        .eq('event_type', 'LOGIN_FAILED')
        .eq('user_id', context.userId)
        .gte(
          'created_at',
          new Date(Date.now() - rule.timeWindow * 60 * 1000).toISOString(),
        );

      if (error) throw error;

      const failedCount = data?.length || 0;
      const isAnomalous = failedCount >= rule.threshold;

      return {
        isAnomalous,
        riskScore: Math.min(100, (failedCount / rule.threshold) * 70),
        confidence: 0.9,
        reason: `${failedCount} failed login attempts in ${rule.timeWindow} minutes`,
        evidence: { failedCount, timeWindow: rule.timeWindow },
        recommendedAction:
          failedCount >= rule.threshold * 2 ? 'BLOCK' : 'REQUIRE_2FA',
      };
    } catch (error) {
      return {
        isAnomalous: false,
        riskScore: 0,
        confidence: 0,
        reason: 'Failed to check login attempts',
        evidence: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        recommendedAction: 'ALLOW',
      };
    }
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
        historicalHours: loginTimes,
      },
      recommendedAction: isAnomalous ? 'WARN' : 'ALLOW',
    };
  }

  private async checkNewDeviceLogin(
    context: AnomalyContext,
  ): Promise<AnomalyResult> {
    const profile = context.metadata?.profile as UserBehaviorProfile;
    if (!context.deviceId || !profile) {
      return {
        isAnomalous: false,
        riskScore: 0,
        confidence: 0,
        reason: 'No device information available',
        evidence: {},
        recommendedAction: 'ALLOW',
      };
    }

    const knownDevice = profile.devicePatterns.find(
      d => d.deviceId === context.deviceId,
    );
    const isNewDevice = !knownDevice;

    if (!isNewDevice) {
      // Check if device hasn't been seen in a long time
      const daysSinceLastSeen =
        (Date.now() - knownDevice.lastSeen.getTime()) / (1000 * 60 * 60 * 24);
      const isStaleDevice = daysSinceLastSeen > 90; // 3 months

      return {
        isAnomalous: isStaleDevice,
        riskScore: isStaleDevice ? 30 : 0,
        confidence: 0.6,
        reason: isStaleDevice
          ? `Device not seen for ${Math.round(daysSinceLastSeen)} days`
          : 'Known device',
        evidence: {
          deviceId: context.deviceId,
          daysSinceLastSeen,
          trustLevel: knownDevice.trustLevel,
        },
        recommendedAction: isStaleDevice ? 'REQUIRE_2FA' : 'ALLOW',
      };
    }

    return {
      isAnomalous: true,
      riskScore: 50,
      confidence: 0.8,
      reason: 'Login from new device',
      evidence: {
        deviceId: context.deviceId,
        deviceInfo: context.deviceInfo,
        knownDevices: profile.devicePatterns.length,
      },
      recommendedAction: 'REQUIRE_2FA',
    };
  }

  private async checkImpossibleTravel(
    context: AnomalyContext,
  ): Promise<AnomalyResult> {
    // This would require IP geolocation service
    // For now, return a placeholder implementation
    return {
      isAnomalous: false,
      riskScore: 0,
      confidence: 0,
      reason: 'Geolocation service not implemented',
      evidence: {},
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

    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, created_at')
        .eq('event_type', 'PROFILE_UPDATE')
        .eq('user_id', context.userId)
        .gte(
          'created_at',
          new Date(Date.now() - rule.timeWindow * 60 * 1000).toISOString(),
        )
        .order('created_at', { ascending: false });

      if (error) throw error;

      const updateCount = data?.length || 0;
      const isAnomalous = updateCount >= rule.threshold;

      return {
        isAnomalous,
        riskScore: Math.min(100, (updateCount / rule.threshold) * 60),
        confidence: 0.7,
        reason: `${updateCount} profile updates in ${rule.timeWindow} minutes`,
        evidence: { updateCount, timeWindow: rule.timeWindow },
        recommendedAction:
          updateCount >= rule.threshold * 2 ? 'INVESTIGATE' : 'WARN',
      };
    } catch (error) {
      return {
        isAnomalous: false,
        riskScore: 0,
        confidence: 0,
        reason: 'Failed to check profile changes',
        evidence: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        recommendedAction: 'ALLOW',
      };
    }
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

    const isAnomalous = actionSuspicious || metadataSuspicious;

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
        metadata: context.metadata,
      },
      recommendedAction: isAnomalous ? 'BLOCK' : 'ALLOW',
    };
  }

  private async getUserBehaviorProfile(
    userId: string,
  ): Promise<UserBehaviorProfile> {
    // Check cache first
    if (this.userProfiles.has(userId)) {
      return this.userProfiles.get(userId)!;
    }

    // Load from database
    try {
      const { data: auditData, error } = await supabase
        .from('audit_logs')
        .select('event_type, created_at, metadata, device_info')
        .eq('user_id', userId)
        .gte(
          'created_at',
          new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        ) // Last 90 days
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      const profile: UserBehaviorProfile = {
        userId,
        loginTimes: [],
        loginDays: [],
        devicePatterns: [],
        locationPatterns: [],
        activityPatterns: [],
      };

      // Analyze audit data to build profile
      auditData?.forEach(log => {
        const timestamp = new Date(log.created_at);

        if (log.event_type === 'LOGIN') {
          profile.loginTimes.push(timestamp.getHours());
          profile.loginDays.push(timestamp.getDay());
        }

        // Analyze device patterns
        if (log.device_info) {
          try {
            const deviceInfo =
              typeof log.device_info === 'string'
                ? JSON.parse(log.device_info)
                : log.device_info;

            if (deviceInfo.deviceId) {
              const existingDevice = profile.devicePatterns.find(
                d => d.deviceId === deviceInfo.deviceId,
              );
              if (existingDevice) {
                existingDevice.frequency++;
                existingDevice.lastSeen = timestamp;
              } else {
                profile.devicePatterns.push({
                  deviceId: deviceInfo.deviceId,
                  frequency: 1,
                  lastSeen: timestamp,
                  trustLevel: 50, // Default trust level
                });
              }
            }
          } catch (e) {
            // Ignore malformed device info
          }
        }
      });

      // Cache the profile
      this.userProfiles.set(userId, profile);
      return profile;
    } catch (error) {
      console.error('Failed to load user behavior profile:', error);

      // Return empty profile
      const emptyProfile: UserBehaviorProfile = {
        userId,
        loginTimes: [],
        loginDays: [],
        devicePatterns: [],
        locationPatterns: [],
        activityPatterns: [],
      };

      this.userProfiles.set(userId, emptyProfile);
      return emptyProfile;
    }
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

    // Update device patterns
    if (context.deviceId) {
      const existingDevice = profile.devicePatterns.find(
        d => d.deviceId === context.deviceId,
      );
      if (existingDevice) {
        existingDevice.frequency++;
        existingDevice.lastSeen = context.timestamp;
        // Gradually increase trust level for frequently used devices
        existingDevice.trustLevel = Math.min(
          100,
          existingDevice.trustLevel + 1,
        );
      } else {
        profile.devicePatterns.push({
          deviceId: context.deviceId,
          frequency: 1,
          lastSeen: context.timestamp,
          trustLevel: 20, // Lower initial trust for new devices
        });
      }
    }

    // Update cache
    this.userProfiles.set(context.userId, profile);
  }
}

// Export singleton instance
export const anomalyDetector = new AnomalyDetector();
