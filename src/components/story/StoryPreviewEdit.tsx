// Story Preview and Edit Component
// Displays story content with editing capabilities and metadata

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { GameSession, StoryMetadata } from '../../types/database';

export interface StoryPreviewEditProps {
  story: GameSession;
  onSave?: (
    content: string,
    metadata?: Partial<StoryMetadata>,
  ) => Promise<void> | void;
  onContinue?: (story: GameSession) => void;
  onBack?: () => void;
  onEdit?: (isEditing: boolean) => void;
  readOnly?: boolean;
  initialEditMode?: boolean;
  showActions?: boolean;
  autoSave?: boolean;
  autoSaveDelay?: number;
  /** When false, hides the built-in header (useful when rendered inside a navigation stack) */
  showHeader?: boolean;
}

export interface StoryStats {
  wordCount: number;
  characterCount: number;
  paragraphCount: number;
  estimatedReadingTime: number;
}

export const StoryPreviewEdit: React.FC<StoryPreviewEditProps> = ({
  story,
  onSave,
  onContinue,
  onBack,
  onEdit,
  readOnly = false,
  initialEditMode = false,
  showActions = true,
  autoSave = false,
  autoSaveDelay = 2000,
  showHeader = true,
}) => {
  // Get story content - prioritize story_content, fallback to imported_story_content
  const storyContent =
    story.story_content || story.imported_story_content || '';

  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [editedContent, setEditedContent] = useState(storyContent);
  const [originalContent] = useState(storyContent);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);

  const textInputRef = useRef<TextInput>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate story statistics
  const calculateStats = useCallback((content: string): StoryStats => {
    const words = content
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0);
    const characters = content.length;
    const paragraphs = content
      .split(/\n\s*\n/)
      .filter(p => p.trim().length > 0);
    const wordsPerMinute = 200; // Average reading speed
    const estimatedReadingTime = Math.ceil(words.length / wordsPerMinute);

    return {
      wordCount: words.length,
      characterCount: characters,
      paragraphCount: paragraphs.length,
      estimatedReadingTime: Math.max(1, estimatedReadingTime),
    };
  }, []);

  const [stats, setStats] = useState<StoryStats>(() =>
    calculateStats(editedContent),
  );

  // Update stats when content changes
  useEffect(() => {
    setStats(calculateStats(editedContent));
    setHasUnsavedChanges(editedContent !== originalContent);
  }, [editedContent, originalContent, calculateStats]);

  // Auto-save functionality
  useEffect(() => {
    if (autoSave && hasUnsavedChanges && !isSaving) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      autoSaveTimeoutRef.current = setTimeout(() => {
        handleSave(true);
      }, autoSaveDelay);
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- US-019 batch 4: handleSave/isSaving are forward-declared; effect runs on user-edit signals (editedContent/hasUnsavedChanges).
  }, [editedContent, hasUnsavedChanges, autoSave, autoSaveDelay]);

  // Handle edit mode toggle
  const handleEditToggle = useCallback(() => {
    if (readOnly) return;

    const newEditMode = !isEditing;
    setIsEditing(newEditMode);
    onEdit?.(newEditMode);

    if (newEditMode) {
      // Focus text input when entering edit mode
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  }, [isEditing, readOnly, onEdit]);

  // Handle save operation
  const handleSave = useCallback(
    async (isAutoSave = false) => {
      if (!onSave || !hasUnsavedChanges) return;

      setIsSaving(true);

      try {
        const metadata: Partial<StoryMetadata> = {
          ...story.story_metadata,
          last_edited: new Date().toISOString(),
          word_count: stats.wordCount,
          character_count: stats.characterCount,
          paragraph_count: stats.paragraphCount,
          auto_saved: isAutoSave,
        };

        await onSave(editedContent, metadata);
        setHasUnsavedChanges(false);

        if (!isAutoSave) {
          Alert.alert('Success', 'Story saved successfully!');
          setIsEditing(false);
          onEdit?.(false);
        }
      } catch (error) {
        console.error('Error saving story:', error);
        Alert.alert(
          'Save Failed',
          'Unable to save your changes. Please try again.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: () => handleSave(isAutoSave) },
          ],
        );
      } finally {
        setIsSaving(false);
      }
    },
    [
      editedContent,
      hasUnsavedChanges,
      onSave,
      stats,
      story.story_metadata,
      onEdit,
    ],
  );

  // Handle cancel edit
  const handleCancelEdit = useCallback(() => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setEditedContent(originalContent);
              setIsEditing(false);
              setHasUnsavedChanges(false);
              onEdit?.(false);
            },
          },
        ],
      );
    } else {
      setIsEditing(false);
      onEdit?.(false);
    }
  }, [hasUnsavedChanges, originalContent, onEdit]);

  // Handle continue story
  const handleContinue = useCallback(() => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Save Changes?',
        'You have unsaved changes. Would you like to save them before continuing?',
        [
          {
            text: 'Continue Without Saving',
            onPress: () => onContinue?.(story),
          },
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save & Continue',
            onPress: async () => {
              await handleSave();
              onContinue?.({ ...story, story_content: editedContent });
            },
          },
        ],
      );
    } else {
      onContinue?.(story);
    }
  }, [hasUnsavedChanges, handleSave, onContinue, story, editedContent]);

  // Format date
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // Get story title
  const getStoryTitle = useCallback(() => {
    if (story.story_metadata?.title) {
      return story.story_metadata.title;
    }

    const firstLine = editedContent.split('\n')[0]?.trim();
    if (firstLine && firstLine.length < 60 && !firstLine.endsWith('.')) {
      return firstLine;
    }

    return 'Untitled Story';
  }, [story.story_metadata?.title, editedContent]);

  const title = getStoryTitle();

  const Container = showHeader ? SafeAreaView : View;

  return (
    <Container style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        {/* Header - hidden when inside a navigation stack */}
        {showHeader && (
          <View style={styles.header}>
            {onBack && (
              <TouchableOpacity style={styles.backButton} onPress={onBack}>
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>
            )}
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.headerSubtitle}>
                {stats.wordCount} words • {stats.estimatedReadingTime} min read
              </Text>
            </View>
            <TouchableOpacity
              style={styles.metadataButton}
              onPress={() => setShowMetadata(!showMetadata)}
            >
              <Text style={styles.metadataButtonText}>ℹ</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Metadata Panel */}
        {showMetadata && (
          <View style={styles.metadataPanel}>
            <Text style={styles.metadataTitle}>Story Information</Text>
            <View style={styles.metadataGrid}>
              <View style={styles.metadataItem}>
                <Text style={styles.metadataLabel}>Source</Text>
                <Text style={styles.metadataValue}>{story.story_source}</Text>
              </View>
              <View style={styles.metadataItem}>
                <Text style={styles.metadataLabel}>Grade Level</Text>
                <Text style={styles.metadataValue}>{story.grade_level}</Text>
              </View>
              <View style={styles.metadataItem}>
                <Text style={styles.metadataLabel}>Created</Text>
                <Text style={styles.metadataValue}>
                  {formatDate(story.created_at)}
                </Text>
              </View>
              <View style={styles.metadataItem}>
                <Text style={styles.metadataLabel}>Words</Text>
                <Text style={styles.metadataValue}>{stats.wordCount}</Text>
              </View>
              <View style={styles.metadataItem}>
                <Text style={styles.metadataLabel}>Characters</Text>
                <Text style={styles.metadataValue}>{stats.characterCount}</Text>
              </View>
              <View style={styles.metadataItem}>
                <Text style={styles.metadataLabel}>Paragraphs</Text>
                <Text style={styles.metadataValue}>{stats.paragraphCount}</Text>
              </View>
            </View>
            {hasUnsavedChanges && (
              <Text style={styles.unsavedWarning}>• Unsaved changes</Text>
            )}
          </View>
        )}

        {/* Content Area */}
        <View style={styles.contentContainer}>
          {isEditing ? (
            <TextInput
              ref={textInputRef}
              style={styles.editInput}
              value={editedContent}
              onChangeText={setEditedContent}
              multiline
              placeholder="Start writing your story..."
              placeholderTextColor="#999"
              textAlignVertical="top"
              scrollEnabled={true}
              autoCorrect={true}
              spellCheck={true}
            />
          ) : (
            <ScrollView
              style={styles.previewContainer}
              contentContainerStyle={styles.previewContent}
              showsVerticalScrollIndicator={true}
            >
              <Text style={styles.storyText}>
                {editedContent || 'No content available.'}
              </Text>
            </ScrollView>
          )}
        </View>

        {/* Action Buttons */}
        {showActions && (
          <View style={styles.actionsContainer}>
            {!readOnly && (
              <View style={styles.editActions}>
                {isEditing ? (
                  <>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.cancelButton]}
                      onPress={handleCancelEdit}
                      disabled={isSaving}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        styles.saveButton,
                        (!hasUnsavedChanges || isSaving) &&
                          styles.disabledButton,
                      ]}
                      onPress={() => handleSave()}
                      disabled={!hasUnsavedChanges || isSaving}
                    >
                      {isSaving ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.saveButtonText}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.editButton]}
                    onPress={handleEditToggle}
                  >
                    <Text style={styles.editButtonText}>✏ Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {onContinue && !isEditing && (
              <TouchableOpacity
                style={[styles.actionButton, styles.continueButton]}
                onPress={handleContinue}
              >
                <Text style={styles.continueButtonText}>Continue Story →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 20,
    color: '#333',
    fontWeight: '600',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  metadataButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginLeft: 12,
  },
  metadataButtonText: {
    fontSize: 18,
    color: '#666',
  },
  metadataPanel: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  metadataTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  metadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metadataItem: {
    minWidth: '30%',
  },
  metadataLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  metadataValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  unsavedWarning: {
    fontSize: 14,
    color: '#ff6b35',
    marginTop: 8,
    fontWeight: '500',
  },
  contentContainer: {
    flex: 1,
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  previewContainer: {
    flex: 1,
  },
  previewContent: {
    padding: 20,
    paddingBottom: 40,
  },
  storyText: {
    fontSize: 18,
    lineHeight: 24,
    color: '#333',
    fontFamily: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      default: 'serif',
    }),
  },
  editInput: {
    flex: 1,
    padding: 20,
    fontSize: 18,
    lineHeight: 24,
    color: '#333',
    fontFamily: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      default: 'serif',
    }),
  },
  actionsContainer: {
    padding: 16,
    gap: 12,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  editButton: {
    backgroundColor: '#007AFF',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#34C759',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 18,
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: '#FF6B35',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default StoryPreviewEdit;
