/**
 * React Native FS compatibility wrapper to handle TurboModule linking issues
 * Provides fallback functionality during development when native module isn't available
 */

interface RNFSInterface {
  DocumentDirectoryPath: string;
  ExternalDirectoryPath: string;
  ExternalStorageDirectoryPath: string;
  DownloadDirectoryPath: string;
  TemporaryDirectoryPath: string;
  CachesDirectoryPath: string;
  writeFile(filepath: string, contents: string, encoding?: string): Promise<void>;
  readFile(filepath: string, encoding?: string): Promise<string>;
  exists(filepath: string): Promise<boolean>;
  mkdir(filepath: string, options?: any): Promise<void>;
  moveFile(filepath: string, destPath: string): Promise<void>;
  copyFile(filepath: string, destPath: string): Promise<void>;
  unlink(filepath: string): Promise<void>;
  readDir(dirpath: string): Promise<any[]>;
  stat(filepath: string): Promise<any>;
  downloadFile(options: any): Promise<any>;
}

class RNFSWrapper implements RNFSInterface {
  private nativeRNFS: RNFSInterface | null = null;
  private _isSimulationMode = false;
  private simulatedFileSystem = new Map<string, { content: string; encoding: string }>();
  
  // Getter for simulation mode status
  // Returns true if using simulated file system (dev/test mode without native module)
  // Returns false when native react-native-fs module is successfully initialized
  public get isSimulationMode(): boolean {
    return this._isSimulationMode;
  }
  
  // Fallback paths for development
  public DocumentDirectoryPath = '/dev/null/documents';
  public ExternalDirectoryPath = '/dev/null/external';
  public ExternalStorageDirectoryPath = '/dev/null/external';
  public DownloadDirectoryPath = '/dev/null/downloads';
  public TemporaryDirectoryPath = '/dev/null/tmp';
  public CachesDirectoryPath = '/dev/null/cache';

  constructor() {
    // Set up fallback paths immediately
    this._isSimulationMode = true;
    console.log('📁 [RNFSWrapper] Starting in simulation mode');
    
    // Attempt native module initialization only after React Native bridge is ready
    // Use a longer delay and more defensive approach
    this.scheduleNativeModuleInitialization();
  }

  private scheduleNativeModuleInitialization() {
    // Wait longer for React Native bridge to be fully ready
    setTimeout(() => {
      this.attemptNativeModuleInitialization();
    }, 500); // Increased delay to 500ms
  }

  /**
   * Public method to manually retry native module initialization
   * Useful for production builds where native functionality is needed
   */
  public retryNativeModuleInitialization(): void {
    if (!this._isSimulationMode) {
      console.log('📁 [RNFSWrapper] Native module already initialized');
      return;
    }
    console.log('📁 [RNFSWrapper] Manual retry of native module initialization requested');
    this.initializeNativeModule();
  }

  private attemptNativeModuleInitialization() {
    try {
      // Always try to initialize - don't wait for bridge
      console.log('📁 [RNFSWrapper] Attempting native module initialization');
      this.initializeNativeModule();
      
      // If still in simulation mode, retry after delay
      if (this._isSimulationMode) {
        console.log('📁 [RNFSWrapper] Still in simulation mode after first attempt, will retry');
        setTimeout(() => {
          if (this._isSimulationMode) {
            console.log('📁 [RNFSWrapper] Retrying native module initialization after delay');
            this.initializeNativeModule();
          }
        }, 1000);
      }
    } catch (error: any) {
      console.log('📁 [RNFSWrapper] Native module initialization check failed:', error.message);
    }
  }

