// Image Safety Moderation Service for COPPA Compliance (US-007)
// Uses OpenAI Moderation API to check AI-generated images before display.

import {
  Environment,
  getOpenAIHeaders,
  isOpenAIConfigured,
} from '../config/environment';

export interface ModerationResult {
  safe: boolean;
  flaggedCategories: string[];
  moderationTimeMs: number;
  error?: string;
}

const MODERATION_TIMEOUT_MS = 2000; // Must stay under 2s per acceptance criteria

/**
 * Moderate an image URL using OpenAI's moderation endpoint.
 *
 * The omni-moderation-latest model supports image inputs via URL.
 * If the moderation API itself fails or times out, returns safe=true
 * as a fallback — the image already passed Replicate's built-in NSFW filter.
 */
export async function moderateImage(
  imageUrl: string,
): Promise<ModerationResult> {
  const startTime = Date.now();

  if (!isOpenAIConfigured()) {
    console.warn('⚠️ OpenAI not configured — skipping image moderation');
    return {
      safe: true,
      flaggedCategories: [],
      moderationTimeMs: Date.now() - startTime,
      error: 'openai_not_configured',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      MODERATION_TIMEOUT_MS,
    );

    const response = await fetch(`${Environment.openai.baseUrl}/moderations`, {
      method: 'POST',
      headers: getOpenAIHeaders(),
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: [
          {
            type: 'image_url',
            image_url: { url: imageUrl },
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(
        `⚠️ Moderation API returned ${response.status} — allowing image through`,
      );
      return {
        safe: true,
        flaggedCategories: [],
        moderationTimeMs: Date.now() - startTime,
        error: `moderation_api_${response.status}`,
      };
    }

    const data = await response.json();
    const result = data.results?.[0];

    if (!result) {
      console.warn(
        '⚠️ Moderation API returned empty results — allowing image through',
      );
      return {
        safe: true,
        flaggedCategories: [],
        moderationTimeMs: Date.now() - startTime,
        error: 'empty_moderation_result',
      };
    }

    const flaggedCategories: string[] = [];
    if (result.categories) {
      for (const [category, flagged] of Object.entries(result.categories)) {
        if (flagged) {
          flaggedCategories.push(category);
        }
      }
    }

    const safe = !result.flagged;

    if (!safe) {
      console.log(
        `🛡️ Image moderation BLOCKED — flagged categories: ${flaggedCategories.join(
          ', ',
        )}`,
      );
    }

    return {
      safe,
      flaggedCategories,
      moderationTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === 'AbortError' || error.message.includes('abort'));

    if (isTimeout) {
      console.warn('⏰ Moderation API timed out — allowing image through');
    } else {
      console.warn('⚠️ Moderation API error — allowing image through:', error);
    }

    return {
      safe: true,
      flaggedCategories: [],
      moderationTimeMs: Date.now() - startTime,
      error: isTimeout
        ? 'moderation_timeout'
        : `moderation_error: ${
            error instanceof Error ? error.message : String(error)
          }`,
    };
  }
}
