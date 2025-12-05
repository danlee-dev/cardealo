import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface UserPlusIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const UserPlusIcon: React.FC<UserPlusIconProps> = ({
  width = 20,
  height = 20,
  color = '#212121'
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 20 20" fill="none">
      <Circle
        cx="8"
        cy="5"
        r="3.5"
        stroke={color}
        strokeWidth={1.5}
      />
      <Path
        d="M2 17C2 13.6863 4.68629 11 8 11C9.29583 11 10.4957 11.3989 11.5 12.0859"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M16 12V18M13 15H19"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
};
