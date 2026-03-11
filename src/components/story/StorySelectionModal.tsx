// Story Selection Modal Component
// Displays a searchable, filterable list of user stories for selection

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Dimensions,
  Image,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { GameSession, StorySource } from '../../types/database';
import { StoryManagementService } from '../../services/storyManagementService';
import Share from '../../utils/shareWrapper';
import RNFS from '../../utils/rnfsWrapper';
import FolderPickerUtil from '../../utils/folderPicker';

// Dimensions available for future responsive design
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { width, height } = Dimensions.get('window');

export interface StorySelectionModalProps {
  visible?: boolean; // Optional, kept for API compatibility but not used internally
  onClose: () => void;
  onStorySelect: (story: GameSession) => void;
  userId: string;
  title?: string;
  showOnlyCompleted?: boolean;
  excludeStoryIds?: string[];
  initialSource?: StorySource;
  /** When false, hides the built-in header (useful when rendered inside a navigation stack that already provides a header) */
  showHeader?: boolean;
}

interface FilterState {
  source: StorySource | 'All';
  dateRange: 'all' | 'week' | 'month' | 'year';
  completedOnly: boolean;
}

interface StoryCardProps {
  story: GameSession;
  onPress: () => void;
  searchTerm?: string;
}

const StoryCard: React.FC<StoryCardProps> = ({
  story,
  onPress,
  searchTerm,
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get image URL with priority: Supabase > Replicate > none
  const getImageUrl = () => {
    if (story.supabase_image_url) {
      return story.supabase_image_url;
    }
    if (story.generated_image_url) {
      return story.generated_image_url;
    }
    return null;
  };

  const imageUrl = getImageUrl();
  const hasImage = !!imageUrl;
  const uploadStatus = story.image_upload_status;

  const getSourceColor = (source: StorySource) => {
    switch (source) {
      case 'CreativeBridge':
        return '#4CAF50';
      case 'Story_Quest':
        return '#2196F3';
      case 'File':
        return '#FF9800';
      case 'New':
        return '#9C27B0';
      default:
        return '#757575';
    }
  };

  const getStoryTitle = (storyItem: GameSession) => {
    // Try to extract title from metadata first
    if (storyItem.story_metadata?.title) {
      return storyItem.story_metadata.title;
    }

    // Extract from content (first line if it looks like a title)
    if (storyItem.story_content) {
      const firstLine = storyItem.story_content.split('\n')[0].trim();
      if (
        firstLine.length > 0 &&
        firstLine.length < 60 &&
        !firstLine.endsWith('.')
      ) {
        return firstLine;
      }
    }

    // Fallback to truncated content
    const content =
      storyItem.story_content || storyItem.imported_story_content || '';
    return content.length > 40 ? `${content.substring(0, 40)}...` : content;
  };

  const getStoryPreview = (storyItem: GameSession) => {
    const content =
      storyItem.story_content || storyItem.imported_story_content || '';
    const lines = content.split('\n').filter(line => line.trim().length > 0);

    // Skip first line if it's being used as title
    const storyTitle = getStoryTitle(storyItem);
    const isFirstLineTitle = lines[0] && lines[0].trim() === storyTitle;
    const previewLines = isFirstLineTitle ? lines.slice(1) : lines;

    const preview = previewLines.join(' ').substring(0, 120);
    return preview.length < content.length ? `${preview}...` : preview;
  };

  const getActualWordCount = (storyItem: GameSession) => {
    // If words_written is set and non-zero, use it
    if (storyItem.words_written > 0) {
      return storyItem.words_written;
    }

    // Otherwise, calculate from content
    const content =
      storyItem.story_content || storyItem.imported_story_content || '';
    if (!content.trim()) return 0;

    return content
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0).length;
  };

  const highlightSearchTerm = (text: string, term?: string) => {
    if (!term || !text) return text;

    const regex = new RegExp(`(${term})`, 'gi');
    const parts = text.split(regex);

    return parts
      .map((part, index) =>
        regex.test(part) ? (
          <Text key={index} style={styles.highlightedText}>
            {part}
          </Text>
        ) : (
          part
        ),
      )
      .join('');
  };

  const title = getStoryTitle(story);
  const preview = getStoryPreview(story);
  const sourceColor = getSourceColor(story.story_source);

  // Handle long-press on thumbnail for download/share
  const handleThumbnailLongPress = useCallback(() => {
    if (!hasImage || !imageUrl || imageError) return;

    const storyTitle = getStoryTitle(story);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Download Image', 'Share Image'],
          cancelButtonIndex: 0,
          title: storyTitle,
        },
        async buttonIndex => {
          if (buttonIndex === 1) {
            // Download
            await downloadImage();
          } else if (buttonIndex === 2) {
            // Share
            await shareImage();
          }
        },
      );
    } else {
      // Android fallback - show simple alert with options
      Alert.alert(storyTitle, 'What would you like to do with this image?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Download', onPress: () => downloadImage() },
        { text: 'Share', onPress: () => shareImage() },
      ]);
    }
  }, [hasImage, imageUrl, imageError, story]);

  // Download image to device
  const downloadImage = useCallback(async () => {
    if (!imageUrl) return;

    try {
      const timestamp = new Date().getTime();
      const filename = `story_${story.id}_${timestamp}.jpg`;
      const tempPath = `${RNFS.DocumentDirectoryPath}/${filename}`;

      // Download the image
      const downloadResult = await RNFS.downloadFile({
        fromUrl: imageUrl,
        toFile: tempPath,
      }).promise;

      if (downloadResult.statusCode !== 200) {
        throw new Error(
          `Download failed with status: ${downloadResult.statusCode}`,
        );
      }

      // Use folder picker to save
      const saveResult = await FolderPickerUtil.saveToUserSelectedFolder({
        sourceFilePath: tempPath,
        fileName: filename,
        title: 'Save Story Image',
      });

      if (saveResult.success) {
        Alert.alert('✅ Saved!', 'Image saved successfully!');
      } else if (!saveResult.cancelled) {
        throw new Error(saveResult.error || 'Save failed');
      }

      // Clean up temp file
      await RNFS.unlink(tempPath);
    } catch (error: any) {
      console.error('Download failed:', error);
      Alert.alert(
        '❌ Download Failed',
        error.message || 'Could not download image',
      );
    }
  }, [imageUrl, story.id]);

  // Share image
  const shareImage = useCallback(async () => {
    if (!imageUrl) return;

    try {
      const timestamp = new Date().getTime();
      const filename = `story_${story.id}_${timestamp}.jpg`;
      const tempPath = `${RNFS.DocumentDirectoryPath}/${filename}`;

      // Download for sharing
      const downloadResult = await RNFS.downloadFile({
        fromUrl: imageUrl,
        toFile: tempPath,
      }).promise;

      if (downloadResult.statusCode !== 200) {
        throw new Error(
          `Download failed with status: ${downloadResult.statusCode}`,
        );
      }

      const shareUrl = `file://${tempPath}`;
      const storyTitle = getStoryTitle(story);

      await Share.open({
        url: shareUrl,
        title: storyTitle,
        message: `Check out this story illustration: "${storyTitle}" 🎨`,
        type: 'image/jpeg',
        filename,
      });

      // Clean up temp file
      await RNFS.unlink(tempPath);
    } catch (error: any) {
      if (error.message && !error.message.includes('cancelled')) {
        console.error('Share failed:', error);
        Alert.alert(
          '❌ Share Failed',
          error.message || 'Could not share image',
        );
      }
    }
  }, [imageUrl, story]);

  // Render image thumbnail or placeholder
  const renderThumbnail = () => {
    if (!hasImage) {
      // No image - show placeholder
      return (
        <View style={styles.thumbnailPlaceholder}>
          <Text style={styles.thumbnailPlaceholderIcon}>🖼️</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={styles.thumbnailContainer}
        onLongPress={handleThumbnailLongPress}
        delayLongPress={500}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: imageUrl }}
          style={styles.thumbnail}
          onLoadStart={() => setImageLoading(true)}
          onLoadEnd={() => setImageLoading(false)}
          onError={() => {
            setImageError(true);
            setImageLoading(false);
          }}
        />

        {/* Loading indicator */}
        {imageLoading && !imageError && (
          <View style={styles.thumbnailLoading}>
            <ActivityIndicator size="small" color="#6f42c1" />
          </View>
        )}

        {/* Error state */}
        {imageError && (
          <View style={styles.thumbnailError}>
            <Text style={styles.thumbnailErrorIcon}>⚠️</Text>
          </View>
        )}

        {/* Upload status indicator */}
        {uploadStatus === 'pending' && !imageError && (
          <View style={styles.uploadingBadge}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        )}
        {uploadStatus === 'uploaded' && !imageError && (
          <View style={styles.uploadedBadge}>
            <Text style={styles.uploadedBadgeText}>✓</Text>
          </View>
        )}
        {uploadStatus === 'failed' && !imageError && (
          <View style={styles.uploadFailedBadge}>
            <Text style={styles.uploadFailedBadgeText}>!</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <TouchableOpacity
      style={styles.storyCard}
      onPress={onPress}
      activeOpacity={0.7}
      delayPressIn={0}
    >
      <View style={styles.storyCardContent}>
        {/* Image Thumbnail */}
        {renderThumbnail()}

        {/* Story Content */}
        <View style={styles.storyTextContent}>
          <View style={styles.storyHeader}>
            <Text style={styles.storyTitle} numberOfLines={2}>
              {highlightSearchTerm(title, searchTerm)}
            </Text>
            <View
              style={[styles.sourceIndicator, { backgroundColor: sourceColor }]}
            >
              <Text style={styles.sourceText}>{story.story_source}</Text>
            </View>
          </View>

          <Text style={styles.storyPreview} numberOfLines={2}>
            {highlightSearchTerm(preview, searchTerm)}
          </Text>

          <View style={styles.storyFooter}>
            <Text style={styles.storyDate}>{formatDate(story.created_at)}</Text>
            <View style={styles.storyStats}>
              <Text style={styles.wordCount}>
                {getActualWordCount(story)} words
              </Text>
              {story.final_score > 0 && (
                <Text style={styles.score}>Score: {story.final_score}</Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {story.completed_at && (
        <View style={styles.completedBadge}>
          <Text style={styles.completedText}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const SkeletonCard: React.FC = () => (
  <View style={styles.skeletonCard}>
    <View style={styles.storyCardContent}>
      {/* Skeleton thumbnail */}
      <View style={styles.skeletonThumbnail} />

      {/* Skeleton content */}
      <View style={styles.storyTextContent}>
        <View style={styles.skeletonHeader}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonSource} />
        </View>
        <View style={styles.skeletonPreview1} />
        <View style={styles.skeletonPreview2} />
        <View style={styles.skeletonFooter}>
          <View style={styles.skeletonDate} />
          <View style={styles.skeletonStats} />
        </View>
      </View>
    </View>
  </View>
);

const EMPTY_STRING_ARRAY: string[] = [];

export const StorySelectionModal: React.FC<StorySelectionModalProps> = ({
  visible: _visible, // Unused, kept for API compatibility
  onClose,
  onStorySelect,
  userId,
  title: modalTitle = 'Select a Story',
  showOnlyCompleted = false,
  excludeStoryIds = EMPTY_STRING_ARRAY,
  initialSource,
  showHeader = true,
}) => {
  const [stories, setStories] = useState<GameSession[]>([]);
  const [filteredStories, setFilteredStories] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    source: initialSource || 'All',
    dateRange: 'all',
    completedOnly: showOnlyCompleted,
  });
  const [error, setError] = useState<string | null>(null);

  // Load stories from the service
  const loadStories = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await StoryManagementService.getStoryLibrary({
          userId,
          limit: 100, // Load a reasonable number for mobile
          offset: 0,
          sortBy: 'created_at',
          sortOrder: 'desc',
        });

        if (result.success && result.stories) {
          let loadedStories = result.stories;

          // Filter out excluded stories
          if (excludeStoryIds.length > 0) {
            loadedStories = loadedStories.filter(
              story => !excludeStoryIds.includes(story.id),
            );
          }

          // Filter only completed if required
          if (showOnlyCompleted) {
            loadedStories = loadedStories.filter(story => story.completed_at);
          }

          setStories(loadedStories);
        } else {
          setError(result.error || 'Failed to load stories');
        }
      } catch (err) {
        setError('An unexpected error occurred');
        console.error('Error loading stories:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId, excludeStoryIds, showOnlyCompleted],
  );

  // Apply filters and search
  const applyFiltersAndSearch = useCallback(() => {
    let filtered = [...stories];

    // Apply source filter
    if (filters.source !== 'All') {
      filtered = filtered.filter(
        story => story.story_source === filters.source,
      );
    }

    // Apply date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();

      switch (filters.dateRange) {
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      filtered = filtered.filter(
        story => new Date(story.created_at) >= cutoffDate,
      );
    }

    // Apply completed filter
    // Note: Story completion feature is not yet implemented
    // All stories have completed_at: null, so this filter is currently disabled in UI
    if (filters.completedOnly) {
      filtered = filtered.filter(story => !!story.completed_at);
    }

    // Apply search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(story => {
        const title = story.story_metadata?.title || '';
        const content =
          story.story_content || story.imported_story_content || '';

        return (
          title.toLowerCase().includes(term) ||
          content.toLowerCase().includes(term) ||
          story.story_source.toLowerCase().includes(term)
        );
      });
    }

    setFilteredStories(filtered);
  }, [stories, filters, searchTerm]);

  // Load stories when component mounts
  useEffect(() => {
    if (userId) {
      loadStories();
    }
  }, [userId, loadStories]);

  // Apply filters when stories or filters change
  useEffect(() => {
    applyFiltersAndSearch();
  }, [applyFiltersAndSearch]);

  const handleStoryPress = useCallback(
    (story: GameSession) => {
      console.log('📚 Story card pressed:', {
        id: story.id,
        title: story.story_metadata?.title || 'Untitled',
        source: story.story_source,
      });

      // Call onStorySelect and let the parent handle navigation and modal dismissal
      // DO NOT call onClose() here as it cancels the pending navigation
      onStorySelect(story);
    },
    [onStorySelect],
  );

  const handleRefresh = useCallback(() => {
    loadStories(true);
  }, [loadStories]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  const renderStoryCard = useCallback(
    ({ item }: { item: GameSession }) => (
      <StoryCard
        story={item}
        onPress={() => handleStoryPress(item)}
        searchTerm={searchTerm}
      />
    ),
    [handleStoryPress, searchTerm],
  );

  const renderSkeleton = useCallback(
    () => (
      <View>
        {Array.from({ length: 5 }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </View>
    ),
    [],
  );

  const dateRangeOptions = [
    { key: 'all', label: 'All Time' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'year', label: 'This Year' },
  ];

  const ListEmptyComponent = useMemo(() => {
    if (loading) return renderSkeleton();

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadStories()}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {searchTerm ? 'No stories match your search' : 'No stories found'}
        </Text>
        {searchTerm && (
          <TouchableOpacity style={styles.clearButton} onPress={clearSearch}>
            <Text style={styles.clearButtonText}>Clear Search</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [loading, error, searchTerm, renderSkeleton, loadStories, clearSearch]);

  const Container = showHeader ? SafeAreaView : View;

  return (
    <Container style={styles.container}>
      {/* Header - hidden when inside a navigation stack */}
      {showHeader && (
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{modalTitle}</Text>
          <View style={styles.headerSpacer} />
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search stories..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity
            style={styles.clearSearchButton}
            onPress={clearSearch}
          >
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Buttons */}
      <View style={styles.filtersContainer}>
        {/* Date Range Filter */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Date:</Text>
          <View style={styles.filterButtons}>
            {dateRangeOptions.map(option => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.filterButton,
                  filters.dateRange === option.key && styles.filterButtonActive,
                ]}
                onPress={() =>
                  setFilters(prev => ({
                    ...prev,
                    dateRange: option.key as any,
                  }))
                }
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filters.dateRange === option.key &&
                      styles.filterButtonTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Completed Only Toggle */}
        {/* Note: Hidden until story completion feature is implemented */}
        {/* All stories currently have completed_at: null */}
        {false && !showOnlyCompleted && (
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() =>
              setFilters(prev => ({
                ...prev,
                completedOnly: !prev.completedOnly,
              }))
            }
          >
            <Text style={styles.toggleButtonText}>
              {filters.completedOnly ? '☑' : '☐'} Completed Only
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Results Count */}
      <Text style={styles.resultsCount}>
        {filteredStories.length}{' '}
        {filteredStories.length === 1 ? 'story' : 'stories'}
      </Text>

      {/* Story List */}
      <FlatList
        data={filteredStories}
        keyExtractor={item => item.id}
        renderItem={renderStoryCard}
        ListEmptyComponent={ListEmptyComponent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        keyboardShouldPersistTaps="handled"
      />
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  headerSpacer: {
    width: 34, // Match close button width
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
  },
  clearSearchButton: {
    padding: 12,
  },
  clearSearchText: {
    fontSize: 18,
    color: '#666',
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  filterGroup: {
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginBottom: 4,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  toggleButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  toggleButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  resultsCount: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    fontSize: 14,
    color: '#666',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  storyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    position: 'relative',
  },
  storyCardContent: {
    flexDirection: 'row',
    gap: 12,
  },
  storyTextContent: {
    flex: 1,
  },
  // Image Thumbnail Styles
  thumbnailContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  thumbnailPlaceholderIcon: {
    fontSize: 34,
    opacity: 0.3,
  },
  thumbnailLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailError: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f8d7da',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailErrorIcon: {
    fontSize: 26,
  },
  // Upload Status Badges
  uploadingBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(111, 66, 193, 0.9)',
    borderRadius: 12,
    padding: 4,
  },
  uploadedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadedBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  uploadFailedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(255, 152, 0, 0.9)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadFailedBadgeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  storyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  storyTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  sourceIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sourceText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
  },
  storyPreview: {
    fontSize: 16,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  storyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storyDate: {
    fontSize: 14,
    color: '#999',
  },
  storyStats: {
    flexDirection: 'row',
    gap: 12,
  },
  wordCount: {
    fontSize: 14,
    color: '#666',
  },
  score: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  completedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
  },
  highlightedText: {
    backgroundColor: '#FFEB3B',
    fontWeight: '500',
  },
  skeletonCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  skeletonThumbnail: {
    width: 80,
    height: 80,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  skeletonTitle: {
    width: '70%',
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
  skeletonSource: {
    width: 60,
    height: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
  },
  skeletonPreview1: {
    width: '100%',
    height: 14,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 4,
  },
  skeletonPreview2: {
    width: '80%',
    height: 14,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 12,
  },
  skeletonFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skeletonDate: {
    width: 60,
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
  skeletonStats: {
    width: 80,
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 18,
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '500',
  },
  clearButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
});

export default StorySelectionModal;
