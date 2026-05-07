import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { TabParamList } from '../navigation/AppNavigator';
import {
  pickAvatarImage,
  uploadAvatarToConvex,
} from '../services/avatarUploadService';
import {
  PaperBackground,
  Watercolor,
  WaxSeal,
  StarIcon,
  FlameIcon,
  QuillIcon,
  OrnamentRule,
} from '../components/common/storybook';
import { theme } from '../constants/theme';

type ProfileScreenNavigationProp = BottomTabNavigationProp<
  TabParamList,
  'Profile'
>;

interface ProfileScreenProps {
  navigation: ProfileScreenNavigationProp;
}

const BADGES: Array<{
  emoji: string;
  title: string;
  desc: string;
  earned: boolean;
  hue: number;
}> = [
  {
    emoji: '🥇',
    title: 'First tale',
    desc: 'Finish 1 story',
    earned: true,
    hue: 50,
  },
  {
    emoji: '🔥',
    title: 'On fire',
    desc: '3-day streak',
    earned: true,
    hue: 20,
  },
  {
    emoji: '📚',
    title: 'Bookwright',
    desc: '10 stories',
    earned: false,
    hue: 140,
  },
  {
    emoji: '🌙',
    title: 'Midnight muse',
    desc: 'Write after 10pm',
    earned: false,
    hue: 260,
  },
  {
    emoji: '🧭',
    title: 'Wayfinder',
    desc: 'Try all 6 genres',
    earned: false,
    hue: 200,
  },
  {
    emoji: '👑',
    title: 'Laureate',
    desc: 'Reach level 100',
    earned: false,
    hue: 340,
  },
];

