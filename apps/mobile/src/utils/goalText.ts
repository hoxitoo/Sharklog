import type { TFunction } from 'i18next';
import { MONTH_DAYS } from '@sharklog/core';
import { dayMonth } from './calendar';

/*
 * The words around a goal's numbers. Pure — no React Native — so it is under test.
 */

/**
 * A stretch of days in short units: "12 дн.", "5 мес.", "2 г. 11 мес.". Short
 * units on purpose: they need no plural forms in any of the four languages,
 * and the card has room for them.
 */
export function durationLabel(t: TFunction, days: number): string {
  if (days < 60) return t('goals.dur.days', { d: Math.max(0, days) });
  const months = Math.round(days / MONTH_DAYS);
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return t('goals.dur.months', { m });
  if (m === 0) return t('goals.dur.years', { y });
  return t('goals.dur.yearsMonths', { y, m });
}

/** A goal's day as the user reads it: DD.MM.YYYY (`dayMonth` in utils/calendar). */
export const dayLabel = (ymd: string): string => dayMonth(ymd, 'yyyy');

/**
 * How far a goal has come, in whole percent — DOWN, so "100%" never shows
 * before the goal is reached. The header button and the card both read it here:
 * one rounded the share, the other cut it, and the same goal read 11% and 12%.
 */
export function goalPercent(ratio: number): number {
  return Math.floor(Math.min(1, Math.max(0, ratio)) * 100);
}
