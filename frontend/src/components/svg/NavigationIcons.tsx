import React from 'react';
import Svg, { Path, Circle, Rect, Line, G } from 'react-native-svg';

interface IconProps {
  width?: number;
  height?: number;
  color?: string;
}

// Turn Left Icon
export const TurnLeftIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = '#212121'
}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M9 6L4 11L9 16"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M4 11H15C17.2091 11 19 12.7909 19 15V20"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Turn Right Icon
export const TurnRightIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = '#212121'
}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M15 6L20 11L15 16"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M20 11H9C6.79086 11 5 12.7909 5 15V20"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Straight Icon
export const StraightIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = '#212121'
}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 5V19"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M7 10L12 5L17 10"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// U-Turn Icon
export const UTurnIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = '#212121'
}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M6 19V9C6 5.68629 8.68629 3 12 3C15.3137 3 18 5.68629 18 9V19"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M10 15L6 19L2 15"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Start Location Icon
export const StartIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = '#4CAF50'
}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="8" fill={color} />
    <Circle cx="12" cy="12" r="4" fill="white" />
  </Svg>
);

// End Location Icon
export const EndIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = '#F44336'
}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2C8.13401 2 5 5.13401 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13401 15.866 2 12 2Z"
      fill={color}
    />
    <Circle cx="12" cy="9" r="3" fill="white" />
  </Svg>
);

// Crosswalk Icon
export const CrosswalkIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = '#212121'
}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M13 4C13 3.44772 12.5523 3 12 3C11.4477 3 11 3.44772 11 4V5H13V4Z"
      fill={color}
    />
    <Circle cx="12" cy="7" r="2" fill={color} />
    <Path
      d="M14 10H10L9 15H11L10 21H14L13 15H15L14 10Z"
      fill={color}
    />
    <Line x1="3" y1="13" x2="7" y2="13" stroke={color} strokeWidth={2} />
    <Line x1="17" y1="13" x2="21" y2="13" stroke={color} strokeWidth={2} />
  </Svg>
);

// Bus Icon
export const BusIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = '#2E7D32'
}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Rect x="4" y="3" width="16" height="16" rx="2" fill={color} />
    <Rect x="6" y="5" width="12" height="5" rx="1" fill="white" />
    <Circle cx="7.5" cy="15.5" r="1.5" fill="white" />
    <Circle cx="16.5" cy="15.5" r="1.5" fill="white" />
    <Path d="M4 19H6V21H4V19Z" fill={color} />
    <Path d="M18 19H20V21H18V19Z" fill={color} />
    <Line x1="12" y1="5" x2="12" y2="10" stroke={color} strokeWidth={0.5} />
  </Svg>
);

// Subway Icon
export const SubwayIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = '#1565C0'
}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Rect x="5" y="2" width="14" height="16" rx="4" fill={color} />
    <Rect x="7" y="4" width="10" height="5" rx="1" fill="white" />
    <Circle cx="8.5" cy="13.5" r="1.5" fill="white" />
    <Circle cx="15.5" cy="13.5" r="1.5" fill="white" />
    <Path d="M6 18L4 22" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Path d="M18 18L20 22" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

// Car Icon
export const CarIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = '#212121'
}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 11L6.5 6.5C6.8 5.6 7.6 5 8.5 5H15.5C16.4 5 17.2 5.6 17.5 6.5L19 11"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M3 11H21V16C21 17.1046 20.1046 18 19 18H5C3.89543 18 3 17.1046 3 16V11Z"
      stroke={color}
      strokeWidth={2}
      fill="none"
    />
    <Circle cx="7" cy="15" r="1.5" fill={color} />
    <Circle cx="17" cy="15" r="1.5" fill={color} />
  </Svg>
);

// Walk Icon
export const WalkIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = '#666666'
}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="4" r="2" fill={color} />
    <Path
      d="M14 10L16 16L14 22"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M10 10L8 16L10 22"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M10 10H14"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

// Chevron Down Icon
export const ChevronDownIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = '#999999'
}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M6 9L12 15L18 9"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Chevron Up Icon
export const ChevronUpIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = '#999999'
}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 15L12 9L6 15"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
