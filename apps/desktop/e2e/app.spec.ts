import { test, expect } from '@playwright/test';

// Helpers
async function skipOnboarding(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    localStorage.setItem('sharklog-data', JSON.stringify({
      bets: [], diary: [], teams: [],
      settings: { onboardingComplete: true, isPro: true, bookmakers: ['Fonbet'], tiltThreshold: 3, dailyBetLimit: 0, schemaVersion: 1 },
      bankroll: { id: 'default', name: 'Основной банк', currency: 'RUB', unitPercent: 2, transactions: [], createdAt: new Date().toISOString() },
    }));
  });
  await page.reload();
}

async function skipOnboardingWithBets(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    localStorage.setItem('sharklog-data', JSON.stringify({
      diary: [], teams: [],
      settings: { onboardingComplete: true, isPro: true, bookmakers: ['Fonbet'], tiltThreshold: 3, dailyBetLimit: 0, schemaVersion: 1 },
      bankroll: { id: 'default', name: 'Основной банк', currency: 'RUB', unitPercent: 2, transactions: [], createdAt: new Date().toISOString() },
      bets: [
        {
          id: 'b1', createdAt: '2024-01-15T12:00:00Z', updatedAt: '2024-01-15T12:00:00Z',
          date: '2024-01-15', time: '12:00', sport: 'football', bookmaker: 'Fonbet',
          event: 'Manchester City vs Liverpool', betType: '1X2', pick: 'П1',
          odds: 2.1, stake: 10000, status: 'won', strategy: 'value', schemaVersion: 1,
        },
        {
          id: 'b2', createdAt: '2024-01-16T14:00:00Z', updatedAt: '2024-01-16T14:00:00Z',
          date: '2024-01-16', time: '14:00', sport: 'tennis', bookmaker: 'BetCity',
          event: 'Djokovic vs Nadal', betType: 'total', pick: 'ТБ 2.5',
          odds: 1.85, stake: 20000, status: 'pending', strategy: 'statistics', schemaVersion: 1,
        },
      ],
    }));
  });
  await page.reload();
}

// ─────────────────────────────────────────────────────────
// Onboarding
// ─────────────────────────────────────────────────────────

test.describe('Onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('shows welcome screen on first launch', async ({ page }) => {
    await expect(page.getByText('Добро пожаловать в SharkLog')).toBeVisible();
  });

  test('can navigate through all 3 steps', async ({ page }) => {
    // Step 0 → step 1
    await page.click('button:has-text("Начать")');
    await expect(page.getByText('Выбери букмекеров')).toBeVisible();

    // Step 1 → step 2
    await page.click('button:has-text("Далее")');
    await expect(page.getByText('Всё готово!')).toBeVisible();
  });

  test('finish without bet navigates to main app', async ({ page }) => {
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
    await page.goto('/');
    await skipOnboarding(page);
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

  test('shows stats when bets exist', async ({ page }) => {
    await skipOnboardingWithBets(page);
    await expect(page.getByText('P&L')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────
// Add bet modal
// ─────────────────────────────────────────────────────────

test.describe('Add bet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await skipOnboarding(page);
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

    // Event field (TeamAutocomplete placeholder: "NaVi vs Virtus.pro")
    await page.fill('input[placeholder="NaVi vs Virtus.pro"]', 'Arsenal vs Chelsea');
    await page.fill('input[placeholder*="П1"]', 'П1');
    await page.fill('input[placeholder="1.85"]', '1.85');
    await page.fill('input[placeholder="1000"]', '1000');

    await page.click('button[type="submit"]');
    await expect(page.getByText('Новая ставка')).not.toBeVisible();

    // Check bets page
    await page.click('button:has-text("Ставки")');
    await expect(page.getByText('Arsenal vs Chelsea')).toBeVisible();
  });

  test('shows potential win preview when odds and stake are filled', async ({ page }) => {
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
    await page.goto('/');
    await skipOnboardingWithBets(page);
    await page.click('button:has-text("Ставки")');
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

  test('clearing search restores all bets', async ({ page }) => {
    await page.fill('input[placeholder*="Поиск"]', 'Djokovic');
    await page.fill('input[placeholder*="Поиск"]', '');
    await expect(page.getByText('Manchester City vs Liverpool')).toBeVisible();
    await expect(page.getByText('Djokovic vs Nadal')).toBeVisible();
  });

  test('status filter shows only won bets', async ({ page }) => {
    await page.click('button:has-text("Победы")');
    await expect(page.getByText('Manchester City vs Liverpool')).toBeVisible();
    await expect(page.getByText('Djokovic vs Nadal')).not.toBeVisible();
  });

  test('empty state with search shows correct message', async ({ page }) => {
    await page.fill('input[placeholder*="Поиск"]', 'нет такой команды xyz');
    await expect(page.getByText('Ничего не найдено')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────────

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await skipOnboarding(page);
  });

  test('navigates to all 6 pages via sidebar', async ({ page }) => {
    const pages = ['Ставки', 'Аналитика', 'Банкролл', 'Дисциплина', 'Настройки', 'Дашборд'];
    for (const nav of pages) {
      await page.click(`button:has-text("${nav}")`);
      await expect(page.locator('h1').first()).toBeVisible();
    }
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
    await page.goto('/');
    await skipOnboarding(page);
    await page.click('button:has-text("Настройки")');
  });

  test('shows version info card', async ({ page }) => {
    await expect(page.getByText('О приложении')).toBeVisible();
    await expect(page.getByText('0.1.0')).toBeVisible();
  });

  test('export CSV button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Экспорт CSV|CSV/i }).first()).toBeVisible();
  });
});
