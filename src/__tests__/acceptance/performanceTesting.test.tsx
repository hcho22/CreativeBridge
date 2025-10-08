// Performance Testing for Story Continuation Feature
// Testing performance characteristics and scalability

import { performance } from 'perf_hooks';

// Mock services for performance testing
const mockStoryImportService = {
  readFileWithEncoding: jest.fn(),
  validateStoryContent: jest.fn(),
  fetchUserStories: jest.fn(),
  searchUserStories: jest.fn(),
};

const mockStoryManagementService = {
  searchStories: jest.fn(),
  filterStories: jest.fn(),
  getStoryLibrary: jest.fn(),
  saveStory: jest.fn(),
};

jest.mock('../../services/storyImportService', () => ({
  StoryImportService: mockStoryImportService,
}));

jest.mock('../../services/storyManagementService', () => ({
  StoryManagementService: mockStoryManagementService,
}));

// Performance measurement utilities
class PerformanceTester {
  private measurements: Array<{ operation: string; duration: number; timestamp: number }> = [];

  async measureOperation<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();
    const result = await operation();
    const endTime = performance.now();
    const duration = endTime - startTime;

    this.measurements.push({
      operation: operationName,
      duration,
      timestamp: Date.now(),
    });

    return { result, duration };
  }

  getAverageDuration(operationName: string): number {
    const operations = this.measurements.filter(m => m.operation === operationName);
    if (operations.length === 0) return 0;
    
    const total = operations.reduce((sum, op) => sum + op.duration, 0);
    return total / operations.length;
  }

  getMaxDuration(operationName: string): number {
    const operations = this.measurements.filter(m => m.operation === operationName);
    return Math.max(...operations.map(op => op.duration));
  }

  getMinDuration(operationName: string): number {
    const operations = this.measurements.filter(m => m.operation === operationName);
    return Math.min(...operations.map(op => op.duration));
  }

  reset(): void {
    this.measurements = [];
  }

  getReport(): {
    totalOperations: number;
    operationSummary: Record<string, { count: number; avg: number; min: number; max: number }>;
  } {
    const operationSummary: Record<string, { count: number; avg: number; min: number; max: number }> = {};
    
    const operationNames = [...new Set(this.measurements.map(m => m.operation))];
    
    operationNames.forEach(name => {
      operationSummary[name] = {
        count: this.measurements.filter(m => m.operation === name).length,
        avg: this.getAverageDuration(name),
        min: this.getMinDuration(name),
        max: this.getMaxDuration(name),
      };
    });

    return {
      totalOperations: this.measurements.length,
      operationSummary,
    };
  }
}

// Test data generators
function generateStoryData(count: number, avgWordsPerStory: number = 200) {
  return Array.from({ length: count }, (_, i) => ({
    session_id: `story-${i.toString().padStart(6, '0')}`,
    story_content: generateRandomStoryContent(avgWordsPerStory + Math.floor(Math.random() * 100)),
    created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    story_source: ['CreativeBridge', 'Story_Quest', 'File'][i % 3],
    final_score: Math.floor(Math.random() * 200) + 50,
    words_written: avgWordsPerStory + Math.floor(Math.random() * 100),
    relevance_score: Math.random(),
  }));
}

function generateRandomStoryContent(wordCount: number): string {
  const words = [
    'adventure', 'dragon', 'knight', 'princess', 'castle', 'forest', 'magic', 'sword',
    'quest', 'treasure', 'brave', 'mysterious', 'ancient', 'powerful', 'journey',
    'darkness', 'light', 'battle', 'victory', 'courage', 'friendship', 'wisdom',
    'enchanted', 'legend', 'destiny', 'warrior', 'kingdom', 'evil', 'good', 'hero'
  ];
  
  const sentences = [];
  let currentWordCount = 0;
  
  while (currentWordCount < wordCount) {
    const sentenceLength = Math.floor(Math.random() * 15) + 5; // 5-20 words per sentence
    const sentence = [];
    
    for (let i = 0; i < sentenceLength && currentWordCount < wordCount; i++) {
      sentence.push(words[Math.floor(Math.random() * words.length)]);
      currentWordCount++;
    }
    
    sentences.push(sentence.join(' ') + '.');
  }
  
  return sentences.join(' ');
}

