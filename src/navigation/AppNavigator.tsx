import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import { AdaptiveGlassBackground } from '../components/common/AdaptiveGlassBackground';
import { theme } from '../constants/theme';
import type { StorySetupAnswers } from '../types/storySetup';

// Screen imports
import { HomeScreen, SettingsScreen, ProfileScreen } from '../screens';
import ImportOptionsScreen from '../screens/ImportOptionsScreen';
import StorySelectionScreen from '../screens/StorySelectionScreen';
import StoryPreviewEditScreen from '../screens/StoryPreviewEditScreen';
import StorySetupScreen from '../screens/StorySetupScreen';

// Type definitions for navigation
export type TabParamList = {
  HomeStack: undefined;
  Settings: undefined;
  Profile: undefined;
};

// Stack navigation types for story continuation flow
export type HomeStackParamList = {
  Home:
    | {
        continueStory?: {
          sessionId: string;
          importedContent: string;
          storySource: string;
          gradeLevel: string;
          metadata?: any;
        };
        storySetup?: StorySetupAnswers;
      }
    | undefined;
  ImportOptions: undefined;
  StorySelection: undefined;
  StoryPreviewEdit: {
    story: {
      id: string;
      story_content: string;
      story_metadata?: any;
      story_source?: string;
      grade_level?: string;
      created_at?: string;
    };
  };
  StorySetup: undefined;
};

// Auth navigation types (for stack navigation if needed)
export type AuthStackParamList = {
  Auth: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const HomeStack = createStackNavigator<HomeStackParamList>();

// HomeStack component for story continuation flow
const HomeStackNavigator: React.FC = () => {
  return (
    <HomeStack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerTransparent: true,
        headerBackground: () => (
          <AdaptiveGlassBackground
            glassStyle={theme.glass.surfaces.navigationHeader.glassStyle}
            fallbackBlurIntensity={
              theme.glass.surfaces.navigationHeader.fallbackBlurIntensity
            }
            fallbackBlurTint={
              theme.glass.surfaces.navigationHeader.fallbackBlurTint
            }
            androidFallbackColor={
              theme.glass.surfaces.navigationHeader.androidFallbackColor
            }
            style={StyleSheet.absoluteFill}
          />
        ),
        headerTintColor: '#333',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 20,
        },
      }}
    >
      <HomeStack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerShown: false, // Hide header on Home screen
        }}
      />
      <HomeStack.Screen
        name="ImportOptions"
        component={ImportOptionsScreen}
        options={{
          headerTitle: '📥 Import Story',
          headerBackTitle: 'Home',
        }}
      />
      <HomeStack.Screen
        name="StorySelection"
        component={StorySelectionScreen}
        options={{
          headerTitle: '📚 Select Story',
          headerBackTitle: 'Import',
        }}
      />
      <HomeStack.Screen
        name="StoryPreviewEdit"
        component={StoryPreviewEditScreen}
        options={{
          headerTitle: '📖 Story Preview',
          headerBackTitle: 'Stories',
        }}
      />
      <HomeStack.Screen
        name="StorySetup"
        component={StorySetupScreen}
        options={{ headerShown: false }}
      />
    </HomeStack.Navigator>
  );
};

// Extract icon component to avoid nested component definition
const TabBarIcon: React.FC<{
  route: { name: keyof TabParamList };
  color: string;
  size: number;
}> = ({ route, color, size }) => {
  let emoji: string;

  switch (route.name) {
    case 'HomeStack':
      emoji = '🏠';
      break;
    case 'Settings':
      emoji = '⚙️';
      break;
    case 'Profile':
      emoji = '👤';
      break;
    default:
      emoji = '🏠';
  }

  return <Text style={{ fontSize: size, color }}>{emoji}</Text>;
};

const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon route={route} color={color} size={size} />
          ),
          tabBarActiveTintColor: '#4CAF50', // Story_Quest green
          tabBarInactiveTintColor: '#8E8E93',
          tabBarBackground: () => (
            <AdaptiveGlassBackground
              glassStyle={theme.glass.surfaces.tabBar.glassStyle}
              fallbackBlurIntensity={
                theme.glass.surfaces.tabBar.fallbackBlurIntensity
              }
              fallbackBlurTint={theme.glass.surfaces.tabBar.fallbackBlurTint}
              androidFallbackColor={
                theme.glass.surfaces.tabBar.androidFallbackColor
              }
            />
          ),
          tabBarStyle: {
            backgroundColor: 'transparent', // Transparent to let glass show through
            borderTopWidth: 0, // Remove border for seamless look
            position: 'absolute', // Absolute positioning for scroll-behind effect
            paddingBottom: 25, // Prevent home indicator from blocking text
            paddingTop: 8,
            height: 85,
          },
          tabBarLabelStyle: {
            fontSize: 14,
            fontWeight: '600',
          },
          headerStyle: {
            backgroundColor: '#fcfcfc',
          },
          headerTintColor: '#333',
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 20,
          },
        })}
      >
        <Tab.Screen
          name="HomeStack"
          component={HomeStackNavigator}
          options={{
            title: 'Home',
            headerShown: false, // Hide tab navigator header since HomeStack handles headers
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: 'Settings',
            headerShown: false,
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            title: 'Profile',
            headerShown: false,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
