import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Challenge, ChallengeProgress } from '../../types/challenges';

interface ChallengeDisplayProps {
  challenge: Challenge | null;
  progress?: ChallengeProgress;
  compact?: boolean;
}

const ChallengeDisplay: React.FC<ChallengeDisplayProps> = ({
  challenge,
  progress,
  compact = false,
}) => {
  if (!challenge) {
    return (
      <View style={styles.container}>
        <Text style={styles.noChallengeText}>No challenge active</Text>
      </View>
    );
  }

  const isCompleted = progress?.isCompleted || false;

  return (
    <View style={[styles.container, isCompleted && styles.completedContainer]}>
      <View style={styles.header}>
        <Text style={styles.emoji}>{challenge.emoji}</Text>
        <View style={styles.headerText}>
          <Text style={[styles.title, isCompleted && styles.completedTitle]}>
            {challenge.title}
          </Text>
          {!compact && (
            <Text style={styles.description}>{challenge.description}</Text>
          )}
        </View>
        <View style={styles.xpBadge}>
          <Text style={styles.xpText}>+{challenge.xpReward} XP</Text>
        </View>
      </View>

      {isCompleted && (
        <View style={styles.completedBanner}>
          <Text style={styles.completedText}>✅ Challenge Completed!</Text>
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
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  completedContainer: {
    backgroundColor: '#f0fff0',
    borderLeftColor: '#2E7D32',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 24,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  completedTitle: {
    textDecorationLine: 'line-through',
    color: '#666',
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  xpBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  xpText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  completedBanner: {
    marginTop: 12,
    backgroundColor: '#2E7D32',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  completedText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  noChallengeText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ChallengeDisplay;
