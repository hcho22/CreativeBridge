/**
 * Celebration Modal Component (US-003)
 * Reusable modal for celebrating user achievements throughout the app.
 * Used for first story completion, first illustration, first streak, etc.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import { AdaptiveGlassBackground } from './AdaptiveGlassBackground';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Confetti particle configuration — storybook accent palette
const CONFETTI_COUNT = 50;
const CONFETTI_COLORS = [
  '#C2410C', // foxglove
  '#3F6A3A', // moss
  '#1E3A5F', // inkwell
  '#B8860B', // gold
  '#7A3B5C', // plum
  '#D97706', // amber
  '#FBF5E6', // paper-cream
  '#5C4432', // ink-soft
];

interface ConfettiPiece {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  rotation: Animated.Value;
  initialX: number; // Store initial X for animation calculation
  color: string;
  size: number;
  shape: 'square' | 'circle' | 'rectangle';
}

interface CelebrationModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Title text displayed prominently */
  title: string;
  /** Supporting message below the title */
  message: string;
  /** Emoji or icon to display (string emoji or React node) */
  icon?: string | React.ReactNode;
  /** Text for the primary call-to-action button */
  ctaText?: string;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when CTA button is pressed */
  onCtaPress?: () => void;
  /** Whether the modal can be dismissed by tapping outside (default: true) */
  dismissible?: boolean;
  /** Optional secondary message (e.g., XP earned) */
  secondaryMessage?: string;
}

export const CelebrationModal: React.FC<CelebrationModalProps> = ({
  visible,
  title,
  message,
  icon = '🎉',
  ctaText = 'Awesome!',
  onClose,
  onCtaPress,
  dismissible = true,
  secondaryMessage,
}) => {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Initialize confetti pieces
  useEffect(() => {
    if (visible) {
      const pieces: ConfettiPiece[] = [];
      for (let i = 0; i < CONFETTI_COUNT; i++) {
        const initialX = Math.random() * SCREEN_WIDTH;
        pieces.push({
          id: i,
          x: new Animated.Value(initialX),
          y: new Animated.Value(-50),
          rotation: new Animated.Value(0),
          initialX,
          color:
            CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          size: Math.random() * 8 + 6,
          shape: (['square', 'circle', 'rectangle'] as const)[
            Math.floor(Math.random() * 3)
          ],
        });
      }
      setConfetti(pieces);

      // Animate modal appearance
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: theme.animation.normal,
          useNativeDriver: true,
        }),
      ]).start();

      // Start confetti animation
      pieces.forEach((piece, index) => {
        const delay = index * 30;
        const duration = 2000 + Math.random() * 1000;

        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(piece.y, {
              toValue: SCREEN_HEIGHT + 50,
              duration,
              useNativeDriver: true,
            }),
            Animated.timing(piece.x, {
              toValue: piece.initialX + (Math.random() - 0.5) * 200,
              duration,
              useNativeDriver: true,
            }),
            Animated.timing(piece.rotation, {
              toValue: Math.random() * 10,
              duration,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      });
    } else {
      // Reset animations when modal closes
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      setConfetti([]);
    }
  }, [visible, scaleAnim, opacityAnim]);

  const handleCtaPress = () => {
    if (onCtaPress) {
      onCtaPress();
    } else {
      onClose();
    }
  };

  const handleBackdropPress = () => {
    if (dismissible) {
      onClose();
    }
  };

  const renderConfettiPiece = (piece: ConfettiPiece) => {
    const rotateInterpolate = piece.rotation.interpolate({
      inputRange: [0, 10],
      outputRange: ['0deg', '360deg'],
    });

    const pieceStyle = {
      position: 'absolute' as const,
      width: piece.shape === 'rectangle' ? piece.size * 1.5 : piece.size,
      height: piece.shape === 'rectangle' ? piece.size * 0.6 : piece.size,
      backgroundColor: piece.color,
      borderRadius: piece.shape === 'circle' ? piece.size / 2 : 2,
      transform: [
        { translateX: piece.x },
        { translateY: piece.y },
        { rotate: rotateInterpolate },
      ],
    };

    return <Animated.View key={piece.id} style={pieceStyle} />;
  };

  const renderIcon = () => {
    if (typeof icon === 'string') {
      return <Text style={styles.iconText}>{icon}</Text>;
    }
    return icon;
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      accessibilityViewIsModal
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* Glass backdrop */}
        <AdaptiveGlassBackground
          glassStyle="clear"
          fallbackBlurIntensity={20}
          fallbackBlurTint="dark"
          androidFallbackColor="rgba(0,0,0,0.6)"
        />

        {/* Confetti layer */}
        <View style={styles.confettiContainer} pointerEvents="none">
          {confetti.map(renderConfettiPiece)}
        </View>

        {/* Backdrop touch handler */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleBackdropPress}
          accessible={false}
        />

        {/* Modal content */}
        <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.modalContainer,
              {
                opacity: opacityAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
            accessible
            accessibilityRole="alert"
            accessibilityLabel={`Celebration: ${title}. ${message}`}
          >
            {/* Close button */}
            {dismissible && (
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                accessibilityLabel="Close celebration"
                accessibilityRole="button"
                accessibilityHint="Dismisses this celebration modal"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            )}

            {/* Icon */}
            <View style={styles.iconContainer}>{renderIcon()}</View>

            {/* Title */}
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>

            {/* Message */}
            <Text style={styles.message}>{message}</Text>

            {/* Secondary message (e.g., XP earned) */}
            {secondaryMessage && (
              <View style={styles.secondaryMessageContainer}>
                <Text style={styles.secondaryMessage}>{secondaryMessage}</Text>
              </View>
            )}

            {/* CTA Button */}
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleCtaPress}
              activeOpacity={0.8}
              accessibilityLabel={ctaText}
              accessibilityRole="button"
              accessibilityHint="Closes the celebration and continues"
            >
              <Text style={styles.ctaButtonText}>{ctaText}</Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  modalContainer: {
    backgroundColor: theme.colors.paper.card,
    borderRadius: 22,
    padding: theme.spacing.xxl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.paper.edge,
    ...theme.shadows.lift,
  },
  closeButton: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.paper.cream,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontFamily: theme.typography.fontFamily.uiMedium,
    fontSize: 16,
    color: theme.colors.ink.soft,
    fontWeight: '500',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.paper.cardWarm,
    borderWidth: 1.5,
    borderColor: theme.colors.accents.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  iconText: {
    fontSize: 42,
  },
  title: {
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontSize: 26,
    fontStyle: 'italic',
    color: theme.colors.ink.base,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    letterSpacing: -0.4,
  },
  message: {
    fontFamily: theme.typography.fontFamily.uiRegular,
    fontSize: 15,
    color: theme.colors.ink.soft,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  secondaryMessageContainer: {
    backgroundColor: theme.colors.paper.cardWarm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.accents.gold,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
    borderRadius: 12,
    marginBottom: theme.spacing.lg,
  },
  secondaryMessage: {
    fontFamily: theme.typography.fontFamily.serifBold,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.accents.foxglove,
    textAlign: 'center',
  },
  ctaButton: {
    backgroundColor: theme.colors.accents.foxglove,
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 180,
    ...theme.shadows.sm,
  },
  ctaButtonText: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.paper.cream,
    textAlign: 'center',
  },
});

export default CelebrationModal;
