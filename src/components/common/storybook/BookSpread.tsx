import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Line,
  Rect,
} from 'react-native-svg';
import { theme } from '../../../constants/theme';

export interface BookSpreadProps {
  /** Rendered SVG width in logical pixels. Default 520 matches design source. */
  width?: number;
  /** Rendered SVG height in logical pixels. Default 340 matches design source. */
  height?: number;
}

// Ported from /tmp/cb_design/components/screens-core.jsx:237-271.
// Two page paths with linear gradients, a spine shadow, and dashed
// handwriting lines on each page. The design source includes an
// feTurbulence paper-grain filter — dropped here per PRD §9 "cleaner
// spread" default because react-native-svg can't render feTurbulence
// efficiently.
export const BookSpread: React.FC<BookSpreadProps> = ({
  width = 520,
  height = 340,
}) => {
  const leftLines = [60, 80, 100, 120, 140];
  const rightLines = [60, 80, 100, 120, 140];

  return (
    <View style={[styles.shadowWrap, { width, height }]}>
      <Svg width={width} height={height} viewBox="0 0 520 340">
        <Defs>
          <LinearGradient id="page-L" x1="0" x2="1" y1="0" y2="0">
            <Stop offset="0" stopColor="#FDF9EC" />
            <Stop offset="1" stopColor="#F1E6C9" />
          </LinearGradient>
          <LinearGradient id="page-R" x1="0" x2="1" y1="0" y2="0">
            <Stop offset="0" stopColor="#F1E6C9" />
            <Stop offset="1" stopColor="#FDF9EC" />
          </LinearGradient>
        </Defs>
        <Path
          d="M20 20 L260 30 L260 310 L20 320 Q10 170 20 20 Z"
          fill="url(#page-L)"
          stroke="#D8C89C"
          strokeWidth={0.5}
        />
        <Path
          d="M260 30 L500 20 Q510 170 500 320 L260 310 Z"
          fill="url(#page-R)"
          stroke="#D8C89C"
          strokeWidth={0.5}
        />
        {/* Spine shadow */}
        <Rect
          x={258}
          y={25}
          width={4}
          height={290}
          fill="rgba(43,29,20,0.18)"
        />
        {leftLines.map((y, i) => (
          <Line
            key={`l-${i}`}
            x1={40}
            y1={y}
            x2={240 - i * 10}
            y2={y}
            stroke={theme.colors.ink.base}
            strokeWidth={0.8}
            strokeOpacity={0.12}
            strokeDasharray="1 2"
          />
        ))}
        {rightLines.map((y, i) => (
          <Line
            key={`r-${i}`}
            x1={280 + i * 5}
            y1={y}
            x2={480}
            y2={y}
            stroke={theme.colors.ink.base}
            strokeWidth={0.8}
            strokeOpacity={0.12}
            strokeDasharray="1 2"
          />
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  shadowWrap: {
    shadowColor: theme.colors.ink.base,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 8,
  },
});

export default BookSpread;
