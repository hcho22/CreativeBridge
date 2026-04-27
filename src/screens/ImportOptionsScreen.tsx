// Import Options Screen
// Displays options for importing stories (from file or from user's story library)

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FilePickerUtils } from '../utils/filePicker';
import { PaperBackground, Watercolor } from '../components/common/storybook';
import { theme } from '../constants/theme';

// Navigation types (will need to be updated when navigation is integrated)
type ImportOptionsNavigationProp = NativeStackNavigationProp<any>;

export interface ImportOptionsScreenProps {
  navigation?: ImportOptionsNavigationProp;
  onFileImport?: (content: string, metadata?: any) => void;
  onStoryLibraryImport?: () => void;
  onBack?: () => void;
}

interface ImportCardProps {
  icon: string;
  hue: number;
  title: string;
  desc: string;
  bullets: string[];
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

const ImportCard: React.FC<ImportCardProps> = ({
  icon,
  hue,
  title,
  desc,
  bullets,
  onPress,
  loading,
  disabled,
}) => (
  <TouchableOpacity
    style={[styles.importCard, disabled && styles.importCardDisabled]}
    onPress={onPress}
    activeOpacity={disabled ? 1 : 0.85}
    disabled={disabled}
  >
    <View style={styles.importCardWatercolor}>
      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.accents.foxglove} />
      ) : (
        <Watercolor hue={hue} size={64}>
          {icon}
        </Watercolor>
      )}
    </View>
    <View style={styles.importCardBody}>
      <Text style={styles.importCardTitle}>{title}</Text>
      <Text style={styles.importCardDesc}>{desc}</Text>
      <View style={styles.bulletList}>
        {bullets.map(bullet => (
          <View key={bullet} style={styles.bulletRow}>
            <Text style={styles.bulletDiamond}>◆</Text>
            <Text style={styles.bulletText}>{bullet}</Text>
          </View>
        ))}
      </View>
    </View>
    <Text style={styles.importCardArrow}>→</Text>
  </TouchableOpacity>
);

export const ImportOptionsScreen: React.FC<ImportOptionsScreenProps> = ({
  navigation,
  onFileImport,
  onStoryLibraryImport,
  onBack: _onBack,
}) => {
  const nav = useNavigation<ImportOptionsNavigationProp>();
  const activeNavigation = navigation || nav;
  const headerHeight = useHeaderHeight();
  const [isImporting, setIsImporting] = useState(false);

  const handleFileImport = async () => {
    try {
      setIsImporting(true);

      // Use the file picker utilities
      const result = await FilePickerUtils.pickTextFile();

      if (result.cancelled) {
        // User cancelled file selection
        return;
      }

      if (!result.success) {
        Alert.alert(
          'Import Error',
          result.error || 'Failed to import file. Please try again.',
          [{ text: 'OK' }],
        );
        return;
      }

      if (result.content && onFileImport) {
        // Pass the content and metadata to the callback
        onFileImport(result.content, result.metadata);
      } else if (result.content) {
        // Navigate to story preview/edit screen
        try {
          activeNavigation.navigate('StoryPreviewEdit', {
            content: result.content,
            metadata: result.metadata,
            source: 'file',
          });
        } catch (error) {
          console.warn('Navigation to StoryPreviewEdit not configured:', error);
          Alert.alert(
            'Import Successful',
            `Story imported successfully!\n\nContent: ${result.content.substring(
              0,
              100,
            )}...`,
            [{ text: 'OK' }],
          );
        }
      }
    } catch (error) {
      console.error('Error during file import:', error);
      Alert.alert(
        'Import Error',
        'An unexpected error occurred while importing the file. Please try again.',
        [{ text: 'OK' }],
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleStoryLibraryImport = () => {
    if (onStoryLibraryImport) {
      onStoryLibraryImport();
    } else {
      // Navigate to story selection screen
      try {
        activeNavigation.navigate('StorySelection');
      } catch (error) {
        console.warn('Navigation to StorySelection not configured:', error);
        Alert.alert(
          'Coming Soon',
          'Story library import is being developed. This will allow you to continue your previously created stories.',
        );
      }
    }
  };

  return (
    <View style={[styles.container, { paddingTop: headerHeight }]}>
      <PaperBackground style={StyleSheet.absoluteFillObject} />
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.paper.base}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Header */}
        <View style={styles.heroHeader}>
          <Text style={styles.heroTitle}>Continue where you left off</Text>
          <Text style={styles.heroSubtitle}>
            Bring your old story back to life
          </Text>
        </View>

        {/* Import Cards */}
        <View style={styles.cardsList}>
          <ImportCard
            icon="📄"
            hue={200}
            title={isImporting ? 'Importing…' : 'Import from file'}
            desc="Choose a .txt file from your device to continue writing."
            bullets={[
              'Upload .txt files',
              'Maintains original formatting',
              'Quick and easy import',
            ]}
            onPress={handleFileImport}
            loading={isImporting}
            disabled={isImporting}
          />

          <ImportCard
            icon="📚"
            hue={20}
            title="My library"
            desc="Continue from your previously created stories in CreativeBridge."
            bullets={[
              'Access your story library',
              'Search and filter stories',
              'Pick up where you left off',
            ]}
            onPress={handleStoryLibraryImport}
          />
        </View>
      </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 80,
  },

  // Hero header
  heroHeader: {
    alignItems: 'center',
    marginBottom: 28,
    paddingHorizontal: 12,
  },
  heroTitle: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.ink.base,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: theme.typography.fontFamily.hand,
    fontSize: 20,
    color: theme.colors.ink.soft,
    marginTop: 6,
    textAlign: 'center',
  },

  // Cards list
  cardsList: {
    gap: 16,
  },
  importCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 18,
    padding: 20,
    borderRadius: 20,
    backgroundColor: theme.colors.paper.card,
    borderWidth: 1.5,
    borderColor: theme.colors.paper.edge,
    ...theme.shadows.paper,
  },
  importCardDisabled: {
    opacity: 0.6,
    backgroundColor: theme.colors.paper.deep,
  },
  importCardWatercolor: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importCardBody: {
    flex: 1,
  },
  importCardTitle: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.ink.base,
    letterSpacing: -0.3,
  },
  importCardDesc: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 14,
    color: theme.colors.ink.soft,
    marginTop: 4,
    lineHeight: 20,
  },
  bulletList: {
    marginTop: 10,
    gap: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDiamond: {
    fontSize: 11,
    color: theme.colors.accents.moss,
    marginTop: 2,
  },
  bulletText: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 13,
    color: theme.colors.ink.faint,
    lineHeight: 18,
    flex: 1,
  },
  importCardArrow: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 22,
    color: theme.colors.accents.foxglove,
    alignSelf: 'center',
  },
});

export default ImportOptionsScreen;
