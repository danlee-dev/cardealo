import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface CloseIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const CloseIcon: React.FC<CloseIconProps> = ({
  width = 12,
  height = 12,
  color = '#999999'
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 12 12" fill="none">
      <Path
        d="M1 1L11 11M11 1L1 11"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
};
