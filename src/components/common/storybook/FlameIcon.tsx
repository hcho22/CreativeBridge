import React from 'react';
import Svg, { Path } from 'react-native-svg';

export interface FlameIconProps {
  size?: number;
}

// Ported from /tmp/cb_design/components/shared.jsx:221-229
// Colors are intentionally hardcoded — the flame keeps its amber/ember palette
// across light/dark variants per the design system.
export const FlameIcon: React.FC<FlameIconProps> = ({ size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 3c0 4-4 5-4 9a4 4 0 008 0c0-2-1-3-2-4 1 3-1 4-2 3 0-3 3-4 0-8z"
      fill="#D97706"
      stroke="#92400E"
      strokeWidth={1}
      strokeLinejoin="round"
    />
    <Path
      d="M10 14c0 1 1 2 2 2s2-1 2-2"
      stroke="#FBF5E6"
      strokeWidth={1}
      strokeLinecap="round"
      opacity={0.5}
    />
  </Svg>
);

export default FlameIcon;
