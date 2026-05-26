const mockStore = new Map<string, string>();

const mockMMKV = {
  getString: (key: string): string | undefined => mockStore.get(key),
  set: (key: string, value: string): void => {
    mockStore.set(key, value);
  },
  remove: (key: string): boolean => {
    const existed = mockStore.has(key);
    mockStore.delete(key);
    return existed;
  },
  clearAll: (): void => {
    mockStore.clear();
  },
  contains: (key: string): boolean => mockStore.has(key),
};

export const createMMKV = jest.fn().mockReturnValue(mockMMKV);
