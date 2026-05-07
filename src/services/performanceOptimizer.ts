/**
 * @deprecated Use src/services/performanceMonitor.ts instead.
 * This service is retained for backward compatibility but should not be used in new code.
 */
// Performance Optimizer Service
// Mobile performance and battery usage optimization

import { Platform, Dimensions } from 'react-native';
import { InteractionManager } from 'react-native';

export interface PerformanceMetrics {
  memoryUsage: number;
  batteryLevel?: number;
  networkType: string;
  devicePerformance: 'low' | 'medium' | 'high';
  renderTime: number;
  apiResponseTime: number;
}

export interface OptimizationSettings {
  enableImageCaching: boolean;
  maxConcurrentRequests: number;
  prefetchEnabled: boolean;
  animationsEnabled: boolean;
  backgroundProcessing: boolean;
  compressionLevel: number;
}

class PerformanceOptimizerService {
  private metrics: PerformanceMetrics;
  private settings: OptimizationSettings;
  private performanceLevel: 'low' | 'medium' | 'high' = 'medium';
  private batteryOptimized = false;
  private renderQueue: Array<() => void> = [];
  private backgroundTasks = new Set<string>();
  private memoryWarningListeners: Array<() => void> = [];
  private resourceManagerIntegrated = false;
  private memoryCheckTimer: NodeJS.Timeout | null = null;
  private destroyed = false;

  constructor() {
    this.metrics = {
      memoryUsage: 0,
      networkType: 'unknown',
      devicePerformance: 'medium',
      renderTime: 0,
      apiResponseTime: 0,
    };

    this.settings = {
      enableImageCaching: true,
      maxConcurrentRequests: 3,
      prefetchEnabled: true,
      animationsEnabled: true,
      backgroundProcessing: true,
      compressionLevel: 0.8,
    };

    this.initializePerformanceMonitoring();
  }

  // Initialize performance monitoring
  private async initializePerformanceMonitoring(): Promise<void> {
    // Detect device performance level
    this.performanceLevel = await this.detectDevicePerformance();

    // Adjust settings based on device capabilities
    this.adjustSettingsForDevice();

    // Set up memory monitoring
    this.setupMemoryMonitoring();

    // Start performance tracking
    this.startPerformanceTracking();
  }

  // Detect device performance capabilities
  private async detectDevicePerformance(): Promise<'low' | 'medium' | 'high'> {
    try {
      const deviceInfo = await import('react-native-device-info');

      const [totalMemory, deviceType, systemVersion, apiLevel] =
        await Promise.all([
          deviceInfo.default.getTotalMemory?.() || 2 * 1024 * 1024 * 1024, // Default 2GB
          deviceInfo.default.getDeviceType?.() || 'unknown',
          deviceInfo.default.getSystemVersion?.() || '0',
          Platform.OS === 'android'
            ? deviceInfo.default.getApiLevel?.() || 21
            : 30,
        ]);

      const { width, height } = Dimensions.get('window');
      const screenSize = width * height;

      // Performance scoring
      let score = 0;

      // Memory score (40% weight)
      if (totalMemory > 6 * 1024 * 1024 * 1024) score += 40; // >6GB
      else if (totalMemory > 4 * 1024 * 1024 * 1024) score += 30; // >4GB
      else if (totalMemory > 2 * 1024 * 1024 * 1024) score += 20; // >2GB
      else score += 10; // <=2GB

      // Screen resolution score (20% weight)
      if (screenSize > 2000000) score += 20; // High res
      else if (screenSize > 1000000) score += 15; // Medium res
      else score += 10; // Low res

      // OS version score (20% weight)
      if (Platform.OS === 'ios') {
        const majorVersion = parseInt(systemVersion.split('.')[0], 10);
        if (majorVersion >= 15) score += 20;
        else if (majorVersion >= 13) score += 15;
        else score += 10;
      } else {
        if (apiLevel >= 29) score += 20; // Android 10+
        else if (apiLevel >= 26) score += 15; // Android 8+
        else score += 10;
      }

      // Device type score (20% weight)
      if (deviceType === 'Tablet') score += 20;
      else if (deviceType === 'Handset') score += 15;
      else score += 10;

      // Classify performance level
      if (score >= 75) return 'high';
      if (score >= 50) return 'medium';
      return 'low';
    } catch (error) {
      console.warn('Failed to detect device performance:', error);
      return 'medium'; // Safe default
    }
  }

  // Adjust settings based on device performance
  private adjustSettingsForDevice(): void {
    switch (this.performanceLevel) {
      case 'low':
        this.settings = {
          enableImageCaching: true,
          maxConcurrentRequests: 1,
          prefetchEnabled: false,
          animationsEnabled: false,
          backgroundProcessing: false,
          compressionLevel: 0.6,
        };
        break;

      case 'medium':
        this.settings = {
          enableImageCaching: true,
          maxConcurrentRequests: 2,
          prefetchEnabled: true,
          animationsEnabled: true,
          backgroundProcessing: true,
          compressionLevel: 0.7,
        };
        break;

      case 'high':
        this.settings = {
          enableImageCaching: true,
          maxConcurrentRequests: 4,
          prefetchEnabled: true,
          animationsEnabled: true,
          backgroundProcessing: true,
          compressionLevel: 0.9,
        };
        break;
    }
  }

