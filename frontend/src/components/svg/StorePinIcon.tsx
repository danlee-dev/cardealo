import React from 'react';
import Svg, { Circle, Path, G, Defs, Filter, FeFlood, FeBlend, FeGaussianBlur } from 'react-native-svg';

interface StorePinIconProps {
  width?: number;
  height?: number;
  benefitLevel?: 'high' | 'medium' | 'low';
}

export const StorePinIcon: React.FC<StorePinIconProps> = ({
  width = 27,
  height = 27,
  benefitLevel = 'medium'
}) => {
  // 혜택 수준에 따른 색상과 블러 설정
  const config = {
    high: { color: '#C20000', blur: '2.5', filterSize: { x: 4.84375, y: 2.59375, w: 17.3125, h: 17.3125 } },
    medium: { color: '#FF8400', blur: '1.5', filterSize: { x: 6.84375, y: 4.59375, w: 13.3125, h: 13.3125 } },
    low: { color: '#237300', blur: '2', filterSize: { x: 5.84375, y: 3.59375, w: 15.3125, h: 15.3125 } },
  };

  const { color, blur, filterSize } = config[benefitLevel];
  const filterId = `filter_${benefitLevel}`;

  return (
    <Svg width={width} height={height} viewBox="0 0 27 27" fill="none">
      <Circle cx="13.5" cy="11.5" r="7.5" fill="white"/>
      <Path
        d="M13.7432 1.1875L14.1914 1.19824C16.4243 1.30388 18.5548 2.19112 20.2061 3.71191C21.8574 5.2328 22.9165 7.28317 23.2051 9.5L23.2529 9.94531L23.2813 10.4434C23.3592 12.7616 22.6514 15.0391 21.2725 16.9043L20.9668 17.2969L15.5742 23.8916C15.3231 24.199 15.0071 24.447 14.6485 24.6172C14.2896 24.7874 13.8971 24.876 13.5 24.876C13.1029 24.876 12.7104 24.7874 12.3516 24.6172C11.9929 24.447 11.677 24.199 11.4258 23.8916L6.03419 17.2969C4.34925 15.2348 3.52916 12.5993 3.74709 9.94531L3.79494 9.5C4.08354 7.28317 5.14262 5.2328 6.79396 3.71191C8.55544 2.08964 10.8622 1.18828 13.2569 1.1875H13.7432ZM13.5 6.40625C12.2154 6.40625 10.9836 6.91682 10.0752 7.8252C9.16683 8.73357 8.65627 9.96536 8.65627 11.25C8.65627 12.5346 9.16683 13.7664 10.0752 14.6748C10.9836 15.5832 12.2154 16.0938 13.5 16.0938C14.7847 16.0937 16.0164 15.5832 16.9248 14.6748C17.8332 13.7664 18.3438 12.5346 18.3438 11.25L18.3379 11.0098C18.2785 9.81259 17.7764 8.67679 16.9248 7.8252C16.0164 6.91682 14.7847 6.40625 13.5 6.40625Z"
        fill="black"
        stroke="#FFFDFD"
      />
      <G filter={`url(#${filterId})`}>
        <Path
          d="M9.84375 11.25C9.84375 10.2803 10.229 9.35032 10.9146 8.66464C11.6003 7.97896 12.5303 7.59375 13.5 7.59375C14.4697 7.59375 15.3997 7.97896 16.0854 8.66464C16.771 9.35032 17.1562 10.2803 17.1562 11.25C17.1562 12.2197 16.771 13.1497 16.0854 13.8354C15.3997 14.521 14.4697 14.9063 13.5 14.9062C12.5303 14.9063 11.6003 14.521 10.9146 13.8354C10.229 13.1497 9.84375 12.2197 9.84375 11.25Z"
          fill={color}
        />
      </G>
      <Defs>
        <Filter
          id={filterId}
          x={filterSize.x}
          y={filterSize.y}
          width={filterSize.w}
          height={filterSize.h}
          filterUnits="userSpaceOnUse"
        >
          <FeFlood floodOpacity="0" result="BackgroundImageFix"/>
          <FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
          <FeGaussianBlur stdDeviation={blur} result={`effect1_foregroundBlur_${benefitLevel}`}/>
        </Filter>
      </Defs>
    </Svg>
  );
};
