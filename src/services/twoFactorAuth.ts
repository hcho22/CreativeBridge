import { supabase } from './supabase';
import { auditLogger, EventType } from './auditLogger';
import AsyncStorage from '@react-native-async-storage/async-storage';

export enum TwoFAMethod {
  TOTP = 'TOTP', // Time-based One-Time Password (Google Authenticator, etc.)
  EMAIL = 'EMAIL',
  SMS = 'SMS',
}

export interface TwoFASetup {
  method: TwoFAMethod;
  secret?: string; // For TOTP
  qrCode?: string; // For TOTP
  backupCodes: string[];
  isEnabled: boolean;
}

export interface TwoFAVerification {
  code: string;
  method: TwoFAMethod;
  backupCode?: boolean;
}

export interface TwoFAConfig {
  userId: string;
  method: TwoFAMethod;
  isEnabled: boolean;
  secret?: string;
  backupCodes: string[];
  recoveryEmail?: string;
  recoveryPhone?: string;
}

class TwoFactorAuthService {
  private static readonly BACKUP_CODE_COUNT = 10;
  private static readonly CODE_LENGTH = 6;
  private static readonly CODE_VALIDITY_MINUTES = 5;

  /**
   * Setup 2FA for a user
   */
  async setupTwoFA(
    userId: string,
    method: TwoFAMethod,
    recoveryEmail?: string,
    recoveryPhone?: string,
  ): Promise<TwoFASetup> {
    try {
      let secret: string | undefined;
      let qrCode: string | undefined;

      // Generate TOTP secret if needed
      if (method === TwoFAMethod.TOTP) {
        secret = this.generateTOTPSecret();
        qrCode = await this.generateQRCode(userId, secret);
      }

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      // Store in database (encrypted)
      const { error } = await supabase.from('user_2fa').upsert({
        user_id: userId,
        method,
        secret_key: secret ? this.encryptSecret(secret) : null,
        backup_codes: backupCodes.map(code => this.encryptSecret(code)),
        recovery_email: recoveryEmail,
        recovery_phone: recoveryPhone,
        is_enabled: false, // Will be enabled after verification
        updated_at: new Date().toISOString(),
      });

      if (error) {
        throw new Error(`Failed to setup 2FA: ${error.message}`);
      }

      // Log setup attempt
      await auditLogger.logEvent({
        userId,
        eventType: EventType.TWO_FA_ENABLED,
        eventCategory: 'SECURITY',
        severity: 'MEDIUM',
        description: `2FA setup initiated for method: ${method}`,
        metadata: {
          method,
          hasRecoveryEmail: !!recoveryEmail,
          hasRecoveryPhone: !!recoveryPhone,
        },
      });

      return {
        method,
        secret,
        qrCode,
        backupCodes,
        isEnabled: false,
      };
    } catch (error) {
      await auditLogger.logEvent({
        userId,
        eventType: EventType.TWO_FA_FAILED,
        eventCategory: 'SECURITY',
        severity: 'HIGH',
        description: `2FA setup failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        metadata: {
          method,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  /**
   * Verify 2FA setup with initial code
   */
  async verifySetup(userId: string, code: string): Promise<boolean> {
    try {
      const config = await this.getTwoFAConfig(userId);
      if (!config) {
        throw new Error('2FA not configured');
      }

      let isValid = false;

      switch (config.method) {
        case TwoFAMethod.TOTP:
          if (!config.secret) throw new Error('TOTP secret not found');
          isValid = this.verifyTOTPCode(config.secret, code);
          break;

        case TwoFAMethod.EMAIL:
          isValid = await this.verifyEmailCode(userId, code);
          break;

        case TwoFAMethod.SMS:
          isValid = await this.verifySMSCode(userId, code);
          break;
      }

      if (isValid) {
        // Enable 2FA
        await supabase
          .from('user_2fa')
          .update({
            is_enabled: true,
            setup_completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        await auditLogger.logEvent({
          userId,
          eventType: EventType.TWO_FA_ENABLED,
          eventCategory: 'SECURITY',
          severity: 'LOW',
          description: '2FA setup completed successfully',
          metadata: { method: config.method },
        });

        return true;
      } else {
        await auditLogger.logEvent({
          userId,
          eventType: EventType.TWO_FA_FAILED,
          eventCategory: 'SECURITY',
          severity: 'MEDIUM',
          description: '2FA setup verification failed',
          metadata: { method: config.method, reason: 'Invalid code' },
        });

        return false;
      }
    } catch (error) {
      await auditLogger.logEvent({
        userId,
        eventType: EventType.TWO_FA_FAILED,
        eventCategory: 'SECURITY',
        severity: 'HIGH',
        description: `2FA setup verification error: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      return false;
    }
  }

  /**
   * Verify 2FA code during login
   */
  async verifyCode(
    userId: string,
    verification: TwoFAVerification,
  ): Promise<boolean> {
    try {
      const config = await this.getTwoFAConfig(userId);
      if (!config || !config.isEnabled) {
        throw new Error('2FA not enabled for user');
      }

      let isValid = false;

      if (verification.backupCode) {
        isValid = await this.verifyBackupCode(userId, verification.code);
      } else {
        switch (verification.method) {
          case TwoFAMethod.TOTP:
            if (!config.secret) throw new Error('TOTP secret not found');
            isValid = this.verifyTOTPCode(config.secret, verification.code);
            break;

          case TwoFAMethod.EMAIL:
            isValid = await this.verifyEmailCode(userId, verification.code);
            break;

          case TwoFAMethod.SMS:
            isValid = await this.verifySMSCode(userId, verification.code);
            break;
        }
      }

      // Update last used timestamp
      if (isValid) {
        await supabase
          .from('user_2fa')
          .update({
            last_used_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        await auditLogger.logEvent({
          userId,
          eventType: EventType.TWO_FA_ENABLED,
          eventCategory: 'SECURITY',
          severity: 'LOW',
          description: '2FA verification successful',
          metadata: {
            method: verification.method,
            backupCode: verification.backupCode,
          },
        });
      } else {
        await auditLogger.logEvent({
          userId,
          eventType: EventType.TWO_FA_FAILED,
          eventCategory: 'SECURITY',
          severity: 'MEDIUM',
          description: '2FA verification failed',
          metadata: {
            method: verification.method,
            backupCode: verification.backupCode,
            reason: 'Invalid code',
          },
        });
      }

      return isValid;
    } catch (error) {
      await auditLogger.logEvent({
        userId,
        eventType: EventType.TWO_FA_FAILED,
        eventCategory: 'SECURITY',
        severity: 'HIGH',
        description: `2FA verification error: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      return false;
    }
  }

  /**
   * Disable 2FA for a user
   */
  async disableTwoFA(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_2fa')
        .update({
          is_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to disable 2FA: ${error.message}`);
      }

      await auditLogger.logEvent({
        userId,
        eventType: EventType.TWO_FA_DISABLED,
        eventCategory: 'SECURITY',
        severity: 'MEDIUM',
        description: '2FA disabled by user',
        metadata: {},
      });

      return true;
    } catch (error) {
      await auditLogger.logEvent({
        userId,
        eventType: EventType.TWO_FA_FAILED,
        eventCategory: 'SECURITY',
        severity: 'HIGH',
        description: `Failed to disable 2FA: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      return false;
    }
  }

  /**
   * Generate new backup codes
   */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    try {
      const backupCodes = this.generateBackupCodes();

      const { error } = await supabase
        .from('user_2fa')
        .update({
          backup_codes: backupCodes.map(code => this.encryptSecret(code)),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to regenerate backup codes: ${error.message}`);
      }

      await auditLogger.logEvent({
        userId,
        eventType: EventType.TWO_FA_ENABLED,
        eventCategory: 'SECURITY',
        severity: 'LOW',
        description: 'Backup codes regenerated',
        metadata: { backupCodeCount: backupCodes.length },
      });

      return backupCodes;
    } catch (error) {
      await auditLogger.logEvent({
        userId,
        eventType: EventType.TWO_FA_FAILED,
        eventCategory: 'SECURITY',
        severity: 'MEDIUM',
        description: `Failed to regenerate backup codes: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  /**
   * Check if user has 2FA enabled
   */
  async isTwoFAEnabled(userId: string): Promise<boolean> {
    try {
      const config = await this.getTwoFAConfig(userId);
      return config?.isEnabled || false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Send 2FA code via email or SMS
   */
  async sendCode(
    userId: string,
    method: TwoFAMethod.EMAIL | TwoFAMethod.SMS,
  ): Promise<boolean> {
    try {
      const config = await this.getTwoFAConfig(userId);
      if (!config) {
        throw new Error('2FA not configured');
      }

      const code = this.generateVerificationCode();
      const expiresAt = new Date(
        Date.now() + this.CODE_VALIDITY_MINUTES * 60 * 1000,
      );

      // Store code temporarily (in a real app, you'd use a temporary storage)
      await AsyncStorage.setItem(
        `2fa_code_${userId}_${method}`,
        JSON.stringify({ code, expiresAt: expiresAt.toISOString() }),
      );

      switch (method) {
        case TwoFAMethod.EMAIL:
          if (!config.recoveryEmail) {
            throw new Error('No recovery email configured');
          }
          // In a real app, send email here
          console.log(
            `Sending 2FA code ${code} to email: ${config.recoveryEmail}`,
          );
          break;

        case TwoFAMethod.SMS:
          if (!config.recoveryPhone) {
            throw new Error('No recovery phone configured');
          }
          // In a real app, send SMS here
          console.log(
            `Sending 2FA code ${code} to phone: ${config.recoveryPhone}`,
          );
          break;
      }

      await auditLogger.logEvent({
        userId,
        eventType: EventType.TWO_FA_ENABLED,
        eventCategory: 'SECURITY',
        severity: 'LOW',
        description: `2FA code sent via ${method}`,
        metadata: { method },
      });

      return true;
    } catch (error) {
      await auditLogger.logEvent({
        userId,
        eventType: EventType.TWO_FA_FAILED,
        eventCategory: 'SECURITY',
        severity: 'MEDIUM',
        description: `Failed to send 2FA code: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        metadata: {
          method,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      return false;
    }
  }

  // Private helper methods

  private async getTwoFAConfig(userId: string): Promise<TwoFAConfig | null> {
    try {
      const { data, error } = await supabase
        .from('user_2fa')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        userId,
        method: data.method as TwoFAMethod,
        isEnabled: data.is_enabled,
        secret: data.secret_key
          ? this.decryptSecret(data.secret_key)
          : undefined,
        backupCodes:
          data.backup_codes?.map((code: string) => this.decryptSecret(code)) ||
          [],
        recoveryEmail: data.recovery_email,
        recoveryPhone: data.recovery_phone,
      };
    } catch (error) {
      return null;
    }
  }

  private generateTOTPSecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
  }

  private async generateQRCode(
    userId: string,
    secret: string,
  ): Promise<string> {
    // In a real app, you'd generate an actual QR code image
    // For now, return the TOTP URI
    const issuer = 'CreativeBridge';
    const label = `${issuer}:${userId}`;
    return `otpauth://totp/${encodeURIComponent(
      label,
    )}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < TwoFactorAuthService.BACKUP_CODE_COUNT; i++) {
      let code = '';
      for (let j = 0; j < 8; j++) {
        code += Math.floor(Math.random() * 10).toString();
      }
      codes.push(code);
    }
    return codes;
  }

  private generateVerificationCode(): string {
    let code = '';
    for (let i = 0; i < TwoFactorAuthService.CODE_LENGTH; i++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    return code;
  }

  private verifyTOTPCode(secret: string, code: string): boolean {
    // In a real app, you'd implement TOTP verification
    // This is a simplified implementation
    const timeWindow = Math.floor(Date.now() / 30000); // 30-second window
    const expectedCode = this.generateTOTPCode(secret, timeWindow);
    const previousCode = this.generateTOTPCode(secret, timeWindow - 1);
    const nextCode = this.generateTOTPCode(secret, timeWindow + 1);

    return code === expectedCode || code === previousCode || code === nextCode;
  }

  private generateTOTPCode(secret: string, timeWindow: number): string {
    // Simplified TOTP implementation - in a real app, use a proper TOTP library
    const hash = this.simpleHash(secret + timeWindow.toString());
    const code = (hash % 1000000).toString().padStart(6, '0');
    return code;
  }

  private simpleHash(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private async verifyEmailCode(
    userId: string,
    code: string,
  ): Promise<boolean> {
    try {
      const storedData = await AsyncStorage.getItem(`2fa_code_${userId}_EMAIL`);
      if (!storedData) return false;

      const { code: storedCode, expiresAt } = JSON.parse(storedData);

      if (new Date() > new Date(expiresAt)) {
        await AsyncStorage.removeItem(`2fa_code_${userId}_EMAIL`);
        return false;
      }

      const isValid = code === storedCode;
      if (isValid) {
        await AsyncStorage.removeItem(`2fa_code_${userId}_EMAIL`);
      }

      return isValid;
    } catch (error) {
      return false;
    }
  }

  private async verifySMSCode(userId: string, code: string): Promise<boolean> {
    try {
      const storedData = await AsyncStorage.getItem(`2fa_code_${userId}_SMS`);
      if (!storedData) return false;

      const { code: storedCode, expiresAt } = JSON.parse(storedData);

      if (new Date() > new Date(expiresAt)) {
        await AsyncStorage.removeItem(`2fa_code_${userId}_SMS`);
        return false;
      }

      const isValid = code === storedCode;
      if (isValid) {
        await AsyncStorage.removeItem(`2fa_code_${userId}_SMS`);
      }

      return isValid;
    } catch (error) {
      return false;
    }
  }

  private async verifyBackupCode(
    userId: string,
    code: string,
  ): Promise<boolean> {
    try {
      const config = await this.getTwoFAConfig(userId);
      if (!config || !config.backupCodes.includes(code)) {
        return false;
      }

      // Remove used backup code
      const updatedCodes = config.backupCodes.filter(c => c !== code);

      await supabase
        .from('user_2fa')
        .update({
          backup_codes: updatedCodes.map(c => this.encryptSecret(c)),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      return true;
    } catch (error) {
      return false;
    }
  }

  private encryptSecret(secret: string): string {
    // In a real app, use proper encryption
    // This is just base64 encoding for demo purposes
    return Buffer.from(secret).toString('base64');
  }

  private decryptSecret(encryptedSecret: string): string {
    // In a real app, use proper decryption
    // This is just base64 decoding for demo purposes
    return Buffer.from(encryptedSecret, 'base64').toString();
  }
}

// Export singleton instance
export const twoFactorAuth = new TwoFactorAuthService();
