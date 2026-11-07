import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { makeFatalHandler, type GlobalHandler } from '../utils/fatalHandler';

/*
 * The global crash handler's rules (review 2026-11-07), and the wiring around
 * it that a test of the pure handler cannot see.
 */
function setup(save: (e: unknown) => Promise<void>) {
  const calls: Array<[unknown, boolean | undefined]> = [];
  const timers: Array<() => void> = [];
  const previous: GlobalHandler = (e, f) => { calls.push([e, f]); };
  const handler = makeFatalHandler({ previous, save, waitMs: 1_500, schedule: (fn) => { timers.push(fn); } });
  const runTimers = () => { while (timers.length) timers.shift()!(); };
  return { handler, calls, runTimers };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('the fatal-error handler', () => {
  it('passes a non-fatal error straight on, untouched', () => {
    const save = jest.fn(async () => {});
    const { handler, calls } = setup(save);
    handler('warn', false);
    expect(calls).toEqual([['warn', false]]);
    expect(save).not.toHaveBeenCalled();
  });

  it('keeps the first fatal of a session only — a follow-on must not replace the cause', async () => {
    const save = jest.fn(async () => {});
    const { handler } = setup(save);
    handler(new Error('cause'), true);
    handler(new Error('consequence'), true);
    await tick();
    expect(save).toHaveBeenCalledTimes(1);
    expect((save.mock.calls[0] as unknown[])[0]).toEqual(new Error('cause'));
  });

  it('runs the default handler once, from a timer — never inside the save’s promise', async () => {
    const save = jest.fn(async () => {});
    const { handler, calls, runTimers } = setup(save);
    handler(new Error('x'), true);
    await tick(); // the save resolved…
    expect(calls).toEqual([]); // …and the default handler still waits for its timer
    runTimers();
    expect(calls).toHaveLength(1);
    runTimers();
    expect(calls).toHaveLength(1);
  });

  it('still closes the app when the save fails, throws, or never answers', async () => {
    for (const save of [
      async () => { throw new Error('disk full'); },
      () => { throw new Error('sync'); },
      () => new Promise<void>(() => {}),
    ]) {
      const { handler, calls, runTimers } = setup(save as (e: unknown) => Promise<void>);
      handler(new Error('x'), true);
      await tick();
      runTimers();
      expect(calls).toHaveLength(1);
    }
  });
});

describe('the wiring', () => {
  const SRC = join(__dirname, '..');
  const files = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) files(p, out);
      else if (/\.tsx?$/.test(e.name)) out.push(p);
    }
    return out;
  };

  it('never imports expo-clipboard at load — a build without the module would die on the error screen', () => {
    const eager = [...files(SRC), join(SRC, '..', 'App.tsx')]
      .filter((f) => /^import [^\n]*from 'expo-clipboard'/m.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(SRC.length + 1));
    expect(eager).toEqual([]);
  });

  it('puts the whole app under RootCrashBoundary, whose own screen needs nothing that could have failed', () => {
    const app = readFileSync(join(SRC, '..', 'App.tsx'), 'utf8');
    expect(app).toMatch(/export default function App\(\) \{\s*return \(\s*<RootCrashBoundary>\s*<AppRoot \/>/);
    const root = readFileSync(join(SRC, 'components', 'RootCrashBoundary.tsx'), 'utf8');
    expect(root).toMatch(/recordCrash\(error\)/);
    expect(root).not.toMatch(/ErrorReportSheet|expo-clipboard|SafeArea/);
  });
});
