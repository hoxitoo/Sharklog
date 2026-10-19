/*
 * Which GitHub release a hand-installed APK can update to. Pure, so under test
 * (`__tests__/appUpdates.test.ts`); the Settings screen does the fetching.
 *
 * Only an APK installed by hand asks — store builds are updated by the store
 * (see `distribution()` in storeLinks). And only releases that SHIP an APK
 * count: the repository's releases are mostly the desktop's (installers, no
 * APK), and "latest release" used to be whatever was tagged last — a desktop
 * 0.1.0 would have told a phone on 1.0.0 that "0.1.0 is available".
 */

interface Release { tag_name?: unknown; draft?: unknown; assets?: unknown }

const hasApk = (r: Release) =>
  Array.isArray(r.assets) && r.assets.some((a) => typeof a?.name === 'string' && a.name.toLowerCase().endsWith('.apk'));

/** Numeric parts of a version: "v1.2.10" → [1, 2, 10]. */
function parts(version: string): number[] {
  return version.replace(/^v/i, '').split('.').map((p) => parseInt(p, 10) || 0);
}

/** Whether `remote` is a later version than `local` — "1.0" and "1.0.0" are the same. */
export function isNewerVersion(remote: string, local: string): boolean {
  const a = parts(remote), b = parts(local);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

/** The highest version among published releases that carry an APK, or null when there is none. */
export function latestApkVersion(releases: unknown): string | null {
  if (!Array.isArray(releases)) return null;
  let best: string | null = null;
  for (const r of releases as Release[]) {
    if (!r || r.draft === true || typeof r.tag_name !== 'string' || !hasApk(r)) continue;
    const v = r.tag_name.replace(/^v/i, '');
    if (best === null || isNewerVersion(v, best)) best = v;
  }
  return best;
}
