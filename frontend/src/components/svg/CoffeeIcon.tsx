import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface CoffeeIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const CoffeeIcon: React.FC<CoffeeIconProps> = ({ width = 14, height = 14, color = '#212121' }) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 14 14" fill="none">
      <Path
        d="M2.1 0H12.6C13.3732 0 14 0.696446 14 1.55556V3.88889C14 4.748 13.3732 5.44444 12.6 5.44444H11.2V7.77778C11.2 9.49597 9.94637 10.8889 8.4 10.8889H4.2C2.6536 10.8889 1.4 9.49597 1.4 7.77778V0.777778C1.4 0.348227 1.7134 0 2.1 0ZM11.2 1.55556V3.88889H12.6V1.55556H11.2ZM0 12.4444H12.6V14H0V12.4444Z"
        fill={color}
      />
    </Svg>
  );
};
