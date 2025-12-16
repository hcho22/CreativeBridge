import React, { useEffect, useRef } from 'react';
import {
  StatusBar,
  View,
  ActivityIndicator,
  Text,
  Linking,
  AppState,
} from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation';
import { AuthScreen } from './src/screens';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import { supabase } from './src/services/supabase';
import {
  isClerkCallback,
  handleClerkCallback,
} from './src/utils/clerkDeepLink';

// Import expo-web-browser with error handling for native module linking
let WebBrowser: any = null;
try {
  WebBrowser = require('expo-web-browser');
} catch (error) {
  console.warn(
    '⚠️ expo-web-browser native module not available. Run "cd ios && pod install" to link it.',
  );
}
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
  const appState = useRef(AppState.currentState);

  // ALL useEffect hooks must be called at the top level, before any returns
  useEffect(() => {
    // Handle deep links for email confirmation and OAuth callbacks
    const handleDeepLink = async (url: string) => {
      console.log('🔗 Deep link received:', url);

      // Complete OAuth session when deep link is received (important for expo-web-browser)
      try {
        if (WebBrowser?.maybeCompleteAuthSession) {
          WebBrowser.maybeCompleteAuthSession();
        }
      } catch (error) {
        // Ignore errors if maybeCompleteAuthSession is not available
      }

      // Check if it's a Clerk OAuth callback first
      // Clerk callbacks typically come as: creativebridge://auth/callback?__clerk_redirect_url=...
      if (isClerkCallback(url)) {
        try {
          console.log('🔐 Clerk OAuth callback detected via deep link');

          const result = handleClerkCallback(url);

          if (result.success && result.redirectUrl) {
            console.log('✅ Clerk callback processed successfully');
            // ClerkProvider will handle the redirect URL automatically
            // The OAuth flow will complete when Clerk processes the redirect
          } else if (result.error) {
            console.error('❌ Clerk OAuth callback error:', result.error);
            if (result.errorDescription) {
              console.error('Error description:', result.errorDescription);
            }
          }
        } catch (error) {
          console.error('❌ Error handling Clerk callback:', error);
        }
        return; // Don't process as Supabase callback
      }

      // Check if it's a Supabase auth callback (email confirmation or OAuth)
      // OAuth callbacks typically come as: creativebridge://auth/callback#access_token=...&refresh_token=...
      // Email confirmation comes as: creativebridge://auth/callback?token=...&type=...
      if (
        url.includes('#access_token=') ||
        url.includes('?access_token=') ||
        url.includes('access_token=') ||
        url.includes('auth/callback')
      ) {
        try {
          console.log(
            '✅ Auth callback detected via deep link (email confirmation or OAuth)',
          );

          // Parse the URL to extract tokens
          // Supabase OAuth callbacks use hash fragments: #access_token=...&refresh_token=...
          const hashMatch = url.match(/#(.+)/);
          const queryMatch = url.match(/\?(.+)/);

          if (hashMatch) {
            // Parse hash fragment (OAuth callback)
            const hashParams = new URLSearchParams(hashMatch[1]);
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            const errorParam = hashParams.get('error');
            const errorDescription = hashParams.get('error_description');

            if (errorParam) {
              console.error(
                '❌ OAuth error in callback:',
                errorParam,
                errorDescription,
              );
              return;
            }

            if (accessToken && refreshToken) {
              console.log('🔐 Setting OAuth session from callback...');

              // Set the session manually since detectSessionInUrl is false
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

              if (error) {
                console.error('❌ Error setting OAuth session:', error);
                console.error(
                  '❌ Error details:',
                  JSON.stringify(error, null, 2),
                );
              } else {
                console.log('✅ OAuth session set successfully');
                // The auth state change listener in AuthContext will handle the rest
                // Give it a moment to process
                setTimeout(async () => {
                  await checkEmailConfirmation();
                }, 500);
              }
            } else {
              console.warn('⚠️ OAuth callback missing required tokens');
              console.warn('⚠️ URL received:', url.substring(0, 200));
            }
          } else if (queryMatch) {
            // Parse query params (email confirmation)
            const queryParams = new URLSearchParams(queryMatch[1]);
            const token = queryParams.get('token');
            const type = queryParams.get('type');

            if (token && type === 'recovery') {
              // Password reset - handled elsewhere
              console.log('📧 Password reset token detected');
            } else if (token) {
              // Email confirmation - Supabase handles this automatically
              console.log('📧 Email confirmation token detected');
              // Give Supabase a moment to process
              setTimeout(async () => {
                await checkEmailConfirmation();
              }, 1000);
            }
          } else {
            // Fallback: Let Supabase try to detect the session
            console.log('🔄 Attempting to detect session from URL...');
            setTimeout(async () => {
              await checkEmailConfirmation();
            }, 1000);
          }
        } catch (error) {
          console.error('❌ Error handling auth callback:', error);
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

    // Handle app state changes to complete OAuth session when app returns from background
    const appStateSubscription = AppState.addEventListener(
      'change',
      nextAppState => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          // App has come to the foreground - try to complete OAuth session
          console.log(
            '🔄 App returned to foreground, checking for OAuth completion...',
          );
          try {
            if (WebBrowser?.maybeCompleteAuthSession) {
              WebBrowser.maybeCompleteAuthSession();
            }
          } catch (error) {
            // Ignore errors
          }
        }
        appState.current = nextAppState;
      },
    );

    return () => {
      linkingSubscription?.remove();
      appStateSubscription?.remove();
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
