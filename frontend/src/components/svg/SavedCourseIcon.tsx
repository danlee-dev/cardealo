import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface SavedCourseIconProps {
  width?: number;
  height?: number;
  color?: string;
  filled?: boolean;
}

export const SavedCourseIcon: React.FC<SavedCourseIconProps> = ({
  width = 24,
  height = 24,
  color = '#666666',
  filled = false,
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      {filled ? (
        <Path
          d="M5 3C5 2.44772 5.44772 2 6 2H18C18.5523 2 19 2.44772 19 3V21.5C19 21.7761 18.7761 22 18.5 22C18.4015 22 18.3052 21.9707 18.2226 21.9159L12 17.8685L5.77735 21.9159C5.54759 22.0656 5.23978 22.0054 5.09006 21.7757C5.03167 21.6862 5 21.5816 5 21.4749V3Z"
          fill={color}
        />
      ) : (
        <Path
          d="M5 3C5 2.44772 5.44772 2 6 2H18C18.5523 2 19 2.44772 19 3V21.5C19 21.7761 18.7761 22 18.5 22C18.4015 22 18.3052 21.9707 18.2226 21.9159L12 17.8685L5.77735 21.9159C5.54759 22.0656 5.23978 22.0054 5.09006 21.7757C5.03167 21.6862 5 21.5816 5 21.4749V3ZM7 4V19.1315L11.4453 16.2416C11.7812 16.0231 12.2188 16.0231 12.5547 16.2416L17 19.1315V4H7Z"
          fill={color}
        />
      )}
    </Svg>
  );
};
