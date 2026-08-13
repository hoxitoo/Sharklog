import { describe, it, expect } from 'vitest';
import type { Bet } from '../types/bet';
import { buildBetsCSV, importBetsFromCSV, importBetsFromRows, parseAmount } from '../utils/betsCsv';

let seq = 0;
const newId = () => `id-${++seq}`;

function bet(over: Partial<Bet> = {}): Bet {
  return {
    id: 'b1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    date: '2026-01-15', time: '18:30', sport: 'football', bookmaker: 'Fonbet',
    event: 'Spain vs Argentina', betType: 'handicap', pick: 'Ф2 (-1)', odds: 2.5,
    stake: 500_000, status: 'won', strategy: 'value', schemaVersion: 2,
    ...over,
  } as Bet;
}

describe('buildBetsCSV', () => {
  it('scores refunds at zero and cashouts at what came back', () => {
    const csv = buildBetsCSV([
      bet({ status: 'refund' }),
      bet({ status: 'cashout', cashoutAmount: 620_000 }),
      bet({ status: 'lost', isFreebet: true }),
      bet({ status: 'lost' }),
      bet({ status: 'won' }),
    ]);
    const pnl = csv.split('\n').slice(1).map((r) => r.split(';')[7]);
    expect(pnl).toEqual(['0', '1200', '0', '-5000', '7500']);
  });

  it('neutralises formula injection but keeps signed numbers intact', () => {
    const csv = buildBetsCSV([bet({ status: 'lost', event: '=cmd|calc', notes: '+79001234567' })]);
    const cells = csv.split('\n')[1]!.split(';');
    expect(cells[2]).toBe("'=cmd|calc");
    expect(cells[15]).toBe("'+79001234567");
    expect(cells[7]).toBe('-5000'); // the amount is a number, so it is not quoted
  });

  it('quotes cells containing the separator', () => {
    const csv = buildBetsCSV([bet({ notes: 'ставил; жалею' })]);
    expect(csv.split('\n')[1]).toContain('"ставил; жалею"');
  });
});

describe('round trip', () => {
  it('re-imports its own export without losing a field', () => {
    const original = bet({
      status: 'cashout', cashoutAmount: 620_000, tournament: 'IEM Katowice',
      sport: 'esports', discipline: 'csgo', notes: 'по форме', isFreebet: true,
    });
    const [back] = importBetsFromCSV('﻿' + buildBetsCSV([original]), newId).bets;

    expect(back).toBeDefined();
    expect(back!.date).toBe('2026-01-15');
    expect(back!.time).toBe('18:30');
    expect(back!.event).toBe('Spain vs Argentina');
    expect(back!.pick).toBe('Ф2 (-1)');
    expect(back!.odds).toBe(2.5);
    expect(back!.stake).toBe(500_000);
    expect(back!.status).toBe('cashout');
    expect(back!.sport).toBe('esports');
    expect(back!.betType).toBe('handicap');
    expect(back!.strategy).toBe('value');
    expect(back!.bookmaker).toBe('Fonbet');
    expect(back!.tournament).toBe('IEM Katowice');
    expect(back!.discipline).toBe('csgo');
    expect(back!.isFreebet).toBe(true);
    expect(back!.notes).toBe('по форме');
  });

  it('survives the BOM the export writes for Excel', () => {
    const csv = '﻿' + buildBetsCSV([bet()]);
    expect(importBetsFromCSV(csv, newId).bets[0]!.date).toBe('2026-01-15');
  });
});

