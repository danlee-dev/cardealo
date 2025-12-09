import React from 'react';
import { ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface ChevronRightIconProps {
  width?: number;
  height?: number;
  color?: string;
  style?: ViewStyle;
}

export const ChevronRightIcon: React.FC<ChevronRightIconProps> = ({
  width = 8,
  height = 14,
  color = '#CCCCCC',
  style,
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 8 14" fill="none" style={style}>
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
