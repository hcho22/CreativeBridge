/**
 * Network Adapter Service
 * 
 * Provides network condition monitoring and adaptive behavior for Claude Skills integration
 * Task 6.2: Progressive Enhancement System - Network adaptation component
 */

import { structuredLogger } from '../utils/logger';
import { StoryRequest, StoryResponse, GradeLevel } from '../types/story';

export interface NetworkConditions {
  type: 'wifi' | 'cellular' | 'offline' | 'unknown';
  quality: 'excellent' | 'good' | 'poor' | 'offline';
  bandwidth: number; // Mbps
  latency: number; // ms
  packetLoss: number; // percentage (0-1)
  stability: number; // 0-1, connection stability score
  effectiveBandwidth: number; // Actual usable bandwidth considering conditions
}

export interface AdaptationStrategy {
  name: string;
  networkRequirement: NetworkRequirement;
  adaptations: NetworkAdaptation[];
  fallbackTriggers: AdaptationTrigger[];
  userExperienceImpact: UserExperienceImpact;
}

export interface NetworkRequirement {
  minBandwidth: number; // Mbps
  maxLatency: number; // ms
  maxPacketLoss: number; // percentage
  minStability: number; // 0-1
}

export interface NetworkAdaptation {
  adaptation: 'reduce_quality' | 'compress_data' | 'cache_aggressive' | 'offline_mode' | 'minimal_requests' | 'batch_requests';
  trigger: AdaptationTrigger;
  implementation: (request: StoryRequest, conditions: NetworkConditions) => Promise<AdaptedRequest>;
  reversible: boolean;
  qualityImpact: number; // 0-1, impact on content quality
  performanceGain: number; // 0-1, expected performance improvement
}

export interface AdaptationTrigger {
  condition: 'bandwidth_low' | 'latency_high' | 'packet_loss_high' | 'stability_low' | 'connection_lost' | 'quality_degraded';
  threshold: number;
  windowSize: number; // time window in ms for evaluation
  consecutiveOccurrences: number;
}

export interface UserExperienceImpact {
  responseTime: number; // expected change in ms
  contentQuality: number; // 0-1, impact on quality
  reliability: number; // 0-1, expected reliability
  transparency: number; // 0-1, how visible the adaptation is to user
}

export interface AdaptedRequest {
  originalRequest: StoryRequest;
  adaptations: string[];
  modifiedRequest: StoryRequest;
  expectedBehavior: {
    reducedLatency: number;
    reliabilityImprovement: number;
    qualityImpact: number;
  };
  fallbackPlan: string[];
}

export interface ConnectionHistory {
  timestamp: Date;
  conditions: NetworkConditions;
  adaptationUsed?: string;
  success: boolean;
  responseTime: number;
  errors?: string[];
}

export interface OfflineCapability {
  feature: string;
  offline: boolean;
  degradedMode?: string;
  cacheRequirement: number; // MB of cache needed
  functionality: 'full' | 'limited' | 'unavailable';
}

export class NetworkAdapterService {
  private currentConditions: NetworkConditions;
  private adaptationStrategies: Map<string, AdaptationStrategy> = new Map();
  private connectionHistory: ConnectionHistory[] = [];
  private activeAdaptations: Set<string> = new Set();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private offlineCapabilities: Map<string, OfflineCapability> = new Map();
  private adaptationMetrics: {
    totalAdaptations: number;
    successfulAdaptations: number;
    qualityImpact: number;
    performanceGain: number;
    userSatisfactionScore: number;
  } = {
    totalAdaptations: 0,
    successfulAdaptations: 0,
    qualityImpact: 0,
    performanceGain: 0,
    userSatisfactionScore: 85
  };

  constructor() {
    this.initializeNetworkConditions();
    this.initializeAdaptationStrategies();
    this.initializeOfflineCapabilities();
    this.startNetworkMonitoring();
  }

