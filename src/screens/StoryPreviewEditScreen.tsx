// Story Preview Edit Screen
// Allows users to preview and edit their selected story before continuing

import React, { useState } from 'react';
import { View, StyleSheet, StatusBar, Alert } from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StoryPreviewEdit } from '../components/story/StoryPreviewEdit';
import type { HomeStackParamList } from '../navigation/AppNavigator';
import type { GameSession } from '../types/database';
import { PaperBackground } from '../components/common/storybook';
import { theme } from '../constants/theme';

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
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

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
    try {
      console.log('📖 Starting story continuation for:', {
        id: storyData.id,
        title: storyData.story_metadata?.title,
        source: storyData.story_source,
        gradeLevel: storyData.grade_level,
      });

      // Navigate to Home screen with story continuation params
      // HomeScreen will detect these params and load the story into the game
      activeNavigation.navigate('Home', {
        continueStory: {
          sessionId: storyData.id,
          importedContent:
            storyData.imported_story_content || storyData.story_content || '',
          storySource: storyData.story_source,
          gradeLevel: storyData.grade_level,
          metadata: storyData.story_metadata,
        },
      });
    } catch (error) {
      console.error('❌ Error navigating to story continuation:', error);
      Alert.alert(
        'Navigation Error',
        'Unable to start story continuation. Please try again.',
      );
    }
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
      <View style={[styles.container, { paddingTop: headerHeight }]}>
        <PaperBackground style={StyleSheet.absoluteFillObject} />
        <StatusBar
          barStyle="dark-content"
          backgroundColor={theme.colors.paper.base}
        />
        <View style={styles.errorContainer}>
          {/* Alert is shown above, this is just a fallback view */}
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: headerHeight, paddingBottom: tabBarHeight },
      ]}
    >
      <PaperBackground style={StyleSheet.absoluteFillObject} />
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.paper.base}
      />

      <StoryPreviewEdit
        story={story}
        onSave={handleSave}
        onEdit={handleEdit}
        onContinue={handleContinue}
        onBack={handleBack}
        autoSave={true}
        autoSaveDelay={2000}
        showActions={true}
        showHeader={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.paper.base,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});

export default StoryPreviewEditScreen;
