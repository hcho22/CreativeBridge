/**
 * Analytics Dashboard Component
 *
 * Provides a comprehensive analytics dashboard for monitoring story import
 * usage metrics, user engagement, performance insights, and automated reports.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  analyticsService,
  UsageMetrics,
  UserEngagementMetrics,
  PerformanceMetrics,
  AnalyticsReport,
} from '../../services/analyticsService';
import { useAuth } from '../../context/AuthContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  userRole?: 'admin' | 'user';
}

interface DashboardState {
  usageMetrics: UsageMetrics | null;
  userEngagement: UserEngagementMetrics | null;
  performanceMetrics: PerformanceMetrics | null;
  recentReport: AnalyticsReport | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  selectedTimeRange: 'daily' | 'weekly' | 'monthly';
}

const { width: screenWidth } = Dimensions.get('window');

const AnalyticsDashboard: React.FC<Props> = ({
  visible,
  onClose,
  userRole = 'user',
}) => {
  const { user } = useAuth();

  const [state, setState] = useState<DashboardState>({
    usageMetrics: null,
    userEngagement: null,
    performanceMetrics: null,
    recentReport: null,
    loading: true,
    refreshing: false,
    error: null,
    selectedTimeRange: 'weekly',
  });

  // Load analytics data
  const loadAnalyticsData = useCallback(
    async (showRefreshing = false) => {
      try {
        setState(prev => ({
          ...prev,
          loading: !showRefreshing,
          refreshing: showRefreshing,
          error: null,
        }));

        const endDate = new Date().toISOString();
        const startDate = getStartDateForRange(state.selectedTimeRange);

        const [usageMetrics, userEngagement, performanceMetrics, report] =
          await Promise.all([
            // For admin, show all users; for user, show only their data
            analyticsService.getUsageMetrics(
              startDate,
              endDate,
              userRole === 'user' ? user?.id : undefined,
            ),
            user?.id
              ? analyticsService.getUserEngagementMetrics(user.id)
              : Promise.resolve(null),
            userRole === 'admin'
              ? analyticsService.getPerformanceMetrics(startDate, endDate)
              : Promise.resolve(null),
            userRole === 'admin'
              ? analyticsService.generateReport(state.selectedTimeRange)
              : Promise.resolve(null),
          ]);

        setState(prev => ({
          ...prev,
          usageMetrics,
          userEngagement,
          performanceMetrics,
          recentReport: report,
          loading: false,
          refreshing: false,
        }));
      } catch (error) {
        console.error('Load analytics data error:', error);
        setState(prev => ({
          ...prev,
          loading: false,
          refreshing: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to load analytics data',
        }));
      }
    },
    [state.selectedTimeRange, user?.id, userRole],
  );

  // Load data when component mounts or time range changes
  useEffect(() => {
    if (visible) {
      loadAnalyticsData();
    }
  }, [visible, loadAnalyticsData]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    loadAnalyticsData(true);
  }, [loadAnalyticsData]);

  // Handle time range change
  const handleTimeRangeChange = useCallback(
    (range: 'daily' | 'weekly' | 'monthly') => {
      setState(prev => ({ ...prev, selectedTimeRange: range }));
    },
    [],
  );

  // Generate and download report
  const handleGenerateReport = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));

      const report = await analyticsService.generateReport(
        state.selectedTimeRange,
      );

      setState(prev => ({ ...prev, recentReport: report, loading: false }));

      Alert.alert(
        'Report Generated',
        `${capitalize(
          state.selectedTimeRange,
        )} report has been generated successfully.`,
        [{ text: 'OK' }],
      );
    } catch (error) {
      console.error('Generate report error:', error);
      Alert.alert('Error', 'Failed to generate report. Please try again.', [
        { text: 'OK' },
      ]);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [state.selectedTimeRange]);

  if (!visible) return null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Analytics Dashboard</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Text style={styles.refreshButtonText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Time Range Selector */}
      <View style={styles.timeRangeContainer}>
        {(['daily', 'weekly', 'monthly'] as const).map(range => (
          <TouchableOpacity
            key={range}
            style={[
              styles.timeRangeButton,
              state.selectedTimeRange === range && styles.timeRangeButtonActive,
            ]}
            onPress={() => handleTimeRangeChange(range)}
          >
            <Text
              style={[
                styles.timeRangeButtonText,
                state.selectedTimeRange === range &&
                  styles.timeRangeButtonTextActive,
              ]}
            >
              {capitalize(range)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={handleRefresh}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {state.loading && !state.refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading analytics data...</Text>
          </View>
        ) : state.error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Error</Text>
            <Text style={styles.errorMessage}>{state.error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => loadAnalyticsData()}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Usage Metrics */}
            {state.usageMetrics && (
              <UsageMetricsCard metrics={state.usageMetrics} />
            )}

            {/* User Engagement */}
            {state.userEngagement && userRole === 'user' && (
              <UserEngagementCard engagement={state.userEngagement} />
            )}

            {/* Performance Metrics (Admin only) */}
            {state.performanceMetrics && userRole === 'admin' && (
              <PerformanceMetricsCard metrics={state.performanceMetrics} />
            )}

            {/* Recent Report */}
            {state.recentReport && userRole === 'admin' && (
              <ReportCard report={state.recentReport} />
            )}

            {/* Actions (Admin only) */}
            {userRole === 'admin' && (
              <View style={styles.actionsContainer}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleGenerateReport}
                  disabled={state.loading}
                >
                  <Text style={styles.actionButtonText}>Generate Report</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// Usage Metrics Card Component
const UsageMetricsCard: React.FC<{ metrics: UsageMetrics }> = ({ metrics }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>Usage Metrics</Text>

    <View style={styles.metricsGrid}>
      <MetricItem
        label="Total Imports"
        value={metrics.totalImports.toString()}
        color="#007AFF"
      />
      <MetricItem
        label="Unique Users"
        value={metrics.uniqueUsers.toString()}
        color="#28A745"
      />
      <MetricItem
        label="Import Success Rate"
        value={`${metrics.importSuccessRate.toFixed(1)}%`}
        color="#FFC107"
      />
      <MetricItem
        label="Continuation Success Rate"
        value={`${metrics.continuationSuccessRate.toFixed(1)}%`}
        color="#17A2B8"
      />
    </View>

    {metrics.popularSources.length > 0 && (
      <>
        <Text style={styles.subSectionTitle}>Popular Sources</Text>
        <View style={styles.sourcesContainer}>
          {metrics.popularSources.slice(0, 3).map((source, _index) => (
            <View key={source.source} style={styles.sourceItem}>
              <Text style={styles.sourceName}>{source.source}</Text>
              <Text style={styles.sourcePercentage}>
                {source.percentage.toFixed(1)}%
              </Text>
            </View>
          ))}
        </View>
      </>
    )}
  </View>
);

// User Engagement Card Component
const UserEngagementCard: React.FC<{ engagement: UserEngagementMetrics }> = ({
  engagement,
}) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>Your Engagement</Text>

    <View style={styles.metricsGrid}>
      <MetricItem
        label="Sessions This Week"
        value={engagement.sessionsThisWeek.toString()}
        color="#007AFF"
      />
      <MetricItem
        label="Total Imports"
        value={engagement.totalStoryImports.toString()}
        color="#28A745"
      />
      <MetricItem
        label="Total Continuations"
        value={engagement.totalStoryContinuations.toString()}
        color="#FFC107"
      />
      <MetricItem
        label="Engagement Score"
        value={engagement.engagementScore.toString()}
        color="#17A2B8"
      />
    </View>

    <View style={styles.engagementDetails}>
      <Text style={styles.detailText}>
        Favorite Source:{' '}
        <Text style={styles.detailValue}>{engagement.favoriteSource}</Text>
      </Text>
      {engagement.lastActiveDate && (
        <Text style={styles.detailText}>
          Last Active:{' '}
          <Text style={styles.detailValue}>
            {new Date(engagement.lastActiveDate).toLocaleDateString()}
          </Text>
        </Text>
      )}
    </View>
  </View>
);

// Performance Metrics Card Component (Admin only)
const PerformanceMetricsCard: React.FC<{ metrics: PerformanceMetrics }> = ({
  metrics,
}) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>Performance Metrics</Text>

    <View style={styles.metricsGrid}>
      <MetricItem
        label="Avg Import Time"
        value={`${(metrics.averageImportTime / 1000).toFixed(1)}s`}
        color="#007AFF"
      />
      <MetricItem
        label="Avg Continuation Time"
        value={`${(metrics.averageContinuationTime / 1000).toFixed(1)}s`}
        color="#28A745"
      />
      <MetricItem
        label="Cache Hit Rate"
        value={`${metrics.cacheHitRate.toFixed(1)}%`}
        color="#FFC107"
      />
      <MetricItem
        label="Error Rate"
        value={`${(
          metrics.errorRates.imports + metrics.errorRates.continuations
        ).toFixed(1)}%`}
        color="#DC3545"
      />
    </View>
  </View>
);

// Report Card Component (Admin only)
const ReportCard: React.FC<{ report: AnalyticsReport }> = ({ report }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>Latest Report</Text>

    <View style={styles.reportHeader}>
      <Text style={styles.reportType}>
        {capitalize(report.reportType)} Report
      </Text>
      <Text style={styles.reportDate}>
        Generated: {new Date(report.generatedAt).toLocaleDateString()}
      </Text>
    </View>

    <View style={styles.reportSummary}>
      <Text style={styles.subSectionTitle}>Key Insights</Text>
      {report.insights.slice(0, 3).map((insight, index) => (
        <Text key={index} style={styles.insightText}>
          • {insight}
        </Text>
      ))}
    </View>

    {report.recommendations.length > 0 && (
      <View style={styles.reportSummary}>
        <Text style={styles.subSectionTitle}>Recommendations</Text>
        {report.recommendations.slice(0, 2).map((recommendation, index) => (
          <Text key={index} style={styles.recommendationText}>
            → {recommendation}
          </Text>
        ))}
      </View>
    )}
  </View>
);

// Metric Item Component
const MetricItem: React.FC<{
  label: string;
  value: string;
  color: string;
}> = ({ label, value, color }) => (
  <View style={styles.metricItem}>
    <Text style={[styles.metricValue, { color }]}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

// Helper functions
const getStartDateForRange = (
  range: 'daily' | 'weekly' | 'monthly',
): string => {
  const now = new Date();
  let startDate: Date;

  switch (range) {
    case 'daily':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'weekly':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  return startDate.toISOString();
};

const capitalize = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    padding: 8,
  },
  refreshButtonText: {
    fontSize: 20,
    color: '#007AFF',
  },
  timeRangeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  timeRangeButtonActive: {
    backgroundColor: '#007AFF',
  },
  timeRangeButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  timeRangeButtonTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricItem: {
    width: (screenWidth - 80) / 2, // Account for padding and margins
    alignItems: 'center',
    marginBottom: 16,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  subSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  sourcesContainer: {
    marginTop: 8,
  },
  sourceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sourceName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  sourcePercentage: {
    fontSize: 16,
    color: '#666',
  },
  engagementDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  detailText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  detailValue: {
    fontWeight: '500',
    color: '#333',
  },
  reportHeader: {
    marginBottom: 16,
  },
  reportType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  reportDate: {
    fontSize: 14,
    color: '#666',
  },
  reportSummary: {
    marginBottom: 16,
  },
  insightText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
  },
  recommendationText: {
    fontSize: 16,
    color: '#007AFF',
    marginBottom: 8,
    lineHeight: 20,
  },
  actionsContainer: {
    marginTop: 16,
    marginBottom: 32,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default AnalyticsDashboard;
