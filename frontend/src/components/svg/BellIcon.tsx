import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface BellIconProps {
  width?: number;
  height?: number;
  hasNotification?: boolean;
}

export const BellIcon: React.FC<BellIconProps> = ({
  width = 20,
  height = 20,
  hasNotification = false,
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 20 20" fill="none">
      <Path
        d="M18 14.2857H20V16.1905H0V14.2857H2V7.61905C2 3.41116 5.58172 0 10 0C14.4183 0 18 3.41116 18 7.61905V14.2857ZM16 14.2857V7.61905C16 4.46313 13.3137 1.90476 10 1.90476C6.68629 1.90476 4 4.46313 4 7.61905V14.2857H16ZM7 18.0952H13V20H7V18.0952Z"
        fill="black"
      />
      {hasNotification && <Circle cx="17" cy="3" r="3" fill="#FF7A00" />}
    </Svg>
  );
};
