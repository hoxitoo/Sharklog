import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import {
  calcByTournament, calcByTeam, formatMoney, formatPercent,
  SPORTS, ESPORTS_DISCIPLINES, toYmd,
} from '@sharklog/core';
import type { TournamentStats, TeamStats } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { useDrawer } from '../../components/DrawerContext';
import { haptic } from '../../utils/haptics';
import { colors, alpha, mix } from '../../theme/colors';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ProGate } from '../../components/ProGate';
import { YearBreakdown } from './YearBreakdown';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

/** How many rows sit under the two hero cards before the rest is folded away. */
const TOP_N = 3;

/**
 * "Киберспорт" is not an answer — CS2 and Dota are different games with
 * different edges, so the discipline replaces the sport whenever it is known.
 */
function sportLine(sport: string, discipline?: string): string {
  const icon = SPORT_ICONS[sport] ?? '🏅';
  const name = discipline
    ? (ESPORTS_DISCIPLINES[discipline as keyof typeof ESPORTS_DISCIPLINES] ?? discipline)
    : (SPORTS[sport as keyof typeof SPORTS] ?? sport);
  return `${icon} ${name}`;
}

function pnlColor(pnl: number): string {
  return pnl > 0 ? colors.won : pnl < 0 ? colors.lost : colors.textSecondary;
}

// ── Hero: the two extremes, side by side ─────────────────────────────────────

