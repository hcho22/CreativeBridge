import React from 'react';
import { StatusBar } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation';
import { AuthScreen } from './src/screens';

// Initialize Reactotron in development
if (__DEV__) {
  import('./src/services/reactotron');
}

const MainApp: React.FC = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return null; // Could add a loading screen here
  }

  // If user is authenticated, show the main app with navigation
  // Otherwise, show the authentication screen
  return session ? <AppNavigator /> : <AuthScreen />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <StatusBar barStyle="light-content" backgroundColor="#4CAF50" />
      <MainApp />
    </AuthProvider>
  );
};

export default App;
