import React from 'react';
import { Pressable } from 'react-native';
import type { PressableProps } from 'react-native';

interface PressableScaleProps extends PressableProps {
  activeScale?: number;
}

export const PressableScale: React.FC<PressableScaleProps> = ({
  activeScale: _activeScale,
  ...props
}) => React.createElement(Pressable, props);