  /**
   * Adapt request based on current network conditions
   */
  public async adaptRequestForNetwork(request: StoryRequest): Promise<AdaptedRequest> {
    try {
      structuredLogger.info('Adapting request for network conditions', {
        networkQuality: this.currentConditions.quality,
        bandwidth: this.currentConditions.bandwidth,
        latency: this.currentConditions.latency,
        requestType: 'story_generation'
      });

      // Update current conditions before adaptation
      await this.updateNetworkConditions();

      // Determine required adaptations based on conditions
      const requiredAdaptations = this.determineRequiredAdaptations(request);

      // Apply adaptations sequentially
      let adaptedRequest = { ...request };
      const appliedAdaptations: string[] = [];
      let totalQualityImpact = 0;
      let totalPerformanceGain = 0;

      for (const adaptation of requiredAdaptations) {
        try {
          const result = await adaptation.implementation(adaptedRequest, this.currentConditions);
          adaptedRequest = result.modifiedRequest;
          appliedAdaptations.push(adaptation.adaptation);
          
          totalQualityImpact += adaptation.qualityImpact;
          totalPerformanceGain += adaptation.performanceGain;

          structuredLogger.debug('Network adaptation applied', {
            adaptation: adaptation.adaptation,
            qualityImpact: adaptation.qualityImpact,
            performanceGain: adaptation.performanceGain
          });

        } catch (adaptationError) {
          structuredLogger.warn('Network adaptation failed', {
            adaptation: adaptation.adaptation,
            error: (adaptationError as Error).message
          });
        }
      }

      // Create fallback plan for further degradation
      const fallbackPlan = this.createFallbackPlan(adaptedRequest);

      // Update metrics
      this.adaptationMetrics.totalAdaptations++;
      this.adaptationMetrics.qualityImpact = 
        (this.adaptationMetrics.qualityImpact + totalQualityImpact) / 2;
      this.adaptationMetrics.performanceGain = 
        (this.adaptationMetrics.performanceGain + totalPerformanceGain) / 2;

      const result: AdaptedRequest = {
        originalRequest: request,
        adaptations: appliedAdaptations,
        modifiedRequest: adaptedRequest,
        expectedBehavior: {
          reducedLatency: this.calculateExpectedLatencyReduction(appliedAdaptations),
          reliabilityImprovement: this.calculateReliabilityImprovement(appliedAdaptations),
          qualityImpact: Math.max(0, Math.min(1, totalQualityImpact))
        },
        fallbackPlan
      };

      structuredLogger.info('Request adaptation completed', {
        adaptationsApplied: appliedAdaptations.length,
        expectedLatencyReduction: result.expectedBehavior.reducedLatency,
        qualityImpact: result.expectedBehavior.qualityImpact,
        fallbackOptions: fallbackPlan.length
      });

      return result;

    } catch (error) {
      structuredLogger.error('Request adaptation failed', {}, error as Error);
      
      // Return original request with minimal adaptation
      return {
        originalRequest: request,
        adaptations: ['error_fallback'],
        modifiedRequest: request,
        expectedBehavior: {
          reducedLatency: 0,
          reliabilityImprovement: 0,
          qualityImpact: 0
        },
        fallbackPlan: ['offline_mode', 'cache_only']
      };
    }
  }

  /**
   * Check if operation is viable under current network conditions
   */
  public async checkNetworkViability(operationType: string): Promise<{
    viable: boolean;
    recommendation: 'proceed' | 'adapt' | 'defer' | 'offline';
    estimatedLatency: number;
    reliabilityScore: number;
    adaptationsNeeded: string[];
  }> {
    try {
      await this.updateNetworkConditions();

      const strategy = this.adaptationStrategies.get(operationType) || 
                      this.adaptationStrategies.get('default')!;

      const requirements = strategy.networkRequirement;
      const conditions = this.currentConditions;

      // Evaluate each requirement
      const bandwidthOk = conditions.effectiveBandwidth >= requirements.minBandwidth;
      const latencyOk = conditions.latency <= requirements.maxLatency;
      const packetLossOk = conditions.packetLoss <= requirements.maxPacketLoss;
      const stabilityOk = conditions.stability >= requirements.minStability;

      // Determine viability and recommendation
      let viable = bandwidthOk && latencyOk && packetLossOk && stabilityOk;
      let recommendation: 'proceed' | 'adapt' | 'defer' | 'offline' = 'proceed';
      let adaptationsNeeded: string[] = [];

      if (!viable) {
        if (conditions.quality === 'offline') {
          recommendation = 'offline';
          adaptationsNeeded = ['offline_mode'];
        } else if (conditions.quality === 'poor') {
          recommendation = 'adapt';
          adaptationsNeeded = this.identifyNeededAdaptations(requirements, conditions);
        } else {
          recommendation = 'defer';
        }
      }

      // Calculate estimated latency and reliability
      const estimatedLatency = this.estimateOperationLatency(operationType, conditions);
      const reliabilityScore = this.calculateReliabilityScore(conditions);

      structuredLogger.debug('Network viability check completed', {
        operationType,
        viable,
        recommendation,
        estimatedLatency,
        reliabilityScore,
        adaptationsNeeded: adaptationsNeeded.length
      });

      return {
        viable,
        recommendation,
        estimatedLatency,
        reliabilityScore,
        adaptationsNeeded
      };

    } catch (error) {
      structuredLogger.error('Network viability check failed', {}, error as Error);
      
      return {
        viable: false,
        recommendation: 'offline',
        estimatedLatency: 10000,
        reliabilityScore: 0.1,
        adaptationsNeeded: ['offline_mode']
      };
    }
  }

