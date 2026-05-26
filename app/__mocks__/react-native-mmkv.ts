class MockMMKV {
  private _store = new Map<string, string>();

  getString(key: string): string | undefined {
    return this._store.get(key);
  }

  set(key: string, value: string): void {
    this._store.set(key, value);
  }

  delete(key: string): void {
    this._store.delete(key);
  }

  clearAll(): void {
    this._store.clear();
  }

  contains(key: string): boolean {
    return this._store.has(key);
  }
}

export const MMKV = jest.fn().mockImplementation(() => new MockMMKV());
