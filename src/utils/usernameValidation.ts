import { getConvexClient, api } from '../services/convex';

export interface UsernameValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: string[];
}

export interface UsernameAvailabilityResult {
  isAvailable: boolean;
  error?: string;
}

export class UsernameValidator {
  private static readonly MIN_LENGTH = 3;
  private static readonly MAX_LENGTH = 50;
  private static readonly USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

  // Reserved usernames that cannot be used
  private static readonly RESERVED_USERNAMES = new Set([
    'admin',
    'administrator',
    'root',
    'superuser',
    'moderator',
    'mod',
    'api',
    'www',
    'mail',
    'ftp',
    'smtp',
    'pop',
    'imap',
    'dns',
    'support',
    'help',
    'info',
    'contact',
    'about',
    'privacy',
    'terms',
    'user',
    'users',
    'guest',
    'anonymous',
    'null',
    'undefined',
    'creativebridge',
    'storyquest',
    'story-quest',
    'story_quest',
    'test',
    'demo',
    'sample',
    'example',
    'placeholder',
    'account',
    'profile',
    'settings',
    'dashboard',
    'home',
  ]);

  // Inappropriate words (basic filter)
  private static readonly INAPPROPRIATE_WORDS = new Set([
    'spam',
    'fake',
    'bot',
    'troll',
    'hate',
    'nazi',
    'admin123',
    'password',
    'login',
    'signin',
    'signup',
    'register',
  ]);

  static validateFormat(username: string): UsernameValidationResult {
    const result: UsernameValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    if (!username || username.trim().length === 0) {
      result.isValid = false;
      result.errors.push('Username is required');
      return result;
    }

    const trimmedUsername = username.trim();

    // Check length
    if (trimmedUsername.length < this.MIN_LENGTH) {
      result.isValid = false;
      result.errors.push(
        `Username must be at least ${this.MIN_LENGTH} characters long`,
      );
    }

    if (trimmedUsername.length > this.MAX_LENGTH) {
      result.isValid = false;
      result.errors.push(
        `Username must be no more than ${this.MAX_LENGTH} characters long`,
      );
    }

    // Check format (alphanumeric, underscore, hyphen only)
    if (!this.USERNAME_REGEX.test(trimmedUsername)) {
      result.isValid = false;
      result.errors.push(
        'Username can only contain letters, numbers, underscores, and hyphens',
      );
    }

    // Check for invalid starting/ending characters
    if (trimmedUsername.startsWith('_') || trimmedUsername.startsWith('-')) {
      result.isValid = false;
      result.errors.push('Username cannot start with underscore or hyphen');
    }

    if (trimmedUsername.endsWith('_') || trimmedUsername.endsWith('-')) {
      result.isValid = false;
      result.errors.push('Username cannot end with underscore or hyphen');
    }

    // Check for consecutive special characters
    if (/__+|--+|_-|-_/.test(trimmedUsername)) {
      result.isValid = false;
      result.errors.push(
        'Username cannot contain consecutive underscores or hyphens',
      );
    }

    // Check for reserved usernames
    if (this.RESERVED_USERNAMES.has(trimmedUsername.toLowerCase())) {
      result.isValid = false;
      result.errors.push('This username is reserved and cannot be used');
    }

    // Check for inappropriate content
    const lowerUsername = trimmedUsername.toLowerCase();
    for (const word of this.INAPPROPRIATE_WORDS) {
      if (lowerUsername.includes(word)) {
        result.isValid = false;
        result.errors.push('Username contains inappropriate content');
        break;
      }
    }

    // Check for common problematic patterns
    if (/^\d+$/.test(trimmedUsername)) {
      result.warnings.push(
        'Consider adding letters to make your username more memorable',
      );
    }

    if (trimmedUsername.toLowerCase() === trimmedUsername) {
      // All lowercase - no warning, this is fine
    } else if (trimmedUsername.toUpperCase() === trimmedUsername) {
      result.warnings.push('Consider using mixed case for better readability');
    }

    // Suggest improvements for very short usernames
    if (trimmedUsername.length === this.MIN_LENGTH && result.isValid) {
      result.warnings.push('Consider a longer username for better uniqueness');
    }

    return result;
  }

  static async checkUsernameAvailability(
    username: string,
  ): Promise<UsernameAvailabilityResult> {
    try {
      const trimmedUsername = username.trim();

      // Check in Convex userProfiles table
      const client = getConvexClient();
      if (!client) {
        // Convex not initialized — skip availability check, allow sign-up to proceed
        console.warn(
          'Convex client not available for username check, skipping',
        );
        return { isAvailable: true };
      }

      const isAvailable = await client.query(
        api.userProfiles.isUsernameAvailable,
        { username: trimmedUsername },
      );

      if (isAvailable) {
        return { isAvailable: true };
      }

      return {
        isAvailable: false,
        error: 'This username is already taken',
      };
    } catch (error) {
      console.error('Username availability check error:', error);
      return {
        isAvailable: false,
        error: 'Unable to check username availability. Please try again.',
      };
    }
  }

  static async validateUsername(
    username: string,
    checkAvailability = false,
  ): Promise<UsernameValidationResult> {
    // Start with format validation
    const formatResult = this.validateFormat(username);

    if (!formatResult.isValid) {
      return formatResult;
    }

    // Check availability if requested
    if (checkAvailability) {
      const availabilityResult = await this.checkUsernameAvailability(username);
      if (!availabilityResult.isAvailable) {
        formatResult.isValid = false;
        formatResult.errors.push(
          availabilityResult.error || 'Username is not available',
        );

        // Suggest alternatives
        formatResult.suggestions = this.generateUsernameSuggestions(username);
      }
    }

    return formatResult;
  }

  private static generateUsernameSuggestions(username: string): string[] {
    const suggestions: string[] = [];
    const baseUsername = username.toLowerCase();

    // Add numbers
    for (let i = 1; i <= 3; i++) {
      suggestions.push(`${baseUsername}${Math.floor(Math.random() * 100)}`);
    }

    // Add year
    const currentYear = new Date().getFullYear();
    suggestions.push(`${baseUsername}${currentYear}`);

    // Add underscore variations
    suggestions.push(`${baseUsername}_user`);
    suggestions.push(`${baseUsername}_${Math.floor(Math.random() * 100)}`);

    return suggestions.slice(0, 3); // Return top 3 suggestions
  }
}

// Convenience functions
export const validateUsernameFormat = (
  username: string,
): UsernameValidationResult => {
  return UsernameValidator.validateFormat(username);
};

export const checkUsernameAvailability = async (
  username: string,
): Promise<UsernameAvailabilityResult> => {
  return UsernameValidator.checkUsernameAvailability(username);
};

export const validateUsername = async (
  username: string,
  checkAvailability = false,
): Promise<UsernameValidationResult> => {
  return UsernameValidator.validateUsername(username, checkAvailability);
};
