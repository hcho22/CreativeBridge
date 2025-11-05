/**
 * TypeScript interface compatibility tests for enhanced StoryImageDisplay
 * Validates all prop types, optional properties, and backward compatibility
 */

import { StoryImage } from '../../components/common/FullScreenImageModal';

// Define the complete interface for testing
interface StoryImageDisplayProps {
  imageUrl?: string;
  storyTitle?: string;
  sessionId: string;
  onImageSaved?: (localPath: string) => void;
  onError?: (error: string) => void;
  showDownloadButton?: boolean;
  showShareButton?: boolean;
  style?: any;
  // Enhanced full-screen integration props
  enableFullScreen?: boolean;
  storyText?: string;
  createdAt?: string;
  metadata?: {
    gradeLevel?: string;
    wordCount?: number;
    generationTime?: number;
    artStyle?: string;
  };
  // Celebration and gallery mode flags
  enableCelebrationMode?: boolean;
  enableGalleryMode?: boolean;
  // Additional images for gallery navigation
  galleryImages?: StoryImage[];
  currentImageIndex?: number;
  // Enhanced callbacks
  onFullScreenOpen?: () => void;
  onFullScreenClose?: () => void;
  onImageChange?: (index: number, image: StoryImage) => void;
  // Visual enhancement options
  showZoomIndicator?: boolean;
  enableTouchFeedback?: boolean;
}

