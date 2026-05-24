import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { calcDashboard, formatMoney, formatPercent, isInTilt } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { colors } from '../../theme/colors';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatCard } from './StatCard';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

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
        <View style={styles.totalCard}>
          <Text style={styles.streakLabel}>Всего ставок</Text>
          <Text style={styles.totalValue}>{stats.totalBets}</Text>
        </View>
      </View>

      {stats.pnlCurve.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>P&L кривая</Text>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartNote}>
              📈 График подключается на следующем шаге (gifted-charts)
            </Text>
            <Text style={styles.chartNote}>
              Последний P&L: {formatMoney(stats.pnlCurve[stats.pnlCurve.length - 1]?.pnl ?? 0)}
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
                  {bet.status === 'won' ? 'W' : bet.status === 'lost' ? 'L' : '?'}
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
  streakRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 16 },
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
  totalCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  totalValue: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
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
