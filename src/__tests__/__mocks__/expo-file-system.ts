export const documentDirectory = '/mock/documents/';
export const cacheDirectory = '/mock/cache/';

export const getInfoAsync = jest.fn().mockResolvedValue({
  exists: true,
  isDirectory: false,
  size: 1024,
  uri: '/mock/file.png',
  modificationTime: Date.now(),
});

export const readAsStringAsync = jest
  .fn()
  .mockResolvedValue('mock-file-content');
export const writeAsStringAsync = jest.fn().mockResolvedValue(undefined);
export const deleteAsync = jest.fn().mockResolvedValue(undefined);
export const moveAsync = jest.fn().mockResolvedValue(undefined);
export const copyAsync = jest.fn().mockResolvedValue(undefined);
export const makeDirectoryAsync = jest.fn().mockResolvedValue(undefined);
export const readDirectoryAsync = jest.fn().mockResolvedValue([]);
export const downloadAsync = jest.fn().mockResolvedValue({
  uri: '/mock/downloaded-file.png',
  status: 200,
  headers: {},
  md5: 'mock-md5',
});
export const uploadAsync = jest.fn().mockResolvedValue({
  status: 200,
  headers: {},
  body: '{}',
});
export const createDownloadResumable = jest.fn().mockReturnValue({
  downloadAsync: jest.fn().mockResolvedValue({ uri: '/mock/file.png' }),
  pauseAsync: jest.fn(),
  resumeAsync: jest.fn(),
});

export const EncodingType = {
  UTF8: 'utf8',
  Base64: 'base64',
};

export const FileSystemSessionType = {
  BACKGROUND: 0,
  FOREGROUND: 1,
};

export const FileSystemUploadType = {
  BINARY_CONTENT: 0,
  MULTIPART: 1,
};

export default {
  documentDirectory,
  cacheDirectory,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
  deleteAsync,
  moveAsync,
  copyAsync,
  makeDirectoryAsync,
  readDirectoryAsync,
  downloadAsync,
  uploadAsync,
  createDownloadResumable,
  EncodingType,
  FileSystemSessionType,
  FileSystemUploadType,
};
