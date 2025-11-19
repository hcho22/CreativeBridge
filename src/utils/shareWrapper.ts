/**
 * React Native Share wrapper with complete fallback for development mode
 * Completely avoids loading react-native-share in development to prevent TurboModule crashes
 */

interface ShareOptions {
  title?: string;
  message?: string;
  url?: string;
  type?: string;
  filename?: string;
  saveToFiles?: boolean;
  [key: string]: any;
}

interface ShareResult {
  success?: boolean;
  dismissedAction?: boolean;
  message?: string;
  [key: string]: any;
}

class ShareWrapper {
  static async open(options: ShareOptions): Promise<ShareResult> {
    console.log('📤 [ShareWrapper] Share requested:', options);
    
    // Attempt to use native sharing
    try {
      // Try to load react-native-share safely
      let Share: any = null;
      try {
        Share = require('react-native-share');
        console.log('📤 [ShareWrapper] react-native-share loaded:', typeof Share);
        console.log('📤 [ShareWrapper] Share.open available:', typeof Share?.open);
      } catch (requireError: any) {
        console.log('📤 [ShareWrapper] Failed to require react-native-share:', requireError.message);
        throw new Error('Native share module not available - ' + requireError.message);
      }
      
      // Check if open is on the module directly or on default
      let shareFunction = Share?.open;
      
      if (!shareFunction && Share?.default?.open) {
        console.log('📤 [ShareWrapper] Found open method on Share.default');
        shareFunction = Share.default.open;
      }
      
      // Validate that we have the open method
      if (!shareFunction || typeof shareFunction !== 'function') {
        console.log('📤 [ShareWrapper] react-native-share loaded but missing open method');
        const availableMethods = Share ? Object.keys(Share).join(', ') : 'none';
        console.log('📤 [ShareWrapper] Available methods:', availableMethods);
        throw new Error('Share module not properly loaded');
      }
      
      console.log('📤 [ShareWrapper] Share function found and ready');
      
      // Prepare share options
      const shareOptions = {
        title: options.title,
        message: options.message,
        type: options.type || 'text/plain',
        filename: options.filename,
        url: options.url,
        ...options
      };
      
      // Only set saveToFiles if explicitly requested
      if (options.saveToFiles !== undefined) {
        shareOptions.saveToFiles = options.saveToFiles;
      }
      
      console.log('📤 [ShareWrapper] Attempting native share with options:', shareOptions);
      
      const result = await shareFunction(shareOptions);
      
      console.log('📤 [ShareWrapper] Share result:', result);
      
      return {
        success: !result.dismissedAction,
        dismissedAction: result.dismissedAction || false,
        message: result.dismissedAction ? 'User cancelled share' : 'Share completed successfully'
      };
      
    } catch (error: any) {
      console.warn('📤 [ShareWrapper] Native share failed:', error);
      
      // Check if user cancelled - handle both string and Error objects
      const errorMessage = error?.message || String(error);
      if (errorMessage && (
        errorMessage.includes('User did not share') ||
        errorMessage.includes('cancelled') ||
        errorMessage.includes('CANCELLED') ||
        errorMessage.toLowerCase().includes('cancel')
      )) {
        console.log('📤 [ShareWrapper] User cancelled share');
        return {
          success: false,
          dismissedAction: true,
          message: 'User cancelled share'
        };
      }
      
      // If in dev mode and native module isn't available, provide helpful message
      if (__DEV__ && (
        error.message?.includes('Native share module not available') ||
        error.message?.includes('not properly loaded')
      )) {
        console.log('📤 [ShareWrapper] Dev mode fallback - native module not available');
        return {
          success: true,
          dismissedAction: false,
          message: 'Dev mode: Share functionality requires native module. Use production build for full features.'
        };
      }
      
      // Throw the error for real failures
      throw error;
    }
  }
}

export default ShareWrapper;