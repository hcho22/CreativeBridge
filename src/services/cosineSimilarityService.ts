/**
 * Cosine Similarity Service
 *
 * Calculates semantic similarity between embedding vectors using cosine similarity.
 * Used to detect story element repetition by comparing new elements against recent history.
 *
 * Part of the Story Diversity Tracking System (US-004)
 */

/**
 * Calculate the cosine similarity between two embedding vectors
 *
 * Cosine similarity formula: cos(θ) = (A · B) / (||A|| × ||B||)
 * Where:
 * - A · B is the dot product of vectors A and B
 * - ||A|| is the magnitude (L2 norm) of vector A
 * - ||B|| is the magnitude (L2 norm) of vector B
 *
 * Returns:
 * - 1.0 for identical vectors (same direction)
 * - 0.0 for orthogonal vectors (perpendicular)
 * - -1.0 for opposite vectors (rare in embedding space)
 *
 * @param vectorA - First embedding vector
 * @param vectorB - Second embedding vector
 * @returns Similarity score between -1.0 and 1.0 (typically 0.0 to 1.0 for embeddings)
 *
 * @throws {Error} If vectors have different lengths
 * @throws {Error} If either vector is empty
 *
 * @example
 * const embedding1 = [0.5, 0.5, 0.5];
 * const embedding2 = [0.5, 0.5, 0.5];
 * const similarity = calculateCosineSimilarity(embedding1, embedding2);
 * console.log(similarity); // 1.0 (identical)
 *
 * @example
 * const embedding1 = [1, 0, 0];
 * const embedding2 = [0, 1, 0];
 * const similarity = calculateCosineSimilarity(embedding1, embedding2);
 * console.log(similarity); // 0.0 (orthogonal)
 */
export function calculateCosineSimilarity(
  vectorA: number[],
  vectorB: number[],
): number {
  // Edge case: Empty vectors
  if (vectorA.length === 0 || vectorB.length === 0) {
    throw new Error(
      'Cannot calculate cosine similarity: one or both vectors are empty',
    );
  }

  // Edge case: Different length vectors
  if (vectorA.length !== vectorB.length) {
    throw new Error(
      `Cannot calculate cosine similarity: vectors have different lengths (${vectorA.length} vs ${vectorB.length})`,
    );
  }

  // Calculate dot product: A · B = Σ(a_i × b_i)
  let dotProduct = 0;
  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
  }

  // Calculate magnitude (L2 norm) of vector A: ||A|| = sqrt(Σ(a_i²))
  let magnitudeA = 0;
  for (let i = 0; i < vectorA.length; i++) {
    magnitudeA += vectorA[i] * vectorA[i];
  }
  magnitudeA = Math.sqrt(magnitudeA);

  // Calculate magnitude (L2 norm) of vector B: ||B|| = sqrt(Σ(b_i²))
  let magnitudeB = 0;
  for (let i = 0; i < vectorB.length; i++) {
    magnitudeB += vectorB[i] * vectorB[i];
  }
  magnitudeB = Math.sqrt(magnitudeB);

  // Edge case: Zero vectors (magnitude = 0)
  // Mathematically undefined, but we return 0.0 to indicate no similarity
  if (magnitudeA === 0 || magnitudeB === 0) {
    console.warn(
      'Cosine similarity calculation: one or both vectors have zero magnitude, returning 0.0',
    );
    return 0.0;
  }

  // Calculate cosine similarity: cos(θ) = (A · B) / (||A|| × ||B||)
  const similarity = dotProduct / (magnitudeA * magnitudeB);

  // Clamp to [-1, 1] to handle floating-point precision errors
  // (Theoretically should always be in this range, but floating-point arithmetic can produce values like 1.0000000000000002)
  return Math.max(-1, Math.min(1, similarity));
}

/**
 * Find the most similar vector from a list of candidate vectors
 *
 * @param queryVector - The vector to compare against
 * @param candidateVectors - Array of vectors to search
 * @returns Object with the most similar vector's index and similarity score, or null if no candidates
 *
 * @example
 * const query = [0.5, 0.5, 0.5];
 * const candidates = [[0.4, 0.4, 0.4], [0.1, 0.9, 0.1], [0.5, 0.5, 0.5]];
 * const result = findMostSimilarVector(query, candidates);
 * console.log(result); // { index: 2, similarity: 1.0 }
 */
export function findMostSimilarVector(
  queryVector: number[],
  candidateVectors: number[][],
): { index: number; similarity: number } | null {
  if (candidateVectors.length === 0) {
    return null;
  }

  let maxSimilarity = -Infinity;
  let maxIndex = -1;

  for (let i = 0; i < candidateVectors.length; i++) {
    try {
      const similarity = calculateCosineSimilarity(
        queryVector,
        candidateVectors[i],
      );
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        maxIndex = i;
      }
    } catch (error) {
      // Skip vectors that can't be compared (different dimensions, etc.)
      console.warn(
        `Skipping candidate vector at index ${i} due to error:`,
        error,
      );
      continue;
    }
  }

  if (maxIndex === -1) {
    return null;
  }

  return { index: maxIndex, similarity: maxSimilarity };
}

/**
 * Batch calculate similarities between a query vector and multiple candidate vectors
 *
 * @param queryVector - The vector to compare against
 * @param candidateVectors - Array of vectors to compare
 * @returns Array of similarity scores in the same order as candidateVectors
 *
 * @example
 * const query = [0.5, 0.5, 0.5];
 * const candidates = [[0.4, 0.4, 0.4], [0.1, 0.9, 0.1], [0.5, 0.5, 0.5]];
 * const similarities = batchCalculateSimilarity(query, candidates);
 * console.log(similarities); // [0.9999..., 0.577..., 1.0]
 */
export function batchCalculateSimilarity(
  queryVector: number[],
  candidateVectors: number[][],
): number[] {
  return candidateVectors.map((candidate, index) => {
    try {
      return calculateCosineSimilarity(queryVector, candidate);
    } catch (error) {
      console.warn(
        `Failed to calculate similarity for candidate at index ${index}:`,
        error,
      );
      return 0.0; // Return 0 similarity for invalid vectors
    }
  });
}

/**
 * Check if two vectors are semantically similar based on a threshold
 *
 * @param vectorA - First embedding vector
 * @param vectorB - Second embedding vector
 * @param threshold - Similarity threshold (default: 0.75)
 * @returns true if similarity >= threshold, false otherwise
 *
 * @example
 * const embedding1 = [0.5, 0.5, 0.5];
 * const embedding2 = [0.51, 0.51, 0.51];
 * const similar = areSimilar(embedding1, embedding2, 0.9);
 * console.log(similar); // true
 */
export function areSimilar(
  vectorA: number[],
  vectorB: number[],
  threshold: number = 0.75,
): boolean {
  try {
    const similarity = calculateCosineSimilarity(vectorA, vectorB);
    return similarity >= threshold;
  } catch (error) {
    console.warn('Error checking vector similarity:', error);
    return false;
  }
}
