import React, { useState, useCallback, useRef } from 'react';
// Temporarily disabled NetInfo due to linking issues
// import NetInfo from '@react-native-community/netinfo';
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
import Share from '../../utils/shareWrapper';
import RNFS, { rnfsWrapper } from '../../utils/rnfsWrapper';
import {
  requestPhotoLibraryPermission,
  saveImageToPhotos,
} from '../../utils/saveToPhotos';
import FullScreenImageModal, { StoryImage } from './FullScreenImageModal';
import FolderPickerUtil from '../../utils/folderPicker';
import { useParentalGate } from './ParentalGate';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Display mode options for image sizing
export type ImageDisplayMode = 'responsive' | 'fullWidth';

interface StoryImageDisplayProps {
  // NEW: Image URL priority system (Task 4.2)
  replicateUrl?: string; // Temporary Replicate.delivery URL
  supabaseUrl?: string; // Permanent Supabase Storage URL
  uploadStatus?: 'pending' | 'uploaded' | 'failed'; // Upload status for badges
  onRetryUpload?: () => void; // Callback for retry button

  // Legacy support (deprecated - use replicateUrl/supabaseUrl instead)
  imageUrl?: string;

  storyTitle?: string;
  sessionId: string;
  userId: string; // NEW: Required for retry operations
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
  // NEW: Fallback tracking for URL priority system (Task 4.2)
  attemptedSupabaseUrl: boolean; // Track if we tried Supabase URL and it failed
  currentUrlSource: 'supabase' | 'replicate' | 'legacy' | null; // Track which URL we're using
  isSavingToPhotos: boolean; // Decoupled from isDownloading (US-003)
}

