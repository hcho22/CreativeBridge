/**
 * StoryGenerationService Model Configuration Tests
 *
 * Validates US-002: storyGenerationService reads model from Environment config
 * instead of a hardcoded string.
 * Based on: prd-gpt4o-mini-upgrade.md
 */

describe('StoryGenerationService model config', () => {
  it('should use model from Environment config instead of hardcoded value', () => {
    jest.resetModules();
    jest.mock('@env', () => ({
      OPENAI_API_KEY: 'sk-test',
      OPENAI_MODEL: 'gpt-4o-mini',
      SUPABASE_URL: '',
      SUPABASE_ANON_KEY: '',
      CLERK_PUBLISHABLE_KEY: '',
      CLERK_SECRET_KEY: '',
      CLERK_JWKS_URL: '',
      CONVEX_URL: '',
    }));
    const {
      storyGenerationService,
    } = require('../../services/storyGenerationService');
    const config = (storyGenerationService as any).config;
    expect(config.model).toBe('gpt-4o-mini');
    expect(config.model).not.toBe('gpt-4-turbo-preview');
  });
});
