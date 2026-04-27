/**
 * Story_Quest Import Screen
 *
 * This screen allows users to connect their Story_Quest account
 * and import their stories from the Story_Quest platform.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

import {
  storyQuestService,
  StoryQuestUser,
  StoryQuestStory,
  UserMatchResult,
} from '../services/storyQuestService';
import { useAuth } from '../context/AuthContext';
import { PaperBackground } from '../components/common/storybook';
import { theme } from '../constants/theme';

type RootStackParamList = {
  StoryQuestImport: undefined;
  StoryPreviewEdit: { story: any };
  ImportOptions: undefined;
};

type StoryQuestImportScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'StoryQuestImport'
>;
type StoryQuestImportScreenRouteProp = RouteProp<
  RootStackParamList,
  'StoryQuestImport'
>;

interface Props {
  navigation: StoryQuestImportScreenNavigationProp;
  route: StoryQuestImportScreenRouteProp;
}

interface ConnectionStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  error?: string;
}

const StoryQuestImportScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();

  // Connection state
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionSteps, setConnectionSteps] = useState<ConnectionStep[]>([
    {
      id: 'health',
      title: 'Check Story_Quest API',
      description: 'Verifying platform availability...',
      status: 'pending',
    },
    {
      id: 'match',
      title: 'Find Your Account',
      description: 'Looking for your Story_Quest profile...',
      status: 'pending',
    },
    {
      id: 'stories',
      title: 'Load Your Stories',
      description: 'Fetching your completed stories...',
      status: 'pending',
    },
  ]);

  // User input state
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');

  // Data state
  const [storyQuestUser, setStoryQuestUser] = useState<StoryQuestUser | null>(
    null,
  );
  const [stories, setStories] = useState<StoryQuestStory[]>([]);
  const [selectedStories, setSelectedStories] = useState<Set<string>>(
    new Set(),
  );
  const [userMatch, setUserMatch] = useState<UserMatchResult | null>(null);

  // UI state
  const [currentView, setCurrentView] = useState<
    'connect' | 'stories' | 'import'
  >('connect');

  useEffect(() => {
    // Auto-fill email from current user if available
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  const updateConnectionStep = (
    stepId: string,
    status: ConnectionStep['status'],
    error?: string,
  ) => {
    setConnectionSteps(prev =>
      prev.map(step =>
        step.id === stepId ? { ...step, status, error } : step,
      ),
    );
  };

  const handleConnect = async () => {
    if (!email.trim()) {
      Alert.alert(
        'Email Required',
        'Please enter your email address to find your Story_Quest account.',
      );
      return;
    }

    setIsConnecting(true);
    setConnectionSteps(prev =>
      prev.map(step => ({ ...step, status: 'pending', error: undefined })),
    );

    try {
      // Step 1: Check API health
      updateConnectionStep('health', 'in_progress');
      const isHealthy = await storyQuestService.checkApiHealth();

      if (!isHealthy) {
        updateConnectionStep(
          'health',
          'error',
          'Story_Quest service is currently unavailable',
        );
        Alert.alert(
          'Service Unavailable',
          'Story_Quest is currently unavailable. Please try again later.',
          [{ text: 'OK' }],
        );
        setIsConnecting(false);
        return;
      }

      updateConnectionStep('health', 'completed');

      // Step 2: Find user account
      updateConnectionStep('match', 'in_progress');
      const matchResult = await storyQuestService.matchUserByEmail(
        email.trim(),
      );

      if (!matchResult.found) {
        updateConnectionStep(
          'match',
          'error',
          'No Story_Quest account found with this email',
        );
        Alert.alert(
          'Account Not Found',
          "We couldn't find a Story_Quest account associated with this email. Please check your email or try a different one.",
          [{ text: 'OK' }],
        );
        setIsConnecting(false);
        return;
      }

      setUserMatch(matchResult);
      setStoryQuestUser(matchResult.user || null);
      updateConnectionStep('match', 'completed');

      // Show confidence warning for medium/low confidence matches
      if (matchResult.confidence !== 'high') {
        Alert.alert(
          'Account Match',
          `Found a possible match (${matchResult.confidence} confidence) for user "${matchResult.user?.username}". Is this correct?`,
          [
            {
              text: 'No, try again',
              style: 'cancel',
              onPress: () => setIsConnecting(false),
            },
            {
              text: 'Yes, continue',
              onPress: () => continueWithUserMatch(matchResult.user!),
            },
          ],
        );
        return;
      }

      await continueWithUserMatch(matchResult.user!);
    } catch (error) {
      console.error('Connection error:', error);
      Alert.alert(
        'Connection Error',
        'Failed to connect to Story_Quest. Please try again.',
        [{ text: 'OK' }],
      );
      setIsConnecting(false);
    }
  };

  const continueWithUserMatch = async (user: StoryQuestUser) => {
    try {
      // Step 3: Fetch user stories
      updateConnectionStep('stories', 'in_progress');
      const storiesResult = await storyQuestService.fetchUserStories(user.id);

      if (!storiesResult.success) {
        updateConnectionStep(
          'stories',
          'error',
          storiesResult.error || 'Failed to load stories',
        );
        Alert.alert(
          'Loading Error',
          'Failed to load your stories from Story_Quest. Please try again.',
          [{ text: 'OK' }],
        );
        setIsConnecting(false);
        return;
      }

      setStories(storiesResult.data || []);
      updateConnectionStep('stories', 'completed');

      setIsConnected(true);
      setIsConnecting(false);
      setCurrentView('stories');

      if (storiesResult.data?.length === 0) {
        Alert.alert(
          'No Stories Found',
          "We didn't find any completed stories in your Story_Quest account.",
          [{ text: 'OK' }],
        );
      }
    } catch (error) {
      console.error('Story loading error:', error);
      updateConnectionStep('stories', 'error', 'Failed to load stories');
      setIsConnecting(false);
    }
  };

  const handleStorySelection = (storyId: string) => {
    setSelectedStories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(storyId)) {
        newSet.delete(storyId);
      } else {
        newSet.add(storyId);
      }
      return newSet;
    });
  };

  const handleImportSelected = async () => {
    if (selectedStories.size === 0) {
      Alert.alert(
        'No Stories Selected',
        'Please select at least one story to import.',
      );
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to import stories.');
      return;
    }

    setCurrentView('import');
    let successCount = 0;
    let errorCount = 0;

    const selectedStoryList = stories.filter(story =>
      selectedStories.has(story.id),
    );

    for (const story of selectedStoryList) {
      try {
        const result = await storyQuestService.importStoryToCreativeBridge(
          story,
          user.id,
        );
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          console.error('Import failed for story:', story.id, result.error);
        }
      } catch (error) {
        errorCount++;
        console.error('Import error for story:', story.id, error);
      }
    }

    // Show results
    const message =
      successCount > 0
        ? `Successfully imported ${successCount} ${
            successCount === 1 ? 'story' : 'stories'
          }!${errorCount > 0 ? ` ${errorCount} failed to import.` : ''}`
        : 'Failed to import any stories. Please try again.';

    Alert.alert('Import Complete', message, [
      {
        text: 'OK',
        onPress: () => {
          if (successCount > 0) {
            navigation.navigate('ImportOptions');
          }
        },
      },
    ]);
  };

  const renderConnectionStep = ({ item }: { item: ConnectionStep }) => {
    const getStatusIcon = () => {
      switch (item.status) {
        case 'completed':
          return '✅';
        case 'in_progress':
          return '⏳';
        case 'error':
          return '❌';
        default:
          return '⚪';
      }
    };

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepIcon}>{getStatusIcon()}</Text>
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>{item.title}</Text>
          <Text style={styles.stepDescription}>{item.description}</Text>
          {item.error && <Text style={styles.stepError}>{item.error}</Text>}
        </View>
      </View>
    );
  };

  const renderStoryItem = ({ item }: { item: StoryQuestStory }) => {
    const isSelected = selectedStories.has(item.id);
    const preview =
      item.story_content.length > 100
        ? item.story_content.substring(0, 100) + '...'
        : item.story_content;

    return (
      <TouchableOpacity
        style={[styles.storyItem, isSelected && styles.storyItemSelected]}
        onPress={() => handleStorySelection(item.id)}
      >
        <View style={styles.storyHeader}>
          <Text style={styles.storyGrade}>{item.grade_level}</Text>
          <Text style={styles.storyScore}>Score: {item.final_score}</Text>
          <Text style={styles.storyWords}>{item.words_written} words</Text>
        </View>
        <Text style={styles.storyPreview}>{preview}</Text>
        <Text style={styles.storyDate}>
          Created: {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderConnectView = () => (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Connect to Story_Quest</Text>
      <Text style={styles.subtitle}>
        Import your completed stories from Story_Quest to continue them in
        CreativeBridge.
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Email Address</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Enter your Story_Quest email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!isConnecting}
        />
      </View>

      <TouchableOpacity
        style={[
          styles.connectButton,
          isConnecting && styles.connectButtonDisabled,
        ]}
        onPress={handleConnect}
        disabled={isConnecting}
      >
        {isConnecting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.connectButtonText}>Connect Account</Text>
        )}
      </TouchableOpacity>

      {isConnecting && (
        <View style={styles.progressContainer}>
          <FlatList
            data={connectionSteps}
            renderItem={renderConnectionStep}
            keyExtractor={item => item.id}
            scrollEnabled={false}
          />
        </View>
      )}

      {storyQuestUser && userMatch && (
        <View style={styles.userInfoContainer}>
          <Text style={styles.userInfoTitle}>Account Found!</Text>
          <Text style={styles.userInfoText}>
            Username: {storyQuestUser.username}
          </Text>
          <Text style={styles.userInfoText}>
            Display Name: {storyQuestUser.display_name}
          </Text>
          <Text style={styles.userInfoText}>
            Total XP: {storyQuestUser.total_xp}
          </Text>
          <Text style={styles.userInfoText}>
            Stories Completed: {storyQuestUser.total_stories_completed}
          </Text>
          <Text style={styles.matchConfidence}>
            Match Confidence: {userMatch.confidence} (by {userMatch.matchedBy})
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderStoriesView = () => (
    <View style={styles.container}>
      <Text style={styles.title}>Your Story_Quest Stories</Text>
      <Text style={styles.subtitle}>
        Select stories you'd like to import and continue in CreativeBridge.
      </Text>

      <View style={styles.selectionHeader}>
        <Text style={styles.selectionCount}>
          {selectedStories.size} of {stories.length} selected
        </Text>
        <TouchableOpacity
          style={styles.selectAllButton}
          onPress={() => {
            if (selectedStories.size === stories.length) {
              setSelectedStories(new Set());
            } else {
              setSelectedStories(new Set(stories.map(s => s.id)));
            }
          }}
        >
          <Text style={styles.selectAllText}>
            {selectedStories.size === stories.length
              ? 'Deselect All'
              : 'Select All'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={stories}
        renderItem={renderStoryItem}
        keyExtractor={item => item.id}
        style={styles.storiesList}
      />

      <TouchableOpacity
        style={[
          styles.importButton,
          selectedStories.size === 0 && styles.importButtonDisabled,
        ]}
        onPress={handleImportSelected}
        disabled={selectedStories.size === 0}
      >
        <Text style={styles.importButtonText}>
          Import {selectedStories.size}{' '}
          {selectedStories.size === 1 ? 'Story' : 'Stories'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderImportView = () => (
    <View style={styles.container}>
      <Text style={styles.title}>Importing Stories...</Text>
      <ActivityIndicator
        size="large"
        color="#007AFF"
        style={styles.importingIndicator}
      />
      <Text style={styles.importingText}>
        Importing your selected stories from Story_Quest. This may take a
        moment.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <PaperBackground style={StyleSheet.absoluteFillObject} />
      {currentView === 'connect' && renderConnectView()}
      {currentView === 'stories' && renderStoriesView()}
      {currentView === 'import' && renderImportView()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.paper.base,
  },
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontSize: 28,
    fontStyle: 'italic',
    color: theme.colors.ink.base,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 15,
    color: theme.colors.ink.soft,
    marginBottom: 20,
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.ink.soft,
    marginBottom: 6,
  },
  textInput: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    borderWidth: 1.5,
    borderColor: theme.colors.paper.edge,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: theme.colors.paper.cream,
    color: theme.colors.ink.base,
  },
  connectButton: {
    backgroundColor: theme.colors.accents.foxglove,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    ...theme.shadows.sm,
  },
  connectButtonDisabled: {
    backgroundColor: theme.colors.paper.deep,
    shadowOpacity: 0,
    elevation: 0,
  },
  connectButtonText: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    color: theme.colors.paper.cream,
    fontSize: 17,
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 20,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepIcon: {
    fontSize: 22,
    marginRight: 12,
    marginTop: 2,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.ink.base,
    marginBottom: 2,
  },
  stepDescription: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 13,
    color: theme.colors.ink.soft,
    lineHeight: 18,
  },
  stepError: {
    fontFamily: theme.typography.fontFamily.uiMedium,
    fontSize: 13,
    color: theme.colors.error,
    marginTop: 4,
    fontStyle: 'italic',
  },
  userInfoContainer: {
    backgroundColor: theme.colors.paper.cardWarm,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
    padding: 16,
    borderRadius: 14,
    marginTop: 20,
  },
  userInfoTitle: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.accents.moss,
    marginBottom: 8,
  },
  userInfoText: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 14,
    color: theme.colors.ink.base,
    marginBottom: 4,
  },
  matchConfidence: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 12,
    color: theme.colors.ink.faint,
    marginTop: 8,
    fontStyle: 'italic',
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectionCount: {
    fontFamily: theme.typography.fontFamily.uiMedium,
    fontSize: 14,
    color: theme.colors.ink.soft,
  },
  selectAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.accents.foxglove,
    borderRadius: 999,
    backgroundColor: theme.colors.paper.card,
  },
  selectAllText: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    color: theme.colors.accents.foxglove,
    fontSize: 13,
    fontWeight: '600',
  },
  storiesList: {
    flex: 1,
    marginBottom: 20,
  },
  storyItem: {
    backgroundColor: theme.colors.paper.card,
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.paper.edge,
  },
  storyItemSelected: {
    borderColor: theme.colors.accents.foxglove,
    backgroundColor: theme.colors.paper.cardWarm,
  },
  storyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  storyGrade: {
    fontFamily: theme.typography.fontFamily.uiBold,
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.accents.foxglove,
    backgroundColor: theme.colors.paper.cardWarm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  storyScore: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 12,
    color: theme.colors.ink.faint,
  },
  storyWords: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 12,
    color: theme.colors.ink.faint,
  },
  storyPreview: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 14,
    color: theme.colors.ink.base,
    lineHeight: 20,
    marginBottom: 8,
  },
  storyDate: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 12,
    color: theme.colors.ink.faint,
  },
  importButton: {
    backgroundColor: theme.colors.accents.moss,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  importButtonDisabled: {
    backgroundColor: theme.colors.paper.deep,
    shadowOpacity: 0,
    elevation: 0,
  },
  importButtonText: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    color: theme.colors.paper.cream,
    fontSize: 17,
    fontWeight: '600',
  },
  importingIndicator: {
    marginVertical: 20,
  },
  importingText: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 16,
    color: theme.colors.ink.soft,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default StoryQuestImportScreen;
