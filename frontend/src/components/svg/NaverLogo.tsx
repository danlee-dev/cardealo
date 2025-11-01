import React from 'react';
import Svg, { Path, G, Defs, ClipPath, Rect } from 'react-native-svg';

interface NaverLogoProps {
  width?: number;
  height?: number;
}

export const NaverLogo: React.FC<NaverLogoProps> = ({ width = 15, height = 15 }) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 15 15" fill="none">
      <Defs>
        <ClipPath id="clip0_naver">
          <Rect width="14.64" height="14.64" fill="white"/>
        </ClipPath>
      </Defs>
      <G clipPath="url(#clip0_naver)">
        <Path d="M9.92695 7.83488L4.49895 4.3869e-05H7.62939e-06V14.64H4.71307V6.80398L10.1411 14.64H14.64V4.3869e-05H9.92695V7.83488Z" fill="white"/>
      </G>
    </Svg>
  );
};
