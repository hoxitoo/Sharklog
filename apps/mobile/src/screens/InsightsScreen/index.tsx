import React, { useState, useMemo } from 'react';
import { SPACE, RADIUS, TOUCH } from '../../theme/layout';
import { cardSurface } from '../../components/Card';
import {
  View, ScrollView, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { AppText as Text } from '../../components/AppText';
import {
  calcByTournament, calcByTeam, formatPercent, toYmd,
} from '@sharklog/core';
import type { EsportsDiscipline } from '@sharklog/core';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { disciplineLabel } from '../../utils/labels';
import type { TournamentStats, TeamStats } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { useDrawer } from '../../components/DrawerContext';
import { haptic } from '../../utils/haptics';
import { colors, alpha, mix } from '../../theme/colors';
import { numeric, SIZE, GLYPH } from '../../theme/typography';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ProGate } from '../../components/ProGate';
import { useFormatMoney } from '../../utils/useFormatMoney';
import { YearBreakdown } from './YearBreakdown';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Period = '7d' | '30d' | 'all';
const PERIOD_OPTIONS: Array<{ key: Period; label: string }> = [
  { key: '7d', label: 'insights.period7d' },
  { key: '30d', label: 'insights.period30d' },
  { key: 'all', label: 'insights.periodAll' },
];

