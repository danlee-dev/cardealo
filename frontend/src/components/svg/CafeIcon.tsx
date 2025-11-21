import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface CafeIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const CafeIcon: React.FC<CafeIconProps> = ({ width = 14, height = 14, color = '#212121' }) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 14 14" fill="none">
      <Path
        d="M13.3 6.75206V13.3C13.3 13.6866 12.9866 14 12.6 14H1.4C1.0134 14 0.7 13.6866 0.7 13.3V6.75206C0.264348 6.25849 0 5.61008 0 4.9V0.7C0 0.313404 0.313404 0 0.7 0H13.3C13.6866 0 14 0.313404 14 0.7V4.9C14 5.61008 13.7357 6.25849 13.3 6.75206ZM8.4 4.9C8.4 4.5134 8.71339 4.2 9.1 4.2C9.48661 4.2 9.8 4.5134 9.8 4.9C9.8 5.67322 10.4268 6.3 11.2 6.3C11.9732 6.3 12.6 5.67322 12.6 4.9V1.4H1.4V4.9C1.4 5.67322 2.0268 6.3 2.8 6.3C3.5732 6.3 4.2 5.67322 4.2 4.9C4.2 4.5134 4.5134 4.2 4.9 4.2C5.2866 4.2 5.6 4.5134 5.6 4.9C5.6 5.67322 6.22678 6.3 7 6.3C7.77322 6.3 8.4 5.67322 8.4 4.9Z"
        fill={color}
      />
    </Svg>
  );
};
