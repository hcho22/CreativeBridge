// Child-Friendly Error Messages (US-006: U-6.1)
// Maps technical errors to age-appropriate messages for K-12 students.

import type { GradeLevel } from '../types';

/** Error categories that can be mapped to friendly messages. */
export type ErrorCategory =
  | 'rate_limit'
  | 'server_error'
  | 'timeout'
  | 'network'
  | 'auth'
  | 'generic';

interface FriendlyError {
  title: string;
  message: string;
  /** Optional retry hint shown below the message */
  retryHint?: string;
}

/**
 * Grade-aware error messages.
 * K-2 uses simpler vocabulary; 6-8 and 9-12 use more direct language.
 */
const ERROR_MESSAGES: Record<
  ErrorCategory,
  Record<'young' | 'older', FriendlyError>
> = {
  rate_limit: {
    young: {
      title: 'Taking a Break!',
      message:
        "Our story helper is taking a break! Let's try again in a moment.",
      retryHint: 'Try again in a few seconds!',
    },
    older: {
      title: 'Too Many Requests',
      message:
        "We're a bit busy right now. Please wait a moment and try again.",
      retryHint: 'Wait a few seconds before retrying.',
    },
  },
  server_error: {
    young: {
      title: 'Oops!',
      message: "Oops, something got mixed up! Let's try again.",
    },
    older: {
      title: 'Something Went Wrong',
      message: 'Something went wrong on our end. Please try again.',
    },
  },
  timeout: {
    young: {
      title: 'Taking Too Long',
      message: 'This is taking longer than expected. Want to try again?',
      retryHint: 'Tap the button to try one more time!',
    },
    older: {
      title: 'Request Timed Out',
      message: 'The request took too long. Please try again.',
    },
  },
  network: {
    young: {
      title: 'No Connection',
      message:
        "Hmm, we can't reach the internet right now. Check your connection and try again!",
    },
    older: {
      title: 'Connection Issue',
      message: 'Unable to connect. Please check your network and try again.',
    },
  },
  auth: {
    young: {
      title: 'Sign In Needed',
      message: "You need to sign in first. Let's get you logged in!",
    },
    older: {
      title: 'Authentication Required',
      message: 'Please sign in to continue.',
    },
  },
  generic: {
    young: {
      title: 'Uh Oh!',
      message: "Something went wrong. Let's try one more time!",
    },
    older: {
      title: 'Error',
      message: 'Something went wrong. Please try again.',
    },
  },
};

/** Grade levels considered "young" (K-2, 3-5) for simpler language. */
const YOUNG_GRADES: GradeLevel[] = ['K-2', '3-5'];

function getAgeGroup(gradeLevel?: GradeLevel): 'young' | 'older' {
  if (!gradeLevel) return 'young'; // Default to simpler language for safety
  return YOUNG_GRADES.includes(gradeLevel) ? 'young' : 'older';
}

/**
 * Classify a raw error into a category.
 * Checks status codes, message patterns, and error names.
 */
export function classifyError(error: unknown): ErrorCategory {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Rate limiting
    if (
      msg.includes('429') ||
      msg.includes('rate limit') ||
      msg.includes('too many requests')
    ) {
      return 'rate_limit';
    }
    // Timeout
    if (
      name === 'aborterror' ||
      msg.includes('timeout') ||
      msg.includes('timed out') ||
      msg.includes('abort')
    ) {
      return 'timeout';
    }
    // Network
    if (
      msg.includes('network') ||
      msg.includes('econnrefused') ||
      msg.includes('fetch failed') ||
      msg.includes('dns')
    ) {
      return 'network';
    }
    // Auth
    if (
      msg.includes('unauthorized') ||
      msg.includes('401') ||
      msg.includes('authentication')
    ) {
      return 'auth';
    }
    // Server error
    if (
      msg.includes('500') ||
      msg.includes('502') ||
      msg.includes('503') ||
      msg.includes('server error') ||
      msg.includes('internal error')
    ) {
      return 'server_error';
    }
  }

  // Check for response-like objects with status codes
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: number }).status;
    if (status === 429) return 'rate_limit';
    if (status === 401 || status === 403) return 'auth';
    if (status >= 500) return 'server_error';
    if (status === 408) return 'timeout';
  }

  return 'generic';
}

/**
 * Get a child-friendly error message for the given error.
 * Adapts language based on grade level.
 */
export function getChildFriendlyError(
  error: unknown,
  gradeLevel?: GradeLevel,
): FriendlyError {
  const category = classifyError(error);
  const ageGroup = getAgeGroup(gradeLevel);
  return ERROR_MESSAGES[category][ageGroup];
}

/**
 * Get just the user-facing message string (convenience wrapper).
 */
export function getChildFriendlyMessage(
  error: unknown,
  gradeLevel?: GradeLevel,
): string {
  return getChildFriendlyError(error, gradeLevel).message;
}
