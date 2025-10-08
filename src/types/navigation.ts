import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { StackNavigationProp } from '@react-navigation/stack';

// Tab navigation types
export type TabParamList = {
  Home: undefined;
  Settings: undefined;
  Profile: undefined;
};

// Auth stack navigation types
export type AuthStackParamList = {
  Auth: undefined;
};

// Screen-specific navigation prop types
export type HomeScreenNavigationProp = BottomTabNavigationProp<
  TabParamList,
  'Home'
>;
export type SettingsScreenNavigationProp = BottomTabNavigationProp<
  TabParamList,
  'Settings'
>;
export type ProfileScreenNavigationProp = BottomTabNavigationProp<
  TabParamList,
  'Profile'
>;
export type AuthScreenNavigationProp = StackNavigationProp<
  AuthStackParamList,
  'Auth'
>;

// Combined navigation types for complex navigation scenarios
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
} & TabParamList;