  // Set up memory monitoring
  private setupMemoryMonitoring(): void {
    // Monitor memory warnings
    if (Platform.OS === 'ios') {
      // iOS memory warning handling would go here
    }

    // Set up periodic memory checks
    this.memoryCheckTimer = setInterval(() => {
      this.checkMemoryUsage();
    }, 30000); // Every 30 seconds
  }

  // Check current memory usage
  private async checkMemoryUsage(): Promise<void> {
    try {
      // Estimate memory usage based on cache and data
      const estimatedUsage = this.estimateMemoryUsage();
      this.metrics.memoryUsage = estimatedUsage;

      // Trigger cleanup if memory usage is high
      if (estimatedUsage > 100 * 1024 * 1024) {
        // >100MB
        this.performMemoryCleanup();
      }
    } catch (error) {
      console.warn('Memory check failed:', error);
    }
  }

  // Estimate current memory usage
  private estimateMemoryUsage(): number {
    // This is a rough estimation since React Native doesn't provide direct memory APIs
    let usage = 0;

    // Estimate based on known data structures
    usage += this.renderQueue.length * 1000; // ~1KB per queued operation
    usage += this.backgroundTasks.size * 5000; // ~5KB per background task

    return usage;
  }

  // Perform memory cleanup
  private performMemoryCleanup(): void {
    if (__DEV__) console.log('Performing memory cleanup');

    // Clear render queue if too large
    if (this.renderQueue.length > 10) {
      this.renderQueue = this.renderQueue.slice(-5); // Keep only last 5
    }

    // Cancel non-essential background tasks
    if (this.backgroundTasks.size > 5) {
      const tasksArray = Array.from(this.backgroundTasks);
      tasksArray.slice(0, -3).forEach(taskId => {
        this.backgroundTasks.delete(taskId);
      });
    }

    // Notify listeners
    this.memoryWarningListeners.forEach(listener => listener());
  }

  // Start performance tracking
  private startPerformanceTracking(): void {
    // Battery optimization
    this.optimizeForBattery();
  }

  /**
   * Measure render time for a specific operation.
   * Call this explicitly at instrumentation points instead of monkey-patching globals.
   */
  public measureRenderTime(renderTime: number): void {
    this.metrics.renderTime = renderTime;

    if (renderTime > 16) {
      this.reduceAnimationComplexity();
    }
  }

  /**
   * Record an API response time for a specific request.
   * Call this explicitly after fetch calls instead of monkey-patching globals.
   */
  public recordApiResponseTime(responseTime: number): void {
    this.metrics.apiResponseTime = responseTime;

    if (responseTime > 3000) {
      this.enableAggressiveBatching();
    }
  }

  // Optimize for battery usage
  private optimizeForBattery(): void {
    // Reduce background activity on low battery
    this.checkBatteryLevel().then(level => {
      if (level !== undefined && level < 0.2) {
        // <20% battery
        this.enableBatteryOptimization();
      }
    });
  }

  // Get battery level
  private async checkBatteryLevel(): Promise<number | undefined> {
    try {
      const deviceInfo = await import('react-native-device-info');
      return await deviceInfo.default.getBatteryLevel?.();
    } catch {
      return undefined;
    }
  }

  // Enable battery optimization
  private enableBatteryOptimization(): void {
    if (this.batteryOptimized) return;

    this.batteryOptimized = true;

    // Reduce settings for battery saving
    this.settings = {
      ...this.settings,
      maxConcurrentRequests: 1,
      prefetchEnabled: false,
      backgroundProcessing: false,
      animationsEnabled: false,
    };

    if (__DEV__) console.log('Battery optimization enabled');
  }

  // Reduce animation complexity
  private reduceAnimationComplexity(): void {
    if (!this.settings.animationsEnabled) return;

    // Temporarily disable complex animations
    this.settings.animationsEnabled = false;

    // Re-enable after a delay
    setTimeout(() => {
      this.settings.animationsEnabled = true;
    }, 5000);
  }

  // Enable aggressive request batching
  private enableAggressiveBatching(): void {
    this.settings.maxConcurrentRequests = Math.max(
      1,
      this.settings.maxConcurrentRequests - 1,
    );
  }

  // Queue operations for optimal rendering
  public queueRenderOperation(
    operation: () => void,
    priority: 'high' | 'normal' | 'low' = 'normal',
  ): void {
    if (priority === 'high') {
      this.renderQueue.unshift(operation);
    } else {
      this.renderQueue.push(operation);
    }

    this.processRenderQueue();
  }

