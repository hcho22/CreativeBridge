import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as supabaseBase } from './supabase';
import { auditLogger, EventType, EventCategory, Severity } from './auditLogger';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The project's Supabase `Database` generic resolves to `never` for the typed
 * `from()` chain (insert/update/select), so we cast to an untyped
 * `SupabaseClient` here. Mirrors the pattern in feedbackCollectionService.ts,
 * twoFactorAuth.ts, and costTrackingService.ts. Type-only — no runtime change.
 */
const supabase = supabaseBase as unknown as SupabaseClient;

export interface SessionConfig {
  maxSessionDuration: number; // in minutes
  idleTimeout: number; // in minutes
  warningBeforeExpiry: number; // in minutes
  maxConcurrentSessions: number;
}

export interface SessionInfo {
  sessionId: string;
  userId: string;
  deviceId: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivity: Date;
  isActive: boolean;
  requiresTwoFA: boolean;
  twoFAVerified: boolean;
}

export interface SessionWarning {
  type: 'IDLE_WARNING' | 'EXPIRY_WARNING';
  message: string;
  timeRemaining: number; // in minutes
  onExtend?: () => Promise<boolean>;
  onLogout?: () => Promise<void>;
}

class SessionManager {
  private static readonly STORAGE_KEY = '@CreativeBridge:sessionInfo';
  private static readonly DEFAULT_CONFIG: SessionConfig = {
    maxSessionDuration: 24 * 60, // 24 hours
    idleTimeout: 30, // 30 minutes
    warningBeforeExpiry: 5, // 5 minutes
    maxConcurrentSessions: 3,
  };

  private sessionInfo: SessionInfo | null = null;
  private config: SessionConfig;
  private activityTimer: NodeJS.Timeout | null = null;
  private warningTimer: NodeJS.Timeout | null = null;
  private sessionCheckInterval: NodeJS.Timeout | null = null;
  private onSessionWarning?: (warning: SessionWarning) => void;
  private onSessionExpired?: () => void;

