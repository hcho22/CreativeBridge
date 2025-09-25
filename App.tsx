import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { supabase } from './src/services/supabase';

type GradeLevel = 'K-2' | '3-5' | '6-8' | '9-12';

interface UserStory {
  id: number;
  story: string;
  created_at: string;
  grade_level: string;
  points: number;
}

// Helper function to validate email
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper function to validate password
const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};

// User profile data structure
interface UserProfile {
  username: string;
  displayName: string;
  preferredGradeLevel: string;
  totalXP: number;
  currentStreak: number;
  longestStreak: number;
  gamesPlayed: number;
  wordsWritten: number;
  bestScore: number;
}

// ProfileModal component
const ProfileModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onLogout: () => void;
  userProfile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void;
}> = ({ visible, onClose, onLogout, userProfile, onSaveProfile }) => {
  const [displayName, setDisplayName] = useState(userProfile.displayName);

  // Update displayName when userProfile changes
  React.useEffect(() => {
    setDisplayName(userProfile.displayName);
  }, [userProfile.displayName]);


  const handleSave = () => {
    const updatedProfile = {
      ...userProfile,
      displayName,
    };
    onSaveProfile(updatedProfile);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.profileIcon}>
              <Text style={styles.profileIconText}>👤</Text>
            </View>
            <Text style={styles.modalTitle}>Profile Management</Text>
          </View>

          <ScrollView 
            style={styles.modalContent}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={true}
          >
            <View style={styles.profileSection}>
              <Text style={styles.profileLabel}>Username:</Text>
              <Text style={styles.profileValue}>{userProfile.username}</Text>
            </View>


            <View style={styles.profileSection}>
              <Text style={styles.profileLabel}>Display Name:</Text>
              <TextInput
                style={styles.profileInput}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter display name"
              />
            </View>


            <Text style={styles.statsTitle}>Game Statistics</Text>
            
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statIcon}>🌟</Text>
                <Text style={styles.statLabel}>Total XP</Text>
                <Text style={styles.statValue}>{userProfile.totalXP}</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statIcon}>🔥</Text>
                <Text style={styles.statLabel}>Current Streak</Text>
                <Text style={styles.statValue}>{userProfile.currentStreak} days</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statIcon}>🏆</Text>
                <Text style={styles.statLabel}>Longest Streak</Text>
                <Text style={styles.statValue}>{userProfile.longestStreak} days</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statIcon}>🎮</Text>
                <Text style={styles.statLabel}>Games Played</Text>
                <Text style={styles.statValue}>{userProfile.gamesPlayed}</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statIcon}>✍️</Text>
                <Text style={styles.statLabel}>Words Written</Text>
                <Text style={styles.statValue}>{userProfile.wordsWritten}</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statIcon}>🎯</Text>
                <Text style={styles.statLabel}>Best Score</Text>
                <Text style={styles.statValue}>{userProfile.bestScore}</Text>
              </View>
            </View>
          </ScrollView>
          
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonIcon}>💾</Text>
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            

            <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

