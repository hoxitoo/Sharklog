import appConfig from '../../app.json';

/**
 * The version the build carries — read from app.json, the file EAS builds
 * from. It used to be a second hand-typed '1.0.0' in Settings (and a third
 * in analytics), and a release that bumped app.json alone would have shown
 * the old number and kept reporting "update available" for itself.
 */
export const APP_VERSION: string = appConfig.expo.version;
