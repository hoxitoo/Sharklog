import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { calcByTournament, calcByTeam, formatMoney, formatPercent, SPORTS, toYmd } from '@sharklog/core';
import type { TournamentStats, TeamStats } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { colors } from '../../theme/colors';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ProGate } from '../../components/ProGate';

type Period = '7d' | '30d' | 'all';
const PERIOD_OPTIONS: Array<{ key: Period; label: string }> = [
  { key: '7d', label: '7 дн' },
  { key: '30d', label: '30 дн' },
  { key: 'all', label: 'Всё' },
];

const SPORT_ICONS: Record<string, string> = {
  football: '⚽', hockey: '🏒', basketball: '🏀', tennis: '🎾',
  esports: '🎮', volleyball: '🏐', baseball: '⚾', other: '🏅',
};

const TournamentRow = React.memo(function TournamentRow({ t }: { t: TournamentStats }) {
  const pnlColor = t.pnl > 0 ? colors.won : t.pnl < 0 ? colors.lost : colors.textSecondary;
  return (
    <View style={s.tRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.tName} numberOfLines={1}>{t.tournament}</Text>
        <Text style={s.tSub}>
          {SPORT_ICONS[t.sport] ?? '🏅'} {SPORTS[t.sport as keyof typeof SPORTS] ?? t.sport} · {t.count} ставок · {t.winRate.toFixed(0)}% WR
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[s.tPnl, { color: pnlColor }]}>{t.pnl >= 0 ? '+' : ''}{formatMoney(t.pnl)}</Text>
        <Text style={[s.tRoi, { color: pnlColor }]}>{formatPercent(t.roi)} ROI</Text>
      </View>
    </View>
  );
});

const TeamCard = React.memo(function TeamCard({ team }: { team: TeamStats }) {
  const pnlColor = team.pnl > 0 ? colors.won : team.pnl < 0 ? colors.lost : colors.textSecondary;
  return (
    <View style={s.teamCard}>
      <View style={s.teamHeader}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={s.teamName} numberOfLines={1}>{team.name}</Text>
          <Text style={s.teamSub} numberOfLines={1}>
            {SPORT_ICONS[team.sport] ?? '🏅'} {SPORTS[team.sport as keyof typeof SPORTS] ?? team.sport}
            {team.lastTournament ? ` · ${team.lastTournament}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[s.teamPnl, { color: pnlColor }]}>{team.pnl >= 0 ? '+' : ''}{formatMoney(team.pnl)}</Text>
          <Text style={[s.teamRoi, { color: pnlColor }]}>{formatPercent(team.roi)}</Text>
        </View>
      </View>
      <View style={s.teamStats}>
        {[
          { label: 'Ставок', value: String(team.count), color: colors.textPrimary },
          { label: 'Побед', value: String(team.won), color: colors.won },
          { label: 'Пораж', value: String(team.lost), color: colors.lost },
          { label: 'WR', value: `${team.winRate.toFixed(0)}%`, color: colors.purple },
        ].map((item) => (
          <View key={item.label} style={s.teamStatItem}>
            <Text style={[s.teamStatVal, { color: item.color }]}>{item.value}</Text>
            <Text style={s.teamStatLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

export function InsightsScreen() {
  const { bets, settings } = useBetsStore();
  const [period, setPeriod] = useState<Period>('all');

  const filteredBets = useMemo(() => {
    if (period === 'all') return bets;
    const days = period === '7d' ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = toYmd(cutoff);
    return bets.filter((b) => b.date > cutoffStr);
  }, [bets, period]);

  const tournaments = useMemo(() => calcByTournament(filteredBets), [filteredBets]);
  const teams = useMemo(() => calcByTeam(filteredBets, 5), [filteredBets]);

  return (
    <View style={s.root}>
      <ScreenHeader title="Инсайты" subtitle="Турниры и команды" />
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Period filter */}
        <View style={s.periodRow}>
          {PERIOD_OPTIONS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[s.periodBtn, period === p.key && s.periodBtnActive]}
              onPress={() => setPeriod(p.key)}
            >
              <Text style={[s.periodLabel, period === p.key && s.periodLabelActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tournaments section */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Турниры и лиги</Text>
          {tournaments.length === 0 ? (
            <Text style={s.empty}>Добавляй турнир при записи ставки — здесь появится статистика</Text>
          ) : (
            tournaments.map((t) => <TournamentRow key={t.tournament} t={t} />)
          )}
        </View>

        {/* Teams section — PRO */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Любимые команды</Text>
          <ProGate feature="Анализ любимых команд (10+ ставок)">
            {teams.length === 0 ? (
              <Text style={s.empty}>Нужно минимум 5 ставок на одну команду</Text>
            ) : (
              teams.map((team, idx) => <TeamCard key={`${team.name}-${idx}`} team={team} />)
            )}
          </ProGate>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 32 },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  periodBtnActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  periodLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  periodLabelActive: { color: '#fff', fontWeight: '700' },
  card: {
    backgroundColor: colors.bgCard, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: colors.border, marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  empty: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  tRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  tName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  tSub: { fontSize: 11, color: colors.textMuted },
  tPnl: { fontSize: 14, fontWeight: '700' },
  tRoi: { fontSize: 11, fontWeight: '600' },
  teamCard: {
    backgroundColor: colors.bgElevated, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  teamHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  teamName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  teamSub: { fontSize: 11, color: colors.textSecondary },
  teamPnl: { fontSize: 16, fontWeight: '700' },
  teamRoi: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  teamStats: { flexDirection: 'row', justifyContent: 'space-around' },
  teamStatItem: { alignItems: 'center' },
  teamStatVal: { fontSize: 16, fontWeight: '700' },
  teamStatLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
});
