/**
 * L-01: Embedding Reversibility Risk Documentation Test
 *
 * Verifies the embedding model used (text-embedding-3-small, 1536 dims)
 * and documents that storyElements stores the original text alongside
 * the vector — an information-leakage surface if the DB is compromised.
 *
 * @finding L-01: Embedding vectors stored alongside source text
 * @status Informational — documents theoretical risk
 */

import { readSourceFile } from '../../security/coppa/helpers';

describe('L-01: Embedding reversibility risk', () => {
  let embeddingServiceSource: string;
  let schemaSource: string;

  beforeAll(() => {
    embeddingServiceSource = readSourceFile(
      'src/services/embeddingGenerationService.ts',
    );
    schemaSource = readSourceFile('convex/schema.ts');
  });

  test('[L-01] Embedding model is text-embedding-3-small (1536 dimensions)', () => {
    // Verify the model constant
    expect(embeddingServiceSource).toMatch(
      /EMBEDDING_MODEL\s*=\s*['"]text-embedding-3-small['"]/,
    );

    // Verify 1536 dimensions are documented
    expect(embeddingServiceSource).toMatch(/1536/);
  });

  test('[L-01] storyElements schema stores elementText alongside embeddingVector', () => {
    // The storyElements table should have both fields
    // This documents the co-location of original text + vector (the risk surface)
    expect(schemaSource).toMatch(/elementText:\s*v\.string\(\)/);
    expect(schemaSource).toMatch(/embeddingVector:\s*v\.optional/);
  });

  test('[L-01] Theoretical reversibility risk documented (informational)', () => {
    // This test documents the known risk without asserting a fix:
    // - Embeddings from text-embedding-3-small cannot be trivially reversed
    //   to recover original text, but nearest-neighbor attacks against known
    //   corpora can approximate the input.
    // - The larger risk is that elementText is stored in plaintext alongside
    //   the vector, making DB compromise a direct PII exposure path.
    //
    // Mitigation options (not yet implemented):
    // 1. Store only the embedding vector, not the source text
    // 2. Encrypt elementText at rest
    // 3. Truncate/hash elementText after embedding generation

    // Assert the risk surface exists (both fields on same table)
    const storyElementsBlock = schemaSource.match(
      /storyElements:\s*defineTable\(\{[\s\S]*?\}\)/,
    );
    expect(storyElementsBlock).not.toBeNull();
    expect(storyElementsBlock![0]).toContain('elementText');
    expect(storyElementsBlock![0]).toContain('embeddingVector');
  });
});
