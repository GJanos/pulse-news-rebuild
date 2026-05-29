import React from 'react';
import { Text, View } from 'react-native';

interface FlagProps {
  /** ISO 3166-1 alpha-2 country code (e.g. "HU", "UA"). */
  country: string;
  width: number;
  height: number;
}

function toFlagEmoji(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .split('')
    .map((ch) => String.fromCodePoint(0x1f1e6 - 65 + ch.charCodeAt(0)))
    .join('');
}

export default function Flag({ country, width, height }: FlagProps): React.ReactElement {
  const fontSize = Math.round(Math.min(width, height) * 1.15);
  return (
    <View
      style={{ width, height, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
    >
      <Text style={{ fontSize, lineHeight: fontSize + 2 }} numberOfLines={1}>
        {toFlagEmoji(country)}
      </Text>
    </View>
  );
}
