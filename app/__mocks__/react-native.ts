export const Linking = {
  getInitialURL: jest.fn().mockResolvedValue(null),
  addEventListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
};

export const AppState = {
  addEventListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
};

// Minimal host-component stubs for component tests
export const View = 'View';
export const Text = 'Text';
export const Pressable = 'Pressable';
export const TouchableOpacity = 'TouchableOpacity';
export const ScrollView = 'ScrollView';
export const FlatList = 'FlatList';
export const StyleSheet = {
  create: (styles: Record<string, unknown>) => styles,
  flatten: (style: unknown) => style,
};
export const Platform = {
  OS: 'android',
  select: (obj: Record<string, unknown>) => obj.android ?? obj.default,
};
export const Dimensions = { get: () => ({ width: 375, height: 812 }) };
