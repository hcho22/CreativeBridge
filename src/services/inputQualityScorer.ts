/**
 * Input Quality Scorer
 *
 * Lightweight, synchronous, deterministic quality assessment for user story contributions.
 * Used to scale XP rewards (completion and speed bonuses) based on input quality.
 *
 * Four quality signals (equal weight):
 * 1. Word count — average words per turn vs grade-level minimum
 * 2. Vocabulary diversity — unique words / total words
 * 3. Sentence structure — % of contributions containing sentences
 * 4. Coherence — word overlap between consecutive contributions
 */

import { GradeLevel } from '../types/database';
import { QUALITY_THRESHOLDS } from '../types/challenges';

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'is',
  'it',
  'was',
  'be',
  'are',
  'were',
  'been',
  'has',
  'had',
  'do',
  'did',
  'i',
  'he',
  'she',
  'they',
  'we',
  'you',
  'my',
  'his',
  'her',
  'its',
  'our',
  'with',
  'that',
  'this',
  'from',
  'not',
  'so',
  'if',
  'then',
  'than',
  'up',
  'out',
]);

/**
 * Extract words from text, lowercased and filtered to non-empty.
 */
function getWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0);
}

/**
 * Score based on average words per user contribution vs grade-level expectation.
 * Returns 0.0 to 1.0.
 */
function scoreWordCount(
  contributions: string[],
  gradeLevel: GradeLevel,
): number {
  if (contributions.length === 0) return 0;

  const totalWords = contributions.reduce(
    (sum, c) => sum + getWords(c).length,
    0,
  );
  const avgWords = totalWords / contributions.length;
  const expected =
    QUALITY_THRESHOLDS.MIN_WORDS_PER_TURN[gradeLevel] ??
    QUALITY_THRESHOLDS.MIN_WORDS_PER_TURN['3-5'];

  return Math.min(1.0, avgWords / expected);
}

/**
 * Score based on vocabulary diversity (type-token ratio).
 * Only meaningful when total words >= 10; below that returns 0.0.
 * Returns 0.0 to 1.0.
 */
function scoreVocabularyDiversity(contributions: string[]): number {
  const allWords = contributions.flatMap(c => getWords(c));
  if (allWords.length < 10) return 0;

  const uniqueWords = new Set(allWords).size;
  return Math.min(1.0, uniqueWords / allWords.length);
}

/**
 * Score based on proportion of contributions that contain sentence-like structure.
 * A "sentence" is defined as:
 * - Text with 3+ words ending with terminal punctuation (. ! ?)
 * - OR text with 5+ words (implicit sentence, appropriate for younger grades)
 * Returns 0.0 to 1.0.
 */
function scoreSentenceStructure(contributions: string[]): number {
  if (contributions.length === 0) return 0;

  const hasSentence = (text: string): boolean => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return false;

    const words = getWords(trimmed);
    if (words.length >= 5) return true;
    if (words.length >= 3 && /[.!?]/.test(trimmed)) return true;

    return false;
  };

  const sentenceCount = contributions.filter(c => hasSentence(c)).length;
  return sentenceCount / contributions.length;
}

/**
 * Score based on word overlap between consecutive user contributions,
 * ignoring stopwords. Measures narrative continuity.
 * Returns 0.0 to 1.0.
 */
function scoreCoherence(contributions: string[]): number {
  if (contributions.length < 2) {
    // Single contribution — fall back to sentence structure as proxy
    return scoreSentenceStructure(contributions);
  }

  let totalOverlap = 0;
  let pairs = 0;

  for (let i = 0; i < contributions.length - 1; i++) {
    const wordsA = new Set(
      getWords(contributions[i]).filter(w => !STOPWORDS.has(w)),
    );
    const wordsB = new Set(
      getWords(contributions[i + 1]).filter(w => !STOPWORDS.has(w)),
    );

    if (wordsA.size === 0 || wordsB.size === 0) {
      pairs++;
      continue;
    }

    let overlap = 0;
    for (const word of wordsB) {
      if (wordsA.has(word)) overlap++;
    }

    const maxPossible = Math.min(wordsA.size, wordsB.size);
    totalOverlap += overlap / maxPossible;
    pairs++;
  }

  return pairs > 0 ? totalOverlap / pairs : 0;
}

/**
 * Compute overall input quality score from user contributions.
 *
 * @param userContributions - Array of user-authored text contributions (not AI text)
 * @param gradeLevel - Grade level for word count expectations (defaults to '3-5')
 * @returns Quality score from 0.0 to 1.0
 */
export function scoreInputQuality(
  userContributions: string[],
  gradeLevel?: GradeLevel,
): number {
  const grade = gradeLevel ?? '3-5';

  // Filter out empty contributions for scoring
  const nonEmpty = userContributions.filter(c => c.trim().length > 0);

  if (nonEmpty.length === 0) return 0;

  // Compute individual signals
  const wordCountScore = scoreWordCount(nonEmpty, grade);
  const diversityScore = scoreVocabularyDiversity(nonEmpty);
  const sentenceScore = scoreSentenceStructure(nonEmpty);
  const coherenceScore = scoreCoherence(nonEmpty);

  // Weighted average (equal weights)
  let finalScore =
    wordCountScore * 0.25 +
    diversityScore * 0.25 +
    sentenceScore * 0.25 +
    coherenceScore * 0.25;

  const totalWords = nonEmpty.reduce((sum, c) => sum + getWords(c).length, 0);

  // Floor rule: if total user words < MIN_TOTAL_WORDS, cap at 0.2
  if (totalWords < QUALITY_THRESHOLDS.MIN_TOTAL_WORDS) {
    finalScore = Math.min(finalScore, 0.2);
  }

  // Diversity penalty: if vocabulary diversity is extremely low (< 0.15)
  // but we have enough words to measure it, cap the score at 0.3.
  // This catches repeated-word gaming (e.g., "cat cat cat cat cat").
  if (totalWords >= 10 && diversityScore < 0.15) {
    finalScore = Math.min(finalScore, 0.3);
  }

  return Math.round(finalScore * 100) / 100; // Round to 2 decimal places
}
