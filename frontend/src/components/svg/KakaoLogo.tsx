import React from 'react';
import Svg, { Path, G, Defs, ClipPath, Rect } from 'react-native-svg';

interface KakaoLogoProps {
  width?: number;
  height?: number;
}

export const KakaoLogo: React.FC<KakaoLogoProps> = ({ width = 18, height = 18 }) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 18 18" fill="none">
      <Defs>
        <ClipPath id="clip0_kakao">
          <Rect width="17.9021" height="17.9022" fill="white"/>
        </ClipPath>
      </Defs>
      <G clipPath="url(#clip0_kakao)">
        <Path fillRule="evenodd" clipRule="evenodd" d="M8.95111 0.596771C4.00728 0.596771 0 3.69281 0 7.51127C0 9.88604 1.54994 11.9795 3.91016 13.2247L2.91709 16.8524C2.82935 17.173 3.19595 17.4285 3.47746 17.2427L7.83056 14.3697C8.19791 14.4052 8.57124 14.4259 8.95111 14.4259C13.8945 14.4259 17.9021 11.3299 17.9021 7.51127C17.9021 3.69281 13.8945 0.596771 8.95111 0.596771Z" fill="black"/>
      </G>
    </Svg>
  );
};
