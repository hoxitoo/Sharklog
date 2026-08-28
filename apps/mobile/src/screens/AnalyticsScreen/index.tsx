import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import {
  calcByField, calcByOddsRange, calcByDayOfWeek, calcDashboard,
  calcStreaks, calcExtremes, calcLastFullMonth, calcMonthResult, calcTimeStats, calcCLV,
  calcMaxDrawdown, calcEdge, calcMonthlyPnl, calcPnlBuckets, calcLuck, calcPlanCompliance, RELIABLE_SAMPLE_MIN,
  SPORTS, BET_TYPES, STRATEGIES, formatPercent, toYmd } from '@sharklog/core';
import type { SliceStats, Bet, MonthlyPnl, PnlBucket, Granularity } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { ProGate } from '../../components/ProGate';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useFormatMoney } from '../../utils/useFormatMoney';
import { uses12HourClock } from '../../utils/clockFormat';
import { haptic } from '../../utils/haptics';
import { colors, alpha, toneSurface } from '../../theme/colors';

/** The donut lives in a pink-toned Card, so its hole must match that surface. */
const DONUT_SURFACE = toneSurface('pink').backgroundColor;
import { Card, tileStyle } from '../../components/Card';
import { PnlBars } from '../../components/PnlBars';

const { width } = Dimensions.get('window');

type AnalyticsNav = NativeStackNavigationProp<RootStackParamList>;

// Distinct "time of day" ramp for the 6 four-hour donut segments.
const BUCKET_COLORS = ['#3B4A8C', '#5B6AF0', '#22D3A0', '#F59E0B', '#A78BFA', '#546E9C'];

const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_SHORT_RU = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];


// ── Hero: headline P&L with per-period bars ──────────────────────────────────

/** Bucket size that keeps the bar count readable for the selected period. */
const BUCKETS: Record<APeriodFilter, { granularity: Granularity; count: number }> = {
  '7d':  { granularity: 'day',   count: 7 },
  '30d': { granularity: 'day',   count: 30 },
  'all': { granularity: 'month', count: 12 },
};

function bucketLabel(b: PnlBucket, granularity: Granularity): string {
  const [, m, d] = b.start.split('-');
  return granularity === 'month' ? (MONTHS_SHORT_RU[Number(m) - 1] ?? '') : `${d}.${m}`;
}

function bucketTitle(b: PnlBucket, granularity: Granularity): string {
  const [, m, d] = b.start.split('-');
  return granularity === 'month' ? (MONTHS_RU[Number(m) - 1] ?? '') : `${d}.${m}`;
}

function HeroPnl({ bets, period }: { bets: Bet[]; period: APeriodFilter }) {
  const fmt = useFormatMoney();
  const stats = calcDashboard(bets);
  const positive = stats.pnl >= 0;
  const lineColor = positive ? colors.won : colors.lost;

  const { granularity, count } = BUCKETS[period];
  const buckets = useMemo(() => calcPnlBuckets(bets, granularity, count), [bets, granularity, count]);
  const [selected, setSelected] = useState<number | null>(null);
  // Switching period rebuilds the buckets, so a held index no longer means
  // anything — keeping it would dim every bar and highlight none.
  useEffect(() => setSelected(null), [granularity, count]);
  const active = selected !== null ? buckets[selected] : undefined;

  // Only every Nth tick gets a label — 30 daily bars cannot each carry a date.
  const every = Math.ceil(buckets.length / 6);

  return (
    <View style={hero.box}>
      <Text style={hero.label}>P&L · {stats.totalBets} ставок</Text>
      <Text style={[hero.value, { color: lineColor }]} numberOfLines={1} adjustsFontSizeToFit>
        {positive ? '+' : ''}{fmt(stats.pnl)}
      </Text>
      <View style={hero.metaRow}>
        <View style={hero.metaCell}>
          <Text style={[hero.metaValue, { color: lineColor }]}>{formatPercent(stats.roi)}</Text>
          <Text style={hero.metaLabel}>ROI</Text>
        </View>
        <View style={hero.metaCell}>
          <Text style={[hero.metaValue, { color: stats.winRate >= 50 ? colors.won : colors.textPrimary }]}>
            {stats.winRate.toFixed(1)}%
          </Text>
          <Text style={hero.metaLabel}>Winrate</Text>
        </View>
        <View style={hero.metaCell}>
          <Text style={hero.metaValue}>{stats.avgOdds.toFixed(2)}</Text>
          <Text style={hero.metaLabel}>Ср. кэф</Text>
        </View>
      </View>

      {buckets.some((b) => b.bets > 0) && (
        <View style={hero.chart}>
          <View style={hero.chartHead}>
            <Text style={hero.chartTitle}>
              {active ? bucketTitle(active, granularity) : granularity === 'month' ? 'По месяцам' : 'По дням'}
            </Text>
            {active ? (
              <Text style={[hero.chartValue, {
                color: active.pnl > 0 ? colors.won : active.pnl < 0 ? colors.lost : colors.textMuted,
              }]}>
                {active.pnl > 0 ? '+' : ''}{fmt(active.pnl)} · {active.bets} ст.
              </Text>
            ) : (
              <Text style={hero.chartHint}>тап по столбцу</Text>
            )}
          </View>
          <PnlBars
            buckets={buckets}
            width={width - 68}
            selected={selected}
            onSelect={(i) => { haptic.selection(); setSelected(i); }}
            labelFor={(b, i) => (i % every === 0 || i === buckets.length - 1 ? bucketLabel(b, granularity) : '')}
          />
        </View>
      )}
    </View>
  );
}

