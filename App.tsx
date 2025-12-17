import React, { useEffect, useRef } from 'react';
import {
  StatusBar,
  View,
  ActivityIndicator,
  Text,
  Linking,
  AppState,
  StyleSheet,
} from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation';
import { AuthScreen, ProfileCompletionScreen } from './src/screens';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import { ConditionalClerkProvider } from './src/components/common/ConditionalClerkProvider';
import { isClerkConfigured } from './src/config/environment';
import {
  isClerkCallback,
  handleClerkCallback,
} from './src/utils/clerkDeepLink';
import { useSafeClerkAuth } from './src/hooks/useSafeClerkAuth';
import { supabase } from './src/services/supabase';

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
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#4CAF50" />
    <Text style={styles.loadingText}>Loading...</Text>
  </View>
);

const MainApp: React.FC = () => {
  const {
    session,
    loading,
    emailConfirmed,
    checkEmailConfirmation,
    needsProfileCompletion,
    refreshProfile,
  } = useAuth();
  const { clerkUser, clerkAuth } = useSafeClerkAuth();
  const appState = useRef(AppState.currentState);
  const clerkCallbackProcessed = useRef(false);

  // ALL useEffect hooks must be called at the top level, before any returns
  useEffect(() => {
    /**
     * Handle deep links for email confirmation and OAuth callbacks
     *
     * Clerk OAuth Deep Linking Flow:
     * 1. User initiates OAuth via signInWithGoogle/Apple in AuthContext
     * 2. Clerk opens OAuth provider (Google/Apple) in browser/webview
     * 3. User authenticates with OAuth provider
     * 4. OAuth provider redirects to: creativebridge://auth/callback?__clerk_redirect_url=...
     * 5. This deep link handler receives the callback URL
     * 6. ClerkProvider automatically processes the redirect URL
     * 7. AuthContext monitors Clerk auth state changes via useEffect
     * 8. When clerkAuth.isSignedIn becomes true, AuthContext calls handleClerkOAuthCompletion
     * 9. handleClerkOAuthCompletion:
     *    - Retrieves Clerk JWT using getToken()
     *    - Sends Clerk JWT to Supabase for verification via completeOAuthFlow
     *    - Creates Supabase session using Clerk user ID
     *    - Updates auth state (session, user, userProfile)
     *    - Checks if profile completion is needed
     */
    const handleDeepLink = async (url: string) => {
      console.log('🔗 [App] Deep link received:', url);

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
          console.log('🔐 [App] Clerk OAuth callback detected via deep link');
          console.log('🔐 [App] Callback URL:', url.substring(0, 200));

          const result = handleClerkCallback(url);

          // Check for errors first
          if (result.error) {
            console.error('❌ [App] Clerk OAuth callback error:', result.error);
            if (result.errorDescription) {
              console.error(
                '❌ [App] Error description:',
                result.errorDescription,
              );
            }

            // Handle specific error types
            if (
              result.error === 'access_denied' ||
              result.error === 'user_cancelled'
            ) {
              console.log('ℹ️ [App] User cancelled OAuth flow (silent return)');
              // Don't show error to user for cancellation
              return;
            }

            // For other errors, log them but don't crash
            console.error(
              '❌ [App] OAuth error will be handled by AuthContext',
            );
            return;
          }

          if (result.success) {
            console.log('✅ [App] Clerk callback parsed successfully');
            if (result.redirectUrl) {
              console.log('✅ [App] Clerk redirect URL extracted');
            }

            // Mark that we've processed a Clerk callback
            clerkCallbackProcessed.current = true;

            // ClerkProvider will handle the redirect URL automatically
            // The OAuth flow will complete when Clerk processes the redirect
            // AuthContext monitors Clerk auth state changes and will complete the flow
            // via handleClerkOAuthCompletion when clerkAuth.isSignedIn becomes true

            // Give Clerk a moment to process the callback, then check if we need to trigger completion
            setTimeout(async () => {
              // Check if Clerk user is now signed in after callback
              if (clerkAuth?.isSignedIn) {
                console.log(
                  '✅ [App] Clerk user is signed in after callback - AuthContext will complete OAuth flow',
                );
                // AuthContext's useEffect will detect this and call handleClerkOAuthCompletion
                // which will:
                // 1. Retrieve Clerk JWT using getToken()
                // 2. Send Clerk JWT to Supabase for verification
                // 3. Handle Supabase session creation using Clerk user ID
                // 4. Update auth state
              } else {
                console.log(
                  '⏳ [App] Waiting for Clerk to complete authentication...',
                );
                // Clerk might still be processing - AuthContext will handle it when ready
              }
            }, 500);
          } else {
            console.warn('⚠️ [App] Clerk callback parsing returned no result');
          }
        } catch (error) {
          console.error('❌ [App] Error handling Clerk callback:', error);
          // Don't crash the app - let AuthContext handle OAuth completion
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
  }, [checkEmailConfirmation, clerkAuth, clerkUser]);

  // Now handle the conditional rendering AFTER all hooks
  if (loading) {
    return <LoadingScreen />;
  }

  // Debug auth state
  console.log('🔍 [App] Auth state check:', {
    hasSession: !!session,
    emailConfirmed,
    clerkIsSignedIn: clerkAuth?.isSignedIn,
    clerkUserId: clerkAuth?.userId,
    hasClerkUser: !!clerkUser,
  });

  // Show auth screen if:
  // 1. No Supabase session AND no Clerk session (not authenticated at all)
  // 2. OR if Supabase user exists but email is not confirmed (and not an OAuth user)
  const isClerkAuthenticated = clerkAuth?.isSignedIn === true;
  const isSupabaseAuthenticated = !!session;
  const isAuthenticated = isClerkAuthenticated || isSupabaseAuthenticated;

  // For OAuth users (Clerk), email is always confirmed
  // For email/password users (Supabase), check emailConfirmed state
  const needsEmailConfirmation =
    isSupabaseAuthenticated &&
    session?.user &&
    !emailConfirmed &&
    !isClerkAuthenticated;

  if (!isAuthenticated || needsEmailConfirmation) {
    console.log('🔍 [App] Showing auth screen:', {
      isAuthenticated,
      needsEmailConfirmation,
      isClerkAuthenticated,
      isSupabaseAuthenticated,
    });
    return <AuthScreen />;
  }

  // Show profile completion screen for OAuth users who need to complete their profile
  if (needsProfileCompletion && clerkUser?.id) {
    return (
      <ProfileCompletionScreen
        onComplete={async () => {
          // Refresh profile after completion
          // AuthContext will automatically update needsProfileCompletion state
          // when the profile is refreshed and found to be complete
          await refreshProfile();
        }}
        onSkip={() => {
          // Allow skipping - user can complete later
          // AuthContext manages needsProfileCompletion state
          // The user can complete their profile later from Settings
        }}
      />
    );
  }

  // User is authenticated and email is confirmed
  return <AppNavigator />;
};

const App: React.FC = () => {
  // Check if Clerk is configured
  const clerkConfigured = isClerkConfigured();

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('App-level error caught:', error, errorInfo);

        // In production, this would send to crash reporting service
        // Example: Sentry.captureException(error, { extra: errorInfo });
      }}
    >
      {clerkConfigured ? (
        // Clerk is configured - wrap with ConditionalClerkProvider which will render ClerkProvider
        <ConditionalClerkProvider>
          <AuthProvider>
            <StatusBar barStyle="light-content" backgroundColor="#4CAF50" />
            <MainApp />
          </AuthProvider>
        </ConditionalClerkProvider>
      ) : (
        // Clerk is not configured - show error message
        // AuthProvider requires ClerkProvider, so we can't render it without Clerk
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>
            Clerk Authentication Not Configured
          </Text>
          <Text style={styles.errorText}>
            Please set the following environment variables:{'\n\n'}•
            CLERK_PUBLISHABLE_KEY{'\n'}• CLERK_JWKS_URL{'\n\n'}
            The app requires Clerk to be configured to function properly.
          </Text>
        </View>
      )}
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
});

export default App;
