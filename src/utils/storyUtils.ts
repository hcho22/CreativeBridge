/**
 * Story utility functions for CreativeBridge
 * Provides helper functions for story content manipulation
 */

import { StorySession } from '../services/storySessionManager';

/**
 * Extracts the latest continuation from story content
 *
 * This function attempts to extract only the most recent continuation/contribution
 * from the story. It uses the following strategy:
 * 1. If a StorySession with contributions array is provided, uses the last contribution
 * 2. Otherwise, extracts the last sentence(s) from the story content string
 *
 * @param storyContent - The full story content string
 * @param session - Optional StorySession object with contributions array
 * @returns The latest continuation text, or empty string if story is empty
 *
 * @example
 * // With contributions array
 * const latest = extractLatestContinuation(fullStory, session);
 *
 * // Without contributions (fallback to string parsing)
 * const latest = extractLatestContinuation(fullStory);
 */
export function extractLatestContinuation(
  storyContent: string | null | undefined,
  session?: StorySession | null,
): string {
  // Handle null/undefined/empty cases
  if (!storyContent || !storyContent.trim()) {
    return '';
  }

  // Strategy 1: Use contributions array if available
  // This is the most accurate method since contributions track individual additions
  if (session?.contributions && session.contributions.length > 0) {
    const lastContribution =
      session.contributions[session.contributions.length - 1];
    if (lastContribution?.content?.trim()) {
      return lastContribution.content.trim();
    }
  }

  // Strategy 2: Extract last sentence(s) from story content string
  // This is a fallback when contributions array is not available
  const trimmedContent = storyContent.trim();

  // Split by sentence endings (period, exclamation, question mark)
  // This regex matches sentence endings followed by whitespace or end of string
  // We'll use a different approach to preserve punctuation
  const sentencePattern = /([^.!?]*[.!?]+)/g;
  const sentences: string[] = [];
  let match;

  // Extract sentences with their punctuation
  while ((match = sentencePattern.exec(trimmedContent)) !== null) {
    const sentence = match[1].trim();
    if (sentence) {
      sentences.push(sentence);
    }
  }

  // If no sentences found with pattern, try simpler approach
  if (sentences.length === 0) {
    // Try splitting by sentence endings and reconstruct
    const simpleSplit = trimmedContent.split(/([.!?]+\s*)/);
    const reconstructed: string[] = [];

    for (let i = 0; i < simpleSplit.length; i += 2) {
      const text = simpleSplit[i]?.trim();
      const punctuation = simpleSplit[i + 1]?.trim();
      if (text) {
        reconstructed.push(text + (punctuation || ''));
      }
    }

    if (reconstructed.length > 0) {
      sentences.push(...reconstructed);
    }
  }

  // If still no sentences, return the whole content
  if (sentences.length === 0) {
    return trimmedContent;
  }

  if (sentences.length === 1) {
    // Single sentence/continuation, return it
    return sentences[0];
  }

  // Multiple sentences - extract the last one
  // This assumes the latest continuation is the last sentence
  const lastSentence = sentences[sentences.length - 1];

  // If the last sentence is very short (likely incomplete),
  // try to get the last 2-3 sentences as a continuation
  if (lastSentence.length < 20 && sentences.length > 1) {
    // Get last 2-3 sentences for context
    const lastFewSentences = sentences.slice(-3).join(' ').trim();
    return lastFewSentences;
  }

  return lastSentence;
}

/**
 * Extracts the latest continuation using a more sophisticated approach
 * that considers paragraph boundaries and sentence groups
 *
 * @param storyContent - The full story content string
 * @param session - Optional StorySession object with contributions array
 * @returns The latest continuation text
 */
export function extractLatestContinuationAdvanced(
  storyContent: string | null | undefined,
  session?: StorySession | null,
): string {
  // Handle null/undefined/empty cases
  if (!storyContent || !storyContent.trim()) {
    return '';
  }

  // Strategy 1: Use contributions array if available (most accurate)
  if (session?.contributions && session.contributions.length > 0) {
    const lastContribution =
      session.contributions[session.contributions.length - 1];
    if (lastContribution?.content?.trim()) {
      return lastContribution.content.trim();
    }
  }

  const trimmedContent = storyContent.trim();

  // Strategy 2: Try to identify paragraph boundaries first
  // Double newlines or multiple spaces might indicate paragraph breaks
  const paragraphs = trimmedContent
    .split(/\n\s*\n|\s{3,}/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (paragraphs.length > 0) {
    // Return the last paragraph as the latest continuation
    return paragraphs[paragraphs.length - 1];
  }

  // Strategy 3: Fall back to sentence extraction
  return extractLatestContinuation(storyContent, session);
}

/**
 * Counts the number of sentences in story content
 *
 * @param storyContent - The story content string
 * @returns Number of sentences
 */
export function countSentences(
  storyContent: string | null | undefined,
): number {
  if (!storyContent || !storyContent.trim()) {
    return 0;
  }

  const sentenceEndings = /[.!?]+(?:\s+|$)/g;
  const sentences = storyContent.split(sentenceEndings).filter(s => s.trim());
  return sentences.length;
}

/**
 * Gets the word count of the latest continuation
 *
 * @param storyContent - The full story content string
 * @param session - Optional StorySession object
 * @returns Word count of the latest continuation
 */
export function getLatestContinuationWordCount(
  storyContent: string | null | undefined,
  session?: StorySession | null,
): number {
  const latest = extractLatestContinuation(storyContent, session);
  if (!latest) return 0;

  const words = latest
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0);
  return words.length;
}
