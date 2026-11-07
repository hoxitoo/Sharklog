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

  it('mounts the app only once the language is applied (review 2026-11-07)', () => {
    // A parent's effects run after its children's: mounted on isLoaded alone,
    // every screen's first render saw Russian, and onboarding guessed the
    // currency from it.
    expect(app).toMatch(/const appReady = isLoaded && fontsSettled && languageApplied;/);
    const langEffect = app.slice(app.indexOf('applyLanguage(language);'), app.indexOf('applyLanguage(language);') + 120);
    expect(langEffect).toMatch(/setLanguageApplied\(true\)/);
  });

  it('hides the app under the splash from screen readers (review 2026-11-07)', () => {
    expect(app.match(/<View style=\{FILL\} \{\.\.\.hiddenUnderSplash\}>/g) ?? []).toHaveLength(2);
    expect(app).toMatch(/importantForAccessibility: 'no-hide-descendants'/);
    expect(app).toMatch(/accessibilityElementsHidden: true/);
  });

  it('loads the icon font with the app fonts', () => {
    expect(app).toMatch(/\.\.\.Ionicons\.font/);
  });
});
