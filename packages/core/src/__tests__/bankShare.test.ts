import { describe, it, expect } from 'vitest';
import type { Bet, BankrollTransaction } from '../types/bet';
import { bankAtBetTime, calcBankShares, calcPlanCompliance } from '../utils/analytics';
import { currentBank, stampSettlement } from '../utils/stats';
import { toYmd } from '../utils/daily';

/*
 * The percent on a bet card: how far that bet moved the bank. Held here to the
 * questions a user would ask of the number — does it change when I deposit
 * later, does a freebet count, why is it missing on this card.
 */

// A moment of the local clock, stamped as the apps stamp it (`toISOString`, UTC).
const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00`).toISOString();

let n = 0;
function bet(over: Partial<Bet> = {}): Bet {
  n += 1;
  // Entered and settled on its own day at noon unless the test says otherwise.
  const stamp = over.createdAt ?? at(over.date ?? '2026-08-01', '12:00');
  return {
    id: `b${n}`,
    createdAt: stamp, updatedAt: stamp,
    date: '2026-08-01', time: '12:00', sport: 'football', bookmaker: 'Fonbet',
    event: 'A vs B', betType: '1X2', pick: 'П1', odds: 2, stake: 100_000,
    status: 'won', strategy: 'value', schemaVersion: 3, ...over,
  } as Bet;
}

// As the Bankroll screen stamps a transaction: the moment it was entered, `toISOString`.
const tx = (type: BankrollTransaction['type'], amount: number, date: string, time = '09:00'): BankrollTransaction =>
  ({ id: `${type}${date}${time}${amount}`, type, amount, date: at(date, time) });

// 10 000 ₽ on the 1st.
const deposit = [tx('deposit', 1_000_000, '2026-08-01')];

describe('calcBankShares', () => {
  it('is the result over the bank the bet was placed against', () => {
    const won = bet({ stake: 100_000, odds: 2 }); // +1 000 ₽ on 10 000 ₽
    const lost = bet({ stake: 50_000, status: 'lost', date: '2026-08-02' }); // −500 ₽ on 11 000 ₽
    const s = calcBankShares([won, lost], deposit);
    expect(s.get(won.id)).toBeCloseTo(10);
    expect(s.get(lost.id)).toBeCloseTo((-50_000 / 1_100_000) * 100);
  });

  it('measures a bet against the results recorded before it was entered', () => {
    // One base for the whole day hid what a discipline tool must show: after
    // a loss the next stake is a bigger share of what is left.
    const d = '2026-08-01';
    const morning = bet({ status: 'lost', stake: 400_000, createdAt: at(d, '10:00'), settledAt: at(d, '12:00') }); // −4 000 on 10 000
    const evening = bet({ stake: 300_000, createdAt: at(d, '20:00'), settledAt: at(d, '22:00') });                  // +3 000 on 6 000
    const s = calcBankShares([evening, morning], deposit);
    expect(s.get(morning.id)).toBeCloseTo(-40);
    expect(s.get(evening.id)).toBeCloseTo(50);
    // Placed at 11:00, before the morning's loss was known: 10 000.
    const early = bet({ stake: 300_000, createdAt: at(d, '11:00') });
    expect(calcBankShares([morning, early], deposit).get(early.id)).toBeCloseTo(30);
  });

  it('does not move when results come in after the bet — five placed at once stay within', () => {
    // From the review: five 200 ₽ bets entered 10:00–10:04, all pending; the
    // form judged each against 10 000. Ordered by match time, once four lost
    // Analytics measured the later ones against 9 800, 9 600… and called them
    // breaches. Results recorded at 13:00 were nobody's bank at 10:0x.
    const d = '2026-08-01';
    const five = [0, 1, 2, 3, 4].map((i) => bet({
      stake: 20_000, status: i < 4 ? 'lost' : 'won',
      createdAt: at(d, `10:0${i}`), time: `1${i}:00`, settledAt: at(d, `13:0${i}`),
    }));
    const c = calcPlanCompliance(five, deposit, 2)!;
    expect([c.within, c.total]).toEqual([5, 5]);
    const s = calcBankShares(five, deposit);
    expect(s.get(five[4]!.id)).toBeCloseTo(2);
  });

  it('does not change when money moves later — the reason it is not the current bank', () => {
    const b = bet();
    const before = calcBankShares([b], deposit).get(b.id);
    const after = calcBankShares([b], [...deposit, tx('deposit', 9_000_000, '2026-08-05')]).get(b.id);
    expect(after).toBe(before);
  });

  it('counts a same-day withdrawal only if it was entered before the bet', () => {
    const b = bet(); // entered 12:00
    // Topped up to 20 000 ₽ and withdrew 5 000 ₽ that evening: the bet saw 20 000 ₽.
    const evening = calcBankShares([b], [...deposit, tx('deposit', 1_000_000, '2026-08-01'), tx('withdrawal', 500_000, '2026-08-01', '21:00')]);
    expect(evening.get(b.id)).toBeCloseTo(5);
    // Withdrew in the morning: the bet saw 15 000 ₽.
    const morning = calcBankShares([b], [...deposit, tx('deposit', 1_000_000, '2026-08-01'), tx('withdrawal', 500_000, '2026-08-01', '11:00')]);
    expect(morning.get(b.id)).toBeCloseTo((100_000 / 1_500_000) * 100);
  });

  it('counts a same-day deposit even when it was entered after the bet', () => {
    // Topping up and then betting is the order; entering the deposit later is
    // common, and must not leave the bet with no bank at all.
    const b = bet({ date: '2026-08-02', stake: 1_500_000 });
    const s = calcBankShares([b], [...deposit, tx('deposit', 1_000_000, '2026-08-02', '22:00')]);
    expect(s.get(b.id)).toBeCloseTo((1_500_000 / 2_000_000) * 100);
  });

  it('counts a cashout by what it actually returned', () => {
    const c = bet({ status: 'cashout', cashoutAmount: 70_000 }); // −300 ₽
    expect(calcBankShares([c], deposit).get(c.id)).toBeCloseTo(-3);
  });

  it('leaves out freebets, refunds and pending bets', () => {
    const bets = [bet({ isFreebet: true }), bet({ isFreebet: true, status: 'lost' }), bet({ status: 'refund' }), bet({ status: 'pending' })];
    expect(calcBankShares(bets, deposit).size).toBe(0);
  });

  it('says nothing when no bank is kept, or the stake outgrows it', () => {
    expect(calcBankShares([bet()], []).size).toBe(0);
    // 20 000 ₽ staked from a 10 000 ₽ bank: a deposit was never entered.
    expect(calcBankShares([bet({ stake: 2_000_000 })], deposit).size).toBe(0);
  });

  it('says nothing once the bank is gone', () => {
    const bust = bet({ stake: 1_000_000, status: 'lost' });
    const next = bet({ date: '2026-08-02', stake: 10_000 });
    const s = calcBankShares([bust, next], deposit);
    expect(s.get(bust.id)).toBeCloseTo(-100);
    expect(s.has(next.id)).toBe(false);
  });

  it('measures a bet dated ahead against the bank as it is now', () => {
    const today = toYmd(new Date());
    const ahead = new Date();
    ahead.setDate(ahead.getDate() + 3);
    const future = bet({ date: toYmd(ahead) });
    expect(calcBankShares([future], [tx('deposit', 1_000_000, today)]).get(future.id)).toBeCloseTo(10);
  });

  it('says nothing for bets placed before any money was entered', () => {
    // History imported behind a deposit dated later: before it, the "bank" is
    // the running P&L alone, and an 800 ₽ loss read "−80% of bank".
    const early1 = bet({ date: '2026-03-01', stake: 100_000 });               // +1 000 ₽
    const early2 = bet({ date: '2026-03-02', stake: 80_000, status: 'lost' }); // −800 ₽
    const funded = bet({ date: '2026-03-05' });
    const s = calcBankShares([early1, early2, funded], [tx('deposit', 1_000_000, '2026-03-05')]);
    expect(s.has(early1.id)).toBe(false);
    expect(s.has(early2.id)).toBe(false);
    expect(s.get(funded.id)).toBeCloseTo((100_000 / (1_000_000 + 20_000)) * 100);
  });

  it('starts counting the day AFTER a first reconciliation, not on it', () => {
    // A reconciliation is posted in the evening; that day's bets were placed
    // against a bank nobody had entered yet.
    const before = bet({ date: '2026-03-01' });
    const sameDay = bet({ date: '2026-03-02' });
    const after = bet({ date: '2026-03-03' });
    const s = calcBankShares([before, sameDay, after], [tx('adjustment', 1_000_000, '2026-03-02')]);
    expect(s.has(before.id)).toBe(false);
    expect(s.has(sameDay.id)).toBe(false);
    expect(s.has(after.id)).toBe(true);
  });
});

describe('bankAtBetTime — what the book held when the bet was entered', () => {
  // The day from the bug report: 25 907 ₽ at the start of it, three bets, a
  // withdrawal of 15 000 ₽ in the afternoon. The Bets screen said 7 ₽; the bet
  // form, measuring from the start of the day, said 25 907 ₽.
  const day = '2026-08-02';
  const funds = [tx('deposit', 2_590_700, '2026-08-01'), tx('withdrawal', 1_500_000, day, '15:00')];
  const ska = bet({ date: day, time: '19:30', stake: 800_000, status: 'lost', createdAt: at(day, '08:08'), settledAt: at(day, '11:00') });
  const anaheim = bet({ date: day, time: '05:00', stake: 500_000, odds: 1.8, createdAt: at(day, '10:00'), settledAt: at(day, '13:00') }); // +4 000
  const vancouver = bet({ date: day, time: '22:06', stake: 690_000, status: 'lost', createdAt: at(day, '22:06'), settledAt: at(day, '22:07') });
  const bets = [vancouver, ska, anaheim];

  it('is the bank on the Bets screen for a bet being entered now', () => {
    const bankAt = bankAtBetTime(bets, funds);
    expect(bankAt({ date: day })).toBe(700);
    expect(bankAt({ date: day })).toBe(currentBank(funds, bets));
  });

  it('is the start of the day for a bare day', () => {
    expect(bankAtBetTime(bets, funds)(day)).toBe(2_590_700);
  });

  it('counts what was recorded before each bet was entered — not the match times', () => {
    const bankAt = bankAtBetTime(bets, funds);
    expect(bankAt(ska)).toBe(2_590_700);
    // Anaheim's match was at 05:00, but at 10:00 SKA had not been settled yet.
    expect(bankAt(anaheim)).toBe(2_590_700);
    // 25 907 − 8 000 + 4 000 − 15 000 = 6 907 for a 6 900 stake.
    expect(bankAt(vancouver)).toBe(690_700);
    expect(calcBankShares(bets, funds).get(vancouver.id)).toBeCloseTo((-690_000 / 690_700) * 100);
  });

  it('never counts a bet\'s own result', () => {
    // Recorded before it was entered (a clock moved, an import): still not its bank.
    const odd = bet({ date: day, stake: 100_000, createdAt: at(day, '12:00'), settledAt: at(day, '11:00') });
    const bankAt = bankAtBetTime([odd], [tx('deposit', 1_000_000, '2026-08-01')]);
    expect(bankAt(odd)).toBe(1_000_000);
    // …and not when the form edits it without its entry moment either.
    expect(bankAt({ date: day, id: odd.id })).toBe(1_000_000);
  });

  it('leaves out a bet being edited, wherever the form moved it', () => {
    const bankAt = bankAtBetTime(bets, funds);
    // Vancouver edited: it keeps its entry moment, its own loss is not its bank.
    expect(bankAt({ date: day, id: vancouver.id, createdAt: vancouver.createdAt })).toBe(690_700);
    // SKA moved on the form to the next day: still what the book held when it
    // was entered at 08:08 — not its own −8 000, nor the rest of that day.
    expect(bankAt({ date: '2026-08-03', id: ska.id, createdAt: ska.createdAt })).toBe(2_590_700);
    // Moved to yesterday: nothing of it is there.
    expect(bankAt({ date: '2026-08-01', id: ska.id, createdAt: ska.createdAt })).toBe(2_590_700);
    // A saved bet with no readable entry moment: the start of its day, its own
    // result taken out of a later day's start.
    expect(bankAt({ date: '2026-08-03', id: ska.id, createdAt: 'garbage' })).toBe(700 + 800_000);
    expect(bankAt({ date: day, id: ska.id })).toBe(2_590_700);
  });

  it('counts withdrawals and reconciliations from the moment they were entered', () => {
    const b = bet({ date: day, createdAt: at(day, '12:00') });
    const book = (t: string) => bankAtBetTime([b], [...deposit, tx('adjustment', -200_000, day, t), tx('withdrawal', 100_000, day, t)])(b);
    expect(book('11:59')).toBe(700_000);
    expect(book('12:01')).toBe(1_000_000);
  });

  it('is the bank the plan check judges by — the form cannot disagree with Analytics', () => {
    // 2% of 25 907 is 518; of the 6 907 left before Vancouver, 138.
    const c = calcPlanCompliance(bets, funds, 2)!;
    expect(c.worst.find((w) => w.betId === vancouver.id)!.sharePct).toBe(99.9);
    // Judged on its own, the bank is still rebuilt from every bet.
    const slice = calcPlanCompliance(bets, funds, 2, { evaluate: [vancouver] })!;
    expect(slice.worst[0]!.sharePct).toBe(99.9);
  });

  it('does not judge a stake larger than the bank, as the bet card does not', () => {
    const big = bet({ date: day, stake: 500_000, status: 'pending', createdAt: at(day, '22:30') });
    const c = calcPlanCompliance([...bets, big], funds, 2, { evaluate: [big] });
    expect(c).toBeNull();
  });
});

describe('bankAtBetTime — across days, and against a plain recount', () => {
  const dep = (day: string) => tx('deposit', 1_000_000, day, '08:00');

  it('does not move when an earlier day\'s bet is settled after this one was entered', () => {
    // From the second review: yesterday's bet still open, today's entered and
    // settled — then yesterday's recorded as lost tomorrow. Today's 2% stayed 2%.
    const p = bet({ date: '2026-08-03', status: 'lost', stake: 200_000, createdAt: at('2026-08-03', '18:00'), settledAt: at('2026-08-05', '10:00') });
    const q = bet({ date: '2026-08-04', stake: 20_000, createdAt: at('2026-08-04', '12:00'), settledAt: at('2026-08-04', '22:00') });
    const r = bet({ date: '2026-08-06', stake: 20_000, status: 'pending', createdAt: at('2026-08-06', '12:00') });
    const book = [p, q, r];
    const bankAt = bankAtBetTime(book, [dep('2026-08-01')]);
    expect(bankAt(q)).toBe(1_000_000);
    expect(calcPlanCompliance(book, [dep('2026-08-01')], 2, { evaluate: [q] })!.within).toBe(1);
    // Entered after the loss went in: it is that bet's bank.
    expect(bankAt(r)).toBe(1_000_000 - 200_000 + 20_000);
  });

  it('keeps a bet dated ahead on the bank it was entered on', () => {
    // A match after midnight, entered this evening; a loss recorded later today
    // must not turn its 2% into 2.5% overnight.
    const now = Date.now();
    const today = toYmd(new Date(now));
    const ahead = new Date(now); ahead.setDate(ahead.getDate() + 1);
    const night = bet({ date: toYmd(ahead), stake: 20_000, status: 'pending', createdAt: new Date(now - 4 * 3_600_000).toISOString() });
    const loss = bet({ date: today, stake: 200_000, status: 'lost', createdAt: new Date(now - 5 * 3_600_000).toISOString(), settledAt: new Date(now - 3_600_000).toISOString() });
    const bankAt = bankAtBetTime([night, loss], [tx('deposit', 1_000_000, '2026-01-01')]);
    expect(bankAt(night)).toBe(1_000_000);
    expect(bankAt({ date: toYmd(ahead) })).toBe(800_000); // a new bet now sees the loss
  });

  it('leaves history imported later out of the bets entered before the import', () => {
    // A CSV writes its rows at the moment of the import: those results are the
    // bank of bets entered after it, not a rewrite of what earlier cards showed.
    const inApp = bet({ date: '2026-08-05', stake: 20_000, createdAt: at('2026-08-05', '12:00') });
    // As importBetsFromRows writes a settled row: entered and settled at the import.
    const imported = bet({ date: '2026-08-02', stake: 500_000, odds: 3, createdAt: at('2026-08-09', '10:00'), settledAt: at('2026-08-09', '10:00') }); // +10 000
    const after = bet({ date: '2026-08-09', stake: 20_000, status: 'pending', createdAt: at('2026-08-09', '11:00') });
    const bankAt = bankAtBetTime([inApp, imported, after], [dep('2026-08-01')]);
    expect(bankAt(inApp)).toBe(1_000_000);
    expect(bankAt(after)).toBe(1_000_000 + 20_000 + 1_000_000);
  });

  it('dates an old result by its own day, not by a note edited weeks later', () => {
    // Third review: a +5 000 win settled a month ago, its note edited two days
    // ago. With the edit read as the moment of the result, it vanished from the
    // bank of every bet entered in between and a plan saw breaches nobody made.
    const old = bet({ date: '2026-07-01', stake: 500_000, createdAt: at('2026-07-01', '10:00'), updatedAt: at('2026-07-29', '20:00') });
    const mid = bet({ date: '2026-07-10', stake: 30_000, status: 'pending', createdAt: at('2026-07-10', '12:00') });
    const bankAt = bankAtBetTime([old, mid], [tx('deposit', 1_000_000, '2026-06-30')]);
    expect(bankAt(mid)).toBe(1_500_000);
  });

  it('puts a bet entered after its day on the start of that day', () => {
    // Deposit 10 000, 9 000 withdrawn at 21:00; the morning's 500 bet typed in
    // the next day. Its bank was 10 000 (−5%), not the evening's 1 000 (−50%).
    const d = '2026-08-04';
    const late = bet({ date: d, stake: 50_000, status: 'lost', createdAt: at('2026-08-05', '08:00'), settledAt: at('2026-08-05', '08:00') });
    const funds = [tx('deposit', 1_000_000, d, '08:00'), tx('withdrawal', 900_000, d, '21:00')];
    expect(bankAtBetTime([late], funds)(late)).toBe(1_000_000);
    expect(calcBankShares([late], funds).get(late.id)).toBeCloseTo(-5);
    // Entered on the day, before the withdrawal: the same.
    const onTime = { ...late, createdAt: at(d, '10:00'), settledAt: at(d, '12:00') };
    expect(bankAtBetTime([onTime], funds)(onTime)).toBe(1_000_000);
  });

  it('gives two copies of one id each their own bank', () => {
    // A desktop book is not de-duplicated on load: the cache is the bet itself.
    const a = bet({ id: 'same', date: '2026-08-02', status: 'pending', createdAt: at('2026-08-02', '09:00') });
    const b = bet({ id: 'same', date: '2026-08-02', status: 'pending', createdAt: at('2026-08-02', '20:00') });
    const loss = bet({ date: '2026-08-02', status: 'lost', stake: 300_000, createdAt: at('2026-08-02', '10:00'), settledAt: at('2026-08-02', '12:00') });
    const bankAt = bankAtBetTime([a, b, loss], [tx('deposit', 1_000_000, '2026-08-01')]);
    expect(bankAt(a)).toBe(1_000_000);
    expect(bankAt(b)).toBe(700_000);
  });

  it('matches a plain recount on random books', () => {
    // The Fenwick sweep for all saved bets against the definition, bet by bet:
    // deposits dated up to its day, and of the rest what went in before it.
    let seed = 7;
    const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
    const dayOf = (i: number) => `2026-08-${String(1 + i).padStart(2, '0')}`;
    const hh = () => `${String(Math.floor(rnd() * 24)).padStart(2, '0')}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}`;
    for (let round = 0; round < 20; round++) {
      const book: Bet[] = [];
      for (let i = 0; i < 40; i++) {
        const d = Math.floor(rnd() * 10);
        const statuses = ['won', 'lost', 'pending', 'refund', 'cashout'] as const;
        const status = statuses[Math.floor(rnd() * statuses.length)]!;
        const entered = at(dayOf(Math.max(0, d - 1 + Math.floor(rnd() * 3))), hh());
        const settled = at(dayOf(Math.min(9, d + Math.floor(rnd() * 3))), hh());
        book.push(bet({
          date: dayOf(d), status, stake: 10_000 + Math.floor(rnd() * 50_000), odds: 1.2 + rnd() * 3,
          createdAt: entered, updatedAt: rnd() < 0.15 ? at(dayOf(9), hh()) : entered,
          // Some saved before settledAt existed: their last edit stands in, capped at their day's end.
          ...(status === 'pending' || rnd() < 0.2 ? {} : { settledAt: settled }),
          ...(status === 'cashout' ? { cashoutAmount: Math.floor(rnd() * 60_000) } : {}),
          ...(rnd() < 0.1 ? { isFreebet: true } : {}),
        }));
      }
      const txs: BankrollTransaction[] = [tx('deposit', 2_000_000, dayOf(0), '07:00')];
      for (let i = 0; i < 8; i++) {
        const kind = (['deposit', 'withdrawal', 'adjustment'] as const)[Math.floor(rnd() * 3)]!;
        const amount = Math.floor(rnd() * 300_000) * (kind === 'adjustment' && rnd() < 0.5 ? -1 : 1);
        txs.push(tx(kind, amount, dayOf(Math.floor(rnd() * 10)), hh()));
      }
      const bankAt = bankAtBetTime(book, txs);
      const pnl = (b: Bet) => (b.status === 'won' ? Math.round(b.stake * b.odds) - b.stake
        : b.status === 'lost' ? (b.isFreebet ? 0 : -b.stake)
        : b.status === 'cashout' && b.cashoutAmount != null ? b.cashoutAmount - b.stake : 0);
      const dayEnd = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y!, m! - 1, dd! + 1).getTime(); };
      const recorded = (o: Bet) => o.settledAt !== undefined ? Date.parse(o.settledAt) : Math.min(Date.parse(o.updatedAt), dayEnd(o.date));
      for (const b of book) {
        const t = Date.parse(b.createdAt);
        // Entered once its day was over: the start of its day (and the days
        // before, as they stood at entry); otherwise the day itself as it stood.
        const late = t >= dayEnd(b.date);
        const counts = (day: string) => (late ? day < b.date : day <= b.date);
        let want = 0;
        for (const x of txs) {
          const when = new Date(x.date);
          if (toYmd(when) > b.date) continue;
          if (x.type === 'deposit') want += x.amount;
          else if (counts(toYmd(when)) && when.getTime() < t) want += x.type === 'withdrawal' ? -x.amount : x.amount;
        }
        for (const o of book) {
          if (o.id === b.id || !counts(o.date)) continue;
          if (recorded(o) < t) want += pnl(o);
        }
        expect(bankAt(b)).toBe(want > 0 ? want : null);
        // The same question asked one by one (the form's path) gives the same.
        const withOwn = want + (!late && recorded(b) < t ? pnl(b) : 0);
        expect(bankAt({ date: b.date, createdAt: b.createdAt, id: `${b.id}-copy` })).toBe(withOwn > 0 ? withOwn : null);
      }
    }
  });
});

describe('stampSettlement — when a result went into the book', () => {
  const now = '2026-08-02T10:00:00.000Z';
  const pending = bet({ status: 'pending', updatedAt: '2026-08-01T09:00:00.000Z' });

  it('stamps a result when it is recorded, and an entered-settled bet at entry', () => {
    expect(stampSettlement(pending, { ...pending, status: 'won' }, now).settledAt).toBe(now);
    const entered = bet({ status: 'lost' });
    expect(stampSettlement(undefined, entered, entered.createdAt).settledAt).toBe(entered.createdAt);
    expect(stampSettlement(undefined, pending, now).settledAt).toBeUndefined();
  });

  it('keeps the stamp on an edit that does not touch the result', () => {
    const settled = { ...pending, status: 'won' as const, settledAt: '2026-08-01T12:00:00.000Z' };
    expect(stampSettlement(settled, { ...settled, notes: 'x', odds: 2.1 }, now).settledAt).toBe(settled.settledAt);
    // A cashout amount changed is a new result.
    const cashed = { ...settled, status: 'cashout' as const, cashoutAmount: 50_000 };
    expect(stampSettlement(cashed, { ...cashed, cashoutAmount: 60_000 }, now).settledAt).toBe(now);
    // A won bet carrying a stale amount (an old import): dropping it is no result.
    const stale = { ...settled, cashoutAmount: 50_000 };
    expect(stampSettlement(stale, { ...stale, cashoutAmount: undefined } as Bet, now).settledAt).toBe(settled.settledAt);
  });

  it('pins an old bet\'s last edit before the edit moves it, and drops the stamp back to pending', () => {
    const old = { ...pending, status: 'lost' as const, updatedAt: at('2026-08-01', '15:00') };
    expect(stampSettlement(old, { ...old, notes: 'fixed later', updatedAt: now }, now).settledAt).toBe(at('2026-08-01', '15:00'));
    // An old last edit past the end of its day stands for the end of its day.
    const edited = { ...old, updatedAt: at('2026-08-20', '15:00') };
    expect(stampSettlement(edited, { ...edited, notes: 'again', updatedAt: now }, now).settledAt).toBe(new Date(2026, 7, 2).toISOString());
    const back = stampSettlement(old, { ...old, status: 'pending', settledAt: at('2026-08-01', '15:00') }, now);
    expect('settledAt' in back).toBe(false);
  });
});
