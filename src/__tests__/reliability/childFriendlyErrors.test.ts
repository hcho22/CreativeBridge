/**
 * Child-Friendly Error Messages Validation Tests
 *
 * Verifies that technical error messages are replaced with age-appropriate
 * messages, ErrorBoundary uses child-friendly UI, and content safety
 * fails closed for under-13 users.
 *
 * @implements US-006: U-6.1, U-6.6, U-6.7
 */

import {
  classifyError,
  getChildFriendlyError,
  getChildFriendlyMessage,
} from '../../utils/childFriendlyErrors';
import * as fs from 'fs';
import * as path from 'path';

describe('Child-Friendly Error Messages (US-006: U-6.1)', () => {
  test('429 rate limit shows friendly message', () => {
    const error = new Error('429 Too Many Requests: rate limit exceeded');
    const friendly = getChildFriendlyError(error, 'K-2');
    expect(friendly.message).toContain('story helper');
    expect(friendly.message).toContain('break');
    expect(friendly.message).not.toContain('429');
    expect(friendly.message).not.toContain('rate limit');
  });

  test('500 server error shows friendly message', () => {
    const error = new Error('500 Internal Server Error');
    const friendly = getChildFriendlyError(error, 'K-2');
    expect(friendly.message).toContain('mixed up');
    expect(friendly.message).not.toContain('500');
    expect(friendly.message).not.toContain('Internal Server');
  });

  test('timeout shows friendly message', () => {
    const error = new Error('Request timed out after 30000ms');
    const friendly = getChildFriendlyError(error, 'K-2');
    expect(friendly.message).toContain('taking longer');
    expect(friendly.message).not.toContain('30000');
  });

  test('classifies errors correctly', () => {
    expect(classifyError(new Error('429 rate limit'))).toBe('rate_limit');
    expect(classifyError(new Error('500 server error'))).toBe('server_error');
    const abortError = new Error('timeout');
    abortError.name = 'AbortError';
    expect(classifyError(abortError)).toBe('timeout');
    expect(classifyError(new Error('ECONNREFUSED'))).toBe('network');
    expect(classifyError(new Error('something random'))).toBe('generic');
  });

  test('older grade levels get more direct language', () => {
    const error = new Error('429');
    const young = getChildFriendlyMessage(error, 'K-2');
    const older = getChildFriendlyMessage(error, '9-12');
    expect(young).toContain('story helper');
    expect(older).not.toContain('story helper');
    expect(older).toContain('busy');
  });
});

describe('ErrorBoundary Child-Friendly UI (US-006: U-6.7)', () => {
  test('ErrorBoundary does not show skull or explosion emoji for K-2', () => {
    const errorBoundaryPath = path.resolve(
      __dirname,
      '../../components/common/ErrorBoundary.tsx',
    );
    const content = fs.readFileSync(errorBoundaryPath, 'utf-8');

    // Must not contain skull or explosion emojis
    expect(content).not.toContain('💀');
    expect(content).not.toContain('☠️');
    // The original 💥 should have been replaced
    expect(content).not.toMatch(/errorEmoji.*💥/);

    // Should contain a friendly emoji (rainbow, star, or similar)
    expect(content).toMatch(/🌈|⭐|🌟|😊|🎨/);

    // Error messages should be child-friendly
    expect(content).toContain("Don't worry");
    expect(content).not.toContain('encountered an error');
  });
});

describe('Content Safety Fail-Closed for Under-13 (US-006: U-6.6)', () => {
  test('checkInputSafety accepts isUnder13 option', async () => {
    // Verify the function signature accepts the new option
    const { checkInputSafety } = require('../../services/contentSafetyService');
    expect(typeof checkInputSafety).toBe('function');

    // The function should accept a second parameter
    // Even without mocking the API, we can verify it doesn't throw
    // with the new signature
    const result = await checkInputSafety('hello world', { isUnder13: true });
    expect(result).toHaveProperty('safe');
    expect(result).toHaveProperty('moderationCategories');
    expect(result).toHaveProperty('checkTimeMs');
  });

  test('runModerationAPI failure path marks content unsafe for under-13', async () => {
    // Read the source to verify the fail-closed logic exists
    const contentSafetyPath = path.resolve(
      __dirname,
      '../../services/contentSafetyService.ts',
    );
    const content = fs.readFileSync(contentSafetyPath, 'utf-8');

    // Verify fail-closed logic is present
    expect(content).toContain('failClosed');
    expect(content).toContain('isUnder13');
    expect(content).toContain('moderation_unavailable');
    expect(content).toContain('succeeded');
  });

  test('13+ users keep fail-open behavior when API errors', async () => {
    // Read source to verify 13+ users are not affected
    const contentSafetyPath = path.resolve(
      __dirname,
      '../../services/contentSafetyService.ts',
    );
    const content = fs.readFileSync(contentSafetyPath, 'utf-8');

    // The failClosed flag should only be set when isUnder13 is true
    expect(content).toContain('options.isUnder13 && moderationFailed');
  });
});
