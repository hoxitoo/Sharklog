/*
 * Where the app lives outside itself. No React Native runtime here, so the
 * logic is under test (`__tests__/storeLinks.test.ts`, which also holds the
 * package name to app.json — two copies of an id drift apart quietly).
 */

export const LANDING_URL = 'https://hoxitoo.github.io/Sharklog/';

export const ANDROID_PACKAGE = 'app.sharklog.mobile';

/**
 * Where "Message the author" goes. Deliberately NOT written here: this repo is
 * public and tied to the author, and the support contact must not lead back
 * to them. It comes from `EXPO_PUBLIC_SUPPORT_URL` — `apps/mobile/.env.local`
 * (gitignored) for local builds, EAS environment variables for store builds.
 * Unset means no row, rather than a link to nowhere.
 */
export function supportUrl(raw: string | undefined = process.env['EXPO_PUBLIC_SUPPORT_URL']): string | null {
  const url = raw?.trim() ?? '';
  return url.startsWith('https://') ? url : null;
}

/**
 * Where this build is installed from — `EXPO_PUBLIC_DISTRIBUTION`, set in
 * every EAS profile:
 * - `rustore` — RuStore;
 * - `store` — the platform's own store (Google Play, the App Store);
 * - anything else — an APK installed by hand (GitHub releases, testers).
 *
 * A store build sends "rate" to ITS store and leaves updates to it. The RuStore
 * build used to open Google Play, where the app is not, and its GitHub update
 * check compared against the latest release tag — the desktop's included — so
 * it announced versions RuStore did not have yet.
 */
export type Distribution = 'rustore' | 'store' | 'direct';

export function distribution(raw: string | undefined = process.env['EXPO_PUBLIC_DISTRIBUTION']): Distribution {
  const v = raw?.trim();
  return v === 'rustore' || v === 'store' ? v : 'direct';
}

/**
 * The numeric App Store id. Empty until the app is created in App Store
 * Connect (`ascAppId` in eas.json is still a placeholder too) — and while it is
 * empty the "rate" row is not shown on iOS, rather than opening a dead link.
 */
export const APP_STORE_ID = '';

/**
 * The review page in the store: the native scheme first (opens the store app),
 * the web page as the fallback for a device without it. `null` when there is
 * nowhere to send the user yet — an APK installed by hand has no store page
 * to rate it on.
 *
 * A button opens the store page instead of the in-app review prompt on
 * purpose: the system rate-limits that prompt and may show nothing at all,
 * which a tapped button cannot afford.
 */
export function storeReviewUrls(
  os: string,
  dist: Distribution = distribution(),
  appStoreId = APP_STORE_ID,
): readonly string[] | null {
  if (os === 'android') {
    if (dist === 'rustore') {
      // The app's page by its web address only. A `rustore://` deeplink to an
      // app card is a guess (only the developer page's form is documented), and
      // RuStore takes ANY rustore:// link — a wrong path would open its home
      // screen, and the fallback would never be tried.
      return [`https://apps.rustore.ru/app/${ANDROID_PACKAGE}`];
    }
    if (dist === 'store') {
      return [
        `market://details?id=${ANDROID_PACKAGE}`,
        `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
      ];
    }
    return null;
  }
  if (os === 'ios' && dist === 'store' && appStoreId) {
    return [
      `itms-apps://apps.apple.com/app/id${appStoreId}?action=write-review`,
      `https://apps.apple.com/app/id${appStoreId}?action=write-review`,
    ];
  }
  return null;
}
