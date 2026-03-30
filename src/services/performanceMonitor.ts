/**
 * Consolidated Performance Monitor Service
 *
 * Single lightweight replacement for the 6 legacy performance services:
 * - performanceOptimizer.ts (DEPRECATED)
 * - performanceService.ts (DEPRECATED)
 * - performanceTuner.ts (DEPRECATED)
 * - uiPerformanceMonitor.ts (DEPRECATED)
 * - resourceManager.ts (DEPRECATED)
 * - downloadPerformanceMonitor.ts (DEPRECATED)
 *
 * Key design decisions:
 * - Disabled by default (lazy initialization, no timers on import)
 * - Explicit start()/stop() lifecycle
 * - No fake data (no modulo-based memory estimates, no random values for measurements)
 * - No global monkey-patching
 * - Uses performance.now() for timing
 */

export interface PerformanceEntry {
  name: string;
  startTime: number;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface PerformanceMonitorStats {
  isRunning: boolean;
  entryCount: number;
  averageDuration: number;
  slowestEntry: PerformanceEntry | null;
}

class PerformanceMonitorService {
  private entries: PerformanceEntry[] = [];
  private activeTimings = new Map<string, number>();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private running = false;

  private static readonly MAX_ENTRIES = 500;
  private static readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Start the performance monitor. No-op if already running.
   * Timers are only created after calling start().
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    this.cleanupTimer = setInterval(() => {
      this.pruneOldEntries();
    }, PerformanceMonitorService.CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop the performance monitor and cleanup all resources.
   * Idempotent — safe to call multiple times.
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.activeTimings.clear();
  }

  /**
   * Begin timing an operation. Returns the operation name for use with endTiming().
   */
  startTiming(name: string): string {
    if (!this.running) return name;
    this.activeTimings.set(name, performance.now());
    return name;
  }

  /**
   * End timing an operation and record the entry.
   */
  endTiming(
    name: string,
    metadata?: Record<string, unknown>,
  ): PerformanceEntry | null {
    if (!this.running) return null;

    const startTime = this.activeTimings.get(name);
    if (startTime === undefined) return null;

    this.activeTimings.delete(name);
    const duration = performance.now() - startTime;

    const entry: PerformanceEntry = { name, startTime, duration, metadata };
    this.entries.push(entry);

    if (this.entries.length > PerformanceMonitorService.MAX_ENTRIES) {
      this.entries = this.entries.slice(-PerformanceMonitorService.MAX_ENTRIES);
    }

    return entry;
  }

  /**
   * Record a pre-measured duration directly (e.g., from a render callback).
   */
  record(
    name: string,
    duration: number,
    metadata?: Record<string, unknown>,
  ): void {
    if (!this.running) return;

    this.entries.push({
      name,
      startTime: performance.now() - duration,
      duration,
      metadata,
    });

    if (this.entries.length > PerformanceMonitorService.MAX_ENTRIES) {
      this.entries = this.entries.slice(-PerformanceMonitorService.MAX_ENTRIES);
    }
  }

  /**
   * Get entries filtered by name prefix.
   */
  getEntries(namePrefix?: string): PerformanceEntry[] {
    if (!namePrefix) return [...this.entries];
    return this.entries.filter(e => e.name.startsWith(namePrefix));
  }

  /**
   * Get aggregate stats.
   */
  getStats(namePrefix?: string): PerformanceMonitorStats {
    const entries = this.getEntries(namePrefix);
    const totalDuration = entries.reduce((sum, e) => sum + e.duration, 0);

    return {
      isRunning: this.running,
      entryCount: entries.length,
      averageDuration: entries.length > 0 ? totalDuration / entries.length : 0,
      slowestEntry:
        entries.length > 0
          ? entries.reduce((slow, e) => (e.duration > slow.duration ? e : slow))
          : null,
    };
  }

  /**
   * Clear all recorded entries.
   */
  clear(): void {
    this.entries = [];
    this.activeTimings.clear();
  }

  /**
   * Whether the monitor is currently active.
   */
  isRunning(): boolean {
    return this.running;
  }

  private pruneOldEntries(): void {
    if (this.entries.length > PerformanceMonitorService.MAX_ENTRIES) {
      this.entries = this.entries.slice(-PerformanceMonitorService.MAX_ENTRIES);
    }
  }
}

// Singleton — disabled by default. Call performanceMonitor.start() to activate.
export const performanceMonitor = new PerformanceMonitorService();
export default PerformanceMonitorService;