describe('importBetsFromCSV', () => {
  it('reads comma, semicolon and tab separated files alike', () => {
    const rows = [
      ['Дата,Событие,Коэф.,Ставка,Статус', '2026-02-01,A vs B,1.85,1000,Победа'],
      ['Дата;Событие;Коэф.;Ставка;Статус', '2026-02-01;A vs B;1.85;1000;Победа'],
      ['Дата\tСобытие\tКоэф.\tСтавка\tСтатус', '2026-02-01\tA vs B\t1.85\t1000\tПобеда'],
    ];
    for (const lines of rows) {
      const { bets } = importBetsFromCSV(lines.join('\n'), newId);
      expect(bets).toHaveLength(1);
      expect(bets[0]!.odds).toBe(1.85);
      expect(bets[0]!.stake).toBe(100_000);
      expect(bets[0]!.status).toBe('won');
    }
  });

  it('accepts a foreign export: English headers, dd/mm/yyyy, HomeTeam/AwayTeam', () => {
    const csv = [
      'Placed At,Home Team,Away Team,Selection,Decimal Odds,Amount,Result,League',
      '15/03/2026,NaVi,Astralis,NaVi ML,1.72,"2,500.00",Win,IEM',
    ].join('\n');
    const [b] = importBetsFromCSV(csv, newId).bets;
    expect(b!.date).toBe('2026-03-15');
    expect(b!.event).toBe('NaVi vs Astralis');
    expect(b!.odds).toBe(1.72);
    expect(b!.stake).toBe(250_000);
    expect(b!.status).toBe('won');
    expect(b!.tournament).toBe('IEM');
  });

  it('skips rows without a usable event, odds or stake', () => {
    const csv = [
      'Дата;Событие;Коэф.;Ставка',
      '2026-02-01;;1.85;1000',      // no event
      '2026-02-01;A vs B;1.00;1000', // odds must beat 1
      '2026-02-01;A vs B;1.85;0',    // no stake
      '2026-02-01;A vs B;1.85;1000', // the only good row
    ].join('\n');
    const res = importBetsFromCSV(csv, newId);
    expect(res.bets).toHaveLength(1);
    expect(res.skipped).toBe(3);
    expect(res.total).toBe(4);
  });

  it('finds the header row under a title banner', () => {
    const csv = [
      'Отчёт по ставкам',
      'Выгружено 2026-02-01',
      'Дата;Событие;Коэф.;Ставка;Статус',
      '2026-02-01;A vs B;1.85;1000;Поражение',
    ].join('\n');
    expect(importBetsFromCSV(csv, newId).bets).toHaveLength(1);
  });

  it('falls back to valid enum members instead of blank cells', () => {
    const csv = 'Событие;Коэф.;Ставка;Спорт;Тип;Стратегия\nA vs B;1.85;1000;Кёрлинг;Странный;???';
    const [b] = importBetsFromCSV(csv, newId).bets;
    expect(b!.sport).toBe('other');
    expect(b!.betType).toBe('1X2');
    expect(b!.strategy).toBe('other');
  });

  it('gives every imported bet its own id', () => {
    const csv = 'Событие;Коэф.;Ставка\nA vs B;1.85;1000\nC vs D;2.10;500';
    const { bets } = importBetsFromCSV(csv, newId);
    expect(new Set(bets.map((b) => b.id)).size).toBe(2);
  });

  it('returns nothing for an empty or header-only file', () => {
    expect(importBetsFromCSV('', newId).bets).toHaveLength(0);
    expect(importBetsFromCSV('Дата;Событие', newId).bets).toHaveLength(0);
  });
});

describe('importBetsFromRows', () => {
  it('takes an already-split table (XLSX sheets)', () => {
    const { bets } = importBetsFromRows([
      ['Дата', 'Событие', 'Коэф.', 'Ставка', 'Статус'],
      ['2026-02-01', 'A vs B', '1.85', '1000', 'Возврат'],
    ], newId);
    expect(bets[0]!.status).toBe('refund');
  });
});

describe('parseAmount', () => {
  it('reads every separator convention a bookmaker uses', () => {
    expect(parseAmount('5,000.00 ₽')).toBe(5000);
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('1 234,56')).toBe(1234.56);
    expect(parseAmount('1,234')).toBe(1234);
    expect(parseAmount('1,85')).toBe(1.85);
    expect(parseAmount('403.00')).toBe(403);
    expect(parseAmount('—')).toBeNaN();
  });
});
