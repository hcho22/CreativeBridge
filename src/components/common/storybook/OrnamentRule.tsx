import React from 'react';
import Svg, { Line, Circle } from 'react-native-svg';
import { theme } from '../../../constants/theme';

export interface OrnamentRuleProps {
  width?: number;
  color?: string;
}

// Ported from /tmp/cb_design/components/shared.jsx:188-197
// Horizontal rule with a hollow-circle ornament centered between two line segments.
// Defaults to theme.colors.ink.faint so it reads as a warm-brown divider on paper.
export const OrnamentRule: React.FC<OrnamentRuleProps> = ({
  width = 120,
  color = theme.colors.ink.faint,
}) => (
  <Svg width={width} height={14} viewBox="0 0 120 14">
    <Line x1={0} y1={7} x2={50} y2={7} stroke={color} strokeWidth={1} />
    <Circle cx={60} cy={7} r={2.5} stroke={color} strokeWidth={1} fill="none" />
    <Circle cx={60} cy={7} r={0.8} fill={color} />
    <Line x1={70} y1={7} x2={120} y2={7} stroke={color} strokeWidth={1} />
  </Svg>
);

export default OrnamentRule;
