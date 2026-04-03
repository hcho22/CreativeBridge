// Debounce Utilities
// Optimized debouncing for user input and API requests

export interface DebounceOptions {
  delay: number;
  maxWait?: number;
  leading?: boolean;
  trailing?: boolean;
  abortController?: AbortController;
}

export interface ThrottleOptions {
  interval: number;
  leading?: boolean;
  trailing?: boolean;
}

export interface BatchOptions {
  maxBatchSize: number;
  maxWaitTime: number;
  flushOnIdle?: boolean;
}

// Standard debounce function with enhanced features
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  options: DebounceOptions,
): T & { cancel: () => void; flush: () => void; pending: () => boolean } {
  let timeoutId: NodeJS.Timeout | null = null;
  let maxTimeoutId: NodeJS.Timeout | null = null;
  let lastCallTime: number | null = null;
  let lastInvokeTime = 0;
  let lastArgs: Parameters<T> | undefined;
  let result: ReturnType<T>;

  const {
    delay,
    maxWait,
    leading = false,
    trailing = true,
    abortController,
  } = options;

  function invokeFunc(time: number): ReturnType<T> {
    const args = lastArgs!;
    lastArgs = undefined;
    lastInvokeTime = time;

    if (abortController?.signal.aborted) {
      return result;
    }

    result = func.apply(this, args);
    return result;
  }

  function leadingEdge(time: number): ReturnType<T> {
    lastInvokeTime = time;
    timeoutId = setTimeout(timerExpired, delay);
    return leading ? invokeFunc(time) : result;
  }

  function remainingWait(time: number): number {
    const timeSinceLastCall = time - lastCallTime!;
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = delay - timeSinceLastCall;

    return maxWait !== undefined
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting;
  }

  function shouldInvoke(time: number): boolean {
    const timeSinceLastCall = time - lastCallTime!;
    const timeSinceLastInvoke = time - lastInvokeTime;

    return (
      lastCallTime === null ||
      timeSinceLastCall >= delay ||
      timeSinceLastCall < 0 ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    );
  }

  function timerExpired(): ReturnType<T> | void {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    timeoutId = setTimeout(timerExpired, remainingWait(time));
  }

  function trailingEdge(time: number): ReturnType<T> {
    timeoutId = null;

    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = undefined;
    return result;
  }

  function cancel(): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (maxTimeoutId !== null) {
      clearTimeout(maxTimeoutId);
      maxTimeoutId = null;
    }
    lastInvokeTime = 0;
    lastCallTime = null;
    lastArgs = undefined;
  }

  function flush(): ReturnType<T> {
    return timeoutId === null ? result : trailingEdge(Date.now());
  }

  function pending(): boolean {
    return timeoutId !== null;
  }

  function debounced(...args: Parameters<T>): ReturnType<T> {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastCallTime = time;

    if (isInvoking) {
      if (timeoutId === null) {
        return leadingEdge(lastCallTime);
      }
      if (maxWait !== undefined) {
        timeoutId = setTimeout(timerExpired, delay);
        return invokeFunc(lastCallTime);
      }
    }
    if (timeoutId === null) {
      timeoutId = setTimeout(timerExpired, delay);
    }
    return result;
  }

  debounced.cancel = cancel;
  debounced.flush = flush;
  debounced.pending = pending;

  return debounced as T & {
    cancel: () => void;
    flush: () => void;
    pending: () => boolean;
  };
}

// Throttle function for rate limiting
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  options: ThrottleOptions,
): T & { cancel: () => void; flush: () => void } {
  return debounce(func, {
    delay: options.interval,
    maxWait: options.interval,
    leading: options.leading ?? true,
    trailing: options.trailing ?? true,
  });
}

// Smart debouncing for story generation requests
export class StoryInputDebouncer {
  private debouncedValidation: ReturnType<typeof debounce>;
  private debouncedGeneration: ReturnType<typeof debounce>;
  private lastInput = '';
  private inputHistory: string[] = [];
  private readonly maxHistoryLength = 10;

  constructor(
    private validationCallback: (input: string) => Promise<any>,
    private generationCallback: (input: string) => Promise<any>,
    private options: {
      validationDelay?: number;
      generationDelay?: number;
      minInputLength?: number;
      maxInputLength?: number;
    } = {},
  ) {
    const {
      validationDelay = 300,
      generationDelay = 1000,
      minInputLength = 3,
      maxInputLength = 2000,
    } = options;

    // Debounced validation for real-time feedback
    this.debouncedValidation = debounce(this.validateInput.bind(this), {
      delay: validationDelay,
      leading: false,
      trailing: true,
    });

    // Debounced generation for API calls
    this.debouncedGeneration = debounce(this.generateStory.bind(this), {
      delay: generationDelay,
      maxWait: generationDelay * 2,
      leading: false,
      trailing: true,
    });
  }

  public handleInput(input: string): void {
    if (input === this.lastInput) return;

    this.lastInput = input;
    this.addToHistory(input);

    // Validate input for real-time feedback
    if (this.shouldValidate(input)) {
      this.debouncedValidation(input);
    }

    // Trigger generation for substantial input
    if (this.shouldGenerate(input)) {
      this.debouncedGeneration(input);
    }
  }

  private shouldValidate(input: string): boolean {
    const { minInputLength = 3 } = this.options;
    return input.trim().length >= minInputLength;
  }

