import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';

// Screen imports
import { HomeScreen, SettingsScreen, ProfileScreen } from '../screens';

// Type definitions for navigation
export type TabParamList = {
  Home: undefined;
  Settings: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

// Extract icon component to avoid nested component definition
const TabBarIcon: React.FC<{ route: any; color: string; size: number }> = ({
  route,
  color,
  size,
}) => {
  let emoji: string;

  switch (route.name) {
    case 'Home':
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
          name="Home"
          component={HomeScreen}
          options={{
            title: 'Home',
            headerTitle: '🏠 Home',
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
