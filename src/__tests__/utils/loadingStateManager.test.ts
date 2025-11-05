// Loading State Manager Tests
// Tests for loading state management and progress tracking

import {
  LoadingStateManager,
  LoadingStates,
  LoadingState,
} from '../../utils/loadingStateManager';

describe('LoadingStateManager', () => {
  beforeEach(() => {
    // Clear all listeners before each test
    LoadingStateManager.clearListeners();
    LoadingStateManager.setIdle();
  });

  describe('basic state management', () => {
    it('should start with idle state', () => {
      const currentState = LoadingStateManager.getCurrentState();

      expect(currentState.state).toBe(LoadingStates.IDLE);
      expect(currentState.message).toBe('Ready');
      expect(currentState.isIndeterminate).toBe(false);
    });

    it('should update state correctly', () => {
      LoadingStateManager.setState(LoadingStates.READING_FILE, {
        message: 'Reading your story file...',
        progress: 50,
      });

      const currentState = LoadingStateManager.getCurrentState();
      expect(currentState.state).toBe(LoadingStates.READING_FILE);
      expect(currentState.message).toBe('Reading your story file...');
      expect(currentState.progress).toBe(50);
    });

    it('should use default messages when not provided', () => {
      LoadingStateManager.setState(LoadingStates.VALIDATING_CONTENT);

      const currentState = LoadingStateManager.getCurrentState();
      expect(currentState.state).toBe(LoadingStates.VALIDATING_CONTENT);
      expect(currentState.message).toBe('Validating story content...');
    });

    it('should set error state correctly', () => {
      const errorMessage = 'File not found';
      const errorDetails = 'The selected file could not be located';

      LoadingStateManager.setError(errorMessage, errorDetails);

      const currentState = LoadingStateManager.getCurrentState();
      expect(currentState.state).toBe(LoadingStates.ERROR);
      expect(currentState.message).toBe(errorMessage);
      expect(currentState.details).toBe(errorDetails);
    });

    it('should set success state correctly', () => {
      const successMessage = 'Story imported successfully';

      LoadingStateManager.setSuccess(successMessage);

      const currentState = LoadingStateManager.getCurrentState();
      expect(currentState.state).toBe(LoadingStates.SUCCESS);
      expect(currentState.message).toBe(successMessage);
    });
  });

  describe('listener management', () => {
    it('should notify listeners of state changes', () => {
      const listener = jest.fn();
      const unsubscribe = LoadingStateManager.subscribe(listener);

      // Should be called immediately with current state
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ state: LoadingStates.IDLE }),
      );

      // Should be called again when state changes
      LoadingStateManager.setState(LoadingStates.READING_FILE);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ state: LoadingStates.READING_FILE }),
      );

      // Should stop receiving updates after unsubscribe
      unsubscribe();
      LoadingStateManager.setState(LoadingStates.SUCCESS);
      expect(listener).toHaveBeenCalledTimes(2); // Only the initial call and first update
    });

    it('should handle multiple listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      LoadingStateManager.subscribe(listener1);
      LoadingStateManager.subscribe(listener2);

      LoadingStateManager.setState(LoadingStates.PROCESSING_STORY);

      expect(listener1).toHaveBeenCalledWith(
        expect.objectContaining({ state: LoadingStates.PROCESSING_STORY }),
      );
      expect(listener2).toHaveBeenCalledWith(
        expect.objectContaining({ state: LoadingStates.PROCESSING_STORY }),
      );
    });

    it('should handle listener errors gracefully', () => {
      const faultyListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const goodListener = jest.fn();

      // Mock console.error to verify error handling
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      LoadingStateManager.subscribe(faultyListener);
      LoadingStateManager.subscribe(goodListener);

      LoadingStateManager.setState(LoadingStates.READING_FILE);

      // Good listener should still be called despite faulty listener
      expect(goodListener).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in loading state listener:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('progress tracking', () => {
    it('should update progress correctly', () => {
      LoadingStateManager.setState(LoadingStates.READING_FILE);
      LoadingStateManager.updateProgress(75, 'Reading page 3 of 4');

      const currentState = LoadingStateManager.getCurrentState();
      expect(currentState.progress).toBe(75);
      expect(currentState.details).toBe('Reading page 3 of 4');
    });

    it('should clamp progress to 0-100 range', () => {
      LoadingStateManager.setState(LoadingStates.PROCESSING_STORY);

      LoadingStateManager.updateProgress(-10);
      expect(LoadingStateManager.getCurrentState().progress).toBe(0);

      LoadingStateManager.updateProgress(150);
      expect(LoadingStateManager.getCurrentState().progress).toBe(100);
    });

    it('should not update progress for terminal states', () => {
      LoadingStateManager.setError('Test error');
      LoadingStateManager.updateProgress(50);

      expect(LoadingStateManager.getCurrentState().progress).toBeUndefined();

      LoadingStateManager.setSuccess('Success');
      LoadingStateManager.updateProgress(75);

      expect(LoadingStateManager.getCurrentState().progress).toBeUndefined();

      LoadingStateManager.setIdle();
      LoadingStateManager.updateProgress(25);

      expect(LoadingStateManager.getCurrentState().progress).toBeUndefined();
    });
  });

  describe('operation execution', () => {
    it('should execute operation with loading state', async () => {
      const mockOperation = jest.fn().mockResolvedValue('result');
      const listener = jest.fn();

      LoadingStateManager.subscribe(listener);

      const result = await LoadingStateManager.executeWithLoading(
        mockOperation,
        LoadingStates.READING_FILE,
        { message: 'Custom reading message' },
      );

      expect(result).toBe('result');
      expect(mockOperation).toHaveBeenCalled();

      // Should have set loading state, then success state
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          state: LoadingStates.READING_FILE,
          message: 'Custom reading message',
        }),
      );
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ state: LoadingStates.SUCCESS }),
      );
    });

    it('should handle operation errors', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error('Operation failed'));
      const listener = jest.fn();

      LoadingStateManager.subscribe(listener);

      await expect(
        LoadingStateManager.executeWithLoading(
          mockOperation,
          LoadingStates.SAVING_STORY,
        ),
      ).rejects.toThrow('Operation failed');

      // Should have set loading state, then error state
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ state: LoadingStates.SAVING_STORY }),
      );
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          state: LoadingStates.ERROR,
          message: 'Operation failed',
        }),
      );
    });

    it('should execute file import with progress tracking', async () => {
      const mockOperation = jest
        .fn()
        .mockImplementation(async updateProgress => {
          updateProgress(25, 'Step 1');
          updateProgress(50, 'Step 2');
          updateProgress(100, 'Complete');
          return 'import result';
        });

      const listener = jest.fn();
      LoadingStateManager.subscribe(listener);

      const result = await LoadingStateManager.executeFileImport(mockOperation);

      expect(result).toBe('import result');
      expect(mockOperation).toHaveBeenCalledWith(expect.any(Function));

      // Should have started with checking permissions
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          state: LoadingStates.CHECKING_PERMISSIONS,
          progress: 0,
        }),
      );

      // Should have ended with success
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          state: LoadingStates.SUCCESS,
          message: 'File imported successfully',
        }),
      );
    });
  });

  describe('utility methods', () => {
    it('should provide operation descriptions', () => {
      const description = LoadingStateManager.getOperationDescription(
        LoadingStates.READING_FILE,
      );

      expect(description).toContain('Reading the content');
      expect(description.length).toBeGreaterThan(20);
    });

    it('should provide estimated durations', () => {
      const duration = LoadingStateManager.getEstimatedDuration(
        LoadingStates.GENERATING_AI_CONTINUATION,
      );

      expect(duration).toBe(10000); // AI operations should take longer
      expect(typeof duration).toBe('number');
    });

    it('should determine indeterminate progress correctly', () => {
      LoadingStateManager.setState(LoadingStates.CHECKING_PERMISSIONS);
      expect(LoadingStateManager.getCurrentState().isIndeterminate).toBe(true);

      LoadingStateManager.setState(LoadingStates.READING_FILE);
      expect(LoadingStateManager.getCurrentState().isIndeterminate).toBe(false);

      LoadingStateManager.setState(LoadingStates.GENERATING_AI_CONTINUATION);
      expect(LoadingStateManager.getCurrentState().isIndeterminate).toBe(true);
    });
  });

  describe('state transitions', () => {
    it('should handle typical file import flow', () => {
      const states: LoadingStates[] = [];
      const listener = jest.fn().mockImplementation((state: LoadingState) => {
        states.push(state.state);
      });

      LoadingStateManager.subscribe(listener);

      // Simulate file import flow
      LoadingStateManager.setState(LoadingStates.CHECKING_PERMISSIONS);
      LoadingStateManager.setState(LoadingStates.OPENING_FILE_PICKER);
      LoadingStateManager.setState(LoadingStates.READING_FILE);
      LoadingStateManager.setState(LoadingStates.VALIDATING_CONTENT);
      LoadingStateManager.setState(LoadingStates.PROCESSING_STORY);
      LoadingStateManager.setState(LoadingStates.SAVING_STORY);
      LoadingStateManager.setSuccess('Import complete');

      expect(states).toEqual([
        LoadingStates.IDLE, // Initial state
        LoadingStates.CHECKING_PERMISSIONS,
        LoadingStates.OPENING_FILE_PICKER,
        LoadingStates.READING_FILE,
        LoadingStates.VALIDATING_CONTENT,
        LoadingStates.PROCESSING_STORY,
        LoadingStates.SAVING_STORY,
        LoadingStates.SUCCESS,
      ]);
    });

    it('should handle error during operation', () => {
      const states: LoadingStates[] = [];
      const listener = jest.fn().mockImplementation((state: LoadingState) => {
        states.push(state.state);
      });

      LoadingStateManager.subscribe(listener);

      LoadingStateManager.setState(LoadingStates.READING_FILE);
      LoadingStateManager.setError('File read failed');

      expect(states).toEqual([
        LoadingStates.IDLE,
        LoadingStates.READING_FILE,
        LoadingStates.ERROR,
      ]);
    });
  });
});