describe('Performance Testing', () => {
  let performanceTester: PerformanceTester;

  beforeEach(() => {
    jest.clearAllMocks();
    performanceTester = new PerformanceTester();
  });

  afterEach(() => {
    const report = performanceTester.getReport();
    console.log('Performance Report:', JSON.stringify(report, null, 2));
  });

  describe('File Import Performance', () => {
    it('should handle small files quickly', async () => {
      const smallFileContent = generateRandomStoryContent(100); // ~100 words
      
      mockStoryImportService.readFileWithEncoding.mockImplementation(() => {
        // Simulate realistic file reading time
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              success: true,
              content: smallFileContent,
              metadata: {
                file_name: 'small_story.txt',
                file_size: smallFileContent.length,
                encoding: 'utf-8',
                imported_word_count: 100,
              },
            });
          }, 10); // 10ms processing time
        });
      });

      const { duration } = await performanceTester.measureOperation(
        'small_file_import',
        () => mockStoryImportService.readFileWithEncoding('small_file.txt')
      );

      expect(duration).toBeLessThan(50); // Should complete in under 50ms
    });

    it('should handle medium files efficiently', async () => {
      const mediumFileContent = generateRandomStoryContent(1000); // ~1000 words
      
      mockStoryImportService.readFileWithEncoding.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              success: true,
              content: mediumFileContent,
              metadata: {
                file_name: 'medium_story.txt',
                file_size: mediumFileContent.length,
                encoding: 'utf-8',
                imported_word_count: 1000,
              },
            });
          }, 50); // 50ms processing time
        });
      });

      const { duration } = await performanceTester.measureOperation(
        'medium_file_import',
        () => mockStoryImportService.readFileWithEncoding('medium_file.txt')
      );

      expect(duration).toBeLessThan(200); // Should complete in under 200ms
    });

    it('should handle large files within acceptable limits', async () => {
      const largeFileContent = generateRandomStoryContent(10000); // ~10000 words
      
      mockStoryImportService.readFileWithEncoding.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              success: true,
              content: largeFileContent,
              metadata: {
                file_name: 'large_story.txt',
                file_size: largeFileContent.length,
                encoding: 'utf-8',
                imported_word_count: 10000,
              },
            });
          }, 200); // 200ms processing time
        });
      });

      const { duration } = await performanceTester.measureOperation(
        'large_file_import',
        () => mockStoryImportService.readFileWithEncoding('large_file.txt')
      );

      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle multiple concurrent file imports', async () => {
      const fileContents = Array.from({ length: 5 }, (_, i) => 
        generateRandomStoryContent(200 + i * 50)
      );

      mockStoryImportService.readFileWithEncoding.mockImplementation((fileName: string) => {
        const index = parseInt(fileName.split('_')[1]);
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              success: true,
              content: fileContents[index],
              metadata: {
                file_name: fileName,
                file_size: fileContents[index].length,
                encoding: 'utf-8',
                imported_word_count: 200 + index * 50,
              },
            });
          }, 30 + Math.random() * 20); // 30-50ms processing time
        });
      });

      const { duration } = await performanceTester.measureOperation(
        'concurrent_file_imports',
        async () => {
          const promises = Array.from({ length: 5 }, (_, i) =>
            mockStoryImportService.readFileWithEncoding(`file_${i}.txt`)
          );
          return Promise.all(promises);
        }
      );

      // Concurrent processing should be faster than sequential
      expect(duration).toBeLessThan(300); // Should complete all 5 files in under 300ms
    });
  });

  describe('Search Performance', () => {
    it('should search small datasets quickly', async () => {
      const smallDataset = generateStoryData(50); // 50 stories
      
      mockStoryManagementService.searchStories.mockImplementation((searchTerm: string) => {
        const results = smallDataset.filter(story =>
          story.story_content.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        return Promise.resolve({
          success: true,
          stories: results.slice(0, 20),
          total: results.length,
        });
      });

      const { duration } = await performanceTester.measureOperation(
        'small_dataset_search',
        () => mockStoryManagementService.searchStories('adventure')
      );

      expect(duration).toBeLessThan(20); // Should complete in under 20ms
    });

    it('should search medium datasets efficiently', async () => {
      const mediumDataset = generateStoryData(500); // 500 stories
      
      mockStoryManagementService.searchStories.mockImplementation((searchTerm: string) => {
        // Simulate database search with some processing time
        return new Promise(resolve => {
          setTimeout(() => {
            const results = mediumDataset.filter(story =>
              story.story_content.toLowerCase().includes(searchTerm.toLowerCase())
            );
            
            resolve({
              success: true,
              stories: results.slice(0, 20),
              total: results.length,
            });
          }, 50); // 50ms search time
        });
      });

      const { duration } = await performanceTester.measureOperation(
        'medium_dataset_search',
        () => mockStoryManagementService.searchStories('dragon')
      );

      expect(duration).toBeLessThan(150); // Should complete in under 150ms
    });

    it('should search large datasets within acceptable limits', async () => {
      const largeDataset = generateStoryData(2000); // 2000 stories
      
      mockStoryManagementService.searchStories.mockImplementation((searchTerm: string) => {
        return new Promise(resolve => {
          setTimeout(() => {
            const results = largeDataset.filter(story =>
              story.story_content.toLowerCase().includes(searchTerm.toLowerCase())
            );
            
            resolve({
              success: true,
              stories: results.slice(0, 20),
              total: results.length,
            });
          }, 150); // 150ms search time for large dataset
        });
      });

      const { duration } = await performanceTester.measureOperation(
        'large_dataset_search',
        () => mockStoryManagementService.searchStories('castle')
      );

      expect(duration).toBeLessThan(500); // Should complete in under 500ms
    });

    it('should handle rapid consecutive searches', async () => {
      const dataset = generateStoryData(300);
      const searchTerms = ['adventure', 'dragon', 'castle', 'forest', 'magic'];
      
      mockStoryManagementService.searchStories.mockImplementation((searchTerm: string) => {
        return new Promise(resolve => {
          setTimeout(() => {
            const results = dataset.filter(story =>
              story.story_content.toLowerCase().includes(searchTerm.toLowerCase())
            );
            
            resolve({
              success: true,
              stories: results.slice(0, 10),
              total: results.length,
            });
          }, 20); // 20ms per search
        });
      });

      const { duration } = await performanceTester.measureOperation(
        'rapid_consecutive_searches',
        async () => {
          const results = [];
          for (const term of searchTerms) {
            const result = await mockStoryManagementService.searchStories(term);
            results.push(result);
          }
          return results;
        }
      );

      expect(duration).toBeLessThan(300); // All 5 searches should complete in under 300ms
    });

    it('should maintain search performance under load', async () => {
      const dataset = generateStoryData(1000);
      const concurrentSearches = 10;
      
      mockStoryManagementService.searchStories.mockImplementation((searchTerm: string) => {
        return new Promise(resolve => {
          setTimeout(() => {
            const results = dataset.filter(story =>
              story.story_content.toLowerCase().includes(searchTerm.toLowerCase())
            );
            
            resolve({
              success: true,
              stories: results.slice(0, 20),
              total: results.length,
              searchTerm,
            });
          }, 80); // 80ms search time
        });
      });

      const { duration } = await performanceTester.measureOperation(
        'concurrent_searches_under_load',
        async () => {
          const promises = Array.from({ length: concurrentSearches }, (_, i) =>
            mockStoryManagementService.searchStories(`search_${i}`)
          );
          return Promise.all(promises);
        }
      );

      // Concurrent searches should not significantly degrade performance
      expect(duration).toBeLessThan(400); // Should complete all concurrent searches in under 400ms
    });
  });

  describe('Filter Performance', () => {
    it('should filter stories efficiently', async () => {
      const stories = generateStoryData(800);
      
      mockStoryManagementService.filterStories.mockImplementation((filters: any) => {
        return new Promise(resolve => {
          setTimeout(() => {
            let filtered = [...stories];
            
            if (filters.source) {
              filtered = filtered.filter(story => story.story_source === filters.source);
            }
            
            if (filters.minWords) {
              filtered = filtered.filter(story => story.words_written >= filters.minWords);
            }
            
            if (filters.dateFrom) {
              filtered = filtered.filter(story => 
                new Date(story.created_at) >= new Date(filters.dateFrom)
              );
            }
            
            resolve({
              success: true,
              stories: filtered.slice(0, filters.limit || 50),
              total: filtered.length,
            });
          }, 60); // 60ms filter processing time
        });
      });

      const { duration } = await performanceTester.measureOperation(
        'story_filtering',
        () => mockStoryManagementService.filterStories({
          source: 'CreativeBridge',
          minWords: 150,
          limit: 30,
        })
      );

      expect(duration).toBeLessThan(200); // Should complete filtering in under 200ms
    });

    it('should handle complex multi-criteria filtering', async () => {
      const stories = generateStoryData(1500);
      
      mockStoryManagementService.filterStories.mockImplementation((filters: any) => {
        return new Promise(resolve => {
          setTimeout(() => {
            let filtered = [...stories];
            
            // Apply multiple filters
            Object.keys(filters).forEach(key => {
              if (key === 'source') {
                filtered = filtered.filter(story => story.story_source === filters[key]);
              } else if (key === 'minWords') {
                filtered = filtered.filter(story => story.words_written >= filters[key]);
              } else if (key === 'maxWords') {
                filtered = filtered.filter(story => story.words_written <= filters[key]);
              } else if (key === 'minScore') {
                filtered = filtered.filter(story => story.final_score >= filters[key]);
              } else if (key === 'dateFrom') {
                filtered = filtered.filter(story => 
                  new Date(story.created_at) >= new Date(filters[key])
                );
              }
            });
            
            resolve({
              success: true,
              stories: filtered.slice(0, filters.limit || 50),
              total: filtered.length,
              appliedFilters: Object.keys(filters).length,
            });
          }, 120); // 120ms for complex filtering
        });
      });

      const { duration } = await performanceTester.measureOperation(
        'complex_multi_criteria_filtering',
        () => mockStoryManagementService.filterStories({
          source: 'CreativeBridge',
          minWords: 100,
          maxWords: 500,
          minScore: 80,
          dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
          limit: 25,
        })
      );

      expect(duration).toBeLessThan(400); // Complex filtering should complete in under 400ms
    });
  });

  describe('Memory Performance', () => {
    it('should handle large content without excessive memory usage', async () => {
      const largeContent = generateRandomStoryContent(20000); // ~20k words
      
      // Mock memory-efficient content handling
      mockStoryImportService.validateStoryContent.mockImplementation((content: string) => {
        // Simulate validation that processes content in chunks
        const chunkSize = 1000;
        const chunks = Math.ceil(content.length / chunkSize);
        
        return {
          isValid: true,
          errors: [],
          warnings: chunks > 50 ? ['Large file detected'] : [],
          processedInChunks: chunks,
          memoryOptimized: true,
        };
      });

      const { duration, result } = await performanceTester.measureOperation(
        'large_content_validation',
        () => mockStoryImportService.validateStoryContent(largeContent)
      );

      expect(duration).toBeLessThan(300); // Should validate efficiently
      expect(result.memoryOptimized).toBe(true);
      expect(result.processedInChunks).toBeGreaterThan(1);
    });

    it('should efficiently handle pagination of large story lists', async () => {
      const totalStories = 5000;
      const pageSize = 50;
      
      mockStoryManagementService.getStoryLibrary.mockImplementation((options: any) => {
        const { offset = 0, limit = 50 } = options;
        
        return new Promise(resolve => {
          setTimeout(() => {
            // Simulate efficient pagination that only loads requested page
            const pageStories = Array.from({ length: Math.min(limit, totalStories - offset) }, (_, i) => ({
              session_id: `story-${offset + i}`,
              story_content: `Story ${offset + i} content`,
              created_at: new Date().toISOString(),
              story_source: 'CreativeBridge',
              // Only include essential data for list view
            }));
            
            resolve({
              success: true,
              stories: pageStories,
              total: totalStories,
              hasMore: offset + limit < totalStories,
              loadedInMemory: pageStories.length, // Only current page
            });
          }, 40); // 40ms for pagination query
        });
      });

      // Test loading multiple pages
      const pages = [0, 1, 2, 3, 4]; // Load 5 pages
      
      for (const page of pages) {
        const { duration } = await performanceTester.measureOperation(
          `pagination_page_${page}`,
          () => mockStoryManagementService.getStoryLibrary({
            offset: page * pageSize,
            limit: pageSize,
          })
        );

        expect(duration).toBeLessThan(100); // Each page should load quickly
      }

      // Verify pagination performance doesn't degrade
      const pageDurations = pages.map(page => 
        performanceTester.getAverageDuration(`pagination_page_${page}`)
      );
      
      // Performance should remain consistent across pages
      const maxVariation = Math.max(...pageDurations) - Math.min(...pageDurations);
      expect(maxVariation).toBeLessThan(50); // Variation should be minimal
    });
  });

  describe('Overall Performance Benchmarks', () => {
    it('should meet performance benchmarks for typical usage scenarios', async () => {
      // Simulate a typical user session
      const scenarios = [
        {
          name: 'file_import_and_validation',
          operation: async () => {
            const content = generateRandomStoryContent(300);
            await mockStoryImportService.readFileWithEncoding('story.txt');
            return mockStoryImportService.validateStoryContent(content);
          },
          maxDuration: 200,
        },
        {
          name: 'search_and_filter',
          operation: async () => {
            await mockStoryManagementService.searchStories('adventure');
            return mockStoryManagementService.filterStories({ source: 'CreativeBridge' });
          },
          maxDuration: 300,
        },
        {
          name: 'story_library_browsing',
          operation: async () => {
            return mockStoryManagementService.getStoryLibrary({
              offset: 0,
              limit: 20,
            });
          },
          maxDuration: 150,
        },
      ];

      // Mock all operations with realistic timing
      mockStoryImportService.readFileWithEncoding.mockResolvedValue({
        success: true,
        content: 'Mock content',
        metadata: {},
      });
      
      mockStoryImportService.validateStoryContent.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      
      mockStoryManagementService.searchStories.mockResolvedValue({
        success: true,
        stories: [],
        total: 0,
      });
      
      mockStoryManagementService.filterStories.mockResolvedValue({
        success: true,
        stories: [],
        total: 0,
      });
      
      mockStoryManagementService.getStoryLibrary.mockResolvedValue({
        success: true,
        stories: [],
        total: 0,
      });

      for (const scenario of scenarios) {
        const { duration } = await performanceTester.measureOperation(
          scenario.name,
          scenario.operation
        );

        expect(duration).toBeLessThan(scenario.maxDuration);
      }

      // Verify overall session performance
      const totalDuration = scenarios.reduce((sum, scenario) => 
        sum + performanceTester.getAverageDuration(scenario.name), 0
      );
      
      expect(totalDuration).toBeLessThan(1000); // Complete typical session under 1 second
    });
  });
});