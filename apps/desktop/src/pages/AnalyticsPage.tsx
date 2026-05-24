import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  calcByField, calcByOddsRange, calcByDayOfWeek,
  SPORTS, BET_TYPES, STRATEGIES, formatMoney, formatPercent,
} from '@sharklog/core';
import type { SliceStats } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';
import { colors } from '../theme/colors';

function Section({ title, stats }: { title: string; stats: SliceStats[] }) {
  const withData = stats.filter((s) => s.count > 0);
  if (withData.length === 0) return null;

  const chartData = withData.map((s) => ({ name: s.label, roi: parseFloat(s.roi.toFixed(1)), pnl: s.pnl / 100 }));

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Chart */}
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
            <XAxis dataKey="name" tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 8 }}
              formatter={(v: number) => [`${v}%`, 'ROI']}
              labelStyle={{ color: colors.textPrimary }}
            />
            <Bar dataKey="roi" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.roi >= 0 ? colors.won : colors.lost} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Table */}
        <table style={s.table}>
          <thead>
            <tr>
              {['', 'Ставок', 'WR', 'ROI', 'P&L'].map((h) => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withData.map((stat) => (
              <tr key={stat.label} style={s.tr}>
                <td style={{ ...s.td, fontWeight: 600, color: colors.textPrimary }}>{stat.label}</td>
                <td style={s.td}>{stat.count}</td>
                <td style={s.td}>{stat.winRate.toFixed(0)}%</td>
                <td style={{ ...s.td, fontWeight: 700, color: stat.roi >= 0 ? colors.won : colors.lost }}>
                  {stat.roi >= 0 ? '+' : ''}{formatPercent(stat.roi)}
                </td>
                <td style={{ ...s.td, color: stat.pnl >= 0 ? colors.won : colors.lost }}>
                  {stat.pnl >= 0 ? '+' : ''}{formatMoney(stat.pnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const { bets, settings } = useBetsStore();

  if (!settings.isPro) {
    return (
      <div style={s.page}>
        <h1 style={s.title}>Аналитика</h1>
        <div style={s.gate}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👑</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: colors.gold, marginBottom: 8 }}>Функция PRO</div>
          <div style={{ color: colors.textSecondary, marginBottom: 24 }}>Полная аналитика по 7 срезам доступна в подписке SharkLog Pro</div>
          <button style={s.proBtn}>Попробовать Pro — 7 дней бесплатно</button>
        </div>
      </div>
    );
  }

  const bySport = calcByField(bets, 'sport', (v) => SPORTS[v] ?? String(v));
  const byBetType = calcByField(bets, 'betType', (v) => BET_TYPES[v] ?? String(v));
  const byBookmaker = calcByField(bets, 'bookmaker');
  const byStrategy = calcByField(bets, 'strategy', (v) => STRATEGIES[v] ?? String(v));
  const byOdds = calcByOddsRange(bets);
  const byDay = calcByDayOfWeek(bets);

  if (bets.length === 0) {
    return (
      <div style={s.page}>
        <h1 style={s.title}>Аналитика</h1>
        <div style={s.empty}>Добавь хотя бы несколько ставок для анализа</div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <h1 style={s.title}>Аналитика</h1>
      <p style={s.subtitle}>7 срезов статистики</p>
      <Section title="По виду спорта" stats={bySport} />
      <Section title="По типу ставки" stats={byBetType} />
      <Section title="По букмекеру" stats={byBookmaker} />
      <Section title="По стратегии" stats={byStrategy} />
      <Section title="По коэффициенту" stats={byOdds} />
      <Section title="По дню недели" stats={byDay} />
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', flex: 1, overflow: 'auto' },
  title: { fontSize: 28, fontWeight: 700, color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 24 },
  card: {
    backgroundColor: colors.bgCard, borderRadius: 14, padding: 20,
    border: `1px solid ${colors.border}`, marginBottom: 20,
  },
  cardTitle: { fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, padding: '0 8px 8px 0', textAlign: 'left' },
  tr: { borderTop: `1px solid ${colors.border}` },
  td: { padding: '8px 8px 8px 0', fontSize: 13, color: colors.textSecondary },
  gate: { textAlign: 'center', paddingTop: 80 },
  proBtn: {
    backgroundColor: colors.purple, color: '#fff', border: 'none',
    padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  empty: { color: colors.textMuted, marginTop: 40 },
};
