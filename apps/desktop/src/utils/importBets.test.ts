import { describe, it, expect } from 'vitest';
import { importFromCSV } from './importBets';

// ─── CSV header parsing ───────────────────────────────────────────────────────

const VALID_CSV = `"Дата","Событие","Выбор","Коэф.","Ставка","Статус","P&L","Букмекер","Стратегия","Спорт","Тип ставки","Заметка"
"2025-05-20","Team A vs Team B","П1","2.10","1000.00","won","1100.00","1xBet","value","football","1X2",""
"2025-05-21","Player X vs Player Y","П2","1.85","500.00","lost","-500.00","Fonbet","stats","tennis","1X2","хороший матч"
"2025-05-22","NaVi vs Virtus","Фора","3.00","200.00","pending","0.00","Parimatch","intuition","esports","handicap",""`;

describe('importFromCSV – happy path', () => {
  it('returns correct count', () => {
    const result = importFromCSV(VALID_CSV);
    expect(result.bets).toHaveLength(3);
    expect(result.skipped).toBe(0);
    expect(result.total).toBe(3);
  });

  it('parses odds as number', () => {
    const { bets } = importFromCSV(VALID_CSV);
    expect(bets[0]?.odds).toBe(2.1);
  });

  it('converts stake to kopecks', () => {
    const { bets } = importFromCSV(VALID_CSV);
    expect(bets[0]?.stake).toBe(100_000); // 1000 ₽ = 100 000 коп.
    expect(bets[1]?.stake).toBe(50_000);  // 500 ₽
  });

  it('maps status correctly', () => {
    const { bets } = importFromCSV(VALID_CSV);
    expect(bets[0]?.status).toBe('won');
    expect(bets[1]?.status).toBe('lost');
    expect(bets[2]?.status).toBe('pending');
  });

  it('maps sport correctly', () => {
    const { bets } = importFromCSV(VALID_CSV);
    expect(bets[0]?.sport).toBe('football');
    expect(bets[1]?.sport).toBe('tennis');
    expect(bets[2]?.sport).toBe('esports');
  });

  it('maps betType correctly', () => {
    const { bets } = importFromCSV(VALID_CSV);
    expect(bets[0]?.betType).toBe('1X2');
    expect(bets[2]?.betType).toBe('handicap');
  });

  it('preserves notes field', () => {
    const { bets } = importFromCSV(VALID_CSV);
    expect(bets[1]?.notes).toBe('хороший матч');
    expect(bets[0]?.notes).toBeUndefined();
  });

  it('assigns unique UUIDs to each bet', () => {
    const { bets } = importFromCSV(VALID_CSV);
    const ids = bets.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── Status alias mapping ─────────────────────────────────────────────────────

describe('importFromCSV – status aliases', () => {
  function csvWithStatus(status: string) {
    return `"Дата","Событие","Коэф.","Ставка","Статус"\n"2025-01-01","A vs B","2.0","100","${status}"`;
  }

  it.each([
    ['выигрыш', 'won'],
    ['победа', 'won'],
    ['win', 'won'],
    ['проигрыш', 'lost'],
    ['поражение', 'lost'],
    ['возврат', 'refund'],
    ['ожидание', 'pending'],
  ])('maps "%s" → "%s"', (alias, expected) => {
    const { bets } = importFromCSV(csvWithStatus(alias));
    expect(bets[0]?.status).toBe(expected);
  });
});

// ─── Date normalization ───────────────────────────────────────────────────────

describe('importFromCSV – date normalization', () => {
  function csvWithDate(date: string) {
    return `"Дата","Событие","Коэф.","Ставка","Статус"\n"${date}","A vs B","2.0","100","won"`;
  }

  it('accepts ISO format YYYY-MM-DD', () => {
    const { bets } = importFromCSV(csvWithDate('2025-05-20'));
    expect(bets[0]?.date).toBe('2025-05-20');
  });

  it('converts DD.MM.YYYY to YYYY-MM-DD', () => {
    const { bets } = importFromCSV(csvWithDate('20.05.2025'));
    expect(bets[0]?.date).toBe('2025-05-20');
  });

  it('converts DD/MM/YYYY to YYYY-MM-DD', () => {
    const { bets } = importFromCSV(csvWithDate('20/05/2025'));
    expect(bets[0]?.date).toBe('2025-05-20');
  });
});

// ─── Error / edge cases ───────────────────────────────────────────────────────

describe('importFromCSV – invalid rows', () => {
  it('skips rows missing event', () => {
    const csv = `"Дата","Событие","Коэф.","Ставка","Статус"\n"2025-01-01","","2.0","100","won"`;
    const result = importFromCSV(csv);
    expect(result.bets).toHaveLength(0);
    expect(result.skipped).toBe(1);
  });

  it('skips rows with invalid odds (≤ 1)', () => {
    const csv = `"Дата","Событие","Коэф.","Ставка","Статус"\n"2025-01-01","A vs B","0.8","100","won"`;
    const result = importFromCSV(csv);
    expect(result.bets).toHaveLength(0);
    expect(result.skipped).toBe(1);
  });

  it('skips rows with zero stake', () => {
    const csv = `"Дата","Событие","Коэф.","Ставка","Статус"\n"2025-01-01","A vs B","2.0","0","won"`;
    const result = importFromCSV(csv);
    expect(result.bets).toHaveLength(0);
    expect(result.skipped).toBe(1);
  });

  it('returns empty result for header-only CSV', () => {
    const csv = `"Дата","Событие","Коэф.","Ставка","Статус"`;
    const result = importFromCSV(csv);
    expect(result.bets).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('returns empty result for empty string', () => {
    expect(importFromCSV('').bets).toHaveLength(0);
  });

  it('handles mixed valid and invalid rows', () => {
    const csv = `"Дата","Событие","Коэф.","Ставка","Статус"
"2025-01-01","A vs B","2.0","100","won"
"2025-01-02","","2.0","100","won"
"2025-01-03","C vs D","1.9","200","lost"`;
    const result = importFromCSV(csv);
    expect(result.bets).toHaveLength(2);
    expect(result.skipped).toBe(1);
  });
});

// ─── Russian column headers ───────────────────────────────────────────────────

describe('importFromCSV – Russian column aliases', () => {
  it('recognises "Матч" as event column', () => {
    const csv = `"Матч","Коэф.","Ставка","Статус"\n"X vs Y","2.0","100","won"`;
    const { bets } = importFromCSV(csv);
    expect(bets[0]?.event).toBe('X vs Y');
  });

  it('recognises "Букмекер" as bookmaker column', () => {
    const csv = `"Событие","Коэф.","Ставка","Статус","Букмекер"\n"A vs B","2.0","100","won","Leon"`;
    const { bets } = importFromCSV(csv);
    expect(bets[0]?.bookmaker).toBe('Leon');
  });
});
