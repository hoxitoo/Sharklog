import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { calcDashboard, formatMoney, formatPercent, isInTilt } from '@sharklog/core';
import type { Bet } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { colors } from '../../theme/colors';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatCard } from './StatCard';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function WLStrip({ bets }: { bets: Bet[] }) {
  const last7 = bets.filter((b) => b.status !== 'pending').slice(0, 7);
  if (last7.length === 0) return null;

  return (
    <View style={wl.container}>
      <Text style={wl.title}>Последние {last7.length} результатов</Text>
      <View style={wl.row}>
        {last7.map((b, i) => (
          <View
            key={b.id + i}
            style={[
              wl.square,
              b.status === 'won' && wl.squareW,
              b.status === 'lost' && wl.squareL,
              b.status === 'refund' && wl.squareR,
            ]}
          >
            <Text style={[wl.letter, {
              color: b.status === 'won' ? colors.won
                : b.status === 'lost' ? colors.lost
                : colors.refund,
            }]}>
              {b.status === 'won' ? 'W' : b.status === 'lost' ? 'L' : 'R'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const wl = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 6 },
  square: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  squareW: { backgroundColor: colors.won + '18', borderColor: colors.won + '55' },
  squareL: { backgroundColor: colors.lost + '18', borderColor: colors.lost + '55' },
  squareR: { backgroundColor: colors.refund + '18', borderColor: colors.refund + '55' },
  letter: { fontSize: 13, fontWeight: '700' },
});

function Heatmap({ bets }: { bets: Bet[] }) {
  const today = new Date();
  const weeks = 12;
  const totalDays = weeks * 7;

  const pnlByDate: Record<string, number> = {};
  const countByDate: Record<string, number> = {};
  for (const bet of bets) {
    if (bet.status === 'pending') continue;
    const profit = bet.status === 'won'
      ? Math.round(bet.stake * (bet.odds - 1))
      : bet.status === 'lost' ? -bet.stake : 0;
    pnlByDate[bet.date] = (pnlByDate[bet.date] ?? 0) + profit;
    countByDate[bet.date] = (countByDate[bet.date] ?? 0) + 1;
  }

  const days: Array<{ dateStr: string; pnl: number; count: number }> = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0] ?? '';
    days.push({
      dateStr,
      pnl: pnlByDate[dateStr] ?? 0,
      count: countByDate[dateStr] ?? 0,
    });
  }

  const columns: typeof days[] = [];
  for (let w = 0; w < weeks; w++) {
    columns.push(days.slice(w * 7, w * 7 + 7));
  }

  function cellColor(day: { pnl: number; count: number }) {
    if (day.count === 0) return colors.bgElevated;
    if (day.pnl > 0) return colors.won + (day.pnl > 50000 ? 'cc' : day.pnl > 10000 ? '88' : '44');
    if (day.pnl < 0) return colors.lost + (day.pnl < -50000 ? 'cc' : day.pnl < -10000 ? '88' : '44');
    return colors.textMuted + '44';
  }

  const hasAny = Object.keys(countByDate).length > 0;
  if (!hasAny) return null;

  return (
    <View style={hm.container}>
      <Text style={hm.title}>Активность за 12 недель</Text>
      <View style={hm.grid}>
        {columns.map((col, wi) => (
          <View key={wi} style={hm.col}>
            {col.map((day, di) => (
              <View
                key={di}
                style={[hm.cell, { backgroundColor: cellColor(day) }]}
              />
            ))}
          </View>
        ))}
      </View>
      <View style={hm.legend}>
        <View style={[hm.legendCell, { backgroundColor: colors.lost + '88' }]} />
        <Text style={hm.legendText}>−</Text>
        <View style={[hm.legendCell, { backgroundColor: colors.bgElevated }]} />
        <Text style={hm.legendText}>0</Text>
        <View style={[hm.legendCell, { backgroundColor: colors.won + '88' }]} />
        <Text style={hm.legendText}>+</Text>
      </View>
    </View>
  );
}

const hm = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  grid: { flexDirection: 'row', gap: 3 },
  col: { gap: 3 },
  cell: { width: 16, height: 16, borderRadius: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  legendCell: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 10, color: colors.textMuted },
});