  private initializeNativeModule() {
    try {
      console.log('📁 [RNFSWrapper] Attempting to load react-native-fs module...');
      
      // Add extra defensive check before requiring the module
      if (typeof require !== 'function') {
        console.log('📁 [RNFSWrapper] require function not available, staying in simulation mode');
        return;
      }

      // Try to import the native RNFS after initial app load
      let RNFSModule;
      try {
        RNFSModule = require('react-native-fs');
        console.log('📁 [RNFSWrapper] react-native-fs module loaded:', typeof RNFSModule);
        console.log('📁 [RNFSWrapper] Module keys:', Object.keys(RNFSModule || {}).slice(0, 10).join(', '));
      } catch (requireError: any) {
        console.log('📁 [RNFSWrapper] Failed to require react-native-fs:', requireError.message);
        if (requireError.message && requireError.message.includes('NativeEventEmitter')) {
          console.log('📁 [RNFSWrapper] NativeEventEmitter error detected, native module not ready yet');
          return;
        }
        throw requireError;
      }
      
      if (!RNFSModule) {
        console.log('📁 [RNFSWrapper] react-native-fs module is null/undefined');
        return;
      }
      
      // Check if the native module is properly linked and available
      console.log('📁 [RNFSWrapper] Checking module structure...');
      console.log('📁 [RNFSWrapper] RNFSModule.DocumentDirectoryPath:', RNFSModule.DocumentDirectoryPath);
      console.log('📁 [RNFSWrapper] RNFSModule.default:', typeof RNFSModule.default);
      
      if (RNFSModule && typeof RNFSModule.DocumentDirectoryPath === 'string') {
        console.log('📁 [RNFSWrapper] Found DocumentDirectoryPath directly on module');
        this.nativeRNFS = RNFSModule.default || RNFSModule;
        this.DocumentDirectoryPath = RNFSModule.DocumentDirectoryPath;
        this.ExternalDirectoryPath = RNFSModule.ExternalDirectoryPath || this.ExternalDirectoryPath;
        this.ExternalStorageDirectoryPath = RNFSModule.ExternalStorageDirectoryPath || this.ExternalStorageDirectoryPath;
        this.DownloadDirectoryPath = RNFSModule.DownloadDirectoryPath || this.DownloadDirectoryPath;
        this.TemporaryDirectoryPath = RNFSModule.TemporaryDirectoryPath || this.TemporaryDirectoryPath;
        this.CachesDirectoryPath = RNFSModule.CachesDirectoryPath || this.CachesDirectoryPath;
        this._isSimulationMode = false;
        console.log('✅ [RNFSWrapper] Successfully initialized native react-native-fs');
        console.log('✅ [RNFSWrapper] DocumentDirectoryPath:', this.DocumentDirectoryPath);
      } else if (RNFSModule && RNFSModule.default && typeof RNFSModule.default.DocumentDirectoryPath === 'string') {
        console.log('📁 [RNFSWrapper] Found DocumentDirectoryPath on module.default');
        this.nativeRNFS = RNFSModule.default;
        this.DocumentDirectoryPath = RNFSModule.default.DocumentDirectoryPath;
        this.ExternalDirectoryPath = RNFSModule.default.ExternalDirectoryPath || this.ExternalDirectoryPath;
        this.ExternalStorageDirectoryPath = RNFSModule.default.ExternalStorageDirectoryPath || this.ExternalStorageDirectoryPath;
        this.DownloadDirectoryPath = RNFSModule.default.DownloadDirectoryPath || this.DownloadDirectoryPath;
        this.TemporaryDirectoryPath = RNFSModule.default.TemporaryDirectoryPath || this.TemporaryDirectoryPath;
        this.CachesDirectoryPath = RNFSModule.default.CachesDirectoryPath || this.CachesDirectoryPath;
        this._isSimulationMode = false;
        console.log('✅ [RNFSWrapper] Successfully initialized native react-native-fs (via default)');
        console.log('✅ [RNFSWrapper] DocumentDirectoryPath:', this.DocumentDirectoryPath);
      } else {
        console.log('❌ [RNFSWrapper] Native RNFS module found but not properly configured');
        console.log('❌ [RNFSWrapper] Module structure does not match expected format');
      }
    } catch (error: any) {
      console.log('❌ [RNFSWrapper] Native module initialization failed:', error.message);
      console.log('❌ [RNFSWrapper] Error stack:', error.stack);
      // Keep simulation mode active
    }
  }

