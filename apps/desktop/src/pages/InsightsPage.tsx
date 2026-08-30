import React, { useState, useMemo } from 'react';
import {
  calcByTournament, calcByTeam, calcBetYears, betsInYear, formatMoney, formatPercent,
  SPORTS, ESPORTS_DISCIPLINES, toYmd } from '@sharklog/core';
import type { TournamentStats, TeamStats, Bet } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';
import { colors, alpha, mix } from '../theme/colors';
import type { BetsFilter } from '../types/betsFilter';
import { useTranslation } from 'react-i18next';

type Period = '7d' | '30d' | 'all';

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
  // "Другая дисциплина" names nothing and is Russian in every locale, so the
  // sport is the better answer there.
  const named = discipline && discipline !== 'other_esports'
    ? ESPORTS_DISCIPLINES[discipline as keyof typeof ESPORTS_DISCIPLINES]
    : undefined;
  const name = named ?? SPORTS[sport as keyof typeof SPORTS] ?? sport;
  return `${icon} ${name}`;
}

function pnlColor(pnl: number): string {
  return pnl > 0 ? colors.won : pnl < 0 ? colors.lost : colors.textSecondary;
}

interface HeroItem {
  name: string; sport: string; discipline?: string | undefined;
  pnl: number; roi: number; count: number;
}