  /**
   * Handle connection loss and initiate offline mode
   */
  public async handleConnectionLoss(): Promise<{
    offlineCapabilities: OfflineCapability[];
    gracefulDegradation: string[];
    userCommunication: {
      message: string;
      type: 'info' | 'warning' | 'error';
      persistent: boolean;
    };
  }> {
    try {
      structuredLogger.warn('Connection loss detected, activating offline mode');

      // Update conditions to offline
      this.currentConditions.quality = 'offline';
      this.currentConditions.type = 'offline';

      // Get available offline capabilities
      const availableCapabilities = Array.from(this.offlineCapabilities.values())
        .filter(cap => cap.offline);

      // Determine graceful degradation steps
      const degradationSteps = [
        'Activate offline content cache',
        'Switch to local story generation',
        'Enable minimal interface mode',
        'Preserve user progress locally'
      ];

      // Prepare user communication
      const userCommunication = {
        message: "You're now in offline mode. You can continue creating stories with locally available content.",
        type: 'info' as const,
        persistent: true
      };

      // Record connection loss in history
      this.recordConnectionEvent({
        timestamp: new Date(),
        conditions: { ...this.currentConditions },
        success: false,
        responseTime: 0,
        errors: ['connection_lost']
      });

      structuredLogger.info('Offline mode activated', {
        availableCapabilities: availableCapabilities.length,
        degradationSteps: degradationSteps.length
      });

      return {
        offlineCapabilities: availableCapabilities,
        gracefulDegradation: degradationSteps,
        userCommunication
      };

    } catch (error) {
      structuredLogger.error('Connection loss handling failed', {}, error as Error);
      
      return {
        offlineCapabilities: [],
        gracefulDegradation: ['Emergency offline mode activated'],
        userCommunication: {
          message: "Connection lost. Some features may be limited.",
          type: 'warning',
          persistent: true
        }
      };
    }
  }

  /**
   * Monitor network recovery and restore capabilities
   */
  public async handleConnectionRecovery(): Promise<{
    restoredCapabilities: string[];
    adaptationChanges: string[];
    userCommunication: {
      message: string;
      type: 'info' | 'success';
      duration: number;
    };
  }> {
    try {
      structuredLogger.info('Connection recovery detected');

      // Update network conditions
      await this.updateNetworkConditions();

      // Identify restored capabilities
      const restoredCapabilities: string[] = [];
      const adaptationChanges: string[] = [];

      // Check if we can restore online features
      if (this.currentConditions.quality !== 'offline') {
        restoredCapabilities.push('online_story_generation');
        restoredCapabilities.push('cloud_personalization');
        
        // Remove offline-only adaptations
        if (this.activeAdaptations.has('offline_mode')) {
          this.activeAdaptations.delete('offline_mode');
          adaptationChanges.push('Offline mode deactivated');
        }
      }

      // Gradually restore quality based on connection quality
      if (this.currentConditions.quality === 'excellent') {
        restoredCapabilities.push('high_quality_generation');
        restoredCapabilities.push('real_time_personalization');
      }

      // Record recovery in history
      this.recordConnectionEvent({
        timestamp: new Date(),
        conditions: { ...this.currentConditions },
        success: true,
        responseTime: 0
      });

      const userCommunication = {
        message: `Connection restored! All features are now available.`,
        type: 'success' as const,
        duration: 3000
      };

      structuredLogger.info('Connection recovery handled', {
        restoredCapabilities: restoredCapabilities.length,
        adaptationChanges: adaptationChanges.length,
        newQuality: this.currentConditions.quality
      });

      return {
        restoredCapabilities,
        adaptationChanges,
        userCommunication
      };

    } catch (error) {
      structuredLogger.error('Connection recovery handling failed', {}, error as Error);
      
      return {
        restoredCapabilities: [],
        adaptationChanges: [],
        userCommunication: {
          message: "Connection status unknown. Please check your network.",
          type: 'info',
          duration: 5000
        }
      };
    }
  }

