// Content Safety Service for COPPA Compliance (US-014)
// Centralized content safety checking: blocklist + OpenAI Moderation API.
// Runs on user input (before AI call) and AI output (before display).

import {
  getBlocklistRegexMap,
  getCategoriesForTerm,
  CONTENT_BLOCKED_USER_MESSAGE,
  CONTENT_BLOCKED_OUTPUT_MESSAGE,
} from '../config/contentBlocklist';
import {
  Environment,
  getOpenAIHeaders,
  isOpenAIConfigured,
} from '../config/environment';

export interface ContentSafetyResult {
  safe: boolean;
  /** Matched blocklist terms (if any) */
  matchedTerms: string[];
  /** Categories the matched terms belong to */
  matchedCategories: string[];
  /** OpenAI Moderation API flagged categories (if used) */
  moderationCategories: string[];
  /** User-facing message when content is blocked */
  userMessage?: string;
  /** Time taken for the full check in ms */
  checkTimeMs: number;
}

const MODERATION_TIMEOUT_MS = 1500; // Budget 1.5s for moderation pre-check

/**
 * Check text against the content blocklist using pre-compiled regexes.
 * Returns matched terms and their categories.
 */
function checkBlocklist(text: string): {
  matchedTerms: string[];
  matchedCategories: string[];
} {
  const regexMap = getBlocklistRegexMap();
  const matchedTerms: string[] = [];
  const matchedCategoriesSet = new Set<string>();

  for (const [term, regex] of regexMap) {
    if (regex.test(text)) {
      matchedTerms.push(term);
      for (const cat of getCategoriesForTerm(term)) {
        matchedCategoriesSet.add(cat);
      }
    }
  }

  return { matchedTerms, matchedCategories: Array.from(matchedCategoriesSet) };
}

/**
 * Run OpenAI Moderation API on text content.
 * Returns flagged category names, or empty array on failure/timeout.
 */
async function runModerationAPI(text: string): Promise<string[]> {
  if (!isOpenAIConfigured()) {
    return [];
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
        input: text,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Content moderation API returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    const result = data.results?.[0];

    if (!result || !result.flagged) {
      return [];
    }

    const flagged: string[] = [];
    if (result.categories) {
      for (const [category, isFlagged] of Object.entries(result.categories)) {
        if (isFlagged) {
          flagged.push(category);
        }
      }
    }
    return flagged;
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === 'AbortError' || error.message.includes('abort'));
    if (isTimeout) {
      console.warn('Content moderation API timed out — skipping');
    } else {
      console.warn('Content moderation API error — skipping:', error);
    }
    return [];
  }
}

/**
 * Check user input for safety BEFORE sending to AI services.
 * Runs blocklist check + OpenAI Moderation API in parallel.
 */
export async function checkInputSafety(
  text: string,
): Promise<ContentSafetyResult> {
  const startTime = Date.now();

  // Run blocklist and moderation API in parallel
  const [blocklistResult, moderationCategories] = await Promise.all([
    Promise.resolve(checkBlocklist(text)),
    runModerationAPI(text),
  ]);

  const safe =
    blocklistResult.matchedTerms.length === 0 &&
    moderationCategories.length === 0;

  return {
    safe,
    matchedTerms: blocklistResult.matchedTerms,
    matchedCategories: blocklistResult.matchedCategories,
    moderationCategories,
    userMessage: safe ? undefined : CONTENT_BLOCKED_USER_MESSAGE,
    checkTimeMs: Date.now() - startTime,
  };
}

/**
 * Check AI-generated output for safety BEFORE displaying to the user.
 * Only uses blocklist (no moderation API to avoid double-charging for output).
 */
export function checkOutputSafety(text: string): ContentSafetyResult {
  const startTime = Date.now();
  const blocklistResult = checkBlocklist(text);

  const safe = blocklistResult.matchedTerms.length === 0;

  return {
    safe,
    matchedTerms: blocklistResult.matchedTerms,
    matchedCategories: blocklistResult.matchedCategories,
    moderationCategories: [],
    userMessage: safe ? undefined : CONTENT_BLOCKED_OUTPUT_MESSAGE,
    checkTimeMs: Date.now() - startTime,
  };
}
