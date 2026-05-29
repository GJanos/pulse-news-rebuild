const Reanimated = {
  default: {
    View: require('react-native').View,
    createAnimatedComponent: (c: unknown) => c,
  },
  useSharedValue: (v: unknown) => ({ value: v }),
  useAnimatedStyle: (fn: () => unknown) => fn(),
  withTiming: (v: unknown) => v,
  withSpring: (v: unknown) => v,
  cancelAnimation: () => undefined,
  interpolate: (_v: unknown, _i: number[], output: number[]) => output[0],
  Extrapolation: { CLAMP: 'clamp' },
  runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
};

module.exports = Reanimated;
