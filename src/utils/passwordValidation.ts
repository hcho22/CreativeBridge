export interface PasswordStrengthResult {
  score: number; // 0-5 (0=very weak, 5=very strong)
  feedback: string[];
  isValid: boolean;
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumbers: boolean;
    hasSpecialChars: boolean;
    noCommonPatterns: boolean;
  };
}

export class PasswordValidator {
  private static readonly MIN_LENGTH = 8;
  private static readonly SPECIAL_CHARS = /[!@#$%^&*(),.?":{}|<>]/;

  // Common weak passwords and patterns
  private static readonly COMMON_PASSWORDS = new Set([
    'password',
    '123456',
    '123456789',
    'qwerty',
    'abc123',
    'password123',
    'admin',
    'letmein',
    'welcome',
    'monkey',
    '1234567890',
    'password1',
    'qwerty123',
    '123qwe',
    'admin123',
    'welcome123',
    'password!',
  ]);

  private static readonly COMMON_PATTERNS = [
    /(.)\1{2,}/, // Repeated characters (aaa, 111)
    /123|234|345|456|567|678|789|890/, // Sequential numbers
    /abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i, // Sequential letters
    /qwerty|asdf|zxcv/i, // Keyboard patterns
  ];

  static validatePassword(password: string): PasswordStrengthResult {
    const result: PasswordStrengthResult = {
      score: 0,
      feedback: [],
      isValid: false,
      requirements: {
        minLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumbers: false,
        hasSpecialChars: false,
        noCommonPatterns: true,
      },
    };

    if (!password) {
      result.feedback.push('Password is required');
      return result;
    }

    // Check minimum length
    if (password.length >= this.MIN_LENGTH) {
      result.requirements.minLength = true;
      result.score += 1;
    } else {
      result.feedback.push(
        `Password must be at least ${this.MIN_LENGTH} characters long`,
      );
    }

    // Check for uppercase letters
    if (/[A-Z]/.test(password)) {
      result.requirements.hasUppercase = true;
      result.score += 1;
    } else {
      result.feedback.push('Add at least one uppercase letter');
    }

    // Check for lowercase letters
    if (/[a-z]/.test(password)) {
      result.requirements.hasLowercase = true;
      result.score += 1;
    } else {
      result.feedback.push('Add at least one lowercase letter');
    }

    // Check for numbers
    if (/[0-9]/.test(password)) {
      result.requirements.hasNumbers = true;
      result.score += 1;
    } else {
      result.feedback.push('Add at least one number');
    }

    // Check for special characters
    if (this.SPECIAL_CHARS.test(password)) {
      result.requirements.hasSpecialChars = true;
      result.score += 1;
    } else {
      result.feedback.push('Add at least one special character (!@#$%^&*)');
    }

    // Check for common passwords
    if (this.COMMON_PASSWORDS.has(password.toLowerCase())) {
      result.requirements.noCommonPatterns = false;
      result.feedback.push('This is a commonly used password');
      result.score = Math.max(0, result.score - 2);
    }

    // Check for common patterns
    for (const pattern of this.COMMON_PATTERNS) {
      if (pattern.test(password.toLowerCase())) {
        result.requirements.noCommonPatterns = false;
        result.feedback.push('Avoid common patterns like "123" or "abc"');
        result.score = Math.max(0, result.score - 1);
        break;
      }
    }

    // Check for personal information patterns (basic)
    if (this.hasPersonalInfoPattern(password)) {
      result.feedback.push('Avoid using personal information');
      result.score = Math.max(0, result.score - 1);
    }

    // Bonus points for longer passwords
    if (password.length >= 12) {
      result.score += 1;
    }

    // Cap the score at 5
    result.score = Math.min(5, result.score);

    // Password is valid if it meets basic requirements
    result.isValid =
      result.requirements.minLength &&
      result.requirements.hasUppercase &&
      result.requirements.hasLowercase &&
      result.requirements.hasNumbers &&
      result.requirements.noCommonPatterns;

    // Add positive feedback for strong passwords
    if (result.score >= 4) {
      result.feedback = ['Strong password! 💪'];
    } else if (result.score >= 3) {
      result.feedback =
        result.feedback.length > 0
          ? result.feedback
          : ['Good password strength 👍'];
    }

    return result;
  }

  private static hasPersonalInfoPattern(password: string): boolean {
    const lower = password.toLowerCase();

    // Check for common personal info patterns
    const personalPatterns = [
      /birthday/,
      /name/,
      /admin/,
      /user/,
      /test/,
      /demo/,
    ];

    return personalPatterns.some(pattern => pattern.test(lower));
  }

  static getStrengthLabel(score: number): string {
    switch (score) {
      case 0:
      case 1:
        return 'Very Weak';
      case 2:
        return 'Weak';
      case 3:
        return 'Fair';
      case 4:
        return 'Good';
      case 5:
        return 'Strong';
      default:
        return 'Unknown';
    }
  }

  static getStrengthColor(score: number): string {
    switch (score) {
      case 0:
      case 1:
        return '#dc3545'; // Red
      case 2:
        return '#fd7e14'; // Orange
      case 3:
        return '#ffc107'; // Yellow
      case 4:
        return '#20c997'; // Teal
      case 5:
        return '#198754'; // Green
      default:
        return '#6c757d'; // Gray
    }
  }
}

// Convenience function for ease of use
export const validatePassword = (password: string): PasswordStrengthResult => {
  return PasswordValidator.validatePassword(password);
};
