export const useSafeAreaInsets = jest.fn(() => ({
  top: 44,
  bottom: 34,
  left: 0,
  right: 0,
}));

export const SafeAreaProvider = 'SafeAreaProvider';
export const SafeAreaView = 'SafeAreaView';
export const SafeAreaConsumer = 'SafeAreaConsumer';
export const SafeAreaInsetsContext = { Consumer: 'SafeAreaInsetsContext.Consumer' };
export const initialWindowMetrics = {
  insets: { top: 44, bottom: 34, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 375, height: 812 },
};
