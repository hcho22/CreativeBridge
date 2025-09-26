import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

type GradeLevel = 'K-2' | '3-5' | '6-8' | '9-12';

const SettingsScreen: React.FC = () => {
  const { userProfile, updateProfile, signOut } = useAuth();
  const [speechEnabled, setSpeechEnabled] = useState(
    userProfile?.speech_enabled || false,
  );
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<GradeLevel>(
    (userProfile?.preferred_grade_level as GradeLevel) || 'K-2',
  );

  const handleSpeechToggle = async (value: boolean) => {
    setSpeechEnabled(value);

    try {
      const result = await updateProfile({
        speech_enabled: value,
      });

      if (result.error) {
        Alert.alert('Error', 'Failed to update speech settings');
        setSpeechEnabled(!value); // Revert on error
      } else {
        Alert.alert(
          'Success',
          `Speech ${value ? 'enabled' : 'disabled'} successfully!`,
        );
      }
    } catch (error) {
      console.error('Speech toggle error:', error);
      Alert.alert('Error', 'Failed to update speech settings');
      setSpeechEnabled(!value); // Revert on error
    }
  };

  const handleGradeLevelChange = async (level: GradeLevel) => {
    setSelectedGradeLevel(level);

    try {
      const result = await updateProfile({
        preferred_grade_level: level,
      });

      if (result.error) {
        Alert.alert('Error', 'Failed to update grade level preference');
        setSelectedGradeLevel(
          (userProfile?.preferred_grade_level as GradeLevel) || 'K-2',
        ); // Revert on error
      } else {
        Alert.alert('Success', `Grade level updated to ${level}!`);
      }
    } catch (error) {
      console.error('Grade level update error:', error);
      Alert.alert('Error', 'Failed to update grade level preference');
      setSelectedGradeLevel(
        (userProfile?.preferred_grade_level as GradeLevel) || 'K-2',
      ); // Revert on error
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (error) {
            console.error('Logout error:', error);
            Alert.alert('Error', 'Failed to logout. Please try again.');
          }
        },
      },
    ]);
  };

  const getGradeLevelDescription = (level: GradeLevel): string => {
    switch (level) {
      case 'K-2':
        return 'Simple vocabulary and basic sentence structure';
      case '3-5':
        return 'Intermediate complexity with creative prompts';
      case '6-8':
        return 'Advanced storytelling and character development';
      case '9-12':
        return 'Complex narratives and literary techniques';
      default:
        return '';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Game Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎮 Game Settings</Text>

          {/* Grade Level Selection */}
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Preferred Grade Level</Text>
            <Text style={styles.settingDescription}>
              {getGradeLevelDescription(selectedGradeLevel)}
            </Text>
            <View style={styles.gradeButtons}>
              {(['K-2', '3-5', '6-8', '9-12'] as const).map(level => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.gradeButton,
                    selectedGradeLevel === level && styles.selectedGradeButton,
                  ]}
                  onPress={() => handleGradeLevelChange(level)}
                >
                  <Text
                    style={[
                      styles.gradeButtonText,
                      selectedGradeLevel === level &&
                        styles.selectedGradeButtonText,
                    ]}
                  >
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Accessibility Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>♿ Accessibility Settings</Text>

          {/* Speech Settings */}
          <View style={styles.settingItem}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>🔊 Speech Features</Text>
                <Text style={styles.settingDescription}>
                  Enable voice input and text-to-speech for stories
                </Text>
              </View>
              <Switch
                trackColor={{ false: '#767577', true: '#4CAF50' }}
                thumbColor={speechEnabled ? '#ffffff' : '#f4f3f4'}
                ios_backgroundColor="#3e3e3e"
                onValueChange={handleSpeechToggle}
                value={speechEnabled}
              />
            </View>
          </View>
        </View>

        {/* User Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤 Account</Text>

          {/* User Info */}
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Username</Text>
            <Text style={styles.userInfo}>
              {userProfile?.username || 'Not set'}
            </Text>
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Display Name</Text>
            <Text style={styles.userInfo}>
              {userProfile?.display_name || 'Not set'}
            </Text>
          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>🚪 Logout</Text>
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ℹ️ About</Text>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>App Version</Text>
            <Text style={styles.userInfo}>1.0.0</Text>
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Description</Text>
            <Text style={styles.aboutText}>
              CreativeBridge helps students develop creative writing skills
              through AI-assisted collaborative storytelling. Choose your grade
              level and start creating amazing stories today!
            </Text>
          </View>
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
  content: {
    padding: 20,
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
    marginBottom: 20,
  },
  settingItem: {
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  userInfo: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '500',
  },
  gradeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  gradeButton: {
    backgroundColor: '#f8f9fa',
    padding: 12,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  selectedGradeButtonText: {
    color: '#ffffff',
  },
  logoutButton: {
    backgroundColor: '#f44336',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  aboutText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginTop: 5,
  },
});

export default SettingsScreen;
