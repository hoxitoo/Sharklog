import appJson from '../../app.json';
import { ANDROID_PACKAGE, storeReviewUrls } from '../utils/storeLinks';

describe('store links', () => {
  it('use the package the app is actually published under', () => {
    expect(ANDROID_PACKAGE).toBe(appJson.expo.android.package);
  });

  it('open the Play Store app first, the web page as the fallback', () => {
    expect(storeReviewUrls('android')).toEqual([
      `market://details?id=${ANDROID_PACKAGE}`,
      `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
    ]);
  });

  it('send nowhere on iOS until there is an App Store id', () => {
    expect(storeReviewUrls('ios', '')).toBeNull();
    expect(storeReviewUrls('ios', '123')?.[0]).toBe('itms-apps://apps.apple.com/app/id123?action=write-review');
  });
});
