import React from 'react';
import Svg, { Rect } from 'react-native-svg';

interface QRCodeDisplayProps {
  width?: number;
  height?: number;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  width = 200,
  height = 200,
}) => {
  // Generate QR code-like pattern
  const gridSize = 20;
  const cellSize = width / gridSize;

  // Simple QR code pattern (just for visual representation)
  const pattern = [
    [1,1,1,1,1,1,1,0,1,0,1,0,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,1,0,1,1,0,0,0,0,0,1,1],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,1,1,0,1,1],
    [1,0,1,1,1,0,1,0,0,1,0,1,1,0,1,1,1,0,1,1],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,1,1,0,1,1],
    [1,0,0,0,0,0,1,0,0,1,0,1,1,0,0,0,0,0,1,1],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0],
    [1,0,1,1,0,1,1,0,1,0,1,0,1,1,0,1,1,0,1,1],
    [0,1,0,0,1,0,0,1,0,1,0,1,0,0,1,0,0,1,0,0],
    [1,0,1,1,0,1,1,0,1,0,1,0,1,1,0,1,1,0,1,1],
    [0,1,0,0,1,0,0,1,0,1,0,1,0,0,1,0,0,1,0,0],
    [0,0,0,0,0,0,0,0,1,0,1,0,1,1,0,1,1,0,1,1],
    [1,1,1,1,1,1,1,0,0,1,0,1,0,0,1,0,0,1,0,0],
    [1,0,0,0,0,0,1,0,1,0,1,0,1,1,0,1,1,0,1,1],
    [1,0,1,1,1,0,1,0,0,1,0,1,0,0,1,0,0,1,0,0],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,1,0,1,1,0,1,1],
    [1,0,1,1,1,0,1,0,0,1,0,1,0,0,1,0,0,1,0,0],
    [1,0,0,0,0,0,1,0,1,0,1,0,1,1,0,1,1,0,1,1],
    [1,1,1,1,1,1,1,0,0,1,0,1,0,0,1,0,0,1,0,0],
  ];

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {pattern.map((row, i) =>
        row.map((cell, j) =>
          cell === 1 ? (
            <Rect
              key={`${i}-${j}`}
              x={j * cellSize}
              y={i * cellSize}
              width={cellSize}
              height={cellSize}
              fill="#000000"
            />
          ) : null
        )
      )}
    </Svg>
  );
};
