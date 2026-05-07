// Global Jest mock for react-native-fs.
//
// Wired in via jest.config.js moduleNameMapper, so any production code that
// does `import * as RNFS from 'react-native-fs'` (e.g. enhancedErrorHandling)
// gets these stubs without requiring per-test setup. Tests can still override
// individual fns via the standard mock APIs:
//
//   import * as RNFS from 'react-native-fs';
//   (RNFS.exists as jest.Mock).mockResolvedValue(true);

const writeFile = jest.fn().mockResolvedValue(undefined);
const readFile = jest.fn().mockResolvedValue('');
const exists = jest.fn().mockResolvedValue(false);
const mkdir = jest.fn().mockResolvedValue(undefined);
const moveFile = jest.fn().mockResolvedValue(undefined);
const copyFile = jest.fn().mockResolvedValue(undefined);
const unlink = jest.fn().mockResolvedValue(undefined);
const readDir = jest.fn().mockResolvedValue([]);
const stat = jest.fn().mockResolvedValue({
  isFile: () => true,
  isDirectory: () => false,
  size: 0,
  mtime: new Date(0),
  ctime: new Date(0),
});
const downloadFile = jest.fn().mockReturnValue({
  promise: Promise.resolve({ statusCode: 200, bytesWritten: 0 }),
  jobId: 1,
});

const exports_ = {
  DocumentDirectoryPath: '/mock/documents',
  ExternalDirectoryPath: '/mock/external',
  ExternalStorageDirectoryPath: '/mock/external',
  DownloadDirectoryPath: '/mock/downloads',
  TemporaryDirectoryPath: '/mock/tmp',
  CachesDirectoryPath: '/mock/cache',
  writeFile,
  readFile,
  exists,
  mkdir,
  moveFile,
  copyFile,
  unlink,
  readDir,
  stat,
  downloadFile,
};

module.exports = {
  __esModule: true,
  default: exports_,
  ...exports_,
};
