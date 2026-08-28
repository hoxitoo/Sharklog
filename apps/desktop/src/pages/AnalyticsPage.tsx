import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  calcByField, calcByOddsRange, calcByDayOfWeek, calcByHour, calcDashboard,
  calcByTournament, calcLuck, calcPlanCompliance, RELIABLE_SAMPLE_MIN,
  SPORTS, BET_TYPES, STRATEGIES, formatMoney, formatPercent, toYmd } from '@sharklog/core';
import type { SliceStats, Bet } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';
import { colors } from '../theme/colors';
import { useTranslation } from 'react-i18next';
import { dateLocale } from '../i18n';

type PeriodFilter = '7d' | '30d' | 'all';

function Section({ title, stats }: { title: string; stats: SliceStats[] }) {
  const { t } = useTranslation();
  const withData = stats.filter((st) => st.count > 0);
  if (withData.length === 0) return null;

  const chartData = withData.map((st) => ({ name: st.label, roi: parseFloat(st.roi.toFixed(1)), pnl: st.pnl / 100 }));

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} maxBarSize={40} margin={{ bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: colors.textSecondary, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval={0}
              height={48}
              tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 11) + '…' : v}
            />
            <YAxis tick={{ fill: colors.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              cursor={{ fill: 'rgba(91,106,240,0.07)' }}
              contentStyle={{
                backgroundColor: '#1A1A2E',
                border: `1px solid ${colors.purple}55`,
                borderRadius: 8,
                fontSize: 12,
                boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
              }}
              formatter={(v: number) => [`${v}%`, 'ROI']}
              labelStyle={{ color: colors.textPrimary, marginBottom: 4, fontWeight: 600 }}
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
              {['', t('analytics.count'), 'WR', 'ROI', 'P&L'].map((h) => (
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
                  {formatPercent(stat.roi)}
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
  const { t } = useTranslation();
  const stats = calcDashboard(bets);
  const pnlColor = stats.pnl > 0 ? colors.won : stats.pnl < 0 ? colors.lost : colors.textPrimary;
  const bestSport = calcByField(bets, 'sport', (v) => SPORTS[v] ?? String(v))
    .filter((s) => s.count >= 3)
    .sort((a, b) => b.roi - a.roi)[0];

  return (
    <div style={{ ...s.card, marginBottom: 20 }}>
      <div style={s.cardTitle}>{t('analytics.totalStats')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
        {[
          { label: t('analytics.betsLabel'), value: String(stats.totalBets), color: colors.textPrimary },
          { label: t('analytics.winsLabel'), value: `${stats.winRate.toFixed(1)}%`, color: stats.winRate > 50 ? colors.won : colors.textPrimary },
          { label: 'P&L', value: `${stats.pnl >= 0 ? '+' : ''}${formatMoney(stats.pnl)}`, color: pnlColor },
          { label: 'ROI', value: formatPercent(stats.roi), color: pnlColor },
        ].map((item) => (
          <div key={item.label} style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>{item.label}</div>
          </div>
        ))}
      </div>
      {bestSport && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: colors.textMuted }}>{t('analytics.bestSport')}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: colors.accent }}>{bestSport.label} · ROI {formatPercent(bestSport.roi)}</span>
        </div>
      )}
    </div>
  );
}

function LuckCard({ bets }: { bets: Bet[] }) {
  const { t } = useTranslation();
  const l = useMemo(() => calcLuck(bets), [bets]);
  if (!l) return null;

  const swing = l.actualWins - l.expectedWins;
  const zColor = l.verdict === 'normal' ? colors.textPrimary : l.z > 0 ? colors.won : colors.lost;
  const verdict = l.verdict === 'normal' ? t('analytics.luckNormal')
    : l.verdict === 'hot' ? t('analytics.luckHot')
    : t('analytics.luckCold');

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>{t('analytics.luckTitle')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Stat
          label={t('analytics.luckDeviation')}
          value={`${l.z > 0 ? '+' : ''}${l.z.toFixed(2)}σ`}
          color={zColor}
          sub={`${l.actualPnl >= 0 ? '+' : ''}${formatMoney(l.actualPnl)}`}
        />
        <Stat
          label={t('analytics.luckSpread')}
          value={`±${formatMoney(l.sigma)}`}
          color={colors.textSecondary}
          sub={`${l.sample} ${t('analytics.countSuffix')}`}
        />
        <Stat
          label={t('analytics.luckWins')}
          value={`${l.actualWins} / ${l.expectedWins.toFixed(1)}`}
          color={colors.textPrimary}
          sub={`${swing >= 0 ? '+' : ''}${swing.toFixed(1)}`}
          subColor={swing >= 0 ? colors.won : colors.lost}
        />
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: colors.textSecondary, lineHeight: 1.5 }}>{verdict}</div>
      {l.sample < RELIABLE_SAMPLE_MIN && (
        <div style={{ marginTop: 8, fontSize: 11, color: colors.textMuted }}>
          {t('analytics.luckSmallSample', { n: l.sample, min: RELIABLE_SAMPLE_MIN })}
        </div>
      )}
    </div>
  );
}

