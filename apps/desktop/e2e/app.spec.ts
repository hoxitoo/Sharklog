import { test, expect, type Page } from '@playwright/test';

const SCHEMA_VERSION = 2;

const BASE_SETTINGS = {
  onboardingComplete: true,
  isPro: true,
  bookmakers: ['Fonbet'],
  tiltThreshold: 3,
  dailyBetLimit: 0,
  reminderHour: 20,
  schemaVersion: SCHEMA_VERSION,
};

const BASE_BANKROLL = {
  id: 'default',
  name: 'Основной банк',
  currency: 'RUB',
  unitPercent: 2,
  transactions: [],
  createdAt: '2024-01-01T00:00:00Z',
};

const SAMPLE_BETS = [
  {
    id: 'b1', createdAt: '2024-01-15T12:00:00Z', updatedAt: '2024-01-15T12:00:00Z',
    date: '2024-01-15', time: '12:00', sport: 'football', bookmaker: 'Fonbet',
    event: 'Manchester City vs Liverpool', betType: '1X2', pick: 'П1',
    odds: 2.1, stake: 10000, status: 'won', strategy: 'value', schemaVersion: SCHEMA_VERSION,
  },
  {
    id: 'b2', createdAt: '2024-01-16T14:00:00Z', updatedAt: '2024-01-16T14:00:00Z',
    date: '2024-01-16', time: '14:00', sport: 'tennis', bookmaker: 'BetCity',
    event: 'Djokovic vs Nadal', betType: 'total', pick: 'ТБ 2.5',
    odds: 1.85, stake: 20000, status: 'pending', strategy: 'statistics', schemaVersion: SCHEMA_VERSION,
  },
];

// Inject localStorage BEFORE React loads — prevents race condition with store.load()
function injectData(data: object) {
  return (page: Page) =>
    page.addInitScript((d) => {
      localStorage.setItem('sharklog-data', JSON.stringify(d));
    }, { ...data, version: SCHEMA_VERSION });
}

const withMainApp = injectData({
  bets: [], diary: [], teams: [],
  settings: BASE_SETTINGS,
  bankroll: BASE_BANKROLL,
});

const withBets = injectData({
  bets: SAMPLE_BETS, diary: [], teams: [],
  settings: BASE_SETTINGS,
  bankroll: BASE_BANKROLL,
});

const withOnboarding = (page: Page) =>
  page.addInitScript(() => localStorage.clear());

// ─────────────────────────────────────────────────────────
// Onboarding
// ─────────────────────────────────────────────────────────

