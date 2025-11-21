import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface SavedCourseIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const SavedCourseIcon: React.FC<SavedCourseIconProps> = ({
  width = 14,
  height = 15,
  color = 'black'
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 14 15" fill="none">
      <Path
        d="M0.735294 0H12.5C12.9061 0 13.2353 0.323241 13.2353 0.721971V14.6389C13.2353 14.8383 13.0707 15 12.8676 15C12.816 15 12.765 14.9892 12.7179 14.9686L6.61765 12.2961L0.517449 14.9686C0.332022 15.0499 0.11464 14.9681 0.0319044 14.786C0.0108677 14.7397 0 14.6896 0 14.6389V0.721971C0 0.323241 0.329206 0 0.735294 0ZM11.7647 12.9699V1.44394H1.47059V12.9699L6.61765 10.7149L11.7647 12.9699ZM6.61765 8.30267L4.45667 9.41819L4.86938 7.05546L3.12112 5.38224L5.53713 5.03753L6.61765 2.88788L7.69816 5.03753L10.1142 5.38224L8.36588 7.05546L8.7786 9.41819L6.61765 8.30267Z"
        fill={color}
      />
    </Svg>
  );
};