function PlanCard({ bets, onNavigate }: { bets: Bet[]; onNavigate?: (page: string) => void }) {
  const { t, i18n } = useTranslation();
  const { bankroll, settings } = useBetsStore();
  const limitPct = settings.generatedStrategy?.stakePercent ?? null;
  const plan = useMemo(
    () => (limitPct ? calcPlanCompliance(bets, bankroll.transactions, limitPct) : null),
    [bets, bankroll.transactions, limitPct],
  );

  if (!limitPct) {
    return (
      <div style={s.card}>
        <div style={s.cardTitle}>{t('analytics.planTitle')}</div>
        <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.5 }}>{t('analytics.planNoStrategy')}</div>
        {onNavigate && (
          <button
            style={{
              marginTop: 12, padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
              background: colors.purpleDim, border: `1px solid ${colors.purple}`,
              color: colors.purpleText, fontSize: 13, fontWeight: 700,
            }}
            onClick={() => onNavigate('strategy')}
          >
            {t('nav.strategy')} →
          </button>
        )}
      </div>
    );
  }

  if (!plan) {
    return (
      <div style={s.card}>
        <div style={s.cardTitle}>{t('analytics.planTitle')}</div>
        <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.5 }}>{t('analytics.planNoBank')}</div>
      </div>
    );
  }

  const clean = plan.breachRate === 0;

  return (
    <div style={s.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <div style={s.cardTitle}>{t('analytics.planTitle')}</div>
        <div style={{ fontSize: 11, color: colors.textMuted }}>
          {t('analytics.planLimit', { pct: plan.limitPct })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${clean ? 2 : 4}, 1fr)`, gap: 12 }}>
        <Stat
          label={t('analytics.planOverRate')}
          value={`${plan.breachRate.toFixed(0)}%`}
          color={clean ? colors.won : plan.breachRate > 25 ? colors.lost : colors.pending}
          sub={`${plan.over} ${t('analytics.planOf')} ${plan.total}`}
        />
        <Stat
          label={t('analytics.planAvgShare')}
          value={`${plan.avgSharePct.toFixed(1)}%`}
          color={plan.avgSharePct > plan.limitPct ? colors.lost : colors.won}
          sub={`${plan.limitPct}%`}
        />
        {!clean && (
          <>
            <Stat
              label={t('analytics.planPnlWithin')}
              value={`${plan.pnlWithin >= 0 ? '+' : ''}${formatMoney(plan.pnlWithin)}`}
              color={plan.pnlWithin >= 0 ? colors.won : colors.lost}
            />
            <Stat
              label={t('analytics.planPnlOver')}
              value={`${plan.pnlOver >= 0 ? '+' : ''}${formatMoney(plan.pnlOver)}`}
              color={plan.pnlOver >= 0 ? colors.won : colors.lost}
            />
          </>
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: colors.textSecondary, lineHeight: 1.5 }}>
        {clean ? t('analytics.planClean')
          : plan.pnlOver < 0 ? t('analytics.planCost', { amount: formatMoney(Math.abs(plan.pnlOver)) })
          : t('analytics.planLucky')}
      </div>

      {!clean && (
        <>
          <div style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 6 }}>
            {t('analytics.planWorst')}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {plan.worst.map((w) => (
                <tr key={w.betId} style={{ borderTop: `1px solid ${colors.border}` }}>
                  <td style={{ padding: '8px 0', fontSize: 13, color: colors.textPrimary, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.event}</td>
                  <td style={{ padding: '8px 0', fontSize: 11, color: colors.textMuted }}>
                    {new Date(`${w.date}T12:00:00`).toLocaleDateString(dateLocale(i18n.language), { day: 'numeric', month: 'short' })}
                  </td>
                  <td style={{ padding: '8px 0', fontSize: 12, color: colors.textSecondary, textAlign: 'right' }}>{formatMoney(w.stake)}</td>
                  <td style={{ padding: '8px 0', fontSize: 14, fontWeight: 700, color: colors.lost, textAlign: 'right' }}>{w.sharePct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/** One labelled number inside a card. */
function Stat({ label, value, color, sub, subColor }: {
  label: string; value: string; color: string; sub?: string; subColor?: string;
}) {
  return (
    <div style={{ backgroundColor: colors.bgElevated, borderRadius: 10, padding: 14, border: `1px solid ${colors.border}` }}>
      <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono', monospace", color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: subColor ?? colors.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function AnalyticsPage({ onNavigate }: { onNavigate?: (page: string) => void } = {}) {
  const { bets, settings, updateSettings } = useBetsStore();
  const { t } = useTranslation();
  const [period, setPeriod] = useState<PeriodFilter>('all');

  const PERIOD_OPTIONS: Array<{ key: PeriodFilter; label: string }> = [
    { key: '7d', label: t('dashboard.week') },
    { key: '30d', label: t('dashboard.month') },
    { key: 'all', label: t('dashboard.allTime') },
  ];

  const filteredBets = useMemo(() => {
    if (period === 'all') return bets;
    const days = period === '7d' ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = toYmd(cutoff);
    return bets.filter((b) => b.date > cutoffStr);
  }, [bets, period]);

  if (!settings.isPro) {
    return (
      <div style={s.page}>
        <h1 style={s.title}>{t('analytics.title')}</h1>
        <div style={s.gate}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👑</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: colors.gold, marginBottom: 8 }}>{t('analytics.proFeature')}</div>
          <div style={{ color: colors.textSecondary, marginBottom: 24 }}>{t('analytics.proMsg')}</div>
          <button style={s.proBtn} onClick={() => updateSettings({ isPro: true })}>{t('analytics.tryPro')}</button>
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
  const topTournaments = useMemo(() => calcByTournament(filteredBets).slice(0, 3), [filteredBets]);

  return (
    <div style={s.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={s.title}>{t('analytics.title')}</h1>
          <p style={s.subtitle}>{t('analytics.slicesDesc')}</p>
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
        <div style={s.empty}>{t('analytics.noBets')}</div>
      ) : (
        <>
          <SummaryCard bets={filteredBets} />
          <LuckCard bets={filteredBets} />
          <PlanCard bets={filteredBets} {...(onNavigate ? { onNavigate } : {})} />
          {topTournaments.length > 0 && (
            <div style={s.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={s.cardTitle}>{t('analytics.topTournaments')}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${topTournaments.length}, 1fr)`, gap: 12 }}>
                {topTournaments.map((tourney) => {
                  const pnlColor = tourney.pnl > 0 ? colors.won : tourney.pnl < 0 ? colors.lost : colors.textSecondary;
                  return (
                    <div key={tourney.tournament} style={{ backgroundColor: colors.bgElevated, borderRadius: 10, padding: 14, border: `1px solid ${colors.border}` }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tourney.tournament}</div>
                      <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 10 }}>{SPORTS[tourney.sport as keyof typeof SPORTS] ?? tourney.sport} · {tourney.count} {t('analytics.countSuffix')}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: pnlColor }}>{tourney.pnl >= 0 ? '+' : ''}{formatMoney(tourney.pnl)}</div>
                          <div style={{ fontSize: 10, color: colors.textMuted }}>P&L</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: pnlColor }}>{formatPercent(tourney.roi)}</div>
                          <div style={{ fontSize: 10, color: colors.textMuted }}>ROI</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <Section title={t('analytics.bySport')} stats={bySport} />
          <Section title={t('analytics.byBetType')} stats={byBetType} />
          <Section title={t('analytics.byBookmaker')} stats={byBookmaker} />
          <Section title={t('analytics.byStrategy')} stats={byStrategy} />
          <Section title={t('analytics.byOdds')} stats={byOdds} />
          <Section title={t('analytics.byDayOfWeek')} stats={byDay} />
          <Section title={t('analytics.byHour')} stats={byHour} />
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
