import { describe, it, expect } from 'vitest';
import { formatMoney, parseMoneyInput, formatOdds, formatPercent } from './formatters';

describe('formatMoney', () => {
  it('formats 1000 rub (100_000 kopecks)', () => {
    expect(formatMoney(100_000)).toContain('1');
    expect(formatMoney(100_000)).toContain('₽');
  });

  it('formats zero', () => {
    expect(formatMoney(0)).toContain('0');
  });

  it('handles fractional kopecks display', () => {
    expect(formatMoney(150_50)).toContain('1'); // 1 500.50
  });

  it('uses custom currency symbol', () => {
    expect(formatMoney(100_00, '$')).toContain('$');
    expect(formatMoney(100_00, '$')).not.toContain('₽');
  });

  it('formats large amounts with digit grouping', () => {
    const result = formatMoney(1_000_000_00); // 1 000 000 ₽
    expect(result).toContain('₽');
    expect(result.replace(/[^\d]/g, '').length).toBeGreaterThan(6);
  });
});

describe('parseMoneyInput', () => {
  it('parses integer rubles', () => {
    expect(parseMoneyInput('1000')).toBe(100_000);
  });

  it('parses decimal with dot', () => {
    expect(parseMoneyInput('1500.50')).toBe(150_050);
  });

  it('parses decimal with comma', () => {
    expect(parseMoneyInput('1500,50')).toBe(150_050);
  });

  it('strips non-numeric characters', () => {
    expect(parseMoneyInput('1 000 ₽')).toBe(100_000);
  });

  it('returns 0 for empty/invalid input', () => {
    expect(parseMoneyInput('')).toBe(0);
    expect(parseMoneyInput('abc')).toBe(0);
  });

  it('roundtrip: format → parse returns original kopecks', () => {
    const original = 150_050;
    const formatted = formatMoney(original).replace(' ₽', '');
    const parsed = parseMoneyInput(formatted);
    expect(parsed).toBe(original);
  });
});

describe('formatOdds', () => {
  it('formats to 2 decimal places', () => {
    expect(formatOdds(1.5)).toBe('1.50');
    expect(formatOdds(2)).toBe('2.00');
    expect(formatOdds(1.85)).toBe('1.85');
  });

  it('truncates long decimals', () => {
    expect(formatOdds(1.8567)).toBe('1.86');
  });
});

describe('formatPercent', () => {
  it('adds + for positive values', () => {
    expect(formatPercent(12.5)).toBe('+12.5%');
    expect(formatPercent(0.1)).toBe('+0.1%');
  });

  it('no sign for negative values', () => {
    expect(formatPercent(-8.3)).toBe('-8.3%');
  });

  it('no sign for zero', () => {
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('formats to 1 decimal place', () => {
    expect(formatPercent(12.567)).toBe('+12.6%');
  });
});