  async writeFile(filepath: string, contents: string, encoding: string = 'utf8'): Promise<void> {
    try {
      if (this.nativeRNFS) {
        return await this.nativeRNFS.writeFile(filepath, contents, encoding);
      }
      
      // In simulation mode, store file in memory for consistency
      this.simulatedFileSystem.set(filepath, { content: contents, encoding });
      console.log(`📁 [RNFSWrapper] writeFile(${filepath}): ${contents.length} chars (stored in simulation)`);
    } catch (error) {
      console.warn('📁 [RNFSWrapper] writeFile error:', error);
      throw error;
    }
  }

  async readFile(filepath: string, encoding: string = 'utf8'): Promise<string> {
    try {
      if (this.nativeRNFS) {
        return await this.nativeRNFS.readFile(filepath, encoding);
      }
      
      // Read from simulated file system
      const file = this.simulatedFileSystem.get(filepath);
      if (!file) {
        throw new Error(`File not found in simulation: ${filepath}`);
      }
      
      console.log(`📁 [RNFSWrapper] readFile(${filepath}) (from simulation)`);
      return file.content;
    } catch (error) {
      console.warn('📁 [RNFSWrapper] readFile error:', error);
      throw error;
    }
  }

  async exists(filepath: string): Promise<boolean> {
    try {
      if (this.nativeRNFS) {
        return await this.nativeRNFS.exists(filepath);
      }
      
      // Check simulated file system
      const exists = this.simulatedFileSystem.has(filepath);
      console.log(`📁 [RNFSWrapper] exists(${filepath}): ${exists} (from simulation)`);
      return exists;
    } catch (error) {
      console.warn('📁 [RNFSWrapper] exists error:', error);
      return false;
    }
  }

  async mkdir(filepath: string, options: any = {}): Promise<void> {
    try {
      if (this.nativeRNFS) {
        return await this.nativeRNFS.mkdir(filepath, options);
      }
      console.log(`📁 [RNFSWrapper] mkdir(${filepath}) (simulated)`);
    } catch (error) {
      console.warn('📁 [RNFSWrapper] mkdir error:', error);
      throw error;
    }
  }

  async moveFile(filepath: string, destPath: string): Promise<void> {
    try {
      if (this.nativeRNFS) {
        return await this.nativeRNFS.moveFile(filepath, destPath);
      }
      console.log(`📁 [RNFSWrapper] moveFile(${filepath} -> ${destPath}) (simulated)`);
    } catch (error) {
      console.warn('📁 [RNFSWrapper] moveFile error:', error);
      throw error;
    }
  }

  async copyFile(filepath: string, destPath: string): Promise<void> {
    try {
      if (this.nativeRNFS) {
        return await this.nativeRNFS.copyFile(filepath, destPath);
      }
      
      // In simulation mode, copy from simulated file system
      const sourceFile = this.simulatedFileSystem.get(filepath);
      if (!sourceFile) {
        throw new Error(`Source file not found in simulation: ${filepath}`);
      }
      
      // Copy file in simulated file system
      this.simulatedFileSystem.set(destPath, { ...sourceFile });
      console.log(`📁 [RNFSWrapper] copyFile(${filepath} -> ${destPath}) (copied in simulation)`);
    } catch (error) {
      console.warn('📁 [RNFSWrapper] copyFile error:', error);
      throw error;
    }
  }

  async unlink(filepath: string): Promise<void> {
    try {
      if (this.nativeRNFS) {
        return await this.nativeRNFS.unlink(filepath);
      }
      
      // Remove from simulated file system
      const existed = this.simulatedFileSystem.delete(filepath);
      console.log(`📁 [RNFSWrapper] unlink(${filepath}) (${existed ? 'removed' : 'not found'} in simulation)`);
    } catch (error) {
      console.warn('📁 [RNFSWrapper] unlink error:', error);
      throw error;
    }
  }

  async readDir(dirpath: string): Promise<any[]> {
    try {
      if (this.nativeRNFS) {
        return await this.nativeRNFS.readDir(dirpath);
      }
      console.log(`📁 [RNFSWrapper] readDir(${dirpath}): [] (simulated)`);
      return []; // Return empty directory in development
    } catch (error) {
      console.warn('📁 [RNFSWrapper] readDir error:', error);
      return [];
    }
  }

