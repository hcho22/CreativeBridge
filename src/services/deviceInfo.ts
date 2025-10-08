import { Platform, Dimensions } from 'react-native';

// Fallback device info when react-native-device-info is not available
export const fallbackDeviceInfo = {
  getUniqueId: async (): Promise<string> => {
    // Generate a pseudo-unique ID based on platform and timestamp
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `${Platform.OS}_${timestamp}_${random}`;
  },

  getDeviceName: async (): Promise<string> => {
    return Platform.OS === 'ios' ? 'iOS Device' : 'Android Device';
  },

  getSystemName: async (): Promise<string> => {
    return Platform.OS === 'ios' ? 'iOS' : 'Android';
  },

  getSystemVersion: async (): Promise<string> => {
    return Platform.Version.toString();
  },

  getVersion: async (): Promise<string> => {
    return '1.0.0'; // App version fallback
  },

  getDeviceDimensions: async (): Promise<{ width: number; height: number }> => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  },
};

// Try to import react-native-device-info, fall back to our implementation
let DeviceInfo: any;

try {
  DeviceInfo = require('react-native-device-info').default;
} catch (error) {
  console.warn('react-native-device-info not available, using fallback');
  DeviceInfo = fallbackDeviceInfo;
}

export default DeviceInfo;
