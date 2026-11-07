import { readFileSync } from 'fs';
import { join } from 'path';

/*
 * Launch work (audit 2026-11-06, item 14): the app's first render runs under
 * the splash, not after it; the reminder sync runs once, and re-issues
 * everything only when what the texts are baked from changed; the icon font
 * loads with the app's fonts.
 */
const app = readFileSync(join(__dirname, '..', '..', 'App.tsx'), 'utf8');

describe('startup', () => {
  it('plays the splash OVER the app, in both branches, on top of everything', () => {
    expect(app).toMatch(/const splash = splashDone \? null :/);
    // The overlay is the last child of each branch — above the tour, taking every touch.
    expect(app.match(/\{splash\}\s*<\/>/g) ?? []).toHaveLength(2);
    expect(app).not.toMatch(/if \(!splashDone \|\| !appReady\)/);
  });

  it('syncs reminders once at launch, re-issuing only when version, language or odds format changed', () => {
    expect(app).toMatch(/syncRemindersFor\(/);
    expect(app).toMatch(/\$\{APP_VERSION\}\|\$\{i18n\.language\}\|/);
    // The foreground reconcile does not run a second pass at launch.
    // Only the return to the app re-syncs — no bare call when the effect mounts.
    expect(app).toMatch(/if \(state === 'active'\) resyncBetReminders\(\);/);
    expect(app).not.toMatch(/^\s*resyncBetReminders\(\);/m);
  });

  it('loads the icon font with the app fonts', () => {
    expect(app).toMatch(/\.\.\.Ionicons\.font/);
  });
});