  // Private implementation methods

  private determineRequiredAdaptations(request: StoryRequest): NetworkAdaptation[] {
    const required: NetworkAdaptation[] = [];
    
    // Get relevant strategy
    const strategy = this.adaptationStrategies.get('story_generation') || 
                    this.adaptationStrategies.get('default')!;

    // Check each adaptation trigger
    for (const adaptation of strategy.adaptations) {
      if (this.shouldTriggerAdaptation(adaptation.trigger)) {
        required.push(adaptation);
      }
    }

    // Sort by impact (least impactful first)
    return required.sort((a, b) => a.qualityImpact - b.qualityImpact);
  }

  private shouldTriggerAdaptation(trigger: AdaptationTrigger): boolean {
    const conditions = this.currentConditions;
    
    switch (trigger.condition) {
      case 'bandwidth_low':
        return conditions.effectiveBandwidth < trigger.threshold;
      case 'latency_high':
        return conditions.latency > trigger.threshold;
      case 'packet_loss_high':
        return conditions.packetLoss > trigger.threshold;
      case 'stability_low':
        return conditions.stability < trigger.threshold;
      case 'connection_lost':
        return conditions.quality === 'offline';
      case 'quality_degraded':
        return conditions.quality === 'poor';
      default:
        return false;
    }
  }

  private createFallbackPlan(request: StoryRequest): string[] {
    const plan: string[] = [];
    
    // Add progressively more aggressive fallbacks
    if (this.currentConditions.quality !== 'offline') {
      plan.push('reduce_content_quality');
      plan.push('use_cached_content');
    }
    
    plan.push('offline_mode');
    plan.push('minimal_functionality');
    plan.push('error_state');
    
    return plan;
  }

  private calculateExpectedLatencyReduction(adaptations: string[]): number {
    let reduction = 0;
    
    for (const adaptation of adaptations) {
      switch (adaptation) {
        case 'compress_data':
          reduction += 200;
          break;
        case 'reduce_quality':
          reduction += 300;
          break;
        case 'cache_aggressive':
          reduction += 500;
          break;
        case 'minimal_requests':
          reduction += 400;
          break;
        case 'batch_requests':
          reduction += 150;
          break;
      }
    }
    
    return reduction;
  }

  private calculateReliabilityImprovement(adaptations: string[]): number {
    let improvement = 0;
    
    for (const adaptation of adaptations) {
      switch (adaptation) {
        case 'cache_aggressive':
          improvement += 0.2;
          break;
        case 'offline_mode':
          improvement += 0.4;
          break;
        case 'minimal_requests':
          improvement += 0.1;
          break;
        case 'compress_data':
          improvement += 0.05;
          break;
      }
    }
    
    return Math.min(0.9, improvement); // Cap at 90% improvement
  }

  private identifyNeededAdaptations(
    requirements: NetworkRequirement, 
    conditions: NetworkConditions
  ): string[] {
    const adaptations: string[] = [];
    
    if (conditions.effectiveBandwidth < requirements.minBandwidth) {
      adaptations.push('compress_data', 'reduce_quality');
    }
    
    if (conditions.latency > requirements.maxLatency) {
      adaptations.push('cache_aggressive', 'minimal_requests');
    }
    
    if (conditions.packetLoss > requirements.maxPacketLoss) {
      adaptations.push('batch_requests');
    }
    
    if (conditions.stability < requirements.minStability) {
      adaptations.push('offline_mode');
    }
    
    return adaptations;
  }

