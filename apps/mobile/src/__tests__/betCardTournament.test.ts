import { readFileSync } from 'fs';
import { join } from 'path';

/*
 * The bet card names the league — «Хоккей · NHL · Исход (1X2)» (request from
 * a phone, 2026-11-13) — on both screens that draw it (bets, «Ждут
 * результата»): the tournament the form saves, trimmed, between the sport and
 * the market, as a nested Text with its own weight.
 */
const card = readFileSync(join(__dirname, '../screens/BetsScreen/BetCard.tsx'), 'utf8');
const screens = ['BetsScreen', 'PendingScreen'].map((d) => readFileSync(join(__dirname, `../screens/${d}/index.tsx`), 'utf8'));

describe('the bet card', () => {
  it('shows the tournament between the sport and the market', () => {
    expect(card).toContain('const tournament = bet.tournament?.trim();');
    const line = card.slice(card.indexOf('<Text style={styles.sport}'), card.indexOf('</Text>', card.indexOf('betTypeLabel(t, bet.betType)')));
    expect(line).toMatch(/sportLabel\(t, bet\.sport\)[\s\S]*<Text style=\{styles\.tournament\}>\{tournament\}<\/Text>[\s\S]*betTypeLabel/);
  });

  it('is the card both screens draw — bets and «Ждут результата»', () => {
    for (const src of screens) expect(src).toMatch(/<BetCard\b/);
  });

  it('gives the nested tournament its own weight', () => {
    expect(card).toMatch(/tournament: \{[^}]*fontWeight: '600'/);
  });
});
