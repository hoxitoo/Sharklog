import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { calcDashboard, formatMoney, formatPercent, isInTilt } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';
import { colors } from '../theme/colors';

function StatCard({
  label, value, sub, color,
}: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={s.statCard}>
      <div style={s.statLabel}>{label}</div>
      <div style={{ ...s.statValue, color: color ?? colors.textPrimary }}>{value}</div>
      {sub && <div style={s.statSub}>{sub}</div>}
    </div>
  );
}

function WLStrip({ bets }: { bets: ReturnType<typeof useBetsStore>['bets'] }) {
  const settled = bets.filter((b) => b.status !== 'pending').slice(0, 10);
  if (settled.length === 0) return null;
  return (
    <div style={s.wlRow}>
      {settled.map((b, i) => (
        <div
          key={b.id + i}
          title={`${b.event} — ${b.status}`}
          style={{
            ...s.wlSquare,
            backgroundColor:
              b.status === 'won' ? colors.won + '28' :
              b.status === 'lost' ? colors.lost + '28' : colors.refund + '28',
            borderColor:
              b.status === 'won' ? colors.won + '66' :
              b.status === 'lost' ? colors.lost + '66' : colors.refund + '66',
            color: b.status === 'won' ? colors.won : b.status === 'lost' ? colors.lost : colors.refund,
          }}
        >
          {b.status === 'won' ? 'W' : b.status === 'lost' ? 'L' : 'R'}
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { bets, settings, bankroll } = useBetsStore();
  const stats = calcDashboard(bets);
  const inTilt = isInTilt(bets, settings.tiltThreshold);

  const bankTotal =
    bankroll.transactions.reduce(
      (sum, t) => (t.type === 'deposit' ? sum + t.amount : sum - t.amount), 0,
    ) + stats.pnl;

  const chartData = stats.pnlCurve.map((p) => ({ index: p.index, pnl: p.pnl / 100 }));
  const pnlPositive = stats.pnl >= 0;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Дашборд</h1>
          <div style={s.subtitle}>
            {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
        {settings.isPro && <div style={s.proBadge}>👑 PRO</div>}
      </div>

      {inTilt && (
        <div style={s.tiltAlert}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div style={s.tiltTitle}>Возможный тилт — {stats.currentStreak.count} поражений подряд</div>
            <div style={s.tiltSub}>Рекомендуем сделать паузу и не ставить до завтра</div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div style={s.statsGrid}>
        <StatCard
          label="P&L"
          value={formatMoney(stats.pnl)}
          sub="чистая прибыль"
          color={stats.pnl > 0 ? colors.won : stats.pnl < 0 ? colors.lost : undefined}
        />
        <StatCard
          label="ROI"
          value={formatPercent(stats.roi)}
          sub="возврат инвестиций"
          color={stats.roi > 0 ? colors.won : stats.roi < 0 ? colors.lost : undefined}
        />
        <StatCard
          label="Винрейт"
          value={`${stats.winRate.toFixed(1)}%`}
          sub={`${stats.wonBets}W / ${stats.lostBets}L`}
          color={colors.accent}
        />
        <StatCard
          label="Банк"
          value={formatMoney(bankTotal)}
          sub="текущий баланс"
        />
        <StatCard
          label="Ставок всего"
          value={String(stats.totalBets)}
          sub={`${bets.filter((b) => b.status === 'pending').length} в ожидании`}
        />
        <StatCard
          label="Серия"
          value={
            stats.currentStreak.type === 'none' ? '—'
            : `${stats.currentStreak.count} ${stats.currentStreak.type === 'win' ? '🏆' : '💸'}`
          }
          sub={stats.currentStreak.type === 'win' ? 'побед подряд' : stats.currentStreak.type === 'loss' ? 'поражений подряд' : ''}
          color={stats.currentStreak.type === 'win' ? colors.won : stats.currentStreak.type === 'loss' ? colors.lost : undefined}
        />
      </div>

      {/* W/L strip */}
      {bets.length > 0 && (
        <div style={s.card}>
          <div style={s.cardTitle}>Последние результаты</div>
          <WLStrip bets={bets} />
        </div>
      )}

      {/* P&L Chart */}
      {chartData.length > 1 && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={s.cardTitle}>P&L кривая</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: pnlPositive ? colors.won : colors.lost }}>
              {pnlPositive ? '+' : ''}{formatMoney(stats.pnl)}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={pnlPositive ? colors.won : colors.lost} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={pnlPositive ? colors.won : colors.lost} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
              <XAxis dataKey="index" hide />
              <YAxis
                tickFormatter={(v) => `${v}₽`}
                tick={{ fill: colors.textMuted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 8 }}
                labelStyle={{ color: colors.textMuted }}
                formatter={(v: number) => [`${v.toFixed(0)} ₽`, 'P&L']}
              />
              <Area
                type="monotone"
                dataKey="pnl"
                stroke={pnlPositive ? colors.won : colors.lost}
                strokeWidth={2}
                fill="url(#pnlGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent bets */}
      {bets.length > 0 && (
        <div style={s.card}>
          <div style={s.cardTitle}>Последние 5 ставок</div>
          <table style={s.table}>
            <thead>
              <tr>
                {['Событие', 'Выбор', 'Коэф.', 'Ставка', 'P&L', 'Статус'].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bets.slice(0, 5).map((bet) => {
                const pnl = bet.status === 'won' ? Math.round(bet.stake * (bet.odds - 1))
                  : bet.status === 'lost' ? -bet.stake : null;
                const statusColors: Record<string, string> = {
                  won: colors.won, lost: colors.lost, pending: colors.pending, refund: colors.refund,
                };
                return (
                  <tr key={bet.id} style={s.tr}>
                    <td style={s.td}><span style={s.eventCell}>{bet.event}</span></td>
                    <td style={s.td}>{bet.pick}</td>
                    <td style={s.td}>×{bet.odds}</td>
                    <td style={s.td}>{formatMoney(bet.stake)}</td>
                    <td style={{ ...s.td, color: pnl === null ? colors.textMuted : pnl >= 0 ? colors.won : colors.lost, fontWeight: 700 }}>
                      {pnl !== null ? (pnl >= 0 ? '+' : '') + formatMoney(pnl) : '—'}
                    </td>
                    <td style={s.td}>
                      <span style={{ ...s.statusBadge, color: statusColors[bet.status], backgroundColor: statusColors[bet.status] + '22' }}>
                        {bet.status === 'won' ? 'Победа' : bet.status === 'lost' ? 'Проигрыш' : bet.status === 'pending' ? 'Ожидание' : 'Возврат'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', flex: 1 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 700, color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  proBadge: {
    backgroundColor: colors.gold + '22', color: colors.gold,
    padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700,
    border: `1px solid ${colors.gold}44`,
  },
  tiltAlert: {
    display: 'flex', alignItems: 'center', gap: 14,
    marginBottom: 20, padding: 16, borderRadius: 12,
    backgroundColor: colors.lost + '15', border: `1px solid ${colors.lost}44`,
  },
  tiltTitle: { fontSize: 15, fontWeight: 700, color: colors.lost },
  tiltSub: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20,
  },
  statCard: {
    backgroundColor: colors.bgCard, borderRadius: 12, padding: 18,
    border: `1px solid ${colors.border}`,
  },
  statLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  statValue: { fontSize: 26, fontWeight: 700 },
  statSub: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  wlRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  wlSquare: {
    width: 34, height: 34, borderRadius: 8, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, border: '1px solid',
  },
  card: {
    backgroundColor: colors.bgCard, borderRadius: 14, padding: 20,
    border: `1px solid ${colors.border}`, marginBottom: 20,
  },
  cardTitle: { fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 14 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5,
    padding: '0 0 10px 0', textAlign: 'left', borderBottom: `1px solid ${colors.border}`,
  },
  tr: { borderBottom: `1px solid ${colors.border}` },
  td: { padding: '12px 0', fontSize: 14, color: colors.textPrimary, paddingRight: 16 },
  eventCell: { fontWeight: 600, maxWidth: 240, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  statusBadge: { padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 },
};
