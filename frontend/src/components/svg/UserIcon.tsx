import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface UserIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const UserIcon: React.FC<UserIconProps> = ({
  width = 18,
  height = 18,
  color = '#FFFFFF'
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 18 18" fill="none">
      <Circle
        cx="9"
        cy="5"
        r="3.5"
        stroke={color}
        strokeWidth={1.5}
      />
      <Path
        d="M2 16C2 12.6863 5.13401 10 9 10C12.866 10 16 12.6863 16 16"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
};
