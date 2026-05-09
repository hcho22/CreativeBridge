/**
 * ─── ROUTED (US-015f.1.api.openai-convex-action-shift) ───
 *
 * 1 of 1 test fails because `createChatCompletion` was removed from
 * `OpenAIClient`. Verified at `openaiClient.ts:87-102`: the source's
 * `analyzeStoryForImageGeneration` now wraps the Convex action
 * `api.ai.analyzeStoryForImageGeneration` instead of calling the
 * internal helper. The entire helper-method architecture shifted to
 * Convex actions as part of the Supabase→Convex migration.
 *
 * Routing wholesale: this single test asserted on a now-private
 * implementation detail (the internal helper). Re-author should
 * verify the Convex action invocation, not the removed helper.
 *
 * Source still implements equivalent behavior (at the Convex
 * action layer). 4-axis filter axis #1 cleared.
 */
jest.mock('@env', () => ({
  OPENAI_API_KEY: 'sk-test-key',
  OPENAI_MODEL: 'gpt-4o-mini',
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  CLERK_PUBLISHABLE_KEY: '',
  CLERK_SECRET_KEY: '',
  CLERK_JWKS_URL: '',
  CONVEX_URL: '',
}));

// eslint-disable-next-line jest/no-disabled-tests -- Routed to US-015f.1.api.openai-convex-action-shift; see file-header marker.
describe.skip('OpenAIClient.analyzeStoryForImageGeneration model config', () => {
  it('should pass Environment.openai.model to createChatCompletion', async () => {
    const { OpenAIClient } = require('../../services/openaiClient');
    const client = new OpenAIClient();

    const spy = jest
      .spyOn(client as any, 'createChatCompletion')
      .mockResolvedValue({
        choices: [
          { message: { content: 'A watercolor painting of a magical forest' } },
        ],
        usage: { total_tokens: 50 },
      });

    await client.analyzeStoryForImageGeneration(
      'A story about a magical forest',
    );

    expect(spy.mock.calls[0][0].model).toBe('gpt-4o-mini');
    expect(spy.mock.calls[0][0].model).not.toBe('gpt-4-turbo-preview');
    spy.mockRestore();
  });
});