  constructor(config: Partial<SessionConfig> = {}) {
    this.config = { ...SessionManager.DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize session management
   */
  async initialize(
    onSessionWarning?: (warning: SessionWarning) => void,
    onSessionExpired?: () => void,
  ): Promise<void> {
    this.onSessionWarning = onSessionWarning;
    this.onSessionExpired = onSessionExpired;

    // Try to restore session from storage
    await this.restoreSession();

    // Start periodic session validation
    this.startSessionValidation();
  }

  /**
   * Create a new session
   */
  async createSession(
    userId: string,
    deviceId: string,
    requiresTwoFA: boolean = false,
  ): Promise<SessionInfo> {
    try {
      // Clean up any existing sessions for this user if needed
      await this.enforceSessionLimits(userId);

      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + this.config.maxSessionDuration * 60 * 1000,
      );
      const sessionId = this.generateSessionId();

      // Create session in database
      const { error } = await supabase.from('active_sessions').insert({
        session_token: sessionId,
        user_id: userId,
        device_id: deviceId,
        expires_at: expiresAt.toISOString(),
        requires_2fa: requiresTwoFA,
        two_fa_verified: !requiresTwoFA,
        is_active: true,
        last_activity_at: now.toISOString(),
      });

      if (error) {
        throw new Error(`Failed to create session: ${error.message}`);
      }

      // Create session info
      this.sessionInfo = {
        sessionId,
        userId,
        deviceId,
        createdAt: now,
        expiresAt,
        lastActivity: now,
        isActive: true,
        requiresTwoFA,
        twoFAVerified: !requiresTwoFA,
      };

      // Store session info locally
      await this.saveSessionToStorage();

      // Start activity tracking
      this.startActivityTracking();

      // Log session creation
      await auditLogger.logEvent({
        userId,
        eventType: EventType.LOGIN,
        eventCategory: EventCategory.AUTH,
        severity: Severity.LOW,
        description: 'New session created',
        metadata: {
          sessionId,
          deviceId,
          requiresTwoFA,
          expiresAt: expiresAt.toISOString(),
        },
        sessionId,
      });

      return this.sessionInfo;
    } catch (error) {
      throw new Error(
        `Session creation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Validate current session
   */
  async validateSession(): Promise<boolean> {
    if (!this.sessionInfo) {
      return false;
    }

    try {
      // Check if session has expired
      if (new Date() > this.sessionInfo.expiresAt) {
        await this.expireSession('Session timeout');
        return false;
      }

      // Check if session is still active in database
      const { data, error } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('session_token', this.sessionInfo.sessionId)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        await this.expireSession('Session not found in database');
        return false;
      }

      // Check for idle timeout
      const idleTime = Date.now() - this.sessionInfo.lastActivity.getTime();
      const idleTimeoutMs = this.config.idleTimeout * 60 * 1000;

      if (idleTime > idleTimeoutMs) {
        await this.expireSession('Session idle timeout');
        return false;
      }

      // Update last activity if it's been a while
      if (idleTime > 60000) {
        // Update every minute
        await this.updateActivity();
      }

      return true;
    } catch (error) {
      console.error('Session validation error:', error);
      return false;
    }
  }

  /**
   * Update session activity
   */
  async updateActivity(): Promise<void> {
    if (!this.sessionInfo) return;

    const now = new Date();
    this.sessionInfo.lastActivity = now;

    try {
      // Update database
      await supabase
        .from('active_sessions')
        .update({
          last_activity_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('session_token', this.sessionInfo.sessionId);

      // Update local storage
      await this.saveSessionToStorage();

      // Reset activity timer
      this.resetActivityTimer();
    } catch (error) {
      console.error('Failed to update session activity:', error);
    }
  }

  /**
   * Extend session duration
   */
  async extendSession(): Promise<boolean> {
    if (!this.sessionInfo) return false;

    try {
      const newExpiresAt = new Date(
        Date.now() + this.config.maxSessionDuration * 60 * 1000,
      );

      const { error } = await supabase
        .from('active_sessions')
        .update({
          expires_at: newExpiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('session_token', this.sessionInfo.sessionId);

      if (error) {
        return false;
      }

      this.sessionInfo.expiresAt = newExpiresAt;
      await this.saveSessionToStorage();

      // Log session extension
      await auditLogger.logEvent({
        userId: this.sessionInfo.userId,
        eventType: EventType.LOGIN,
        eventCategory: EventCategory.AUTH,
        severity: Severity.LOW,
        description: 'Session extended',
        metadata: {
          sessionId: this.sessionInfo.sessionId,
          newExpiresAt: newExpiresAt.toISOString(),
        },
        sessionId: this.sessionInfo.sessionId,
      });

      return true;
    } catch (error) {
      console.error('Failed to extend session:', error);
      return false;
    }
  }

  /**
   * End current session
   */
  async endSession(): Promise<void> {
    if (!this.sessionInfo) return;

    try {
      // Mark session as inactive in database
      await supabase
        .from('active_sessions')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('session_token', this.sessionInfo.sessionId);

      // Log session end
      await auditLogger.logEvent({
        userId: this.sessionInfo.userId,
        eventType: EventType.LOGOUT,
        eventCategory: EventCategory.AUTH,
        severity: Severity.LOW,
        description: 'Session ended by user',
        metadata: {
          sessionId: this.sessionInfo.sessionId,
          duration: Date.now() - this.sessionInfo.createdAt.getTime(),
        },
        sessionId: this.sessionInfo.sessionId,
      });

      // Clean up
      await this.cleanupSession();
    } catch (error) {
      console.error('Failed to end session:', error);
      await this.cleanupSession(); // Clean up anyway
    }
  }

  /**
   * Verify two-factor authentication for session
   */
  async verifyTwoFA(): Promise<boolean> {
    if (!this.sessionInfo || !this.sessionInfo.requiresTwoFA) {
      return true;
    }

    try {
      const { error } = await supabase
        .from('active_sessions')
        .update({
          two_fa_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq('session_token', this.sessionInfo.sessionId);

      if (error) {
        return false;
      }

      this.sessionInfo.twoFAVerified = true;
      await this.saveSessionToStorage();

      await auditLogger.logEvent({
        userId: this.sessionInfo.userId,
        eventType: EventType.TWO_FA_ENABLED,
        eventCategory: EventCategory.SECURITY,
        severity: Severity.LOW,
        description: '2FA verified for session',
        metadata: {
          sessionId: this.sessionInfo.sessionId,
        },
        sessionId: this.sessionInfo.sessionId,
      });

      return true;
    } catch (error) {
      console.error('Failed to verify 2FA:', error);
      return false;
    }
  }

  /**
   * Get current session info
   */
  getSessionInfo(): SessionInfo | null {
    return this.sessionInfo;
  }

  /**
   * Get time until session expires
   */
  getTimeUntilExpiry(): number {
    if (!this.sessionInfo) return 0;
    return Math.max(0, this.sessionInfo.expiresAt.getTime() - Date.now());
  }

  /**
   * Check if session requires 2FA and is not verified
   */
  requiresTwoFAVerification(): boolean {
    return (
      (this.sessionInfo?.requiresTwoFA && !this.sessionInfo?.twoFAVerified) ||
      false
    );
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  private async enforceSessionLimits(userId: string): Promise<void> {
    try {
      // Get active sessions for user
      const { data: sessions, error } = await supabase
        .from('active_sessions')
        .select('id, created_at')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error || !sessions) return;

      // If user has too many sessions, deactivate oldest ones
      if (sessions.length >= this.config.maxConcurrentSessions) {
        const sessionsToDeactivate = sessions.slice(
          0,
          sessions.length - this.config.maxConcurrentSessions + 1,
        );

        for (const session of sessionsToDeactivate) {
          await supabase
            .from('active_sessions')
            .update({ is_active: false })
            .eq('id', session.id);
        }
      }
    } catch (error) {
      console.error('Failed to enforce session limits:', error);
    }
  }

  private async expireSession(reason: string): Promise<void> {
    if (!this.sessionInfo) return;

    try {
      await auditLogger.logEvent({
        userId: this.sessionInfo.userId,
        eventType: EventType.SESSION_EXPIRED,
        eventCategory: EventCategory.AUTH,
        severity: Severity.MEDIUM,
        description: `Session expired: ${reason}`,
        metadata: {
          sessionId: this.sessionInfo.sessionId,
          reason,
          duration: Date.now() - this.sessionInfo.createdAt.getTime(),
        },
        sessionId: this.sessionInfo.sessionId,
      });

      // Mark session as inactive
      await supabase
        .from('active_sessions')
        .update({ is_active: false })
        .eq('session_token', this.sessionInfo.sessionId);
    } catch (error) {
      console.error('Failed to log session expiry:', error);
    }

    await this.cleanupSession();
    this.onSessionExpired?.();
  }

  private async cleanupSession(): Promise<void> {
    // Clear timers
    if (this.activityTimer) clearTimeout(this.activityTimer);
    if (this.warningTimer) clearTimeout(this.warningTimer);
    if (this.sessionCheckInterval) clearInterval(this.sessionCheckInterval);

    // Clear session info
    this.sessionInfo = null;

    // Clear local storage
    await AsyncStorage.removeItem(SessionManager.STORAGE_KEY);
  }

  private async saveSessionToStorage(): Promise<void> {
    if (this.sessionInfo) {
      const sessionData = {
        ...this.sessionInfo,
        createdAt: this.sessionInfo.createdAt.toISOString(),
        expiresAt: this.sessionInfo.expiresAt.toISOString(),
        lastActivity: this.sessionInfo.lastActivity.toISOString(),
      };
      await AsyncStorage.setItem(
        SessionManager.STORAGE_KEY,
        JSON.stringify(sessionData),
      );
    }
  }

  private async restoreSession(): Promise<void> {
    try {
      const sessionData = await AsyncStorage.getItem(
        SessionManager.STORAGE_KEY,
      );
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        this.sessionInfo = {
          ...parsed,
          createdAt: new Date(parsed.createdAt),
          expiresAt: new Date(parsed.expiresAt),
          lastActivity: new Date(parsed.lastActivity),
        };

        // Validate restored session
        const isValid = await this.validateSession();
        if (isValid) {
          this.startActivityTracking();
        }
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
      await AsyncStorage.removeItem(SessionManager.STORAGE_KEY);
    }
  }

  private startActivityTracking(): void {
    this.resetActivityTimer();
    this.scheduleExpiryWarning();
  }

  private resetActivityTimer(): void {
    if (this.activityTimer) clearTimeout(this.activityTimer);

    this.activityTimer = setTimeout(() => {
      this.showIdleWarning();
    }, (this.config.idleTimeout - this.config.warningBeforeExpiry) * 60 * 1000);
  }

  private scheduleExpiryWarning(): void {
    if (!this.sessionInfo) return;

    const timeUntilWarning =
      this.sessionInfo.expiresAt.getTime() -
      Date.now() -
      this.config.warningBeforeExpiry * 60 * 1000;

    if (timeUntilWarning > 0) {
      this.warningTimer = setTimeout(() => {
        this.showExpiryWarning();
      }, timeUntilWarning);
    }
  }

  private showIdleWarning(): void {
    const warning: SessionWarning = {
      type: 'IDLE_WARNING',
      message: 'Your session will expire soon due to inactivity',
      timeRemaining: this.config.warningBeforeExpiry,
      onExtend: () => this.extendSession(),
      onLogout: () => this.endSession(),
    };

    this.onSessionWarning?.(warning);
  }

  private showExpiryWarning(): void {
    const warning: SessionWarning = {
      type: 'EXPIRY_WARNING',
      message: 'Your session will expire soon',
      timeRemaining: this.config.warningBeforeExpiry,
      onExtend: () => this.extendSession(),
      onLogout: () => this.endSession(),
    };

    this.onSessionWarning?.(warning);
  }

  private startSessionValidation(): void {
    this.sessionCheckInterval = setInterval(async () => {
      await this.validateSession();
    }, 60000); // Check every minute
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
