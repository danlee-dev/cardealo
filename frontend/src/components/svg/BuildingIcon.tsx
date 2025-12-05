import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface BuildingIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const BuildingIcon: React.FC<BuildingIconProps> = ({
  width = 22,
  height = 22,
  color = '#212121'
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 22 22" fill="none">
      <Path
        d="M3 20V5C3 3.89543 3.89543 3 5 3H11C12.1046 3 13 3.89543 13 5V20"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13 10H17C18.1046 10 19 10.8954 19 12V20"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 20H19"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Rect x="6" y="6" width="2" height="2" rx="0.5" fill={color} />
      <Rect x="6" y="10" width="2" height="2" rx="0.5" fill={color} />
      <Rect x="6" y="14" width="2" height="2" rx="0.5" fill={color} />
      <Rect x="10" y="6" width="2" height="2" rx="0.5" fill={color} />
      <Rect x="10" y="10" width="2" height="2" rx="0.5" fill={color} />
      <Rect x="15" y="13" width="2" height="2" rx="0.5" fill={color} />
    </Svg>
  );
};
