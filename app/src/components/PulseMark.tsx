import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

export interface PulseMarkProps {
  size?: number;
  color?: string;
  accent?: string;
}

export default function PulseMark({
  size = 24,
  color = '#16140f',
  accent = '#b8451c',
}: PulseMarkProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M12 50 H34 L40 32 L48 66 L56 44 L62 50 H72"
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={81} cy={50} r={5} fill={accent} />
    </Svg>
  );
}