/** Bets a team needs before it is analysed — shown to the user, so one source. */
const TEAM_MIN_BETS = 5;

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
function sportLine(tr: TFunction, sport: string, discipline?: string): string {
  const icon = SPORT_ICONS[sport] ?? '🏅';
  // "Other game" names nothing, so the sport is the better answer there.
  const named = discipline && discipline !== 'other_esports'
    ? disciplineLabel(tr, discipline as EsportsDiscipline)
    : undefined;
  const name = named ?? tr(`sports.${sport}`, { defaultValue: sport });
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
  const fmt = useFormatMoney();
  const { t } = useTranslation();
  // The label states the rank, the colour states the money. When every
  // tournament is profitable the "worst" one is still a profit, and painting
  // that number red would be a lie about the only thing that matters here.
  const cards = [
    { label: t('insights.best'), item: best, accent: pnlColor(best.pnl) },
    ...(worst ? [{ label: t('insights.worst'), item: worst, accent: pnlColor(worst.pnl) }] : []),
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
            {sportLine(t, item.sport, item.discipline)} · {t('common.betsShort', { count: item.count })}
          </Text>
          <Text style={[s.heroPnl, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit>
            {item.pnl >= 0 ? '+' : ''}{fmt(item.pnl)}
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
  const fmt = useFormatMoney();
  // `tr`: the tournament row's own prop is already called `t`.
  const { t: tr } = useTranslation();
  const color = pnlColor(t.pnl);
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <View style={{ flex: 1, marginRight: SPACE.sm }}>
        <Text style={s.rowName} numberOfLines={1}>{t.tournament}</Text>
        <Text style={s.rowSub} numberOfLines={1}>
          {sportLine(tr, t.sport, t.discipline)} · {tr('common.betsCount', { count: t.count })} · {t.winRate.toFixed(0)}% WR
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[s.rowPnl, { color }]}>{t.pnl >= 0 ? '+' : ''}{fmt(t.pnl)}</Text>
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
  const fmt = useFormatMoney();
  const { t } = useTranslation();
  const color = pnlColor(team.pnl);
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <View style={{ flex: 1, marginRight: SPACE.sm }}>
        <Text style={s.rowName} numberOfLines={1}>{team.name}</Text>
        <Text style={s.rowSub} numberOfLines={1}>
          {sportLine(t, team.sport, team.discipline)} · {t('common.betsCount', { count: team.count })} · {team.winRate.toFixed(0)}% WR
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[s.rowPnl, { color }]}>{team.pnl >= 0 ? '+' : ''}{fmt(team.pnl)}</Text>
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
  const { t } = useTranslation();
  if (count === 0) return null;
  return (
    <TouchableOpacity style={s.moreBtn} onPress={onToggle} activeOpacity={0.8}>
      <Text style={s.moreText}>
        {open ? t('common.collapse') : t('common.showMore', { count })}
      </Text>
      <Text style={s.moreChevron}>{open ? '▲' : '▼'}</Text>
    </TouchableOpacity>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export function InsightsScreen() {
  const bets = useBetsStore((s) => s.bets);
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
    () => [...calcByTeam(filteredBets, TEAM_MIN_BETS)].sort((a, b) => b.pnl - a.pnl),
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
  // `tr`: `t` above is the tournament split.
  const { t: tr } = useTranslation();

  return (
    <View style={s.root}>
      <ScreenHeader title={tr('nav.insights')} subtitle={tr('insights.subtitle')} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.periodRow}>
          {PERIOD_OPTIONS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[s.periodBtn, period === p.key && s.periodBtnActive]}
              onPress={() => { haptic.selection(); setPeriod(p.key); }}
            >
              <Text style={[s.periodLabel, period === p.key && s.periodLabelActive]}>{tr(p.label)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tournaments ── */}
        <Text style={s.sectionTitle}>{tr('insights.tournamentsAndLeagues')}</Text>
        {!t.best ? (
          <View style={s.card}>
            <Text style={s.empty}>{tr('insights.tournamentsEmpty')}</Text>
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
        <Text style={s.sectionTitle}>{tr('insights.teams')}</Text>
        <ProGate feature={tr('insights.teamsFeature', { count: TEAM_MIN_BETS })}>
          {!tm.best ? (
            <View style={s.card}>
              <Text style={s.empty}>{tr('insights.teamsMin', { count: TEAM_MIN_BETS })}</Text>
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
  scroll: { padding: SPACE.lg, paddingBottom: SPACE.xxl },

  periodRow: { flexDirection: 'row', gap: SPACE.sm, marginBottom: SPACE.lg },
  periodBtn: {
    minHeight: TOUCH, justifyContent: 'center',
    flex: 1, paddingVertical: SPACE.sm, borderRadius: RADIUS.sm,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  periodBtnActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  periodLabel: { fontSize: SIZE.body, color: colors.textSecondary, fontWeight: '500' },
  periodLabelActive: { color: '#fff', fontWeight: '700' },

  sectionTitle: {
    fontSize: SIZE.caption, color: colors.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.6, fontWeight: '700', marginBottom: SPACE.sm, marginTop: SPACE.xs,
  },

  heroRow: { flexDirection: 'row', gap: SPACE.sm, marginBottom: SPACE.md },
  heroCard: {
    ...cardSurface,
    // Two of these share a row, so they keep the tighter padding — 16 each side
    // of a half-width card eats the number it exists to show.
    flex: 1, padding: SPACE.md,
  },
  heroLabel: {
    fontSize: SIZE.micro, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6,
  },
  heroName: {
    fontSize: SIZE.lead, fontWeight: '700', color: colors.textPrimary,
    marginTop: SPACE.xs, lineHeight: 20, minHeight: 40,
  },
  heroSub: { fontSize: SIZE.micro, color: colors.textMuted, marginTop: 2 },
  heroPnl: { ...numeric, fontSize: SIZE.title, fontWeight: '800', marginTop: SPACE.sm },
  heroRoi: { ...numeric, fontSize: SIZE.caption, fontWeight: '600', marginTop: 1 },

  card: {
    backgroundColor: colors.bgCard, borderRadius: RADIUS.md, padding: SPACE.xs,
    borderWidth: 1, borderColor: colors.border, marginBottom: SPACE.lg,
  },
  empty: { fontSize: SIZE.body, color: colors.textMuted, lineHeight: 22, padding: SPACE.md },

  row: {
    minHeight: TOUCH,
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACE.md, paddingHorizontal: SPACE.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  rowName: { fontSize: SIZE.body, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  rowSub: { fontSize: SIZE.caption, color: colors.textMuted },
  rowPnl: { ...numeric, fontSize: SIZE.body, fontWeight: '700' },
  rowRoi: { ...numeric, fontSize: SIZE.caption, fontWeight: '600' },
  chevron: { fontSize: GLYPH.lg, color: colors.textMuted, marginLeft: SPACE.xs, marginTop: -2 },

  moreBtn: {
    minHeight: TOUCH,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs,
    paddingVertical: SPACE.md,
  },
  moreText: { fontSize: SIZE.body, fontWeight: '700', color: colors.purpleText },
  moreChevron: { fontSize: GLYPH.sm, color: colors.purpleText },
});
