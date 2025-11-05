// Loading State Manager
// Manages loading states and progress indicators for story import operations

export enum LoadingStates {
  IDLE = 'IDLE',
  CHECKING_PERMISSIONS = 'CHECKING_PERMISSIONS',
  OPENING_FILE_PICKER = 'OPENING_FILE_PICKER',
  READING_FILE = 'READING_FILE',
  VALIDATING_CONTENT = 'VALIDATING_CONTENT',
  PROCESSING_STORY = 'PROCESSING_STORY',
  SAVING_STORY = 'SAVING_STORY',
  FETCHING_STORIES = 'FETCHING_STORIES',
  SEARCHING_STORIES = 'SEARCHING_STORIES',
  GENERATING_AI_CONTINUATION = 'GENERATING_AI_CONTINUATION',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS',
}

export interface LoadingState {
  state: LoadingStates;
  message: string;
  progress?: number; // 0-100 percentage
  details?: string;
  isIndeterminate?: boolean;
}

export interface LoadingStateOptions {
  message?: string;
  progress?: number;
  details?: string;
  isIndeterminate?: boolean;
}

export class LoadingStateManager {
  private static listeners: Set<(state: LoadingState) => void> = new Set();
  private static currentState: LoadingState = {
    state: LoadingStates.IDLE,
    message: 'Ready',
    isIndeterminate: false,
  };

