import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  calcByField, calcByOddsRange, calcByDayOfWeek, calcByHour, calcDashboard,
  SPORTS, BET_TYPES, STRATEGIES, formatMoney, formatPercent,
} from '@sharklog/core';
import type { SliceStats } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';
import { colors } from '../theme/colors';

type PeriodFilter = '7d' | '30d' | 'all';
const PERIOD_OPTIONS: Array<{ key: PeriodFilter; label: string }> = [
  { key: '7d', label: '7 дней' },
  { key: '30d', label: '30 дней' },
  { key: 'all', label: 'Всё время' },
];

function Section({ title, stats }: { title: string; stats: SliceStats[] }) {
  const withData = stats.filter((st) => st.count > 0);
  if (withData.length === 0) return null;

  const chartData = withData.map((st) => ({ name: st.label, roi: parseFloat(st.roi.toFixed(1)), pnl: st.pnl / 100 }));

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
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

function SummaryCard({ bets }: { bets: Parameters<typeof calcDashboard>[0] }) {
  const stats = calcDashboard(bets);
  const pnlColor = stats.pnl > 0 ? colors.won : stats.pnl < 0 ? colors.lost : colors.textPrimary;
  const bestSport = calcByField(bets, 'sport', (v) => SPORTS[v] ?? String(v))
    .filter((s) => s.count >= 3)
    .sort((a, b) => b.roi - a.roi)[0];

  return (
    <div style={{ ...s.card, marginBottom: 20 }}>
      <div style={s.cardTitle}>Общая статистика</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
        {[
          { label: 'Ставок', value: String(stats.totalBets), color: colors.textPrimary },
          { label: 'Выигрышей', value: `${stats.winRate.toFixed(1)}%`, color: stats.winRate > 50 ? colors.won : colors.textPrimary },
          { label: 'P&L', value: `${stats.pnl >= 0 ? '+' : ''}${formatMoney(stats.pnl)}`, color: pnlColor },
          { label: 'ROI', value: `${stats.roi >= 0 ? '+' : ''}${formatPercent(stats.roi)}`, color: pnlColor },
        ].map((item) => (
          <div key={item.label} style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>{item.label}</div>
          </div>
        ))}
      </div>
      {bestSport && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: colors.textMuted }}>Лучший вид спорта</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: colors.accent }}>{bestSport.label} · ROI {formatPercent(bestSport.roi)}</span>
        </div>
      )}
    </div>
  );
}

export function AnalyticsPage() {
  const { bets, settings, updateSettings } = useBetsStore();
  const [period, setPeriod] = useState<PeriodFilter>('all');

  const filteredBets = useMemo(() => {
    if (period === 'all') return bets;
    const days = period === '7d' ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0] ?? '';
    return bets.filter((b) => b.date > cutoffStr);
  }, [bets, period]);

  if (!settings.isPro) {
    return (
      <div style={s.page}>
        <h1 style={s.title}>Аналитика</h1>
        <div style={s.gate}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👑</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: colors.gold, marginBottom: 8 }}>Функция PRO</div>
          <div style={{ color: colors.textSecondary, marginBottom: 24 }}>Полная аналитика по 7 срезам доступна в подписке SharkLog Pro</div>
          <button style={s.proBtn} onClick={() => updateSettings({ isPro: true })}>Попробовать Pro — 7 дней бесплатно</button>
        </div>
      </div>
    );
  }

  const bySport = calcByField(filteredBets, 'sport', (v) => SPORTS[v] ?? String(v));
  const byBetType = calcByField(filteredBets, 'betType', (v) => BET_TYPES[v] ?? String(v));
  const byBookmaker = calcByField(filteredBets, 'bookmaker');
  const byStrategy = calcByField(filteredBets, 'strategy', (v) => STRATEGIES[v] ?? String(v));
  const byOdds = calcByOddsRange(filteredBets);
  const byDay = calcByDayOfWeek(filteredBets);
  const byHour = calcByHour(filteredBets);

  return (
    <div style={s.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={s.title}>Аналитика</h1>
          <p style={s.subtitle}>7 срезов статистики</p>
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

      {filteredBets.length === 0 ? (
        <div style={s.empty}>Нет ставок за выбранный период</div>
      ) : (
        <>
          <SummaryCard bets={filteredBets} />
          <Section title="По виду спорта" stats={bySport} />
          <Section title="По типу ставки" stats={byBetType} />
          <Section title="По букмекеру" stats={byBookmaker} />
          <Section title="По стратегии" stats={byStrategy} />
          <Section title="По коэффициенту" stats={byOdds} />
          <Section title="По дню недели" stats={byDay} />
          <Section title="По часам дня" stats={byHour} />
        </>
      )}
    </div>
  );
}

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
  th: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, padding: '0 8px 8px 0', textAlign: 'left' },
  tr: { borderTop: `1px solid ${colors.border}` },
  td: { padding: '8px 8px 8px 0', fontSize: 13, color: colors.textSecondary },
  gate: { textAlign: 'center' as const, paddingTop: 80 },
  proBtn: {
    backgroundColor: colors.purple, color: '#fff', border: 'none',
    padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  empty: { color: colors.textMuted, marginTop: 40 },
};