const ProfileScreen: React.FC<ProfileScreenProps> = ({
  navigation: _navigation,
}) => {
  const { userProfile, updateProfile, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [avatarPreviewModalVisible, setAvatarPreviewModalVisible] =
    useState(false);
  const [editedDisplayName, setEditedDisplayName] = useState(
    userProfile?.display_name || '',
  );
  const [avatarUploading, setAvatarUploading] = useState(false);

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

  const handleRemoveAvatar = () => {
    Alert.alert(
      'Remove Photo',
      "Remove your profile photo? You'll go back to the default avatar.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await updateProfile({ avatar_url: '' });
              if (result.error) {
                Alert.alert('Error', 'Failed to remove profile photo');
              } else {
                await refreshProfile();
              }
            } catch (error) {
              console.error('Avatar removal error:', error);
              Alert.alert('Error', 'Failed to remove profile photo');
            }
          },
        },
      ],
    );
  };

  const handleCancelEdit = () => {
    setEditedDisplayName(userProfile?.display_name || '');
    setEditModalVisible(false);
  };

  const handlePickAvatar = async () => {
    const image = await pickAvatarImage();
    if (!image) return;

    setAvatarUploading(true);
    try {
      const result = await uploadAvatarToConvex(image.uri, image.type);
      if (!result.success) {
        Alert.alert('Upload Failed', result.error);
        return;
      }
      await updateProfile({ avatar_url: result.avatarUrl });
      await refreshProfile();
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message || 'Something went wrong');
    } finally {
      setAvatarUploading(false);
    }
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
  const totalXp = userProfile?.total_xp || 0;
  const xpRemaining = Math.max(0, nextLevelXP - totalXp);

  const displayName = userProfile?.display_name || 'Writer';
  const username = userProfile?.username || 'username';
  const avatarInitial = displayName.charAt(0).toUpperCase() || '?';

  const renderSectionTitle = (icon: string, title: string) => (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitleIcon}>{icon}</Text>
      <Text style={styles.sectionTitleText}>{title}</Text>
      <View style={styles.sectionTitleRule} />
    </View>
  );

  return (
    <View style={styles.container}>
      <PaperBackground style={StyleSheet.absoluteFillObject} />
      <ScrollView
        style={styles.scrollView}
        // eslint-disable-next-line react-native/no-inline-styles -- dynamic safe-area insets, value changes per device
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Author Card */}
        <View style={styles.authorCard}>
          <View style={styles.cornerWatercolor} pointerEvents="none">
            <Watercolor hue={30} size={140} soft />
          </View>
          <TouchableOpacity
            style={styles.authorAvatarTouch}
            activeOpacity={userProfile?.avatar_url ? 0.7 : 1}
            disabled={!userProfile?.avatar_url}
            onPress={() => setAvatarPreviewModalVisible(true)}
          >
            {userProfile?.avatar_url ? (
              <Image
                source={{ uri: userProfile.avatar_url }}
                style={styles.authorAvatarImage}
              />
            ) : (
              <View style={styles.authorAvatarFallback}>
                <Watercolor hue={30} size={88}>
                  {avatarInitial}
                </Watercolor>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.authorName}>{displayName}</Text>
          <Text style={styles.authorHandle}>@{username}</Text>

          <TouchableOpacity
            style={styles.editPill}
            onPress={handleEditProfile}
            accessibilityLabel="Edit author profile"
          >
            <QuillIcon size={14} color={theme.colors.paper.cream} />
            <Text style={styles.editPillText}>Edit author profile</Text>
          </TouchableOpacity>
        </View>

        {/* Level Progress */}
        <View style={styles.levelCard}>
          <View style={styles.levelHeaderRow}>
            <View style={styles.levelHeaderLeft}>
              <WaxSeal letter={String(level)} size={44} />
              <View style={styles.levelHeaderInfo}>
                <Text style={styles.scribeEyebrow}>Scribe level</Text>
                <Text style={styles.scribeName}>Level {level}</Text>
              </View>
            </View>
            <View style={styles.levelHeaderRight}>
              <Text style={styles.xpTotalText}>
                {totalXp.toLocaleString()} / {nextLevelXP.toLocaleString()} XP
              </Text>
              <Text style={styles.xpRemainingText}>
                {xpRemaining} XP to level {level + 1}
              </Text>
            </View>
          </View>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
        </View>

        {/* Statistics */}
        <View style={styles.section}>
          {renderSectionTitle('📊', 'Your chronicle')}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={styles.statIconRow}>
                <StarIcon size={18} color={theme.colors.accents.gold} />
              </View>
              <Text
                style={[styles.statValue, { color: theme.colors.accents.gold }]}
              >
                {totalXp.toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>Total XP</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconRow}>
                <FlameIcon size={18} />
              </View>
              <Text
                style={[
                  styles.statValue,
                  { color: theme.colors.accents.amber },
                ]}
              >
                {userProfile?.current_streak || 0}
              </Text>
              <Text style={styles.statLabel}>Day streak</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statIconText}>🏆</Text>
              <Text
                style={[
                  styles.statValue,
                  { color: theme.colors.accents.foxglove },
                ]}
              >
                {userProfile?.longest_streak || 0}
              </Text>
              <Text style={styles.statLabel}>Longest streak</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statIconText}>🎮</Text>
              <Text
                style={[
                  styles.statValue,
                  { color: theme.colors.accents.inkwell },
                ]}
              >
                {userProfile?.total_games_played || 0}
              </Text>
              <Text style={styles.statLabel}>Stories begun</Text>
            </View>
            <View style={[styles.statCard, styles.statCardHighlight]}>
              <Text style={styles.statIconText}>✒️</Text>
              <Text
                style={[styles.statValue, { color: theme.colors.accents.moss }]}
              >
                {(userProfile?.total_words_written || 0).toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>Words penned</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statIconText}>🎯</Text>
              <Text
                style={[styles.statValue, { color: theme.colors.accents.plum }]}
              >
                {(userProfile?.best_score || 0).toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>Best score</Text>
            </View>
          </View>
        </View>

        {/* Badges */}
        <View style={styles.section}>
          {renderSectionTitle('🏅', 'Badges earned')}
          <View style={styles.badgesGrid}>
            {BADGES.map(badge => (
              <View
                key={badge.title}
                style={[
                  styles.badge,
                  badge.earned ? styles.badgeEarned : styles.badgeLocked,
                ]}
              >
                <View
                  style={[
                    styles.badgeEmojiCircle,
                    badge.earned
                      ? styles.badgeEmojiEarned
                      : styles.badgeEmojiLocked,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeEmoji,
                      !badge.earned && styles.badgeEmojiGrayed,
                    ]}
                  >
                    {badge.emoji}
                  </Text>
                </View>
                <View style={styles.badgeTextWrap}>
                  <Text style={styles.badgeTitle} numberOfLines={1}>
                    {badge.title}
                  </Text>
                  <Text style={styles.badgeDesc} numberOfLines={1}>
                    {badge.desc}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          {renderSectionTitle('🎛️', 'Preferences')}
          <View style={styles.preferencesCard}>
            <View style={styles.preferenceRow}>
              <Text style={styles.preferenceLabel}>Reading level</Text>
              <Text style={styles.preferenceValue}>
                {getGradeDescription(
                  userProfile?.preferred_grade_level || 'K-2',
                )}
              </Text>
            </View>
            <View style={[styles.preferenceRow, styles.preferenceRowLast]}>
              <Text style={styles.preferenceLabel}>Speech features</Text>
              <Text
                style={[
                  styles.preferenceValue,
                  {
                    color: userProfile?.speech_enabled
                      ? theme.colors.accents.moss
                      : theme.colors.accents.foxglove,
                  },
                ]}
              >
                {userProfile?.speech_enabled ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.ornamentWrap}>
          <OrnamentRule width={180} />
        </View>
      </ScrollView>

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
              <Text style={styles.modalTitle}>Edit profile</Text>

              <TouchableOpacity
                style={styles.modalAvatarContainer}
                onPress={handlePickAvatar}
                disabled={avatarUploading}
                activeOpacity={0.7}
              >
                <View style={styles.modalAvatarWrapper}>
                  {userProfile?.avatar_url ? (
                    <Image
                      source={{ uri: userProfile.avatar_url }}
                      style={styles.modalAvatarImage}
                    />
                  ) : (
                    <View style={styles.modalAvatar}>
                      <Watercolor hue={30} size={100}>
                        {avatarInitial}
                      </Watercolor>
                    </View>
                  )}
                  <View style={styles.cameraOverlay}>
                    <Text style={styles.cameraOverlayText}>📷</Text>
                  </View>
                  {avatarUploading && (
                    <View style={styles.avatarLoadingOverlay}>
                      <ActivityIndicator
                        size="large"
                        color={theme.colors.paper.cream}
                      />
                    </View>
                  )}
                </View>
                <Text style={styles.changePhotoText}>Change photo</Text>
              </TouchableOpacity>

              {userProfile?.avatar_url ? (
                <TouchableOpacity onPress={handleRemoveAvatar}>
                  <Text style={styles.removePhotoText}>Remove photo</Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Display name</Text>
                <TextInput
                  style={styles.textInput}
                  value={editedDisplayName}
                  onChangeText={setEditedDisplayName}
                  placeholder="Enter your display name"
                  placeholderTextColor={theme.colors.ink.faint}
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

      {/* Avatar Preview Modal */}
      <Modal
        visible={avatarPreviewModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setAvatarPreviewModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.avatarPreviewOverlay}
          activeOpacity={1}
          onPress={() => setAvatarPreviewModalVisible(false)}
        >
          {userProfile?.avatar_url && (
            <Image
              source={{ uri: userProfile.avatar_url }}
              style={styles.avatarPreviewImage}
            />
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.paper.base,
  },
  scrollView: {
    flex: 1,
  },

  // Author card
  authorCard: {
    backgroundColor: theme.colors.paper.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
    padding: 22,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 18,
    ...theme.shadows.card,
  },
  cornerWatercolor: {
    position: 'absolute',
    top: -30,
    right: -30,
    opacity: 0.15,
  },
  authorAvatarTouch: {
    marginBottom: 12,
  },
  authorAvatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: theme.colors.paper.edge,
  },
  authorAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorAvatarInitial: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 36,
    color: theme.colors.paper.cream,
    textAlign: 'center',
  },
  authorName: {
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontSize: 28,
    fontStyle: 'italic',
    color: theme.colors.ink.base,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  authorHandle: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 13,
    color: theme.colors.ink.faint,
    marginBottom: 14,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.accents.foxglove,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    ...theme.shadows.sm,
  },
  editPillText: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontSize: 13,
    color: theme.colors.paper.cream,
    fontWeight: '600',
  },

  // Level card
  levelCard: {
    backgroundColor: theme.colors.paper.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
    padding: 20,
    marginBottom: 18,
    ...theme.shadows.paper,
  },
  levelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  levelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  levelHeaderInfo: {
    flexShrink: 1,
  },
  scribeEyebrow: {
    fontFamily: theme.typography.fontFamily.uiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: theme.colors.ink.faint,
    textTransform: 'uppercase',
  },
  scribeName: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 22,
    color: theme.colors.ink.base,
    letterSpacing: -0.3,
  },
  levelHeaderRight: {
    alignItems: 'flex-end',
  },
  xpTotalText: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 18,
    color: theme.colors.accents.moss,
  },
  xpRemainingText: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 11,
    color: theme.colors.ink.faint,
    marginTop: 2,
  },
  progressBarTrack: {
    height: 14,
    borderRadius: 10,
    backgroundColor: theme.colors.paper.deep,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.accents.moss,
  },

  // Section primitive
  section: {
    marginBottom: 18,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingLeft: 4,
  },
  sectionTitleIcon: {
    fontSize: 16,
  },
  sectionTitleText: {
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontSize: 18,
    fontStyle: 'italic',
    color: theme.colors.ink.base,
  },
  sectionTitleRule: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.paper.edge,
    marginLeft: 6,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '31.5%',
    padding: 14,
    borderRadius: 14,
    backgroundColor: theme.colors.paper.card,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
  },
  statCardHighlight: {
    backgroundColor: theme.colors.paper.cardWarm,
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statIconText: {
    fontSize: 14,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 22,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontFamily: theme.typography.fontFamily.uiMedium,
    fontSize: 11,
    color: theme.colors.ink.faint,
    marginTop: 2,
  },

  // Badges grid
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  badge: {
    width: '47.5%',
    padding: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badgeEarned: {
    backgroundColor: theme.colors.paper.card,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
  },
  badgeLocked: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.paper.edge,
    opacity: 0.7,
  },
  badgeEmojiCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmojiEarned: {
    backgroundColor: theme.colors.paper.deep,
    ...theme.shadows.sm,
  },
  badgeEmojiLocked: {
    backgroundColor: theme.colors.paper.deep,
    opacity: 0.6,
  },
  badgeEmoji: {
    fontSize: 20,
  },
  badgeEmojiGrayed: {
    opacity: 0.5,
  },
  badgeTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  badgeTitle: {
    fontFamily: theme.typography.fontFamily.uiBold,
    fontSize: 13,
    color: theme.colors.ink.base,
    fontWeight: '700',
  },
  badgeDesc: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 10,
    color: theme.colors.ink.faint,
    marginTop: 1,
  },

  // Preferences card
  preferencesCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: theme.colors.paper.card,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.paper.edge,
  },
  preferenceRowLast: {
    borderBottomWidth: 0,
  },
  preferenceLabel: {
    fontFamily: theme.typography.fontFamily.uiMedium,
    fontSize: 14,
    color: theme.colors.ink.soft,
    fontWeight: '500',
  },
  preferenceValue: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontSize: 14,
    color: theme.colors.ink.base,
    fontWeight: '600',
  },

  ornamentWrap: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },

  // Edit modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(43, 29, 20, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 420,
  },
  modalContent: {
    backgroundColor: theme.colors.paper.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
    padding: 24,
    ...theme.shadows.lift,
  },
  modalTitle: {
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontSize: 24,
    fontStyle: 'italic',
    color: theme.colors.ink.base,
    marginBottom: 18,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontSize: 14,
    color: theme.colors.ink.soft,
    marginBottom: 6,
    fontWeight: '600',
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
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 6,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.paper.cream,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
  },
  saveButton: {
    backgroundColor: theme.colors.accents.foxglove,
    ...theme.shadows.sm,
  },
  cancelButtonText: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    color: theme.colors.ink.soft,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    color: theme.colors.paper.cream,
    fontSize: 16,
    fontWeight: '600',
  },

  // Modal avatar
  modalAvatarContainer: {
    alignSelf: 'center',
    marginBottom: 12,
    alignItems: 'center',
  },
  modalAvatarWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    position: 'relative',
  },
  modalAvatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  modalAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarText: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 42,
    color: theme.colors.paper.cream,
    textAlign: 'center',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: 'rgba(43, 29, 20, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
  },
  cameraOverlayText: {
    fontSize: 16,
  },
  changePhotoText: {
    fontFamily: theme.typography.fontFamily.uiMedium,
    fontSize: 13,
    color: theme.colors.accents.foxglove,
    textAlign: 'center',
    marginTop: 6,
  },
  removePhotoText: {
    fontFamily: theme.typography.fontFamily.uiMedium,
    fontSize: 13,
    color: theme.colors.error,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 50,
    backgroundColor: 'rgba(43, 29, 20, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Avatar preview modal
  avatarPreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(43, 29, 20, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPreviewImage: {
    width: 250,
    height: 250,
    borderRadius: 125,
  },
});

export default React.memo(ProfileScreen);
