// Mock @tauri-apps/plugin-sql so tests never try to open SQLite
vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn() },
}));

// Mock the storage service: tests control what loadData returns
vi.mock('../storage/storageService', () => ({
  loadData: vi.fn().mockResolvedValue(null),
  saveData: vi.fn().mockResolvedValue(undefined),
}));

// Mock import.meta.env
Object.defineProperty(import.meta, 'env', {
  value: { VITE_OWNER_PRO: undefined },
  writable: true,
  configurable: true,
});
