import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { font, type Aesthetic, type Theme } from '../themes';
import PulseMark from '../components/PulseMark';

interface Props {
  theme: Theme;
  aes: Aesthetic;
}

export default function SplashScreen({ theme, aes }: Props): React.ReactElement {
  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <PulseMark size={72} color={theme.text} accent={theme.accent} />
      <View style={s.wordmark}>
        <Text
          style={{
            fontFamily: font(aes, 'title', 700),
            fontSize: 44,
            letterSpacing: -1,
            color: theme.text,
            lineHeight: 44,
          }}
        >
          Pulse
        </Text>
        <Text
          style={{
            fontFamily: font(aes, 'eyebrow', 600),
            fontSize: 11,
            letterSpacing: 2,
            color: theme.accent,
            lineHeight: 11,
            marginLeft: 10,
            textTransform: 'uppercase',
          }}
        >
          News
        </Text>
      </View>
      <Text
        style={{
          fontFamily: font(aes, 'body'),
          fontSize: 14,
          color: theme.textDim,
          marginTop: 16,
          marginBottom: 30,
          textAlign: 'center',
        }}
      >
        Preparing today's digest…
      </Text>
      <View style={s.dots}>
        <Dot delay={0} color={theme.accent} />
        <View style={{ marginLeft: 8 }}>
          <Dot delay={150} color={theme.accent} />
        </View>
        <View style={{ marginLeft: 8 }}>
          <Dot delay={300} color={theme.accent} />
        </View>
      </View>
    </View>
  );
}

function Dot({ delay, color }: { delay: number; color: string }): React.ReactElement {
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 360, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.35, { duration: 540, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(opacity);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: interpolate(opacity.value, [0.35, 1], [0.5, 1]) }],
  }));

  return (
    <Animated.View
      style={[{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color }, animStyle]}
    />
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wordmark: { flexDirection: 'row', alignItems: 'baseline', marginTop: 16 },
  dots: { flexDirection: 'row' },
});