  private estimateOperationLatency(operationType: string, conditions: NetworkConditions): number {
    let baseLatency = 2000; // Base 2 seconds for story generation
    
    // Adjust based on network conditions
    baseLatency += conditions.latency;
    
    if (conditions.quality === 'poor') {
      baseLatency *= 1.5;
    } else if (conditions.quality === 'excellent') {
      baseLatency *= 0.8;
    }
    
    // Add variability based on stability
    baseLatency *= (2 - conditions.stability); // Less stable = more latency
    
    return Math.round(baseLatency);
  }

  private calculateReliabilityScore(conditions: NetworkConditions): number {
    let score = 0.5; // Base score
    
    // Network quality impact
    switch (conditions.quality) {
      case 'excellent':
        score += 0.4;
        break;
      case 'good':
        score += 0.2;
        break;
      case 'poor':
        score -= 0.2;
        break;
      case 'offline':
        score = 0.1;
        break;
    }
    
    // Stability impact
    score += (conditions.stability - 0.5) * 0.4;
    
    // Packet loss impact
    score -= conditions.packetLoss * 0.3;
    
    return Math.max(0, Math.min(1, score));
  }

  private async updateNetworkConditions(): Promise<void> {
    // In a real implementation, this would use actual network monitoring APIs
    // For now, we'll simulate realistic network condition changes
    
    const previousQuality = this.currentConditions.quality;
    
    // Simulate network quality changes
    const qualityOptions = ['excellent', 'good', 'poor'] as const;
    const weights = [0.25, 0.65, 0.1]; // 25% excellent, 65% good, 10% poor
    
    let random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < qualityOptions.length; i++) {
      cumulative += weights[i];
      if (random < cumulative) {
        this.currentConditions.quality = qualityOptions[i];
        break;
      }
    }
    
    // Update metrics based on quality
    switch (this.currentConditions.quality) {
      case 'excellent':
        this.currentConditions.bandwidth = 50 + Math.random() * 50;
        this.currentConditions.latency = 10 + Math.random() * 30;
        this.currentConditions.packetLoss = Math.random() * 0.001;
        this.currentConditions.stability = 0.95 + Math.random() * 0.05;
        break;
      case 'good':
        this.currentConditions.bandwidth = 10 + Math.random() * 40;
        this.currentConditions.latency = 50 + Math.random() * 100;
        this.currentConditions.packetLoss = Math.random() * 0.01;
        this.currentConditions.stability = 0.8 + Math.random() * 0.15;
        break;
      case 'poor':
        this.currentConditions.bandwidth = 1 + Math.random() * 5;
        this.currentConditions.latency = 200 + Math.random() * 500;
        this.currentConditions.packetLoss = 0.01 + Math.random() * 0.05;
        this.currentConditions.stability = 0.4 + Math.random() * 0.4;
        break;
    }
    
    // Calculate effective bandwidth considering packet loss and stability
    this.currentConditions.effectiveBandwidth = this.currentConditions.bandwidth * 
      this.currentConditions.stability * (1 - this.currentConditions.packetLoss);
    