  /**
   * Subscribe to loading state changes
   */
  static subscribe(listener: (state: LoadingState) => void): () => void {
    this.listeners.add(listener);

    // Immediately call with current state (with error handling)
    try {
      listener(this.currentState);
    } catch (error) {
      console.error('Error in loading state listener:', error);
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Update the loading state
   */
  static setState(
    state: LoadingStates,
    options: LoadingStateOptions = {},
  ): void {
    const newState: LoadingState = {
      state,
      message: options.message || this.getDefaultMessage(state),
      progress: options.progress,
      details: options.details,
      isIndeterminate: options.isIndeterminate ?? this.isIndeterminate(state),
    };

    this.currentState = newState;
    this.notifyListeners(newState);
  }

  /**
   * Get current loading state
   */
  static getCurrentState(): LoadingState {
    return { ...this.currentState };
  }

  /**
   * Set loading state to idle
   */
  static setIdle(): void {
    this.setState(LoadingStates.IDLE);
  }

  /**
   * Set loading state to error
   */
  static setError(message: string, details?: string): void {
    this.setState(LoadingStates.ERROR, { message, details });
  }

  /**
   * Set loading state to success
   */
  static setSuccess(message: string): void {
    this.setState(LoadingStates.SUCCESS, { message });
  }

  /**
   * Update progress for current state
   */
  static updateProgress(progress: number, details?: string): void {
    if (
      this.currentState.state === LoadingStates.IDLE ||
      this.currentState.state === LoadingStates.ERROR ||
      this.currentState.state === LoadingStates.SUCCESS
    ) {
      return; // Don't update progress for terminal states
    }

    const updatedState: LoadingState = {
      ...this.currentState,
      progress: Math.max(0, Math.min(100, progress)),
      details: details || this.currentState.details,
    };

    this.currentState = updatedState;
    this.notifyListeners(updatedState);
  }

  /**
   * Execute an operation with automatic loading state management
   */
  static async executeWithLoading<T>(
    operation: () => Promise<T>,
    loadingState: LoadingStates,
    options: LoadingStateOptions = {},
  ): Promise<T> {
    try {
      this.setState(loadingState, options);
      const result = await operation();
      this.setSuccess(options.message || 'Operation completed successfully');
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Operation failed';
      this.setError(errorMessage);
      throw error;
    }
  }

  /**
   * Execute a file import operation with progress tracking
   */
  static async executeFileImport<T>(
    operation: (
      updateProgress: (progress: number, details?: string) => void,
    ) => Promise<T>,
  ): Promise<T> {
    try {
      this.setState(LoadingStates.CHECKING_PERMISSIONS, {
        message: 'Checking file permissions...',
        progress: 0,
      });

      const result = await operation((progress: number, details?: string) => {
        this.updateProgress(progress, details);
      });

      this.setSuccess('File imported successfully');
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'File import failed';
      this.setError(errorMessage);
      throw error;
    }
  }

  /**
   * Get default message for a loading state
   */
  private static getDefaultMessage(state: LoadingStates): string {
    switch (state) {
      case LoadingStates.IDLE:
        return 'Ready';
      case LoadingStates.CHECKING_PERMISSIONS:
        return 'Checking permissions...';
      case LoadingStates.OPENING_FILE_PICKER:
        return 'Opening file picker...';
      case LoadingStates.READING_FILE:
        return 'Reading file content...';
      case LoadingStates.VALIDATING_CONTENT:
        return 'Validating story content...';
      case LoadingStates.PROCESSING_STORY:
        return 'Processing story...';
      case LoadingStates.SAVING_STORY:
        return 'Saving story...';
      case LoadingStates.FETCHING_STORIES:
        return 'Loading your stories...';
      case LoadingStates.SEARCHING_STORIES:
        return 'Searching stories...';
      case LoadingStates.GENERATING_AI_CONTINUATION:
        return 'Generating story continuation...';
      case LoadingStates.ERROR:
        return 'An error occurred';
      case LoadingStates.SUCCESS:
        return 'Operation completed';
      default:
        return 'Loading...';
    }
  }

  /**
   * Determine if a state should show indeterminate progress
   */
  private static isIndeterminate(state: LoadingStates): boolean {
    switch (state) {
      case LoadingStates.IDLE:
      case LoadingStates.ERROR:
      case LoadingStates.SUCCESS:
        return false;
      case LoadingStates.CHECKING_PERMISSIONS:
      case LoadingStates.OPENING_FILE_PICKER:
      case LoadingStates.GENERATING_AI_CONTINUATION:
      case LoadingStates.FETCHING_STORIES:
      case LoadingStates.SEARCHING_STORIES:
        return true;
      case LoadingStates.READING_FILE:
      case LoadingStates.VALIDATING_CONTENT:
      case LoadingStates.PROCESSING_STORY:
      case LoadingStates.SAVING_STORY:
        return false;
      default:
        return true;
    }
  }

  /**
   * Notify all listeners of state change
   */
  private static notifyListeners(state: LoadingState): void {
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in loading state listener:', error);
      }
    });
  }

  /**
   * Clear all listeners (useful for testing)
   */
  static clearListeners(): void {
    this.listeners.clear();
  }

  /**
   * Get a human-readable description of the current operation
   */
  static getOperationDescription(state: LoadingStates): string {
    switch (state) {
      case LoadingStates.CHECKING_PERMISSIONS:
        return 'Verifying that the app has permission to access files on your device';
      case LoadingStates.OPENING_FILE_PICKER:
        return 'Opening the file selection interface to choose your story file';
      case LoadingStates.READING_FILE:
        return 'Reading the content from your selected file and detecting text encoding';
      case LoadingStates.VALIDATING_CONTENT:
        return 'Checking that the file contains valid story content';
      case LoadingStates.PROCESSING_STORY:
        return 'Analyzing the story structure and preparing it for continuation';
      case LoadingStates.SAVING_STORY:
        return 'Saving the imported story to your personal library';
      case LoadingStates.FETCHING_STORIES:
        return 'Retrieving your previously created stories from the database';
      case LoadingStates.SEARCHING_STORIES:
        return 'Searching through your story collection for matches';
      case LoadingStates.GENERATING_AI_CONTINUATION:
        return 'Using AI to generate new content that continues your story';
      default:
        return this.getDefaultMessage(state);
    }
  }

  /**
   * Estimate completion time for different operations (in milliseconds)
   */
  static getEstimatedDuration(state: LoadingStates): number {
    switch (state) {
      case LoadingStates.CHECKING_PERMISSIONS:
        return 500;
      case LoadingStates.OPENING_FILE_PICKER:
        return 1000;
      case LoadingStates.READING_FILE:
        return 2000;
      case LoadingStates.VALIDATING_CONTENT:
        return 1000;
      case LoadingStates.PROCESSING_STORY:
        return 3000;
      case LoadingStates.SAVING_STORY:
        return 1500;
      case LoadingStates.FETCHING_STORIES:
        return 2000;
      case LoadingStates.SEARCHING_STORIES:
        return 1000;
      case LoadingStates.GENERATING_AI_CONTINUATION:
        return 10000; // AI operations take longer
      default:
        return 2000;
    }
  }
}

export default LoadingStateManager;
