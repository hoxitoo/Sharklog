import React, { useState, useMemo } from 'react';
import {
  calcByTournament, calcByTeam, formatMoney, formatPercent, SPORTS, toYmd } from '@sharklog/core';
import type { TournamentStats, TeamStats } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';
import { colors } from '../theme/colors';
import type { BetsFilter } from '../types/betsFilter';
import { useTranslation } from 'react-i18next';

type Period = '7d' | '30d' | 'all';

const SPORT_ICONS: Record<string, string> = {
  football: '⚽', hockey: '🏒', basketball: '🏀', tennis: '🎾',
  esports: '🎮', volleyball: '🏐', baseball: '⚾', other: '🏅',
};

function PnlCell({ pnl }: { pnl: number }) {
  const color = pnl > 0 ? colors.won : pnl < 0 ? colors.lost : colors.textSecondary;
  return (
    <td style={{ ...td, color, fontWeight: 700 }}>
      {pnl >= 0 ? '+' : ''}{formatMoney(pnl)}
    </td>
  );
}

function TournamentsSection({ stats, onOpen }: {
  stats: TournamentStats[];
  onOpen: (tournament: string) => void;
}) {
  const { t } = useTranslation();

  if (stats.length === 0) {
    return (
      <div style={s.card}>
        <div style={s.cardTitle}>{t('insights.tournamentsAndLeagues')}</div>
        <div style={s.empty}>{t('insights.tournamentsEmpty')}</div>
      </div>
    );
  }

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>{t('insights.tournamentsAndLeagues')}</div>
      <table style={s.table}>
        <thead>
          <tr>
            {[t('bet.tournament'), t('bet.sport'), t('analytics.count'), 'W%', 'P&L', 'ROI'].map((h) => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map((tourney) => (
            <tr
              key={tourney.tournament}
              style={{ ...s.tr, cursor: 'pointer' }}
              onClick={() => onOpen(tourney.tournament)}
              title={t('insights.openBets')}
            >
              <td style={{ ...td, fontWeight: 600, color: colors.textPrimary, maxWidth: 200 }}>
                {tourney.tournament}
              </td>
              <td style={{ ...td, color: colors.textMuted }}>
                {SPORT_ICONS[tourney.sport] ?? '🏅'} {SPORTS[tourney.sport as keyof typeof SPORTS] ?? tourney.sport}
              </td>
              <td style={td}>{tourney.count}</td>
              <td style={{ ...td, color: tourney.winRate > 50 ? colors.won : colors.textSecondary }}>
                {tourney.winRate.toFixed(0)}%
              </td>
              <PnlCell pnl={tourney.pnl} />
              <td style={{ ...td, color: tourney.roi >= 0 ? colors.won : colors.lost, fontWeight: 600 }}>
                {formatPercent(tourney.roi)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeamCard({ team, onOpen }: { team: TeamStats; onOpen: () => void }) {
  const { t } = useTranslation();
  const pnlColor = team.pnl > 0 ? colors.won : team.pnl < 0 ? colors.lost : colors.textSecondary;
  return (
    <div style={{ ...s.teamCard, cursor: 'pointer' }} onClick={onOpen} title={t('insights.openBets')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={s.teamName}>{team.name}</div>
          <div style={s.teamSub}>
            {SPORT_ICONS[team.sport] ?? '🏅'} {SPORTS[team.sport as keyof typeof SPORTS] ?? team.sport}
            {team.lastTournament ? <span style={{ color: colors.textMuted }}> · {team.lastTournament}</span> : null}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: pnlColor }}>
            {team.pnl >= 0 ? '+' : ''}{formatMoney(team.pnl)}
          </div>
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>P&L</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={s.teamStat}>
          <span style={s.teamStatVal}>{team.count}</span>
          <span style={s.teamStatLabel}>{t('common.bets')}</span>
        </div>
        <div style={s.teamStat}>
          <span style={{ ...s.teamStatVal, color: colors.won }}>{team.won}</span>
          <span style={s.teamStatLabel}>{t('dashboard.wins')}</span>
        </div>
        <div style={s.teamStat}>
          <span style={{ ...s.teamStatVal, color: colors.lost }}>{team.lost}</span>
          <span style={s.teamStatLabel}>{t('dashboard.losses')}</span>
        </div>
        <div style={s.teamStat}>
          <span style={{ ...s.teamStatVal, color: colors.purpleText }}>{team.winRate.toFixed(0)}%</span>
          <span style={s.teamStatLabel}>WR</span>
        </div>
        <div style={s.teamStat}>
          <span style={{ ...s.teamStatVal, color: team.roi >= 0 ? colors.won : colors.lost }}>{formatPercent(team.roi)}</span>
          <span style={s.teamStatLabel}>ROI</span>
        </div>
      </div>
    </div>
  );
}

function TeamsSection({ teams, isPro, onOpen }: {
  teams: TeamStats[];
  isPro: boolean;
  onOpen: (team: string) => void;
}) {
  const { t } = useTranslation();

  if (!isPro) {
    return (
      <div style={s.card}>
        <div style={s.cardTitle}>{t('insights.teams')}</div>
        <div style={s.proGate}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👑</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: colors.gold, marginBottom: 8 }}>PRO</div>
          <div style={{ color: colors.textSecondary, fontSize: 13 }}>
            {t('insights.teamsProMsg')}
          </div>
        </div>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div style={s.card}>
        <div style={s.cardTitle}>{t('insights.teams')}</div>
        <div style={s.empty}>{t('insights.noTeams')}</div>
      </div>
    );
  }

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>{t('insights.teams')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
        {teams.map((team) => <TeamCard key={team.name} team={team} onOpen={() => onOpen(team.name)} />)}
      </div>
    </div>
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
  const teams = useMemo(() => calcByTeam(filteredBets, 10), [filteredBets]);

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
    </div>
  );
}

const th: React.CSSProperties = {
  fontSize: 11, color: colors.textMuted, textTransform: 'uppercase',
  letterSpacing: 0.5, padding: '0 12px 8px 0', textAlign: 'left', fontWeight: 600,
};
const td: React.CSSProperties = {
  padding: '9px 12px 9px 0', fontSize: 13, color: colors.textSecondary,
};

const s: Record<string, React.CSSProperties> = {
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
  cardTitle: { fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse' },
  tr: { borderTop: `1px solid ${colors.border}` },
  empty: { color: colors.textMuted, fontSize: 13, padding: '20px 0' },
  proGate: { textAlign: 'center' as const, padding: '32px 0' },
  teamCard: {
    backgroundColor: colors.bgElevated, borderRadius: 12, padding: 16,
    border: `1px solid ${colors.border}`,
  },
  teamName: { fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 3 },
  teamSub: { fontSize: 12, color: colors.textSecondary },
  teamStat: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center' },
  teamStatVal: { fontSize: 16, fontWeight: 700, color: colors.textPrimary },
  teamStatLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
};
