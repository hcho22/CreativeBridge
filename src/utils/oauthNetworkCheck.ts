/**
 * OAuth Network Check Utility
 *
 * Checks network connectivity before initiating OAuth flows
 * to provide better error messages and prevent unnecessary OAuth attempts
 */

import NetInfo from '@react-native-community/netinfo';

export interface NetworkCheckResult {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: string | null;
  error?: string;
}

/**
 * Check network connectivity before OAuth attempt
 * @returns Network check result
 */
export async function checkNetworkBeforeOAuth(): Promise<NetworkCheckResult> {
  try {
    const state = await NetInfo.fetch();

    return {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable ?? null,
      connectionType: state.type ?? null,
    };
  } catch (error) {
    console.error('Error checking network connectivity:', error);
    // Assume connected if we can't check (fail open)
    return {
      isConnected: true,
      isInternetReachable: null,
      connectionType: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get user-friendly network error message
 * @param networkState Network check result
 * @returns Error message or null if network is available
 */
export function getNetworkErrorMessage(
  networkState: NetworkCheckResult,
): string | null {
  if (networkState.isConnected && networkState.isInternetReachable !== false) {
    return null; // Network is available
  }

  if (!networkState.isConnected) {
    return 'No internet connection. Please check your network settings and try again.';
  }

  if (networkState.isInternetReachable === false) {
    return 'Internet connection is not available. Please check your network connection.';
  }

  return 'Network connection is unstable. Please try again.';
}