export function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { bets, settings, bankroll } = useBetsStore();
  const stats = calcDashboard(bets);
  const inTilt = isInTilt(bets, settings.tiltThreshold);

  const bankTotal =
    bankroll.transactions.reduce(
      (sum, t) => (t.type === 'deposit' ? sum + t.amount : sum - t.amount),
      0,
    ) + stats.pnl;

  const last5 = bets.slice(0, 5);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <ScreenHeader
        title="Дашборд"
        subtitle={new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
      />

      {inTilt && (
        <View style={styles.tiltAlert}>
          <Text style={styles.tiltIcon}>⚠️</Text>
          <View>
            <Text style={styles.tiltTitle}>Внимание: возможный тилт</Text>
            <Text style={styles.tiltSub}>
              {stats.currentStreak.count} поражений подряд. Сделай паузу.
            </Text>
          </View>
        </View>
      )}

      <View style={styles.statsGrid}>
        <StatCard
          label="P&L"
          value={formatMoney(stats.pnl)}
          sub="чистая прибыль"
          positive={stats.pnl > 0}
          negative={stats.pnl < 0}
        />
        <StatCard
          label="ROI"
          value={formatPercent(stats.roi)}
          sub="возврат инвестиций"
          positive={stats.roi > 0}
          negative={stats.roi < 0}
        />
        <StatCard
          label="Винрейт"
          value={`${stats.winRate.toFixed(1)}%`}
          sub={`${stats.wonBets}W / ${stats.lostBets}L`}
          accent
        />
        <StatCard
          label="Банк"
          value={formatMoney(bankTotal)}
          sub="текущий баланс"
        />
      </View>

      <WLStrip bets={bets} />

      <View style={styles.streakRow}>
        <View style={[
          styles.streakCard,
          stats.currentStreak.type === 'win' && styles.streakWin,
          stats.currentStreak.type === 'loss' && styles.streakLoss,
        ]}>
          <Text style={styles.streakLabel}>Текущая серия</Text>
          <Text style={styles.streakValue}>
            {stats.currentStreak.type === 'none'
              ? '—'
              : `${stats.currentStreak.count} ${stats.currentStreak.type === 'win' ? '🏆' : '💸'}`}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.bankCard}
          onPress={() => navigation.navigate('Bankroll')}
          activeOpacity={0.75}
        >
          <Text style={styles.streakLabel}>Банкролл →</Text>
          <Text style={[styles.streakValue, { fontSize: 16 }]}>{formatMoney(bankTotal)}</Text>
        </TouchableOpacity>
      </View>

      <Heatmap bets={bets} />

      {stats.pnlCurve.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>P&L кривая</Text>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartNote}>
              📈 График (gifted-charts — Week 2)
            </Text>
            <Text style={styles.chartNote}>
              Последний: {formatMoney(stats.pnlCurve[stats.pnlCurve.length - 1]?.pnl ?? 0)}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Последние ставки</Text>
        {last5.length === 0 ? (
          <Text style={styles.emptyText}>Ставок пока нет</Text>
        ) : (
          last5.map((bet) => (
            <TouchableOpacity
              key={bet.id}
              style={styles.recentBet}
              onPress={() => navigation.navigate('AddBet', { betId: bet.id })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.recentEvent} numberOfLines={1}>{bet.event}</Text>
                <Text style={styles.recentPick}>{bet.pick} · ×{bet.odds}</Text>
              </View>
              <View style={[
                styles.recentStatus,
                { backgroundColor:
                    bet.status === 'won' ? colors.won + '22' :
                    bet.status === 'lost' ? colors.lost + '22' :
                    colors.pending + '22'
                }
              ]}>
                <Text style={{
                  color: bet.status === 'won' ? colors.won : bet.status === 'lost' ? colors.lost : colors.pending,
                  fontSize: 12, fontWeight: '600',
                }}>
                  {bet.status === 'won' ? 'W' : bet.status === 'lost' ? 'L' : bet.status === 'refund' ? 'R' : '?'}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tiltAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    margin: 16,
    marginTop: 0,
    padding: 14,
    backgroundColor: colors.lost + '15',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lost + '44',
  },
  tiltIcon: { fontSize: 24 },
  tiltTitle: { fontSize: 14, fontWeight: '700', color: colors.lost },
  tiltSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  streakRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 14 },
  streakCard: {
    flex: 2,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  streakWin: { borderColor: colors.won + '66', backgroundColor: colors.won + '11' },
  streakLoss: { borderColor: colors.lost + '66', backgroundColor: colors.lost + '11' },
  streakLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  streakValue: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  bankCard: {
    flex: 1,
    backgroundColor: colors.purpleDim,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.purple + '44',
  },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
  chartPlaceholder: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  chartNote: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 4 },
  emptyText: { fontSize: 14, color: colors.textMuted },
  recentBet: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentEvent: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  recentPick: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  recentStatus: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
});