  async stat(filepath: string): Promise<any> {
    try {
      if (this.nativeRNFS) {
        return await this.nativeRNFS.stat(filepath);
      }
      console.log(`📁 [RNFSWrapper] stat(${filepath}) (simulated)`);
      return {
        isFile: () => true,
        isDirectory: () => false,
        size: 0,
        mtime: new Date(),
        ctime: new Date(),
      };
    } catch (error) {
      console.warn('📁 [RNFSWrapper] stat error:', error);
      throw error;
    }
  }

  downloadFile(options: any): any {
    try {
      if (this.nativeRNFS) {
        return this.nativeRNFS.downloadFile(options);
      }
      
      console.log(`📁 [RNFSWrapper] downloadFile(${options.fromUrl}) - performing actual download in simulation mode`);
      
      // In simulation mode, perform actual download using fetch
      const downloadPromise = this.simulateDownload(options);
      
      return {
        promise: downloadPromise,
        jobId: Math.random(),
      };
    } catch (error) {
      console.warn('📁 [RNFSWrapper] downloadFile error:', error);
      throw error;
    }
  }

  private async simulateDownload(options: any): Promise<{ statusCode: number; bytesWritten: number }> {
    try {
      console.log(`📁 [RNFSWrapper] Starting simulation download from ${options.fromUrl}`);
      
      // Download using fetch
      const response = await fetch(options.fromUrl);
      
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const reader = new FileReader();
      
      return new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const base64Data = reader.result as string;
            // Remove data URL prefix if present
            const cleanBase64 = base64Data.replace(/^data:.*base64,/, '');
            
            // Write to file using our writeFile method (which handles simulation mode)
            await this.writeFile(options.toFile, cleanBase64, 'base64');
            
            console.log(`📁 [RNFSWrapper] Simulation download completed: ${blob.size} bytes written to ${options.toFile}`);
            
            // Call progress callback if provided
            if (options.progress) {
              options.progress({
                contentLength: blob.size,
                bytesWritten: blob.size,
              });
            }
            
            resolve({
              statusCode: 200,
              bytesWritten: blob.size,
            });
          } catch (writeError) {
            console.error('📁 [RNFSWrapper] Error writing downloaded file:', writeError);
            reject(writeError);
          }
        };
        
        reader.onerror = () => {
          reject(new Error('Failed to read downloaded file'));
        };
        
        reader.readAsDataURL(blob);
      });
      
    } catch (error) {
      console.error('📁 [RNFSWrapper] Simulation download failed:', error);
      throw error;
    }
  }
}

// Create and export a singleton instance
const rnfsWrapper = new RNFSWrapper();

// Export as default for import RNFS syntax
export default rnfsWrapper;

// Export all properties for import * as RNFS syntax  
export const DocumentDirectoryPath = rnfsWrapper.DocumentDirectoryPath;
export const ExternalDirectoryPath = rnfsWrapper.ExternalDirectoryPath;
export const ExternalStorageDirectoryPath = rnfsWrapper.ExternalStorageDirectoryPath;
export const DownloadDirectoryPath = rnfsWrapper.DownloadDirectoryPath;
export const TemporaryDirectoryPath = rnfsWrapper.TemporaryDirectoryPath;
export const CachesDirectoryPath = rnfsWrapper.CachesDirectoryPath;
export const writeFile = rnfsWrapper.writeFile.bind(rnfsWrapper);
export const readFile = rnfsWrapper.readFile.bind(rnfsWrapper);
export const exists = rnfsWrapper.exists.bind(rnfsWrapper);
export const mkdir = rnfsWrapper.mkdir.bind(rnfsWrapper);
export const moveFile = rnfsWrapper.moveFile.bind(rnfsWrapper);
export const copyFile = rnfsWrapper.copyFile.bind(rnfsWrapper);
export const unlink = rnfsWrapper.unlink.bind(rnfsWrapper);
export const readDir = rnfsWrapper.readDir.bind(rnfsWrapper);
export const stat = rnfsWrapper.stat.bind(rnfsWrapper);
export const downloadFile = rnfsWrapper.downloadFile.bind(rnfsWrapper);
// Export the wrapper instance to access the isSimulationMode getter
export { rnfsWrapper };
export const retryNativeModuleInitialization = rnfsWrapper.retryNativeModuleInitialization.bind(rnfsWrapper);