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
