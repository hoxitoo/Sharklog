import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Bet } from '@sharklog/core';
import { formatMoney } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { colors } from '../../theme/colors';
import { BetCard } from '../BetsScreen/BetCard';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Kick-off timestamp, parsed as LOCAL time (a bare date string would read as UTC). */
function startedAt(bet: Bet): number {
  // Same default as the reminder scheduler ('12:00'), otherwise a bet with no time
  // is flagged "матч давно прошёл" from 03:00 while its reminder assumed midday.
  const t = new Date(`${bet.date}T${(bet.time || '12:00')}:00`).getTime();
  return isNaN(t) ? 0 : t;
}

function agoLabel(ms: number): string {
  if (ms <= 0) return '';
  const h = Math.floor(ms / 3_600_000);
  if (h >= 24) return `${Math.floor(h / 24)} д назад`;
  if (h >= 1) return `${h} ч назад`;
  return `${Math.max(1, Math.floor(ms / 60_000))} мин назад`;
}

export function PendingScreen() {
  const navigation = useNavigation<Nav>();
  const bets = useBetsStore((s) => s.bets);

  // Oldest kick-off first — those are the ones whose result is already known.
  const pending = useMemo(
    () => bets.filter((b) => b.status === 'pending').sort((a, b) => startedAt(a) - startedAt(b)),
    [bets],
  );

  const exposure = useMemo(() => pending.reduce((sum, b) => sum + b.stake, 0), [pending]);
  const potential = useMemo(
    () => pending.reduce((sum, b) => sum + Math.round(b.stake * b.odds), 0),
    [pending],
  );
  // Ticking clock — otherwise "2 ч назад" and the overdue count freeze on an open screen.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const overdue = pending.filter((b) => startedAt(b) > 0 && startedAt(b) < now - 3 * 3_600_000).length;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerCell}>
          <Text style={s.headerLabel}>В игре</Text>
          <Text style={[s.headerValue, { color: colors.pending }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(exposure)}
          </Text>
          <Text style={s.headerSub}>{pending.length} ставок</Text>
        </View>
        <View style={s.headerDivider} />
        <View style={s.headerCell}>
          <Text style={s.headerLabel}>Если зайдут</Text>
          <Text style={[s.headerValue, { color: colors.won }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(potential)}
          </Text>
          <Text style={s.headerSub}>полный возврат</Text>
        </View>
        <View style={s.headerDivider} />
        <View style={s.headerCell}>
          <Text style={s.headerLabel}>Пора закрыть</Text>
          <Text style={[s.headerValue, { color: overdue > 0 ? colors.lost : colors.textMuted }]}>
            {overdue > 0 ? String(overdue) : '—'}
          </Text>
          <Text style={s.headerSub}>матч давно прошёл</Text>
        </View>
      </View>

      <FlatList
        data={pending}
        keyExtractor={(b) => b.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>✅</Text>
            <Text style={s.emptyTitle}>Всё закрыто</Text>
            <Text style={s.emptyText}>Незакрытых ставок нет — статистика актуальна.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const started = startedAt(item);
          const late = started > 0 && started < now;
          return (
            <View>
              <View style={s.timeRow}>
                <Text style={s.timeText}>
                  {item.date.split('-').reverse().slice(0, 2).join('.')} · {item.time || '—'}
                </Text>
                {late && <Text style={s.agoText}>{agoLabel(now - started)}</Text>}
              </View>
              <BetCard bet={item} onEdit={(b) => navigation.navigate('AddBet', { betId: b.id })} />
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', margin: 16, padding: 14,
    backgroundColor: colors.bgCard, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  headerCell: { flex: 1, paddingHorizontal: 4 },
  headerDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: 6 },
  headerLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  headerValue: { fontSize: 17, fontWeight: '800', marginTop: 3 },
  headerSub: { fontSize: 9, color: colors.textMuted, marginTop: 2 },
  list: { paddingBottom: 32 },
  timeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 4, marginTop: 6,
  },
  timeText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  agoText: { fontSize: 11, color: colors.pending, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 19 },
});
