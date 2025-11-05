import React, { useState, useCallback, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  Linking,
  Pressable,
} from 'react-native';
// Temporarily disabled Reanimated until native module is properly configured
// import Animated, {
//   useSharedValue,
//   useAnimatedStyle,
//   withSpring,
//   withTiming,
// } from 'react-native-reanimated';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import FullScreenImageModal, { StoryImage } from './FullScreenImageModal';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Display mode options for image sizing
export type ImageDisplayMode = 'responsive' | 'fullWidth';

interface StoryImageDisplayProps {
  imageUrl?: string;
  storyTitle?: string;
  sessionId: string;
  onImageSaved?: (localPath: string) => void;
  onError?: (error: string) => void;
  onBackToOptions?: () => void;
  showDownloadButton?: boolean;
  showShareButton?: boolean;
  showBackButton?: boolean;
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
  // Display mode configuration
  displayMode?: ImageDisplayMode;
}

interface ImageState {
  isLoading: boolean;
  hasError: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  localPath?: string;
  isPressed: boolean;
  showFullScreen: boolean;
  errorType?: 'network' | 'expired' | 'timeout' | 'unknown' | 'test-data';
  isConnected: boolean;
  isDownloadingForDisplay: boolean; // New flag for automatic download
}

const StoryImageDisplay: React.FC<StoryImageDisplayProps> = ({
  imageUrl,
  storyTitle = 'Story Illustration',
  sessionId,
  onImageSaved,
  onError,
  onBackToOptions,
  showDownloadButton = true,
  showShareButton = true,
  showBackButton = false,
  style,
  // Enhanced props with default values
  enableFullScreen = false,
  storyText,
  createdAt = new Date().toISOString(),
  metadata,
  enableCelebrationMode = false, // eslint-disable-line @typescript-eslint/no-unused-vars
  enableGalleryMode = false,
  galleryImages = [],
  currentImageIndex = 0,
  onFullScreenOpen,
  onFullScreenClose,
  onImageChange,
  showZoomIndicator = true,
  enableTouchFeedback = true,
  displayMode = 'responsive',
}) => {
  const [state, setState] = useState<ImageState>({
    isLoading: !!imageUrl,
    hasError: false,
    isDownloading: false,
    downloadProgress: 0,
    isPressed: false,
    showFullScreen: false,
    errorType: undefined,
    isConnected: true,
    isDownloadingForDisplay: false,
  });

  // Temporarily using regular state instead of Reanimated
  // const scaleAnim = useSharedValue(1);
  // const opacityAnim = useSharedValue(1);
  // const indicatorOpacity = useSharedValue(0);

  // Add timeout ref for loading state (using ref to avoid infinite renders)
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track failed URLs to prevent infinite retry loops
  const failedUrlsRef = useRef<Set<string>>(new Set());

  // Monitor network connectivity
  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(netState => {
      setState(prev => ({
        ...prev,
        isConnected: netState.isConnected ?? false,
      }));
    });

    return () => unsubscribe();
  }, []);

  // Check if image URL is accessible - Story_Quest style approach
  const checkImageAvailability = useCallback(
    async (
      url: string,
    ): Promise<{ available: boolean; errorType?: string }> => {
      try {
        console.log(
          '🖼️ [DEBUG] Checking image accessibility:',
          url.substring(0, 50) + '...',
        );

        // Check for obvious test/mock URLs first
        const isTestUrl =
          url.includes('backup-service.com') ||
          url.includes('example.com') ||
          url.includes('test-') ||
          url.includes('mock-') ||
          url.includes('dall-e-generated-image');

        if (isTestUrl) {
          console.log(
            '🖼️ [DEBUG] Detected test/mock URL, marking as test data',
          );
          return { available: false, errorType: 'test-data' };
        }

        // Use a shorter timeout for URL validation (similar to Story_Quest fast response)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 seconds like Story_Quest

        const response = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-cache', // Force fresh check
        });
        clearTimeout(timeoutId);

        console.log(
          '🖼️ [DEBUG] URL check response:',
          response.status,
          response.statusText,
        );

        if (response.status === 404) {
          return { available: false, errorType: 'expired' };
        } else if (!response.ok) {
          return { available: false, errorType: 'network' };
        }
        return { available: true };
      } catch (error) {
        console.log('🖼️ [DEBUG] URL check failed:', error);
        return { available: false, errorType: 'network' };
      }
    },
    [],
  );

  // Calculate responsive image dimensions based on display mode
  const getImageDimensions = useCallback(() => {
    if (displayMode === 'fullWidth') {
      // Edge-to-edge display: use full screen width with maximized height
      const imageWidth = screenWidth;
      const maxHeight = screenHeight * 0.85; // Increased to 85% for maximum visual impact
      let imageHeight = imageWidth; // Start with square aspect ratio
      
      // For edge-to-edge mode, prioritize maximum height while keeping reasonable aspect ratio
      if (imageHeight > maxHeight) {
        imageHeight = maxHeight;
        // Don't adjust width for fullWidth mode to maintain edge-to-edge
      } else {
        // If we have room, use more height for better display
        imageHeight = Math.max(imageHeight, maxHeight * 0.8);
      }
      
      return { width: imageWidth, height: imageHeight };
    } else {
      // Responsive display: traditional padded layout
      const maxWidth = screenWidth - 32; // Account for padding
      const maxHeight = screenHeight * 0.4; // Maximum 40% of screen height
      
      let imageWidth = maxWidth;
      let imageHeight = maxWidth;
      
      // Adjust if height exceeds maximum
      if (imageHeight > maxHeight) {
        imageHeight = maxHeight;
        imageWidth = maxHeight;
      }
      
      return { width: imageWidth, height: imageHeight };
    }
  }, [displayMode]);

  const imageDimensions = getImageDimensions();
  
  // Helper functions to get appropriate styles based on display mode
  const getContainerStyle = useCallback(() => {
    return displayMode === 'fullWidth' ? styles.containerFullWidth : styles.container;
  }, [displayMode]);
  
  const getImageContainerStyle = useCallback(() => {
    return displayMode === 'fullWidth' ? styles.imageContainerFullWidth : styles.imageContainer;
  }, [displayMode]);
  
  const getImageStyle = useCallback(() => {
    return displayMode === 'fullWidth' ? styles.imageFullWidth : styles.image;
  }, [displayMode]);

  // Download external URL to local storage for display
  const downloadImageForDisplay = useCallback(
    async (url: string): Promise<string | null> => {
      if (!url) return null;

      console.log(
        '🖼️ [DEBUG] Downloading image for display:',
        url.substring(0, 50) + '...',
      );

      setState(prev => ({
        ...prev,
        isDownloadingForDisplay: true,
      }));

      try {
        // Create display cache directory if it doesn't exist
        const cacheDir = `${RNFS.DocumentDirectoryPath}/ImageCache`;
        const dirExists = await RNFS.exists(cacheDir);
        if (!dirExists) {
          await RNFS.mkdir(cacheDir);
        }

        // Generate cache filename based on URL hash
        const urlHash = url.split('/').pop()?.split('.')[0] || 'image';
        const filename = `cached_${urlHash}.jpg`;
        const localPath = `${cacheDir}/${filename}`;

        // Check if already cached
        const fileExists = await RNFS.exists(localPath);
        if (fileExists) {
          console.log(
            '🖼️ [DEBUG] Image already cached, using local file:',
            localPath,
          );
          setState(prev => ({
            ...prev,
            isDownloadingForDisplay: false,
            localPath,
          }));
          return localPath;
        }

        // Download the image
        console.log('🖼️ [DEBUG] Downloading to cache:', localPath);
        const downloadResult = await RNFS.downloadFile({
          fromUrl: url,
          toFile: localPath,
        }).promise;

        if (downloadResult.statusCode === 200) {
          console.log('🖼️ [DEBUG] Image cached successfully:', localPath);
          setState(prev => ({
            ...prev,
            isDownloadingForDisplay: false,
            localPath,
          }));
          return localPath;
        } else {
          throw new Error(
            `Download failed with status: ${downloadResult.statusCode}`,
          );
        }
      } catch (error: any) {
        console.error('🖼️ [DEBUG] Failed to cache image:', error);
        setState(prev => ({
          ...prev,
          isDownloadingForDisplay: false,
        }));
        return null;
      }
    },
    [],
  );

  // Download image to device storage with location picker (user-initiated)
  const downloadImage = useCallback(async () => {
    if (!imageUrl || state.isDownloading) return;

    setState(prev => ({
      ...prev,
      isDownloading: true,
      downloadProgress: 0,
    }));

    try {
      // Generate unique filename
      const timestamp = new Date().getTime();
      const filename = `story_image_${sessionId}_${timestamp}.jpg`;
      const tempPath = `${RNFS.DocumentDirectoryPath}/${filename}`;

      // Download with progress tracking
      const downloadProgress = (data: any) => {
        const progress = (data.bytesWritten / data.contentLength) * 100;
        setState(prev => ({
          ...prev,
          downloadProgress: Math.round(progress),
        }));
      };

      // Download to temporary location first
      const downloadResult = await RNFS.downloadFile({
        fromUrl: imageUrl,
        toFile: tempPath,
        progress: downloadProgress,
      }).promise;

      if (downloadResult.statusCode === 200) {
        setState(prev => ({
          ...prev,
          isDownloading: false,
          downloadProgress: 100,
        }));

        // Use share sheet to let user choose save location (same as story download)
        const shareOptions = {
          title: 'Save Story Image',
          message: 'Save your story illustration',
          url: `file://${tempPath}`,
          type: 'image/jpeg',
          filename: filename,
          saveToFiles: true, // This enables "Save to Files" option on iOS
        };

        try {
          const shareResult = await Share.open(shareOptions);
          console.log('📁 Image share result:', shareResult);

          if (shareResult.success) {
            Alert.alert(
              '🎉 Image Saved!',
              `Your story illustration "${filename}" has been saved successfully!\n\nYou can find it in the location you selected.`,
              [{ text: 'Great!', style: 'default' }],
            );
          } else if (shareResult.dismissedAction) {
            Alert.alert(
              'Image Ready',
              `Your story illustration "${filename}" is ready in the app's Documents folder.\n\nYou can also access it through the Files app.`,
              [{ text: 'OK', style: 'default' }],
            );
          }

          onImageSaved?.(tempPath);

          // Track successful image download
          console.log('📊 Analytics: Image downloaded successfully', {
            sessionId,
            imageUrl,
            localPath: tempPath,
            timestamp: new Date().toISOString(),
          });
        } catch (shareError) {
          console.log('📁 Share cancelled or failed:', shareError);
          
          // Handle user cancellation gracefully
          const errorMessage = shareError instanceof Error ? shareError.message : String(shareError);
          
          // Check if user actually cancelled - if so, don't show any success message
          if (errorMessage && (
            errorMessage.includes('User did not share') || 
            errorMessage.includes('cancelled') ||
            errorMessage.includes('User cancelled') ||
            errorMessage.toLowerCase().includes('cancel')
          )) {
            // User cancelled - clean up the temporary file and don't show success message
            try {
              await RNFS.unlink(tempPath);
              console.log('📁 Cleaned up temporary file after user cancellation');
            } catch (cleanupError) {
              console.log('📁 Could not clean up temporary file:', cleanupError);
            }
            // Don't show any message - user intentionally cancelled
            return;
          } else {
            // Other share errors - file is still saved locally as fallback
            Alert.alert(
              'Image Saved Locally',
              `Your story illustration "${filename}" has been saved to the app's Documents folder.\n\nYou can access it through the Files app and move it to your preferred location.`,
              [{ text: 'OK', style: 'default' }],
            );
          }
        }
      } else {
        throw new Error(
          `Download failed with status: ${downloadResult.statusCode}`,
        );
      }
    } catch (error: any) {
      console.error('Image download failed:', error);

      setState(prev => ({
        ...prev,
        isDownloading: false,
        downloadProgress: 0,
      }));

      const errorMessage = error.message || 'Failed to download image';
      onError?.(errorMessage);

      Alert.alert(
        '❌ Download Failed',
        `We couldn't save your image: ${errorMessage}\n\nPlease try again or check your device storage.`,
        [{ text: 'OK', style: 'default' }],
      );
    }
  }, [imageUrl, sessionId, state.isDownloading, onImageSaved, onError]);

  // Share image functionality
  const shareImage = useCallback(async () => {
    if (!imageUrl) return;

    try {
      const shareOptions = {
        url: imageUrl,
        title: storyTitle,
        message: `Check out this AI-generated illustration for my story: "${storyTitle}" 🎨\n\nCreated with CreativeBridge`,
        type: 'image/jpeg',
      };

      await Share.open(shareOptions);

      // Track successful image share
      console.log('📊 Analytics: Image shared successfully', {
        imageUrl,
        storyTitle,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Share failed:', error);
      // Don't show error if user just cancelled sharing
      if (error.message !== 'User did not share') {
        Alert.alert(
          'Share Failed',
          "We couldn't share your image. Please try again.",
          [{ text: 'OK' }],
        );
      }
    }
  }, [imageUrl, storyTitle]);

  // Enhanced full-screen functionality
  const createStoryImageForModal = useCallback((): StoryImage => {
    return {
      id: sessionId,
      url: imageUrl || '',
      title: storyTitle,
      storyText,
      createdAt,
      sessionId,
      metadata,
    };
  }, [sessionId, imageUrl, storyTitle, storyText, createdAt, metadata]);

  const handleImagePress = useCallback(() => {
    if (!enableFullScreen || !imageUrl) return;

    // Animation temporarily disabled
    // if (enableTouchFeedback) {
    //   scaleAnim.value = withSpring(0.95, { damping: 15, stiffness: 300 }, () => {
    //     scaleAnim.value = withSpring(1, { damping: 15, stiffness: 300 });
    //   });
    // }

    // Open full-screen modal
    setState(prev => ({ ...prev, showFullScreen: true }));
    onFullScreenOpen?.();

    // Track full-screen open event
    console.log('📊 Analytics: Full-screen image opened', {
      sessionId,
      imageUrl: imageUrl.substring(0, 50) + '...',
      storyTitle,
      timestamp: new Date().toISOString(),
    });
  }, [enableFullScreen, imageUrl, onFullScreenOpen, sessionId, storyTitle]);

  const handleFullScreenClose = useCallback(() => {
    setState(prev => ({ ...prev, showFullScreen: false }));
    onFullScreenClose?.();

    // Track full-screen close event
    console.log('📊 Analytics: Full-screen image closed', {
      sessionId,
      timestamp: new Date().toISOString(),
    });
  }, [onFullScreenClose, sessionId]);

  const handlePressIn = useCallback(() => {
    if (!enableTouchFeedback) return;
    setState(prev => ({ ...prev, isPressed: true }));
  }, [enableTouchFeedback]);

  const handlePressOut = useCallback(() => {
    if (!enableTouchFeedback) return;
    setState(prev => ({ ...prev, isPressed: false }));
  }, [enableTouchFeedback]);

  // Animated styles temporarily disabled
  // const animatedImageStyle = useAnimatedStyle(() => ({
  //   transform: [{ scale: scaleAnim.value }],
  // }));

  // const animatedIndicatorStyle = useAnimatedStyle(() => ({
  //   opacity: indicatorOpacity.value,
  // }));

  // Handle image load events
  const handleImageLoad = useCallback(() => {
    console.log(
      '🖼️ [DEBUG] Image loaded successfully:',
      imageUrl?.substring(0, 50) + '...',
    );

    // Clear any existing timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isLoading: false,
      hasError: false,
    }));
  }, [imageUrl]);

  const handleImageError = useCallback(
    async (error?: any) => {
      console.error(
        '🖼️ [DEBUG] Image failed to load:',
        imageUrl?.substring(0, 50) + '...',
        error,
      );

      // Clear any existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

      // Determine error type
      let errorType: ImageState['errorType'] = 'unknown';

      if (
        typeof error === 'string' &&
        (error.includes('timeout') || error.includes('15 seconds'))
      ) {
        errorType = 'timeout';
      } else if (!state.isConnected) {
        errorType = 'network';
      } else if (imageUrl) {
        // Check if the image URL is accessible
        const urlCheck = await checkImageAvailability(imageUrl);
        errorType = (urlCheck.errorType as ImageState['errorType']) || 'unknown';
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true,
        errorType,
      }));

      const errorMessage =
        errorType === 'test-data'
          ? 'Test/development data detected'
          : errorType === 'expired'
          ? 'Image has expired or been removed'
          : errorType === 'network'
          ? 'Network connection issue'
          : errorType === 'timeout'
          ? 'Image load timeout - please try again'
          : 'Failed to load image';

      onError?.(errorMessage);
    },
    [onError, imageUrl, state.isConnected, checkImageAvailability],
  );

  // Render placeholder when no image
  const renderPlaceholder = () => (
    <View style={[styles.placeholder, imageDimensions]}>
      <Text style={styles.placeholderIcon}>🖼️</Text>
      <Text style={styles.placeholderTitle}>No Image Generated</Text>
      <Text style={styles.placeholderMessage}>
        Generate an AI illustration for your story to see it here!
      </Text>
    </View>
  );

  // Render error state
  const renderError = () => {
    const getErrorContent = () => {
      switch (state.errorType) {
        case 'test-data':
          return {
            icon: '🧪',
            title: 'Development Preview',
            message:
              'This session contains test data from development. The image URL is not a real generated image. Try generating a new image with the current app version.',
            showUrl: false,
            showRetry: false,
          };
        case 'expired':
          return {
            icon: '🕒',
            title: 'Image Expired',
            message:
              'This AI-generated image has expired from the server. This is normal for AI image services to save storage space.',
            showUrl: false,
            showRetry: false,
          };
        case 'network':
          return {
            icon: '📶',
            title: 'Network Issue',
            message:
              'Unable to load the image due to network connectivity issues. Check your internet connection and try again.',
            showUrl: false,
            showRetry: true,
          };
        case 'timeout':
          return {
            icon: '⏱️',
            title: 'Load Timeout',
            message:
              'The image took too long to load. This might be due to slow network or server issues.',
            showUrl: true,
            showRetry: true,
          };
        default:
          return {
            icon: '⚠️',
            title: 'Image Load Failed',
            message:
              "We couldn't load your story illustration. This might be due to network issues or the image service being temporarily unavailable.",
            showUrl: true,
            showRetry: true,
          };
      }
    };

    const errorContent = getErrorContent();

    return (
      <View style={[styles.errorContainer, imageDimensions]}>
        <Text style={styles.errorIcon}>{errorContent.icon}</Text>
        <Text style={styles.errorTitle}>{errorContent.title}</Text>
        <Text style={styles.errorMessage}>{errorContent.message}</Text>

        {errorContent.showUrl && (
          <Text style={styles.errorUrl}>
            URL: {imageUrl?.substring(0, 60)}...
          </Text>
        )}

        {imageUrl &&
          (errorContent.showRetry || state.errorType !== 'expired') && (
            <View style={styles.errorButtonsContainer}>
              {errorContent.showRetry && (
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => {
                    console.log('🖼️ [DEBUG] User retrying image load');
                    setState(prev => ({
                      ...prev,
                      isLoading: true,
                      hasError: false,
                      errorType: undefined,
                    }));
                  }}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              )}

              {state.errorType === 'expired' ? (
                <TouchableOpacity
                  style={styles.generateNewButton}
                  onPress={() => {
                    Alert.alert(
                      'Generate New Image',
                      'This image has expired. You can generate a new illustration for your story using the image generation feature.',
                      [{ text: 'OK', style: 'default' }],
                    );
                  }}
                >
                  <Text style={styles.generateNewButtonText}>Generate New</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.openUrlButton}
                  onPress={async () => {
                    console.log('🖼️ [DEBUG] User opening image URL externally');
                    try {
                      const supported = await Linking.canOpenURL(imageUrl);
                      if (supported) {
                        await Linking.openURL(imageUrl);
                      } else {
                        Alert.alert(
                          'Cannot open URL',
                          'Unable to open the image URL in an external browser.',
                        );
                      }
                    } catch (error) {
                      console.error('Error opening URL:', error);
                      Alert.alert('Error', 'Failed to open the image URL.');
                    }
                  }}
                >
                  <Text style={styles.openUrlButtonText}>Open in Browser</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
      </View>
    );
  };

  // Render loading state
  const renderLoading = () => (
    <View style={[styles.loadingContainer, imageDimensions]}>
      <ActivityIndicator size="large" color="#6f42c1" />
      <Text style={styles.loadingText}>
        {state.isDownloadingForDisplay
          ? 'Downloading image...'
          : 'Loading your illustration...'}
      </Text>
      <Text style={styles.loadingSubtext}>
        {state.isDownloadingForDisplay
          ? 'Caching for fast display'
          : 'Preparing for display'}
      </Text>
      <TouchableOpacity
        style={styles.cancelLoadingButton}
        onPress={() => {
          console.log('🖼️ [DEBUG] User cancelled image loading');
          handleImageError('User cancelled loading');
        }}
      >
        <Text style={styles.cancelLoadingText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  // Render action buttons
  const renderActionButtons = () => {
    if (!imageUrl || state.hasError) return null;

    return (
      <>
        <View style={styles.actionButtonsContainer}>
          {showDownloadButton && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.downloadButton,
                state.isDownloading && styles.actionButtonDisabled,
              ]}
              onPress={downloadImage}
              disabled={state.isDownloading}
            >
              {state.isDownloading ? (
                <View style={styles.downloadingContent}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.actionButtonText}>
                    {state.downloadProgress}%
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.actionButtonIcon}>📥</Text>
                  <Text style={styles.actionButtonText}>Save to Device</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {showShareButton && (
            <TouchableOpacity
              style={[styles.actionButton, styles.shareButton]}
              onPress={shareImage}
            >
              <Text style={styles.actionButtonIcon}>📤</Text>
              <Text style={styles.actionButtonText}>Share</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Back to Options Button */}
        {showBackButton && onBackToOptions && (
          <View style={styles.backButtonContainer}>
            <TouchableOpacity
              style={styles.backToOptionsButton}
              onPress={onBackToOptions}
            >
              <Text style={styles.backButtonIcon}>←</Text>
              <Text style={styles.backButtonText}>Back to Options</Text>
            </TouchableOpacity>
          </View>
        )}
      </>
    );
  };

  // Auto-download external URLs for reliable local display
  React.useEffect(() => {
    if (
      imageUrl &&
      state.isLoading &&
      !state.isDownloadingForDisplay &&
      !state.hasError
    ) {
      // Prevent infinite loops by checking if this URL already failed
      if (failedUrlsRef.current.has(imageUrl)) {
        console.log('🖼️ [DEBUG] URL previously failed, showing error state');
        setState(prev => ({
          ...prev,
          isLoading: false,
          hasError: true,
          errorType: 'expired',
        }));
        return;
      }

      console.log(
        '🖼️ [DEBUG] Processing image URL for local caching:',
        imageUrl.substring(0, 50) + '...',
      );

      // Check for test URLs first to avoid unnecessary network calls
      const isTestUrl =
        imageUrl.includes('backup-service.com') ||
        imageUrl.includes('example.com') ||
        imageUrl.includes('test-') ||
        imageUrl.includes('mock-') ||
        imageUrl.includes('dall-e-generated-image');

      if (isTestUrl) {
        console.log(
          '🖼️ [DEBUG] Detected test/development URL, showing appropriate message',
        );
        failedUrlsRef.current.add(imageUrl);
        setState(prev => ({
          ...prev,
          isLoading: false,
          hasError: true,
          errorType: 'test-data',
        }));
        return;
      }

      // Check if it's an external URL (Replicate.delivery, etc.)
      const isExternalUrl =
        imageUrl.startsWith('http') && !imageUrl.startsWith('file://');

      if (isExternalUrl) {
        console.log(
          '🖼️ [DEBUG] External URL detected, downloading for local display',
        );
        downloadImageForDisplay(imageUrl).then(localPath => {
          if (localPath) {
            console.log(
              '🖼️ [DEBUG] Successfully cached image, ready for display',
            );
            setState(prev => ({
              ...prev,
              isLoading: false,
              hasError: false,
              localPath,
            }));
          } else {
            console.log(
              '🖼️ [DEBUG] Failed to cache image, marking as failed to prevent retries',
            );
            failedUrlsRef.current.add(imageUrl);
            setState(prev => ({
              ...prev,
              isLoading: false,
              hasError: true,
              errorType: 'expired',
            }));
          }
        });
      } else {
        // Local file or already cached
        console.log('🖼️ [DEBUG] Local file detected, loading directly');
        setState(prev => ({
          ...prev,
          isLoading: false,
          hasError: false,
        }));
      }
    }
  }, [
    imageUrl,
    state.isLoading,
    state.isDownloadingForDisplay,
    state.hasError,
    downloadImageForDisplay,
  ]);

  // Main render
  console.log('🖼️ [DEBUG] StoryImageDisplay render:', {
    imageUrl: imageUrl?.substring(0, 50) + '...',
    localPath: state.localPath?.substring(0, 50) + '...',
    hasImageUrl: !!imageUrl,
    hasLocalPath: !!state.localPath,
    storyTitle,
    sessionId,
    isLoading: state.isLoading,
    isDownloadingForDisplay: state.isDownloadingForDisplay,
    hasError: state.hasError,
  });

  if (!imageUrl) {
    console.log('🖼️ [DEBUG] No imageUrl, showing placeholder');
    return <View style={[getContainerStyle(), style]}>{renderPlaceholder()}</View>;
  }

  if (state.hasError) {
    return (
      <View style={[getContainerStyle(), style]}>
        {renderError()}
        {renderActionButtons()}
      </View>
    );
  }

  if (state.isLoading) {
    return <View style={[getContainerStyle(), style]}>{renderLoading()}</View>;
  }

  // Prepare gallery images for full-screen modal
  const preparedGalleryImages =
    enableGalleryMode && galleryImages.length > 0
      ? galleryImages
      : [createStoryImageForModal()];

  return (
    <>
      <View style={[getContainerStyle(), style]}>
        {enableFullScreen ? (
          <Pressable
            onPress={handleImagePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={styles.pressableImageContainer}
            testID="image-container-pressable"
          >
            <View style={[getImageContainerStyle()]}>
              <Image
                source={{
                  uri: state.localPath || imageUrl,
                  cache: 'force-cache',
                }}
                style={[getImageStyle(), imageDimensions]}
                onLoad={handleImageLoad}
                onError={error => {
                  console.log(
                    '🖼️ [DEBUG] Image onError called:',
                    error.nativeEvent,
                  );
                  console.log(
                    '🖼️ [DEBUG] Using source:',
                    state.localPath || imageUrl,
                  );
                  handleImageError(error.nativeEvent);
                }}
                onLoadStart={() => {
                  console.log(
                    '🖼️ [DEBUG] Image load started for:',
                    (state.localPath || imageUrl).substring(0, 50) + '...',
                  );
                }}
                onLoadEnd={() => {
                  console.log(
                    '🖼️ [DEBUG] Image load ended (success or failure)',
                  );
                }}
                resizeMode="cover"
                testID="story-image-enhanced"
              />

              {/* Full-screen indicator */}
              {showZoomIndicator && (
                <View style={[styles.zoomIndicator]}>
                  <View style={styles.zoomIcon}>
                    <Text style={styles.zoomIconText}>🔍</Text>
                  </View>
                </View>
              )}
            </View>
          </Pressable>
        ) : (
          <View style={getImageContainerStyle()} testID="image-container">
            <Image
              source={{
                uri: state.localPath || imageUrl,
                cache: 'force-cache',
              }}
              style={[getImageStyle(), imageDimensions]}
              onLoad={handleImageLoad}
              onError={error => {
                console.log(
                  '🖼️ [DEBUG] Image onError called:',
                  error.nativeEvent,
                );
                console.log(
                  '🖼️ [DEBUG] Using source:',
                  state.localPath || imageUrl,
                );
                handleImageError(error.nativeEvent);
              }}
              onLoadStart={() => {
                console.log(
                  '🖼️ [DEBUG] Image load started for:',
                  (state.localPath || imageUrl).substring(0, 50) + '...',
                );
              }}
              onLoadEnd={() => {
                console.log('🖼️ [DEBUG] Image load ended (success or failure)');
              }}
              resizeMode="cover"
              testID="story-image"
            />
          </View>
        )}
        {renderActionButtons()}
      </View>

      {/* Full-Screen Modal */}
      {enableFullScreen && (
        <FullScreenImageModal
          visible={state.showFullScreen}
          onClose={handleFullScreenClose}
          images={preparedGalleryImages}
          initialIndex={enableGalleryMode ? currentImageIndex : 0}
          enableSwipeNavigation={
            enableGalleryMode && preparedGalleryImages.length > 1
          }
          enableZoom={true}
          enableStoryOverlay={!!storyText}
          showImageInfo={true}
          onImageChange={onImageChange}
          onShare={shareImage}
          onDownload={() => downloadImage()}
          darkMode={true}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  containerFullWidth: {
    backgroundColor: '#ffffff',
    borderRadius: 0, // Remove rounded corners for edge-to-edge
    padding: 0, // Remove padding for full width
    marginVertical: 0, // Remove margins for edge-to-edge
    flex: 1, // Allow container to expand
    justifyContent: 'center', // Center content vertically
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  // Image Display
  imageContainer: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  imageContainerFullWidth: {
    position: 'relative',
    borderRadius: 0, // Remove rounded corners for edge-to-edge
    overflow: 'hidden',
    marginBottom: 0, // Remove margin for full width
  },
  image: {
    borderRadius: 8,
  },
  imageFullWidth: {
    borderRadius: 0, // Remove rounded corners for edge-to-edge
  },

  // Placeholder
  placeholder: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#dee2e6',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 8,
    textAlign: 'center',
  },
  placeholderMessage: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Error State
  errorContainer: {
    backgroundColor: '#f8d7da',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f5c6cb',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#721c24',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#721c24',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorUrl: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
    marginVertical: 8,
    fontFamily: 'monospace',
  },
  errorButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  openUrlButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
  },
  openUrlButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  generateNewButton: {
    backgroundColor: '#6f42c1',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
  },
  generateNewButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Loading State
  loadingContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 12,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
  cancelLoadingButton: {
    backgroundColor: '#6b7280',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginTop: 12,
  },
  cancelLoadingText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Action Buttons
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
    paddingHorizontal: 16, // Add padding for edge-to-edge mode
    paddingVertical: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  downloadButton: {
    backgroundColor: '#28a745',
  },
  shareButton: {
    backgroundColor: '#007bff',
  },
  actionButtonIcon: {
    fontSize: 16,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  downloadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Back to Options Button
  backButtonContainer: {
    marginTop: 12,
    marginHorizontal: 16, // Add horizontal margins for edge-to-edge mode
    alignItems: 'center',
  },
  backToOptionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f44336',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 8,
  },
  backButtonIcon: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Enhanced full-screen functionality styles
  pressableImageContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  zoomIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  zoomIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomIconText: {
    fontSize: 16,
    color: '#ffffff',
  },
});

export default StoryImageDisplay;
