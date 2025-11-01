import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface FoodIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const FoodIcon: React.FC<FoodIconProps> = ({ width = 14, height = 14, color = '#212121' }) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 14 14" fill="none">
      <Path
        d="M0.900438 0.0578842L6.06338 5.35591L3.8895 7.58663L0.900438 4.51938C-0.300146 3.28737 -0.300146 1.28989 0.900438 0.0578842ZM8.62151 6.63461L7.96545 7.30783L13.4001 12.8846L12.3132 14L6.87853 8.42319L1.44391 14L0.356978 12.8846L7.53451 5.51925C7.0829 4.3702 7.54973 2.71527 8.78068 1.4521C10.2814 -0.0879046 12.3496 -0.462428 13.4001 0.615573C14.4506 1.69358 14.0857 3.8159 12.5849 5.35591C11.3539 6.61907 9.74125 7.09812 8.62151 6.63461Z"
        fill={color}
      />
    </Svg>
  );
};
