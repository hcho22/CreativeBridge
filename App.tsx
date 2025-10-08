import React, { useEffect } from 'react';
import {
  StatusBar,
  View,
  ActivityIndicator,
  Text,
  Linking,
} from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation';
import { AuthScreen } from './src/screens';
import ErrorBoundary from './src/components/common/ErrorBoundary';
// SessionWarning interface is now defined inline

// Initialize Reactotron in development
if (__DEV__) {
  import('./src/services/reactotron');
}

const LoadingScreen: React.FC = () => (
  <View
    style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f0f2f5',
    }}
  >
    <ActivityIndicator size="large" color="#4CAF50" />
    <Text style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
      Loading...
    </Text>
  </View>
);

const MainApp: React.FC = () => {
  const { session, loading, emailConfirmed, checkEmailConfirmation } =
    useAuth();

  // ALL useEffect hooks must be called at the top level, before any returns
  useEffect(() => {
    // Handle deep links for email confirmation
    const handleDeepLink = async (url: string) => {
      console.log('Deep link received:', url);

      // Check if it's a Supabase auth callback
      if (url.includes('#access_token=') || url.includes('?access_token=')) {
        try {
          // For newer versions of Supabase, the session is automatically handled
          // We just need to check the confirmation status
          console.log('Email confirmation callback detected via deep link');

          // Give Supabase a moment to process the callback
          setTimeout(async () => {
            await checkEmailConfirmation();
          }, 1000);
        } catch (error) {
          console.error('Error handling auth callback:', error);
        }
      }
    };

    // Handle app launch with deep link
    Linking.getInitialURL().then(url => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Handle deep links while app is running
    const linkingSubscription = Linking.addEventListener('url', event => {
      handleDeepLink(event.url);
    });

    return () => {
      linkingSubscription?.remove();
    };
  }, [checkEmailConfirmation]);

  // Now handle the conditional rendering AFTER all hooks
  if (loading) {
    return <LoadingScreen />;
  }

  // Show auth screen if no session OR if user exists but email is not confirmed
  if (!session || (session.user && !emailConfirmed)) {
    return <AuthScreen />;
  }

  // User is authenticated and email is confirmed
  return <AppNavigator />;
};

const App: React.FC = () => {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('App-level error caught:', error, errorInfo);

        // In production, this would send to crash reporting service
        // Example: Sentry.captureException(error, { extra: errorInfo });
      }}
    >
      <AuthProvider>
        <StatusBar barStyle="light-content" backgroundColor="#4CAF50" />
        <MainApp />
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
