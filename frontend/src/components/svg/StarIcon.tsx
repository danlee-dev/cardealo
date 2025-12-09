import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface StarIconProps {
  width?: number;
  height?: number;
  filled?: boolean;
  color?: string;
  onPress?: () => void;
}

export const StarIcon: React.FC<StarIconProps> = ({
  width = 24,
  height = 24,
  filled = false,
  color,
}) => {
  const fillColor = color || (filled ? '#4AA63C' : 'none');
  const strokeColor = color || (filled ? '#4AA63C' : '#1E1E1E');

  return (
    <Svg width={width} height={height} viewBox="0 0 48 48" fill="none">
      <Path
        d="M24 4L30.18 16.52L44 18.54L34 28.28L36.36 42.04L24 35.54L11.64 42.04L14 28.28L4 18.54L17.82 16.52L24 4Z"
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
