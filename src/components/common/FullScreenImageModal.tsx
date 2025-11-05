import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Modal,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
// Temporarily disabled Reanimated until native module is properly configured
// import Animated, {
//   useSharedValue,
//   useAnimatedStyle,
//   withSpring,
//   withTiming,
//   runOnJS,
// } from 'react-native-reanimated';
import ImageViewer from 'react-native-image-zoom-viewer';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Story image interface for gallery navigation
export interface StoryImage {
  id: string;
  url: string;
  title: string;
  storyText?: string;
  createdAt: string;
  sessionId: string;
  metadata?: {
    gradeLevel?: string;
    wordCount?: number;
    generationTime?: number;
    artStyle?: string;
  };
}

// Modal configuration interface
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
  darkMode?: boolean;
}

// Animation configuration constants
const ZOOM_MIN = 1;
const ZOOM_MAX = 5;
const SPRING_CONFIG = {
  damping: 15,
  mass: 1,
  stiffness: 120,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

const FullScreenImageModal: React.FC<FullScreenImageModalProps> = ({
  visible,
  onClose,
  images,
  initialIndex = 0,
  enableSwipeNavigation = true,
  enableZoom = true,
  enableStoryOverlay = true,
  showImageInfo = true,
  onImageChange,
  onShare,
  onDownload,
  darkMode = true,
}) => {
  // State management
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showOverlay, setShowOverlay] = useState(true);
  const [overlayVisible, setOverlayVisible] = useState(true);

  // Animation temporarily disabled
  // const modalOpacity = useSharedValue(0);
  // const modalScale = useSharedValue(0.8);
  // const overlayOpacity = useSharedValue(1);

  // Current image reference
  const currentImage = images[currentIndex];

  // Animation temporarily disabled
  // useEffect(() => {
  //   if (visible) {
  //     modalOpacity.value = withTiming(1, { duration: 300 });
  //     modalScale.value = withSpring(1, SPRING_CONFIG);
  //   } else {
  //     modalOpacity.value = withTiming(0, { duration: 250 });
  //     modalScale.value = withTiming(0.8, { duration: 250 });
  //   }
  // }, [visible]);

  // Handle index changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Toggle overlay visibility
  const toggleOverlay = useCallback(() => {
    setOverlayVisible(!overlayVisible);
    // overlayOpacity.value = withTiming(overlayVisible ? 0 : 1, { duration: 200 });
  }, [overlayVisible]);

  // Navigation functions
  const navigateToNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      onImageChange?.(newIndex, images[newIndex]);
    }
  }, [currentIndex, images, onImageChange]);

  const navigateToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      onImageChange?.(newIndex, images[newIndex]);
    }
  }, [currentIndex, images, onImageChange]);

  // Close modal with animation
  const handleClose = useCallback(() => {
    // modalOpacity.value = withTiming(0, { duration: 250 }, () => {
    //   runOnJS(onClose)();
    // });
    // modalScale.value = withTiming(0.8, { duration: 250 });
    onClose();
  }, [onClose]);

  // Share current image
  const handleShare = useCallback(() => {
    if (currentImage && onShare) {
      onShare(currentImage);
    }
  }, [currentImage, onShare]);

  // Download current image
  const handleDownload = useCallback(() => {
    if (currentImage && onDownload) {
      onDownload(currentImage);
    }
  }, [currentImage, onDownload]);

  // Handle image tap to toggle overlay
  const handleImageTap = useCallback(() => {
    toggleOverlay();
  }, [toggleOverlay]);

  // Animated styles temporarily disabled
  // const modalAnimatedStyle = useAnimatedStyle(() => ({
  //   opacity: modalOpacity.value,
  //   transform: [{ scale: modalScale.value }],
  // }));

  // const overlayAnimatedStyle = useAnimatedStyle(() => ({
  //   opacity: overlayOpacity.value,
  // }));

  // Render overlay content
  const renderOverlay = () => {
    if (!showOverlay || !currentImage) return null;

    return (
      <View style={[styles.overlay, overlayVisible ? {} : { opacity: 0 }]}>
        {/* Header */}
        <SafeAreaView style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>

            {showImageInfo && (
              <View style={styles.imageInfo}>
                <Text style={styles.imageTitle} numberOfLines={1}>
                  {currentImage.title}
                </Text>
                <Text style={styles.imageIndex}>
                  {currentIndex + 1} of {images.length}
                </Text>
              </View>
            )}

            <View style={styles.headerActions}>
              {onShare && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleShare}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.actionButtonText}>📤</Text>
                </TouchableOpacity>
              )}
              {onDownload && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleDownload}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.actionButtonText}>📥</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </SafeAreaView>

        {/* Footer with story information */}
        {enableStoryOverlay && currentImage.storyText && (
          <SafeAreaView style={styles.footer}>
            <View style={styles.storyOverlay}>
              <Text style={styles.storyTitle}>Story Context</Text>
              <Text style={styles.storyText} numberOfLines={3}>
                {currentImage.storyText}
              </Text>
              {currentImage.metadata && (
                <Text style={styles.metadata}>
                  {currentImage.metadata.gradeLevel &&
                    `Grade: ${currentImage.metadata.gradeLevel}`}
                  {currentImage.metadata.wordCount &&
                    ` • ${currentImage.metadata.wordCount} words`}
                </Text>
              )}
            </View>
          </SafeAreaView>
        )}

        {/* Navigation indicators */}
        {enableSwipeNavigation && images.length > 1 && (
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <StatusBar
        barStyle={darkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      <View style={[styles.modalContainer]}>
        <View style={[styles.background, darkMode && styles.darkBackground]} />

        {/* Image viewer */}
        <View style={styles.imageContainer}>
          <ImageViewer
            imageUrls={[{ url: currentImage.url }]}
            index={0}
            renderHeader={() => <View />}
            renderFooter={() => <View />}
            enableSwipeDown={false}
            enableImageZoom={enableZoom}
            style={styles.imageViewer}
            backgroundColor="transparent"
            onClick={handleImageTap}
            onSwipeDown={handleClose}
            swipeDownThreshold={50}
          />
        </View>

        {/* Overlay content */}
        {renderOverlay()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  darkBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  imageContainer: {
    flex: 1,
    width: screenWidth,
    height: screenHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: screenWidth,
    height: screenHeight,
  },
  imageViewer: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'box-none',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  imageInfo: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  imageTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  imageIndex: {
    color: '#cccccc',
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 18,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  storyOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  storyTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  storyText: {
    color: '#cccccc',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  metadata: {
    color: '#999999',
    fontSize: 12,
  },
  navigationIndicators: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 120 : 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
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
});

export default FullScreenImageModal;
