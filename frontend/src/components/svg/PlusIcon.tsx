import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface PlusIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const PlusIcon: React.FC<PlusIconProps> = ({
  width = 18,
  height = 18,
  color = '#212121'
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 18 18" fill="none">
      <Path
        d="M9 3V15M3 9H15"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
};
