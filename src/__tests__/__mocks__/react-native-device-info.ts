/**
 * Mock for react-native-device-info
 */

export default {
  getTotalMemory: jest.fn().mockResolvedValue(4 * 1024 * 1024 * 1024), // 4GB
  getAvailableMemory: jest.fn().mockResolvedValue(2 * 1024 * 1024 * 1024), // 2GB
  getDeviceType: jest.fn().mockReturnValue('Handset'),
  getSystemName: jest.fn().mockReturnValue('iOS'),
  getSystemVersion: jest.fn().mockReturnValue('15.0'),
};