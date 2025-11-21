import React from 'react';
import Svg, { Circle, Defs, Filter, FeFlood, FeBlend, FeGaussianBlur, G } from 'react-native-svg';

interface LocationMarkerIconProps {
  width?: number;
  height?: number;
}

export const LocationMarkerIcon: React.FC<LocationMarkerIconProps> = ({
  width = 46,
  height = 44
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 46 44" fill="none">
      <Circle cx="23" cy="22" r="17" fill="#FF6600" fillOpacity="0.2"/>
      <G filter="url(#filter0_f_13_1034)">
        <Circle cx="23" cy="22" r="8.5" fill="#FF6200"/>
      </G>
      <Circle cx="23" cy="22" r="7" fill="white"/>
      <Circle cx="23" cy="22" r="5" fill="#FF6600"/>
      <Defs>
        <Filter
          id="filter0_f_13_1034"
          x="11.5"
          y="10.5"
          width="23"
          height="23"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <FeFlood floodOpacity="0" result="BackgroundImageFix"/>
          <FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
          <FeGaussianBlur stdDeviation="1.5" result="effect1_foregroundBlur_13_1034"/>
        </Filter>
      </Defs>
    </Svg>
  );
};
