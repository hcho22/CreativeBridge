import React from 'react';
import Svg, { Path } from 'react-native-svg';

export interface QuillIconProps {
  size?: number;
  color?: string;
}

// Ported from /tmp/cb_design/components/shared.jsx:200-208
export const QuillIcon: React.FC<QuillIconProps> = ({
  size = 24,
  color = 'currentColor',
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20 3c-5 1-10 5-13 10l-3 7 7-3c5-3 9-8 10-13l-1-1z"
      stroke={color}
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
    <Path
      d="M9 14l-3 6"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
    />
    <Path
      d="M14 8c-2 1-4 3-5 5"
      stroke={color}
      strokeWidth={1.4}
      strokeLinecap="round"
      opacity={0.6}
    />
  </Svg>
);

export default QuillIcon;
