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

interface ModerationResult {
  flaggedCategories: string[];
  /** True when the API returned a successful response (even if nothing flagged). */
  succeeded: boolean;
}

/**
 * Run OpenAI Moderation API on text content.
 * Returns flagged category names and whether the call succeeded.
 * On failure/timeout, `succeeded` is false so callers can decide policy.
 */
async function runModerationAPI(text: string): Promise<ModerationResult> {
  if (!isOpenAIConfigured()) {
    return { flaggedCategories: [], succeeded: false };
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
      return { flaggedCategories: [], succeeded: false };
    }

    const data = await response.json();
    const result = data.results?.[0];

    if (!result || !result.flagged) {
      return { flaggedCategories: [], succeeded: true };
    }

    const flagged: string[] = [];
    if (result.categories) {
      for (const [category, isFlagged] of Object.entries(result.categories)) {
        if (isFlagged) {
          flagged.push(category);
        }
      }
    }
    return { flaggedCategories: flagged, succeeded: true };
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === 'AbortError' || error.message.includes('abort'));
    if (isTimeout) {
      console.warn('Content moderation API timed out — skipping');
    } else {
      console.warn('Content moderation API error — skipping:', error);
    }
    return { flaggedCategories: [], succeeded: false };
  }
}

export interface CheckInputSafetyOptions {
  /**
   * When true, content is blocked if the moderation API fails (COPPA: US-006 U-6.6).
   * Users 13+ keep the existing fail-open behavior.
   */
  isUnder13?: boolean;
}

/**
 * Check user input for safety BEFORE sending to AI services.
 * Runs blocklist check + OpenAI Moderation API in parallel.
 *
 * For under-13 users, the moderation API failing causes content to be blocked
 * (fail-closed). Users 13+ keep the existing fail-open behavior.
 */
export async function checkInputSafety(
  text: string,
  options: CheckInputSafetyOptions = {},
): Promise<ContentSafetyResult> {
  const startTime = Date.now();

  // Run blocklist and moderation API in parallel
  const [blocklistResult, moderationResult] = await Promise.all([
    Promise.resolve(checkBlocklist(text)),
    runModerationAPI(text),
  ]);

  // For under-13 users, block content when moderation API fails (US-006: U-6.6)
  const moderationFailed = !moderationResult.succeeded;
  const failClosed = options.isUnder13 && moderationFailed;

  const safe =
    blocklistResult.matchedTerms.length === 0 &&
    moderationResult.flaggedCategories.length === 0 &&
    !failClosed;

  return {
    safe,
    matchedTerms: blocklistResult.matchedTerms,
    matchedCategories: blocklistResult.matchedCategories,
    moderationCategories: failClosed
      ? ['moderation_unavailable']
      : moderationResult.flaggedCategories,
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
