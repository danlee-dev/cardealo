import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ChevronRightIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const ChevronRightIcon: React.FC<ChevronRightIconProps> = ({
  width = 8,
  height = 14,
  color = '#CCCCCC'
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 8 14" fill="none">
      <Path
        d="M1 1L7 7L1 13"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
