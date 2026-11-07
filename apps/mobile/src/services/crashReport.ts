import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import i18n from '../i18n';
import { APP_VERSION } from '../utils/appVersion';
import { distribution } from '../utils/storeLinks';
import { BILLING } from './billing';
import {
  buildErrorReport, crashToSave, parseSavedCrash, savedCrashError, type ErrorReportInput,
} from '../utils/errorReport';
import { makeFatalHandler, type GlobalHandler } from '../utils/fatalHandler';

/*
 * Our own error reporting, in place of a crash service (Sentry was removed: it
 * never had a key, weighed a quarter of the bundle, and would have sent device
 * data abroad without the user's say). The report is a text the USER sends to
 * the author — ErrorReportSheet shows it first. Three ways an error reaches it:
 *  - the error screen (ErrorBoundary) — a render error, the app still runs;
 *  - the data-read error screen (StorageErrorScreen);
 *  - a crash: an error outside rendering (an event handler, a timer) closes the
 *    app, and no screen ever shows it. The global handler keeps it, and the
 *    next launch offers the report (App.tsx). A render error no boundary
 *    caught does NOT pass through that handler (React Native sends it straight
 *    to ExceptionsManager): RootCrashBoundary around the whole app keeps those.
 */

/** The fatal error the last session closed with (one at a time: the newest wins). */
export const LAST_CRASH_KEY = '@sharklog/last_crash';

/** The report text for an error, with this phone's details. */
export function reportFor(
  error: unknown,
  where: ErrorReportInput['where'],
  extra: { componentStack?: string | null; at?: Date; version?: string } = {},
): string {
  return buildErrorReport({
    error,
    where,
    componentStack: extra.componentStack ?? null,
    app: { version: extra.version ?? APP_VERSION, build: `${distribution()}/${BILLING}` },
    system: { os: Platform.OS, version: Platform.Version },
    language: i18n.language,
    at: extra.at ?? new Date(),
  });
}

interface ErrorUtilsLike {
  getGlobalHandler(): GlobalHandler;
  setGlobalHandler(handler: GlobalHandler): void;
}

/** How long a crash waits for its save before the default handler closes the app. */
const SAVE_WAIT_MS = 1_500;
let installed = false;

/** Keep an error for the next launch, which offers its report (App.tsx). */
export function recordCrash(error: unknown): Promise<void> {
  try {
    return AsyncStorage.setItem(LAST_CRASH_KEY, JSON.stringify(crashToSave(error, new Date(), APP_VERSION)))
      .then(() => {}, () => {});
  } catch {
    return Promise.resolve();
  }
}

/**
 * Keep a FATAL error for the next launch (utils/fatalHandler has the rules).
 * Not in development: there the red screen shows the error, and keeping each
 * one would greet every reload with a crash prompt.
 */
export function installCrashCapture(): void {
  if (installed || __DEV__) return;
  const eu = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!eu) return;
  installed = true;
  eu.setGlobalHandler(makeFatalHandler({
    previous: eu.getGlobalHandler(),
    save: recordCrash,
    waitMs: SAVE_WAIT_MS,
    schedule: (fn, ms) => { setTimeout(fn, ms); },
  }));
}

/** The crash the last session closed with, as report text — forgotten as it is read, so it is offered once. */
export async function takeLastCrashReport(): Promise<string | null> {
  try {
    const text = await AsyncStorage.getItem(LAST_CRASH_KEY);
    if (text === null) return null;
    await AsyncStorage.removeItem(LAST_CRASH_KEY);
    const crash = parseSavedCrash(text);
    if (!crash) return null;
    return reportFor(savedCrashError(crash), 'crash', { at: new Date(crash.at), version: crash.version });
  } catch {
    return null;
  }
}
