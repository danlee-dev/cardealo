import React from 'react';
import Svg, { Rect } from 'react-native-svg';

interface BarcodeDisplayProps {
  width?: number;
  height?: number;
  value?: string;
}

export const BarcodeDisplay: React.FC<BarcodeDisplayProps> = ({
  width = 300,
  height = 100,
  value = '3333',
}) => {
  // Generate barcode-like pattern
  const bars = [
    { x: 0, width: 2 },
    { x: 4, width: 1 },
    { x: 7, width: 3 },
    { x: 12, width: 1 },
    { x: 15, width: 2 },
    { x: 19, width: 1 },
    { x: 22, width: 2 },
    { x: 26, width: 3 },
    { x: 31, width: 1 },
    { x: 34, width: 2 },
    { x: 38, width: 1 },
    { x: 41, width: 3 },
    { x: 46, width: 2 },
    { x: 50, width: 1 },
    { x: 53, width: 2 },
    { x: 57, width: 3 },
    { x: 62, width: 1 },
    { x: 65, width: 2 },
    { x: 69, width: 1 },
    { x: 72, width: 3 },
    { x: 77, width: 2 },
    { x: 81, width: 1 },
    { x: 84, width: 2 },
    { x: 88, width: 3 },
    { x: 93, width: 1 },
    { x: 96, width: 2 },
  ];

  const scaleX = width / 100;

  return (
    <Svg width={width} height={height} viewBox={`0 0 100 ${height}`}>
      {bars.map((bar, index) => (
        <Rect
          key={index}
          x={bar.x}
          y={0}
          width={bar.width}
          height={height}
          fill="#000000"
        />
      ))}
    </Svg>
  );
};
