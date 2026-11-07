/*
 * The global fatal-error handler, as a pure function of what it needs — so the
 * rules are under test (services/crashReport wires it to ErrorUtils and
 * AsyncStorage). The rules, each from review 2026-11-07:
 *  - a non-fatal error goes straight on, untouched;
 *  - only the FIRST fatal of a session is kept: a follow-on error during the
 *    wait would replace the root cause with its consequence;
 *  - the default handler (the one that closes the app) runs once, after the
 *    save or after `waitMs`, whichever comes first — and from a timer, never
 *    from inside the save's promise: it rethrows when its own report fails,
 *    and a throw inside `.then` became an unhandled rejection that left the
 *    app running after its fatal error.
 */
export type GlobalHandler = (error: unknown, isFatal?: boolean) => void;

export interface FatalHandlerDeps {
  /** The handler that was installed before (React Native's default). */
  previous: GlobalHandler;
  /** Keeps the error for the next launch; may reject. */
  save: (error: unknown) => Promise<void>;
  waitMs: number;
  /** `setTimeout`, injectable for the test. */
  schedule: (fn: () => void, ms: number) => void;
}

export function makeFatalHandler({ previous, save, waitMs, schedule }: FatalHandlerDeps): GlobalHandler {
  let kept = false;
  return (error, isFatal) => {
    if (!isFatal) {
      previous(error, isFatal);
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      schedule(() => previous(error, isFatal), 0);
    };
    schedule(finish, waitMs);
    if (kept) {
      finish();
      return;
    }
    kept = true;
    try {
      save(error).then(finish, finish);
    } catch {
      finish();
    }
  };
}
