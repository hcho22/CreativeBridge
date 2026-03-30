// Mock device info for testing
export const mockDeviceInfo = {
  getUniqueId: jest.fn().mockResolvedValue('test-device-id-123'),
  getDeviceName: jest.fn().mockResolvedValue('Test Device'),
  getSystemName: jest.fn().mockResolvedValue('iOS'),
  getSystemVersion: jest.fn().mockResolvedValue('15.0'),
  getVersion: jest.fn().mockResolvedValue('1.0.0'),
  getBuildNumber: jest.fn().mockResolvedValue('1'),
  getDeviceDimensions: jest.fn().mockResolvedValue({
    width: 375,
    height: 812,
  }),
  isEmulator: jest.fn().mockResolvedValue(false),
  isTablet: jest.fn().mockResolvedValue(false),
  hasNotch: jest.fn().mockResolvedValue(true),
  hasDynamicIsland: jest.fn().mockResolvedValue(false),
  getDeviceType: jest.fn().mockReturnValue('Handset'),
  getDeviceId: jest.fn().mockResolvedValue('test-device-id-123'),
  getInstanceId: jest.fn().mockResolvedValue('test-instance-id'),
  getSerialNumber: jest.fn().mockResolvedValue('test-serial'),
  getAndroidId: jest.fn().mockResolvedValue('test-android-id'),
  getIpAddress: jest.fn().mockResolvedValue('127.0.0.1'),
  isCameraPresent: jest.fn().mockResolvedValue(true),
  getBatteryLevel: jest.fn().mockResolvedValue(0.85),
  getBatteryState: jest.fn().mockResolvedValue('unplugged'),
  getPowerState: jest.fn().mockResolvedValue({
    batteryLevel: 0.85,
    batteryState: 'unplugged',
    lowPowerMode: false,
  }),
  isLocationEnabled: jest.fn().mockResolvedValue(true),
  isHeadphonesConnected: jest.fn().mockResolvedValue(false),
  getAvailableLocationProviders: jest.fn().mockResolvedValue({
    gps: true,
    network: true,
    passive: true,
  }),
  getTotalMemory: jest.fn().mockResolvedValue(4000000000), // 4GB
  getAvailableMemory: jest.fn().mockResolvedValue(2000000000), // 2GB
  getUsedMemory: jest.fn().mockResolvedValue(2000000000), // 2GB
  getFreeDiskStorage: jest.fn().mockResolvedValue(16000000000), // 16GB
  getUserAgent: jest.fn().mockResolvedValue('CreativeBridge/1.0.0 (iOS 15.0)'),

  // Mock methods for different test scenarios
  __testUtils: {
    setEmulator: (isEmulator: boolean) => {
      mockDeviceInfo.isEmulator.mockResolvedValue(isEmulator);
    },
    setTablet: (isTablet: boolean) => {
      mockDeviceInfo.isTablet.mockResolvedValue(isTablet);
    },
    setSystemName: (systemName: string) => {
      mockDeviceInfo.getSystemName.mockResolvedValue(systemName);
    },
    setDeviceId: (deviceId: string) => {
      mockDeviceInfo.getUniqueId.mockResolvedValue(deviceId);
      mockDeviceInfo.getDeviceId.mockResolvedValue(deviceId);
    },
    setBatteryLevel: (level: number) => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(level);
    },
    setMemoryInfo: (total: number, used: number) => {
      mockDeviceInfo.getTotalMemory.mockResolvedValue(total);
      mockDeviceInfo.getUsedMemory.mockResolvedValue(used);
    },
    reset: () => {
      // Reset all mocks to default values
      mockDeviceInfo.getUniqueId.mockResolvedValue('test-device-id-123');
      mockDeviceInfo.getDeviceName.mockResolvedValue('Test Device');
      mockDeviceInfo.getSystemName.mockResolvedValue('iOS');
      mockDeviceInfo.getSystemVersion.mockResolvedValue('15.0');
      mockDeviceInfo.getVersion.mockResolvedValue('1.0.0');
      mockDeviceInfo.isEmulator.mockResolvedValue(false);
      mockDeviceInfo.isTablet.mockResolvedValue(false);
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.85);
    },
  },
};

export default mockDeviceInfo;
