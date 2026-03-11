import { openaiClient } from '../../services/openaiClient';

jest.mock('../../services/openaiClient', () => ({
  openaiClient: {
    isConfigured: jest.fn().mockReturnValue(true),
    generateStoryCompletion: jest
      .fn()
      .mockResolvedValue(
        '{"characters":[],"settings":[],"objects":[],"plot_patterns":[]}',
      ),
  },
}));

describe('StoryElementExtractionService model config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should NOT pass a hardcoded model to generateStoryCompletion', async () => {
    const {
      storyElementExtractionService,
    } = require('../../services/storyElementExtractionService');
    await storyElementExtractionService.extractStoryElements(
      'Once upon a time in a magical forest...',
    );

    const callArgs = (openaiClient.generateStoryCompletion as jest.Mock).mock
      .calls[0][2];
    // model should be undefined — let openaiClient fall back to Environment.openai.model
    expect(callArgs.model).toBeUndefined();
  });

  it('should still pass custom maxTokens and temperature for structured output', async () => {
    const {
      storyElementExtractionService,
    } = require('../../services/storyElementExtractionService');
    await storyElementExtractionService.extractStoryElements(
      'Once upon a time in a magical forest...',
    );

    const callArgs = (openaiClient.generateStoryCompletion as jest.Mock).mock
      .calls[0][2];
    expect(callArgs.maxTokens).toBe(800);
    expect(callArgs.temperature).toBe(0.3);
  });
});
