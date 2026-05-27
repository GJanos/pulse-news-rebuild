import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

export type IconName =
  | 'arrow-left'
  | 'arrow-right'
  | 'chevron-down'
  | 'chevron-up'
  | 'settings'
  | 'eye'
  | 'eye-off'
  | 'link'
  | 'copy'
  | 'close'
  | 'check'
  | 'bell'
  | 'globe'
  | 'clock'
  | 'logout'
  | 'mail'
  | 'lock'
  | 'list-ul'
  | 'grip'
  | 'plus'
  | 'minus';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export default function PulseIcon({
  name,
  size = 16,
  color = 'currentColor',
  strokeWidth = 1.6,
}: IconProps): React.ReactElement | null {
  const stroke = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'arrow-left':
      return (
        <Svg {...stroke}>
          <Path d="M15 6l-6 6 6 6" />
        </Svg>
      );
    case 'arrow-right':
      return (
        <Svg {...stroke}>
          <Path d="M9 6l6 6-6 6" />
        </Svg>
      );
    case 'chevron-down':
      return (
        <Svg {...stroke}>
          <Path d="M6 9l6 6 6-6" />
        </Svg>
      );
    case 'chevron-up':
      return (
        <Svg {...stroke}>
          <Path d="M18 15l-6-6-6 6" />
        </Svg>
      );
    case 'settings':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <Path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.03 7.03 0 0 0-1.69-.98l-.38-2.65A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.49.42l-.38 2.65c-.61.25-1.17.58-1.69.98l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65A.5.5 0 0 0 10 22h4a.5.5 0 0 0 .49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1a.5.5 0 0 0 .61-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
          />
        </Svg>
      );
    case 'eye':
      return (
        <Svg {...stroke}>
          <Path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
          <Circle cx="12" cy="12" r="2.6" />
        </Svg>
      );
    case 'eye-off':
      return (
        <Svg {...stroke}>
          <Path d="M3 3l18 18" />
          <Path d="M10.5 6.7A10.3 10.3 0 0112 6.5C18.5 6.5 22 12 22 12a18 18 0 01-3.2 3.7M6.5 7.7A18 18 0 002 12s3.5 6.5 10 6.5c1.6 0 3-.3 4.2-.8" />
          <Path d="M9.9 9.9a3 3 0 104.2 4.2" />
        </Svg>
      );
    case 'link':
      return (
        <Svg {...stroke}>
          <Path d="M14 4h6v6" />
          <Path d="M20 4l-9 9" />
          <Path d="M20 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1h5" />
        </Svg>
      );
    case 'copy':
      return (
        <Svg {...stroke}>
          <Rect x="9" y="9" width="13" height="13" rx="2" />
          <Path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </Svg>
      );
    case 'close':
      return (
        <Svg {...stroke}>
          <Path d="M6 6l12 12M18 6L6 18" />
        </Svg>
      );
    case 'check':
      return (
        <Svg {...stroke}>
          <Path d="M5 12l5 5L20 7" />
        </Svg>
      );
    case 'bell':
      return (
        <Svg {...stroke}>
          <Path d="M6 9a6 6 0 1112 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5z" />
          <Path d="M10 18a2 2 0 004 0" />
        </Svg>
      );
    case 'globe':
      return (
        <Svg {...stroke}>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
        </Svg>
      );
    case 'clock':
      return (
        <Svg {...stroke}>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M12 7v5l3.5 2" />
        </Svg>
      );
    case 'logout':
      return (
        <Svg {...stroke}>
          <Path d="M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4" />
          <Path d="M16 8l4 4-4 4M20 12H10" />
        </Svg>
      );
    case 'mail':
      return (
        <Svg {...stroke}>
          <Rect x="3" y="5" width="18" height="14" rx="2" />
          <Path d="M3 7l9 6 9-6" />
        </Svg>
      );
    case 'lock':
      return (
        <Svg {...stroke}>
          <Rect x="4" y="11" width="16" height="10" rx="2" />
          <Path d="M8 11V8a4 4 0 018 0v3" />
        </Svg>
      );
    case 'grip':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <Circle cx="8" cy="7" r="1.4" />
          <Circle cx="8" cy="12" r="1.4" />
          <Circle cx="8" cy="17" r="1.4" />
          <Circle cx="14" cy="7" r="1.4" />
          <Circle cx="14" cy="12" r="1.4" />
          <Circle cx="14" cy="17" r="1.4" />
        </Svg>
      );
    case 'list-ul':
      return (
        <Svg {...stroke}>
          <Circle cx="4" cy="6" r="1" fill={color} stroke="none" />
          <Circle cx="4" cy="12" r="1" fill={color} stroke="none" />
          <Circle cx="4" cy="18" r="1" fill={color} stroke="none" />
          <Path d="M8 6h13M8 12h13M8 18h13" />
        </Svg>
      );
    case 'plus':
      return (
        <Svg {...stroke}>
          <Path d="M12 4v16M4 12h16" />
        </Svg>
      );
    case 'minus':
      return (
        <Svg {...stroke}>
          <Path d="M4 12h16" />
        </Svg>
      );
    default:
      return null;
  }
}
