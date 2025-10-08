import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';

// Screen imports
import { HomeScreen, SettingsScreen, ProfileScreen } from '../screens';
import ImportOptionsScreen from '../screens/ImportOptionsScreen';
import StorySelectionScreen from '../screens/StorySelectionScreen';
import StoryPreviewEditScreen from '../screens/StoryPreviewEditScreen';

// Type definitions for navigation
export type TabParamList = {
  HomeStack: undefined;
  Settings: undefined;
  Profile: undefined;
};

// Stack navigation types for story continuation flow
export type HomeStackParamList = {
  Home: undefined;
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
      screenOptions={{
        headerStyle: {
          backgroundColor: '#4CAF50',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
      }}
    >
      <HomeStack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerTitle: '🏠 Home',
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
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopWidth: 1,
            borderTopColor: '#E5E5EA',
            paddingBottom: 5,
            paddingTop: 5,
            height: 60,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
          headerStyle: {
            backgroundColor: '#4CAF50',
          },
          headerTintColor: '#ffffff',
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 18,
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
            title: 'Settings ⚙️',
            headerTitle: '⚙️ Game Settings',
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            title: 'Profile 👤',
            headerTitle: '👤 Your Profile',
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
