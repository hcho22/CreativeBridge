// Story Quality Indicator Component
// Displays quality metrics and suggestions for story content

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GradeLevel } from '../../types';

export interface QualityMetrics {
  coherence: number;
  engagement: number;
  appropriateness: number;
  creativity: number;
  overall: number;
}

export interface QualitySuggestion {
  type: 'improvement' | 'warning' | 'success';
  message: string;
  actionable: boolean;
}

interface StoryQualityIndicatorProps {
  metrics: QualityMetrics;
  suggestions: QualitySuggestion[];
  gradeLevel: GradeLevel;
  onShowDetails?: () => void;
  compact?: boolean;
}

const StoryQualityIndicator: React.FC<StoryQualityIndicatorProps> = ({
  metrics,
  suggestions,
  gradeLevel,
  onShowDetails,
  compact = false,
}) => {
  const getQualityColor = (score: number): string => {
    if (score >= 0.8) return '#4CAF50'; // Green
    if (score >= 0.6) return '#FF9800'; // Orange
    return '#f44336'; // Red
  };

  const getQualityEmoji = (score: number): string => {
    if (score >= 0.8) return '🌟';
    if (score >= 0.6) return '👍';
    return '💡';
  };

  const formatScore = (score: number): string => {
    return Math.round(score * 100).toString();
  };

  const getGradeLevelFeedback = (): string => {
    const level = gradeLevel;
    const score = metrics.overall;

    if (score >= 0.8) {
      return `Perfect for ${level} readers! 🎯`;
    } else if (score >= 0.6) {
      return `Good fit for ${level} with room to improve`;
    } else {
      return `May need adjustments for ${level} readers`;
    }
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactScore}>
          <Text
            style={[
              styles.overallScore,
              { color: getQualityColor(metrics.overall) },
            ]}
          >
            {getQualityEmoji(metrics.overall)} {formatScore(metrics.overall)}%
          </Text>
        </View>
        <TouchableOpacity onPress={onShowDetails} style={styles.detailsButton}>
          <Text style={styles.detailsButtonText}>Details</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📊 Story Quality</Text>
        <Text style={styles.gradeLevel}>{gradeLevel}</Text>
      </View>

      {/* Overall Score */}
      <View style={styles.overallContainer}>
        <Text
          style={[
            styles.overallScore,
            { color: getQualityColor(metrics.overall) },
          ]}
        >
          {getQualityEmoji(metrics.overall)} {formatScore(metrics.overall)}%
        </Text>
        <Text style={styles.gradeFeedback}>{getGradeLevelFeedback()}</Text>
      </View>

      {/* Detailed Metrics */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricRow}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Coherence</Text>
            <View style={styles.scoreBar}>
              <View
                style={[
                  styles.scoreFill,
                  {
                    width: `${metrics.coherence * 100}%`,
                    backgroundColor: getQualityColor(metrics.coherence),
                  },
                ]}
              />
            </View>
            <Text style={styles.metricValue}>
              {formatScore(metrics.coherence)}%
            </Text>
          </View>
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Engagement</Text>
            <View style={styles.scoreBar}>
              <View
                style={[
                  styles.scoreFill,
                  {
                    width: `${metrics.engagement * 100}%`,
                    backgroundColor: getQualityColor(metrics.engagement),
                  },
                ]}
              />
            </View>
            <Text style={styles.metricValue}>
              {formatScore(metrics.engagement)}%
            </Text>
          </View>
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Age-Appropriate</Text>
            <View style={styles.scoreBar}>
              <View
                style={[
                  styles.scoreFill,
                  {
                    width: `${metrics.appropriateness * 100}%`,
                    backgroundColor: getQualityColor(metrics.appropriateness),
                  },
                ]}
              />
            </View>
            <Text style={styles.metricValue}>
              {formatScore(metrics.appropriateness)}%
            </Text>
          </View>
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Creativity</Text>
            <View style={styles.scoreBar}>
              <View
                style={[
                  styles.scoreFill,
                  {
                    width: `${metrics.creativity * 100}%`,
                    backgroundColor: getQualityColor(metrics.creativity),
                  },
                ]}
              />
            </View>
            <Text style={styles.metricValue}>
              {formatScore(metrics.creativity)}%
            </Text>
          </View>
        </View>
      </View>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>💡 Suggestions</Text>
          {suggestions.slice(0, 3).map((suggestion, index) => (
            <View key={index} style={styles.suggestion}>
              <Text style={styles.suggestionIcon}>
                {suggestion.type === 'success'
                  ? '✅'
                  : suggestion.type === 'warning'
                  ? '⚠️'
                  : '💡'}
              </Text>
              <Text style={styles.suggestionText}>{suggestion.message}</Text>
            </View>
          ))}
          {suggestions.length > 3 && (
            <TouchableOpacity onPress={onShowDetails} style={styles.moreButton}>
              <Text style={styles.moreButtonText}>
                +{suggestions.length - 3} more suggestions
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 8,
    marginVertical: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  gradeLevel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  overallContainer: {
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  overallScore: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  compactScore: {
    flex: 1,
  },
  gradeFeedback: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  metricsContainer: {
    marginBottom: 16,
  },
  metricRow: {
    marginBottom: 8,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
    width: 90,
    fontWeight: '600',
  },
  scoreBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    marginHorizontal: 8,
  },
  scoreFill: {
    height: '100%',
    borderRadius: 3,
  },
  metricValue: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    width: 35,
    textAlign: 'right',
  },
  suggestionsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  suggestionIcon: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 1,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#555',
    lineHeight: 16,
  },
  detailsButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  detailsButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  moreButton: {
    marginTop: 4,
  },
  moreButtonText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '600',
  },
});

export default StoryQualityIndicator;