  // Process render queue efficiently
  private processRenderQueue(): void {
    if (this.renderQueue.length === 0) return;

    InteractionManager.runAfterInteractions(() => {
      const batchSize =
        this.performanceLevel === 'low'
          ? 1
          : this.performanceLevel === 'medium'
          ? 2
          : 3;

      const batch = this.renderQueue.splice(0, batchSize);
      batch.forEach(operation => {
        try {
          operation();
        } catch (error) {
          console.error('Render operation failed:', error);
        }
      });

      // Continue processing if more operations exist
      if (this.renderQueue.length > 0) {
        setTimeout(() => this.processRenderQueue(), 16); // Next frame
      }
    });
  }

  // Register background task
  public registerBackgroundTask(taskId: string): void {
    if (!this.settings.backgroundProcessing) return;

    this.backgroundTasks.add(taskId);

    // Auto-cleanup after timeout
    setTimeout(() => {
      this.backgroundTasks.delete(taskId);
    }, 30000); // 30 second timeout
  }

  // Optimize image loading
  public getOptimizedImageProps(
    uri: string,
    dimensions: { width: number; height: number },
  ) {
    const { width, height } = dimensions;

    return {
      uri,
      cache: this.settings.enableImageCaching ? 'force-cache' : 'default',
      priority: this.performanceLevel === 'low' ? 'low' : 'normal',
      resizeMode: 'cover' as const,
      style: {
        width: width / (this.performanceLevel === 'low' ? 2 : 1),
        height: height / (this.performanceLevel === 'low' ? 2 : 1),
      },
    };
  }

  // Get optimized text rendering props
  public getOptimizedTextProps() {
    return {
      allowFontScaling: this.performanceLevel !== 'low',
      maxFontSizeMultiplier: this.performanceLevel === 'low' ? 1.2 : 2.0,
      minimumFontScale: this.performanceLevel === 'low' ? 0.8 : 0.5,
    };
  }

  // Add memory warning listener
  public addMemoryWarningListener(listener: () => void): () => void {
    this.memoryWarningListeners.push(listener);

    return () => {
      const index = this.memoryWarningListeners.indexOf(listener);
      if (index > -1) {
        this.memoryWarningListeners.splice(index, 1);
      }
    };
  }

  // Public API methods
  public getPerformanceLevel(): 'low' | 'medium' | 'high' {
    return this.performanceLevel;
  }

  public getOptimizationSettings(): OptimizationSettings {
    return { ...this.settings };
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public isBatteryOptimized(): boolean {
    return this.batteryOptimized;
  }

  public shouldPrefetch(): boolean {
    return this.settings.prefetchEnabled && !this.batteryOptimized;
  }

  public getMaxConcurrentRequests(): number {
    return this.settings.maxConcurrentRequests;
  }

  public shouldUseAnimations(): boolean {
    return this.settings.animationsEnabled && !this.batteryOptimized;
  }

  // Force battery optimization (for testing)
  public forceBatteryOptimization(enabled: boolean): void {
    if (enabled) {
      this.enableBatteryOptimization();
    } else {
      this.batteryOptimized = false;
      this.adjustSettingsForDevice();
    }
  }

  // Enable resource manager integration
  public enableResourceManagerIntegration(): void {
    this.resourceManagerIntegrated = true;
    if (__DEV__)
      console.log(
        'Performance optimizer integrated with Dynamic Resource Manager',
      );
  }

  // Update settings from resource manager
  public updateSettings(newSettings: Partial<OptimizationSettings>): void {
    this.settings = { ...this.settings, ...newSettings };

    // Log the changes if resource manager is integrated
    if (this.resourceManagerIntegrated) {
      if (__DEV__)
        console.log(
          'Performance settings updated by Resource Manager:',
          newSettings,
        );
    }
  }

  // Check if resource manager integration is enabled
  public isResourceManagerIntegrated(): boolean {
    return this.resourceManagerIntegrated;
  }

  // Get current memory usage estimation
  public getCurrentMemoryEstimate(): number {
    return this.estimateMemoryUsage();
  }

  // Trigger memory cleanup on demand
  public triggerMemoryCleanup(): void {
    this.performMemoryCleanup();
  }

  // Reset to defaults
  public resetOptimizations(): void {
    this.batteryOptimized = false;
    this.adjustSettingsForDevice();
    this.renderQueue = [];
    this.backgroundTasks.clear();
  }

  // Cleanup all timers and resources. Idempotent — safe to call multiple times.
  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.memoryCheckTimer) {
      clearInterval(this.memoryCheckTimer);
      this.memoryCheckTimer = null;
    }

    this.renderQueue = [];
    this.backgroundTasks.clear();
    this.memoryWarningListeners = [];
  }
}

export const performanceOptimizer = new PerformanceOptimizerService();
export default PerformanceOptimizerService;
