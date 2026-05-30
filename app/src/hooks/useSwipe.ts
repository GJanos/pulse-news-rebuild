import { useRef } from 'react';
import { PanResponder } from 'react-native';

const SWIPE_DISTANCE = 48;
const SWIPE_VELOCITY = 0.45;

export function useSwipe(onSwipeLeft?: () => void, onSwipeRight?: () => void) {
  const leftRef = useRef(onSwipeLeft);
  const rightRef = useRef(onSwipeRight);
  leftRef.current = onSwipeLeft;
  rightRef.current = onSwipeRight;

  return useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > SWIPE_DISTANCE || gs.vx > SWIPE_VELOCITY) rightRef.current?.();
        else if (gs.dx < -SWIPE_DISTANCE || gs.vx < -SWIPE_VELOCITY) leftRef.current?.();
      },
    }),
  ).current.panHandlers;
}
