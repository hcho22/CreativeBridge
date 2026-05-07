import { useEffect } from 'react';

// Conditionally import reactotron only in dev
let reactotron: {
  log?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  display?: (config: unknown) => void;
} = {};
if (__DEV__) {
  try {
    reactotron = require('../services/reactotron').default;
  } catch {
    // Reactotron not available
  }
}

/**
 * Custom hook for Reactotron debugging utilities
 */
export const useReactotron = () => {
  // Log component mount/unmount in development
  useEffect(() => {
    if (__DEV__) {
      const componentName =
        new Error().stack?.split('\n')[2]?.trim().split(' ')[1] || 'Unknown';
      reactotron.log?.(`🎯 Component ${componentName} mounted`);

      return () => {
        reactotron.log?.(`🚫 Component ${componentName} unmounted`);
      };
    }
  }, []);

  const logError = (error: Error, context?: string) => {
    if (__DEV__) {
      reactotron.error?.(
        context ? `${context}: ${error.message}` : error.message,
        error,
      );
    }
  };

  const logInfo = (message: string, data?: unknown) => {
    if (__DEV__) {
      reactotron.log?.(message, data);
    }
  };

  const logWarning = (message: string, _data?: unknown) => {
    if (__DEV__) {
      reactotron.warn?.(message);
    }
  };

  const displayObject = (
    name: string,
    object: string | number | boolean | object | null | undefined,
  ) => {
    if (__DEV__) {
      reactotron.display?.({
        name,
        value: object,
        preview: JSON.stringify(object, null, 2).substring(0, 100) + '...',
      });
    }
  };

  return {
    logError,
    logInfo,
    logWarning,
    displayObject,
  };
};

export default useReactotron;
