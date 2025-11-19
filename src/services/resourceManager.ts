/**
 * Dynamic Resource Management Service
 * 
 * Enhanced performance optimizer with Claude-powered resource allocation decisions
 * Task 4.1: Dynamic Resource Management
 */

import { Platform, AppState } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { 
  SkillManager, 
  ResourceOptimizationInput, 
  ResourceOptimizationResult,
  ResourceRecommendation,
  ResourceOptimization,
  SkillResult
} from '../types/claudeSkills';
import { performanceOptimizer, PerformanceMetrics, OptimizationSettings } from './performanceOptimizer';
import { structuredLogger } from '../utils/logger';

export interface DeviceConditions {
  memoryPressure: 'low' | 'medium' | 'high';
  batteryState: 'charging' | 'unplugged' | 'low' | 'critical';
  thermalState: 'nominal' | 'fair' | 'serious' | 'critical';
  networkCondition: 'excellent' | 'good' | 'poor' | 'offline';
  backgroundAppCount: number;
  availableStorage: number;
  cpuUsage: number;
}

export interface ResourceAllocationStrategy {
  name: string;
  memoryLimitMB: number;
  maxConcurrentOperations: number;
  enableBackgroundTasks: boolean;
  enablePrefetching: boolean;
  imageQuality: 'low' | 'medium' | 'high';
  animationComplexity: 'none' | 'reduced' | 'full';
  cacheStrategy: 'minimal' | 'balanced' | 'aggressive';
  networkRequestPriority: 'low' | 'normal' | 'high';
}

export interface AdaptiveMemoryConfig {
  baseMemoryLimit: number;
  warningThreshold: number;
  criticalThreshold: number;
  garbageCollectionTrigger: number;
  preemptiveCleanup: boolean;
  dynamicCacheReduction: boolean;
}

export interface BatteryOptimizationConfig {
  lowBatteryThreshold: number;
  criticalBatteryThreshold: number;
  backgroundTaskReduction: number;
  networkRequestBatching: boolean;
  cpuThrottling: boolean;
  reducedAnimations: boolean;
}

const DEVICE_TIER_STRATEGIES: Record<string, ResourceAllocationStrategy> = {
  low: {
    name: 'Conservative',
    memoryLimitMB: 50,
    maxConcurrentOperations: 1,
    enableBackgroundTasks: false,
    enablePrefetching: false,
    imageQuality: 'low',
    animationComplexity: 'none',
    cacheStrategy: 'minimal',
    networkRequestPriority: 'low',
  },
  medium: {
    name: 'Balanced',
    memoryLimitMB: 100,
    maxConcurrentOperations: 2,
    enableBackgroundTasks: true,
    enablePrefetching: true,
    imageQuality: 'medium',
    animationComplexity: 'reduced',
    cacheStrategy: 'balanced',
    networkRequestPriority: 'normal',
  },
  high: {
    name: 'Performance',
    memoryLimitMB: 200,
    maxConcurrentOperations: 4,
    enableBackgroundTasks: true,
    enablePrefetching: true,
    imageQuality: 'high',
    animationComplexity: 'full',
    cacheStrategy: 'aggressive',
    networkRequestPriority: 'high',
  },
};

class DynamicResourceManager {
  private skillManager: SkillManager | null = null;
  private currentConditions: DeviceConditions | null = null;
  private currentStrategy: ResourceAllocationStrategy;
  private memoryConfig: AdaptiveMemoryConfig;
  private batteryConfig: BatteryOptimizationConfig;
  private isInitialized = false;
  private conditionCheckInterval: NodeJS.Timer | null = null;
  private lastClaudeOptimization = 0;
  private optimizationCooldown = 30000; // 30 seconds
  
  private memoryUsageHistory: number[] = [];
  private batteryLevelHistory: number[] = [];
  private performanceScoreHistory: number[] = [];

  constructor() {
    const deviceTier = performanceOptimizer.getPerformanceLevel();
    this.currentStrategy = DEVICE_TIER_STRATEGIES[deviceTier];
    
    this.memoryConfig = {
      baseMemoryLimit: this.currentStrategy.memoryLimitMB * 1024 * 1024,
      warningThreshold: 0.8,
      criticalThreshold: 0.95,
      garbageCollectionTrigger: 0.85,
      preemptiveCleanup: true,
      dynamicCacheReduction: true,
    };

    this.batteryConfig = {
      lowBatteryThreshold: 0.2,
      criticalBatteryThreshold: 0.1,
      backgroundTaskReduction: 0.5,
      networkRequestBatching: true,
      cpuThrottling: true,
      reducedAnimations: true,
    };
  }

