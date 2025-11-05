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
  onBack,
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

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (activeNavigation.canGoBack()) {
      activeNavigation.goBack();
    } else {
      // Fallback navigation to Home
      try {
        activeNavigation.navigate('Home');
      } catch (error) {
        console.warn('Navigation back not available:', error);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Continue Your Story</Text>
        <View style={styles.headerSpacer} />
      </View>

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
                Continue from your previously created stories in CreativeBridge
                or Story_Quest.
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

        {/* Help Section */}
        <View style={styles.helpSection}>
          <View style={styles.helpHeader}>
            <Text style={styles.helpTitle}>Need Help?</Text>
            <TouchableOpacity
              onPress={FilePickerUtils.showFileImportHelp}
              style={styles.helpButton}
            >
              <Text style={styles.helpButtonText}>ℹ️</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helpText}>
            Not sure which option to choose? Use "Import from File" if you have
            a story saved as a text file, or "My Stories" to continue from
            stories you've already created in this app.
          </Text>
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
    fontSize: 20,
    color: '#333',
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
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
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  introDescription: {
    fontSize: 16,
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
    fontSize: 28,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  optionFeatures: {
    gap: 2,
  },
  featureText: {
    fontSize: 12,
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
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '600',
  },
  helpSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  helpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  helpButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#f0f8ff',
  },
  helpButtonText: {
    fontSize: 16,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default ImportOptionsScreen;
