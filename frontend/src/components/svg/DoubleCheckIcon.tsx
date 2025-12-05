import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface DoubleCheckIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const DoubleCheckIcon: React.FC<DoubleCheckIconProps> = ({
  width = 16,
  height = 16,
  color = '#888888'
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 16 16" fill="none">
      <Path
        d="M1.5 8.5L4.5 11.5L11 5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5.5 8.5L8.5 11.5L15 5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
