import React from 'react';
import {
  View,
  Text,
  Image,
  ImageSourcePropType,
  StyleSheet,
} from 'react-native';
import Svg, {
  Defs,
  RadialGradient,
  Stop,
  Circle,
  Ellipse,
} from 'react-native-svg';

export interface WatercolorProps {
  /** Hue value 0–360 that drives the gradient's color family. Defaults to 40 (warm ember). */
  hue?: number;
  /** Diameter in logical pixels. Defaults to 56. */
  size?: number;
  /** When true, reduces opacity for background/decorative placement. */
  soft?: boolean;
  /** Emoji string or short text rendered at the center of the circle. */
  children?: string;
  /** Local `require(...)` or remote URI for a raster avatar inside the circle. */
  imageSource?: ImageSourcePropType;
}

// Ported from /tmp/cb_design/components/shared.jsx:66-99.
// The source uses OKLCH colors + SVG feTurbulence for organic paint texture.
// RN doesn't support OKLCH in StyleSheet values or `react-native-svg` stops,
// so we approximate with HSL (visually close for the warm storybook palette).
// The feTurbulence + feDisplacementMap filter is dropped per PRD §9 default.
//
// If both `imageSource` and `children` are provided, `imageSource` wins so
// restyled screens can drop in either emoji or raster assets uniformly.
export const Watercolor: React.FC<WatercolorProps> = ({
  hue = 40,
  size = 56,
  soft = false,
  children,
  imageSource,
}) => {
  const innerSize = Math.round(size * 0.88);
  const emojiFontSize = size * 0.44;

  // Three gradient stops approximating oklch(0.88 0.10 h) → oklch(0.72 0.14 h) → oklch(0.58 0.16 h).
  const stopLight = `hsl(${hue}, 55%, 82%)`;
  const stopMid = `hsl(${hue}, 60%, 60%)`;
  const stopDark = `hsl(${hue}, 65%, 42%)`;
  const strokeColor = `hsl(${hue}, 55%, 38%)`;
  const lightOpacity = soft ? 0.7 : 0.95;
  const midOpacity = soft ? 0.5 : 0.85;
  const darkOpacity = soft ? 0.4 : 0.75;

  const gradientId = `watercolor-${hue}-${size}-${soft ? 's' : 'f'}`;

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessibilityRole="image"
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={gradientId} cx="35%" cy="30%" rx="70%" ry="70%">
            <Stop
              offset="0%"
              stopColor={stopLight}
              stopOpacity={lightOpacity}
            />
            <Stop offset="60%" stopColor={stopMid} stopOpacity={midOpacity} />
            <Stop
              offset="100%"
              stopColor={stopDark}
              stopOpacity={darkOpacity}
            />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={44} fill={`url(#${gradientId})`} />
        <Circle
          cx={50}
          cy={50}
          r={44}
          fill="none"
          stroke={strokeColor}
          strokeOpacity={0.3}
          strokeWidth={1.2}
        />
        {/* Top-left wash highlight — approximates CSS ellipse at 38/32 opacity 0.45. */}
        <Ellipse cx={38} cy={32} rx={14} ry={9} fill="#FBF5E6" opacity={0.45} />
      </Svg>

      <View style={styles.contentWrap} pointerEvents="none">
        {imageSource ? (
          <Image
            source={imageSource}
            style={[
              styles.image,
              {
                width: innerSize,
                height: innerSize,
                borderRadius: innerSize / 2,
                backgroundColor: `hsl(${hue}, 50%, 70%)`,
              },
            ]}
            resizeMode="cover"
          />
        ) : children ? (
          <Text style={[styles.emoji, { fontSize: emojiFontSize }]}>
            {children}
          </Text>
        ) : null}
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
  contentWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    overflow: 'hidden',
  },
  emoji: {
    textAlign: 'center',
  },
});

export default Watercolor;
