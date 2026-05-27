import React, { useState, useMemo } from 'react';
import {
  calcByTournament, calcByTeam, formatMoney, formatPercent, SPORTS,
} from '@sharklog/core';
import type { TournamentStats, TeamStats } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';
import { colors } from '../theme/colors';

type Period = '7d' | '30d' | 'all';
const PERIOD_OPTIONS: Array<{ key: Period; label: string }> = [
  { key: '7d', label: '7 дней' },
  { key: '30d', label: '30 дней' },
  { key: 'all', label: 'Всё время' },
];

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

function TournamentsSection({ stats }: { stats: TournamentStats[] }) {
  if (stats.length === 0) {
    return (
      <div style={s.card}>
        <div style={s.cardTitle}>Турниры и лиги</div>
        <div style={s.empty}>
          Начни добавлять турнир при записи ставки — и здесь появится статистика по лигам
        </div>
      </div>
    );
  }

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>Турниры и лиги</div>
      <table style={s.table}>
        <thead>
          <tr>
            {['Турнир', 'Спорт', 'Ставок', 'W%', 'P&L', 'ROI'].map((h) => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map((t) => (
            <tr key={t.tournament} style={s.tr}>
              <td style={{ ...td, fontWeight: 600, color: colors.textPrimary, maxWidth: 200 }}>
                {t.tournament}
              </td>
              <td style={{ ...td, color: colors.textMuted }}>
                {SPORT_ICONS[t.sport] ?? '🏅'} {SPORTS[t.sport as keyof typeof SPORTS] ?? t.sport}
              </td>
              <td style={td}>{t.count}</td>
              <td style={{ ...td, color: t.winRate > 50 ? colors.won : colors.textSecondary }}>
                {t.winRate.toFixed(0)}%
              </td>
              <PnlCell pnl={t.pnl} />
              <td style={{ ...td, color: t.roi >= 0 ? colors.won : colors.lost, fontWeight: 600 }}>
                {formatPercent(t.roi)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeamCard({ team }: { team: TeamStats }) {
  const pnlColor = team.pnl > 0 ? colors.won : team.pnl < 0 ? colors.lost : colors.textSecondary;
  return (
    <div style={s.teamCard}>
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
          <span style={s.teamStatLabel}>ставок</span>
        </div>
        <div style={s.teamStat}>
          <span style={{ ...s.teamStatVal, color: colors.won }}>{team.won}</span>
          <span style={s.teamStatLabel}>побед</span>
        </div>
        <div style={s.teamStat}>
          <span style={{ ...s.teamStatVal, color: colors.lost }}>{team.lost}</span>
          <span style={s.teamStatLabel}>поражений</span>
        </div>
        <div style={s.teamStat}>
          <span style={{ ...s.teamStatVal, color: colors.purple }}>{team.winRate.toFixed(0)}%</span>
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

function TeamsSection({ teams, isPro }: { teams: TeamStats[]; isPro: boolean }) {
  if (!isPro) {
    return (
      <div style={s.card}>
        <div style={s.cardTitle}>Любимые команды</div>
        <div style={s.proGate}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👑</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: colors.gold, marginBottom: 8 }}>PRO</div>
          <div style={{ color: colors.textSecondary, fontSize: 13 }}>
            Анализ по командам (10+ ставок) доступен в подписке SharkLog Pro
          </div>
        </div>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div style={s.card}>
        <div style={s.cardTitle}>Любимые команды</div>
        <div style={s.empty}>Нужно минимум 10 ставок на одну команду</div>
      </div>
    );
  }

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>Любимые команды</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
        {teams.map((team) => <TeamCard key={team.name} team={team} />)}
      </div>
    </div>
  );
}

export function InsightsPage() {
  const { bets, settings } = useBetsStore();
  const [period, setPeriod] = useState<Period>('all');

  const filteredBets = useMemo(() => {
    if (period === 'all') return bets;
    const days = period === '7d' ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0] ?? '';
    return bets.filter((b) => b.date > cutoffStr);
  }, [bets, period]);

  const tournaments = useMemo(() => calcByTournament(filteredBets), [filteredBets]);
  const teams = useMemo(() => calcByTeam(filteredBets, 10), [filteredBets]);

  return (
    <div style={s.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={s.title}>Инсайты</h1>
          <p style={s.subtitle}>Турниры и любимые команды</p>
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

      <TournamentsSection stats={tournaments} />
      <TeamsSection teams={teams} isPro={settings.isPro} />
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
