import { supabase } from '../services/supabase';

export interface EmailValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: string[];
}

export interface EmailAvailabilityResult {
  isAvailable: boolean;
  error?: string;
}

// Enhanced email validation class
export class EmailValidator {
  // Comprehensive email regex that follows RFC 5322 more closely
  private static readonly EMAIL_REGEX =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  // Common disposable email domains to warn against
  private static readonly DISPOSABLE_DOMAINS = new Set([
    '10minutemail.com',
    'guerrillamail.com',
    'mailinator.com',
    'tempmail.org',
    'throwaway.email',
    'temp-mail.org',
    'yopmail.com',
    'maildrop.cc',
    'getairmail.com',
    'sharklasers.com',
  ]);

  // Common domain typos and their corrections
  private static readonly DOMAIN_SUGGESTIONS = new Map([
    ['gmail.co', 'gmail.com'],
    ['gmail.con', 'gmail.com'],
    ['gmial.com', 'gmail.com'],
    ['gmai.com', 'gmail.com'],
    ['hotmai.com', 'hotmail.com'],
    ['hotmial.com', 'hotmail.com'],
    ['yahoo.co', 'yahoo.com'],
    ['yahoo.con', 'yahoo.com'],
    ['yahooo.com', 'yahoo.com'],
    ['outlok.com', 'outlook.com'],
    ['outllok.com', 'outlook.com'],
  ]);

  // Validate email format and structure
  static validateFormat(email: string): EmailValidationResult {
    const result: EmailValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    if (!email || email.trim().length === 0) {
      result.isValid = false;
      result.errors.push('Email address is required');
      return result;
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Check basic format
    if (!this.EMAIL_REGEX.test(trimmedEmail)) {
      result.isValid = false;
      result.errors.push('Please enter a valid email address format');
      return result;
    }

    // Check length constraints
    if (trimmedEmail.length > 320) {
      result.isValid = false;
      result.errors.push('Email address is too long (maximum 320 characters)');
    }

    const [localPart, domain] = trimmedEmail.split('@');

    // Validate local part (before @)
    if (localPart.length > 64) {
      result.isValid = false;
      result.errors.push('Email username is too long (maximum 64 characters)');
    }

    if (localPart.startsWith('.') || localPart.endsWith('.')) {
      result.isValid = false;
      result.errors.push('Email username cannot start or end with a period');
    }

    if (localPart.includes('..')) {
      result.isValid = false;
      result.errors.push('Email username cannot contain consecutive periods');
    }

    // Validate domain part (after @)
    if (domain.length > 253) {
      result.isValid = false;
      result.errors.push('Email domain is too long (maximum 253 characters)');
    }

    if (domain.startsWith('-') || domain.endsWith('-')) {
      result.isValid = false;
      result.errors.push('Email domain cannot start or end with a hyphen');
    }

    // Check for common domain typos
    if (this.DOMAIN_SUGGESTIONS.has(domain)) {
      result.warnings.push('Possible typo in email domain');
      result.suggestions = [
        `Did you mean ${this.DOMAIN_SUGGESTIONS.get(domain)}?`,
      ];
    }

    // Warn about disposable email addresses
    if (this.DISPOSABLE_DOMAINS.has(domain)) {
      result.warnings.push(
        'Disposable email addresses may not receive important notifications',
      );
    }

    // Check for suspicious patterns
    if (domain.includes('..')) {
      result.isValid = false;
      result.errors.push('Email domain contains invalid consecutive periods');
    }

    return result;
  }

  // Enhanced domain verification using DNS-like checks
  static async verifyDomain(email: string): Promise<EmailValidationResult> {
    const result: EmailValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) {
      result.isValid = false;
      result.errors.push('Invalid email format');
      return result;
    }

    try {
      // For React Native, we use a simple HTTP-based domain verification
      // since we can't do direct DNS lookups
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        `https://dns.google/resolve?name=${domain}&type=MX`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/dns-json',
          },
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        result.warnings.push(
          'Unable to verify domain - proceeding with caution',
        );
        return result;
      }

      const dnsData = await response.json();

      // Check if domain has MX records (mail exchange records)
      if (!dnsData.Answer || dnsData.Answer.length === 0) {
        // Try A record as fallback
        const aController = new AbortController();
        const aTimeoutId = setTimeout(() => aController.abort(), 5000);

        const aResponse = await fetch(
          `https://dns.google/resolve?name=${domain}&type=A`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/dns-json',
            },
            signal: aController.signal,
          },
        );

        clearTimeout(aTimeoutId);

        if (aResponse.ok) {
          const aData = await aResponse.json();
          if (!aData.Answer || aData.Answer.length === 0) {
            result.isValid = false;
            result.errors.push(
              'Email domain does not exist or cannot receive emails',
            );
          } else {
            result.warnings.push(
              'Domain exists but may not be configured for email',
            );
          }
        } else {
          result.warnings.push(
            'Unable to verify domain - proceeding with caution',
          );
        }
      }
    } catch (error) {
      // If domain verification fails, warn but don't block
      result.warnings.push('Unable to verify domain - proceeding with caution');
    }

    return result;
  }

  // Check if email is already registered
  static async checkEmailAvailability(
    email: string,
  ): Promise<EmailAvailabilityResult> {
    try {
      const trimmedEmail = email.trim().toLowerCase();

      // Use Supabase auth API to check if email exists
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: 'dummy-password-for-checking', // This will fail but tells us if email exists
      });

      // If we get a specific error about invalid credentials, email exists
      if (error?.message.includes('Invalid login credentials')) {
        return {
          isAvailable: false,
          error: 'An account with this email already exists',
        };
      }

      // If we get any other error, assume email is available
      // (This is a conservative approach - better to allow than block legitimate users)
      return {
        isAvailable: true,
      };
    } catch (error) {
      // If there's an unexpected error, assume email is available
      return {
        isAvailable: true,
      };
    }
  }

  // Comprehensive validation combining all checks
  static async validateEmail(
    email: string,
    checkAvailability = false,
  ): Promise<EmailValidationResult> {
    // Start with format validation
    const formatResult = this.validateFormat(email);

    if (!formatResult.isValid) {
      return formatResult;
    }

    // Add domain verification
    const domainResult = await this.verifyDomain(email);

    // Combine results
    const combinedResult: EmailValidationResult = {
      isValid: formatResult.isValid && domainResult.isValid,
      errors: [...formatResult.errors, ...domainResult.errors],
      warnings: [...formatResult.warnings, ...domainResult.warnings],
      suggestions: formatResult.suggestions,
    };

    // Check availability if requested
    if (checkAvailability && combinedResult.isValid) {
      const availabilityResult = await this.checkEmailAvailability(email);
      if (!availabilityResult.isAvailable) {
        combinedResult.isValid = false;
        combinedResult.errors.push(
          availabilityResult.error || 'Email is not available',
        );
      }
    }

    return combinedResult;
  }
}

// Convenience functions for backward compatibility and ease of use
export const validateEmailFormat = (email: string): EmailValidationResult => {
  return EmailValidator.validateFormat(email);
};

export const verifyEmailDomain = async (
  email: string,
): Promise<EmailValidationResult> => {
  return EmailValidator.verifyDomain(email);
};

export const checkEmailAvailability = async (
  email: string,
): Promise<EmailAvailabilityResult> => {
  return EmailValidator.checkEmailAvailability(email);
};

export const validateEmail = async (
  email: string,
  checkAvailability = false,
): Promise<EmailValidationResult> => {
  return EmailValidator.validateEmail(email, checkAvailability);
};
