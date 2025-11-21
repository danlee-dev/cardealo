import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface StarIconProps {
  width?: number;
  height?: number;
  filled?: boolean;
  onPress?: () => void;
}

export const StarIcon: React.FC<StarIconProps> = ({
  width = 24,
  height = 24,
  filled = false,
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 48 48" fill="none">
      <Path
        d="M24 4L30.18 16.52L44 18.54L34 28.28L36.36 42.04L24 35.54L11.64 42.04L14 28.28L4 18.54L17.82 16.52L24 4Z"
        fill={filled ? '#4AA63C' : 'none'}
        stroke={filled ? '#4AA63C' : '#1E1E1E'}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
