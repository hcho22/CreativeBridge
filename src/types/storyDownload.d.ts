/**
 * TypeScript interfaces for story download functionality
 */

export interface StoryDownloadOptions {
  storyId: string;
  content: string;
  title?: string;
}

// Story Download History Record (matches story_download_history table)
// Optional fields accept `null` because the underlying Postgres columns are
// nullable and the RPC projections return `null` (not `undefined`) when empty.
export interface StoryDownloadHistoryRecord {
  id: string;
  user_id: string;
  story_session_id?: string | null;
  file_name: string;
  file_path: string;
  file_size_bytes?: number | null;
  download_status?: string;
  story_title?: string | null;
  story_word_count?: number | null;
  story_character_count?: number | null;
  story_grade_level?: string | null;
  story_source: string;
  download_method: string;
  device_platform?: string;
  app_version?: string | null;
  error_type?: string | null;
  error_message?: string | null;
  created_at: string;
  completed_at?: string | null;
  retry_count: number;
  file_exists: boolean;
  last_validated_at?: string | null;
  metadata: Record<string, any>;
}

export interface CreateDownloadRecordParams {
  user_id: string;
  story_session_id?: string;
  file_name: string;
  file_path: string;
  story_title?: string;
  story_word_count?: number;
  story_character_count?: number;
  story_grade_level?: string;
  story_source?: string;
  download_method?: string;
  app_version?: string;
  metadata?: Record<string, any>;
}

export type DownloadStatus =
  | 'pending'
  | 'in_progress'
  | 'success'
  | 'failed'
  | 'cancelled';

export type DownloadErrorType =
  | 'permission_denied'
  | 'storage_full'
  | 'file_system_error'
  | 'network_error'
  | 'timeout'
  | 'user_cancelled'
  | 'unknown';

export interface UpdateDownloadRecordParams {
  record_id: string;
  status?: DownloadStatus;
  file_size_bytes?: number;
  error_type?: DownloadErrorType;
  error_message?: string;
  file_exists?: boolean;
  retry_count?: number;
  metadata?: Record<string, any>;
}

export interface DownloadAnalytics {
  total_downloads: number;
  successful_downloads: number;
  failed_downloads: number;
  cancelled_downloads: number;
  total_file_size_mb: number;
  avg_file_size_kb: number;
  most_common_error_type: string | null;
  files_still_existing: number;
  most_popular_grade_level: string | null;
  ios_downloads: number;
  android_downloads: number;
}

// Row returned by the get_user_download_history RPC. Field set is the
// projection produced server-side and is narrower than StoryDownloadHistoryRecord.
export interface UserDownloadHistoryRow {
  record_id: string;
  story_session_id?: string | null;
  file_name: string;
  file_path: string;
  file_size_bytes: number | null;
  download_status: string;
  story_title: string | null;
  story_word_count: number | null;
  story_grade_level: string | null;
  story_source: string;
  download_method: string;
  error_type: string | null;
  file_exists: boolean;
  created_at: string;
  completed_at: string | null;
}

export interface DownloadResult {
  success: boolean;
  cancelled?: boolean;
  fileName?: string;
  filePath?: string;
  error?: string;
  // Enhanced error handling properties (Task 2.4)
  queued?: boolean;
  queueId?: string;
  errorType?:
    | 'permission_denied'
    | 'storage_full'
    | 'file_system_error'
    | 'network_error'
    | 'timeout'
    | 'user_cancelled'
    | 'unknown';
  storageInfo?: {
    available: boolean;
    freeSpace: number;
    totalSpace: number;
    recommendations: string[];
  };
  retryCount?: number;
  canRetry?: boolean;
}

export interface StoryDownloadService {
  generateStoryFile(options: StoryDownloadOptions): string;
  generateFileName(): string;
  createDownloadOptionsFromSession(
    session: import('../types/database').GameSession,
  ): StoryDownloadOptions;
  validateStoryContent(content: string): { isValid: boolean; errors: string[] };
  estimateFileSize(content: string): number;
  generatePreview(options: StoryDownloadOptions, maxLines?: number): string;
  createDownloadOptionsFromContent(
    storyId: string,
    content: string,
    customTitle?: string,
  ): StoryDownloadOptions;
  sanitizeFileName(fileName: string): string;
  generateDownloadStats(options: StoryDownloadOptions): {
    contentLength: number;
    wordCount: number;
    paragraphCount: number;
    estimatedFileSize: number;
  };
}

declare module 'react-native-document-picker' {
  export interface DocumentPickerOptions {
    type?: string | string[];
    mode?: 'import' | 'open';
    copyTo?: 'cachesDirectory' | 'documentDirectory';
    allowMultiSelection?: boolean;
    presentationStyle?:
      | 'fullScreen'
      | 'pageSheet'
      | 'formSheet'
      | 'overFullScreen'
      | 'overCurrentContext';
  }

  export interface DocumentPickerResult {
    uri: string;
    type: string | null;
    name: string | null;
    size: number | null;
    fileCopyUri?: string | null;
  }

  export interface DocumentPickerError {
    code: string;
    message: string;
  }

  export const types: {
    allFiles: string;
    audio: string;
    csv: string;
    doc: string;
    docx: string;
    images: string;
    pdf: string;
    plainText: string;
    ppt: string;
    pptx: string;
    video: string;
    xls: string;
    xlsx: string;
    zip: string;
  };

  export function pick(
    options?: DocumentPickerOptions,
  ): Promise<DocumentPickerResult[]>;
  export function pickSingle(
    options?: DocumentPickerOptions,
  ): Promise<DocumentPickerResult>;
  export function isCancel(error: any): boolean;
  export function isInProgress(error: any): boolean;
}

declare module 'react-native-fs' {
  export interface WriteFileOptions {
    encoding?: 'utf8' | 'ascii' | 'base64';
  }

  export interface StatResult {
    path: string;
    ctime: Date;
    mtime: Date;
    size: number;
    mode: number;
    originalFilepath?: string;
    isFile(): boolean;
    isDirectory(): boolean;
  }

  export const DocumentDirectoryPath: string;
  export const DownloadDirectoryPath: string;
  export const ExternalCachesDirectoryPath: string;
  export const ExternalDirectoryPath: string;
  export const ExternalStorageDirectoryPath: string;
  export const LibraryDirectoryPath: string;
  export const MainBundlePath: string;
  export const PicturesDirectoryPath: string;
  export const TemporaryDirectoryPath: string;

  export function writeFile(
    filepath: string,
    contents: string,
    options?: WriteFileOptions,
  ): Promise<void>;
  export function exists(filepath: string): Promise<boolean>;
  export function readFile(
    filepath: string,
    encoding?: string,
  ): Promise<string>;
  export function stat(filepath: string): Promise<StatResult>;
  export function unlink(filepath: string): Promise<void>;
  export function mkdir(
    filepath: string,
    options?: { NSURLIsExcludedFromBackupKey?: boolean },
  ): Promise<void>;
  export function readDir(dirpath: string): Promise<StatResult[]>;
}
