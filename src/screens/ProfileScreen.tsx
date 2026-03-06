import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { TabParamList } from '../navigation/AppNavigator';

type ProfileScreenNavigationProp = BottomTabNavigationProp<
  TabParamList,
  'Profile'
>;

interface ProfileScreenProps {
  navigation: ProfileScreenNavigationProp;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({
  navigation: _navigation,
}) => {
  const { userProfile, updateProfile, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editedDisplayName, setEditedDisplayName] = useState(
    userProfile?.display_name || '',
  );

  React.useEffect(() => {
    // Refresh profile data when screen loads (only once on mount)
    refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run on mount

  React.useEffect(() => {
    // Update local state when userProfile changes
    setEditedDisplayName(userProfile?.display_name || '');
  }, [userProfile?.display_name]);

  const handleEditProfile = () => {
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    try {
      const result = await updateProfile({
        display_name: editedDisplayName.trim(),
      });

      if (result.error) {
        Alert.alert('Error', 'Failed to update profile');
      } else {
        Alert.alert('Success', 'Profile updated successfully!');
        setEditModalVisible(false);
        await refreshProfile();
      }
    } catch (error) {
      console.error('Profile save error:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleCancelEdit = () => {
    setEditedDisplayName(userProfile?.display_name || '');
    setEditModalVisible(false);
  };

  const gradeDescriptions = useMemo(
    () => ({
      'K-2': 'Kindergarten - 2nd Grade',
      '3-5': '3rd - 5th Grade',
      '6-8': '6th - 8th Grade',
      '9-12': '9th - 12th Grade',
    }),
    [],
  );

  const getGradeDescription = (level: string): string => {
    return gradeDescriptions[level as keyof typeof gradeDescriptions] || level;
  };

  const levelData = useMemo(() => {
    const xp = userProfile?.total_xp || 0;
    // Simple leveling system: 100 XP per level
    const level = Math.floor(xp / 100) + 1;
    const currentLevelXP = (level - 1) * 100;
    const nextLevelXP = level * 100;
    const progress = ((xp - currentLevelXP) / 100) * 100;

    return { level, progress, nextLevelXP };
  }, [userProfile?.total_xp]);

  const { level, progress, nextLevelXP } = levelData;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 80,
        }}
      >
        <View style={styles.content}>
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {userProfile?.display_name?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            </View>

            <Text style={styles.displayName}>
              {userProfile?.display_name || 'Writer'}
            </Text>
            <Text style={styles.username}>
              @{userProfile?.username || 'username'}
            </Text>

            <TouchableOpacity
              style={styles.editButton}
              onPress={handleEditProfile}
            >
              <Text style={styles.editButtonText}>✏️ Edit Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Level Progress */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏆 Level Progress</Text>
            <View style={styles.levelContainer}>
              <Text style={styles.levelText}>Level {level}</Text>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {userProfile?.total_xp || 0} / {nextLevelXP} XP
              </Text>
            </View>
          </View>

          {/* Statistics */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 Statistics</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {userProfile?.total_xp || 0}
                </Text>
                <Text style={styles.statLabel}>⭐ Total XP</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {userProfile?.current_streak || 0}
                </Text>
                <Text style={styles.statLabel}>🔥 Current Streak</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {userProfile?.longest_streak || 0}
                </Text>
                <Text style={styles.statLabel}>🏆 Longest Streak</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {userProfile?.total_games_played || 0}
                </Text>
                <Text style={styles.statLabel}>🎮 Games Played</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {userProfile?.total_words_written || 0}
                </Text>
                <Text style={styles.statLabel}>📝 Words Written</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {userProfile?.best_score || 0}
                </Text>
                <Text style={styles.statLabel}>🎯 Best Score</Text>
              </View>
            </View>
          </View>

          {/* Preferences */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚙️ Preferences</Text>

            <View style={styles.preferenceItem}>
              <Text style={styles.preferenceLabel}>Grade Level</Text>
              <Text style={styles.preferenceValue}>
                {getGradeDescription(
                  userProfile?.preferred_grade_level || 'K-2',
                )}
              </Text>
            </View>

            <View style={styles.preferenceItem}>
              <Text style={styles.preferenceLabel}>Speech Features</Text>
              <Text
                style={[
                  styles.preferenceValue,
                  userProfile?.speech_enabled
                    ? styles.enabledText
                    : styles.disabledText,
                ]}
              >
                {userProfile?.speech_enabled ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
          </View>

          {/* Achievements (Future Feature) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏅 Achievements</Text>
            <View style={styles.achievementsContainer}>
              <Text style={styles.achievementsPlaceholder}>
                Achievement system coming soon!
                {'\n\n'}
                Start writing stories to unlock badges and rewards.
              </Text>
            </View>
          </View>
        </View>

        {/* Edit Profile Modal */}
        <Modal
          visible={editModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={handleCancelEdit}
        >
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalContainer}
            >
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Edit Profile</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Display Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editedDisplayName}
                    onChangeText={setEditedDisplayName}
                    placeholder="Enter your display name"
                    maxLength={50}
                  />
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={handleCancelEdit}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={handleSaveProfile}
                  >
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fcfcfc',
  },
  content: {
    padding: 20,
  },
  profileHeader: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarContainer: {
    marginBottom: 15,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  displayName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  username: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  editButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  levelContainer: {
    alignItems: 'center',
  },
  levelText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 10,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 16,
    color: '#666',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  preferenceLabel: {
    fontSize: 18,
    color: '#333',
    fontWeight: '500',
  },
  preferenceValue: {
    fontSize: 18,
    color: '#666',
  },
  enabledText: {
    color: '#4CAF50',
  },
  disabledText: {
    color: '#f44336',
  },
  achievementsContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  achievementsPlaceholder: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 25,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 18,
    backgroundColor: '#f8f9fa',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 18,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default React.memo(ProfileScreen);
