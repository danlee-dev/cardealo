import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface CheckCircleIconProps {
  width?: number;
  height?: number;
  color?: string;
  backgroundColor?: string;
}

export const CheckCircleIcon: React.FC<CheckCircleIconProps> = ({
  width = 48,
  height = 48,
  color = '#FFFFFF',
  backgroundColor = '#212121'
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 48 48" fill="none">
      <Circle cx="24" cy="24" r="24" fill={backgroundColor} />
      <Path
        d="M14 24L21 31L34 18"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
