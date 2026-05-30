import { useCallback, useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing } from 'react-native';

const W = Dimensions.get('window').width;

export function useSlideIn(onDismiss: () => void): {
  slideAnim: Animated.Value;
  dismiss: () => void;
} {
  const slideAnim = useRef(new Animated.Value(W)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const dismiss = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: W,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onDismiss());
  }, [onDismiss]);

  return { slideAnim, dismiss };
}
