import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Modal,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  Platform,
  Image,
  ScrollView,
} from 'react-native';
// Temporarily disabled Reanimated until native module is properly configured
// import Animated, {
//   useSharedValue,
//   useAnimatedStyle,
//   withSpring,
//   withTiming,
//   runOnJS,
// } from 'react-native-reanimated';
// Removed ImageViewer in favor of custom edge-to-edge implementation

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Story image interface for gallery navigation
export interface StoryImage {
  id: string;
  url: string;
  title?: string;
  storyText?: string;
  createdAt?: string;
  sessionId?: string;
  metadata?: {
    localPath?: string;
    downloadedAt?: string;
    size?: number;
    dimensions?: {
      width: number;
      height: number;
    };
    gradeLevel?: string;
    wordCount?: number;
    artStyle?: string;
    [key: string]: any;
  };
}

// Enhanced full-screen modal props
export interface FullScreenImageModalProps {
  visible: boolean;
  onClose: () => void;
  images: StoryImage[];
  initialIndex?: number;
  enableSwipeNavigation?: boolean;
  enableZoom?: boolean;
  enableStoryOverlay?: boolean;
  showImageInfo?: boolean;
  onImageChange?: (index: number, image: StoryImage) => void;
  onShare?: (image: StoryImage) => void;
  onDownload?: (image: StoryImage) => void;
  onSaveToPhotos?: (image: StoryImage) => void;
  darkMode?: boolean;
}

// Animation configuration constants (temporarily disabled)
// const ZOOM_MIN = 1;
// const ZOOM_MAX = 5;
// const SPRING_CONFIG = {
//   damping: 15,
//   mass: 1,
//   stiffness: 120,
//   overshootClamping: false,
//   restDisplacementThreshold: 0.01,
//   restSpeedThreshold: 0.01,
// };

// Styles need to be defined before use
const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0, // Remove top padding to expand image area
    paddingBottom: 0, // Remove bottom padding to expand image area
    paddingHorizontal: 0, // Remove horizontal padding to expand image area
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)', // Darker overlay for better contrast
  },
  darkBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  imageContainer: {
    flex: 1,
    width: screenWidth, // Full screen width for maximum image display
    height: screenHeight, // Full screen height for maximum image display
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 0, // Remove border radius for edge-to-edge display
    overflow: 'hidden',
  },
  imageViewer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  // Custom image styles for true edge-to-edge
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollViewContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  imageWrapper: {
    width: screenWidth,
    height: screenHeight,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  fullScreenImage: {
    width: screenWidth,
    height: screenHeight,
    backgroundColor: 'transparent',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'box-none',
  },
  overlayVisible: {
    opacity: 1,
  },
  overlayHidden: {
    opacity: 0,
  },
  header: {
    position: 'absolute',
    top: 0, // Position at the very top for full-screen experience
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    padding: 8,
  },
  headerButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  imageTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  storyText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.9,
  },
  imageCounter: {
    color: '#ffffff',
    fontSize: 16,
    opacity: 0.8,
  },
  actionBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 34 : 10, // Minimal bottom spacing
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    paddingVertical: 16,
  },
  actionButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    minWidth: 80,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  activeIndicator: {
    backgroundColor: '#ffffff',
  },
  // Additional styles for overlay components
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  imageInfo: {
    flex: 1,
    alignItems: 'center',
  },
  imageIndex: {
    color: '#ffffff',
    fontSize: 16,
    opacity: 0.8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  footer: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12, // Reduce padding to minimize space usage
  },
  storyOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12, // Reduce padding to minimize space usage
    borderRadius: 8,
    margin: 8, // Reduce margin to minimize space usage
  },
  storyTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  metadata: {
    color: '#ffffff',
    fontSize: 16,
    opacity: 0.8,
  },
  navigationIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
});

// Loading indicator component - removed as we now use native Image loading

