import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildErrorReport, crashToSave, parseSavedCrash, savedCrashError, REPORT_LIMITS, type ErrorReportInput,
} from '../utils/errorReport';

/*
 * Our own error report replaced Sentry (removed 2026-11-06): the user reads the
 * text and sends it themselves. What these tests hold: the report says what the
 * author needs (the error, where, the app and system) in a size that fits a
 * chat message, and a crash saved for the next launch reads back — or reads as
 * nothing, never as a broken report.
 */

const base: Omit<ErrorReportInput, 'error'> = {
  where: 'render',
  app: { version: '1.4.0', build: 'rustore/robokassa' },
  system: { os: 'android', version: 34 },
  language: 'ru',
  at: new Date(2026, 10, 6, 14, 5),
};

function hermesError(): Error {
  const e = new TypeError("Cannot read property 'stake' of undefined");
  e.stack = [
    "TypeError: Cannot read property 'stake' of undefined",
    ...Array.from({ length: 40 }, (_, i) => `    at fn${i} (address at index.android.bundle:1:${1000 + i})`),
  ].join('\n');
  return e;
}

describe('the report', () => {
  it('says what failed, where, on which app and system', () => {
    const r = buildErrorReport({ ...base, error: hermesError(), componentStack: '\n    in BetCard\n    in BetsScreen\n' });
    expect(r).toContain('App: 1.4.0 (rustore/robokassa)');
    expect(r).toContain('System: android 34');
    expect(r).toContain('Language: ru');
    expect(r).toContain('Where: render');
    expect(r).toMatch(/When: 2026-11-06 14:05 [+-]\d\d:\d\d/);
    expect(r).toContain("TypeError: Cannot read property 'stake' of undefined");
    expect(r).toContain('Components:\nin BetCard\nin BetsScreen');
  });

  it('keeps it short enough for a chat: the stack is cut and the rest counted', () => {
    const r = buildErrorReport({ ...base, error: hermesError() });
    const stack = r.split('Stack:\n')[1]!.split('\n');
    // The stack's first line repeats the error line above it — not twice.
    expect(stack[0]).toBe('at fn0 (address at index.android.bundle:1:1000)');
    expect(stack).toHaveLength(REPORT_LIMITS.stackLines + 1);
    expect(stack[stack.length - 1]).toBe(`… +${40 - REPORT_LIMITS.stackLines}`);
    const big = new Error('x'.repeat(5_000));
    big.stack = 'Error: xxx\n    at a (index.android.bundle:1:1)';
    const long = buildErrorReport({ ...base, error: big });
    expect(long).toContain(`Error: ${'x'.repeat(REPORT_LIMITS.message)}…`);
    expect(long).not.toContain('x'.repeat(REPORT_LIMITS.message + 1));
  });

  it('reads whatever was thrown, not only an Error', () => {
    expect(buildErrorReport({ ...base, error: 'boom' })).toContain('Error: boom');
    expect(buildErrorReport({ ...base, error: { message: 'from native', code: 3 } })).toContain('Error: from native');
    expect(buildErrorReport({ ...base, error: { code: 3 } })).toContain('Error: {"code":3}');
    expect(buildErrorReport({ ...base, error: null })).toContain('Error: null');
  });

  it('carries nothing but what it was given — no bets, sums or settings ride along', () => {
    const r = buildErrorReport({ ...base, error: new Error('x') });
    const fields = r.split('\n').filter((l) => /^[A-Z][a-z]+: /.test(l)).map((l) => l.split(':')[0]);
    expect(fields).toEqual(['App', 'System', 'Language', 'When', 'Where', 'Error']);
  });
});

describe('a crash kept for the next launch', () => {
  it('reads back as it was saved, with the version that crashed', () => {
    const saved = crashToSave(hermesError(), new Date('2026-11-06T10:00:00Z'), '1.3.9');
    const back = parseSavedCrash(JSON.stringify(saved));
    expect(back).toEqual(saved);
    expect(back!.version).toBe('1.3.9');
    const r = buildErrorReport({ ...base, where: 'crash', error: savedCrashError(back!) });
    expect(r).toContain("TypeError: Cannot read property 'stake' of undefined");
    // More frames are kept than shown, so the report still counts the rest.
    expect(r).toContain(`… +${40 - REPORT_LIMITS.stackLines}`);
  });

  it('is clipped when saved: a runaway message cannot fill the disk', () => {
    const huge = new Error('y'.repeat(100_000));
    huge.stack = ['Error: y', ...Array.from({ length: 500 }, () => `    at ${'z'.repeat(1_000)}`)].join('\n');
    const saved = crashToSave(huge, new Date(), '1.0.0');
    // 600 characters of message, at most 80 frames of 300: well under 30 KB.
    expect(saved.message.length).toBe(REPORT_LIMITS.message + 1);
    expect(saved.stack.split('\n')).toHaveLength(80);
    expect(JSON.stringify(saved).length).toBeLessThan(30_000);
  });

  it('reads as nothing — never as a broken report — when the text is not one', () => {
    for (const text of [null, '', 'not json', '[]', 'null', '{"name":"E"}', '{"name":"E","message":"m","stack":"","at":"never"}']) {
      expect(parseSavedCrash(text)).toBeNull();
    }
    // A crash saved before the version was kept: still a report.
    expect(parseSavedCrash('{"name":"E","message":"m","stack":"","at":"2026-11-06T10:00:00Z"}')?.version).toBe('?');
  });
});

describe('no crash service', () => {
  it('sends nothing on its own: no Sentry in the app', () => {
    // Removed 2026-11-06: no key in any build, a quarter of the bundle, and
    // device data sent abroad without the user's say. Reports go through the
    // window the user reads first (ErrorReportSheet).
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8')) as Record<string, Record<string, string>>;
    const deps = Object.keys({ ...pkg['dependencies'], ...pkg['devDependencies'] });
    expect(deps.filter((d) => d.startsWith('@sentry/'))).toEqual([]);
    const app = readFileSync(join(__dirname, '..', '..', 'App.tsx'), 'utf8');
    expect(app).toMatch(/installCrashCapture\(\);/);
  });
});
