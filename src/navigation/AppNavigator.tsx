import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import {
  NavigationContainer,
  getFocusedRouteNameFromRoute,
} from '@react-navigation/native';
import { AdaptiveGlassBackground } from '../components/common/AdaptiveGlassBackground';
import { BookIcon, QuillIcon } from '../components/common/storybook';
import { theme } from '../constants/theme';
import type { StorySetupAnswers } from '../types/storySetup';

// Screen imports
import { HomeScreen, SettingsScreen, ProfileScreen } from '../screens';
import ImportOptionsScreen from '../screens/ImportOptionsScreen';
import StorySelectionScreen from '../screens/StorySelectionScreen';
import StoryPreviewEditScreen from '../screens/StoryPreviewEditScreen';
import StorySetupScreen from '../screens/StorySetupScreen';
import ParentDashboardScreen from '../screens/ParentDashboardScreen';

// Type definitions for navigation
export type TabParamList = {
  HomeStack: undefined;
  SettingsStack: undefined;
  Profile: undefined;
};

// Settings stack navigation types (US-021: ParentDashboard)
export type SettingsStackParamList = {
  Settings: undefined;
  ParentDashboard: undefined;
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
const SettingsStack = createStackNavigator<SettingsStackParamList>();

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
            style={StyleSheet.absoluteFill as ViewStyle}
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

// SettingsStack component for parent dashboard navigation (US-021)
const SettingsStackNavigator: React.FC = () => {
  return (
    <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStack.Screen name="Settings" component={SettingsScreen} />
      <SettingsStack.Screen
        name="ParentDashboard"
        component={ParentDashboardScreen}
      />
    </SettingsStack.Navigator>
  );
};

// US-004: Storybook tab icons. The 36×3 foxglove pill above the active icon
// matches /tmp/cb_design/components/screens-core.jsx:330-335. React Navigation
// bottom-tabs has no tabBarIndicator, so we render the pill as an absolute-
// positioned sibling here when focused=true.
const TabBarIcon: React.FC<{
  route: { name: keyof TabParamList };
  color: string;
  focused: boolean;
}> = ({ route, color, focused }) => {
  let icon: React.ReactNode;

  switch (route.name) {
    case 'HomeStack':
      icon = <BookIcon size={22} color={color} />;
      break;
    case 'SettingsStack':
      icon = <Text style={[tabIconStyles.cogLabel, { color }]}>⚙</Text>;
      break;
    case 'Profile':
      icon = <QuillIcon size={22} color={color} />;
      break;
    default:
      icon = <BookIcon size={22} color={color} />;
  }

  return (
    <View style={tabIconStyles.wrapper}>
      {focused && <View style={tabIconStyles.activePill} />}
      {icon}
    </View>
  );
};

const tabIconStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
  },
  activePill: {
    position: 'absolute',
    top: -2,
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.accents.foxglove,
  },
  cogLabel: {
    fontSize: 22,
  },
});

const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon route={route} color={color} focused={focused} />
          ),
          // US-004: foxglove active / ink-faint inactive per storybook TabBar.
          tabBarActiveTintColor: theme.colors.accents.foxglove,
          tabBarInactiveTintColor: theme.colors.ink.faint,
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
          options={({ route }) => {
            // Hide the tab bar when a full-screen wizard (e.g. StorySetup) is focused
            const routeName = getFocusedRouteNameFromRoute(route) ?? 'Home';
            const hideTabBar = routeName === 'StorySetup';

            return {
              title: 'Home',
              tabBarLabel: 'Library',
              headerShown: false,
              ...(hideTabBar && {
                tabBarStyle: { display: 'none' as const },
              }),
            };
          }}
        />
        <Tab.Screen
          name="SettingsStack"
          component={SettingsStackNavigator}
          options={{
            title: 'Settings',
            tabBarLabel: 'Workshop',
            headerShown: false,
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            title: 'Profile',
            tabBarLabel: 'Author',
            headerShown: false,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