function HeroPair({ best, worst, onOpen }: {
  best: { name: string; sport: string; discipline?: string; pnl: number; roi: number; count: number };
  worst?: { name: string; sport: string; discipline?: string; pnl: number; roi: number; count: number } | undefined;
  onOpen: (name: string) => void;
}) {
  // The label states the rank, the colour states the money. When every
  // tournament is profitable the "worst" one is still a profit, and painting
  // that number red would be a lie about the only thing that matters here.
  const cards = [
    { label: 'Лучший', item: best, accent: pnlColor(best.pnl) },
    ...(worst ? [{ label: 'Худший', item: worst, accent: pnlColor(worst.pnl) }] : []),
  ];
  return (
    <View style={s.heroRow}>
      {cards.map(({ label, item, accent }) => (
        <TouchableOpacity
          key={label}
          style={[s.heroCard, {
            backgroundColor: mix(accent, colors.bgCard, 0.09),
            borderColor: alpha(accent, 0.35),
          }]}
          onPress={() => onOpen(item.name)}
          activeOpacity={0.8}
        >
          <Text style={[s.heroLabel, { color: accent }]}>{label}</Text>
          <Text style={s.heroName} numberOfLines={2}>{item.name}</Text>
          <Text style={s.heroSub} numberOfLines={1}>
            {sportLine(item.sport, item.discipline)} · {item.count} ст.
          </Text>
          <Text style={[s.heroPnl, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit>
            {item.pnl >= 0 ? '+' : ''}{formatMoney(item.pnl)}
          </Text>
          <Text style={[s.heroRoi, { color: accent }]}>{formatPercent(item.roi)} ROI</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Rows ─────────────────────────────────────────────────────────────────────

const TournamentRow = React.memo(function TournamentRow({ t, onPress }: {
  t: TournamentStats;
  onPress: () => void;
}) {
  const color = pnlColor(t.pnl);
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={s.rowName} numberOfLines={1}>{t.tournament}</Text>
        <Text style={s.rowSub} numberOfLines={1}>
          {sportLine(t.sport, t.discipline)} · {t.count} ставок · {t.winRate.toFixed(0)}% WR
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[s.rowPnl, { color }]}>{t.pnl >= 0 ? '+' : ''}{formatMoney(t.pnl)}</Text>
        <Text style={[s.rowRoi, { color }]}>{formatPercent(t.roi)} ROI</Text>
      </View>
      <Text style={s.chevron}>›</Text>
    </TouchableOpacity>
  );
});

const TeamRow = React.memo(function TeamRow({ team, onPress }: {
  team: TeamStats;
  onPress: () => void;
}) {
  const color = pnlColor(team.pnl);
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={s.rowName} numberOfLines={1}>{team.name}</Text>
        <Text style={s.rowSub} numberOfLines={1}>
          {sportLine(team.sport, team.discipline)} · {team.count} ставок · {team.winRate.toFixed(0)}% WR
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[s.rowPnl, { color }]}>{team.pnl >= 0 ? '+' : ''}{formatMoney(team.pnl)}</Text>
        <Text style={[s.rowRoi, { color }]}>{formatPercent(team.roi)} ROI</Text>
      </View>
      <Text style={s.chevron}>›</Text>
    </TouchableOpacity>
  );
});

/** Everything past the top rows, folded away until asked for. */
function MoreToggle({ count, open, onToggle }: {
  count: number; open: boolean; onToggle: () => void;
}) {
  if (count === 0) return null;
  return (
    <TouchableOpacity style={s.moreBtn} onPress={onToggle} activeOpacity={0.8}>
      <Text style={s.moreText}>
        {open ? 'Свернуть' : `Ещё ${count}`}
      </Text>
      <Text style={s.moreChevron}>{open ? '▲' : '▼'}</Text>
    </TouchableOpacity>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export function InsightsScreen() {
  const { bets } = useBetsStore();
  const { goToBets } = useDrawer();
  const [period, setPeriod] = useState<Period>('all');
  const [tOpen, setTOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);

  const cutoff = useMemo(() => {
    if (period === 'all') return null;
    const d = new Date();
    d.setDate(d.getDate() - (period === '7d' ? 7 : 30));
    return toYmd(d);
  }, [period]);

  const filteredBets = useMemo(
    () => (cutoff ? bets.filter((b) => b.date > cutoff) : bets),
    [bets, cutoff],
  );

  // Every tile answers "which bets is this?" — tapping one opens exactly those,
  // period included, so the list length matches the number on the tile.
  function openTournament(tournament: string) {
    haptic.selection();
    goToBets({ tournament, ...(cutoff ? { from: cutoff } : {}) });
  }
  function openTeam(team: string) {
    haptic.selection();
    goToBets({ team, ...(cutoff ? { from: cutoff } : {}) });
  }

  function toggle(setter: (fn: (v: boolean) => boolean) => void) {
    haptic.selection();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setter((v) => !v);
  }

  // calcByTournament already ranks by P&L, so the ends of the list are the
  // extremes. The two shown as hero cards are dropped from the rows below —
  // repeating the best tournament directly under its own card reads as a bug.
  const tourn = useMemo(() => calcByTournament(filteredBets), [filteredBets]);
  const teams = useMemo(
    () => [...calcByTeam(filteredBets, 5)].sort((a, b) => b.pnl - a.pnl),
    [filteredBets],
  );

  function split<T>(list: T[]) {
    const best = list[0];
    // With a single entry there is no "worst" — one thing cannot be both ends.
    const worst = list.length > 1 ? list[list.length - 1] : undefined;
    const middle = list.length > 1 ? list.slice(1, -1) : [];
    return { best, worst, top: middle.slice(0, TOP_N), rest: middle.slice(TOP_N) };
  }

  const t = split(tourn);
  const tm = split(teams);

  return (
    <View style={s.root}>
      <ScreenHeader title="Инсайты" subtitle="Турниры и команды" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.periodRow}>
          {PERIOD_OPTIONS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[s.periodBtn, period === p.key && s.periodBtnActive]}
              onPress={() => { haptic.selection(); setPeriod(p.key); }}
            >
              <Text style={[s.periodLabel, period === p.key && s.periodLabelActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tournaments ── */}
        <Text style={s.sectionTitle}>Турниры и лиги</Text>
        {!t.best ? (
          <View style={s.card}>
            <Text style={s.empty}>Добавляй турнир при записи ставки — здесь появится статистика</Text>
          </View>
        ) : (
          <>
            <HeroPair
              best={{ name: t.best.tournament, sport: t.best.sport, ...(t.best.discipline ? { discipline: t.best.discipline } : {}), pnl: t.best.pnl, roi: t.best.roi, count: t.best.count }}
              worst={t.worst ? { name: t.worst.tournament, sport: t.worst.sport, ...(t.worst.discipline ? { discipline: t.worst.discipline } : {}), pnl: t.worst.pnl, roi: t.worst.roi, count: t.worst.count } : undefined}
              onOpen={openTournament}
            />
            {(t.top.length > 0 || t.rest.length > 0) && (
              <View style={s.card}>
                {t.top.map((item) => (
                  <TournamentRow key={item.tournament} t={item} onPress={() => openTournament(item.tournament)} />
                ))}
                {tOpen && t.rest.map((item) => (
                  <TournamentRow key={item.tournament} t={item} onPress={() => openTournament(item.tournament)} />
                ))}
                <MoreToggle count={t.rest.length} open={tOpen} onToggle={() => toggle(setTOpen)} />
              </View>
            )}
          </>
        )}

        {/* ── Teams — PRO ── */}
        <Text style={s.sectionTitle}>Любимые команды</Text>
        <ProGate feature="Анализ любимых команд (5+ ставок)">
          {!tm.best ? (
            <View style={s.card}>
              <Text style={s.empty}>Нужно минимум 5 ставок на одну команду</Text>
            </View>
          ) : (
            <>
              <HeroPair
                best={{ name: tm.best.name, sport: tm.best.sport, ...(tm.best.discipline ? { discipline: tm.best.discipline } : {}), pnl: tm.best.pnl, roi: tm.best.roi, count: tm.best.count }}
                worst={tm.worst ? { name: tm.worst.name, sport: tm.worst.sport, ...(tm.worst.discipline ? { discipline: tm.worst.discipline } : {}), pnl: tm.worst.pnl, roi: tm.worst.roi, count: tm.worst.count } : undefined}
                onOpen={openTeam}
              />
              {(tm.top.length > 0 || tm.rest.length > 0) && (
                <View style={s.card}>
                  {tm.top.map((item) => (
                    <TeamRow key={item.name} team={item} onPress={() => openTeam(item.name)} />
                  ))}
                  {teamOpen && tm.rest.map((item) => (
                    <TeamRow key={item.name} team={item} onPress={() => openTeam(item.name)} />
                  ))}
                  <MoreToggle count={tm.rest.length} open={teamOpen} onToggle={() => toggle(setTeamOpen)} />
                </View>
              )}
            </>
          )}
        </ProGate>

        {/* ── By year ──
            Fed the whole history on purpose: the year switch is its own time
            control, and intersecting it with the 7/30-day filter above would
            leave most years empty for no reason the user can see. */}
        <YearBreakdown
          bets={bets}
          onOpen={(year, tournament) => {
            haptic.selection();
            goToBets(tournament ? { tournament, year } : { noTournament: true, year });
          }}
        />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 32 },

  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  periodBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  periodBtnActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  periodLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  periodLabelActive: { color: '#fff', fontWeight: '700' },

  sectionTitle: {
    fontSize: 12, color: colors.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.6, fontWeight: '700', marginBottom: 10, marginTop: 6,
  },

  heroRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  heroCard: {
    flex: 1, borderRadius: 16, padding: 14, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  heroLabel: {
    fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6,
  },
  heroName: {
    fontSize: 15, fontWeight: '700', color: colors.textPrimary,
    marginTop: 6, lineHeight: 19, minHeight: 38,
  },
  heroSub: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  heroPnl: { fontSize: 19, fontWeight: '800', marginTop: 8 },
  heroRoi: { fontSize: 11, fontWeight: '600', marginTop: 1 },

  card: {
    backgroundColor: colors.bgCard, borderRadius: 14, padding: 4,
    borderWidth: 1, borderColor: colors.border, marginBottom: 16,
  },
  empty: { fontSize: 13, color: colors.textMuted, lineHeight: 20, padding: 12 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  rowName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  rowSub: { fontSize: 11, color: colors.textMuted },
  rowPnl: { fontSize: 14, fontWeight: '700' },
  rowRoi: { fontSize: 11, fontWeight: '600' },
  chevron: { fontSize: 20, color: colors.textMuted, marginLeft: 6, marginTop: -2 },

  moreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12,
  },
  moreText: { fontSize: 13, fontWeight: '700', color: colors.purpleText },
  moreChevron: { fontSize: 10, color: colors.purpleText },
});
