import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface ClockIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const ClockIcon: React.FC<ClockIconProps> = ({
  width = 18,
  height = 18,
  color = '#999999'
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 18 18" fill="none">
      <Circle
        cx="9"
        cy="9"
        r="7.5"
        stroke={color}
        strokeWidth={1.5}
      />
      <Path
        d="M9 5V9L12 11"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
