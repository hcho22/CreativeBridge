import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AdaptiveGlassBackground } from './AdaptiveGlassBackground';
import StoryImageDisplay from './StoryImageDisplay';

export interface ImageDisplayModalProps {
  visible: boolean;
  onClose: () => void;
  onBackToOptions: () => void;
  replicateUrl?: string;
  supabaseUrl?: string;
  uploadStatus?: 'pending' | 'uploaded' | 'failed';
  storyTitle: string;
  sessionId: string;
  userId: string;
  onRetryUpload?: () => void;
  onImageSaved?: (localPath: string) => void;
  onError?: (error: string) => void;
}

export function ImageDisplayModal({
  visible,
  onClose,
  onBackToOptions,
  replicateUrl,
  supabaseUrl,
  uploadStatus,
  storyTitle,
  sessionId,
  userId,
  onRetryUpload,
  onImageSaved,
  onError,
}: ImageDisplayModalProps) {
  if (!visible) {
    return null;
  }

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <AdaptiveGlassBackground
        glassStyle="clear"
        fallbackBlurIntensity={20}
        fallbackBlurTint="dark"
        androidFallbackColor="rgba(0,0,0,0.5)"
      />
      <Pressable style={styles.contentArea} onPress={e => e?.stopPropagation()}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <StoryImageDisplay
              replicateUrl={replicateUrl}
              supabaseUrl={supabaseUrl}
              uploadStatus={uploadStatus}
              storyTitle={storyTitle}
              sessionId={sessionId}
              userId={userId}
              onRetryUpload={onRetryUpload}
              onImageSaved={onImageSaved}
              onError={onError}
              onBackToOptions={onBackToOptions}
              showBackButton={true}
              displayMode="responsive"
              enableFullScreen={false}
            />
          </View>
        </ScrollView>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1001,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 0,
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
    borderWidth: 3,
    borderColor: '#9C27B0',
  },
});