// LoginScreen component moved outside to prevent re-creation on each render
const LoginScreen: React.FC<{
  email: string;
  password: string;
  onEmailChange: (text: string) => void;
  onPasswordChange: (text: string) => void;
  onLogin: () => void;
  onSignUp: () => void;
  onGoogleLogin: () => void;
  onForgotPassword: () => void;
  emailInputRef: React.RefObject<TextInput | null>;
  passwordInputRef: React.RefObject<TextInput | null>;
}> = ({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onLogin,
  onSignUp,
  onGoogleLogin,
  onForgotPassword,
  emailInputRef,
  passwordInputRef,
}) => {
  const focusPasswordInput = () => {
    passwordInputRef.current?.focus();
  };

  return (
    <KeyboardAvoidingView 
      style={styles.loginContainer} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        style={styles.loginContainer} 
        contentContainerStyle={styles.loginContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.loginHeader}>
          <Text style={styles.logoText}>CreativeBridge</Text>
          <Text style={styles.subtitle}>Please log in or sign up to play</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Login / Sign Up</Text>
          
          <TextInput
            ref={emailInputRef}
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={onEmailChange}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={focusPasswordInput}
          />
          
          <TextInput
            ref={passwordInputRef}
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={onPasswordChange}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            returnKeyType="done"
          />
          
          <Text style={styles.passwordHint}>Password must be at least 6 characters long</Text>
          
          <TouchableOpacity style={styles.loginButton} onPress={onLogin}>
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.signUpButton} onPress={onSignUp}>
            <Text style={styles.buttonText}>Sign Up</Text>
          </TouchableOpacity>
          
          <Text style={styles.orText}>or</Text>
          
          <TouchableOpacity style={styles.googleButton} onPress={onGoogleLogin}>
            <Text style={styles.googleButtonText}>G Continue with Google</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={onForgotPassword}>
            <Text style={styles.forgotPassword}>Forgot your password?</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const AppContent: React.FC = () => {
  const { session, userProfile, signIn, signUp, signOut, updateProfile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'Home' | 'Profile'>('Home');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('K-2');
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [showGradePicker, setShowGradePicker] = useState(false);
  const [showStoriesList, setShowStoriesList] = useState(false);
  const [userStories, setUserStories] = useState<UserStory[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const isLoggedIn = !!session?.user;
  
  // Convert AuthContext UserProfile to App UserProfile format
  console.log('App.tsx - userProfile from AuthContext:', userProfile);
  console.log('App.tsx - session user:', session?.user?.email);
  
  const appUserProfile: UserProfile = {
    username: userProfile?.username || 'user',
    displayName: userProfile?.display_name || 'User',
    preferredGradeLevel: userProfile?.preferred_grade_level || 'K-2',
    totalXP: userProfile?.total_xp || 0,
    currentStreak: userProfile?.current_streak || 0,
    longestStreak: userProfile?.longest_streak || 0,
    gamesPlayed: userProfile?.total_games_played || 0,
    wordsWritten: userProfile?.total_words_written || 0,
    bestScore: userProfile?.best_score || 0,
  };
  
  console.log('App.tsx - appUserProfile:', appUserProfile);
  



  const handleTabPress = async (tab: 'Home' | 'Profile') => {
    setActiveTab(tab);
    if (tab === 'Profile') {
      setShowProfileModal(true);
      // Refresh profile data when opening profile modal
      await refreshProfile();
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      // Clear form fields
      setEmail('');
      setPassword('');
      setActiveTab('Home');
      setShowProfileModal(false);
      Alert.alert('Logged Out', 'You have been successfully logged out.');
    } catch (error) {
      console.error('Unexpected logout error:', error);
      Alert.alert('Error', 'Unexpected error during logout. Please try again.');
    }
  };

  const handleSaveProfile = async (updatedProfile: UserProfile) => {
    try {
      // Convert from App's UserProfile format to AuthContext's UserProfile format
      const result = await updateProfile({
        username: updatedProfile.username,
        display_name: updatedProfile.displayName,
        preferred_grade_level: updatedProfile.preferredGradeLevel,
        total_xp: updatedProfile.totalXP,
        current_streak: updatedProfile.currentStreak,
        longest_streak: updatedProfile.longestStreak,
      });

      if (result.error) {
        Alert.alert('Error', 'Failed to save profile: ' + result.error);
        return;
      }

      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Profile save error:', error);
      Alert.alert('Error', 'An unexpected error occurred while saving profile.');
    }
  };

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (!isValidEmail(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    if (!password) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }
    if (!isValidPassword(password)) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }
    
    try {
      const result = await signIn(email.trim(), password);
      
      if (result.error) {
        // Handle specific error cases
        if (result.error.includes('Invalid login credentials') ||
            result.error.includes('Invalid email or password')) {
          Alert.alert('Error', 'Invalid email or password. Please check your credentials and try again.');
        } else if (result.error.includes('Email not confirmed') ||
                   result.error.includes('not confirmed')) {
          Alert.alert('Error', 'Please check your email and click the confirmation link to activate your account before logging in.');
        } else if (result.error.includes('Too many requests')) {
          Alert.alert('Error', 'Too many login attempts. Please wait a moment before trying again.');
        } else if (result.error.includes('User not found') ||
                   result.error.includes('does not exist')) {
          Alert.alert('Error', 'No account found with this email address. Please sign up to create a new account.');
        } else {
          Alert.alert('Error', 'Error logging in: ' + result.error);
        }
        return;
      }
      
      Alert.alert('Success', 'Logged in successfully!');
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const handleSignUp = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (!isValidEmail(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    if (!password) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }
    if (!isValidPassword(password)) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }
    
    try {
      const result = await signUp(email.trim(), password);
      
      if (result.error) {
        // Handle specific error cases
        const errMsg = result.error.toLowerCase();
        if (errMsg.includes('user already registered') || 
            errMsg.includes('already been registered') ||
            errMsg.includes('already exists') ||
            errMsg.includes('email address is already registered')) {
          Alert.alert('Error', 'An account with this email already exists. Please log in instead.');
        } else if (errMsg.includes('password should be at least') ||
                   errMsg.includes('password')) {
          Alert.alert('Error', 'Password is too weak. Please choose a stronger password (at least 6 characters).');
        } else {
          Alert.alert('Error', 'Error creating account: ' + result.error);
        }
        return;
      }
      
      Alert.alert('Success', 'Account created successfully!');
    } catch (error) {
      console.error('Signup error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const handleGoogleLogin = () => {
    Alert.alert('Google Login', 'Google authentication would be implemented here');
    // Google login would use the signIn method from AuthContext
  };

  const handleForgotPassword = () => {
    Alert.alert('Forgot Password', 'Password reset functionality would be implemented here');
  };

  const handleImportFromDatabase = async () => {
    setStoriesLoading(true);
    setShowStoriesList(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Login Required', 'Please log in to view your stories.');
        setShowStoriesList(false);
        return;
      }

      // Fetch stories for this user
      const { data: stories, error } = await supabase
        .from('scores')
        .select('id, story, created_at, grade_level, points')
        .eq('player_email', user.email)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      if (!stories || stories.length === 0) {
        Alert.alert('No Stories Found', 'You don\'t have any saved stories yet.');
        setShowStoriesList(false);
        return;
      }

      setUserStories(stories);
    } catch (error) {
      console.error('Error fetching user stories:', error);
      Alert.alert('Error', 'Failed to load your stories. Please try again later.');
      setShowStoriesList(false);
    } finally {
      setStoriesLoading(false);
    }
  };

  const handleSelectStory = (story: UserStory) => {
    Alert.alert(
      'Story Selected', 
      `You selected: ${story.story.slice(0, 100)}...\n\nThis would load the story for continuation.`
    );
    setShowStoriesList(false);
  };

  const handleUploadTextFile = () => {
    Alert.alert('Upload Text File', 'File upload functionality coming soon! This will allow you to select and upload text files from your device.');
  };

  const handleStartNewGame = () => {
    Alert.alert('Start Game', 'Game functionality coming soon!');
  };




  const handleEmailChange = useCallback((text: string) => {
    setEmail(text);
  }, []);

  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text);
  }, []);

  if (!isLoggedIn) {
    return (
      <View style={styles.container}>
        <StatusBar hidden={true} />
        <LoginScreen 
          email={email}
          password={password}
          onEmailChange={handleEmailChange}
          onPasswordChange={handlePasswordChange}
          onLogin={handleLogin}
          onSignUp={handleSignUp}
          onGoogleLogin={handleGoogleLogin}
          onForgotPassword={handleForgotPassword}
          emailInputRef={emailInputRef}
          passwordInputRef={passwordInputRef}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />
      <ProfileModal
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onLogout={handleLogout}
        userProfile={appUserProfile}
        onSaveProfile={handleSaveProfile}
      />
      <View style={styles.gradient}>
        {/* Main content area */}
        <ScrollView style={styles.mainContent} contentContainerStyle={styles.mainContentContainer}>
          {/* Game Settings Section */}
          <View style={styles.settingsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>🎮</Text>
              <Text style={styles.sectionTitle}>Game Settings</Text>
            </View>
            
            {/* Grade Level Dropdown */}
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => setShowGradePicker(true)}
            >
              <Text style={styles.dropdownText}>{gradeLevel}</Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>

          </View>

          {/* Speech Settings Section */}
          <View style={styles.settingsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>🎤</Text>
              <Text style={styles.sectionTitle}>Speech Settings</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.speechToggle}
              onPress={() => setSpeechEnabled(!speechEnabled)}
            >
              <Text style={styles.speechToggleIcon}>{speechEnabled ? '🔊' : '🔇'}</Text>
              <Text style={styles.speechToggleText}>Speech: {speechEnabled ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
            
            <Text style={styles.speechHint}>Press Alt+S to toggle speech quickly | Uses ElevenLabs Voice AI when enabled</Text>
          </View>

          {/* Continue Story Section */}
          <View style={styles.settingsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>📖</Text>
              <Text style={styles.sectionTitle}>Continue Story</Text>
            </View>
            
            <View style={styles.storyButtonsContainer}>
              <TouchableOpacity style={styles.storyButton} onPress={handleImportFromDatabase}>
                <Text style={styles.storyButtonText}>Import from My Stories</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.storyButton} onPress={handleUploadTextFile}>
                <Text style={styles.storyButtonText}>Upload Story File</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Start Game Section */}
          <View style={styles.startGameSection}>
            <TouchableOpacity style={styles.startGameButton} onPress={handleStartNewGame}>
              <Text style={styles.startGameIcon}>🎮</Text>
              <Text style={styles.startGameText}>Start Game</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Grade Level Picker Modal */}
        <Modal visible={showGradePicker} transparent={true} animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.pickerModal}>
              <Text style={styles.pickerTitle}>Select Grade Level</Text>
              {(['K-2', '3-5', '6-8', '9-12'] as GradeLevel[]).map((grade) => (
                <TouchableOpacity
                  key={grade}
                  style={[styles.gradeOption, gradeLevel === grade && styles.selectedGrade]}
                  onPress={() => {
                    setGradeLevel(grade);
                    setShowGradePicker(false);
                  }}
                >
                  <Text style={[styles.gradeOptionText, gradeLevel === grade && styles.selectedGradeText]}>
                    {grade}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowGradePicker(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>


        {/* Stories List Modal */}
        <Modal visible={showStoriesList} transparent={true} animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.storiesModal}>
              <View style={styles.storiesHeader}>
                <Text style={styles.pickerTitle}>Your Stories</Text>
                <TouchableOpacity 
                  style={styles.closeButton} 
                  onPress={() => setShowStoriesList(false)}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              {storiesLoading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading your stories...</Text>
                </View>
              ) : (
                <ScrollView style={styles.storiesScrollView}>
                  {userStories.map((story) => (
                    <TouchableOpacity
                      key={story.id}
                      style={styles.storyItem}
                      onPress={() => handleSelectStory(story)}
                    >
                      <View style={styles.storyHeader}>
                        <Text style={styles.storyGradeLevel}>{story.grade_level}</Text>
                        <Text style={styles.storyDate}>
                          {new Date(story.created_at).toLocaleDateString()} | {story.points} pts
                        </Text>
                      </View>
                      <Text style={styles.storyPreview}>
                        {story.story.slice(0, 150)}{story.story.length > 150 ? '...' : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* Footer Tab Bar */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'Home' && styles.activeTab]}
            onPress={() => handleTabPress('Home')}
            activeOpacity={0.7}
          >
            <Text style={styles.tabIcon}>🏠</Text>
            <Text style={[styles.tabLabel, activeTab === 'Home' && styles.activeTabLabel]}>
              Home
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'Profile' && styles.activeTab]}
            onPress={() => handleTabPress('Profile')}
            activeOpacity={0.7}
          >
            <Text style={styles.tabIcon}>👤</Text>
            <Text style={[styles.tabLabel, activeTab === 'Profile' && styles.activeTabLabel]}>
              Profile
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// const { width, height } = Dimensions.get('screen');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8B9DC3',
  },
  gradient: {
    flex: 1,
    backgroundColor: '#8B9DC3',
    paddingHorizontal: 20,
  },
  mainContent: {
    flex: 1,
    paddingTop: 20,
  },
  mainContentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  settingsSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  dropdownButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  dropdownText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '500',
  },
  dropdownArrow: {
    fontSize: 14,
    color: 'white',
  },
  startGameSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  startGameButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 15,
    padding: 20,
    minWidth: 200,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  startGameIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  startGameText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  speechToggle: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  speechToggleIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  speechToggleText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '500',
  },
  speechHint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontStyle: 'italic',
  },
  storyButtonsContainer: {
    gap: 10,
  },
  storyButton: {
    backgroundColor: '#2196F3',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  storyButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  pickerModal: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    margin: 40,
    maxHeight: '80%',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  gradeOption: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    alignItems: 'center',
  },
  selectedGrade: {
    backgroundColor: '#8B9DC3',
  },
  gradeOptionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  selectedGradeText: {
    color: 'white',
    fontWeight: '600',
  },
  storiesModal: {
    backgroundColor: 'white',
    borderRadius: 15,
    margin: 20,
    maxHeight: '80%',
    minHeight: 400,
  },
  storiesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  storiesScrollView: {
    flex: 1,
    padding: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  storyItem: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 2,
  },
  storyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  storyGradeLevel: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  storyDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  storyPreview: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.95)',
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: 'rgba(139, 157, 195, 0.2)',
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  activeTabLabel: {
    color: '#8B9DC3',
    fontWeight: '600',
  },
  // Login Screen Styles
  loginContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loginContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  loginHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    color: '#333',
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 50,
    textAlignVertical: 'center',
  },
  passwordHint: {
    fontSize: 12,
    color: '#999',
    marginBottom: 20,
    marginTop: -8,
  },
  loginButton: {
    backgroundColor: '#28a745',
    borderRadius: 8,
    paddingVertical: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  signUpButton: {
    backgroundColor: '#28a745',
    borderRadius: 8,
    paddingVertical: 14,
    marginBottom: 20,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  orText: {
    textAlign: 'center',
    color: '#999',
    marginBottom: 20,
    fontSize: 14,
  },
  googleButton: {
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 14,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  forgotPassword: {
    textAlign: 'center',
    color: '#007bff',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  // Profile Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    margin: 20,
    maxHeight: '95%',
    width: '95%',
    maxWidth: 700,
    minHeight: 600,
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 15,
    padding: 10,
    zIndex: 1,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#999',
    fontWeight: '600',
  },
  profileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  profileIconText: {
    fontSize: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    padding: 20,
    paddingBottom: 0,
  },
  modalScrollContent: {
    paddingBottom: 80,
    flexGrow: 1,
  },
  profileSection: {
    marginBottom: 20,
  },
  profileLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  profileValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  profileInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  gradeDropdown: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  gradeText: {
    fontSize: 16,
    color: '#333',
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 50,
  },
  statItem: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  modalActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: 'white',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  saveButton: {
    backgroundColor: '#28a745',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  saveButtonIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#dc3545',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;