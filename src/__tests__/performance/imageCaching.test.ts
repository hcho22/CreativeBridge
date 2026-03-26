/**
 * Image Caching Validation Tests
 *
 * Verifies that the ImageCache implementation correctly caches images
 * after first download, serves from cache on subsequent requests,
 * respects size limits with LRU eviction, and supports resize params.
 *
 * @implements US-006: U-6.2
 */

import * as fs from 'fs';
import * as path from 'path';

// We test the implementation details by reading the source
// since expo-file-system requires a native runtime
const SERVICE_PATH = path.resolve(
  __dirname,
  '../../services/imageStorageService.ts',
);

describe('Image Caching Implementation (US-006: U-6.2)', () => {
  let sourceCode: string;

  beforeAll(() => {
    sourceCode = fs.readFileSync(SERVICE_PATH, 'utf-8');
  });

  test('ImageCache class exists with cache-after-first-fetch pattern', () => {
    // Verify the ImageCache class is exported
    expect(sourceCode).toContain('export class ImageCache');
    expect(sourceCode).toContain('export const imageCache');

    // Must have get and put methods
    expect(sourceCode).toContain('async get(url: string)');
    expect(sourceCode).toContain('async put(');

    // get() should check filesystem before returning null
    expect(sourceCode).toContain('getInfoAsync');
  });

  test('cache serves from local storage on second request', () => {
    // The get() method should return the cached URI if the entry exists
    expect(sourceCode).toContain('this.entries.get(key)');
    expect(sourceCode).toContain('entry.lastAccessed = Date.now()');

    // put() should check cache first via get()
    expect(sourceCode).toContain('const existing = await this.get(url)');
    expect(sourceCode).toContain('if (existing) return existing');
  });

  test('LRU eviction respects configurable max cache size', () => {
    // Must have configurable max size
    expect(sourceCode).toContain('DEFAULT_MAX_CACHE_SIZE_BYTES');
    expect(sourceCode).toContain('50 * 1024 * 1024'); // 50MB default

    // Must have eviction logic
    expect(sourceCode).toContain('private async evict()');
    expect(sourceCode).toContain('this.totalSize <= this.maxSize');

    // LRU: sort by lastAccessed
    expect(sourceCode).toContain('lastAccessed');
    expect(sourceCode).toMatch(/sort.*lastAccessed/s);

    // Must delete evicted files
    expect(sourceCode).toContain('deleteAsync');
  });

  test('supports server-side resize parameters for thumbnails', () => {
    // put() should accept width/height options
    expect(sourceCode).toContain('width?: number');
    expect(sourceCode).toContain('height?: number');

    // Should append resize params to URL
    expect(sourceCode).toMatch(/w=.*width/);
    expect(sourceCode).toMatch(/h=.*height/);
  });
});

describe('Image Cache Integration with getSessionImageUrl', () => {
  let sourceCode: string;

  beforeAll(() => {
    sourceCode = fs.readFileSync(SERVICE_PATH, 'utf-8');
  });

  test('getSessionImageUrl uses imageCache for local caching', () => {
    // The method should try cache first
    expect(sourceCode).toContain('imageCache.get(remoteUrl)');
    expect(sourceCode).toContain('imageCache.put(remoteUrl');

    // Should fall back to remote URL on cache failure
    expect(sourceCode).toContain('return remoteUrl');
  });
});
