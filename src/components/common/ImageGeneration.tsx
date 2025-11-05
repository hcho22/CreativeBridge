import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { imageGenerationService } from '../../services/imageGeneration';
import { xpEventTracker } from '../../services/xpEventTracker';
import { storySessionManager } from '../../services/storySessionManager';
import type { ErrorType, GradeLevel } from '../../types/database';

interface ImageGenerationProps {
  storyContent: string;
  sessionId: string;
  gradeLevel: string;
  wordCount: number;
  onImageGenerated?: (imageUrl: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

interface ImageGenerationState {
  isGenerating: boolean;
  progress: number;
  currentStep: string;
  error: string | null;
  errorType: ErrorType | null;
  retryCount: number;
  isRetrying: boolean;
  generatedImageUrl: string | null;
  lastErrorTimestamp: number | null;
}

const ImageGeneration: React.FC<ImageGenerationProps> = ({
  storyContent,
  sessionId,
  gradeLevel,
  wordCount,
  onImageGenerated,
  onError,
  disabled = false,
}) => {
  const {
    userProfile,
    canGenerateImage,
    getXPBalanceInfo,
    deductXP,
    refundXP,
    createImageGenerationEvent,
  } = useAuth();

  const [state, setState] = useState<ImageGenerationState>({
    isGenerating: false,
    progress: 0,
    currentStep: '',
    error: null,
    errorType: null,
    retryCount: 0,
    isRetrying: false,
    generatedImageUrl: null,
    lastErrorTimestamp: null,
  });

  const [pulseAnim] = useState(new Animated.Value(1));

  const IMAGE_GENERATION_COST = 1000;
  const MAX_RETRY_ATTEMPTS = 3;

  // XP Balance Info
  const xpBalanceInfo = getXPBalanceInfo(IMAGE_GENERATION_COST);

  // Utility functions for error handling
  const getErrorDisplayInfo = useCallback(
    (errorType: ErrorType | null, error: string | null) => {
      if (!errorType || !error) return null;

      switch (errorType) {
        case 'insufficient_xp':
          return {
            icon: '💰',
            title: 'Not Enough XP',
            message:
              'You need more XP to generate an image. Complete more stories to earn XP!',
            action: 'Earn More XP',
            actionHint:
              'Try writing longer stories or completing multiple sessions',
            canRetry: false,
            severity: 'warning' as const,
          };

        case 'content_safety':
          return {
            icon: '🛡️',
            title: 'Content Safety Check',
            message:
              'Your story content needs adjustment for image generation. Please try rewriting some parts.',
            action: 'Learn More',
            actionHint:
              'Make sure your story is appropriate and follows community guidelines',
            canRetry: false,
            severity: 'warning' as const,
          };

        case 'api_failure':
          return {
            icon: '🔧',
            title: 'Service Temporarily Unavailable',
            message:
              'Our image generation service is having issues. Your XP has been refunded.',
            action: 'Try Again',
            actionHint: 'The service should be back online shortly',
            canRetry: true,
            severity: 'error' as const,
          };

        case 'timeout':
          return {
            icon: '⏱️',
            title: 'Generation Timed Out',
            message:
              'Image generation took too long and was cancelled. Your XP has been refunded.',
            action: 'Retry',
            actionHint: 'Try again - this sometimes happens during high usage',
            canRetry: true,
            severity: 'error' as const,
          };

        case 'rate_limit':
          return {
            icon: '🚦',
            title: 'Too Many Requests',
            message: 'Please wait a moment before generating another image.',
            action: 'Wait & Retry',
            actionHint: 'Rate limits help ensure fair usage for all users',
            canRetry: true,
            severity: 'warning' as const,
          };

        default:
          return {
            icon: '⚠️',
            title: 'Generation Failed',
            message:
              error ||
              'An unexpected error occurred. Your XP has been refunded.',
            action: 'Try Again',
            actionHint: 'Please try again or contact support if this persists',
            canRetry: true,
            severity: 'error' as const,
          };
      }
    },
    [],
  );

  const canRetryGeneration = useCallback(() => {
    if (!state.error || !state.errorType) return false;
    if (state.retryCount >= MAX_RETRY_ATTEMPTS) return false;

    const errorInfo = getErrorDisplayInfo(state.errorType, state.error);
    return errorInfo?.canRetry || false;
  }, [state.error, state.errorType, state.retryCount, getErrorDisplayInfo]);

  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
      errorType: null,
      lastErrorTimestamp: null,
    }));
  }, []);

  // Pulse animation for the button
  const startPulseAnimation = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  const stopPulseAnimation = useCallback(() => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  // Progress simulation for better UX
  const simulateProgress = useCallback(() => {
    const steps = [
      { progress: 10, step: 'Analyzing your story...' },
      { progress: 25, step: 'Extracting key elements...' },
      { progress: 40, step: 'Generating artistic prompt...' },
      { progress: 60, step: 'Creating your illustration...' },
      { progress: 80, step: 'Adding finishing touches...' },
      { progress: 95, step: 'Almost ready!' },
    ];

    steps.forEach((step, index) => {
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          progress: step.progress,
          currentStep: step.step,
        }));
      }, (index + 1) * 5000); // 5 seconds per step = 30 seconds total
    });
  }, []);

  const handleImageGeneration = useCallback(async () => {
    if (!canGenerateImage() || disabled) {
      return;
    }

    setState(prev => ({
      ...prev,
      isGenerating: true,
      progress: 0,
      currentStep: 'Preparing image generation...',
      error: null,
      errorType: null,
      isRetrying: prev.retryCount > 0,
    }));

    startPulseAnimation();
    simulateProgress();

    let imageEventId: string | null = null;

    try {
      // Step 1: Create tracking event
      imageEventId = await createImageGenerationEvent(
        sessionId,
        gradeLevel,
        wordCount,
      );

      // Step 2: Deduct XP
      const deductionResult = await deductXP(
        IMAGE_GENERATION_COST,
        'AI story illustration generation',
      );

      if (!deductionResult.success) {
        throw new Error(deductionResult.error || 'Failed to deduct XP');
      }

      // Step 3: Generate image
      setState(prev => ({
        ...prev,
        progress: 100,
        currentStep: 'Finalizing your illustration...',
      }));

      const generationResult = await imageGenerationService.generateImage({
        storyContent,
        gradeLevel: gradeLevel as GradeLevel,
        sessionId,
        userId: userProfile?.id || '',
        metadata: {
          wordCount,
        },
      });

      if (!generationResult.success || !generationResult.imageUrl) {
        // Refund XP if generation failed
        if (deductionResult.newBalance !== undefined) {
          await refundXP(
            IMAGE_GENERATION_COST,
            `Image generation failed: ${
              generationResult.error || 'Unknown error'
            }`,
          );
        }

        throw new Error(generationResult.error || 'Failed to generate image');
      }

      // Success!
      setState(prev => ({
        ...prev,
        isGenerating: false,
        progress: 100,
        currentStep: 'Image generated successfully!',
        generatedImageUrl: generationResult.imageUrl || null,
      }));

      // Update session with generated image data
      try {
        await storySessionManager.updateSessionWithImage(
          sessionId,
          generationResult.imageUrl!,
          IMAGE_GENERATION_COST,
        );
        console.log('Session updated with image data');
      } catch (error) {
        console.error('Failed to update session with image data:', error);
      }

      // Update tracking event with success
      if (imageEventId) {
        await xpEventTracker.updateImageGenerationEvent(
          imageEventId,
          'success',
          {
            imageUrl: generationResult.imageUrl,
            serviceUsed: generationResult.serviceUsed,
            apiResponseTime: generationResult.responseTimeMs,
          },
        );
      }

      onImageGenerated?.(generationResult.imageUrl!);

      Alert.alert(
        '🎨 Image Generated!',
        'Your story illustration has been created successfully! You can view and download it now.',
        [{ text: 'Amazing!', style: 'default' }],
      );
    } catch (error: any) {
      console.error('Image generation failed:', error);

      // Determine error type from the error message or result
      let errorType: ErrorType = 'api_failure';

      if (
        error.message?.includes('insufficient') ||
        error.message?.includes('XP')
      ) {
        errorType = 'insufficient_xp';
      } else if (
        error.message?.includes('content') ||
        error.message?.includes('safety')
      ) {
        errorType = 'content_safety';
      } else if (
        error.message?.includes('timeout') ||
        error.message?.includes('time')
      ) {
        errorType = 'timeout';
      } else if (
        error.message?.includes('rate') ||
        error.message?.includes('limit')
      ) {
        errorType = 'rate_limit';
      }

      // Update tracking event with failure
      if (imageEventId) {
        await xpEventTracker.updateImageGenerationEvent(
          imageEventId,
          'failed',
          {
            errorType,
            serviceUsed: 'replicate',
          },
        );
      }

      const errorMessage = error.message || 'An unexpected error occurred';

      setState(prev => ({
        ...prev,
        isGenerating: false,
        isRetrying: false,
        progress: 0,
        currentStep: '',
        error: errorMessage,
        errorType,
        lastErrorTimestamp: Date.now(),
        retryCount: prev.isRetrying ? prev.retryCount : prev.retryCount + 1,
      }));

      onError?.(errorMessage);

      // Don't show alert for certain error types - let the UI handle it
      if (errorType !== 'insufficient_xp' && errorType !== 'content_safety') {
        Alert.alert(
          '😅 Image Generation Failed',
          `We couldn't create your illustration this time: ${errorMessage}\n\nYour XP has been refunded. Please try again!`,
          [{ text: 'OK', style: 'default' }],
        );
      }
    } finally {
      stopPulseAnimation();
    }
  }, [
    canGenerateImage,
    disabled,
    deductXP,
    refundXP,
    createImageGenerationEvent,
    storyContent,
    gradeLevel,
    sessionId,
    wordCount,
    userProfile?.id,
    onImageGenerated,
    onError,
    startPulseAnimation,
    stopPulseAnimation,
    simulateProgress,
  ]);

  const renderXPBalanceDisplay = () => (
    <View style={styles.xpBalanceContainer}>
      <Text style={styles.xpBalanceLabel}>Your XP:</Text>
      <View style={styles.xpBalanceInfo}>
        <Text
          style={[
            styles.xpBalanceValue,
            xpBalanceInfo.hasEnoughXP
              ? styles.xpSufficient
              : styles.xpInsufficient,
          ]}
        >
          {xpBalanceInfo.currentXP.toLocaleString()}
        </Text>
        <Text style={styles.xpBalanceCost}>
          (Cost: {IMAGE_GENERATION_COST.toLocaleString()} XP)
        </Text>
      </View>
      {!xpBalanceInfo.hasEnoughXP && (
        <Text style={styles.xpShortfallMessage}>
          Need {xpBalanceInfo.shortfall.toLocaleString()} more XP
        </Text>
      )}
    </View>
  );

  const renderGenerationButton = () => {
    const isButtonDisabled =
      disabled || !xpBalanceInfo.canGenerate || state.isGenerating;

    return (
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          style={[
            styles.generateButton,
            isButtonDisabled && styles.generateButtonDisabled,
            state.isGenerating && styles.generateButtonLoading,
          ]}
          onPress={handleImageGeneration}
          disabled={isButtonDisabled}
        >
          {state.isGenerating ? (
            <View style={styles.loadingContent}>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text style={styles.generateButtonText}>Generating...</Text>
            </View>
          ) : (
            <Text
              style={[
                styles.generateButtonText,
                isButtonDisabled && styles.generateButtonTextDisabled,
              ]}
            >
              🎨 Generate Story Image
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderLoadingProgress = () => {
    if (!state.isGenerating) return null;

    return (
      <View style={styles.loadingContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Creating Your Illustration</Text>
          <Text style={styles.progressPercentage}>{state.progress}%</Text>
        </View>

        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${state.progress}%` }]}
            />
          </View>
        </View>

        <Text style={styles.progressStep}>{state.currentStep}</Text>

        <View style={styles.estimateContainer}>
          <Text style={styles.estimateText}>
            ⏱️ Estimated time: 30-45 seconds
          </Text>
        </View>
      </View>
    );
  };

  const renderDisabledState = () => {
    if (xpBalanceInfo.canGenerate && !disabled) return null;

    let disabledMessage = '';
    if (!xpBalanceInfo.hasEnoughXP) {
      disabledMessage = `You need ${xpBalanceInfo.shortfall.toLocaleString()} more XP to generate an image.`;
    } else if (disabled) {
      disabledMessage = 'Image generation is currently unavailable.';
    } else {
      disabledMessage = 'Please complete your story first.';
    }

    return (
      <View style={styles.disabledContainer}>
        <Text style={styles.disabledIcon}>🔒</Text>
        <Text style={styles.disabledTitle}>Image Generation Locked</Text>
        <Text style={styles.disabledMessage}>{disabledMessage}</Text>
        {!xpBalanceInfo.hasEnoughXP && (
          <Text style={styles.disabledHint}>
            💡 Complete more stories to earn XP!
          </Text>
        )}
      </View>
    );
  };

  const renderEnhancedErrorDisplay = () => {
    if (!state.error || !state.errorType) return null;

    const errorInfo = getErrorDisplayInfo(state.errorType, state.error);
    if (!errorInfo) return null;

    const canRetry = canRetryGeneration();
    const retryAttempts = state.retryCount;
    const maxAttempts = MAX_RETRY_ATTEMPTS;

    return (
      <View
        style={[
          styles.enhancedErrorContainer,
          errorInfo.severity === 'warning'
            ? styles.warningContainer
            : styles.errorContainerSevere,
        ]}
      >
        <View style={styles.errorHeader}>
          <Text style={styles.errorIconLarge}>{errorInfo.icon}</Text>
          <Text style={styles.errorTitle}>{errorInfo.title}</Text>
        </View>

        <Text style={styles.errorMessage}>{errorInfo.message}</Text>

        {canRetry && (
          <View style={styles.retrySection}>
            <Text style={styles.retryInfo}>
              Attempt {retryAttempts} of {maxAttempts}
            </Text>
            <TouchableOpacity
              style={[
                styles.enhancedRetryButton,
                state.isRetrying && styles.retryButtonDisabled,
              ]}
              onPress={handleImageGeneration}
              disabled={state.isRetrying || !xpBalanceInfo.canGenerate}
            >
              {state.isRetrying ? (
                <View style={styles.retryLoadingContent}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.retryButtonText}>Retrying...</Text>
                </View>
              ) : (
                <Text style={styles.retryButtonText}>{errorInfo.action}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {!canRetry && retryAttempts >= maxAttempts && (
          <View style={styles.maxRetriesContainer}>
            <Text style={styles.maxRetriesText}>
              Maximum retry attempts reached. Please try again later.
            </Text>
          </View>
        )}

        <View style={styles.errorHintContainer}>
          <Text style={styles.errorHint}>{errorInfo.actionHint}</Text>
        </View>

        <TouchableOpacity style={styles.dismissButton} onPress={clearError}>
          <Text style={styles.dismissButtonText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderXPBalanceDisplay()}
      {renderGenerationButton()}
      {renderLoadingProgress()}
      {renderDisabledState()}

      {renderEnhancedErrorDisplay()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  // XP Balance Display
  xpBalanceContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  xpBalanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6c757d',
    marginBottom: 4,
  },
  xpBalanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  xpBalanceValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  xpSufficient: {
    color: '#28a745',
  },
  xpInsufficient: {
    color: '#dc3545',
  },
  xpBalanceCost: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  xpShortfallMessage: {
    fontSize: 12,
    color: '#dc3545',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },

  // Generation Button
  generateButton: {
    backgroundColor: '#6f42c1',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6f42c1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  generateButtonDisabled: {
    backgroundColor: '#adb5bd',
    shadowOpacity: 0,
    elevation: 0,
  },
  generateButtonLoading: {
    backgroundColor: '#5a32a3',
  },
  generateButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  generateButtonTextDisabled: {
    color: '#6c757d',
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Loading Progress
  loadingContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#495057',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6f42c1',
  },
  progressBarContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6f42c1',
    borderRadius: 4,
  },
  progressStep: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  estimateContainer: {
    alignItems: 'center',
  },
  estimateText: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },

  // Disabled State
  disabledContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f8d7da',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f5c6cb',
    alignItems: 'center',
  },
  disabledIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  disabledTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#721c24',
    marginBottom: 8,
    textAlign: 'center',
  },
  disabledMessage: {
    fontSize: 14,
    color: '#721c24',
    textAlign: 'center',
    marginBottom: 8,
  },
  disabledHint: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Enhanced Error State
  enhancedErrorContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorContainerSevere: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
  },
  warningContainer: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  errorIconLarge: {
    fontSize: 28,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#721c24',
    flex: 1,
  },
  errorMessage: {
    fontSize: 14,
    color: '#721c24',
    lineHeight: 20,
    marginBottom: 12,
  },
  retrySection: {
    marginBottom: 12,
  },
  retryInfo: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  enhancedRetryButton: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  retryLoadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  maxRetriesContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  maxRetriesText: {
    fontSize: 13,
    color: '#495057',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorHintContainer: {
    marginBottom: 12,
  },
  errorHint: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  dismissButton: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#6c757d',
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#6c757d',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default ImageGeneration;