const FullScreenImageModal: React.FC<FullScreenImageModalProps> = ({
  visible,
  onClose,
  images,
  initialIndex = 0,
  enableSwipeNavigation: _enableSwipeNavigation = true,
  enableZoom = true,
  enableStoryOverlay = true,
  showImageInfo: _showImageInfo = true,
  onImageChange: _onImageChange,
  onShare,
  onDownload,
  onSaveToPhotos,
  darkMode = true,
}) => {
  // State management
  const [currentIndex, _setCurrentIndex] = useState(initialIndex);
  const [showOverlay] = useState(true);
  const [overlayVisible, setOverlayVisible] = useState(true);

  // Animation temporarily disabled
  // const modalOpacity = useSharedValue(0);
  // const modalScale = useSharedValue(0.8);
  // const overlayOpacity = useSharedValue(1);

  // Current image reference
  const currentImage = images[currentIndex];

  // Debug logging
  useEffect(() => {
    if (visible && currentImage) {
      console.log('🖼️ [FullScreenModal] Opening with image:', {
        url: currentImage.url?.substring(0, 50) + '...',
        title: currentImage.title,
        hasUrl: !!currentImage.url,
      });
    }
  }, [visible, currentImage]);

  // Animation temporarily disabled
  // useEffect(() => {
  //   if (visible) {
  //     modalOpacity.value = withTiming(1, { duration: 250 });
  //     modalScale.value = withSpring(1);
  //   }
  // }, [visible]);

  // Handle overlay toggle
  const handleImageTap = useCallback(() => {
    setOverlayVisible(!overlayVisible);
    // overlayOpacity.value = withTiming(overlayVisible ? 0 : 1, { duration: 200 });
  }, [overlayVisible]);

  // Navigation functions (temporarily disabled)
  // const navigateToNext = useCallback(() => {
  //   if (currentIndex < images.length - 1) {
  //     const newIndex = currentIndex + 1;
  //     setCurrentIndex(newIndex);
  //     onImageChange?.(newIndex, images[newIndex]);
  //   }
  // }, [currentIndex, images, onImageChange]);

  // const navigateToPrevious = useCallback(() => {
  //   if (currentIndex > 0) {
  //     const newIndex = currentIndex - 1;
  //     setCurrentIndex(newIndex);
  //     onImageChange?.(newIndex, images[newIndex]);
  //   }
  // }, [currentIndex, images, onImageChange]);

  // Close modal with animation
  const handleClose = useCallback(() => {
    // modalOpacity.value = withTiming(0, { duration: 250 }, () => {
    //   runOnJS(onClose)();
    // });
    onClose();
  }, [onClose]);

  // Enhanced overlay component
  const renderOverlay = () => {
    if (!showOverlay || !currentImage) return null;

    return (
      <View
        style={[
          styles.overlay,
          overlayVisible ? styles.overlayVisible : styles.overlayHidden,
        ]}
      >
        {/* Header */}
        <SafeAreaView style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.imageInfo}>
              <Text style={styles.imageTitle} numberOfLines={2}>
                {currentImage.title || 'Story Image'}
              </Text>
              <Text style={styles.imageIndex}>
                {currentIndex + 1} of {images.length}
              </Text>
            </View>

            <View style={styles.headerActions}>
              {onShare && (
                <TouchableOpacity
                  onPress={() => onShare(currentImage)}
                  style={styles.headerButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.headerButtonText}>📤</Text>
                </TouchableOpacity>
              )}
              {onDownload && (
                <TouchableOpacity
                  onPress={() => onDownload(currentImage)}
                  style={styles.headerButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.headerButtonText}>💾</Text>
                </TouchableOpacity>
              )}
              {onSaveToPhotos && (
                <TouchableOpacity
                  onPress={() => onSaveToPhotos(currentImage)}
                  style={styles.headerButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.headerButtonText}>📸</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </SafeAreaView>

        {/* Story overlay */}
        {enableStoryOverlay && currentImage.storyText && (
          <SafeAreaView style={styles.footer}>
            <View style={styles.storyOverlay}>
              <Text style={styles.storyTitle} numberOfLines={1}>
                {currentImage.title}
              </Text>
              <Text style={styles.storyText} numberOfLines={3}>
                {currentImage.storyText}
              </Text>
              {currentImage.metadata && (
                <Text style={styles.metadata} numberOfLines={1}>
                  Created:{' '}
                  {new Date(currentImage.createdAt || '').toLocaleDateString()}
                </Text>
              )}
            </View>
          </SafeAreaView>
        )}

        {/* Navigation indicators */}
        {images.length > 1 && (
          <View style={styles.navigationIndicators}>
            {images.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.indicator,
                  index === currentIndex && styles.activeIndicator,
                ]}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  if (!visible || images.length === 0) {
    return null;
  }

  if (!currentImage || !currentImage.url) {
    console.error(
      '🖼️ [FullScreenModal] No valid image to display:',
      currentImage,
    );
    return null;
  }

  console.log(
    '🔥 [DEBUG] FullScreenImageModal rendering with custom implementation!',
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={[styles.modalContainer]}>
        <View style={[styles.background, darkMode && styles.darkBackground]} />

        {/* Image viewer - Custom implementation for true edge-to-edge */}
        <View style={styles.imageContainer}>
          {enableZoom ? (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollViewContent}
              maximumZoomScale={3}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              bounces={false}
              bouncesZoom={true}
            >
              <TouchableOpacity
                style={styles.imageWrapper}
                onPress={handleImageTap}
                activeOpacity={1}
              >
                <Image
                  source={{ uri: currentImage.url }}
                  style={styles.fullScreenImage}
                  resizeMode="contain"
                  onError={error => {
                    console.error(
                      '🖼️ [FullScreenModal] Image load error:',
                      error,
                    );
                  }}
                  onLoad={() => {
                    console.log(
                      '🖼️ [FullScreenModal] Image loaded successfully',
                    );
                  }}
                />
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <TouchableOpacity
              style={styles.imageWrapper}
              onPress={handleImageTap}
              activeOpacity={1}
            >
              <Image
                source={{ uri: currentImage.url }}
                style={styles.fullScreenImage}
                resizeMode="contain"
                onError={error => {
                  console.error(
                    '🖼️ [FullScreenModal] Image load error:',
                    error,
                  );
                }}
                onLoad={() => {
                  console.log('🖼️ [FullScreenModal] Image loaded successfully');
                }}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Overlay content */}
        {renderOverlay()}
      </View>
    </Modal>
  );
};

export default FullScreenImageModal;
