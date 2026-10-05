import React, { useEffect, useMemo, useState } from 'react';
import { SPACE } from '../../theme/layout';
import { cardSurface } from '../../components/Card';
import { View, StyleSheet, FlatList } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import type { Bet } from '@sharklog/core';
import { useFormatMoney } from '../../utils/useFormatMoney';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useBetsStore } from '../../store/betsStore';
import { colors, toneSurface } from '../../theme/colors';
import { BetCard } from '../BetsScreen/BetCard';
import { useBetActions } from '../../components/useBetActions';
import { SIZE, GLYPH } from '../../theme/typography';

/** Kick-off timestamp, parsed as LOCAL time (a bare date string would read as UTC). */
function startedAt(bet: Bet): number {
  // Same default as the reminder scheduler ('12:00'), otherwise a bet with no time
  // is flagged "матч давно прошёл" from 03:00 while its reminder assumed midday.
  const t = new Date(`${bet.date}T${(bet.time || '12:00')}:00`).getTime();
  return isNaN(t) ? 0 : t;
}

function agoLabel(ms: number, t: TFunction): string {
  if (ms <= 0) return '';
  const h = Math.floor(ms / 3_600_000);
  if (h >= 24) return t('pending.agoDays', { count: Math.floor(h / 24) });
  if (h >= 1) return t('pending.agoHours', { count: h });
  return t('pending.agoMinutes', { count: Math.max(1, Math.floor(ms / 60_000)) });
}

export function PendingScreen() {
  // Same wheel as the bets list — one menu, one set of wedge positions.
  const betActions = useBetActions();
  const bets = useBetsStore((s) => s.bets);
  const { t } = useTranslation();
  // Through the hook, not formatMoney — it honours «Округлять суммы».
  const fmt = useFormatMoney();

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
          <Text style={s.headerLabel}>{t('bet.inPlay')}</Text>
          <Text style={[s.headerValue, { color: colors.pending }]} numberOfLines={1} adjustsFontSizeToFit>
            {fmt(exposure)}
          </Text>
          <Text style={s.headerSub}>{t('common.betsCount', { count: pending.length })}</Text>
        </View>
        <View style={s.headerDivider} />
        <View style={s.headerCell}>
          <Text style={s.headerLabel}>{t('pending.ifWon')}</Text>
          <Text style={[s.headerValue, { color: colors.won }]} numberOfLines={1} adjustsFontSizeToFit>
            {fmt(potential)}
          </Text>
          <Text style={s.headerSub}>{t('pending.ifWonSub')}</Text>
        </View>
        <View style={s.headerDivider} />
        <View style={s.headerCell}>
          <Text style={s.headerLabel}>{t('pending.overdue')}</Text>
          <Text style={[s.headerValue, { color: overdue > 0 ? colors.lost : colors.textMuted }]}>
            {overdue > 0 ? String(overdue) : '—'}
          </Text>
          <Text style={s.headerSub}>{t('pending.overdueSub')}</Text>
        </View>
      </View>

      <FlatList
        data={pending}
        keyExtractor={(b) => b.id}
        keyboardShouldPersistTaps="handled"
        windowSize={9}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>✅</Text>
            <Text style={s.emptyTitle}>{t('pending.emptyTitle')}</Text>
            <Text style={s.emptyText}>{t('pending.emptyText')}</Text>
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
                {late && <Text style={s.agoText}>{agoLabel(now - started, t)}</Text>}
              </View>
              <BetCard
                bet={item}
                onPress={betActions.open}
                cashoutOpen={betActions.cashoutFor === item.id}
                onRequestCashout={() => betActions.openCashout(item.id)}
                onCloseCashout={betActions.closeCashout}
              />
            </View>
          );
        }}
      />

      {betActions.element}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    ...cardSurface, ...toneSurface('warn'),
    flexDirection: 'row', margin: SPACE.lg, padding: SPACE.lg,
  },
  headerCell: { flex: 1, paddingHorizontal: SPACE.xs },
  headerDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: SPACE.xs },
  headerLabel: { fontSize: SIZE.micro, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  headerValue: { fontSize: SIZE.lead, fontWeight: '800', marginTop: 3 },
  headerSub: { fontSize: SIZE.micro, color: colors.textMuted, marginTop: 2 },
  list: { paddingBottom: SPACE.xxl },
  timeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACE.lg, marginBottom: SPACE.xs, marginTop: SPACE.xs,
  },
  timeText: { fontSize: SIZE.caption, color: colors.textMuted, fontWeight: '600' },
  agoText: { fontSize: SIZE.caption, color: colors.pending, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: SPACE.xxl },
  emptyIcon: { fontSize: GLYPH.xxl, marginBottom: SPACE.md },
  emptyTitle: { fontSize: SIZE.lead, fontWeight: '700', color: colors.textPrimary },
  emptyText: { fontSize: SIZE.body, color: colors.textMuted, textAlign: 'center', marginTop: SPACE.xs, lineHeight: 20 },
});
