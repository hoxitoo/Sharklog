let store: Record<string, string> = {};

export default {
  getItem: jest.fn(async (key: string) => store[key] ?? null),
  setItem: jest.fn(async (key: string, value: string) => { store[key] = value; }),
  removeItem: jest.fn(async (key: string) => { delete store[key]; }),
  clear: jest.fn(async () => { store = {}; }),
  getAllKeys: jest.fn(async () => Object.keys(store)),
  multiGet: jest.fn(async (keys: string[]) => keys.map((k) => [k, store[k] ?? null])),
};
