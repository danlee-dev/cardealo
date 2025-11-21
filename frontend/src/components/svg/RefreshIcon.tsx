import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface RefreshIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const RefreshIcon: React.FC<RefreshIconProps> = ({
  width = 20,
  height = 20,
  color = '#C23E38',
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21.5 2V8M21.5 8H15.5M21.5 8L18.5 5C17.0482 3.54822 15.1161 2.63889 13.0313 2.43027C10.9466 2.22165 8.84894 2.72642 7.10081 3.86256C5.35269 4.99869 4.05518 6.69542 3.43741 8.66612C2.81963 10.6368 2.92093 12.7598 3.72726 14.6622C4.5336 16.5647 5.99478 18.1252 7.86141 19.0705C9.72803 20.0158 11.8794 20.2848 13.9432 19.8305C16.0071 19.3761 17.8542 18.225 19.1665 16.5742C20.4787 14.9235 21.175 12.8762 21.1415 10.7778"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
