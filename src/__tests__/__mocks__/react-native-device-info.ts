/**
 * Mock for react-native-device-info
 */

export default {
  getTotalMemory: jest.fn().mockResolvedValue(4 * 1024 * 1024 * 1024), // 4GB
  getAvailableMemory: jest.fn().mockResolvedValue(2 * 1024 * 1024 * 1024), // 2GB
  getUsedMemory: jest.fn().mockResolvedValue(2 * 1024 * 1024 * 1024), // 2GB
  getBatteryLevel: jest.fn().mockResolvedValue(0.8),
  getBatteryState: jest.fn().mockResolvedValue('unplugged'),
  getPowerState: jest.fn().mockResolvedValue({
    batteryLevel: 0.8,
    batteryState: 'unplugged',
    lowPowerMode: false,
  }),
  getFreeDiskStorage: jest.fn().mockResolvedValue(16 * 1024 * 1024 * 1024), // 16GB
  getDeviceType: jest.fn().mockReturnValue('Handset'),
  getSystemName: jest.fn().mockReturnValue('iOS'),
  getSystemVersion: jest.fn().mockReturnValue('15.0'),
};
