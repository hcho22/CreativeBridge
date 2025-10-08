// Story Selection Screen
// Allows users to select from their previously created stories

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { StorySelectionModal } from '../components/story/StorySelectionModal';
import type { GameSession } from '../types/database';
import type { HomeStackParamList } from '../navigation/AppNavigator';

type StorySelectionNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  'StorySelection'
>;

export interface StorySelectionScreenProps {
  navigation?: StorySelectionNavigationProp;
}

export const StorySelectionScreen: React.FC<StorySelectionScreenProps> = ({
  navigation,
}) => {
  const nav = useNavigation<StorySelectionNavigationProp>();
  const activeNavigation = navigation || nav;
  const { user } = useAuth();

  const [stories, setStories] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock stories for now - will be replaced with actual data fetching
  const mockStories: GameSession[] = [
    {
      id: 'story-1',
      user_id: user?.id || 'mock-user',
      created_at: '2024-01-15T10:30:00Z',
      grade_level: 'K-2',
      final_score: 150,
      words_written: 45,
      sentences_completed: 5,
      challenges_completed: 2,
      xp_earned: 100,
      story_content:
        'Once upon a time, there was a brave little mouse named Pip. Pip lived in a cozy hole under the old oak tree. Every day, Pip would venture out to find delicious crumbs and explore the garden.',
      story_source: 'CreativeBridge',
      story_metadata: {
        title: 'The Adventures of Pip',
        author: 'Young Writer',
        genre: 'adventure',
        word_count: 45,
        last_edited: '2024-01-15T10:30:00Z',
      },
    },
    {
      id: 'story-2',
      user_id: user?.id || 'mock-user',
      created_at: '2024-01-10T14:20:00Z',
      grade_level: '3-5',
      final_score: 200,
      words_written: 78,
      sentences_completed: 8,
      challenges_completed: 3,
      xp_earned: 150,
      story_content:
        'The old lighthouse stood tall against the stormy sky. Sarah had always wondered what secrets it held. Tonight, with the storm raging outside, she finally decided to explore its mysterious chambers.',
      story_source: 'CreativeBridge',
      story_metadata: {
        title: 'The Lighthouse Mystery',
        author: 'Young Writer',
        genre: 'mystery',
        word_count: 78,
        last_edited: '2024-01-10T14:20:00Z',
      },
    },
    {
      id: 'story-3',
      user_id: user?.id || 'mock-user',
      created_at: '2024-01-05T09:15:00Z',
      grade_level: 'K-2',
      final_score: 180,
      words_written: 32,
      sentences_completed: 4,
      challenges_completed: 1,
      xp_earned: 80,
      story_content:
        'In the magical forest, the trees could talk and the flowers could sing. Luna, a young fairy, was on her first quest to find the golden acorn that would save her village.',
      story_source: 'Story_Quest',
      story_metadata: {
        title: "Luna's Quest",
        author: 'Young Writer',
        genre: 'fantasy',
        word_count: 32,
        last_edited: '2024-01-05T09:15:00Z',
      },
    },
  ];

  useEffect(() => {
    loadUserStories();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadUserStories = async () => {
    try {
      setLoading(true);
      setError(null);

      // TODO: Replace with actual API call
      // const userStories = await storyManagementService.getUserStories(user?.id);

      // Simulate loading delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      setStories(mockStories);
    } catch (loadError) {
      console.error('Error loading stories:', loadError);
      setError('Failed to load your stories. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStorySelect = (story: GameSession) => {
    try {
      activeNavigation.navigate('StoryPreviewEdit', { story });
    } catch (error) {
      console.warn('Navigation to StoryPreviewEdit not available:', error);
      Alert.alert(
        'Story Selected',
        `You selected "${
          story.story_metadata?.title || 'Untitled Story'
        }". Story preview functionality is being developed.`,
      );
    }
  };

  const handleRefresh = () => {
    loadUserStories();
  };

  const handleBack = () => {
    if (activeNavigation.canGoBack()) {
      activeNavigation.goBack();
    } else {
      activeNavigation.navigate('ImportOptions' as never);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Authentication Required</Text>
          <Text style={styles.errorMessage}>
            Please log in to access your story library.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      <StorySelectionModal
        visible={true}
        stories={stories}
        loading={loading}
        onSelectStory={handleStorySelect}
        onRefresh={handleRefresh}
        onClose={handleBack}
        showCloseButton={false}
        title="Your Stories"
        emptyMessage="No stories found. Create your first story to get started!"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  errorBanner: {
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    margin: 16,
  },
  errorBannerText: {
    color: '#d32f2f',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default StorySelectionScreen;
