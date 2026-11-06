/*
 * The error report the user sends to the author THEMSELVES — in place of a
 * crash-reporting service. Nothing leaves the phone unless the user copies or
 * shares it, and the window shows exactly this text first.
 *
 * Pure (no React Native), so it is under test. What goes in: the error, where
 * it happened, the app's version and build, the system and the language. What
 * never goes in: bets, sums, notes, settings — the report is read by a person,
 * and the error's own message is all they need to find the line.
 *
 * Labels are English on purpose: this is a diagnostic payload for the author
 * (like a log line), not interface text — and it reads the same whichever
 * language the user runs the app in.
 */

export interface ErrorReportInput {
  /** What failed: an Error, or whatever was thrown. */
  error: unknown;
  /** Where: 'render' (the error screen), 'crash' (the app closed), 'storage' (data not read). */
  where: 'render' | 'crash' | 'storage';
  /** React's component stack, when the error happened while rendering. */
  componentStack?: string | null;
  app: { version: string; build: string };
  system: { os: string; version: string | number };
  language: string;
  /** When it happened (a crash is reported on the NEXT launch). */
  at: Date;
}

/** Longest message and stack kept: enough to find the line, short enough to paste in a chat. */
export const REPORT_LIMITS = { message: 600, stackLines: 18, componentLines: 12 } as const;

function describe(error: unknown): { name: string; message: string; stack: string } {
  if (error instanceof Error) {
    return { name: error.name || 'Error', message: error.message, stack: error.stack ?? '' };
  }
  if (typeof error === 'object' && error !== null) {
    const o = error as Record<string, unknown>;
    const message = typeof o['message'] === 'string' ? o['message'] : safeJson(error);
    return {
      name: typeof o['name'] === 'string' ? o['name'] : 'Error',
      message,
      stack: typeof o['stack'] === 'string' ? o['stack'] : '',
    };
  }
  return { name: 'Error', message: String(error), stack: '' };
}

function safeJson(v: unknown): string {
  try { return JSON.stringify(v) ?? String(v); } catch { return String(v); }
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Non-empty lines, trimmed. */
function splitLines(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
}

/** The first `n` lines; the rest is counted, not dropped silently. */
function firstLines(all: string[], n: number): string[] {
  return all.length > n ? [...all.slice(0, n), `… +${all.length - n}`] : all;
}

/** A stack's frames: its first line repeats "Name: message", which the report already has. */
function frames(stack: string, name: string): string[] {
  const all = splitLines(stack);
  return all[0] !== undefined && (all[0] === name || all[0].startsWith(`${name}:`)) ? all.slice(1) : all;
}

function stamp(d: Date): string {
  const p = (x: number) => String(x).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const tz = `${sign}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())} ${tz}`;
}

/** The report as the user sees it and sends it. */
export function buildErrorReport(input: ErrorReportInput): string {
  const { name, message, stack } = describe(input.error);
  const out = [
    'SharkLog error report',
    `App: ${input.app.version} (${input.app.build})`,
    `System: ${input.system.os} ${input.system.version}`,
    `Language: ${input.language}`,
    `When: ${stamp(input.at)}`,
    `Where: ${input.where}`,
    '',
    `${name}: ${clip(message, REPORT_LIMITS.message)}`,
  ];
  const stackLines = firstLines(frames(stack, name), REPORT_LIMITS.stackLines);
  if (stackLines.length > 0) out.push('', 'Stack:', ...stackLines);
  const components = input.componentStack ? firstLines(splitLines(input.componentStack), REPORT_LIMITS.componentLines) : [];
  if (components.length > 0) out.push('', 'Components:', ...components);
  return out.join('\n');
}

/** What a crash leaves for the next launch (saved by the global handler). */
export interface SavedCrash {
  name: string;
  message: string;
  stack: string;
  /** ISO time of the crash. */
  at: string;
  /** The app version that crashed — the next launch may already be an update. */
  version: string;
}

/** A saved crash read back, or null when the text is not one (an older build, a broken write). */
export function parseSavedCrash(text: string | null): SavedCrash | null {
  if (text === null) return null;
  try {
    const o = JSON.parse(text) as Record<string, unknown>;
    if (typeof o !== 'object' || o === null) return null;
    const { name, message, stack, at, version } = o;
    if (typeof name !== 'string' || typeof message !== 'string' || typeof stack !== 'string' || typeof at !== 'string') return null;
    if (Number.isNaN(new Date(at).getTime())) return null;
    return { name, message, stack, at, version: typeof version === 'string' ? version : '?' };
  } catch {
    return null;
  }
}

/** The saved form of a thrown value — clipped already, so a huge message cannot fill the disk. */
export function crashToSave(error: unknown, at: Date, version: string): SavedCrash {
  const { name, message, stack } = describe(error);
  return {
    name,
    message: clip(message, REPORT_LIMITS.message),
    // More frames than the report shows, so its "… +N" still counts the rest;
    // capped, so a runaway stack cannot fill the disk.
    stack: frames(stack, name).slice(0, 80).map((l) => clip(l, 300)).join('\n'),
    at: at.toISOString(),
    version,
  };
}

/** A saved crash as an Error-like value for buildErrorReport. */
export function savedCrashError(c: SavedCrash): { name: string; message: string; stack: string } {
  return { name: c.name, message: c.message, stack: c.stack };
}