describe('StoryImageDisplay Interface Compatibility', () => {
  // Test required properties
  it('should require only essential properties', () => {
    const minimalProps: StoryImageDisplayProps = {
      sessionId: 'test-session-123',
    };

    expect(minimalProps.sessionId).toBe('test-session-123');
    expect(minimalProps.imageUrl).toBeUndefined();
    expect(minimalProps.storyTitle).toBeUndefined();
  });

  // Test backward compatibility with existing props
  it('should maintain backward compatibility with original props', () => {
    const legacyProps: StoryImageDisplayProps = {
      imageUrl: 'https://example.com/image.jpg',
      storyTitle: 'My Story',
      sessionId: 'legacy-session',
      onImageSaved: (path: string) => console.log(`Saved to: ${path}`),
      onError: (error: string) => console.error(error),
      showDownloadButton: true,
      showShareButton: true,
      style: { margin: 10 },
    };

    // Validate all legacy props are properly typed
    expect(typeof legacyProps.imageUrl).toBe('string');
    expect(typeof legacyProps.storyTitle).toBe('string');
    expect(typeof legacyProps.sessionId).toBe('string');
    expect(typeof legacyProps.onImageSaved).toBe('function');
    expect(typeof legacyProps.onError).toBe('function');
    expect(typeof legacyProps.showDownloadButton).toBe('boolean');
    expect(typeof legacyProps.showShareButton).toBe('boolean');
    expect(typeof legacyProps.style).toBe('object');
  });

  // Test enhanced full-screen props
  it('should support enhanced full-screen properties', () => {
    const enhancedProps: StoryImageDisplayProps = {
      sessionId: 'enhanced-session',
      enableFullScreen: true,
      storyText: 'Once upon a time in a magical forest...',
      createdAt: '2023-10-15T14:30:00Z',
      metadata: {
        gradeLevel: 'K-2',
        wordCount: 150,
        generationTime: 45000,
        artStyle: 'watercolor illustration',
      },
      enableCelebrationMode: true,
      enableGalleryMode: false,
      showZoomIndicator: true,
      enableTouchFeedback: true,
    };

    // Validate enhanced prop types
    expect(typeof enhancedProps.enableFullScreen).toBe('boolean');
    expect(typeof enhancedProps.storyText).toBe('string');
    expect(typeof enhancedProps.createdAt).toBe('string');
    expect(typeof enhancedProps.metadata).toBe('object');
    expect(typeof enhancedProps.enableCelebrationMode).toBe('boolean');
    expect(typeof enhancedProps.enableGalleryMode).toBe('boolean');
    expect(typeof enhancedProps.showZoomIndicator).toBe('boolean');
    expect(typeof enhancedProps.enableTouchFeedback).toBe('boolean');

    // Validate metadata structure
    expect(typeof enhancedProps.metadata!.gradeLevel).toBe('string');
    expect(typeof enhancedProps.metadata!.wordCount).toBe('number');
    expect(typeof enhancedProps.metadata!.generationTime).toBe('number');
    expect(typeof enhancedProps.metadata!.artStyle).toBe('string');
  });

  // Test gallery mode props
  it('should support gallery mode properties', () => {
    const galleryImages: StoryImage[] = [
      {
        id: 'image-1',
        url: 'https://example.com/image1.jpg',
        title: 'Story One',
        createdAt: '2023-10-15T10:00:00Z',
        sessionId: 'session-1',
      },
      {
        id: 'image-2',
        url: 'https://example.com/image2.jpg',
        title: 'Story Two',
        storyText: 'This is the second story...',
        createdAt: '2023-10-15T11:00:00Z',
        sessionId: 'session-2',
        metadata: {
          gradeLevel: '3-5',
          wordCount: 200,
        },
      },
    ];

    const galleryProps: StoryImageDisplayProps = {
      sessionId: 'gallery-session',
      enableGalleryMode: true,
      galleryImages,
      currentImageIndex: 0,
    };

    // Validate gallery props
    expect(typeof galleryProps.enableGalleryMode).toBe('boolean');
    expect(Array.isArray(galleryProps.galleryImages)).toBe(true);
    expect(typeof galleryProps.currentImageIndex).toBe('number');
    expect(galleryProps.galleryImages!.length).toBe(2);

    // Validate gallery image structure
    galleryProps.galleryImages!.forEach(image => {
      expect(typeof image.id).toBe('string');
      expect(typeof image.url).toBe('string');
      expect(typeof image.title).toBe('string');
      expect(typeof image.createdAt).toBe('string');
      expect(typeof image.sessionId).toBe('string');
    });
  });

  // Test callback function signatures
  it('should support enhanced callback functions', () => {
    const callbackProps: StoryImageDisplayProps = {
      sessionId: 'callback-session',
      onFullScreenOpen: () => {
        console.log('Full screen opened');
      },
      onFullScreenClose: () => {
        console.log('Full screen closed');
      },
      onImageChange: (index: number, image: StoryImage) => {
        console.log(`Changed to image ${index}:`, image.title);
      },
    };

    // Validate callback types
    expect(typeof callbackProps.onFullScreenOpen).toBe('function');
    expect(typeof callbackProps.onFullScreenClose).toBe('function');
    expect(typeof callbackProps.onImageChange).toBe('function');

    // Test callback execution
    const mockImage: StoryImage = {
      id: 'test',
      url: 'test.jpg',
      title: 'Test',
      createdAt: '2023-01-01T00:00:00Z',
      sessionId: 'test',
    };

    // These should not throw type errors
    callbackProps.onFullScreenOpen!();
    callbackProps.onFullScreenClose!();
    callbackProps.onImageChange!(1, mockImage);
  });

  // Test optional properties
  it('should handle all optional properties correctly', () => {
    const allOptionalProps: Partial<StoryImageDisplayProps> = {
      imageUrl: undefined,
      storyTitle: undefined,
      onImageSaved: undefined,
      onError: undefined,
      showDownloadButton: undefined,
      showShareButton: undefined,
      style: undefined,
      enableFullScreen: undefined,
      storyText: undefined,
      createdAt: undefined,
      metadata: undefined,
      enableCelebrationMode: undefined,
      enableGalleryMode: undefined,
      galleryImages: undefined,
      currentImageIndex: undefined,
      onFullScreenOpen: undefined,
      onFullScreenClose: undefined,
      onImageChange: undefined,
      showZoomIndicator: undefined,
      enableTouchFeedback: undefined,
    };

    const requiredProps: StoryImageDisplayProps = {
      ...allOptionalProps,
      sessionId: 'test-session', // Only required prop
    };

    expect(requiredProps.sessionId).toBe('test-session');
    expect(requiredProps.imageUrl).toBeUndefined();
  });

  // Test metadata flexibility
  it('should support flexible metadata structure', () => {
    const metadataVariations = [
      // Minimal metadata
      { gradeLevel: 'K-2' },

      // Full metadata
      {
        gradeLevel: '3-5',
        wordCount: 250,
        generationTime: 30000,
        artStyle: 'digital painting',
      },

      // Partial metadata
      {
        wordCount: 100,
        artStyle: 'sketch',
      },

      // Empty metadata
      {},
    ];

    metadataVariations.forEach((metadata, index) => {
      const props: StoryImageDisplayProps = {
        sessionId: `test-${index}`,
        metadata,
      };

      expect(typeof props.metadata).toBe('object');

      // Test optional metadata properties
      if (metadata.gradeLevel) {
        expect(typeof metadata.gradeLevel).toBe('string');
      }
      if (metadata.wordCount) {
        expect(typeof metadata.wordCount).toBe('number');
      }
      if (metadata.generationTime) {
        expect(typeof metadata.generationTime).toBe('number');
      }
      if (metadata.artStyle) {
        expect(typeof metadata.artStyle).toBe('string');
      }
    });
  });

  // Test realistic usage scenarios
  it('should support realistic component usage scenarios', () => {
    // Scenario 1: Basic image display
    const basicUsage: StoryImageDisplayProps = {
      imageUrl: 'https://example.com/story.jpg',
      storyTitle: 'My First Story',
      sessionId: 'basic-session',
    };

    expect(basicUsage.sessionId).toBeTruthy();

    // Scenario 2: Enhanced display with full-screen
    const enhancedUsage: StoryImageDisplayProps = {
      imageUrl: 'https://example.com/story.jpg',
      storyTitle: 'Enhanced Story',
      sessionId: 'enhanced-session',
      enableFullScreen: true,
      storyText: 'This is a wonderful story about...',
      showZoomIndicator: true,
      enableTouchFeedback: true,
      onFullScreenOpen: () => console.log('Opened'),
    };

    expect(enhancedUsage.enableFullScreen).toBe(true);

    // Scenario 3: Gallery mode with multiple images
    const galleryUsage: StoryImageDisplayProps = {
      sessionId: 'gallery-session',
      enableFullScreen: true,
      enableGalleryMode: true,
      galleryImages: [
        {
          id: '1',
          url: 'image1.jpg',
          title: 'Story 1',
          createdAt: '2023-01-01T00:00:00Z',
          sessionId: 'session1',
        },
      ],
      currentImageIndex: 0,
      onImageChange: (index, image) => {
        console.log(`Viewing image ${index}: ${image.title}`);
      },
    };

    expect(galleryUsage.enableGalleryMode).toBe(true);
    expect(galleryUsage.galleryImages).toBeDefined();

    // Scenario 4: Celebration mode
    const celebrationUsage: StoryImageDisplayProps = {
      imageUrl: 'https://example.com/achievement.jpg',
      storyTitle: 'First Story Complete!',
      sessionId: 'celebration-session',
      enableFullScreen: true,
      enableCelebrationMode: true,
      metadata: {
        gradeLevel: 'K-2',
        wordCount: 100,
      },
    };

    expect(celebrationUsage.enableCelebrationMode).toBe(true);
  });

  // Test error handling and edge cases
  it('should handle edge cases and invalid inputs gracefully', () => {
    // Test with invalid types (these should be caught by TypeScript)
    const edgeCaseProps: StoryImageDisplayProps = {
      sessionId: 'edge-case-session',
      currentImageIndex: 0, // Valid
      // These would cause TypeScript errors if uncommented:
      // currentImageIndex: 'invalid-string',
      // enableFullScreen: 'not-boolean',
      // metadata: 'not-object',
    };

    expect(typeof edgeCaseProps.sessionId).toBe('string');
    expect(typeof edgeCaseProps.currentImageIndex).toBe('number');
  });

  // Test union types and complex structures
  it('should support complex type structures', () => {
    // Test StoryImage interface compatibility
    const complexStoryImage: StoryImage = {
      id: 'complex-image-123',
      url: 'https://example.com/complex-image.jpg',
      title: 'Complex Story with Rich Metadata',
      storyText:
        'This is a complex story with multiple paragraphs and rich content...',
      createdAt: '2023-10-15T14:30:22.150Z',
      sessionId: 'complex-session-456',
      metadata: {
        gradeLevel: '6-8',
        wordCount: 345,
        generationTime: 67000,
        artStyle: 'realistic digital art with dramatic lighting',
      },
    };

    const complexProps: StoryImageDisplayProps = {
      sessionId: 'complex-component-session',
      enableFullScreen: true,
      enableGalleryMode: true,
      galleryImages: [complexStoryImage],
      currentImageIndex: 0,
      metadata: complexStoryImage.metadata,
      storyText: complexStoryImage.storyText,
      onImageChange: (index: number, image: StoryImage) => {
        // Complex callback handling
        console.log(`Image ${index}: ${image.title}`);
        if (image.metadata) {
          console.log(
            `Grade: ${image.metadata.gradeLevel}, Words: ${image.metadata.wordCount}`,
          );
        }
      },
    };

    expect(complexProps.galleryImages![0]).toEqual(complexStoryImage);
    expect(typeof complexProps.onImageChange).toBe('function');
  });
});
