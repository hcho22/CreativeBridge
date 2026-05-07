// Shared Jest manual mock for @/utils/rnfsWrapper.
//
// Tests opt in with `jest.mock('@/utils/rnfsWrapper')` (or relative path).
// Self-contained: every method is a jest.fn() with a sensible default; tests
// override individual methods via the standard mock APIs:
//
//   import RNFS from '@/utils/rnfsWrapper';
//   (RNFS.exists as jest.Mock).mockResolvedValue(true);
//
// or, if importing named exports:
//
//   import { exists } from '@/utils/rnfsWrapper';
//   (exists as jest.Mock).mockResolvedValue(true);
//
// Supports all three import shapes:
//   import RNFS from '@/utils/rnfsWrapper';        // default
//   import { exists } from '@/utils/rnfsWrapper';  // named
//   import * as RNFS from '@/utils/rnfsWrapper';   // namespace

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
const retryNativeModuleInitialization = jest.fn();

const DocumentDirectoryPath = '/mock/documents';
const ExternalDirectoryPath = '/mock/external';
const ExternalStorageDirectoryPath = '/mock/external';
const DownloadDirectoryPath = '/mock/downloads';
const TemporaryDirectoryPath = '/mock/tmp';
const CachesDirectoryPath = '/mock/cache';

const namedExports = {
  DocumentDirectoryPath,
  ExternalDirectoryPath,
  ExternalStorageDirectoryPath,
  DownloadDirectoryPath,
  TemporaryDirectoryPath,
  CachesDirectoryPath,
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

const wrapperInstance = { ...namedExports, isSimulationMode: false };

module.exports = {
  __esModule: true,
  default: wrapperInstance,
  rnfsWrapper: wrapperInstance,
  retryNativeModuleInitialization,
  ...namedExports,
};
