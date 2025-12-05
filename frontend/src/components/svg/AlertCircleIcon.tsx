import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface AlertCircleIconProps {
  width?: number;
  height?: number;
  color?: string;
  backgroundColor?: string;
}

export const AlertCircleIcon: React.FC<AlertCircleIconProps> = ({
  width = 48,
  height = 48,
  color = '#666666',
  backgroundColor = '#E0E0E0'
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 48 48" fill="none">
      <Circle cx="24" cy="24" r="24" fill={backgroundColor} />
      <Path
        d="M24 14V26"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Circle cx="24" cy="33" r="2" fill={color} />
    </Svg>
  );
};
