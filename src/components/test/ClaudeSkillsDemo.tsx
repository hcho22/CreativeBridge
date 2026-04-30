// Claude Skills Demo Component - Proof of Concept
// Demonstrates basic Claude Skills integration functionality

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { getClaudeSkillsManager } from '../../services/claudeSkillsManager';
import { SkillManager, SkillType, SkillResult } from '../../types/claudeSkills';

interface DemoState {
  isInitialized: boolean;
  isLoading: boolean;
  results: Array<{
    skillType: SkillType;
    result: SkillResult;
    timestamp: Date;
  }>;
  error: string | null;
}

const ClaudeSkillsDemo: React.FC = () => {
  const [state, setState] = useState<DemoState>({
    isInitialized: false,
    isLoading: false,
    results: [],
    error: null,
  });

  const [skillManager, setSkillManager] = useState<SkillManager | null>(null);

  useEffect(() => {
    initializeSkillManager();

    return () => {
      // Cleanup on component unmount
      if (skillManager) {
        skillManager.shutdown().catch(console.error);
      }
    };
  }, []);

  const initializeSkillManager = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const manager = await getClaudeSkillsManager();
      setSkillManager(manager);
      setState(prev => ({
        ...prev,
        isInitialized: true,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize',
      }));
    }
  };

  const executeSkill = async (skillType: SkillType, input: any) => {
    if (!skillManager) {
      Alert.alert('Error', 'Skill manager not initialized');
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Find a skill of the requested type
      const skillId = `${skillType}_${Date.now()}`;

      console.log(`Executing ${skillType} with input:`, input);

      const result = await skillManager.executeSkill(skillId, input);

      setState(prev => ({
        ...prev,
        isLoading: false,
        results: [
          {
            skillType,
            result,
            timestamp: new Date(),
          },
          ...prev.results.slice(0, 9), // Keep last 10 results
        ],
      }));

      if (!result.success) {
        Alert.alert(
          'Skill Execution Failed',
          result.error?.message || 'Unknown error',
        );
      }
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Execution failed',
      );
    }
  };

  const testContentPrediction = () => {
    const input = {
      context: {
        storyContext:
          'Once upon a time, in a magical forest, there lived a brave little rabbit named Ruby. She loved to explore and help her forest friends.',
        userInput: 'Ruby found a mysterious glowing stone',
        gradeLevel: 'K-2',
        previousPredictions: [],
      },
      options: {
        maxPredictions: 3,
        confidenceThreshold: 0.7,
      },
    };

    executeSkill('ContentPredictionSkill', input);
  };

  const testResourceOptimization = () => {
    const input = {
      deviceInfo: {
        totalMemory: 4 * 1024 * 1024 * 1024, // 4GB
        availableMemory: 1 * 1024 * 1024 * 1024, // 1GB
        batteryLevel: 0.3, // 30%
        networkType: 'wifi',
        deviceTier: 'medium' as const,
      },
      currentUsage: {
        memoryUsage: 150 * 1024 * 1024, // 150MB
        cpuUsage: 0.25, // 25%
        activeBackgroundTasks: 3,
      },
    };

    executeSkill('ResourceOptimizationSkill', input);
  };

  const testQualityAssessment = () => {
    const input = {
      content: {
        story:
          'Ruby picked up the glowing stone and felt its warm magic. The stone showed her a path through the forest that sparkled with golden light. She knew this was the beginning of a wonderful adventure.',
        context:
          'Educational story for K-2 grade level focusing on adventure and friendship',
        gradeLevel: 'K-2',
      },
      criteria: {
        checkAppropriatenesss: true,
        checkCoherence: true,
        checkEngagement: true,
        checkEducationalValue: true,
      },
    };

    executeSkill('QualityAssessmentSkill', input);
  };

  const testBehaviorAnalysis = () => {
    const input = {
      userInteractions: [
        {
          type: 'tap' as const,
          timestamp: new Date(Date.now() - 10000),
          element: 'continue_button',
          duration: 100,
        },
        {
          type: 'scroll' as const,
          timestamp: new Date(Date.now() - 5000),
          element: 'story_content',
          duration: 2000,
        },
      ],
      sessionContext: {
        sessionId: 'demo_session_123',
        sessionDuration: 300000, // 5 minutes
        gradeLevel: 'K-2',
        deviceType: 'tablet',
      },
      analysisOptions: {
        includeEngagementPrediction: true,
        includePersonalizationSuggestions: true,
        includeDifficultyAdjustment: false,
      },
    };

    executeSkill('BehaviorAnalysisSkill', input);
  };

  const testErrorRecovery = () => {
    const input = {
      error: {
        type: 'NETWORK_ERROR',
        message: 'Failed to generate story content',
        context: {
          endpoint: '/api/story/generate',
          attempts: 2,
        },
      },
      recoveryContext: {
        storyState: {
          currentContent: 'Ruby picked up the glowing stone...',
          characterState: { name: 'Ruby', location: 'forest' },
        },
        userState: {
          gradeLevel: 'K-2',
          preferences: { theme: 'adventure' },
        },
        sessionState: {
          sessionId: 'demo_session_123',
          progress: 0.6,
        },
      },
      options: {
        preserveContext: true,
        generateFallback: true,
        userFriendlyMessage: true,
      },
    };

    executeSkill('ErrorRecoverySkill', input);
  };

  const clearResults = () => {
    setState(prev => ({ ...prev, results: [] }));
  };

  if (state.error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Claude Skills Demo</Text>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {state.error}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={initializeSkillManager}
          >
            <Text style={styles.buttonText}>Retry Initialization</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Claude Skills Demo</Text>

      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Status:{' '}
          {state.isInitialized ? '✅ Initialized' : '⏳ Initializing...'}
        </Text>
        {state.isLoading && (
          <Text style={styles.loadingText}>⚡ Executing...</Text>
        )}
      </View>

      {state.isInitialized && (
        <>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.button}
              onPress={testContentPrediction}
            >
              <Text style={styles.buttonText}>Test Content Prediction</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.button}
              onPress={testResourceOptimization}
            >
              <Text style={styles.buttonText}>Test Resource Optimization</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.button}
              onPress={testQualityAssessment}
            >
              <Text style={styles.buttonText}>Test Quality Assessment</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.button}
              onPress={testBehaviorAnalysis}
            >
              <Text style={styles.buttonText}>Test Behavior Analysis</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={testErrorRecovery}>
              <Text style={styles.buttonText}>Test Error Recovery</Text>
            </TouchableOpacity>

            {state.results.length > 0 && (
              <TouchableOpacity
                style={[styles.button, styles.clearButton]}
                onPress={clearResults}
              >
                <Text style={styles.buttonText}>Clear Results</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>
              Execution Results ({state.results.length})
            </Text>
            {state.results.map((item, index) => (
              <View key={index} style={styles.resultItem}>
                <Text style={styles.resultHeader}>
                  {item.skillType} - {item.timestamp.toLocaleTimeString()}
                </Text>
                <Text style={styles.resultStatus}>
                  {item.result.success ? '✅ Success' : '❌ Failed'}
                </Text>
                <Text style={styles.resultTime}>
                  Execution Time: {item.result.executionTimeMs}ms
                </Text>
                {item.result.confidence && (
                  <Text style={styles.resultConfidence}>
                    Confidence: {(item.result.confidence * 100).toFixed(1)}%
                  </Text>
                )}
                {item.result.error && (
                  <Text style={styles.resultError}>
                    Error: {item.result.error.message}
                  </Text>
                )}
                <Text style={styles.resultData}>
                  Data:{' '}
                  {JSON.stringify(item.result.data, null, 2).substring(0, 200)}
                  ...
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  statusContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  errorContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#2196f3',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  clearButton: {
    backgroundColor: '#ff9800',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  resultsContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  resultItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
    marginBottom: 15,
  },
  resultHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  resultStatus: {
    fontSize: 14,
    marginTop: 5,
    fontWeight: '600',
  },
  resultTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  resultConfidence: {
    fontSize: 12,
    color: '#4caf50',
    marginTop: 2,
  },
  resultError: {
    fontSize: 12,
    color: '#d32f2f',
    marginTop: 2,
  },
  resultData: {
    fontSize: 10,
    color: '#666',
    marginTop: 5,
    fontFamily: 'monospace',
  },
});

export default ClaudeSkillsDemo;
