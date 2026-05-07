/**
 * Mock for react-native-keychain
 */

export const ACCESS_CONTROL = {
  BIOMETRY_ANY_OR_DEVICE_PASSCODE: 'BiometryAnyOrDevicePasscode',
};

export const AUTHENTICATION_TYPE = {
  DEVICE_PASSCODE_OR_BIOMETRICS: 'DevicePasscodeOrBiometrics',
};

export const STORAGE_TYPE = {
  KC: 'KC',
};

interface Credentials {
  username: string;
  password: string;
}

const storage: Record<string, Credentials> = {};

export const setInternetCredentials = jest
  .fn()
  .mockImplementation(
    async (
      service: string,
      username: string,
      password: string,
      _options?: any,
    ) => {
      storage[service] = { username, password };
      return Promise.resolve(true);
    },
  );

export const getInternetCredentials = jest
  .fn()
  .mockImplementation(async (service: string) => {
    const credentials = storage[service];
    return credentials || false;
  });

export const resetInternetCredentials = jest
  .fn()
  .mockImplementation(async (service: string) => {
    delete storage[service];
    return Promise.resolve(true);
  });

export default {
  ACCESS_CONTROL,
  AUTHENTICATION_TYPE,
  STORAGE_TYPE,
  setInternetCredentials,
  getInternetCredentials,
  resetInternetCredentials,
};
