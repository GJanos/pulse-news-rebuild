import React from 'react';
import { View, Text } from 'react-native';
import { PressableScale } from 'react-native-pressable-scale';
import { font, type Aesthetic, type Theme } from '../themes';
import PulseIcon from './Icon';

interface StepperProps {
  theme: Theme;
  aes: Aesthetic;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  /** Append a unit label after the number (text variant only). */
  suffix?: string;
  /** Use icon minus/plus buttons instead of text − / +. */
  icons?: boolean;
  /** Override the value label colour (icon variant only). */
  valueColor?: string;
}

export default function Stepper({
  theme,
  aes,
  value,
  min,
  max,
  onChange,
  suffix,
  icons = false,
  valueColor,
}: StepperProps): React.ReactElement {
  if (icons) {
    const btn = {
      width: 28,
      height: 28,
      borderRadius: 7,
      backgroundColor: theme.chip,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    };
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <PressableScale
          accessible={true}
          accessibilityRole="button"
          onPress={() => onChange(Math.max(min, value - 1))}
          hitSlop={6}
          activeScale={0.78}
          style={[btn, { opacity: value <= min ? 0.25 : 1 }]}
        >
          <PulseIcon name="minus" size={14} color={theme.text} strokeWidth={2.2} />
        </PressableScale>
        <Text
          style={{
            fontFamily: font(aes, 'number', 600),
            fontSize: 14,
            color: valueColor ?? theme.text,
            minWidth: 18,
            textAlign: 'center',
            marginHorizontal: 6,
          }}
        >
          {value}
        </Text>
        <PressableScale
          accessible={true}
          accessibilityRole="button"
          onPress={() => onChange(Math.min(max, value + 1))}
          hitSlop={6}
          activeScale={0.78}
          style={[btn, { opacity: value >= max ? 0.25 : 1 }]}
        >
          <PulseIcon name="plus" size={14} color={theme.text} strokeWidth={2.2} />
        </PressableScale>
      </View>
    );
  }

  const btn = {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: theme.chip,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <PressableScale
        accessible={true}
        accessibilityRole="button"
        onPress={() => onChange(Math.max(min, value - 1))}
        activeScale={0.78}
        style={[btn, { opacity: value <= min ? 0.4 : 1 }]}
      >
        <Text style={{ fontSize: 16, color: theme.text }}>−</Text>
      </PressableScale>
      <Text
        style={{
          minWidth: 34,
          textAlign: 'center',
          fontFamily: font(aes, 'number'),
          fontSize: 15,
          color: theme.text,
          letterSpacing: 0.1,
          marginHorizontal: 6,
        }}
      >
        {value}
        {suffix ?? ''}
      </Text>
      <PressableScale
        accessible={true}
        accessibilityRole="button"
        onPress={() => onChange(Math.min(max, value + 1))}
        activeScale={0.78}
        style={[btn, { opacity: value >= max ? 0.4 : 1 }]}
      >
        <Text style={{ fontSize: 16, color: theme.text }}>+</Text>
      </PressableScale>
    </View>
  );
}