    // Log significant quality changes
    if (previousQuality !== this.currentConditions.quality) {
      structuredLogger.info('Network quality changed', {
        previousQuality,
        newQuality: this.currentConditions.quality,
        bandwidth: this.currentConditions.bandwidth,
        latency: this.currentConditions.latency
      });
    }
  }

  private recordConnectionEvent(event: ConnectionHistory): void {
    this.connectionHistory.push(event);
    
    // Keep only recent history (last 100 events)
    if (this.connectionHistory.length > 100) {
      this.connectionHistory = this.connectionHistory.slice(-100);
    }
  }

  private startNetworkMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      await this.updateNetworkConditions();
    }, 5000); // Update every 5 seconds
  }

  private initializeNetworkConditions(): void {
    this.currentConditions = {
      type: 'wifi',
      quality: 'good',
      bandwidth: 25,
      latency: 80,
      packetLoss: 0.005,
      stability: 0.9,
      effectiveBandwidth: 22
    };
  }

  private initializeAdaptationStrategies(): void {
    // Story generation strategy
    this.adaptationStrategies.set('story_generation', {
      name: 'story_generation',
      networkRequirement: {
        minBandwidth: 5, // 5 Mbps
        maxLatency: 3000, // 3 seconds
        maxPacketLoss: 0.02, // 2%
        minStability: 0.7 // 70%
      },
      adaptations: [
        {
          adaptation: 'compress_data',
          trigger: {
            condition: 'bandwidth_low',
            threshold: 10, // < 10 Mbps
            windowSize: 30000,
            consecutiveOccurrences: 2
          },
          implementation: this.compressDataAdaptation.bind(this),
          reversible: true,
          qualityImpact: 0.1,
          performanceGain: 0.3
        },
        {
          adaptation: 'reduce_quality',
          trigger: {
            condition: 'bandwidth_low',
            threshold: 5, // < 5 Mbps
            windowSize: 30000,
            consecutiveOccurrences: 3
          },
          implementation: this.reduceQualityAdaptation.bind(this),
          reversible: true,
          qualityImpact: 0.3,
          performanceGain: 0.5
        },
        {
          adaptation: 'cache_aggressive',
          trigger: {
            condition: 'latency_high',
            threshold: 2000, // > 2 seconds
            windowSize: 60000,
            consecutiveOccurrences: 2
          },
          implementation: this.aggressiveCacheAdaptation.bind(this),
          reversible: true,
          qualityImpact: 0.05,
          performanceGain: 0.6
        },
        {
          adaptation: 'offline_mode',
          trigger: {
            condition: 'connection_lost',
            threshold: 0,
            windowSize: 1000,
            consecutiveOccurrences: 1
          },
          implementation: this.offlineModeAdaptation.bind(this),
          reversible: true,
          qualityImpact: 0.6,
          performanceGain: 0.9
        }
      ],
      fallbackTriggers: [
        {
          condition: 'quality_degraded',
          threshold: 0.3,
          windowSize: 60000,
          consecutiveOccurrences: 3
        }
      ],
      userExperienceImpact: {
        responseTime: -800, // 800ms improvement expected
        contentQuality: 0.8, // 80% quality preservation
        reliability: 0.9, // 90% reliability
        transparency: 0.7 // 70% invisible to user
      }
    });

    // Default strategy for other operations
    this.adaptationStrategies.set('default', {
      name: 'default',
      networkRequirement: {
        minBandwidth: 1,
        maxLatency: 5000,
        maxPacketLoss: 0.05,
        minStability: 0.5
      },
      adaptations: [
        {
          adaptation: 'compress_data',
          trigger: {
            condition: 'bandwidth_low',
            threshold: 2,
            windowSize: 30000,
            consecutiveOccurrences: 2
          },
          implementation: this.compressDataAdaptation.bind(this),
          reversible: true,
          qualityImpact: 0.1,
          performanceGain: 0.2
        }
      ],
      fallbackTriggers: [],
      userExperienceImpact: {
        responseTime: -200,
        contentQuality: 0.9,
        reliability: 0.8,
        transparency: 0.8
      }
    });
  }

  private initializeOfflineCapabilities(): void {
    this.offlineCapabilities.set('story_generation', {
      feature: 'story_generation',
      offline: true,
      degradedMode: 'template_based',
      cacheRequirement: 10, // 10 MB
      functionality: 'limited'
    });

    this.offlineCapabilities.set('user_progress', {
      feature: 'user_progress',
      offline: true,
      degradedMode: 'local_storage',
      cacheRequirement: 1, // 1 MB
      functionality: 'full'
    });

    this.offlineCapabilities.set('content_cache', {
      feature: 'content_cache',
      offline: true,
      degradedMode: 'read_only',
      cacheRequirement: 50, // 50 MB
      functionality: 'full'
    });
  }

  // Adaptation implementation methods

  private async compressDataAdaptation(
    request: StoryRequest, 
    conditions: NetworkConditions
  ): Promise<AdaptedRequest> {
    const modifiedRequest = { 
      ...request, 
      options: { 
        ...request.options, 
        compression: true,
        maxLength: Math.min(request.options?.maxLength || 500, 300)
      }
    };

    return {
      originalRequest: request,
      adaptations: ['compress_data'],
      modifiedRequest,
      expectedBehavior: {
        reducedLatency: 200,
        reliabilityImprovement: 0.1,
        qualityImpact: 0.1
      },
      fallbackPlan: ['reduce_quality', 'offline_mode']
    };
  }

  private async reduceQualityAdaptation(
    request: StoryRequest, 
    conditions: NetworkConditions
  ): Promise<AdaptedRequest> {
    const modifiedRequest = { 
      ...request, 
      options: { 
        ...request.options, 
        qualityLevel: 'basic',
        simplifiedLanguage: true,
        maxLength: Math.min(request.options?.maxLength || 500, 200)
      }
    };

    return {
      originalRequest: request,
      adaptations: ['reduce_quality'],
      modifiedRequest,
      expectedBehavior: {
        reducedLatency: 500,
        reliabilityImprovement: 0.2,
        qualityImpact: 0.3
      },
      fallbackPlan: ['cache_only', 'offline_mode']
    };
  }

  private async aggressiveCacheAdaptation(
    request: StoryRequest, 
    conditions: NetworkConditions
  ): Promise<AdaptedRequest> {
    const modifiedRequest = { 
      ...request, 
      options: { 
        ...request.options, 
        preferCache: true,
        cacheFirst: true,
        maxCacheAge: 3600000 // 1 hour
      }
    };

    return {
      originalRequest: request,
      adaptations: ['cache_aggressive'],
      modifiedRequest,
      expectedBehavior: {
        reducedLatency: 800,
        reliabilityImprovement: 0.4,
        qualityImpact: 0.05
      },
      fallbackPlan: ['offline_mode']
    };
  }

  private async offlineModeAdaptation(
    request: StoryRequest, 
    conditions: NetworkConditions
  ): Promise<AdaptedRequest> {
    const modifiedRequest = { 
      ...request, 
      options: { 
        ...request.options, 
        offlineOnly: true,
        useTemplates: true,
        simplifiedGeneration: true
      }
    };

    return {
      originalRequest: request,
      adaptations: ['offline_mode'],
      modifiedRequest,
      expectedBehavior: {
        reducedLatency: 1500,
        reliabilityImprovement: 0.8,
        qualityImpact: 0.6
      },
      fallbackPlan: ['emergency_templates']
    };
  }

  /**
   * Get current network adapter metrics
   */
  public getNetworkMetrics(): {
    currentConditions: NetworkConditions;
    activeAdaptations: string[];
    adaptationHistory: {
      totalAdaptations: number;
      successRate: number;
      averageQualityImpact: number;
      averagePerformanceGain: number;
    };
    connectionHistory: ConnectionHistory[];
  } {
    const successRate = this.adaptationMetrics.totalAdaptations > 0 ?
      this.adaptationMetrics.successfulAdaptations / this.adaptationMetrics.totalAdaptations : 1;

    return {
      currentConditions: { ...this.currentConditions },
      activeAdaptations: Array.from(this.activeAdaptations),
      adaptationHistory: {
        totalAdaptations: this.adaptationMetrics.totalAdaptations,
        successRate,
        averageQualityImpact: this.adaptationMetrics.qualityImpact,
        averagePerformanceGain: this.adaptationMetrics.performanceGain
      },
      connectionHistory: [...this.connectionHistory.slice(-20)] // Last 20 events
    };
  }

  /**
   * Manually update network conditions (for testing)
   */
  public setNetworkConditions(conditions: Partial<NetworkConditions>): void {
    this.currentConditions = { ...this.currentConditions, ...conditions };
    
    // Recalculate effective bandwidth
    this.currentConditions.effectiveBandwidth = this.currentConditions.bandwidth * 
      this.currentConditions.stability * (1 - this.currentConditions.packetLoss);
    
    structuredLogger.info('Network conditions updated manually', {
      newConditions: this.currentConditions
    });
  }

  /**
   * Cleanup resources
   */
  public shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    structuredLogger.info('Network adapter service shutdown', {
      totalAdaptations: this.adaptationMetrics.totalAdaptations,
      finalConditions: this.currentConditions
    });
  }
}