  /**
   * Initialize the resource manager with Claude Skills integration
   */
  async initialize(skillManager: SkillManager): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.skillManager = skillManager;
    
    try {
      // Get initial device conditions
      this.currentConditions = await this.assessDeviceConditions();
      
      // Start continuous monitoring
      this.startConditionMonitoring();
      
      // Initial Claude-powered optimization
      await this.requestClaudeOptimization();
      
      // Set up app state change handlers
      this.setupAppStateHandlers();
      
      this.isInitialized = true;
      
      structuredLogger.info('Dynamic Resource Manager initialized', {
        initialStrategy: this.currentStrategy.name,
        deviceConditions: this.currentConditions,
      });
    } catch (error) {
      structuredLogger.error('Failed to initialize Dynamic Resource Manager', {}, error as Error);
      throw error;
    }
  }

  /**
   * Assess current device conditions in real-time
   */
  async assessDeviceConditions(): Promise<DeviceConditions> {
    try {
      const [
        memoryInfo,
        batteryLevel,
        batteryState,
        powerState,
        availableMemory,
        totalMemory,
        usedMemory,
        freeDiskStorage,
      ] = await Promise.allSettled([
        this.getMemoryInfo(),
        DeviceInfo.getBatteryLevel(),
        DeviceInfo.getBatteryState(),
        DeviceInfo.getPowerState(),
        DeviceInfo.getAvailableMemory(),
        DeviceInfo.getTotalMemory(),
        DeviceInfo.getUsedMemory(),
        DeviceInfo.getFreeDiskStorage(),
      ]);

      const memoryPressure = this.calculateMemoryPressure(
        this.extractValue(totalMemory, 4 * 1024 * 1024 * 1024),
        this.extractValue(usedMemory, 2 * 1024 * 1024 * 1024)
      );

      const batteryInfo = this.calculateBatteryState(
        this.extractValue(batteryLevel, 1.0),
        this.extractValue(batteryState, 'unplugged')
      );

      const thermalState = await this.assessThermalState();
      const networkCondition = await this.assessNetworkCondition();
      const backgroundAppCount = await this.estimateBackgroundApps();
      const cpuUsage = await this.estimateCpuUsage();

      const conditions: DeviceConditions = {
        memoryPressure,
        batteryState: batteryInfo,
        thermalState,
        networkCondition,
        backgroundAppCount,
        availableStorage: this.extractValue(freeDiskStorage, 1024 * 1024 * 1024),
        cpuUsage,
      };

      // Update history for trend analysis
      this.updatePerformanceHistory(conditions);

      return conditions;
    } catch (error) {
      structuredLogger.error('Failed to assess device conditions', {}, error as Error);
      
      // Return safe defaults
      return {
        memoryPressure: 'medium',
        batteryState: 'unplugged',
        thermalState: 'nominal',
        networkCondition: 'good',
        backgroundAppCount: 0,
        availableStorage: 1024 * 1024 * 1024, // 1GB
        cpuUsage: 0.5,
      };
    }
  }

  /**
   * Request optimization recommendations from Claude Skills
   */
  async requestClaudeOptimization(): Promise<ResourceOptimizationResult | null> {
    if (!this.skillManager || !this.currentConditions) {
      return null;
    }

    const now = Date.now();
    if (now - this.lastClaudeOptimization < this.optimizationCooldown) {
      return null;
    }

    try {
      const deviceInfo = await this.getDeviceInfoForSkill();
      const currentUsage = await this.getCurrentUsageForSkill();

      const input: ResourceOptimizationInput = {
        deviceInfo,
        currentUsage,
      };

      const result: SkillResult<ResourceOptimizationResult> = await this.skillManager.executeSkill(
        'ResourceOptimizationSkill',
        input
      );

      if (result.success && result.data) {
        await this.applyClaudeOptimizations(result.data);
        this.lastClaudeOptimization = now;
        
        structuredLogger.info('Claude optimization applied', {
          recommendations: result.data.recommendations.length,
          optimizations: result.data.optimizations.length,
          estimatedImpact: result.data.estimatedImpact,
          executionTime: result.executionTimeMs,
        });

        return result.data;
      }
    } catch (error) {
      structuredLogger.error('Claude optimization request failed', {}, error as Error);
    }

    return null;
  }

  /**
   * Apply Claude-recommended optimizations
   */
  private async applyClaudeOptimizations(optimization: ResourceOptimizationResult): Promise<void> {
    try {
      const newStrategy = { ...this.currentStrategy };
      let hasChanges = false;

      // Apply recommendations
      for (const recommendation of optimization.recommendations) {
        switch (recommendation.type) {
          case 'memory':
            if (recommendation.action.includes('reduce_cache')) {
              newStrategy.cacheStrategy = 'minimal';
              hasChanges = true;
            } else if (recommendation.action.includes('increase_cache')) {
              newStrategy.cacheStrategy = 'aggressive';
              hasChanges = true;
            }
            break;

          case 'cpu':
            if (recommendation.action.includes('reduce_concurrent')) {
              newStrategy.maxConcurrentOperations = Math.max(1, newStrategy.maxConcurrentOperations - 1);
              hasChanges = true;
            } else if (recommendation.action.includes('increase_concurrent')) {
              newStrategy.maxConcurrentOperations = Math.min(4, newStrategy.maxConcurrentOperations + 1);
              hasChanges = true;
            }
            break;

          case 'battery':
            if (recommendation.action.includes('reduce_background')) {
              newStrategy.enableBackgroundTasks = false;
              hasChanges = true;
            }
            if (recommendation.action.includes('reduce_animations')) {
              newStrategy.animationComplexity = 'none';
              hasChanges = true;
            }
            break;

          case 'network':
            if (recommendation.action.includes('batch_requests')) {
              newStrategy.networkRequestPriority = 'low';
              hasChanges = true;
            }
            break;
        }
      }

      // Apply specific optimizations
      for (const opt of optimization.optimizations) {
        switch (opt.parameter) {
          case 'memory_limit':
            newStrategy.memoryLimitMB = opt.recommendedValue;
            hasChanges = true;
            break;
          case 'image_quality':
            newStrategy.imageQuality = opt.recommendedValue;
            hasChanges = true;
            break;
          case 'prefetching':
            newStrategy.enablePrefetching = opt.recommendedValue;
            hasChanges = true;
            break;
        }
      }

      if (hasChanges) {
        await this.applyResourceAllocationStrategy(newStrategy);
        
        structuredLogger.info('Resource allocation strategy updated by Claude', {
          previousStrategy: this.currentStrategy.name,
          newStrategy: newStrategy.name,
          changes: optimization.optimizations.length,
        });
      }
    } catch (error) {
      structuredLogger.error('Failed to apply Claude optimizations', {}, error as Error);
    }
  }

  /**
   * Apply resource allocation strategy
   */
  async applyResourceAllocationStrategy(strategy: ResourceAllocationStrategy): Promise<void> {
    try {
      this.currentStrategy = strategy;

      // Update performance optimizer settings
      const newSettings: Partial<OptimizationSettings> = {
        maxConcurrentRequests: strategy.maxConcurrentOperations,
        prefetchEnabled: strategy.enablePrefetching,
        backgroundProcessing: strategy.enableBackgroundTasks,
        animationsEnabled: strategy.animationComplexity !== 'none',
        compressionLevel: this.getCompressionLevel(strategy.imageQuality),
      };

      // Apply the settings through the performance optimizer
      Object.assign(performanceOptimizer.getOptimizationSettings(), newSettings);

      // Update memory configuration
      this.memoryConfig.baseMemoryLimit = strategy.memoryLimitMB * 1024 * 1024;
      
      // Trigger immediate memory management if needed
      if (this.currentConditions?.memoryPressure === 'high') {
        await this.performAdaptiveMemoryManagement();
      }

      // Apply battery optimizations if needed
      if (this.currentConditions?.batteryState === 'low' || this.currentConditions?.batteryState === 'critical') {
        await this.applyBatteryOptimizations();
      }

      structuredLogger.info('Resource allocation strategy applied', {
        strategy: strategy.name,
        memoryLimit: strategy.memoryLimitMB,
        maxOperations: strategy.maxConcurrentOperations,
        backgroundTasks: strategy.enableBackgroundTasks,
      });
    } catch (error) {
      structuredLogger.error('Failed to apply resource allocation strategy', {}, error as Error);
      throw error;
    }
  }

  /**
   * Perform adaptive memory management
   */
  async performAdaptiveMemoryManagement(): Promise<void> {
    try {
      const memoryUsage = await this.getCurrentMemoryUsage();
      const memoryPressureRatio = memoryUsage / this.memoryConfig.baseMemoryLimit;

      if (memoryPressureRatio > this.memoryConfig.criticalThreshold) {
        // Critical memory situation - aggressive cleanup
        await this.performAggressiveMemoryCleanup();
        
        structuredLogger.warn('Aggressive memory cleanup performed', {
          memoryUsage,
          memoryLimit: this.memoryConfig.baseMemoryLimit,
          pressureRatio: memoryPressureRatio,
        });
      } else if (memoryPressureRatio > this.memoryConfig.warningThreshold) {
        // Warning level - moderate cleanup
        await this.performModerateMemoryCleanup();
        
        structuredLogger.info('Moderate memory cleanup performed', {
          memoryUsage,
          pressureRatio: memoryPressureRatio,
        });
      } else if (this.memoryConfig.preemptiveCleanup && memoryPressureRatio > 0.7) {
        // Preemptive cleanup to prevent memory pressure
        await this.performPreemptiveMemoryCleanup();
      }
    } catch (error) {
      structuredLogger.error('Adaptive memory management failed', {}, error as Error);
    }
  }

  /**
   * Apply battery-conscious optimizations
   */
  async applyBatteryOptimizations(): Promise<void> {
    try {
      const batteryLevel = await DeviceInfo.getBatteryLevel();
      
      if (batteryLevel < this.batteryConfig.criticalBatteryThreshold) {
        // Critical battery - maximum power saving
        const emergencyStrategy: ResourceAllocationStrategy = {
          name: 'Emergency Battery',
          memoryLimitMB: 30,
          maxConcurrentOperations: 1,
          enableBackgroundTasks: false,
          enablePrefetching: false,
          imageQuality: 'low',
          animationComplexity: 'none',
          cacheStrategy: 'minimal',
          networkRequestPriority: 'low',
        };
        
        await this.applyResourceAllocationStrategy(emergencyStrategy);
        
        structuredLogger.warn('Emergency battery mode activated', {
          batteryLevel,
          strategy: emergencyStrategy.name,
        });
      } else if (batteryLevel < this.batteryConfig.lowBatteryThreshold) {
        // Low battery - moderate power saving
        const currentStrategy = { ...this.currentStrategy };
        currentStrategy.enableBackgroundTasks = false;
        currentStrategy.animationComplexity = this.batteryConfig.reducedAnimations ? 'reduced' : currentStrategy.animationComplexity;
        currentStrategy.maxConcurrentOperations = Math.max(1, Math.floor(currentStrategy.maxConcurrentOperations * 0.7));
        
        await this.applyResourceAllocationStrategy(currentStrategy);
        
        structuredLogger.info('Low battery optimizations applied', {
          batteryLevel,
          reducedOperations: currentStrategy.maxConcurrentOperations,
        });
      }
    } catch (error) {
      structuredLogger.error('Battery optimization failed', {}, error as Error);
    }
  }

  /**
   * Start continuous condition monitoring
   */
  private startConditionMonitoring(): void {
    // Monitor conditions every 10 seconds
    this.conditionCheckInterval = setInterval(async () => {
      try {
        const newConditions = await this.assessDeviceConditions();
        const conditionsChanged = this.hasSignificantConditionChange(this.currentConditions, newConditions);
        
        this.currentConditions = newConditions;

        if (conditionsChanged) {
          // Request new optimization from Claude if conditions changed significantly
          await this.requestClaudeOptimization();
        }

        // Always perform adaptive memory management
        await this.performAdaptiveMemoryManagement();

      } catch (error) {
        structuredLogger.error('Condition monitoring cycle failed', {}, error as Error);
      }
    }, 10000);
  }

  /**
   * Helper methods
   */
  private extractValue<T>(settledResult: PromiseSettledResult<T>, defaultValue: T): T {
    return settledResult.status === 'fulfilled' ? settledResult.value : defaultValue;
  }

  private calculateMemoryPressure(totalMemory: number, usedMemory: number): 'low' | 'medium' | 'high' {
    const ratio = usedMemory / totalMemory;
    if (ratio > 0.85) return 'high';
    if (ratio > 0.65) return 'medium';
    return 'low';
  }

  private calculateBatteryState(level: number, state: string): 'charging' | 'unplugged' | 'low' | 'critical' {
    if (state === 'charging') return 'charging';
    if (level < 0.1) return 'critical';
    if (level < 0.2) return 'low';
    return 'unplugged';
  }

  private async assessThermalState(): Promise<'nominal' | 'fair' | 'serious' | 'critical'> {
    // Estimate thermal state based on CPU usage and device performance
    try {
      const cpuUsage = await this.estimateCpuUsage();
      if (cpuUsage > 0.9) return 'critical';
      if (cpuUsage > 0.7) return 'serious';
      if (cpuUsage > 0.5) return 'fair';
      return 'nominal';
    } catch {
      return 'nominal';
    }
  }

  private async assessNetworkCondition(): Promise<'excellent' | 'good' | 'poor' | 'offline'> {
    try {
      const NetInfo = await import('@react-native-community/netinfo');
      const netInfo = await NetInfo.default.fetch();
      
      if (!netInfo.isConnected) return 'offline';
      
      // Estimate based on connection type
      if (netInfo.type === 'wifi') return 'excellent';
      if (netInfo.type === 'cellular' && netInfo.details?.cellularGeneration === '4g') return 'good';
      return 'poor';
    } catch {
      return 'good';
    }
  }

  private async estimateBackgroundApps(): Promise<number> {
    // Estimate based on memory usage patterns
    try {
      const totalMemory = await DeviceInfo.getTotalMemory();
      const usedMemory = await DeviceInfo.getUsedMemory();
      const ratio = usedMemory / totalMemory;
      
      // Rough estimation based on memory usage
      if (ratio > 0.8) return 8;
      if (ratio > 0.6) return 5;
      if (ratio > 0.4) return 3;
      return 1;
    } catch {
      return 0;
    }
  }

  private async estimateCpuUsage(): Promise<number> {
    // Estimate CPU usage based on render performance
    const renderTime = performanceOptimizer.getMetrics().renderTime;
    if (renderTime > 50) return 0.9;
    if (renderTime > 30) return 0.7;
    if (renderTime > 16) return 0.5;
    return 0.3;
  }

  private getCompressionLevel(quality: 'low' | 'medium' | 'high'): number {
    switch (quality) {
      case 'low': return 0.5;
      case 'medium': return 0.7;
      case 'high': return 0.9;
      default: return 0.7;
    }
  }

  private hasSignificantConditionChange(
    oldConditions: DeviceConditions | null, 
    newConditions: DeviceConditions
  ): boolean {
    if (!oldConditions) return true;

    return (
      oldConditions.memoryPressure !== newConditions.memoryPressure ||
      oldConditions.batteryState !== newConditions.batteryState ||
      oldConditions.thermalState !== newConditions.thermalState ||
      Math.abs(oldConditions.cpuUsage - newConditions.cpuUsage) > 0.2
    );
  }

  private updatePerformanceHistory(conditions: DeviceConditions): void {
    const maxHistorySize = 100;
    
    // Memory usage history
    this.memoryUsageHistory.push(conditions.memoryPressure === 'low' ? 0.3 : 
                                 conditions.memoryPressure === 'medium' ? 0.6 : 0.9);
    if (this.memoryUsageHistory.length > maxHistorySize) {
      this.memoryUsageHistory.shift();
    }

    // Performance score (inverse of CPU usage)
    this.performanceScoreHistory.push(1 - conditions.cpuUsage);
    if (this.performanceScoreHistory.length > maxHistorySize) {
      this.performanceScoreHistory.shift();
    }
  }

  // Device info for Claude Skills
  private async getDeviceInfoForSkill() {
    const totalMemory = await DeviceInfo.getTotalMemory().catch(() => 4 * 1024 * 1024 * 1024);
    const availableMemory = await DeviceInfo.getAvailableMemory().catch(() => 2 * 1024 * 1024 * 1024);
    const batteryLevel = await DeviceInfo.getBatteryLevel().catch(() => 1.0);

    return {
      totalMemory,
      availableMemory,
      batteryLevel,
      networkType: this.currentConditions?.networkCondition || 'good',
      deviceTier: performanceOptimizer.getPerformanceLevel(),
    };
  }

  private async getCurrentUsageForSkill() {
    return {
      memoryUsage: await this.getCurrentMemoryUsage(),
      cpuUsage: this.currentConditions?.cpuUsage || 0.5,
      activeBackgroundTasks: this.currentConditions?.backgroundAppCount || 0,
    };
  }

  private async getMemoryInfo() {
    return {
      used: await DeviceInfo.getUsedMemory(),
      total: await DeviceInfo.getTotalMemory(),
      available: await DeviceInfo.getAvailableMemory(),
    };
  }

  private async getCurrentMemoryUsage(): Promise<number> {
    try {
      const usedMemory = await DeviceInfo.getUsedMemory();
      return usedMemory;
    } catch {
      return 50 * 1024 * 1024; // 50MB default
    }
  }

  private async performAggressiveMemoryCleanup(): Promise<void> {
    // Force garbage collection if possible
    if ((global as any).gc) {
      (global as any).gc();
    }

    // Clear performance optimizer caches
    performanceOptimizer.resetOptimizations();

    // Additional cleanup logic would go here
  }

  private async performModerateMemoryCleanup(): Promise<void> {
    // Less aggressive cleanup
    performanceOptimizer.resetOptimizations();
  }

  private async performPreemptiveMemoryCleanup(): Promise<void> {
    // Gentle preemptive cleanup
    // Implementation would depend on specific caches and data structures
  }

  private setupAppStateHandlers(): void {
    AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background') {
        // App went to background - reduce resource usage
        this.applyBackgroundOptimizations();
      } else if (nextAppState === 'active') {
        // App became active - restore normal operations
        this.restoreActiveOptimizations();
      }
    });
  }

  private async applyBackgroundOptimizations(): Promise<void> {
    const backgroundStrategy: ResourceAllocationStrategy = {
      ...this.currentStrategy,
      enableBackgroundTasks: false,
      enablePrefetching: false,
      maxConcurrentOperations: 1,
      cacheStrategy: 'minimal',
    };
    
    await this.applyResourceAllocationStrategy(backgroundStrategy);
  }

  private async restoreActiveOptimizations(): Promise<void> {
    // Restore strategy based on current device tier
    const deviceTier = performanceOptimizer.getPerformanceLevel();
    const activeStrategy = DEVICE_TIER_STRATEGIES[deviceTier];
    await this.applyResourceAllocationStrategy(activeStrategy);
  }

  // Public API
  public getCurrentStrategy(): ResourceAllocationStrategy {
    return { ...this.currentStrategy };
  }

  public getCurrentConditions(): DeviceConditions | null {
    return this.currentConditions;
  }

  public getMemoryConfig(): AdaptiveMemoryConfig {
    return { ...this.memoryConfig };
  }

  public getBatteryConfig(): BatteryOptimizationConfig {
    return { ...this.batteryConfig };
  }

  public async forceOptimization(): Promise<ResourceOptimizationResult | null> {
    this.lastClaudeOptimization = 0; // Reset cooldown
    return await this.requestClaudeOptimization();
  }

  public getPerformanceHistory(): {
    memory: number[];
    battery: number[];
    performance: number[];
  } {
    return {
      memory: [...this.memoryUsageHistory],
      battery: [...this.batteryLevelHistory],
      performance: [...this.performanceScoreHistory],
    };
  }

  public destroy(): void {
    if (this.conditionCheckInterval) {
      clearInterval(this.conditionCheckInterval);
      this.conditionCheckInterval = null;
    }
    
    this.isInitialized = false;
    
    structuredLogger.info('Dynamic Resource Manager destroyed');
  }
}

// Export singleton instance
export const dynamicResourceManager = new DynamicResourceManager();
export default DynamicResourceManager;