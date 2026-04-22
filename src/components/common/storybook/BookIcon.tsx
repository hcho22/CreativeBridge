import React from 'react';
import Svg, { Path } from 'react-native-svg';

export interface BookIconProps {
  size?: number;
  color?: string;
}

// Ported from /tmp/cb_design/components/shared.jsx:211-218
export const BookIcon: React.FC<BookIconProps> = ({
  size = 24,
  color = 'currentColor',
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 4h7c1.5 0 3 1 3 3v13c0-1.5-1.5-2-3-2H4V4z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
    <Path
      d="M20 4h-7c-1.5 0-3 1-3 3v13c0-1.5 1.5-2 3-2h7V4z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  </Svg>
);

export default BookIcon;
