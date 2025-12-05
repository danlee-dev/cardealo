import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface UsersIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const UsersIcon: React.FC<UsersIconProps> = ({
  width = 22,
  height = 22,
  color = '#212121'
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 22 22" fill="none">
      <Circle
        cx="8"
        cy="6"
        r="3.5"
        stroke={color}
        strokeWidth={1.5}
      />
      <Path
        d="M2 18C2 14.6863 4.68629 12 8 12C11.3137 12 14 14.6863 14 18"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Circle
        cx="16"
        cy="7"
        r="2.5"
        stroke={color}
        strokeWidth={1.5}
      />
      <Path
        d="M15 12C17.7614 12 20 14.2386 20 17"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
};
