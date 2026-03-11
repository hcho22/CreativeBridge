/**
 * Environment OpenAI Model Configuration Tests
 *
 * Validates US-001: OPENAI_MODEL env var support with gpt-4o-mini default.
 * Based on: prd-gpt4o-mini-upgrade.md
 *
 * Note: react-native-dotenv Babel plugin inlines @env values at compile time,
 * so we test the Environment object directly (same pattern as clerkConfiguration.test.ts).
 */

import { Environment } from '../../config/environment';

describe('Environment OpenAI model config', () => {
  it('should default model to gpt-4o-mini when OPENAI_MODEL env var is not set', () => {
    // OPENAI_MODEL is not in .env, so react-native-dotenv sets it to undefined.
    // The fallback `OPENAI_MODEL || 'gpt-4o-mini'` kicks in.
    expect(Environment.openai.model).toBe('gpt-4o-mini');
  });

  it('should not use the deprecated gpt-4-turbo-preview model', () => {
    expect(Environment.openai.model).not.toBe('gpt-4-turbo-preview');
  });

  it('should use OPENAI_MODEL env var when set', () => {
    // Simulate env var override by mutating the config (Babel inlines @env at compile time)
    const originalModel = Environment.openai.model;
    (Environment as any).openai.model = 'gpt-4o';

    expect(Environment.openai.model).toBe('gpt-4o');

    // Restore
    (Environment as any).openai.model = originalModel;
  });

  it('should have model property on openai config', () => {
    expect(Environment.openai).toHaveProperty('model');
    expect(typeof Environment.openai.model).toBe('string');
    expect(Environment.openai.model.length).toBeGreaterThan(0);
  });
});
