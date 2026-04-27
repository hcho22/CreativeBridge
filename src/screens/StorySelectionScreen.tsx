// Story Selection Screen
// Allows users to select from their previously created stories

import React from 'react';
import { View, Text, StyleSheet, StatusBar, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { StorySelectionModal } from '../components/story/StorySelectionModal';
import type { GameSession } from '../types/database';
import type { HomeStackParamList } from '../navigation/AppNavigator';
import { PaperBackground } from '../components/common/storybook';
import { theme } from '../constants/theme';

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
  const headerHeight = useHeaderHeight();
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
        <PaperBackground style={StyleSheet.absoluteFillObject} />
        <StatusBar
          barStyle="dark-content"
          backgroundColor={theme.colors.paper.base}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Authentication required</Text>
          <Text style={styles.errorMessage}>
            Please log in to access your story library.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: headerHeight }]}>
      <PaperBackground style={StyleSheet.absoluteFillObject} />
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.paper.base}
      />

      <StorySelectionModal
        visible={true}
        userId={user.id}
        onStorySelect={handleStorySelect}
        onClose={handleBack}
        title="Your library"
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
  errorTitle: {
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontSize: 22,
    fontStyle: 'italic',
    color: theme.colors.ink.base,
    marginBottom: 10,
    textAlign: 'center',
  },
  errorMessage: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 15,
    color: theme.colors.ink.soft,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorBanner: {
    backgroundColor: theme.colors.paper.cardWarm,
    borderColor: theme.colors.error,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    margin: 16,
  },
  errorBannerText: {
    fontFamily: theme.typography.fontFamily.uiMedium,
    color: theme.colors.error,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default StorySelectionScreen;
