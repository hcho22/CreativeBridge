// Story Selection Screen
// Allows users to select from their previously created stories

import React from 'react';
import { View, Text, StyleSheet, StatusBar, Alert } from 'react-native';
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

  const handleStorySelect = (story: GameSession) => {
    console.log('🎯 handleStorySelect called with story:', {
      id: story.id,
      title: story.story_metadata?.title || 'Untitled',
      hasNavigation: !!activeNavigation,
      navigationState: activeNavigation.getState(),
    });

    try {
      console.log('🚀 Attempting navigation to StoryPreviewEdit...');
      activeNavigation.navigate('StoryPreviewEdit', { story });
      console.log('✅ Navigation command executed');
    } catch (error) {
      console.error('❌ Navigation error:', error);
      console.warn('Navigation to StoryPreviewEdit not available:', error);
      Alert.alert(
        'Story Selected',
        `You selected "${
          story.story_metadata?.title || 'Untitled Story'
        }". Story preview functionality is being developed.`,
      );
    }
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
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Authentication Required</Text>
          <Text style={styles.errorMessage}>
            Please log in to access your story library.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />

      <StorySelectionModal
        visible={true}
        userId={user.id}
        onStorySelect={handleStorySelect}
        onClose={handleBack}
        title="Your Stories"
      />
    </View>
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
