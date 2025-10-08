// Story Preview Edit Screen
// Allows users to preview and edit their selected story before continuing

import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar, Alert } from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StoryPreviewEdit } from '../components/story/StoryPreviewEdit';
import type { HomeStackParamList } from '../navigation/AppNavigator';
import type { GameSession } from '../types/database';

type StoryPreviewEditNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  'StoryPreviewEdit'
>;
type StoryPreviewEditRouteProp = RouteProp<
  HomeStackParamList,
  'StoryPreviewEdit'
>;

export interface StoryPreviewEditScreenProps {
  navigation?: StoryPreviewEditNavigationProp;
  route?: StoryPreviewEditRouteProp;
}

export const StoryPreviewEditScreen: React.FC<StoryPreviewEditScreenProps> = ({
  navigation,
  route,
}) => {
  const nav = useNavigation<StoryPreviewEditNavigationProp>();
  const currentRoute = useRoute<StoryPreviewEditRouteProp>();

  const activeNavigation = navigation || nav;
  const activeRoute = route || currentRoute;

  const [story, setStory] = useState<GameSession>(activeRoute.params?.story);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleBack = () => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Discard Changes',
            style: 'destructive',
            onPress: () => {
              if (activeNavigation.canGoBack()) {
                activeNavigation.goBack();
              } else {
                activeNavigation.navigate('StorySelection' as never);
              }
            },
          },
        ],
      );
    } else {
      if (activeNavigation.canGoBack()) {
        activeNavigation.goBack();
      } else {
        activeNavigation.navigate('StorySelection' as never);
      }
    }
  };

  const handleSave = async (newContent: string, metadata: any) => {
    try {
      // TODO: Implement actual save functionality
      // await storyManagementService.updateStory(story.id, {
      //   story_content: newContent,
      //   story_metadata: { ...story.story_metadata, ...metadata }
      // });

      // Update local story state
      const updatedStory = {
        ...story,
        story_content: newContent,
        story_metadata: { ...story.story_metadata, ...metadata },
      };
      setStory(updatedStory);
      setHasUnsavedChanges(false);

      // For now, just show success message
      console.log('Story saved successfully:', {
        id: story.id,
        newContent: newContent.substring(0, 50) + '...',
        metadata,
      });
    } catch (error) {
      console.error('Error saving story:', error);
      throw error; // Let the component handle the error display
    }
  };

  const handleEdit = (isEditing: boolean) => {
    // Track edit mode changes
    if (isEditing) {
      console.log('Entered edit mode for story:', story.id);
    } else {
      console.log('Exited edit mode for story:', story.id);
    }
  };

  const handleContinue = (storyData: GameSession) => {
    // TODO: Navigate to story continuation/AI generation flow
    // For now, show a placeholder alert
    Alert.alert(
      'Continue Story',
      `Starting AI continuation for "${
        storyData.story_metadata?.title || 'Untitled Story'
      }". This feature is being developed to seamlessly integrate with the existing story generation system.`,
      [
        {
          text: 'OK',
          onPress: () => {
            // TODO: Navigate to story generation screen with imported content
            console.log('Continuing story:', {
              id: storyData.id,
              title: storyData.story_metadata?.title,
              content: storyData.story_content.substring(0, 100) + '...',
            });
          },
        },
      ],
    );
  };

  // Handle case where no story is provided
  if (!story) {
    // Show alert and navigate back
    Alert.alert(
      'No Story Selected',
      'Please select a story to preview and edit.',
      [
        {
          text: 'Go Back',
          onPress: () => activeNavigation.navigate('StorySelection' as never),
        },
      ],
    );

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        <View style={styles.errorContainer}>
          {/* Alert is shown above, this is just a fallback view */}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />

      <StoryPreviewEdit
        story={story}
        onSave={handleSave}
        onEdit={handleEdit}
        onContinue={handleContinue}
        onBack={handleBack}
        autoSave={true}
        autoSaveDelay={2000}
        showActions={true}
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
});

export default StoryPreviewEditScreen;
