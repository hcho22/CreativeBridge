/**
 * Advanced Search Modal Component
 *
 * Provides an advanced search interface for the story continuation feature,
 * integrating with the AdvancedSearchService to offer full-text search,
 * metadata filtering, search suggestions, and result ranking.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  advancedSearchService,
  SearchResult,
  SearchQuery,
  SearchSuggestion,
} from '../../services/advancedSearchService';
import { useAuth } from '../../context/AuthContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  onStorySelect: (story: SearchResult) => void;
  initialQuery?: string;
}

interface FilterState {
  source: string;
  gradeLevel: string;
  dateRange: {
    start: string;
    end: string;
  } | null;
  sortBy: 'relevance' | 'date' | 'wordCount';
  sortOrder: 'asc' | 'desc';
}

const AdvancedSearchModal: React.FC<Props> = ({
  visible,
  onClose,
  onStorySelect,
  initialQuery = '',
}) => {
  const { user } = useAuth();

  // Search state
  const [query, setQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    source: '',
    gradeLevel: '',
    dateRange: null,
    sortBy: 'relevance',
    sortOrder: 'desc',
  });
  const [showFilters, setShowFilters] = useState(false);

  // UI state
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Constants
  const sourcesOptions = ['', 'CreativeBridge', 'Story_Quest', 'File'];
  const gradeLevelOptions = ['', 'K-2', '3-5', '6-8', '9-12'];
  const sortOptions = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'date', label: 'Date' },
    { value: 'wordCount', label: 'Word Count' },
  ];

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string, searchFilters: FilterState) => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setHasSearched(false);
        return;
      }

      setIsSearching(true);
      setSearchError(null);

      try {
        const searchOptions: Partial<SearchQuery> = {
          metadata: {
            source: searchFilters.source || undefined,
            gradeLevel: searchFilters.gradeLevel || undefined,
            dateRange: searchFilters.dateRange || undefined,
          },
          sortBy: searchFilters.sortBy,
          sortOrder: searchFilters.sortOrder,
          limit: 50,
        };

        const results = await advancedSearchService.fullTextSearch(
          searchQuery,
          user?.id,
          searchOptions,
        );

        setSearchResults(results);
        setHasSearched(true);

        // Save to search history
        if (user?.id) {
          await advancedSearchService.saveToHistory(
            searchQuery,
            user.id,
            results.length,
            searchFilters,
          );
        }
      } catch (error) {
        console.error('Search error:', error);
        setSearchError(
          error instanceof Error ? error.message : 'Search failed',
        );
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [user?.id],
  );

  // Debounced suggestions function
  const debouncedSuggestions = useCallback(
    debounce(async (partial: string) => {
      if (partial.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const suggestions = await advancedSearchService.getSuggestions(
          partial,
          user?.id,
          8,
        );
        setSuggestions(suggestions);
      } catch (error) {
        console.error('Suggestions error:', error);
        setSuggestions([]);
      }
    }, 200),
    [user?.id],
  );

  // Effects
  useEffect(() => {
    if (visible && initialQuery) {
      setQuery(initialQuery);
      debouncedSearch(initialQuery, filters);
    }
  }, [visible, initialQuery, debouncedSearch, filters]);

  useEffect(() => {
    debouncedSearch(query, filters);
  }, [query, filters, debouncedSearch]);

  useEffect(() => {
    if (showSuggestions) {
      debouncedSuggestions(query);
    }
  }, [query, showSuggestions, debouncedSuggestions]);

  // Handlers
  const handleQueryChange = (text: string) => {
    setQuery(text);
    setShowSuggestions(true);
  };

  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    setShowSuggestions(false);
  };

  const handleFilterChange = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K],
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      source: '',
      gradeLevel: '',
      dateRange: null,
      sortBy: 'relevance',
      sortOrder: 'desc',
    });
  };

  const handleStoryPress = (story: SearchResult) => {
    onStorySelect(story);
    onClose();
  };

  // Memoized components
  const SearchInput = useMemo(
    () => (
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={handleQueryChange}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="Search your stories..."
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search stories"
          accessibilityHint="Enter text to search through your stories"
        />
        {query.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              setQuery('');
              setShowSuggestions(false);
            }}
            accessibilityLabel="Clear search"
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    ),
    [query],
  );

  const SuggestionsDropdown = useMemo(() => {
    if (!showSuggestions || suggestions.length === 0) return null;

    return (
      <View style={styles.suggestionsContainer}>
        <FlatList
          data={suggestions}
          keyExtractor={item => `${item.type}_${item.text}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.suggestionItem}
              onPress={() => handleSuggestionSelect(item)}
            >
              <Text style={styles.suggestionText}>{item.text}</Text>
              <Text style={styles.suggestionType}>{item.type}</Text>
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </View>
    );
  }, [showSuggestions, suggestions]);

  const FiltersPanel = useMemo(() => {
    if (!showFilters) return null;

    return (
      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Source:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {sourcesOptions.map(source => (
              <TouchableOpacity
                key={source}
                style={[
                  styles.filterButton,
                  filters.source === source && styles.filterButtonActive,
                ]}
                onPress={() => handleFilterChange('source', source)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filters.source === source && styles.filterButtonTextActive,
                  ]}
                >
                  {source || 'All'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Grade Level:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {gradeLevelOptions.map(level => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.filterButton,
                  filters.gradeLevel === level && styles.filterButtonActive,
                ]}
                onPress={() => handleFilterChange('gradeLevel', level)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filters.gradeLevel === level &&
                      styles.filterButtonTextActive,
                  ]}
                >
                  {level || 'All'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Sort by:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {sortOptions.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterButton,
                  filters.sortBy === option.value && styles.filterButtonActive,
                ]}
                onPress={() =>
                  handleFilterChange('sortBy', option.value as any)
                }
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filters.sortBy === option.value &&
                      styles.filterButtonTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity
          style={styles.clearFiltersButton}
          onPress={clearFilters}
        >
          <Text style={styles.clearFiltersText}>Clear Filters</Text>
        </TouchableOpacity>
      </View>
    );
  }, [showFilters, filters]);

  const SearchResultItem = useCallback(({ item }: { item: SearchResult }) => {
    const wordCount = (item.story_content || '').split(' ').length;
    const createdDate = new Date(item.created_at).toLocaleDateString();

    return (
      <TouchableOpacity
        style={styles.resultItem}
        onPress={() => handleStoryPress(item)}
        accessibilityLabel={`Story: ${item.preview}`}
        accessibilityHint="Tap to select this story"
      >
        <View style={styles.resultHeader}>
          <View style={styles.resultMeta}>
            <Text style={styles.resultSource}>{item.story_source}</Text>
            {item.grade_level && (
              <Text style={styles.resultGrade}>{item.grade_level}</Text>
            )}
            <Text style={styles.resultScore}>Score: {item.relevanceScore}</Text>
          </View>
          <Text style={styles.resultDate}>{createdDate}</Text>
        </View>

        <Text
          style={styles.resultPreview}
          numberOfLines={3}
          ellipsizeMode="tail"
        >
          {item.preview}
        </Text>

        <View style={styles.resultFooter}>
          <Text style={styles.resultWordCount}>{wordCount} words</Text>
          {item.matchedFields.length > 0 && (
            <Text style={styles.resultMatches}>
              Matches: {item.matchedFields.join(', ')}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }, []);

  const SearchResults = useMemo(() => {
    if (isSearching) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Searching stories...</Text>
        </View>
      );
    }

    if (searchError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Search Error</Text>
          <Text style={styles.errorMessage}>{searchError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => debouncedSearch(query, filters)}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (hasSearched && searchResults.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No stories found</Text>
          <Text style={styles.emptySubtext}>
            Try adjusting your search terms or filters
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={searchResults}
        keyExtractor={item => item.id}
        renderItem={SearchResultItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.resultsList}
        ItemSeparatorComponent={() => <View style={styles.resultSeparator} />}
      />
    );
  }, [
    isSearching,
    searchError,
    hasSearched,
    searchResults,
    SearchResultItem,
    debouncedSearch,
    query,
    filters,
  ]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Advanced Search</Text>
          <TouchableOpacity
            onPress={() => setShowFilters(!showFilters)}
            style={styles.filterToggle}
          >
            <Text style={styles.filterToggleText}>
              {showFilters ? 'Hide' : 'Filters'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        {SearchInput}

        {/* Suggestions */}
        {SuggestionsDropdown}

        {/* Filters */}
        {FiltersPanel}

        {/* Results */}
        <View style={styles.resultsContainer}>
          {hasSearched && (
            <Text style={styles.resultCount}>
              {searchResults.length}{' '}
              {searchResults.length === 1 ? 'story' : 'stories'} found
            </Text>
          )}
          {SearchResults}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  filterToggle: {
    padding: 8,
  },
  filterToggleText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 22,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    marginLeft: 12,
    padding: 8,
  },
  clearButtonText: {
    fontSize: 16,
    color: '#666',
  },
  suggestionsContainer: {
    backgroundColor: '#fff',
    maxHeight: 200,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  suggestionType: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filtersContainer: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterRow: {
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#333',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  clearFiltersButton: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  clearFiltersText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  resultsContainer: {
    flex: 1,
  },
  resultCount: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  resultsList: {
    paddingBottom: 20,
  },
  resultItem: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  resultSource: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    backgroundColor: '#e6f3ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  resultGrade: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: '500',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  resultScore: {
    fontSize: 12,
    color: '#666',
  },
  resultDate: {
    fontSize: 12,
    color: '#999',
  },
  resultPreview: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  resultFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultWordCount: {
    fontSize: 12,
    color: '#666',
  },
  resultMatches: {
    fontSize: 12,
    color: '#007AFF',
    fontStyle: 'italic',
  },
  resultSeparator: {
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default AdvancedSearchModal;
