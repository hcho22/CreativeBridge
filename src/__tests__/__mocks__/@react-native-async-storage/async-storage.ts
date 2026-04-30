/**
 * Mock for @react-native-async-storage/async-storage
 */

const storage: Record<string, string> = {};

export default {
  setItem: jest.fn().mockImplementation(async (key: string, value: string) => {
    storage[key] = value;
    return Promise.resolve();
  }),

  getItem: jest.fn().mockImplementation(async (key: string) => {
    return Promise.resolve(storage[key] || null);
  }),

  removeItem: jest.fn().mockImplementation(async (key: string) => {
    delete storage[key];
    return Promise.resolve();
  }),

  getAllKeys: jest.fn().mockImplementation(async () => {
    return Promise.resolve(Object.keys(storage));
  }),

  multiRemove: jest.fn().mockImplementation(async (keys: string[]) => {
    keys.forEach(key => delete storage[key]);
    return Promise.resolve();
  }),

  clear: jest.fn().mockImplementation(async () => {
    Object.keys(storage).forEach(key => delete storage[key]);
    return Promise.resolve();
  }),
};
