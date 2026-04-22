import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Defs,
  RadialGradient,
  Stop,
  Circle,
  Ellipse,
} from 'react-native-svg';
import { theme } from '../../../constants/theme';

export interface WaxSealProps {
  size?: number;
  letter?: string;
  color?: string;
}

// Ported from /tmp/cb_design/components/shared.jsx:162-185.
// The CSS version layers a radial-gradient background + inset box-shadows +
// an feTurbulence wobble filter. RN can't express inset shadows, so we use a
// radial SVG gradient for the wax body, a top highlight ellipse for the
// sheen, and omit the turbulence (per PRD §9 default "cleaner spread").
export const WaxSeal: React.FC<WaxSealProps> = ({
  size = 56,
  letter = 'C',
  color = theme.colors.accents.foxglove,
}) => {
  const gradientId = `waxseal-${size}-${color.replace('#', '')}`;
  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessibilityRole="image"
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={gradientId} cx="35%" cy="30%" rx="70%" ry="70%">
            <Stop offset="0%" stopColor="#D45B2E" />
            <Stop offset="70%" stopColor={color} />
            <Stop offset="100%" stopColor="#6B1F05" />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={46} fill={`url(#${gradientId})`} />
        {/* Top-left highlight — simulates the inset light sheen from CSS. */}
        <Ellipse cx={36} cy={30} rx={14} ry={8} fill="#FBF5E6" opacity={0.25} />
        {/* Bottom shadow — simulates the inset dark shadow. */}
        <Ellipse cx={58} cy={72} rx={22} ry={10} fill="#2B1D14" opacity={0.2} />
      </Svg>
      <View style={styles.letterWrap} pointerEvents="none">
        <Text style={[styles.letter, { fontSize: size * 0.5 }]}>{letter}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  letterWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontFamily: theme.typography.fontFamily.serifItalic,
    color: 'rgba(255, 245, 230, 0.9)',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
});

export default WaxSeal;
