import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import {
  calcByField, calcByOddsRange, calcByDayOfWeek, calcByHour, calcDashboard,
  SPORTS, BET_TYPES, STRATEGIES, formatMoney, formatPercent,
} from '@sharklog/core';
import type { SliceStats } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { ProGate } from '../../components/ProGate';
import { ScreenHeader } from '../../components/ScreenHeader';
import { haptic } from '../../utils/haptics';
import { colors } from '../../theme/colors';

function SliceRow({ stat, maxPnl }: { stat: SliceStats; maxPnl: number }) {
  const barWidth = maxPnl > 0 ? Math.abs(stat.pnl) / maxPnl : 0;
  const isPositive = stat.pnl >= 0;

  return (
    <View style={slice.row}>
      <View style={slice.labelCol}>
        <Text style={slice.label} numberOfLines={1}>{stat.label}</Text>
        <Text style={slice.meta}>{stat.count} ставок · {stat.winRate.toFixed(0)}% WR</Text>
      </View>
      <View style={slice.barCol}>
        <View style={[
          slice.bar,
          { width: `${Math.max(barWidth * 100, 4)}%` },
          { backgroundColor: isPositive ? colors.won : colors.lost },
        ]} />
      </View>
      <View style={slice.valueCol}>
        <Text style={[slice.pnl, { color: isPositive ? colors.won : colors.lost }]}>
          {formatPercent(stat.roi)}
        </Text>
        <Text style={slice.pnlSub}>{formatMoney(stat.pnl)}</Text>
      </View>
    </View>
  );
}

const slice = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  labelCol: { width: 90 },
  label: { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  meta: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  barCol: { flex: 1, height: 6, backgroundColor: colors.bgElevated, borderRadius: 3, marginHorizontal: 8 },
  bar: { height: 6, borderRadius: 3 },
  valueCol: { width: 60, alignItems: 'flex-end' },
  pnl: { fontSize: 13, fontWeight: '700' },
  pnlSub: { fontSize: 10, color: colors.textMuted },
});

function Section({ title, stats }: { title: string; stats: SliceStats[] }) {
  const maxPnl = Math.max(...stats.map((s) => Math.abs(s.pnl)), 1);
  const hasData = stats.some((s) => s.count > 0);

  return (
    <View style={sec.container}>
      <Text style={sec.title}>{title}</Text>
      {hasData ? (
        stats.filter((s) => s.count > 0).map((s) => (
          <SliceRow key={s.label} stat={s} maxPnl={maxPnl} />
        ))
      ) : (
        <Text style={sec.empty}>Нет данных</Text>
      )}
    </View>
  );
}

const sec = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 14 },
  empty: { fontSize: 13, color: colors.textMuted },
});

function SummaryCard({ bets }: { bets: Parameters<typeof calcDashboard>[0] }) {
  const stats = calcDashboard(bets);
  const pnlColor = stats.pnl > 0 ? colors.won : stats.pnl < 0 ? colors.lost : colors.textPrimary;

  const bestSport = calcByField(bets, 'sport', (v) => SPORTS[v] ?? String(v))
    .filter((s) => s.count >= 3)
    .sort((a, b) => b.roi - a.roi)[0];

  return (
    <View style={summary.card}>
      <Text style={summary.title}>Общая статистика</Text>
      <View style={summary.grid}>
        <View style={summary.gridRow}>
          <View style={summary.cell}>
            <Text style={summary.value}>{stats.totalBets}</Text>
            <Text style={summary.label}>Ставок</Text>
          </View>
          <View style={summary.cell}>
            <Text style={[summary.value, { color: stats.winRate > 50 ? colors.won : colors.textPrimary }]}>
              {stats.winRate.toFixed(1)}%
            </Text>
            <Text style={summary.label}>Выигрышей</Text>
          </View>
        </View>
        <View style={summary.gridRow}>
          <View style={summary.cell}>
            <Text style={[summary.value, { color: pnlColor }]} numberOfLines={1} adjustsFontSizeToFit>
              {stats.pnl >= 0 ? '+' : ''}{formatMoney(stats.pnl)}
            </Text>
            <Text style={summary.label}>P&L</Text>
          </View>
          <View style={summary.cell}>
            <Text style={[summary.value, { color: pnlColor }]}>
              {formatPercent(stats.roi)}
            </Text>
            <Text style={summary.label}>ROI</Text>
          </View>
        </View>
      </View>
      {bestSport && bestSport.roi > 0 && (
        <View style={summary.best}>
          <Text style={summary.bestLabel}>Лучший вид спорта</Text>
          <Text style={summary.bestValue}>{bestSport.label} · ROI {formatPercent(bestSport.roi)}</Text>
        </View>
      )}
    </View>
  );
}

const summary = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 14 },
  grid: { flexDirection: 'column', gap: 12 },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cell: { alignItems: 'center', flex: 1 },
  value: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  label: { fontSize: 11, color: colors.textMuted, marginTop: 3 },
  best: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bestLabel: { fontSize: 12, color: colors.textMuted },
  bestValue: { fontSize: 13, fontWeight: '600', color: colors.accent },
});

type APeriodFilter = '7d' | '30d' | 'all';
const A_PERIOD_OPTIONS: Array<{ key: APeriodFilter; label: string }> = [
  { key: '7d', label: '7 дней' },
  { key: '30d', label: '30 дней' },
  { key: 'all', label: 'Всё время' },
];

function AnalyticsContent() {
  const { bets } = useBetsStore();
  const [period, setPeriod] = useState<APeriodFilter>('all');

  const filteredBets = useMemo(() => {
    if (period === 'all') return bets;
    const days = period === '7d' ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0] ?? '';
    return bets.filter((b) => b.date > cutoffStr);
  }, [bets, period]);

  const bySport = calcByField(filteredBets, 'sport', (v) => SPORTS[v] ?? String(v));
  const byBetType = calcByField(filteredBets, 'betType', (v) => BET_TYPES[v] ?? String(v));
  const byBookmaker = calcByField(filteredBets, 'bookmaker');
  const byStrategy = calcByField(filteredBets, 'strategy', (v) => STRATEGIES[v] ?? String(v));
  const byOdds = calcByOddsRange(filteredBets);
  const byDay = calcByDayOfWeek(filteredBets);
  const byHour = calcByHour(filteredBets);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={styles.periodRow}>
        {A_PERIOD_OPTIONS.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
            onPress={() => { haptic.selection(); setPeriod(p.key); }}
          >
            <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <SummaryCard bets={filteredBets} />
      <Section title="По виду спорта" stats={bySport} />
      <Section title="По типу ставки" stats={byBetType} />
      <Section title="По букмекеру" stats={byBookmaker} />
      <Section title="По стратегии" stats={byStrategy} />
      <Section title="По коэффициенту" stats={byOdds} />
      <Section title="По дню недели" stats={byDay} />
      <Section title="По часам дня" stats={byHour} />
    </ScrollView>
  );
}

export function AnalyticsScreen() {
  return (
    <View style={styles.container}>
      <ScreenHeader title="Аналитика" subtitle="7 срезов статистики" />
      <ProGate feature="Полная аналитика по 7 срезам">
        <AnalyticsContent />
      </ProGate>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 10,
    marginBottom: 14,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodBtnActive: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  periodText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  periodTextActive: { color: '#fff' },
});
