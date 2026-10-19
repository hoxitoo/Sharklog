import { isNewerVersion, latestApkVersion } from '../utils/appUpdates';

const apk = (tag: string, extra: object = {}) => ({ tag_name: tag, assets: [{ name: `sharklog.${tag}.apk` }], ...extra });
const desktop = (tag: string) => ({ tag_name: tag, assets: [{ name: 'SharkLog_x64.msi' }, { name: 'SharkLog.dmg' }] });

describe('app updates from GitHub', () => {
  it('count only releases that ship an APK — a desktop release is not an update for the phone', () => {
    expect(latestApkVersion([desktop('v0.1.0'), apk('v1.0')])).toBe('1.0');
    expect(latestApkVersion([desktop('v2.0.0')])).toBeNull();
  });

  it('take the highest version, not the latest tagged, and skip drafts', () => {
    expect(latestApkVersion([apk('v1.0.2'), apk('v1.1.0'), apk('v1.0.10')])).toBe('1.1.0');
    expect(latestApkVersion([apk('v1.2.0', { draft: true }), apk('v1.1.0')])).toBe('1.1.0');
  });

  it('survive a response that is not a list of releases', () => {
    expect(latestApkVersion({ message: 'API rate limit exceeded' })).toBeNull();
    expect(latestApkVersion([null, { tag_name: 5 }, { tag_name: 'v1', assets: 'x' }])).toBeNull();
  });

  it('call a version newer only when it is: an older release is not "available"', () => {
    expect(isNewerVersion('1.0.1', '1.0.0')).toBe(true);
    expect(isNewerVersion('1.10.0', '1.9.0')).toBe(true);
    expect(isNewerVersion('1.0', '1.0.0')).toBe(false);
    expect(isNewerVersion('0.1.0', '1.0.0')).toBe(false);
    expect(isNewerVersion('v1.0.0', '1.0.0')).toBe(false);
  });
});
