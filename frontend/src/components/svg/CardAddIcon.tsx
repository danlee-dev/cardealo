import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface CardAddIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const CardAddIcon: React.FC<CardAddIconProps> = ({
  width = 40,
  height = 40,
  color = '#FFFFFF',
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 40 40" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M27.2559 5.58916L5.58928 27.2558L4.41077 26.0773L26.0774 4.41064L27.2559 5.58916Z"
        fill={color}
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M23.294 3.55599C23.0028 3.26476 22.5138 3.26476 22.2225 3.55599L3.55587 22.2227C3.26464 22.5139 3.26464 23.0029 3.55587 23.2941L16.7059 36.4441C16.9971 36.7354 17.4861 36.7354 17.7774 36.4441L36.444 17.7775C36.73 17.4915 36.742 17.0156 36.4394 16.7014L23.294 3.55599ZM21.044 2.37748C21.9861 1.43537 23.5304 1.43537 24.4725 2.37748L37.6304 15.5353C38.5578 16.4878 38.5689 18.0096 37.6225 18.956L18.9559 37.6227C18.0138 38.5648 16.4695 38.5648 15.5274 37.6227L2.37735 24.4727C1.43525 23.5306 1.43525 21.9862 2.37735 21.0441L21.044 2.37748Z"
        fill={color}
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M29.7583 9.75358L9.17495 30.5036L7.9917 29.3298L28.575 8.57983L29.7583 9.75358Z"
        fill={color}
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M21.4226 25.2441C21.748 25.5695 21.748 26.0972 21.4226 26.4226L16.4226 31.4226C16.0972 31.748 15.5695 31.748 15.2441 31.4226C14.9186 31.0972 14.9186 30.5695 15.2441 30.2441L20.2441 25.2441C20.5695 24.9186 21.0972 24.9186 21.4226 25.2441Z"
        fill={color}
      />
    </Svg>
  );
};
