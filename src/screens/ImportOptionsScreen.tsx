// Import Options Screen
// Displays options for importing stories (from file or from user's story library)

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FilePickerUtils } from '../utils/filePicker';

// Navigation types (will need to be updated when navigation is integrated)
type ImportOptionsNavigationProp = NativeStackNavigationProp<any>;

export interface ImportOptionsScreenProps {
  navigation?: ImportOptionsNavigationProp;
  onFileImport?: (content: string, metadata?: any) => void;
  onStoryLibraryImport?: () => void;
  onBack?: () => void;
}

export const ImportOptionsScreen: React.FC<ImportOptionsScreenProps> = ({
  navigation,
  onFileImport,
  onStoryLibraryImport,
  onBack: _onBack,
}) => {
  const nav = useNavigation<ImportOptionsNavigationProp>();
  const activeNavigation = navigation || nav;
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

  // Removed handleBack function - back button was removed from the header

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />

      {/* Main Content */}
      <View style={styles.content}>
        <View style={styles.introSection}>
          <Text style={styles.introTitle}>Choose how to continue</Text>
          <Text style={styles.introDescription}>
            Select an option below to import a story and continue writing with
            AI assistance.
          </Text>
        </View>

        {/* Import Options */}
        <View style={styles.optionsContainer}>
          {/* File Import Option */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              isImporting && styles.optionCardDisabled,
            ]}
            onPress={handleFileImport}
            activeOpacity={isImporting ? 1 : 0.7}
            disabled={isImporting}
          >
            <View style={styles.optionIconContainer}>
              {isImporting ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Text style={styles.optionIcon}>📄</Text>
              )}
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>
                {isImporting ? 'Importing...' : 'Import from File'}
              </Text>
              <Text style={styles.optionDescription}>
                Choose a .txt file from your device to continue writing. Perfect
                for stories you've written elsewhere.
              </Text>
              <View style={styles.optionFeatures}>
                <Text style={styles.featureText}>• Upload .txt files</Text>
                <Text style={styles.featureText}>
                  • Maintains original formatting
                </Text>
                <Text style={styles.featureText}>• Quick and easy import</Text>
              </View>
            </View>
            <View style={styles.optionArrow}>
              {!isImporting && <Text style={styles.arrowText}>→</Text>}
            </View>
          </TouchableOpacity>

          {/* Story Library Option */}
          <TouchableOpacity
            style={styles.optionCard}
            onPress={handleStoryLibraryImport}
            activeOpacity={0.7}
          >
            <View style={styles.optionIconContainer}>
              <Text style={styles.optionIcon}>📚</Text>
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>My Stories</Text>
              <Text style={styles.optionDescription}>
                Continue from your previously created stories in CreativeBridge.
              </Text>
              <View style={styles.optionFeatures}>
                <Text style={styles.featureText}>
                  • Access your story library
                </Text>
                <Text style={styles.featureText}>
                  • Search and filter stories
                </Text>
                <Text style={styles.featureText}>
                  • Pick up where you left off
                </Text>
              </View>
            </View>
            <View style={styles.optionArrow}>
              <Text style={styles.arrowText}>→</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  backButtonText: {
    fontSize: 22,
    color: '#333',
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  headerSpacer: {
    width: 36, // Match back button width
  },
  content: {
    flex: 1,
    padding: 20,
  },
  introSection: {
    marginBottom: 32,
    alignItems: 'center',
  },
  introTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  introDescription: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  optionsContainer: {
    flex: 1,
    gap: 20,
  },
  optionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  optionCardDisabled: {
    opacity: 0.6,
    backgroundColor: '#f8f8f8',
  },
  optionIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionIcon: {
    fontSize: 30,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  optionFeatures: {
    gap: 2,
  },
  featureText: {
    fontSize: 14,
    color: '#888',
    lineHeight: 16,
  },
  optionArrow: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  arrowText: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default ImportOptionsScreen;
