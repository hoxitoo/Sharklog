import { test, expect } from '@playwright/test';

// Runs against the dev server with VITE_OWNER_PRO=true (full PRO unlocked)

test.beforeEach(async ({ page }) => {
  // Clear localStorage so each test starts fresh
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test.describe('Onboarding', () => {
  test('shows onboarding wizard on first launch', async ({ page }) => {
    await expect(page.getByText('SharkLog')).toBeVisible();
    // Step 0: welcome screen
    await expect(page.getByText(/Добро пожаловать|Welcome/i)).toBeVisible();
  });

  test('can complete onboarding flow', async ({ page }) => {
    // Step 0 → step 1
    const nextBtn = page.getByRole('button', { name: /далее|next|продолжить/i }).first();
    await nextBtn.click();

    // Step 1 — bookmakers; go to step 2
    await nextBtn.click();

    // Step 2 — finish
    const finishBtn = page.getByRole('button', { name: /начать|go|поехали/i }).first();
    await finishBtn.click();

    // After onboarding we should see the main layout
    await expect(page.getByText('Дашборд')).toBeVisible();
  });
});

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Complete onboarding quickly
    await page.evaluate(() => {
      const existing = JSON.parse(localStorage.getItem('sharklog-data') ?? '{}');
      localStorage.setItem('sharklog-data', JSON.stringify({
        ...existing,
        settings: { ...(existing.settings ?? {}), onboardingComplete: true },
      }));
    });
    await page.reload();
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

test.describe('Add bet', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('sharklog-data', JSON.stringify({
        settings: { onboardingComplete: true, isPro: true },
      }));
    });
    await page.reload();
  });

  test('can open and close modal', async ({ page }) => {
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

    await page.fill('input[placeholder*="Team A"]', 'Arsenal vs Chelsea');
    await page.fill('input[placeholder*="П1"]', 'П1');
    await page.fill('input[placeholder="1.85"]', '1.85');
    await page.fill('input[placeholder="1000"]', '1000');

    await page.click('button[type="submit"]');

    // After submit the modal should close
    await expect(page.getByText('Новая ставка')).not.toBeVisible();

    // Bet should appear in the dashboard pending section or bets page
    await page.click('button:has-text("Ставки")');
    await expect(page.getByText('Arsenal vs Chelsea')).toBeVisible();
  });
});

test.describe('Bets page', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('sharklog-data', JSON.stringify({
        settings: { onboardingComplete: true, isPro: true },
        bets: [
          {
            id: 'test-bet-1',
            createdAt: '2024-01-15T12:00:00Z',
            updatedAt: '2024-01-15T12:00:00Z',
            date: '2024-01-15',
            time: '12:00',
            sport: 'football',
            bookmaker: 'Fonbet',
            event: 'Manchester City vs Liverpool',
            betType: '1X2',
            pick: 'П1',
            odds: 2.1,
            stake: 100_00,
            status: 'won',
            strategy: 'value',
            schemaVersion: 1,
          },
          {
            id: 'test-bet-2',
            createdAt: '2024-01-16T14:00:00Z',
            updatedAt: '2024-01-16T14:00:00Z',
            date: '2024-01-16',
            time: '14:00',
            sport: 'tennis',
            bookmaker: 'BetCity',
            event: 'Djokovic vs Nadal',
            betType: 'total',
            pick: 'ТБ 2.5',
            odds: 1.85,
            stake: 200_00,
            status: 'pending',
            strategy: 'statistics',
            schemaVersion: 1,
          },
        ],
      }));
    });
    await page.reload();
    await page.click('button:has-text("Ставки")');
  });

  test('lists bets grouped by date', async ({ page }) => {
    await expect(page.getByText('Manchester City vs Liverpool')).toBeVisible();
    await expect(page.getByText('Djokovic vs Nadal')).toBeVisible();
  });

  test('search filters bets', async ({ page }) => {
    await page.fill('input[placeholder*="Поиск"]', 'Djokovic');
    await expect(page.getByText('Djokovic vs Nadal')).toBeVisible();
    await expect(page.getByText('Manchester City')).not.toBeVisible();
  });

  test('status filter works', async ({ page }) => {
    await page.click('button:has-text("Победы")');
    await expect(page.getByText('Manchester City vs Liverpool')).toBeVisible();
    await expect(page.getByText('Djokovic')).not.toBeVisible();
  });
});

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('sharklog-data', JSON.stringify({
        settings: { onboardingComplete: true, isPro: true },
      }));
    });
    await page.reload();
  });

  test('navigates to all 6 pages', async ({ page }) => {
    const pages = [
      { nav: 'Дашборд',    heading: 'Дашборд' },
      { nav: 'Ставки',     heading: 'Ставки' },
      { nav: 'Аналитика',  heading: 'Аналитика' },
      { nav: 'Банкролл',   heading: 'Банкролл' },
      { nav: 'Дисциплина', heading: 'Дисциплина' },
      { nav: 'Настройки',  heading: 'Настройки' },
    ];

    for (const { nav, heading } of pages) {
      await page.click(`button:has-text("${nav}")`);
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
  });

  test('Ctrl+1..6 shortcuts navigate pages', async ({ page }) => {
    await page.keyboard.press('Control+2');
    await expect(page.getByRole('heading', { name: 'Ставки' })).toBeVisible();

    await page.keyboard.press('Control+5');
    await expect(page.getByRole('heading', { name: 'Дисциплина' })).toBeVisible();
  });
});

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('sharklog-data', JSON.stringify({
        settings: { onboardingComplete: true, isPro: true },
      }));
    });
    await page.reload();
    await page.click('button:has-text("Настройки")');
  });

  test('shows version info', async ({ page }) => {
    await expect(page.getByText('О приложении')).toBeVisible();
    await expect(page.getByText('0.1.0')).toBeVisible();
  });

  test('export CSV button exists', async ({ page }) => {
    await expect(page.getByRole('button', { name: /CSV/i })).toBeVisible();
  });
});
