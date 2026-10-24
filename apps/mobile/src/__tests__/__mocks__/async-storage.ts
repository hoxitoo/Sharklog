let store: Record<string, string> = {};

export default {
  getItem: jest.fn(async (key: string) => store[key] ?? null),
  setItem: jest.fn(async (key: string, value: string) => { store[key] = value; }),
  removeItem: jest.fn(async (key: string) => { delete store[key]; }),
  clear: jest.fn(async () => { store = {}; }),
  getAllKeys: jest.fn(async () => Object.keys(store)),
  // The v3 API the app is built against (package.json pins 3.x): getMany, not
  // the old multiGet — a mock with the old name let code that calls it pass
  // here and fail on the phone.
  getMany: jest.fn(async (keys: string[]) => Object.fromEntries(keys.map((k) => [k, store[k] ?? null]))),
};
