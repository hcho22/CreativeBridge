import React, { useEffect, useRef, useState } from 'react';
import {
  StatusBar,
  View,
  ActivityIndicator,
  Text,
  Linking,
  AppState,
  StyleSheet,
} from 'react-native';
import { useFonts } from 'expo-font';
import { KaushanScript_400Regular } from '@expo-google-fonts/kaushan-script';
import { ArchitectsDaughter_400Regular } from '@expo-google-fonts/architects-daughter';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation';
import {
  AuthScreen,
  ProfileCompletionScreen,
  AgeGatingScreen,
  ConsentPendingScreen,
} from './src/screens';
import ParentEmailScreen from './src/screens/ParentEmailScreen';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import { ConditionalClerkProvider } from './src/components/common/ConditionalClerkProvider';
import { isClerkConfigured } from './src/config/environment';
import {
  isClerkCallback,
  handleClerkCallback,
} from './src/utils/clerkDeepLink';
import { useSafeClerkAuth } from './src/hooks/useSafeClerkAuth';
import { useQuery } from 'convex/react';
import { api } from './src/services/convex';
// Note (US-016): Supabase import removed — auth handled by Clerk only

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
  const [fontsLoaded] = useFonts({
    KaushanScript_400Regular,
    ArchitectsDaughter_400Regular,
  });
  const {
    loading,
    needsProfileCompletion,
    needsAgeVerification,
    refreshProfile,
    signOut,
  } = useAuth();
  const { clerkUser, clerkAuth } = useSafeClerkAuth();
  const appState = useRef(AppState.currentState);
  const clerkCallbackProcessed = useRef(false);

  // COPPA consent check (US-002) — Convex reactive query
  const consentCheck = useQuery(
    api.consent.isConsentRequired,
    clerkAuth?.userId ? {} : 'skip',
  );

  // ALL useEffect hooks must be called at the top level, before any returns
  useEffect(() => {
    /**
     * Handle deep links for OAuth callbacks.
     *
     * Clerk OAuth Deep Linking Flow:
     * 1. User initiates OAuth via signInWithGoogle/Apple in AuthContext
     * 2. Clerk opens OAuth provider (Google/Apple) in browser/webview
     * 3. User authenticates with OAuth provider
     * 4. OAuth provider redirects to: creativebridge://auth/callback?__clerk_redirect_url=...
     * 5. This deep link handler receives the callback URL
     * 6. ClerkProvider automatically processes the redirect URL
     * 7. AuthContext monitors Clerk auth state changes via useEffect
     * 8. When clerkAuth.isSignedIn becomes true, AuthContext calls handleClerkAuthComplete
     * 9. handleClerkAuthComplete sets AppUser + checks profile completion
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
                // AuthContext's useEffect will detect this and call handleClerkAuthComplete
                // which will set AppUser and check profile completion
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

      // Note (US-016): Supabase auth callback handling removed.
      // Clerk handles all auth callbacks via ClerkProvider.
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
  }, [clerkAuth, clerkUser]);

  // Now handle the conditional rendering AFTER all hooks
  if (loading || !fontsLoaded) {
    return <LoadingScreen />;
  }

  // Debug auth state
  console.log('🔍 [App] Auth state check:', {
    clerkIsSignedIn: clerkAuth?.isSignedIn,
    clerkUserId: clerkAuth?.userId,
    hasClerkUser: !!clerkUser,
  });

  // US-016: Clerk is the sole auth provider
  const isAuthenticated = clerkAuth?.isSignedIn === true;

  if (!isAuthenticated) {
    console.log('🔍 [App] Not authenticated, showing auth screen');
    return <AuthScreen />;
  }

  // US-001: Age-gating — prompt for age group if not yet provided
  // Must run BEFORE profile completion so that ProfileCompletionScreen
  // can check ageGroup and block real name auto-fill for under-13 users (US-010)
  if (needsAgeVerification) {
    return (
      <AgeGatingScreen
        onComplete={async () => {
          await refreshProfile();
        }}
      />
    );
  }

  // Show profile completion screen for OAuth users who need to complete their profile
  // By this point, ageGroup is already set (from AgeGatingScreen above)
  if (
    needsProfileCompletion &&
    clerkUser?.isLoaded &&
    clerkUser?.isSignedIn &&
    clerkUser?.user?.id
  ) {
    return (
      <ProfileCompletionScreen
        onComplete={async () => {
          // Refresh profile after completion
          // AuthContext will automatically update needsProfileCompletion state
          // when the profile is refreshed and found to be complete
          await refreshProfile();
        }}
        onSkip={async () => {
          // Profile was created and refreshProfile() was called in ProfileCompletionScreen
          // Now refresh the profile state in App to update needsProfileCompletion
          console.log(
            '✅ [App] Profile skip completed - refreshing profile state',
          );
          await refreshProfile();
          // Re-check profile completion to update needsProfileCompletion state
          // This ensures the app navigates to main content after skip
        }}
      />
    );
  }

  // US-002 / US-022: COPPA consent gating for under-13 users
  if (consentCheck?.required) {
    if (consentCheck.reason === 'consent_pending') {
      // Parent email was submitted, waiting for parent to grant consent
      return (
        <ConsentPendingScreen
          onConsentGranted={async () => {
            await refreshProfile();
          }}
          onSignOut={async () => {
            await signOut();
          }}
        />
      );
    }

    // US-022: renewal_required — annual consent has expired, needs re-verification
    if (consentCheck.reason === 'renewal_required') {
      return (
        <ParentEmailScreen
          isRenewal
          onConsentInitiated={async () => {
            await refreshProfile();
          }}
        />
      );
    }

    // consent_needed: age-gating identified under-13 but no parent email submitted yet
    return (
      <ParentEmailScreen
        onConsentInitiated={async () => {
          // The Convex query will reactively update consentCheck
          // which will switch to ConsentPendingScreen
          await refreshProfile();
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
            <StatusBar barStyle="dark-content" backgroundColor="#fcfcfc" />
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
    backgroundColor: '#fcfcfc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fcfcfc',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
});

export default App;
