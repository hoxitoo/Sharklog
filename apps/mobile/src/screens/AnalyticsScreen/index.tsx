import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import {
  calcByField, calcByOddsRange, calcByDayOfWeek,
  SPORTS, BET_TYPES, STRATEGIES, formatMoney, formatPercent,
} from '@sharklog/core';
import type { SliceStats } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { ProGate } from '../../components/ProGate';
import { ScreenHeader } from '../../components/ScreenHeader';
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

function AnalyticsContent() {
  const { bets } = useBetsStore();

  const bySport = calcByField(bets, 'sport', (v) => SPORTS[v] ?? String(v));
  const byBetType = calcByField(bets, 'betType', (v) => BET_TYPES[v] ?? String(v));
  const byBookmaker = calcByField(bets, 'bookmaker');
  const byStrategy = calcByField(bets, 'strategy', (v) => STRATEGIES[v] ?? String(v));
  const byOdds = calcByOddsRange(bets);
  const byDay = calcByDayOfWeek(bets);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
      <Section title="По виду спорта" stats={bySport} />
      <Section title="По типу ставки" stats={byBetType} />
      <Section title="По букмекеру" stats={byBookmaker} />
      <Section title="По стратегии" stats={byStrategy} />
      <Section title="По коэффициенту" stats={byOdds} />
      <Section title="По дню недели" stats={byDay} />
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
});