  private shouldGenerate(input: string): boolean {
    const { minInputLength = 3, maxInputLength = 1000 } = this.options;
    const trimmed = input.trim();
    return (
      trimmed.length >= minInputLength &&
      trimmed.length <= maxInputLength &&
      this.hasSubstantialChange(input)
    );
  }

  private hasSubstantialChange(input: string): boolean {
    if (this.inputHistory.length < 2) return true;

    const previousInput = this.inputHistory[this.inputHistory.length - 2];
    const changeRatio = this.calculateChangeRatio(previousInput, input);
    return changeRatio > 0.3; // 30% change threshold
  }

  private calculateChangeRatio(oldText: string, newText: string): number {
    const maxLength = Math.max(oldText.length, newText.length);
    if (maxLength === 0) return 0;

    let differences = 0;
    for (let i = 0; i < maxLength; i++) {
      if (oldText[i] !== newText[i]) {
        differences++;
      }
    }

    return differences / maxLength;
  }

  private addToHistory(input: string): void {
    this.inputHistory.push(input);
    if (this.inputHistory.length > this.maxHistoryLength) {
      this.inputHistory.shift();
    }
  }

  private async validateInput(input: string): Promise<void> {
    try {
      await this.validationCallback(input);
    } catch (error) {
      console.error('Validation error:', error);
    }
  }

  private async generateStory(input: string): Promise<void> {
    try {
      await this.generationCallback(input);
    } catch (error) {
      console.error('Generation error:', error);
    }
  }

  public cancel(): void {
    this.debouncedValidation.cancel();
    this.debouncedGeneration.cancel();
  }

  public flush(): void {
    this.debouncedValidation.flush();
    this.debouncedGeneration.flush();
  }

  public getInputHistory(): string[] {
    return [...this.inputHistory];
  }

  public clearHistory(): void {
    this.inputHistory = [];
  }
}

// Batch processing for multiple API requests
export class RequestBatcher<T, R> {
  private queue: Array<{
    item: T;
    resolve: (result: R) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];

  private timer: NodeJS.Timeout | null = null;

  constructor(
    private processor: (items: T[]) => Promise<R[]>,
    private options: BatchOptions,
  ) {}

  public add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        item,
        resolve,
        reject,
        timestamp: Date.now(),
      });

      this.scheduleFlush();
    });
  }

  private scheduleFlush(): void {
    if (this.queue.length >= this.options.maxBatchSize) {
      this.flush();
      return;
    }

    if (this.timer) return;

    this.timer = setTimeout(() => {
      this.flush();
    }, this.options.maxWaitTime);
  }

  private async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.options.maxBatchSize);
    const items = batch.map(entry => entry.item);

    try {
      const results = await this.processor(items);

      batch.forEach((entry, index) => {
        if (results[index] !== undefined) {
          entry.resolve(results[index]);
        } else {
          entry.reject(new Error('No result for batch item'));
        }
      });
    } catch (error) {
      batch.forEach(entry => {
        entry.reject(error as Error);
      });
    }
  }

  public cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.queue.forEach(entry => {
      entry.reject(new Error('Batch processing cancelled'));
    });

    this.queue = [];
  }
}

// Adaptive debouncing based on user behavior
export class AdaptiveDebouncer {
  private typingSpeed = 0;
  private lastKeyTime = 0;
  private keystrokes: number[] = [];
  private readonly maxKeystrokeHistory = 20;

  constructor(
    private callback: (...args: any[]) => any,
    private baseDelay = 500,
  ) {}

  public getAdaptiveDelay(): number {
    if (this.keystrokes.length < 3) {
      return this.baseDelay;
    }

    // Calculate average typing speed (keystrokes per second)
    const now = Date.now();
    const recentKeystrokes = this.keystrokes.filter(time => now - time < 5000);
    this.typingSpeed = recentKeystrokes.length / 5; // keystrokes per second

    // Adapt delay based on typing speed
    if (this.typingSpeed > 3) {
      // Fast typer - longer delay to avoid too many requests
      return this.baseDelay * 1.5;
    } else if (this.typingSpeed < 1) {
      // Slow typer - shorter delay for better responsiveness
      return this.baseDelay * 0.7;
    }

    return this.baseDelay;
  }

  public recordKeystroke(): void {
    const now = Date.now();
    this.keystrokes.push(now);

    if (this.keystrokes.length > this.maxKeystrokeHistory) {
      this.keystrokes.shift();
    }

    this.lastKeyTime = now;
  }

  public createDebouncedFunction<T extends (...args: any[]) => any>(
    func: T,
  ): T {
    let timeoutId: NodeJS.Timeout | null = null;

    return ((...args: Parameters<T>) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const delay = this.getAdaptiveDelay();
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    }) as T;
  }
}

// Export utility functions for common use cases
export const storyInputDebouncer = {
  // Quick validation debounce
  validation: (callback: (input: string) => void, delay = 300) =>
    debounce(callback, { delay, leading: false, trailing: true }),

  // API request debounce with longer delay
  apiRequest: (callback: (...args: any[]) => Promise<any>, delay = 1000) =>
    debounce(callback, {
      delay,
      maxWait: delay * 2,
      leading: false,
      trailing: true,
    }),

  // Real-time search
  search: (callback: (query: string) => void, delay = 200) =>
    debounce(callback, { delay, leading: false, trailing: true }),

  // Button click protection
  button: (callback: () => void, delay = 500) =>
    debounce(callback, { delay, leading: true, trailing: false }),
};
