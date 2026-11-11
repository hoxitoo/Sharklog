import { readFileSync } from 'fs';
import { join } from 'path';

/*
 * The result reminder fires at kick-off plus the match's length
 * (reminderFireAt). With the time folded away under «Стратегия, букмекер…» it
 * stayed the moment the bet was typed in: a bet placed in the morning on an
 * evening match reminded by lunchtime (report from a phone). The kick-off is
 * on the form itself, and the line under it says when the reminder will come.
 */
const src = readFileSync(join(__dirname, '../screens/AddBetScreen/index.tsx'), 'utf8');

describe('kick-off on the bet form', () => {
  it('is outside the folded extras', () => {
    const time = src.indexOf('name="time"');
    const extras = src.indexOf('{showExtra && (');
    expect(time).toBeGreaterThan(-1);
    expect(extras).toBeGreaterThan(-1);
    expect(time).toBeLessThan(extras);
  });

  it('is called the kick-off, and says when the reminder comes — from the function that schedules it', () => {
    expect(src).toContain("t('addBet.matchTime')");
    expect(src).toContain("t('addBet.remindAt'");
    expect(src).toMatch(/reminderFireAt\(/);
  });

  it('is checked as HH:MM — the reminder is timed by it', () => {
    // «21.00», «2130» or «21:» were saved as typed, and the reminder never came.
    expect(src).toMatch(/name="time"\s+rules=\{\{ validate: [^\n]*parseClock\(v\)[^\n]*t\('addBet\.errTime'\)/);
    expect(src).toContain('parseClock(data.time)');
  });

  it('promises a reminder only when one can come', () => {
    // With notifications off, "I'll remind you at 21:15" could not come true.
    expect(src).toContain('remindersCanCome(');
    expect(src).toContain("t('addBet.remindOff')");
  });
});