const hero = StyleSheet.create({
  box: {
    backgroundColor: colors.bgCard, borderRadius: 18, padding: 18,
    marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  label: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 34, fontWeight: '800', marginTop: 4, marginBottom: 12 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaCell: { alignItems: 'center', flex: 1 },
  metaValue: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  metaLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  chart: { marginTop: 14 },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  chartTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  chartValue: { fontSize: 13, fontWeight: '700' },
  chartHint: { fontSize: 10, color: colors.textMuted },
});

// ── Two-tile row (streaks, extremes) ─────────────────────────────────────────

interface TileInfo { title: string; text: string }

function MiniTile({ label, value, color, sub, info }: {
  label: string; value: string; color: string; sub?: string; info?: TileInfo;
}) {
  // Fixed label/value/sub bands so the value numbers align across tiles
  // regardless of 1- vs 2-line labels (fixes the "jumping numbers" look).
  return (
    <View style={tile.box}>
      <Text style={[tile.label, info ? tile.labelWithInfo : null]} numberOfLines={2}>{label}</Text>
      <Text style={[tile.value, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={tile.sub} numberOfLines={1}>{sub ?? ''}</Text>
      {info && (
        <TouchableOpacity
          style={tile.infoBtn}
          onPress={() => Alert.alert(info.title, info.text)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Text style={tile.infoBtnText}>?</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const tile = StyleSheet.create({
  box: { ...tileStyle, flex: 1 },
  label: { fontSize: 11, color: colors.textMuted, marginBottom: 6, lineHeight: 14, height: 28 }, // reserve 2 lines
  labelWithInfo: { paddingRight: 18 }, // keep clear of the "?" badge
  value: { fontSize: 20, fontWeight: '800', height: 26, textAlignVertical: 'center' },
  sub: { fontSize: 10, color: colors.textMuted, marginTop: 4, height: 13 }, // always reserved
  infoBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  infoBtnText: { fontSize: 10, color: colors.textMuted, fontWeight: '700' },
});

function StreaksCard({ bets }: { bets: Bet[] }) {
  const s = calcStreaks(bets);
  const cur = s.current;
  const curLabel = cur.type === 'none' ? '—' : `${cur.count}`;
  const curColor = cur.type === 'win' ? colors.won : cur.type === 'loss' ? colors.lost : colors.textMuted;
  return (
    <Card title="Серии" tone="info">
      <View style={row.wrap}>
        <MiniTile label="Лучшая серия побед" value={`${s.bestWin} W`} color={colors.won} />
        <View style={{ width: 10 }} />
        <MiniTile label="Худшая серия" value={`${s.worstLoss} L`} color={colors.lost} />
        <View style={{ width: 10 }} />
        <MiniTile
          label="Текущая"
          value={curLabel}
          color={curColor}
          sub={cur.type === 'win' ? 'побед подряд' : cur.type === 'loss' ? 'поражений' : ''}
        />
      </View>
    </Card>
  );
}

function ExtremesCard({ bets }: { bets: Bet[] }) {
  const fmt = useFormatMoney();
  const e = calcExtremes(bets);
  const cleanEvent = (ev: string) => ev.split(' / ')[0]?.split('|')[0]?.trim() ?? ev;
  return (
    <Card title="Рекорды" tone="violet">
      <View style={row.wrap}>
        <MiniTile
          label="Самый большой выигрыш"
          value={e.biggestWin ? `+${fmt(e.biggestWin.pnl)}` : '—'}
          color={colors.won}
          {...(e.biggestWin ? { sub: cleanEvent(e.biggestWin.bet.event) } : {})}
          info={{
            title: 'Самый большой выигрыш',
            text: 'Лучшая ставка за выбранный период: максимальный чистый выигрыш по одной ставке (выплата минус сумма ставки).\n\nПод значением — событие, на котором он случился.',
          }}
        />
        <View style={{ width: 10 }} />
        <MiniTile
          label="Самый большой проигрыш"
          value={e.biggestLoss ? fmt(e.biggestLoss.pnl) : '—'}
          color={colors.lost}
          {...(e.biggestLoss ? { sub: cleanEvent(e.biggestLoss.bet.event) } : {})}
          info={{
            title: 'Самый большой проигрыш',
            text: 'Худшая ставка за выбранный период: максимальная чистая потеря по одной ставке.\n\nПроигранные фрибеты не учитываются — их P&L равен 0, это были не твои деньги.',
          }}
        />
      </View>
    </Card>
  );
}

const row = StyleSheet.create({
  wrap: { flexDirection: 'row' },
});

// ── Edge & risk: win-rate-vs-breakeven + max drawdown + sample reliability ───

function EdgeRiskCard({ bets }: { bets: Bet[] }) {
  const fmt = useFormatMoney();
  const e = useMemo(() => calcEdge(bets), [bets]);
  const dd = useMemo(() => calcMaxDrawdown(bets), [bets]);
  const hasEdge = e.edge >= 0;
  const lowSample = e.sampleSize > 0 && e.sampleSize < RELIABLE_SAMPLE_MIN;

  return (
    <Card title="Перевес и риск" tone="profit">
      <View style={row.wrap}>
        <MiniTile
          label="Перевес над безубытком"
          value={e.sampleSize === 0 ? '—' : `${hasEdge ? '+' : ''}${e.edge.toFixed(1)}%`}
          color={e.sampleSize === 0 ? colors.textMuted : hasEdge ? colors.won : colors.lost}
          sub={e.sampleSize === 0 ? '' : `WR ${e.winRate.toFixed(0)}% · б/у ${e.breakEvenRate.toFixed(0)}%`}
          info={{
            title: 'Перевес над безубытком',
            text: 'Сравнивает твой процент побед (WR) с безубыточным при твоём среднем кэфе.\n\nБезубыток (б/у) = 100 / средний кэф. Пример: средний кэф 2.20 → нужно выигрывать 45.5% ставок, чтобы выйти в ноль. Если WR выше — у тебя перевес, и на дистанции ты в плюсе.\n\nЭто приближённая оценка: она становится надёжной от ~100 закрытых ставок.',
          }}
        />
        <View style={{ width: 10 }} />
        <MiniTile
          label="Макс. просадка"
          value={dd.maxDrawdown > 0 ? `−${fmt(dd.maxDrawdown)}` : fmt(0)}
          color={dd.maxDrawdown > 0 ? colors.lost : colors.textMuted}
          sub={dd.maxDrawdownPct > 0 ? `−${dd.maxDrawdownPct.toFixed(0)}% от пика` : 'нет просадки'}
          info={{
            title: 'Макс. просадка',
            text: 'Самое глубокое падение накопленного P&L от пика до дна за историю ставок.\n\nЭто главная мера риска: она показывает худший «провал» в деньгах, который ты пережил. «−88% от пика» значит, что в худший момент ты растерял 88% накопленной прибыли.\n\nЧем меньше просадка при том же ROI — тем стабильнее стратегия и ниже риск слить банк.',
          }}
        />
      </View>
      {lowSample && (
        <Text style={edge.caption}>
          Выборка мала ({e.sampleSize}/{RELIABLE_SAMPLE_MIN}) — перевес и % ещё нестабильны
        </Text>
      )}
    </Card>
  );
}

const edge = StyleSheet.create({
  caption: { fontSize: 11, color: colors.textMuted, marginTop: 10, lineHeight: 15 },
});

// ── Luck vs decisions ────────────────────────────────────────────────────────

function LuckCard({ bets }: { bets: Bet[] }) {
  const fmt = useFormatMoney();
  const l = useMemo(() => calcLuck(bets), [bets]);
  if (!l) return null;

  const swing = l.actualWins - l.expectedWins;
  const verdictText =
    l.verdict === 'normal'
      ? 'Результат в пределах обычного разброса — по этой выборке нельзя сказать, что дело в решениях, а не в дисперсии.'
      : l.verdict === 'hot'
      ? 'Результат выше того, что дают одни коэффициенты. Часть этого — везение, и оно не повторяется по заказу.'
      : 'Результат ниже того, что дают одни коэффициенты. Такая полоса — обычная часть дистанции, а не повод менять всё.';

  const zColor = l.verdict === 'normal' ? colors.textPrimary : l.z > 0 ? colors.won : colors.lost;

  return (
    <Card title="Везение или решения" tone="violet">
      <View style={row.wrap}>
        <MiniTile
          label="Отклонение от нуля"
          value={`${l.z > 0 ? '+' : ''}${l.z.toFixed(2)}σ`}
          color={zColor}
          sub={`факт ${l.actualPnl >= 0 ? '+' : ''}${fmt(l.actualPnl)}`}
          info={{
            title: 'Отклонение от нуля',
            text: 'Ставить по коэффициентам букмекера — это игра с нулевым ожиданием: цена 2.50 означает шанс 40%, и на дистанции такие ставки дают ровно ноль.\n\nПоэтому точка отсчёта — не «сколько я заработал», а «насколько мой результат отошёл от нуля по сравнению с тем, насколько он МОГ отойти случайно». Эта величина и есть σ (сигма).\n\nДо 1σ — обычный разброс. Больше 2σ — результат вряд ли объясняется одним везением: скорее всего, ты действительно ловишь цену (или систематически ошибаешься).',
          }}
        />
        <View style={{ width: 10 }} />
        <MiniTile
          label="Разброс на этой выборке"
          value={`±${fmt(l.sigma)}`}
          color={colors.textSecondary}
          sub={`${l.sample} ставок`}
          info={{
            title: 'Разброс на этой выборке',
            text: 'Насколько результат мог гулять сам по себе, без всякого умения — только из-за того, что ставки либо заходят, либо нет.\n\nСчитается из твоих реальных сумм и коэффициентов: чем крупнее ставки и выше кэфы, тем шире разброс. Если твой плюс или минус меньше этой цифры — он ничего не доказывает.',
          }}
        />
      </View>

      <View style={luck.winsRow}>
        <Text style={luck.winsLabel}>Побед: факт / по кэфам</Text>
        <Text style={luck.winsValue}>
          {l.actualWins} / {l.expectedWins.toFixed(1)}
          <Text style={{ color: swing >= 0 ? colors.won : colors.lost }}>
            {'  '}{swing >= 0 ? '+' : ''}{swing.toFixed(1)}
          </Text>
        </Text>
      </View>

      <Text style={luck.verdict}>{verdictText}</Text>
      {l.sample < RELIABLE_SAMPLE_MIN && (
        <Text style={luck.caption}>
          Выборка мала ({l.sample}/{RELIABLE_SAMPLE_MIN}) — на короткой дистанции почти любой результат укладывается в разброс
        </Text>
      )}
    </Card>
  );
}

const luck = StyleSheet.create({
  winsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  winsLabel: { fontSize: 12, color: colors.textSecondary },
  winsValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  verdict: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginTop: 10 },
  caption: { fontSize: 11, color: colors.textMuted, marginTop: 8, lineHeight: 15 },
});

// ── Staking-plan compliance ──────────────────────────────────────────────────

function PlanCard({ bets, allBets }: { bets: Bet[]; allBets: Bet[] }) {
  const fmt = useFormatMoney();
  const navigation = useNavigation<AnalyticsNav>();
  const { bankroll, settings } = useBetsStore();
  const limitPct = settings.generatedStrategy?.stakePercent ?? null;

  // Full history feeds the bank, the period slice is what gets judged.
  const plan = useMemo(
    () => (limitPct
      ? calcPlanCompliance(allBets, bankroll.transactions, limitPct, { evaluate: bets })
      : null),
    [allBets, bets, bankroll.transactions, limitPct],
  );

  // Without a plan there is nothing to comply with — offer to build one instead
  // of showing an empty card.
  if (!limitPct) {
    return (
      <Card title="Соблюдение плана" tone="warn">
        <Text style={plan_.empty}>
          Собери стратегию — она задаст лимит на ставку в % от банка, и здесь появится, насколько ты его держишь.
        </Text>
        <TouchableOpacity
          style={plan_.cta}
          onPress={() => { haptic.selection(); navigation.navigate('StrategyBuilder'); }}
          activeOpacity={0.8}
        >
          <Text style={plan_.ctaText}>Собрать стратегию →</Text>
        </TouchableOpacity>
      </Card>
    );
  }

  if (!plan) {
    return (
      <Card title="Соблюдение плана" tone="warn">
        <Text style={plan_.empty}>
          Нужен банк и хотя бы одна ставка своими деньгами, чтобы посчитать долю от банка.
        </Text>
      </Card>
    );
  }

  const clean = plan.breachRate === 0;

  return (
    <Card title="Соблюдение плана" tone="warn" subtitle={`Лимит ${plan.limitPct}% банка на ставку`}>
      <View style={row.wrap}>
        <MiniTile
          label="Ставок сверх лимита"
          value={`${plan.breachRate.toFixed(0)}%`}
          color={clean ? colors.won : plan.breachRate > 25 ? colors.lost : colors.pending}
          sub={`${plan.over} из ${plan.total}`}
          info={{
            title: 'Ставок сверх лимита',
            text: 'Доля ставок, где сумма превысила твой план в % от банка.\n\nБанк берётся на НАЧАЛО дня ставки: пополнения того дня уже учтены, а результаты того дня — ещё нет, потому что на момент ставки они не были известны.\n\nФрибеты не считаются: там своих денег не было.',
          }}
        />
        <View style={{ width: 10 }} />
        <MiniTile
          label="Средняя доля банка"
          value={`${plan.avgSharePct.toFixed(1)}%`}
          color={plan.avgSharePct > plan.limitPct ? colors.lost : colors.won}
          sub={`план ${plan.limitPct}%`}
          info={{
            title: 'Средняя доля банка',
            text: 'Средний размер ставки в процентах от банка на тот момент.\n\nЕсли она заметно выше плана — дело не в отдельных срывах, а в том, что реальный размер ставки просто больше выбранного. Тогда честнее пересобрать стратегию под свой стиль, чем каждый раз нарушать её.',
          }}
        />
      </View>

      {!clean && (
        <View style={plan_.splitRow}>
          <View style={plan_.splitCell}>
            <Text style={plan_.splitLabel}>P&L в лимите</Text>
            <Text style={[plan_.splitValue, { color: plan.pnlWithin >= 0 ? colors.won : colors.lost }]}>
              {plan.pnlWithin >= 0 ? '+' : ''}{fmt(plan.pnlWithin)}
            </Text>
          </View>
          <View style={plan_.splitDivider} />
          <View style={plan_.splitCell}>
            <Text style={plan_.splitLabel}>P&L сверх лимита</Text>
            <Text style={[plan_.splitValue, { color: plan.pnlOver >= 0 ? colors.won : colors.lost }]}>
              {plan.pnlOver >= 0 ? '+' : ''}{fmt(plan.pnlOver)}
            </Text>
          </View>
        </View>
      )}

      {clean ? (
        <Text style={plan_.verdict}>Ни одна ставка не вышла за лимит. Это и есть дисциплина.</Text>
      ) : (
        <>
          <Text style={plan_.verdict}>
            {plan.pnlOver < 0
              ? `Ставки сверх лимита забрали ${fmt(Math.abs(plan.pnlOver))}.`
              : `Ставки сверх лимита пока в плюсе — но именно они однажды дадут самую глубокую просадку.`}
          </Text>
          <Text style={plan_.worstTitle}>Самые крупные отклонения</Text>
          {plan.worst.map((w) => (
            <View key={w.betId} style={plan_.worstRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={plan_.worstEvent} numberOfLines={1}>{w.event}</Text>
                <Text style={plan_.worstDate}>
                  {w.date.split('-').reverse().slice(0, 2).join('.')} · {fmt(w.stake)}
                </Text>
              </View>
              <Text style={plan_.worstShare}>{w.sharePct.toFixed(1)}%</Text>
            </View>
          ))}
        </>
      )}
    </Card>
  );
}

const plan_ = StyleSheet.create({
  empty: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  cta: {
    marginTop: 12, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: alpha(colors.gold, 0.16), borderWidth: 1, borderColor: colors.gold,
  },
  ctaText: { fontSize: 13, fontWeight: '700', color: colors.gold },
  splitRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  splitCell: { flex: 1 },
  splitDivider: { width: 1, height: 28, backgroundColor: colors.border, marginHorizontal: 10 },
  splitLabel: { fontSize: 11, color: colors.textMuted },
  splitValue: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  verdict: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginTop: 10 },
  worstTitle: {
    fontSize: 11, color: colors.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.5, marginTop: 14, marginBottom: 6,
  },
  worstRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.border,
  },
  worstEvent: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  worstDate: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  worstShare: { fontSize: 14, fontWeight: '700', color: colors.lost },
});

// ── Monthly P&L trend (6 compact bars) ───────────────────────────────────────

function MonthlyBars({ data, selected, onSelect }: {
  data: MonthlyPnl[];
  selected: { y: number; m: number };
  onSelect: (y: number, m: number) => void;
}) {
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.pnl)), 1);
  const HALF = 34;

  return (
    <View style={mbars.wrap}>
      {data.map((d) => {
        const isSelected = d.year === selected.y && d.month === selected.m;
        const frac = Math.abs(d.pnl) / maxAbs;
        const barH = d.count === 0 ? 0 : Math.max(frac * HALF, 3);
        const pos = d.pnl >= 0;
        const barColor = (pos ? colors.won : colors.lost) + (isSelected ? '' : 'AA');
        return (
          <TouchableOpacity
            key={`${d.year}-${d.month}`}
            style={[mbars.col, isSelected && mbars.colSelected]}
            onPress={() => { haptic.selection(); onSelect(d.year, d.month); }}
            activeOpacity={0.7}
          >
            <View style={mbars.top}>
              {pos && barH > 0 && <View style={[mbars.bar, { height: barH, backgroundColor: barColor }]} />}
            </View>
            <View style={mbars.mid} />
            <View style={mbars.bottom}>
              {!pos && barH > 0 && <View style={[mbars.bar, { height: barH, backgroundColor: barColor }]} />}
            </View>
            <Text style={[mbars.label, isSelected && mbars.labelSelected]}>{MONTHS_SHORT_RU[d.month]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const mbars = StyleSheet.create({
  wrap: { flexDirection: 'row', marginTop: 16 },
  col: { flex: 1, alignItems: 'center', borderRadius: 8, paddingVertical: 2 },
  colSelected: { backgroundColor: colors.bgElevated },
  top: { height: 34, justifyContent: 'flex-end', width: '100%', alignItems: 'center' },
  bottom: { height: 34, justifyContent: 'flex-start', width: '100%', alignItems: 'center' },
  mid: { height: 1, backgroundColor: colors.border, alignSelf: 'stretch' },
  bar: { width: 14, borderRadius: 3 },
  label: { fontSize: 10, color: colors.textMuted, marginTop: 5 },
  labelSelected: { color: colors.textPrimary, fontWeight: '700' },
});

// ── Month summary (last full month by default; bars select any of the last 6) ─

function LastMonthCard({ bets }: { bets: Bet[] }) {
  const fmt = useFormatMoney();
  // null → default (last full month); set by tapping a bar. Tapping again resets.
  const [sel, setSel] = useState<{ y: number; m: number } | null>(null);
  const trend = useMemo(() => calcMonthlyPnl(bets, new Date(), 6), [bets]);
  const m = useMemo(
    () => (sel ? calcMonthResult(bets, sel.y, sel.m) : calcLastFullMonth(bets, new Date())),
    [bets, sel],
  );
  const positive = m.pnl >= 0;
  const pnlColor = positive ? colors.won : colors.lost;
  const trendUp = m.deltaPnl >= 0;

  const now = new Date();
  const isCurrentMonth = m.year === now.getFullYear() && m.month === now.getMonth();
  const monthName = `${MONTHS_RU[m.month]}${m.year !== now.getFullYear() ? ` ${m.year}` : ''}`;
  const title = sel
    ? `Итог месяца · ${monthName}${isCurrentMonth ? ' (идёт)' : ''}`
    : `Прошлый месяц · ${monthName}`;

  return (
    <Card title={title} tone="warn">
      {m.count === 0 ? (
        <Text style={month.empty}>Нет закрытых ставок за {monthName}</Text>
      ) : (
        <View style={month.rowWrap}>
          <View style={month.main}>
            <Text style={[month.pnl, { color: pnlColor }]} numberOfLines={1} adjustsFontSizeToFit>
              {positive ? '+' : ''}{fmt(m.pnl)}
            </Text>
            <Text style={month.sub}>{m.count} ставок · WR {m.winRate.toFixed(0)}%</Text>
          </View>
          <View style={month.side}>
            <Text style={[month.roi, { color: pnlColor }]}>{formatPercent(m.roi)}</Text>
            <Text style={[month.trend, { color: trendUp ? colors.won : colors.lost }]}>
              {trendUp ? '▲' : '▼'} {fmt(Math.abs(m.deltaPnl))}
            </Text>
          </View>
        </View>
      )}
      {/* 6-month trend for context — tap a bar to see that month's summary */}
      <MonthlyBars
        data={trend}
        selected={{ y: m.year, m: m.month }}
        onSelect={(y, mo) => setSel((prev) => (prev && prev.y === y && prev.m === mo ? null : { y, m: mo }))}
      />
      <Text style={month.barsCaption}>Последние 6 месяцев · нажми на месяц</Text>
    </Card>
  );
}

const month = StyleSheet.create({
  rowWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  main: { flex: 1 },
  pnl: { fontSize: 26, fontWeight: '800' },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  side: { alignItems: 'flex-end' },
  roi: { fontSize: 16, fontWeight: '700' },
  trend: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  empty: { fontSize: 13, color: colors.textMuted },
  barsCaption: { fontSize: 10, color: colors.textMuted, textAlign: 'center', marginTop: 8 },
});

// ── Time of day: top hours + donut ───────────────────────────────────────────

function TimeCard({ bets }: { bets: Bet[] }) {
  const fmt = useFormatMoney();
  const is12h = useMemo(() => uses12HourClock(), []);
  const t = useMemo(() => calcTimeStats(bets, is12h), [bets, is12h]);
  const total = t.buckets.reduce((s, b) => s + b.count, 0);

  if (total === 0) {
    return <Card title="Время ставок" tone="pink"><Text style={time.empty}>Нет данных о времени ставок</Text></Card>;
  }

  const pie = t.buckets
    .map((b, i) => ({ value: b.count, color: BUCKET_COLORS[i]!, label: b.label }))
    .filter((s) => s.value > 0);

  return (
    <Card title="Время ставок" tone="pink">
      {/* Top-4 exact hours with P&L */}
      <View style={time.topRow}>
        {t.topHours.map((h) => (
          <View key={h.hour} style={time.topCell}>
            <Text style={time.topHour}>{h.label}</Text>
            <Text style={[time.topPnl, { color: h.pnl >= 0 ? colors.won : colors.lost }]}>
              {h.pnl >= 0 ? '+' : ''}{fmt(h.pnl)}
            </Text>
            <Text style={time.topCount}>{h.count} ст.</Text>
          </View>
        ))}
      </View>

      <View style={time.donutRow}>
        <PieChart
          data={pie}
          donut
          radius={64}
          innerRadius={40}
          innerCircleColor={DONUT_SURFACE}
          strokeWidth={2}
          strokeColor={DONUT_SURFACE}
          centerLabelComponent={() => (
            <View style={{ alignItems: 'center' }}>
              <Text style={time.centerValue}>{total}</Text>
              <Text style={time.centerLabel}>ставок</Text>
            </View>
          )}
        />
        <View style={time.legend}>
          {t.buckets.filter((b) => b.count > 0).map((b, i) => {
            const idx = t.buckets.indexOf(b);
            return (
              <View key={b.startHour} style={time.legendRow}>
                <View style={[time.dot, { backgroundColor: BUCKET_COLORS[idx]! }]} />
                <Text style={time.legendLabel}>{b.label}</Text>
                <Text style={time.legendCount}>{b.count}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </Card>
  );
}

const time = StyleSheet.create({
  empty: { fontSize: 13, color: colors.textMuted },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  topCell: { alignItems: 'center', flex: 1 },
  topHour: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  topPnl: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  topCount: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  donutRow: { flexDirection: 'row', alignItems: 'center' },
  centerValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  centerLabel: { fontSize: 10, color: colors.textMuted },
  legend: { flex: 1, marginLeft: 18 },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendLabel: { fontSize: 12, color: colors.textSecondary, flex: 1 },
  legendCount: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
});

// ── CLV ──────────────────────────────────────────────────────────────────────

function ClvCard({ bets }: { bets: Bet[] }) {
  const c = useMemo(() => calcCLV(bets), [bets]);

  if (c.count === 0) {
    return (
      <Card title="CLV — ценность закрытия" tone="info">
        <Text style={clv.hint}>
          Добавляй «кэф закрытия» при вводе ставки — и здесь появится главная метрика профессионалов:
          насколько твой кэф лучше линии перед стартом.
        </Text>
      </Card>
    );
  }

  const good = c.avgClvPercent >= 0;
  return (
    <Card title="CLV — ценность закрытия" tone="info">
      <View style={row.wrap}>
        <MiniTile
          label="Средний CLV"
          value={`${good ? '+' : ''}${c.avgClvPercent.toFixed(1)}%`}
          color={good ? colors.won : colors.lost}
          sub={`по ${c.count} ставкам`}
          info={{
            title: 'Средний CLV',
            text: 'Closing Line Value — насколько твой кэф в среднем лучше кэфа закрытия линии.\n\nCLV = (твой кэф / кэф закрытия − 1) × 100%. Пример: взял 2.10, линия закрылась на 2.00 → CLV +5%.\n\nСтабильно положительный CLV — главный признак того, что ты обыгрываешь линию, а не просто ловишь удачу. Заполняй «кэф закрытия» при вводе ставки.',
          }}
        />
        <View style={{ width: 10 }} />
        <MiniTile
          label="Обыграл линию"
          value={`${c.beatCloseRate.toFixed(0)}%`}
          color={c.beatCloseRate >= 50 ? colors.won : colors.textPrimary}
          sub="кэф выше закрытия"
          info={{
            title: 'Обыграл линию',
            text: 'Доля ставок, в которых твой кэф оказался выше кэфа закрытия.\n\nСтабильно выше 50% — ты берёшь цену лучше рынка: находишь value раньше, чем линия сдвигается.',
          }}
        />
      </View>
    </Card>
  );
}

const clv = StyleSheet.create({
  hint: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
});

// ── Extended (detailed slices) ───────────────────────────────────────────────

function SliceRow({ stat, maxPnl }: { stat: SliceStats; maxPnl: number }) {
  const fmt = useFormatMoney();
  const barWidth = maxPnl > 0 ? Math.abs(stat.pnl) / maxPnl : 0;
  const isPositive = stat.pnl >= 0;
  return (
    <View style={slice.row}>
      <View style={slice.labelCol}>
        <Text style={slice.label} numberOfLines={1}>{stat.label}</Text>
        <Text style={slice.meta}>{stat.count} ст. · {stat.winRate.toFixed(0)}% WR</Text>
      </View>
      <View style={slice.barCol}>
        <View style={[slice.bar, { width: `${Math.max(barWidth * 100, 4)}%`, backgroundColor: isPositive ? colors.won : colors.lost }]} />
      </View>
      <View style={slice.valueCol}>
        <Text style={[slice.pnl, { color: isPositive ? colors.won : colors.lost }]}>{formatPercent(stat.roi)}</Text>
        <Text style={slice.pnlSub}>{fmt(stat.pnl)}</Text>
      </View>
    </View>
  );
}

const slice = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  labelCol: { width: 90 },
  label: { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  meta: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  barCol: { flex: 1, height: 6, backgroundColor: colors.bgElevated, borderRadius: 3, marginHorizontal: 8 },
  bar: { height: 6, borderRadius: 3 },
  valueCol: { width: 62, alignItems: 'flex-end' },
  pnl: { fontSize: 13, fontWeight: '700' },
  pnlSub: { fontSize: 10, color: colors.textMuted },
});

function ExtendedSection({ title, stats }: { title: string; stats: SliceStats[] }) {
  const maxPnl = Math.max(...stats.map((s) => Math.abs(s.pnl)), 1);
  const withData = stats.filter((s) => s.count > 0);
  if (withData.length === 0) return null;
  return (
    <Card title={title} tone="warn">
      {withData.map((s) => <SliceRow key={s.label} stat={s} maxPnl={maxPnl} />)}
    </Card>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

type APeriodFilter = '7d' | '30d' | 'all';
const A_PERIOD_OPTIONS: Array<{ key: APeriodFilter; label: string }> = [
  { key: '7d', label: '7 дней' },
  { key: '30d', label: '30 дней' },
  { key: 'all', label: 'Всё время' },
];

function AnalyticsContent() {
  const { bets } = useBetsStore();
  const [period, setPeriod] = useState<APeriodFilter>('all');
  const [extendedOpen, setExtendedOpen] = useState(false);

  const filteredBets = useMemo(() => {
    if (period === 'all') return bets;
    const days = period === '7d' ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = toYmd(cutoff);
    return bets.filter((b) => b.date > cutoffStr);
  }, [bets, period]);

  const extended = useMemo(() => ({
    sport: calcByField(filteredBets, 'sport', (v) => SPORTS[v] ?? String(v)),
    betType: calcByField(filteredBets, 'betType', (v) => BET_TYPES[v] ?? String(v)),
    bookmaker: calcByField(filteredBets, 'bookmaker'),
    strategy: calcByField(filteredBets, 'strategy', (v) => STRATEGIES[v] ?? String(v)),
    odds: calcByOddsRange(filteredBets),
    day: calcByDayOfWeek(filteredBets),
  }), [filteredBets]);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.periodRow}>
        {A_PERIOD_OPTIONS.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
            onPress={() => { haptic.selection(); setPeriod(p.key); }}
          >
            <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Hero — the "at a glance" state */}
      <HeroPnl bets={filteredBets} period={period} />
      <StreaksCard bets={filteredBets} />
      <ExtremesCard bets={filteredBets} />
      <EdgeRiskCard bets={filteredBets} />
      <LuckCard bets={filteredBets} />
      <PlanCard bets={filteredBets} allBets={bets} />
      <LastMonthCard bets={bets} />
      <TimeCard bets={filteredBets} />
      <ClvCard bets={filteredBets} />

      {/* Extended — collapsible so the screen isn't an endless scroll */}
      <TouchableOpacity
        style={styles.extToggle}
        onPress={() => { haptic.selection(); setExtendedOpen((v) => !v); }}
        activeOpacity={0.8}
      >
        <Text style={styles.extToggleText}>Расширенная статистика</Text>
        <Text style={styles.extChevron}>{extendedOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {extendedOpen && (
        <>
          <ExtendedSection title="По виду спорта" stats={extended.sport} />
          <ExtendedSection title="По типу ставки" stats={extended.betType} />
          <ExtendedSection title="По букмекеру" stats={extended.bookmaker} />
          <ExtendedSection title="По стратегии" stats={extended.strategy} />
          <ExtendedSection title="По коэффициенту" stats={extended.odds} />
          <ExtendedSection title="По дню недели" stats={extended.day} />
        </>
      )}
    </ScrollView>
  );
}

export function AnalyticsScreen() {
  return (
    <View style={styles.container}>
      <ScreenHeader title="Аналитика" subtitle="Твоё состояние — коротко и полно" />
      <ProGate feature="Полная аналитика: серии, рекорды, CLV, время ставок">
        <AnalyticsContent />
      </ProGate>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  periodRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginTop: 10, marginBottom: 12 },
  periodBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.bgCard,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  periodBtnActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  periodText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  periodTextActive: { color: '#fff' },
  extToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginTop: 4, marginBottom: 12, paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: colors.bgElevated, borderRadius: 14,
    borderWidth: 1, borderColor: alpha(colors.purple, 0.35),
  },
  extToggleText: { fontSize: 14, fontWeight: '700', color: colors.purpleText },
  extChevron: { fontSize: 12, color: colors.textMuted },
});
