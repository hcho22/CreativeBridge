import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

type GradeLevel = 'K-2' | '3-5' | '6-8' | '9-12';

const HomeScreen: React.FC = () => {
  const { userProfile } = useAuth();
  const [isGameActive, setIsGameActive] = useState(false);
  const [currentStory, setCurrentStory] = useState('');
  const [userInput, setUserInput] = useState('');
  // Use the user's preferred grade level from their profile, or default to K-2
  const gradeLevel =
    (userProfile?.preferred_grade_level as GradeLevel) || 'K-2';

  const handleStartNewGame = async () => {
    setIsGameActive(true);
    // Initialize with a story starter based on grade level
    const storyStarters = {
      'K-2':
        'Once upon a time, in a magical forest, there lived a friendly dragon who loved to help others. One sunny morning, the dragon discovered something amazing...',
      '3-5':
        'Sarah had always been curious about the old lighthouse at the edge of town. Today, she finally decided to explore it, and what she found inside changed everything...',
      '6-8':
        "The notification on Alex's phone seemed ordinary, but when they clicked it, they were transported to a world where technology and magic coexisted in impossible ways...",
      '9-12':
        'The ancient manuscript contained secrets that scholars had been trying to decode for centuries. As Maya translated the first paragraph, she realized the text was actually a warning...',
    };

    setCurrentStory(storyStarters[gradeLevel]);
  };

  const handleContinueStory = () => {
    if (userInput.trim()) {
      // Add user's input to the story
      const newStory = currentStory + ' ' + userInput.trim();
      setCurrentStory(newStory);
      setUserInput('');

      // Here you would typically call the AI story agent
      // For now, we'll add a simple continuation
      setTimeout(() => {
        const aiContinuation =
          ' The adventure continued as new mysteries unfolded...';
        setCurrentStory(prev => prev + aiContinuation);
      }, 1000);
    }
  };

  const handleExitGame = () => {
    setIsGameActive(false);
    setCurrentStory('');
    setUserInput('');
  };

  if (isGameActive) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.gameContainer}>
          {/* Game Header */}
          <View style={styles.gameHeader}>
            <TouchableOpacity
              style={styles.exitButton}
              onPress={handleExitGame}
            >
              <Text style={styles.exitButtonText}>← Exit Game</Text>
            </TouchableOpacity>
            <Text style={styles.gradeLevel}>Grade Level: {gradeLevel}</Text>
          </View>

          {/* Story Display */}
          <View style={styles.storySection}>
            <Text style={styles.sectionTitle}>📖 Your Story</Text>
            <View style={styles.storyDisplay}>
              <Text style={styles.storyText}>{currentStory}</Text>
            </View>
          </View>

          {/* User Input Section */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>✍️ Continue the Story</Text>
            <TextInput
              style={styles.storyInput}
              value={userInput}
              onChangeText={setUserInput}
              placeholder="Write the next part of your story..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[
                styles.continueButton,
                !userInput.trim() && styles.disabledButton,
              ]}
              onPress={handleContinueStory}
              disabled={!userInput.trim()}
            >
              <Text style={styles.continueButtonText}>Continue Story →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.homeContainer}>
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>
            Welcome back, {userProfile?.display_name || 'Writer'}!
          </Text>
          <Text style={styles.welcomeSubtitle}>
            Ready to create amazing stories?
          </Text>
        </View>

        {/* Start Game Button */}
        <View style={styles.startSection}>
          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStartNewGame}
          >
            <Text style={styles.startButtonText}>🎮 Start New Story</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  homeContainer: {
    padding: 40,
    alignItems: 'center',
  },
  gameContainer: {
    padding: 20,
  },
  welcomeSection: {
    marginBottom: 60,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  gradeSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  gradeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gradeButton: {
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 8,
    width: '48%',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedGradeButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  gradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  selectedGradeButtonText: {
    color: '#ffffff',
  },
  startSection: {
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#f44336',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 50,
    minWidth: 250,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  // Game Screen Styles
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  exitButton: {
    backgroundColor: '#666',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  exitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  gradeLevel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  storySection: {
    marginBottom: 30,
  },
  storyDisplay: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    minHeight: 200,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  storyText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  inputSection: {
    marginBottom: 20,
  },
  storyInput: {
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontSize: 16,
    minHeight: 100,
    marginBottom: 15,
  },
  continueButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HomeScreen;
