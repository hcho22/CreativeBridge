import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Challenge, ChallengeProgress } from '../../types/challenges';
import { AdaptiveGlassBackground } from './AdaptiveGlassBackground';
import { theme } from '../../constants/theme';

interface ChallengeDisplayProps {
  challenge: Challenge | null;
  progress?: ChallengeProgress;
  compact?: boolean;
}

const challengeBoxConfig = theme.glass.surfaces.challengeBox;

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
    <AdaptiveGlassBackground
      glassStyle={challengeBoxConfig.glassStyle}
      fallbackBlurIntensity={challengeBoxConfig.fallbackBlurIntensity}
      fallbackBlurTint={challengeBoxConfig.fallbackBlurTint}
      androidFallbackColor={
        isCompleted
          ? 'rgba(240, 255, 240, 0.90)'
          : challengeBoxConfig.androidFallbackColor
      }
      style={
        isCompleted
          ? { ...styles.glassContainer, ...styles.completedContainer }
          : styles.glassContainer
      }
    >
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
    </AdaptiveGlassBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  glassContainer: {
    position: 'relative' as const,
    overflow: 'hidden' as const,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  completedContainer: {
    borderLeftColor: '#2E7D32',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 26,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  completedTitle: {
    textDecorationLine: 'line-through',
    color: '#666',
  },
  description: {
    fontSize: 16,
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
    fontSize: 14,
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
    fontSize: 16,
    fontWeight: '600',
  },
  noChallengeText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ChallengeDisplay;
