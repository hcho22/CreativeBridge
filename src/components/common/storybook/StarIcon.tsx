import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { theme } from '../../../constants/theme';

export interface StarIconProps {
  size?: number;
  color?: string;
}

// Ported from /tmp/cb_design/components/shared.jsx:232-239
// Defaults to theme.colors.accents.gold (the CSS --gold token).
export const StarIcon: React.FC<StarIconProps> = ({
  size = 18,
  color = theme.colors.accents.gold,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path
      d="M12 2l2.9 6.9L22 10l-5.5 4.8L18.2 22 12 18.3 5.8 22l1.7-7.2L2 10l7.1-1.1L12 2z"
      stroke="#8B6914"
      strokeWidth={1}
      strokeLinejoin="round"
    />
  </Svg>
);

export default StarIcon;