/** The two extremes, side by side — the first thing worth knowing. */
function HeroPair({ best, worst, onOpen }: {
  best: HeroItem; worst?: HeroItem | undefined; onOpen: (name: string) => void;
}) {
  const { t } = useTranslation();
  // The label states the rank, the colour states the money. When every
  // tournament is profitable the "worst" one is still a profit, and painting
  // that number red would be a lie about the only thing that matters here.
  const cards = [
    { label: t('insights.best'), item: best, accent: pnlColor(best.pnl) },
    ...(worst ? [{ label: t('insights.worst'), item: worst, accent: pnlColor(worst.pnl) }] : []),
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cards.length}, 1fr)`, gap: 12, marginBottom: 12 }}>
      {cards.map(({ label, item, accent }) => (
        <div
          key={label}
          style={{
            borderRadius: 16, padding: 16, cursor: 'pointer',
            background: mix(accent, colors.bgCard, 0.09),
            border: `1px solid ${alpha(accent, 0.35)}`,
          }}
          onClick={() => onOpen(item.name)}
          title={t('insights.openBets')}
        >
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: accent }}>
            {label}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: colors.textPrimary, marginTop: 6 }}>{item.name}</div>
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
            {sportLine(item.sport, item.discipline)} · {item.count}
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'DM Mono', monospace", color: accent, marginTop: 10 }}>
            {item.pnl >= 0 ? '+' : ''}{formatMoney(item.pnl)}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: accent }}>{formatPercent(item.roi)} ROI</div>
        </div>
      ))}
    </div>
  );
}

/** Everything past the top rows, folded away until asked for. */
function MoreToggle({ count, open, onToggle }: {
  count: number; open: boolean; onToggle: () => void;
}) {
  const { t } = useTranslation();
  if (count === 0) return null;
  return (
    <button
      style={{
        width: '100%', padding: '10px 0', marginTop: 4, cursor: 'pointer',
        background: 'none', border: 'none', color: colors.purpleText,
        fontSize: 13, fontWeight: 700,
      }}
      onClick={onToggle}
    >
      {open ? t('insights.collapse') : t('insights.showMore', { count })} {open ? '▲' : '▼'}
    </button>
  );
}

/** Splits a P&L-ranked list into the two extremes, the next few, and the tail. */
function split<T>(list: T[]) {
  const best = list[0];
  // With a single entry there is no "worst" — one thing cannot be both ends.
  const worst = list.length > 1 ? list[list.length - 1] : undefined;
  const middle = list.length > 1 ? list.slice(1, -1) : [];
  return { best, worst, top: middle.slice(0, TOP_N), rest: middle.slice(TOP_N) };
}

/** One P&L-ranked row, shared by both sections. */
function StatRow({ name, sport, discipline, count, winRate, pnl, roi, onOpen }: {
  name: string; sport: string; discipline?: string | undefined;
  count: number; winRate: number; pnl: number; roi: number; onOpen: () => void;
}) {
  const { t } = useTranslation();
  const color = pnlColor(pnl);
  return (
    <div style={s.statRow} onClick={onOpen} title={t('insights.openBets')}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={s.statRowName}>{name}</div>
        <div style={s.statRowSub}>
          {sportLine(sport, discipline)} · {count} {t('analytics.countSuffix')} · {winRate.toFixed(0)}% WR
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color }}>{pnl >= 0 ? '+' : ''}{formatMoney(pnl)}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color }}>{formatPercent(roi)} ROI</div>
      </div>
      <span style={{ color: colors.textMuted, fontSize: 18, marginLeft: 10 }}>›</span>
    </div>
  );
}

function TournamentsSection({ stats, onOpen }: {
  stats: TournamentStats[];
  onOpen: (tournament: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { best, worst, top, rest } = split(stats);

  if (!best) {
    return (
      <>
        <div style={s.sectionTitle}>{t('insights.tournamentsAndLeagues')}</div>
        <div style={s.card}><div style={s.empty}>{t('insights.tournamentsEmpty')}</div></div>
      </>
    );
  }

  const hero = (x: TournamentStats): HeroItem => ({
    name: x.tournament, sport: x.sport, discipline: x.discipline,
    pnl: x.pnl, roi: x.roi, count: x.count,
  });

  return (
    <>
      <div style={s.sectionTitle}>{t('insights.tournamentsAndLeagues')}</div>
      <HeroPair best={hero(best)} worst={worst ? hero(worst) : undefined} onOpen={onOpen} />
      {(top.length > 0 || rest.length > 0) && (
        <div style={s.listCard}>
          {[...top, ...(open ? rest : [])].map((x) => (
            <StatRow
              key={x.tournament}
              name={x.tournament} sport={x.sport} discipline={x.discipline}
              count={x.count} winRate={x.winRate} pnl={x.pnl} roi={x.roi}
              onOpen={() => onOpen(x.tournament)}
            />
          ))}
          <MoreToggle count={rest.length} open={open} onToggle={() => setOpen((v) => !v)} />
        </div>
      )}
    </>
  );
}

function TeamsSection({ teams, isPro, onOpen }: {
  teams: TeamStats[];
  isPro: boolean;
  onOpen: (team: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { best, worst, top, rest } = split(teams);

  if (!isPro) {
    return (
      <>
        <div style={s.sectionTitle}>{t('insights.teams')}</div>
        <div style={s.card}>
          <div style={s.proGate}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👑</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: colors.gold, marginBottom: 8 }}>PRO</div>
            <div style={{ color: colors.textSecondary, fontSize: 13 }}>{t('insights.teamsProMsg')}</div>
          </div>
        </div>
      </>
    );
  }

  if (!best) {
    return (
      <>
        <div style={s.sectionTitle}>{t('insights.teams')}</div>
        <div style={s.card}><div style={s.empty}>{t('insights.noTeams')}</div></div>
      </>
    );
  }

  const hero = (x: TeamStats): HeroItem => ({
    name: x.name, sport: x.sport, discipline: x.discipline,
    pnl: x.pnl, roi: x.roi, count: x.count,
  });

  return (
    <>
      <div style={s.sectionTitle}>{t('insights.teams')}</div>
      <HeroPair best={hero(best)} worst={worst ? hero(worst) : undefined} onOpen={onOpen} />
      {(top.length > 0 || rest.length > 0) && (
        <div style={s.listCard}>
          {[...top, ...(open ? rest : [])].map((x) => (
            <StatRow
              key={x.name}
              name={x.name} sport={x.sport} discipline={x.discipline}
              count={x.count} winRate={x.winRate} pnl={x.pnl} roi={x.roi}
              onOpen={() => onOpen(x.name)}
            />
          ))}
          <MoreToggle count={rest.length} open={open} onToggle={() => setOpen((v) => !v)} />
        </div>
      )}
    </>
  );
}

/** Bars past this many are folded away — a long season has a long tail. */
const VISIBLE = 8;

/**
 * P&L per tournament for one calendar year, as a diverging bar chart.
 *
 * Bars grow from a centre line: profits right, losses left, on one shared
 * scale. Tournament names are long, so the bars run horizontally — vertical
 * columns would leave no room to write which tournament each one is.
 *
 * The year switch is built from the data plus the current year, so a new year
 * appears by itself when the calendar turns.
 */
function YearBreakdown({ bets, onOpen }: {
  bets: Bet[];
  onOpen: (year: number, tournament: string) => void;
}) {
  const { t } = useTranslation();
  const years = useMemo(() => calcBetYears(bets), [bets]);
  // The switch always offers the current year, but starting on it in January
  // would show an empty chart with the whole history one chip away.
  const defaultYear = useMemo(
    () => years.find((yr) => bets.some((b) => b.date.startsWith(String(yr)))) ?? years[0]!,
    [years, bets],
  );
  const [year, setYear] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const active = year != null && years.includes(year) ? year : defaultYear;
  const rows = useMemo(
    () => calcByTournament(betsInYear(bets, active), { includeUntagged: true }),
    [bets, active],
  );

  const total = rows.reduce((sum, r) => sum + r.pnl, 0);
  const count = rows.reduce((sum, r) => sum + r.count, 0);
  // One shared scale, so a bar twice as long really is twice the money.
  const peak = Math.max(...rows.map((r) => Math.abs(r.pnl)), 1);
  const shown = expanded ? rows : rows.slice(0, VISIBLE);

  return (
    <>
      <div style={s.sectionTitle}>{t('insights.byYear')}</div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {years.map((yr) => (
          <button
            key={yr}
            style={{ ...s.periodBtn, ...(yr === active ? s.periodBtnActive : {}) }}
            onClick={() => { setYear(yr); setExpanded(false); }}
          >
            {yr}
          </button>
        ))}
      </div>

      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>
            {t('insights.yearTotal')} {active}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'DM Mono', monospace", color: pnlColor(total) }}>
            {total > 0 ? '+' : ''}{formatMoney(total)}
          </div>
        </div>
        <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
          {count === 0 ? t('insights.yearEmpty') : t('insights.betsCount', { count })}
        </div>

        {rows.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {shown.map((r) => {
              const accent = pnlColor(r.pnl);
              const share = (Math.abs(r.pnl) / peak) * 50;
              const width = `${Math.max(share, r.pnl === 0 ? 0 : 1)}%`;
              return (
                <div
                  key={r.tournament || '__none__'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onOpen(active, r.tournament)}
                  title={t('insights.openBets')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                    <span style={{
                      fontSize: 13, fontWeight: 600,
                      color: r.tournament ? colors.textPrimary : colors.textMuted,
                      fontStyle: r.tournament ? 'normal' : 'italic',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.tournament || t('insights.noTournament')}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: accent, whiteSpace: 'nowrap', marginLeft: 12 }}>
                      {r.pnl > 0 ? '+' : ''}{formatMoney(r.pnl)}
                    </span>
                  </div>
                  <div style={{
                    position: 'relative', height: 10, borderRadius: 5,
                    background: colors.bgSunken, border: `1px solid ${colors.border}`,
                  }}>
                    <div style={{
                      position: 'absolute', left: '50%', top: 0, bottom: 0,
                      width: 1, background: alpha(colors.borderHover, 0.9),
                    }} />
                    <div style={{
                      position: 'absolute', top: 1, bottom: 1, borderRadius: 4,
                      background: accent, width,
                      ...(r.pnl >= 0 ? { left: '50%' } : { right: '50%' }),
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {rows.length > VISIBLE && (
          <MoreToggle
            count={rows.length - VISIBLE}
            open={expanded}
            onToggle={() => setExpanded((v) => !v)}
          />
        )}
      </div>
    </>
  );
}

export function InsightsPage({ onOpenBets }: { onOpenBets: (filter: BetsFilter) => void }) {
  const { bets, settings } = useBetsStore();
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>('all');

  const PERIOD_OPTIONS: Array<{ key: Period; label: string }> = [
    { key: '7d', label: t('dashboard.week') },
    { key: '30d', label: t('dashboard.month') },
    { key: 'all', label: t('dashboard.allTime') },
  ];

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

  // Every tile answers "which bets is this?" — clicking one opens exactly those,
  // period included, so the list length matches the number on the tile.
  const openBets = (f: BetsFilter) => onOpenBets({ ...f, ...(cutoff ? { from: cutoff } : {}) });

  const tournaments = useMemo(() => calcByTournament(filteredBets), [filteredBets]);
  const teams = useMemo(
    () => [...calcByTeam(filteredBets, 10)].sort((a, b) => b.pnl - a.pnl),
    [filteredBets],
  );

  return (
    <div style={s.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={s.title}>{t('insights.title')}</h1>
          <p style={s.subtitle}>{t('insights.tournamentsAndLeagues')} · {t('insights.teams')}</p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p.key}
              style={{ ...s.periodBtn, ...(period === p.key ? s.periodBtnActive : {}) }}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <TournamentsSection stats={tournaments} onOpen={(tournament) => openBets({ tournament })} />
      <TeamsSection teams={teams} isPro={settings.isPro} onOpen={(team) => openBets({ team })} />

      {/* Fed the whole history on purpose: the year switch is its own time
          control, and intersecting it with the period filter above would leave
          most years empty for no reason the user can see. */}
      <YearBreakdown
        bets={bets}
        onOpen={(year, tournament) =>
          onOpenBets(tournament ? { tournament, year } : { noTournament: true, year })}
      />
    </div>
  );
}

const rowStyles = {
  statRow: {
    display: 'flex', alignItems: 'center', cursor: 'pointer',
    padding: '11px 14px', borderBottom: `1px solid ${colors.border}`,
  } as React.CSSProperties,
  statRowName: {
    fontSize: 14, fontWeight: 600, color: colors.textPrimary,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  } as React.CSSProperties,
  statRowSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 } as React.CSSProperties,
  sectionTitle: {
    fontSize: 12, color: colors.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.6, fontWeight: 700, marginBottom: 10, marginTop: 6,
  } as React.CSSProperties,
};

const s: Record<string, React.CSSProperties> = {
  ...rowStyles,
  page: { padding: '28px 32px', flex: 1, overflow: 'auto' },
  title: { fontSize: 28, fontWeight: 700, color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.textSecondary },
  periodBtn: {
    padding: '6px 14px', borderRadius: 8, border: `1px solid ${colors.border}`,
    backgroundColor: colors.bgCard, color: colors.textSecondary, fontSize: 13, cursor: 'pointer',
  },
  periodBtnActive: {
    backgroundColor: colors.purple, borderColor: colors.purple, color: '#fff', fontWeight: 700,
  },
  card: {
    backgroundColor: colors.bgCard, borderRadius: 14, padding: 20,
    border: `1px solid ${colors.border}`, marginBottom: 20,
  },
  /** Same shell, but the rows inside bring their own padding. */
  listCard: {
    backgroundColor: colors.bgCard, borderRadius: 14, padding: 4,
    border: `1px solid ${colors.border}`, marginBottom: 20,
  },
  cardTitle: { fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse' },
  tr: { borderTop: `1px solid ${colors.border}` },
  empty: { color: colors.textMuted, fontSize: 13, padding: '20px 0' },
  proGate: { textAlign: 'center' as const, padding: '32px 0' },
};