const StoryImageDisplay: React.FC<StoryImageDisplayProps> = ({
  // NEW: Priority URL system (Task 4.2)
  replicateUrl,
  supabaseUrl,
  uploadStatus,
  onRetryUpload,
  // Legacy support
  imageUrl,
  storyTitle = 'Story Illustration',
  sessionId,
  userId,
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
  const { openURL, parentalGateModal } = useParentalGate();

  // NEW: URL Priority Logic - Prioritize Supabase URL over Replicate URL
  // Falls back to legacy imageUrl if neither is provided
  const effectiveImageUrl = React.useMemo(() => {
    // Priority 1: Supabase URL (permanent storage)
    if (supabaseUrl) {
      console.log('🖼️ [DEBUG] Using Supabase URL (permanent storage)');
      return supabaseUrl;
    }
    // Priority 2: Replicate URL (temporary)
    if (replicateUrl) {
      console.log('🖼️ [DEBUG] Using Replicate URL (temporary)');
      return replicateUrl;
    }
    // Priority 3: Legacy imageUrl prop for backward compatibility
    if (imageUrl) {
      console.log('🖼️ [DEBUG] Using legacy imageUrl prop');
      return imageUrl;
    }
    return undefined;
  }, [supabaseUrl, replicateUrl, imageUrl]);
  const [state, setState] = useState<ImageState>({
    isLoading: !!effectiveImageUrl,
    hasError: false,
    isDownloading: false,
    downloadProgress: 0,
    isPressed: false,
    showFullScreen: false,
    errorType: undefined,
    isConnected: true,
    isDownloadingForDisplay: false,
    isSavingToPhotos: false,
    // NEW: Initialize fallback tracking
    attemptedSupabaseUrl: false,
    currentUrlSource: supabaseUrl
      ? 'supabase'
      : replicateUrl
      ? 'replicate'
      : imageUrl
      ? 'legacy'
      : null,
  });

  // Temporarily using regular state instead of Reanimated
  // const scaleAnim = useSharedValue(1);
  // const opacityAnim = useSharedValue(1);
  // const indicatorOpacity = useSharedValue(0);

  // Add timeout ref for loading state (using ref to avoid infinite renders)
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track failed URLs to prevent infinite retry loops
  const failedUrlsRef = useRef<Set<string>>(new Set());

  // Monitor network connectivity - temporarily disabled due to NetInfo linking issues
  React.useEffect(() => {
    // Assume connected for now
    setState(prev => ({
      ...prev,
      isConnected: true,
    }));

    // const unsubscribe = NetInfo.addEventListener(netState => {
    //   setState(prev => ({
    //     ...prev,
    //     isConnected: netState.isConnected ?? false,
    //   }));
    // });
    // return () => unsubscribe();
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
          signal: controller.signal as any,
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
      } catch (error: any) {
        console.log('🖼️ [DEBUG] URL check failed:', error);

        // Better error type detection for 404 responses
        if (
          error.message?.includes('404') ||
          error.message?.includes('Not Found')
        ) {
          console.log(
            '🖼️ [DEBUG] Detected 404 error - image likely expired or removed',
          );
          return { available: false, errorType: 'expired' };
        } else if (error.name === 'AbortError') {
          console.log('🖼️ [DEBUG] URL check timed out');
          return { available: false, errorType: 'timeout' };
        } else {
          return { available: false, errorType: 'network' };
        }
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
    return displayMode === 'fullWidth'
      ? styles.containerFullWidth
      : styles.container;
  }, [displayMode]);

  const getImageContainerStyle = useCallback(() => {
    return displayMode === 'fullWidth'
      ? styles.imageContainerFullWidth
      : styles.imageContainer;
  }, [displayMode]);

  const getImageStyle = useCallback(() => {
    return displayMode === 'fullWidth' ? styles.imageFullWidth : styles.image;
  }, [displayMode]);

  // Download external URL to local storage for display
  const downloadImageForDisplay = useCallback(
    async (url: string): Promise<string | null> => {
      if (!url) return null;

      // Skip caching entirely when RNFS is in simulation mode
      if (rnfsWrapper.isSimulationMode) {
        console.log(
          '🖼️ [DEBUG] RNFS in simulation mode - skipping caching, using original URL',
        );
        return null; // Return null to force direct URL usage
      }

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

        // Generate cache filename from full URL to avoid collisions
        // Replicate delivery URLs often share the same filename (e.g., output.webp),
        // so we hash the full URL to ensure each prediction gets a unique cache entry.
        const urlHash = url.replace(/[^a-zA-Z0-9]/g, '').slice(-40);
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

  // Download image to device storage with enhanced directory selection
  const downloadImage = useCallback(async () => {
    // Use current state to avoid closure issues
    const currentLocalPath = state.localPath;
    const currentIsDownloading = state.isDownloading;

    console.log('🖼️ [DEBUG] downloadImage called with:', {
      hasImageUrl: !!imageUrl,
      hasLocalPath: !!currentLocalPath,
      localPath: currentLocalPath,
      isDownloading: currentIsDownloading,
    });

    if ((!imageUrl && !currentLocalPath) || currentIsDownloading) {
      console.log(
        '🖼️ [DEBUG] downloadImage early return - no source or already downloading',
      );
      return;
    }

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

      console.log('🖼️ [DEBUG] Download setup:', {
        filename,
        tempPath,
        localPath: currentLocalPath,
      });

      // Prepare source file (either from cache or download)
      let sourceFilePath = tempPath;
      let needsDownload = true;

      if (currentLocalPath) {
        console.log(
          '🖼️ [DEBUG] Checking if cached file exists:',
          currentLocalPath,
        );
        const fileExists = await RNFS.exists(currentLocalPath);
        console.log('🖼️ [DEBUG] File exists result:', fileExists);

        if (fileExists) {
          console.log('🖼️ [DEBUG] Using cached local file directly');
          sourceFilePath = currentLocalPath;
          needsDownload = false;

          // Simulate progress for UI consistency
          setState(prev => ({
            ...prev,
            downloadProgress: 100,
          }));
        }
      }

      // Download if we don't have a cached file
      if (needsDownload) {
        if (!imageUrl) {
          throw new Error(
            'No image URL available for download and no valid cached file',
          );
        }

        console.log('🖼️ [DEBUG] Downloading from URL:', imageUrl);

        const downloadProgress = (data: any) => {
          const progress = (data.bytesWritten / data.contentLength) * 100;
          setState(prev => ({
            ...prev,
            downloadProgress: Math.round(progress),
          }));
        };

        const downloadResult = await RNFS.downloadFile({
          fromUrl: imageUrl,
          toFile: tempPath,
          progress: downloadProgress,
        }).promise;

        if (downloadResult.statusCode !== 200) {
          throw new Error(
            `Download failed with status: ${downloadResult.statusCode}`,
          );
        }

        setState(prev => ({
          ...prev,
          downloadProgress: 100,
        }));
      }

      // Reset downloading state before showing save options
      setState(prev => ({
        ...prev,
        isDownloading: false,
      }));

      // True folder selection using the folder picker utility
      console.log('🖼️ [DEBUG] Starting folder selection process');

      try {
        const saveOptions = {
          sourceFilePath,
          fileName: filename,
          title: 'Choose Save Location',
        };

        console.log('📁 Opening folder picker for user selection');
        const saveResult = await FolderPickerUtil.saveToUserSelectedFolder(
          saveOptions,
        );

        console.log('📁 Folder save result:', saveResult);

        if (saveResult.cancelled) {
          // User cancelled - clean up temp file if we downloaded it
          console.log('🖼️ [DEBUG] User cancelled folder selection');
          return;
        }

        if (saveResult.success && saveResult.finalPath) {
          // Success - file saved via Share Sheet

          Alert.alert(
            '🎉 Image Saved!',
            `Your story illustration "${filename}" has been saved successfully!\n\nYou can find it in your chosen location using the Files app.`,
            [{ text: 'Perfect!', style: 'default' }],
          );

          onImageSaved?.(saveResult.finalPath);

          // Track successful folder-based save
          console.log('📊 Analytics: Image saved successfully', {
            sessionId,
            imageUrl,
            filename,
            finalPath: saveResult.finalPath,
            timestamp: new Date().toISOString(),
          });
        } else {
          // Handle save errors
          throw new Error(
            saveResult.error || 'Failed to save to selected folder',
          );
        }
      } catch (folderError: any) {
        console.error('Folder save failed:', folderError);

        // Don't show error if user cancelled
        if (folderError.message && folderError.message.includes('CANCELLED')) {
          console.log('📁 User cancelled save operation');
          return;
        }

        // Provide helpful error message
        const errorMessage = folderError.message || 'Unknown error occurred';

        Alert.alert(
          '❌ Save Failed',
          `Could not save to the selected folder: ${errorMessage}\n\nPlease try a different location or check your device permissions.`,
          [
            { text: 'OK', style: 'default' },
            {
              text: 'Try Again',
              onPress: () => {
                // Retry the save operation
                downloadImage();
              },
            },
          ],
        );
      }

      // Clean up temporary file if we downloaded it
      if (needsDownload && tempPath !== sourceFilePath) {
        try {
          await RNFS.unlink(tempPath);
          console.log('📁 Cleaned up temporary download file');
        } catch (cleanupError) {
          console.log('📁 Could not clean up temporary file:', cleanupError);
        }
      }
    } catch (error: any) {
      console.error('Image download/save failed:', error);

      setState(prev => ({
        ...prev,
        isDownloading: false,
        downloadProgress: 0,
      }));

      const errorMessage = error.message || 'Failed to save image';
      onError?.(errorMessage);

      Alert.alert(
        '❌ Save Failed',
        `We couldn't save your image: ${errorMessage}\n\nPlease try again or check your device storage and permissions.`,
        [{ text: 'OK', style: 'default' }],
      );
    }
  }, [
    imageUrl,
    sessionId,
    state.isDownloading,
    state.localPath,
    onImageSaved,
    onError,
  ]);

  // Share image functionality with robust fallback strategy
  const shareImage = useCallback(async () => {
    if (!effectiveImageUrl) {
      console.warn('📤 Share button clicked but no image URL available');
      return;
    }

    try {
      console.log('📤 Share button clicked');
      console.log('📤 RNFS simulation mode:', rnfsWrapper.isSimulationMode);
      console.log(
        '📤 Image URL type:',
        effectiveImageUrl.startsWith('http') ? 'remote' : 'local',
      );
      console.log('📤 Image URL:', effectiveImageUrl.substring(0, 80) + '...');

      const isRemoteUrl =
        effectiveImageUrl.startsWith('http') ||
        effectiveImageUrl.startsWith('https');

      // STRATEGY 1: Direct URL Share (Best for remote URLs)
      // Works on iOS/Android without file system access
      if (isRemoteUrl) {
        console.log('📤 Strategy 1: Attempting direct remote URL share');

        try {
          const shareOptions = {
            url: effectiveImageUrl,
            title: storyTitle,
            message: `Check out this AI-generated illustration for my story: "${storyTitle}" 🎨\n\nCreated with CreativeBridge`,
            type: 'image/jpeg',
            filename: `${sessionId}_illustration.jpg`,
          };

          console.log('📤 Opening share sheet with direct URL');
          const result = await Share.open(shareOptions);
          console.log('📤 Direct URL share result:', result);

          if (!result.dismissedAction) {
            console.log('📊 Analytics: Image shared successfully (direct URL)');
          }
          return; // ✅ Success - exit early
        } catch (directShareError: any) {
          console.warn(
            '📤 Direct URL share failed, will try download method:',
            directShareError.message,
          );

          // If user cancelled, don't try other methods
          if (
            directShareError.message &&
            (directShareError.message.includes('User did not share') ||
              directShareError.message === 'CANCELLED')
          ) {
            console.log('📤 User cancelled direct share');
            return;
          }

          // Continue to Strategy 2 (download method)
        }
      }

      // STRATEGY 2: Cached Local File Share
      // Use already-downloaded file if available
      if (state.localPath && !state.localPath.includes('/dev/null')) {
        console.log('📤 Strategy 2: Checking for cached local file');

        try {
          const localExists = await RNFS.exists(state.localPath);
          console.log('📤 Cached file exists:', localExists);

          if (localExists) {
            let shareUrl = state.localPath;
            if (!shareUrl.startsWith('file://')) {
              shareUrl = `file://${shareUrl}`;
            }

            console.log('📤 Sharing cached local file:', shareUrl);

            const shareOptions = {
              url: shareUrl,
              title: storyTitle,
              message: `Check out this AI-generated illustration for my story: "${storyTitle}" 🎨\n\nCreated with CreativeBridge`,
              type: 'image/jpeg',
              filename: `${sessionId}_illustration.jpg`,
            };

            const result = await Share.open(shareOptions);
            console.log('📤 Cached file share result:', result);

            if (!result.dismissedAction) {
              console.log(
                '📊 Analytics: Image shared successfully (cached file)',
              );
            }
            return; // ✅ Success - exit early
          }
        } catch (cachedShareError: any) {
          console.warn(
            '📤 Cached file share failed:',
            cachedShareError.message,
          );

          // If user cancelled, exit
          if (
            cachedShareError.message &&
            (cachedShareError.message.includes('User did not share') ||
              cachedShareError.message === 'CANCELLED')
          ) {
            console.log('📤 User cancelled cached file share');
            return;
          }

          // Continue to Strategy 3 (download)
        }
      }

      // STRATEGY 3: Download and Share
      // Download remote URL to temp file, then share (only if FS is available)
      if (isRemoteUrl && !rnfsWrapper.isSimulationMode) {
        console.log('📤 Strategy 3: Downloading image for sharing');

        const timestamp = new Date().getTime();
        const filename = `share_temp_${sessionId}_${timestamp}.jpg`;
        const tempPath = `${RNFS.DocumentDirectoryPath}/${filename}`;

        console.log('📤 Download target path:', tempPath);

        try {
          const downloadResult = await RNFS.downloadFile({
            fromUrl: effectiveImageUrl,
            toFile: tempPath,
          }).promise;

          console.log('📤 Download result:', downloadResult);

          if (downloadResult.statusCode === 200) {
            const shareUrl = `file://${tempPath}`;

            const shareOptions = {
              url: shareUrl,
              title: storyTitle,
              message: `Check out this AI-generated illustration for my story: "${storyTitle}" 🎨\n\nCreated with CreativeBridge`,
              type: 'image/jpeg',
              filename: `${sessionId}_illustration.jpg`,
            };

            console.log('📤 Sharing downloaded file');
            const result = await Share.open(shareOptions);
            console.log('📤 Downloaded file share result:', result);

            // Clean up temporary file
            try {
              await RNFS.unlink(tempPath);
              console.log('📤 Cleaned up temporary share file');
            } catch (cleanupError) {
              console.log(
                '📤 Could not clean up temporary file:',
                cleanupError,
              );
            }

            if (!result.dismissedAction) {
              console.log(
                '📊 Analytics: Image shared successfully (downloaded file)',
              );
            }
            return; // ✅ Success - exit early
          }
        } catch (downloadShareError: any) {
          console.warn(
            '📤 Download and share failed:',
            downloadShareError.message,
          );

          // If user cancelled, exit
          if (
            downloadShareError.message &&
            (downloadShareError.message.includes('User did not share') ||
              downloadShareError.message === 'CANCELLED')
          ) {
            console.log('📤 User cancelled download share');
            return;
          }

          // Continue to error handling
        }
      }

      // STRATEGY 4: Local File Direct Share
      // For local file:// URLs that aren't cached
      if (!isRemoteUrl) {
        console.log('📤 Strategy 4: Sharing local file directly');

        const shareOptions = {
          url: effectiveImageUrl,
          title: storyTitle,
          message: `Check out this AI-generated illustration for my story: "${storyTitle}" 🎨\n\nCreated with CreativeBridge`,
          type: 'image/jpeg',
          filename: `${sessionId}_illustration.jpg`,
        };

        const result = await Share.open(shareOptions);
        console.log('📤 Local file share result:', result);

        if (!result.dismissedAction) {
          console.log('📊 Analytics: Image shared successfully (local file)');
        }
        return; // ✅ Success - exit early
      }

      // If we got here, all strategies failed
      throw new Error('All share strategies exhausted - unable to share image');
    } catch (error: any) {
      console.error('📤 Share failed with error:', error);
      console.error('📤 Error message:', error.message);

      // Precise cancellation detection (only exact matches)
      const errorMsg = error.message || '';
      const isCancellation =
        errorMsg === 'CANCELLED' ||
        errorMsg === 'User did not share' ||
        errorMsg.startsWith('User cancelled');

      if (isCancellation) {
        console.log('📤 User cancelled share - no error shown');
        return;
      }

      // Show user-friendly error message
      let userMessage = 'Could not share your image. ';

      if (
        errorMsg.includes('file system not properly initialized') ||
        rnfsWrapper.isSimulationMode
      ) {
        userMessage +=
          'This feature requires a physical device for full functionality.';
      } else if (
        errorMsg.includes('not available') ||
        errorMsg.includes('not properly loaded')
      ) {
        userMessage +=
          'The sharing feature is temporarily unavailable. Please try again.';
      } else if (errorMsg.includes('Download failed')) {
        userMessage +=
          'Failed to download the image. Please check your internet connection.';
      } else if (errorMsg.includes('File not found')) {
        userMessage += 'The image file could not be found.';
      } else {
        userMessage += `Error: ${errorMsg}`;
      }

      Alert.alert('📤 Share Failed', userMessage, [{ text: 'OK' }]);
    }
  }, [effectiveImageUrl, storyTitle, sessionId, state.localPath]);

  // Save image to Photos (Camera Roll) — US-003
  const handleSaveToPhotos = useCallback(async () => {
    if (!effectiveImageUrl || state.isSavingToPhotos) return;

    // Step 1: Request permission
    const hasPermission = await requestPhotoLibraryPermission();
    if (!hasPermission) return;

    setState(prev => ({ ...prev, isSavingToPhotos: true }));

    try {
      // Step 2: Resolve local file path (reuse cache or download)
      let localPath = state.localPath;

      // Handle file:// URLs — already local, just strip the protocol
      if (!localPath && effectiveImageUrl?.startsWith('file://')) {
        localPath = effectiveImageUrl.replace('file://', '');
      }

      if (!localPath && !rnfsWrapper.isSimulationMode) {
        const cacheDir = `${RNFS.DocumentDirectoryPath}/ImageCache`;
        const dirExists = await RNFS.exists(cacheDir);
        if (!dirExists) {
          await RNFS.mkdir(cacheDir);
        }

        const urlHash = effectiveImageUrl
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(-40);
        const filename = `cached_${urlHash}.jpg`;
        localPath = `${cacheDir}/${filename}`;

        const fileExists = await RNFS.exists(localPath);
        if (!fileExists) {
          console.log('📸 [SaveToPhotos] Downloading image for save...');
          const downloadResult = await RNFS.downloadFile({
            fromUrl: effectiveImageUrl,
            toFile: localPath,
          }).promise;

          if (downloadResult.statusCode !== 200) {
            throw new Error(
              `Download failed with status: ${downloadResult.statusCode}`,
            );
          }
        }
      }

      if (!localPath) {
        throw new Error('Could not resolve local file path for image');
      }

      // Step 3: Save to Camera Roll
      const result = await saveImageToPhotos(localPath);

      if (result.success) {
        Alert.alert(
          'Saved to Photos!',
          'Your story illustration has been saved to your Photo Library.',
          [{ text: 'Great!', style: 'default' }],
        );
        onImageSaved?.(localPath);
      } else {
        throw new Error(result.error || 'Unknown error saving to Photos');
      }
    } catch (error: any) {
      console.error('📸 [SaveToPhotos] Error:', error);
      Alert.alert(
        'Save Failed',
        error.message || 'Could not save image to Photos. Please try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Try Again', onPress: () => handleSaveToPhotos() },
        ],
      );
    } finally {
      setState(prev => ({ ...prev, isSavingToPhotos: false }));
    }
  }, [
    effectiveImageUrl,
    state.localPath,
    state.isSavingToPhotos,
    onImageSaved,
  ]);

  // Enhanced full-screen functionality
  const createStoryImageForModal = useCallback((): StoryImage => {
    return {
      id: sessionId,
      url: effectiveImageUrl || '',
      title: storyTitle,
      storyText,
      createdAt,
      sessionId,
      metadata: metadata
        ? {
            localPath: undefined,
            downloadedAt: undefined,
            size: undefined,
            dimensions: undefined,
          }
        : undefined,
    };
  }, [
    sessionId,
    effectiveImageUrl,
    storyTitle,
    storyText,
    createdAt,
    metadata,
  ]);

  const handleImagePress = useCallback(() => {
    if (!enableFullScreen || !effectiveImageUrl) return;

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
      imageUrl: effectiveImageUrl?.substring(0, 50) + '...',
      storyTitle,
      timestamp: new Date().toISOString(),
    });
  }, [
    enableFullScreen,
    effectiveImageUrl,
    onFullScreenOpen,
    sessionId,
    storyTitle,
  ]);

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
      effectiveImageUrl?.substring(0, 50) + '...',
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
  }, [effectiveImageUrl]);

  const handleImageError = useCallback(
    async (error?: any) => {
      console.error(
        '🖼️ [DEBUG] Image failed to load:',
        effectiveImageUrl?.substring(0, 50) + '...',
        error,
      );

      // Clear any existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

      // NEW: Fallback logic - if Supabase URL failed and we have Replicate URL, try that
      if (supabaseUrl && replicateUrl && !state.attemptedSupabaseUrl) {
        console.log(
          '🖼️ [DEBUG] Supabase URL failed, attempting fallback to Replicate URL',
        );
        setState(prev => ({
          ...prev,
          attemptedSupabaseUrl: true,
          currentUrlSource: 'replicate',
          isLoading: true,
          hasError: false,
        }));
        return; // Component will re-render with Replicate URL
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
      } else if (effectiveImageUrl) {
        // Check if the image URL is accessible
        const urlCheck = await checkImageAvailability(effectiveImageUrl);
        errorType =
          (urlCheck.errorType as ImageState['errorType']) || 'unknown';
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
    [
      onError,
      effectiveImageUrl,
      supabaseUrl,
      replicateUrl,
      state.isConnected,
      state.attemptedSupabaseUrl,
      checkImageAvailability,
    ],
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
              'This AI-generated image has expired from the server. This is normal for AI image services to save storage space. You can generate a new illustration for this story.',
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
                    // Instead of just showing an alert, provide a more helpful experience
                    Alert.alert(
                      '🎨 Regenerate Image',
                      'This AI-generated image has expired from the server. Would you like to generate a fresh illustration for your story?',
                      [
                        { text: 'Maybe Later', style: 'cancel' },
                        {
                          text: 'Generate New Image',
                          style: 'default',
                          onPress: () => {
                            // Call the onBackToOptions callback and user can choose image generation
                            onBackToOptions?.();
                          },
                        },
                      ],
                    );
                  }}
                >
                  <Text style={styles.generateNewButtonText}>
                    🎨 Generate New
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.openUrlButton}
                  onPress={() => {
                    console.log(
                      '🖼️ [DEBUG] User opening image URL externally (via parental gate)',
                    );
                    openURL(imageUrl);
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

  // NEW: Render upload status badge (Task 4.2)
  const renderUploadStatusBadge = () => {
    // Only show upload status if we have new props and an image is displayed
    if (!uploadStatus || state.hasError || !effectiveImageUrl) return null;
    // Suppress transient "backing up" UI — only show terminal states
    if (uploadStatus === 'pending') return null;

    return (
      <View style={styles.uploadStatusBadgeContainer}>
        {uploadStatus === 'uploaded' && (
          <View style={[styles.uploadStatusBadge, styles.uploadSuccessBadge]}>
            <Text style={styles.uploadSuccessIcon}>✅</Text>
            <Text style={styles.uploadSuccessText}>Permanently saved</Text>
          </View>
        )}

        {uploadStatus === 'failed' && (
          <View style={[styles.uploadStatusBadge, styles.uploadFailedBadge]}>
            <View style={styles.uploadFailedHeader}>
              <Text style={styles.uploadFailedIcon}>⚠️</Text>
              <Text style={styles.uploadFailedText}>
                Backup failed (image still available)
              </Text>
            </View>
            {onRetryUpload && (
              <TouchableOpacity
                style={styles.retryBackupButton}
                onPress={onRetryUpload}
              >
                <Text style={styles.retryBackupButtonText}>Retry Backup</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  // Render download/share action buttons
  const renderDownloadShareButtons = () => {
    if (!effectiveImageUrl || state.hasError) return null;

    return (
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
                <Text
                  style={styles.actionButtonText}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  Save Image
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.photosButton,
            state.isSavingToPhotos && styles.actionButtonDisabled,
          ]}
          onPress={handleSaveToPhotos}
          disabled={state.isSavingToPhotos}
        >
          {state.isSavingToPhotos ? (
            <View style={styles.downloadingContent}>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text
                style={styles.actionButtonText}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                Saving...
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.actionButtonIcon}>🖼️</Text>
              <Text
                style={styles.actionButtonText}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                Photos
              </Text>
            </>
          )}
        </TouchableOpacity>

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
    );
  };

  // Render back button (independent of image state)
  const renderBackButton = () => {
    if (!showBackButton || !onBackToOptions) return null;

    return (
      <View style={styles.backButtonContainer}>
        <TouchableOpacity
          style={styles.backToOptionsButton}
          onPress={onBackToOptions}
        >
          <Text style={styles.backButtonIcon}>←</Text>
          <Text style={styles.backButtonText}>Back to Options</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Auto-download external URLs for reliable local display
  React.useEffect(() => {
    if (
      effectiveImageUrl &&
      state.isLoading &&
      !state.isDownloadingForDisplay &&
      !state.hasError
    ) {
      // Prevent infinite loops by checking if this URL already failed
      if (failedUrlsRef.current.has(effectiveImageUrl)) {
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
        effectiveImageUrl.substring(0, 50) + '...',
      );

      // Check for test URLs first to avoid unnecessary network calls
      const isTestUrl =
        effectiveImageUrl.includes('backup-service.com') ||
        effectiveImageUrl.includes('example.com') ||
        effectiveImageUrl.includes('test-') ||
        effectiveImageUrl.includes('mock-') ||
        effectiveImageUrl.includes('dall-e-generated-image');

      if (isTestUrl) {
        console.log(
          '🖼️ [DEBUG] Detected test/development URL, showing appropriate message',
        );
        failedUrlsRef.current.add(effectiveImageUrl);
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
        effectiveImageUrl.startsWith('http') &&
        !effectiveImageUrl.startsWith('file://');

      if (isExternalUrl) {
        console.log(
          '🖼️ [DEBUG] External URL detected, downloading for local display',
        );
        downloadImageForDisplay(effectiveImageUrl).then(localPath => {
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
          } else if (rnfsWrapper.isSimulationMode) {
            console.log(
              '🖼️ [DEBUG] Simulation mode - using original URL directly',
            );
            setState(prev => ({
              ...prev,
              isLoading: false,
              hasError: false,
              localPath: undefined, // Use original URL
            }));
          } else {
            console.log(
              '🖼️ [DEBUG] Failed to cache image, marking as failed to prevent retries',
            );
            failedUrlsRef.current.add(effectiveImageUrl);
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
    effectiveImageUrl,
    state.isLoading,
    state.isDownloadingForDisplay,
    state.hasError,
    downloadImageForDisplay,
  ]);

  // Main render
  console.log('🖼️ [DEBUG] StoryImageDisplay render:', {
    effectiveImageUrl: effectiveImageUrl?.substring(0, 50) + '...',
    supabaseUrl: supabaseUrl?.substring(0, 50) + '...',
    replicateUrl: replicateUrl?.substring(0, 50) + '...',
    uploadStatus,
    currentUrlSource: state.currentUrlSource,
    attemptedSupabaseUrl: state.attemptedSupabaseUrl,
    localPath: state.localPath?.substring(0, 50) + '...',
    hasEffectiveImageUrl: !!effectiveImageUrl,
    hasLocalPath: !!state.localPath,
    storyTitle,
    sessionId,
    isLoading: state.isLoading,
    isDownloadingForDisplay: state.isDownloadingForDisplay,
    hasError: state.hasError,
  });

  if (!effectiveImageUrl) {
    console.log('🖼️ [DEBUG] No effectiveImageUrl, showing placeholder');
    return (
      <View style={[getContainerStyle(), style]}>{renderPlaceholder()}</View>
    );
  }

  if (state.hasError) {
    return (
      <View style={[getContainerStyle(), style]}>
        {renderError()}
        {renderBackButton()}
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
                  uri:
                    state.attemptedSupabaseUrl && replicateUrl
                      ? state.localPath || replicateUrl
                      : state.localPath || effectiveImageUrl,
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
                    state.localPath || effectiveImageUrl,
                  );
                  handleImageError(error.nativeEvent);
                }}
                onLoadStart={() => {
                  console.log(
                    '🖼️ [DEBUG] Image load started for:',
                    (state.localPath || effectiveImageUrl || '').substring(
                      0,
                      50,
                    ) + '...',
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
                uri:
                  state.attemptedSupabaseUrl && replicateUrl
                    ? state.localPath || replicateUrl
                    : state.localPath || effectiveImageUrl,
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
                  state.localPath || effectiveImageUrl,
                );
                handleImageError(error.nativeEvent);
              }}
              onLoadStart={() => {
                console.log(
                  '🖼️ [DEBUG] Image load started for:',
                  (state.localPath || effectiveImageUrl || '').substring(
                    0,
                    50,
                  ) + '...',
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
        {renderUploadStatusBadge()}
        {renderDownloadShareButtons()}
        {renderBackButton()}
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
          onSaveToPhotos={() => handleSaveToPhotos()}
          darkMode={true}
        />
      )}

      {/* US-009: Parental Gate for external links */}
      {parentalGateModal}
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
    fontSize: 50,
    marginBottom: 12,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 8,
    textAlign: 'center',
  },
  placeholderMessage: {
    fontSize: 16,
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
    fontSize: 34,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#721c24',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
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
    fontSize: 16,
    fontWeight: '600',
  },
  errorUrl: {
    fontSize: 12,
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
    fontSize: 14,
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
    fontSize: 14,
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
    fontSize: 16,
    color: '#6c757d',
    marginTop: 12,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
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
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Action Buttons
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    minHeight: 44,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  downloadButton: {
    backgroundColor: '#28a745',
  },
  photosButton: {
    backgroundColor: '#17a2b8',
  },
  shareButton: {
    backgroundColor: '#007bff',
  },
  actionButtonIcon: {
    fontSize: 18,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
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
    fontSize: 18,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
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
    fontSize: 18,
    color: '#ffffff',
  },

  // NEW: Upload status badge styles (Task 4.2)
  uploadStatusBadgeContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  uploadStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
    gap: 8,
  },
  uploadStatusText: {
    fontSize: 15,
    color: '#6c757d',
    fontWeight: '500',
  },
  uploadSuccessBadge: {
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
  },
  uploadSuccessIcon: {
    fontSize: 18,
  },
  uploadSuccessText: {
    fontSize: 15,
    color: '#155724',
    fontWeight: '600',
  },
  uploadFailedBadge: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    flexDirection: 'column',
    gap: 8,
  },
  uploadFailedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadFailedIcon: {
    fontSize: 18,
  },
  uploadFailedText: {
    fontSize: 15,
    color: '#856404',
    fontWeight: '500',
    flex: 1,
  },
  retryBackupButton: {
    backgroundColor: '#6f42c1',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  retryBackupButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default StoryImageDisplay;