test.describe('Onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await withOnboarding(page);
    await page.goto('/');
    // Wait for app to finish loading (isLoaded=true)
    await page.waitForSelector('text=Добро пожаловать в SharkLog', { timeout: 10000 });
  });

  test('shows welcome screen on first launch', async ({ page }) => {
    await expect(page.getByText('Добро пожаловать в SharkLog')).toBeVisible();
  });

  test('can navigate through all 3 steps', async ({ page }) => {
    await page.click('button:has-text("Начать")');
    await expect(page.getByText('Выбери букмекеров')).toBeVisible();

    await page.click('button:has-text("Далее")');
    await expect(page.getByText('Всё готово!')).toBeVisible();
  });

  test('finish without bet shows main app', async ({ page }) => {
    await page.click('button:has-text("Начать")');
    await page.click('button:has-text("Далее")');
    await page.click('button:has-text("Начать без ставки")');
    await expect(page.getByText('Ставок пока нет')).toBeVisible();
  });

  test('back button returns to previous step', async ({ page }) => {
    await page.click('button:has-text("Начать")');
    await page.click('button:has-text("← Назад")');
    await expect(page.getByText('Добро пожаловать в SharkLog')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await withMainApp(page);
    await page.goto('/');
    await page.waitForSelector('text=Дашборд', { timeout: 10000 });
  });

  test('shows empty state when no bets', async ({ page }) => {
    await expect(page.getByText('Ставок пока нет')).toBeVisible();
  });

  test('shows Ctrl+N hint in empty state', async ({ page }) => {
    await expect(page.getByText(/Ctrl\+N/)).toBeVisible();
  });

  test('Ctrl+N opens add bet modal', async ({ page }) => {
    await page.keyboard.press('Control+n');
    await expect(page.getByText('Новая ставка')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────
// Dashboard with bets
// ─────────────────────────────────────────────────────────

test.describe('Dashboard with bets', () => {
  test.beforeEach(async ({ page }) => {
    await withBets(page);
    await page.goto('/');
    await page.waitForSelector('text=Дашборд', { timeout: 10000 });
  });

  test('shows stat cards when bets exist', async ({ page }) => {
    await expect(page.getByText('P&L')).toBeVisible();
    await expect(page.getByText('Винрейт')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────
// Add bet modal
// ─────────────────────────────────────────────────────────

test.describe('Add bet', () => {
  test.beforeEach(async ({ page }) => {
    await withMainApp(page);
    await page.goto('/');
    await page.waitForSelector('text=Дашборд', { timeout: 10000 });
  });

  test('can open and close modal via Escape', async ({ page }) => {
    await page.click('button:has-text("+ Новая ставка")');
    await expect(page.getByText('Новая ставка')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Новая ставка')).not.toBeVisible();
  });

  test('shows validation errors on empty submit', async ({ page }) => {
    await page.click('button:has-text("+ Новая ставка")');
    await page.click('button[type="submit"]');
    await expect(page.getByText('Введи название события')).toBeVisible();
  });

  test('can fill and submit a bet', async ({ page }) => {
    await page.click('button:has-text("+ Новая ставка")');
    await page.fill('input[placeholder="NaVi vs Virtus.pro"]', 'Arsenal vs Chelsea');
    await page.fill('input[placeholder="П1, ТБ 2.5, Ф1(-1.5)..."]', 'П1');
    await page.fill('input[placeholder="1.85"]', '1.85');
    await page.fill('input[placeholder="1000"]', '1000');
    await page.click('button[type="submit"]');
    await expect(page.getByText('Новая ставка')).not.toBeVisible();

    await page.click('button:has-text("Ставки")');
    await expect(page.getByText('Arsenal vs Chelsea')).toBeVisible();
  });

  test('shows potential win preview', async ({ page }) => {
    await page.click('button:has-text("+ Новая ставка")');
    await page.fill('input[placeholder="1.85"]', '2.0');
    await page.fill('input[placeholder="1000"]', '1000');
    await expect(page.getByText('Потенциальный выигрыш')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────
// Bets page
// ─────────────────────────────────────────────────────────

test.describe('Bets page', () => {
  test.beforeEach(async ({ page }) => {
    await withBets(page);
    await page.goto('/');
    await page.click('button:has-text("Ставки")');
    await page.waitForSelector('text=Manchester City vs Liverpool', { timeout: 10000 });
  });

  test('lists both bets', async ({ page }) => {
    await expect(page.getByText('Manchester City vs Liverpool')).toBeVisible();
    await expect(page.getByText('Djokovic vs Nadal')).toBeVisible();
  });

  test('search filters bets', async ({ page }) => {
    await page.fill('input[placeholder*="Поиск"]', 'Djokovic');
    await expect(page.getByText('Djokovic vs Nadal')).toBeVisible();
    await expect(page.getByText('Manchester City vs Liverpool')).not.toBeVisible();
  });

  test('status filter shows won bets only', async ({ page }) => {
    await page.click('button:has-text("Победы")');
    await expect(page.getByText('Manchester City vs Liverpool')).toBeVisible();
    await expect(page.getByText('Djokovic vs Nadal')).not.toBeVisible();
  });

  test('empty search shows correct message', async ({ page }) => {
    await page.fill('input[placeholder*="Поиск"]', 'xyz-нет-такой-команды');
    await expect(page.getByText('Ничего не найдено')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────────

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await withMainApp(page);
    await page.goto('/');
    await page.waitForSelector('text=Дашборд', { timeout: 10000 });
  });

  test('sidebar navigates to Bets page', async ({ page }) => {
    await page.click('button:has-text("Ставки")');
    await expect(page.getByRole('heading', { name: 'Ставки' })).toBeVisible();
  });

  test('sidebar navigates to Settings page', async ({ page }) => {
    await page.click('button:has-text("Настройки")');
    await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible();
  });

  test('Ctrl+2 navigates to Bets page', async ({ page }) => {
    await page.keyboard.press('Control+2');
    await expect(page.getByRole('heading', { name: 'Ставки' })).toBeVisible();
  });

  test('Ctrl+6 navigates to Settings page', async ({ page }) => {
    await page.keyboard.press('Control+6');
    await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await withMainApp(page);
    await page.goto('/');
    await page.click('button:has-text("Настройки")');
    await page.waitForSelector('text=Настройки', { timeout: 10000 });
  });

  test('shows О приложении card', async ({ page }) => {
    await expect(page.getByText('О приложении')).toBeVisible();
  });

  test('shows export button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Экспорт|CSV/i }).first()).toBeVisible();
  });
});
