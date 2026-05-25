import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { Bet, BetStatus } from '@sharklog/core';
import { calcDashboard, formatMoney, formatOdds, formatPercent, isInTilt } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';
import { useToastStore } from '../store/toastStore';
import { colors } from '../theme/colors';

type PeriodFilter = '7d' | '30d' | 'all';
const PERIOD_OPTIONS: Array<{ key: PeriodFilter; label: string }> = [
  { key: '7d', label: '7 дней' },
  { key: '30d', label: '30 дней' },
  { key: 'all', label: 'Всё время' },
];

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

function WLStrip({ bets }: { bets: Bet[] }) {
  const settled = bets.filter((b) => b.status !== 'pending').slice(0, 10).reverse();
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

function Heatmap({ bets }: { bets: Bet[] }) {
  const today = new Date();
  const weeks = 12;
  const totalDays = weeks * 7;

  const pnlByDate: Record<string, number> = {};
  const countByDate: Record<string, number> = {};
  for (const bet of bets) {
    if (bet.status === 'pending') continue;
    const profit = bet.status === 'won'
      ? Math.round(bet.stake * (bet.odds - 1))
      : bet.status === 'lost' ? -bet.stake : 0;
    pnlByDate[bet.date] = (pnlByDate[bet.date] ?? 0) + profit;
    countByDate[bet.date] = (countByDate[bet.date] ?? 0) + 1;
  }

  if (Object.keys(countByDate).length === 0) return null;

  const days: Array<{ dateStr: string; pnl: number; count: number }> = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0] ?? '';
    days.push({ dateStr, pnl: pnlByDate[dateStr] ?? 0, count: countByDate[dateStr] ?? 0 });
  }

  const columns: typeof days[] = [];
  for (let w = 0; w < weeks; w++) columns.push(days.slice(w * 7, w * 7 + 7));

  function cellBg(day: { pnl: number; count: number }) {
    if (day.count === 0) return colors.bgElevated;
    if (day.pnl > 0) return colors.won + (day.pnl > 50000 ? 'cc' : day.pnl > 10000 ? '88' : '44');
    if (day.pnl < 0) return colors.lost + (day.pnl < -50000 ? 'cc' : day.pnl < -10000 ? '88' : '44');
    return colors.textMuted + '44';
  }

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>Активность за 12 недель</div>
      <div style={{ display: 'flex', gap: 3 }}>
        {columns.map((col, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {col.map((day, di) => (
              <div
                key={di}
                title={day.count > 0 ? `${day.dateStr}: ${day.count} ставок, ${day.pnl >= 0 ? '+' : ''}${(day.pnl / 100).toFixed(0)} ₽` : day.dateStr}
                style={{ width: 14, height: 14, borderRadius: 2, backgroundColor: cellBg(day) }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.lost + '88' }} />
        <span style={{ fontSize: 11, color: colors.textMuted }}>−</span>
        <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.bgElevated }} />
        <span style={{ fontSize: 11, color: colors.textMuted }}>0</span>
        <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.won + '88' }} />
        <span style={{ fontSize: 11, color: colors.textMuted }}>+</span>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { bets, settings, bankroll, updateBet } = useBetsStore();
  const toast = useToastStore((s) => s.show);

  function closeBet(bet: Bet, status: BetStatus) {
    updateBet(bet.id, { status });
    const label = status === 'won' ? 'Победа ✅' : status === 'lost' ? 'Проигрыш ❌' : 'Возврат 🔄';
    toast(`${bet.event} — ${label}`, status === 'won' ? 'success' : status === 'lost' ? 'error' : 'info');
  }
  const [period, setPeriod] = useState<PeriodFilter>('all');

  const filteredBets = useMemo(() => {
    if (period === 'all') return bets;
    const days = period === '7d' ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0] ?? '';
    return bets.filter((b) => b.date > cutoffStr);
  }, [bets, period]);

  const stats = calcDashboard(filteredBets);
  const inTilt = isInTilt(filteredBets, settings.tiltThreshold);

  const allTimePnl = period === 'all' ? stats.pnl : calcDashboard(bets).pnl;
  const bankTotal =
    bankroll.transactions.reduce(
      (sum, t) => (t.type === 'deposit' ? sum + t.amount : sum - t.amount), 0,
    ) + allTimePnl;

  const chartData = stats.pnlCurve.map((p) => ({ index: p.index, pnl: p.pnl / 100 }));
  const pnlPositive = stats.pnl >= 0;

  const settledWithPnl = filteredBets
    .filter((b) => b.status === 'won' || b.status === 'lost')
    .map((b) => ({ ...b, pnl: b.status === 'won' ? Math.round(b.stake * b.odds) - b.stake : -b.stake }));
  const bestBet = settledWithPnl.length > 0
    ? settledWithPnl.reduce((a, b) => b.pnl > a.pnl ? b : a)
    : null;
  const worstBet = settledWithPnl.length > 1
    ? settledWithPnl.reduce((a, b) => b.pnl < a.pnl ? b : a)
    : null;

  if (bets.length === 0) {
    return (
      <div style={s.page}>
        <div style={s.header}>
          <div>
            <h1 style={s.title}>Дашборд</h1>
            <div style={s.subtitle}>
              {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
        </div>
        <div style={s.emptyWrap}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>🦈</div>
          <div style={s.emptyTitle}>Ставок пока нет</div>
          <div style={s.emptySub}>Добавь первую ставку, чтобы начать отслеживать результаты</div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Дашборд</h1>
          <div style={s.subtitle}>
            {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Period filter */}
          <div style={s.periodRow}>
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
          {settings.isPro && <div style={s.proBadge}>👑 PRO</div>}
        </div>
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

      <div style={s.statsGrid}>
        <StatCard
          label="P&L"
          value={formatMoney(stats.pnl)}
          sub="чистая прибыль"
          {...(stats.pnl !== 0 ? { color: stats.pnl > 0 ? colors.won : colors.lost } : {})}
        />
        <StatCard
          label="ROI"
          value={formatPercent(stats.roi)}
          sub="возврат инвестиций"
          {...(stats.roi !== 0 ? { color: stats.roi > 0 ? colors.won : colors.lost } : {})}
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
          sub={`${filteredBets.filter((b) => b.status === 'pending').length} в ожидании`}
        />
        <StatCard
          label="Серия"
          value={
            stats.currentStreak.type === 'none' ? '—'
            : `${stats.currentStreak.count} ${stats.currentStreak.type === 'win' ? '🏆' : '💸'}`
          }
          sub={stats.currentStreak.type === 'win' ? 'побед подряд' : stats.currentStreak.type === 'loss' ? 'поражений подряд' : ''}
          {...(stats.currentStreak.type !== 'none' ? { color: stats.currentStreak.type === 'win' ? colors.won : colors.lost } : {})}
        />
      </div>

      {/* Pending bets quick-close */}
      {bets.filter((b) => b.status === 'pending').length > 0 && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={s.cardTitle}>Ожидают результата</div>
            <span style={{ fontSize: 12, color: colors.pending, fontWeight: 600 }}>
              {bets.filter((b) => b.status === 'pending').length} ставок
            </span>
          </div>
          <table style={s.table}>
            <thead>
              <tr>
                {['Событие', 'Выбор', 'Коэф.', 'Ставка', 'Потенциал', ''].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bets.filter((b) => b.status === 'pending').slice(0, 8).map((bet) => {
                const potential = formatMoney(Math.round(bet.stake * bet.odds));
                return (
                  <tr key={bet.id} style={s.tr}>
                    <td style={s.td}><span style={s.eventCell}>{bet.event}</span></td>
                    <td style={{ ...s.td, color: colors.accent, fontWeight: 600 }}>{bet.pick}</td>
                    <td style={{ ...s.td, fontFamily: "'DM Mono', monospace" }}>×{formatOdds(bet.odds)}</td>
                    <td style={{ ...s.td, fontFamily: "'DM Mono', monospace" }}>{formatMoney(bet.stake)}</td>
                    <td style={{ ...s.td, color: colors.accent, fontFamily: "'DM Mono', monospace" }}>{potential}</td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={{ ...s.chip, color: colors.won, borderColor: colors.won + '55', backgroundColor: colors.won + '18' }} onClick={() => closeBet(bet, 'won')}>W</button>
                        <button style={{ ...s.chip, color: colors.lost, borderColor: colors.lost + '55', backgroundColor: colors.lost + '18' }} onClick={() => closeBet(bet, 'lost')}>L</button>
                        <button style={{ ...s.chip, color: colors.refund, borderColor: colors.refund + '55', backgroundColor: colors.refund + '18' }} onClick={() => closeBet(bet, 'refund')}>R</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* W/L strip */}
      {filteredBets.length > 0 && (
        <div style={s.card}>
          <div style={s.cardTitle}>Последние результаты</div>
          <WLStrip bets={filteredBets} />
        </div>
      )}

      <Heatmap bets={filteredBets} />

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

      {/* Best / Worst bet */}
      {(bestBet || worstBet) && (
        <div style={s.card}>
          <div style={s.cardTitle}>Лучшая / Худшая ставка</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
            {bestBet && (
              <div style={{ ...s.extremeBet, borderColor: colors.won + '44' }}>
                <div style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Лучшая</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bestBet.event}</div>
                <div style={{ fontSize: 12, color: colors.textSecondary }}>{bestBet.pick} · ×{bestBet.odds}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: colors.won, marginTop: 8 }}>+{formatMoney(bestBet.pnl)}</div>
              </div>
            )}
            {worstBet && (
              <div style={{ ...s.extremeBet, borderColor: colors.lost + '44' }}>
                <div style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Худшая</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{worstBet.event}</div>
                <div style={{ fontSize: 12, color: colors.textSecondary }}>{worstBet.pick} · ×{worstBet.odds}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: colors.lost, marginTop: 8 }}>{formatMoney(worstBet.pnl)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent bets */}
      {filteredBets.length > 0 && (
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
              {filteredBets.slice(0, 5).map((bet) => {
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
  page: { padding: '28px 32px', flex: 1, overflow: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 700, color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  periodRow: { display: 'flex', gap: 4 },
  periodBtn: {
    padding: '6px 14px', borderRadius: 8, border: `1px solid ${colors.border}`,
    backgroundColor: colors.bgCard, color: colors.textSecondary, fontSize: 13, cursor: 'pointer',
  },
  periodBtnActive: {
    backgroundColor: colors.purple, borderColor: colors.purple, color: '#fff', fontWeight: 700,
  },
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
  statValue: { fontSize: 26, fontWeight: 700, fontFamily: "'DM Mono', monospace" },
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
  extremeBet: {
    backgroundColor: colors.bgElevated, borderRadius: 10, padding: 14,
    border: '1px solid',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5,
    padding: '0 0 10px 0', textAlign: 'left', borderBottom: `1px solid ${colors.border}`,
  },
  tr: { borderBottom: `1px solid ${colors.border}` },
  td: { padding: '12px 0', fontSize: 14, color: colors.textPrimary, paddingRight: 16 },
  eventCell: { fontWeight: 600, maxWidth: 240, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  statusBadge: { padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 },
  chip: { border: '1px solid', borderRadius: 6, padding: '3px 7px', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  emptyWrap: { textAlign: 'center', paddingTop: 100 },
  emptyTitle: { fontSize: 22, fontWeight: 700, color: colors.textPrimary, marginBottom: 10 },
  emptySub: { fontSize: 15, color: colors.textSecondary, maxWidth: 380, margin: '0 auto' },
};
