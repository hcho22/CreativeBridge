jest.mock('@env', () => ({
  OPENAI_API_KEY: 'sk-test-key',
  OPENAI_MODEL: 'gpt-4o-mini',
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  ELEVENLABS_API_KEY: '',
  CLERK_PUBLISHABLE_KEY: '',
  CLERK_SECRET_KEY: '',
  CLERK_JWKS_URL: '',
  CONVEX_URL: '',
}));

describe('OpenAIClient.analyzeStoryForImageGeneration model config', () => {
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
