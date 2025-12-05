import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface ReceiptIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const ReceiptIcon: React.FC<ReceiptIconProps> = ({
  width = 24,
  height = 24,
  color = '#FFFFFF',
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19Z"
        fill={color}
      />
      <Rect x="7" y="8" width="10" height="1.5" rx="0.75" fill={color} />
      <Rect x="7" y="11.5" width="7" height="1.5" rx="0.75" fill={color} />
      <Rect x="7" y="15" width="5" height="1.5" rx="0.75" fill={color} />
    </Svg>
  );
};
