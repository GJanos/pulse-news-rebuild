const mockStore = new Map<string, string>();

const mockMMKV = {
  getString: (key: string): string | undefined => mockStore.get(key),
  set: (key: string, value: string): void => {
    mockStore.set(key, value);
  },
  delete: (key: string): void => {
    mockStore.delete(key);
  },
  remove: (key: string): boolean => {
    const e = mockStore.has(key);
    mockStore.delete(key);
    return e;
  },
  clearAll: (): void => {
    mockStore.clear();
  },
  contains: (key: string): boolean => mockStore.has(key),
  getAllKeys: (): string[] => Array.from(mockStore.keys()),
};

export const createMMKV = jest.fn().mockReturnValue(mockMMKV);
