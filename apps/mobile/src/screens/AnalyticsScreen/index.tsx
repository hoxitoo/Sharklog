import React, { useState, useMemo, useEffect } from 'react';
import { SPACE, RADIUS, TOUCH } from '../../theme/layout';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { PieChart } from 'react-native-gifted-charts';
import {
  calcByField, calcByOddsRange, calcByDayOfWeek, calcDashboard,
  calcStreaks, calcExtremes, calcTimeStats, calcCLV,
  calcMaxDrawdown, calcEdge, calcPnlBuckets, calcLuck, RELIABLE_SAMPLE_MIN,
  SPORTS, BET_TYPES, STRATEGIES, formatPercent, toYmd } from '@sharklog/core';
import type { SliceStats, Bet, PnlBucket, Granularity } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { ProGate } from '../../components/ProGate';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useFormatMoney } from '../../utils/useFormatMoney';
import { uses12HourClock } from '../../utils/clockFormat';
import { haptic } from '../../utils/haptics';
import { colors, alpha, toneSurface } from '../../theme/colors';
import { numeric, SIZE, GLYPH } from '../../theme/typography';

/** The donut lives in a pink-toned Card, so its hole must match that surface. */
const DONUT_SURFACE = toneSurface('pink').backgroundColor;
import { cardSurface, Card, tileStyle } from '../../components/Card';
import { PnlBars } from '../../components/PnlBars';

const { width } = Dimensions.get('window');

// Distinct "time of day" ramp for the 6 four-hour donut segments.
const BUCKET_COLORS = ['#3B4A8C', '#5B6AF0', '#22D3A0', '#F59E0B', '#A78BFA', '#546E9C'];

const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_SHORT_RU = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

// ── Hero: headline P&L with per-period bars ──────────────────────────────────

/** "к пред. месяцу" — the unit the trend arrow compares against. */
const PREV_UNIT: Record<Granularity, string> = { day: 'дню', week: 'неделе', month: 'месяцу' };

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
  const stats = useMemo(() => calcDashboard(bets), [bets]);
  const positive = stats.pnl >= 0;
  const lineColor = positive ? colors.won : colors.lost;

  const { granularity, count } = BUCKETS[period];
  const buckets = useMemo(() => calcPnlBuckets(bets, granularity, count), [bets, granularity, count]);
  const [selected, setSelected] = useState<number | null>(null);
  // Switching period rebuilds the buckets, so a held index no longer means
  // anything — keeping it would dim every bar and highlight none.
  useEffect(() => setSelected(null), [granularity, count]);
  const active = selected !== null ? buckets[selected] : undefined;
  // Winrate and the step from the period before. Both came off the "Прошлый
  // месяц" card when it went as a duplicate; they were the only two numbers on
  // it the hero did not already carry.
  const prev = selected !== null && selected > 0 ? buckets[selected - 1] : undefined;
  const delta = active && prev ? active.pnl - prev.pnl : null;
  // The newest bucket is still running: an arrow comparing half a month against
  // a whole one reads as a collapse, so the period says it is unfinished.
  const running = selected !== null && selected === buckets.length - 1;

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
              {active ? `${bucketTitle(active, granularity)}${running ? ' · идёт' : ''}`
                : granularity === 'month' ? 'По месяцам' : 'По дням'}
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
          {/* Always rendered, never conditional: appearing only on selection
              shifted the chart down by its own height, and the bars moved out
              from under the finger that had just tapped one. */}
          <View style={hero.chartMeta}>
            <Text style={hero.chartMetaText} numberOfLines={1}>
              {!active ? '' : active.settled > 0
                ? `WR ${((active.won / active.settled) * 100).toFixed(0)}% · ${active.settled} расч.`
                : 'Нет рассчитанных ставок'}
            </Text>
            <Text
              numberOfLines={1}
              style={[hero.chartMetaText, {
                color: delta === null || delta === 0 ? colors.textMuted : delta > 0 ? colors.won : colors.lost,
              }]}
            >
              {delta === null ? '' : `${delta > 0 ? '▲' : delta < 0 ? '▼' : '='} ${fmt(Math.abs(delta))} к пред. ${PREV_UNIT[granularity]}`}
            </Text>
          </View>
          <PnlBars
            buckets={buckets}
            width={width - 64}
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
    ...cardSurface,
    padding: SPACE.lg, marginHorizontal: SPACE.lg, marginBottom: SPACE.md,
  },
  label: { fontSize: SIZE.caption, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { ...numeric, fontSize: SIZE.display, fontWeight: '800', marginTop: SPACE.xs, marginBottom: SPACE.md },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaCell: { alignItems: 'center', flex: 1 },
  metaValue: { ...numeric, fontSize: SIZE.lead, fontWeight: '700', color: colors.textPrimary },
  metaLabel: { fontSize: SIZE.caption, color: colors.textMuted, marginTop: 2 },
  chart: { marginTop: SPACE.md },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: SPACE.xs },
  chartTitle: { fontSize: SIZE.caption, fontWeight: '700', color: colors.textSecondary },
  chartValue: { ...numeric, fontSize: SIZE.body, fontWeight: '700' },
  chartHint: { fontSize: SIZE.micro, color: colors.textMuted },
  // Fixed height so selecting a bar never moves the chart under the finger.
  chartMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', height: 14, marginBottom: SPACE.xs },
  chartMetaText: { ...numeric, flexShrink: 1, fontSize: SIZE.micro, color: colors.textMuted, fontWeight: '600' },
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
  label: { fontSize: SIZE.caption, color: colors.textMuted, marginBottom: SPACE.xs, lineHeight: 15, height: 30 }, // reserve 2 lines
  labelWithInfo: { paddingRight: SPACE.lg }, // keep clear of the "?" badge
  value: { fontSize: SIZE.title, fontWeight: '800', height: 26, textAlignVertical: 'center' },
  sub: { fontSize: SIZE.micro, color: colors.textMuted, marginTop: SPACE.xs, height: 13 }, // always reserved
  infoBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 16, height: 16, borderRadius: RADIUS.sm,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  infoBtnText: { fontSize: SIZE.micro, color: colors.textMuted, fontWeight: '700' },
});

function StreaksCard({ bets }: { bets: Bet[] }) {
  const s = useMemo(() => calcStreaks(bets), [bets]);
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
  const e = useMemo(() => calcExtremes(bets), [bets]);
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
  caption: { fontSize: SIZE.caption, color: colors.textMuted, marginTop: SPACE.sm, lineHeight: 16 },
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
            text: 'Точка отсчёта — безубыток: цена 2.50 означает шанс 40%, и если угадывать ровно с такой частотой, выходишь в ноль.\n\nПоэтому вопрос не «сколько я заработал», а «насколько результат отошёл от нуля по сравнению с тем, насколько он МОГ отойти случайно». Эта величина и есть σ (сигма).\n\nДо 1σ — обычный разброс. Больше 2σ — результат вряд ли объясняется одним везением: скорее всего, ты действительно ловишь цену (или систематически ошибаешься).\n\nОценка строгая к тебе: в кэфы зашита маржа букмекера, так что реальный ноль чуть ниже безубытка. Выйти в плюс по этой шкале — уже значит обыгрывать маржу.',
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
          <Text style={[luck.winsSwing, { color: swing >= 0 ? colors.won : colors.lost }]}>
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
    marginTop: SPACE.md, paddingTop: SPACE.sm, borderTopWidth: 1, borderTopColor: colors.border,
  },
  winsLabel: { fontSize: SIZE.caption, color: colors.textSecondary },
  winsValue: { ...numeric, fontSize: SIZE.body, fontWeight: '700', color: colors.textPrimary },
  // A nested Text gets its own resolved family, so it has to restate the
  // weight — inheritance from `winsValue` no longer reaches it.
  winsSwing: { ...numeric, fontSize: SIZE.body, fontWeight: '700' },
  verdict: { fontSize: SIZE.caption, color: colors.textSecondary, lineHeight: 17, marginTop: SPACE.sm },
  caption: { fontSize: SIZE.caption, color: colors.textMuted, marginTop: SPACE.sm, lineHeight: 16 },
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
  empty: { fontSize: SIZE.body, color: colors.textMuted },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACE.lg },
  topCell: { alignItems: 'center', flex: 1 },
  topHour: { fontSize: SIZE.body, fontWeight: '700', color: colors.textPrimary },
  topPnl: { fontSize: SIZE.caption, fontWeight: '700', marginTop: 3 },
  topCount: { fontSize: SIZE.micro, color: colors.textMuted, marginTop: 2 },
  donutRow: { flexDirection: 'row', alignItems: 'center' },
  centerValue: { fontSize: SIZE.title, fontWeight: '800', color: colors.textPrimary },
  centerLabel: { fontSize: SIZE.micro, color: colors.textMuted },
  legend: { flex: 1, marginLeft: SPACE.lg },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACE.xs },
  dot: { width: 10, height: 10, borderRadius: RADIUS.pill, marginRight: SPACE.sm },
  legendLabel: { fontSize: SIZE.caption, color: colors.textSecondary, flex: 1 },
  legendCount: { fontSize: SIZE.caption, color: colors.textMuted, fontWeight: '600' },
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
  hint: { fontSize: SIZE.caption, color: colors.textSecondary, lineHeight: 18 },
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
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACE.md },
  labelCol: { width: 90 },
  label: { fontSize: SIZE.body, color: colors.textPrimary, fontWeight: '500' },
  meta: { fontSize: SIZE.micro, color: colors.textMuted, marginTop: 1 },
  barCol: { flex: 1, height: 6, backgroundColor: colors.bgElevated, borderRadius: RADIUS.xs, marginHorizontal: SPACE.sm },
  bar: { height: 6, borderRadius: RADIUS.xs },
  valueCol: { width: 62, alignItems: 'flex-end' },
  pnl: { fontSize: SIZE.body, fontWeight: '700' },
  pnlSub: { fontSize: SIZE.micro, color: colors.textMuted },
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

// ── By sport: diverging money bars ───────────────────────────────────────────

/**
 * Sport gets its own shape rather than the shared `SliceRow` list.
 *
 * In that row the bar is drawn from |P&L| while the big number beside it is
 * ROI, and on real data the two contradict each other out loud: hockey
 * (+71.5%, 25 108 ₽) and esports (−3.6%, −25 019 ₽) come out the same length,
 * so the eye reads "these two are equal" while the number says one is twenty
 * times the other. Here the bar and the headline are the same quantity —
 * money — and it diverges around a zero axis, so the sign is structural rather
 * than carried by colour alone.
 *
 * Money is the headline and ROI the footnote, not the other way round: ROI on
 * 12 bets is mostly variance, while the rouble figure is what actually
 * happened. Share of turnover sits next to it because a 90% winrate over 12
 * bets and one over 206 are not the same claim.
 */
function SportBreakdown({ stats }: { stats: SliceStats[] }) {
  const fmt = useFormatMoney();
  const rows = useMemo(() => stats.filter((s) => s.count > 0), [stats]);
  const peak = useMemo(() => Math.max(...rows.map((s) => Math.abs(s.pnl)), 1), [rows]);
  const turnover = useMemo(() => rows.reduce((n, s) => n + s.totalStaked, 0), [rows]);
  if (rows.length === 0) return null;

  return (
    <Card title="По виду спорта" tone="warn">
      {rows.map((s) => {
        const up = s.pnl >= 0;
        // A sport that came out exactly even (all refunds, say) is neither a
        // win nor a loss, and "+0 ₽" in green would claim it was one.
        const tint = s.pnl > 0 ? colors.won : s.pnl < 0 ? colors.lost : colors.textMuted;
        // Half the track per side. A non-zero result keeps a visible stub:
        // a sport that lost a little must not read as one that never played.
        const w = s.pnl === 0 ? 0 : Math.max(1.5, (Math.abs(s.pnl) / peak) * 50);
        const share = turnover > 0 ? Math.round((s.totalStaked / turnover) * 100) : 0;
        return (
          <View key={s.label} style={sport.row}>
            <View style={sport.head}>
              <Text style={sport.name} numberOfLines={1}>{s.label}</Text>
              <Text style={[sport.money, { color: tint }]} numberOfLines={1}>
                {s.pnl > 0 ? '+' : ''}{fmt(s.pnl)}
              </Text>
            </View>
            <View style={sport.track}>
              <View
                style={[
                  sport.bar,
                  { backgroundColor: tint },
                  up ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` },
                ]}
              />
              {/* Drawn after the bar: a positive bar starts exactly on the axis
                  and would otherwise bury the one line the shape is read from. */}
              <View style={sport.axis} />
            </View>
            <View style={sport.metaRow}>
              <Text style={sport.meta} numberOfLines={1}>
                {s.count} ст · {s.winRate.toFixed(0)}% WR · {share}% оборота
              </Text>
              <Text style={[sport.roi, { color: tint }]}>ROI {formatPercent(s.roi)}</Text>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const sport = StyleSheet.create({
  row: { marginBottom: SPACE.lg },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  name: { flex: 1, fontSize: SIZE.body, fontWeight: '600', color: colors.textPrimary },
  money: { ...numeric, fontSize: SIZE.body, fontWeight: '700', marginLeft: SPACE.sm },
  track: {
    height: 10, marginTop: SPACE.sm, marginBottom: SPACE.xs,
    backgroundColor: colors.bgSunken, borderRadius: RADIUS.xs,
    justifyContent: 'center',
  },
  axis: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: colors.borderStrong },
  bar: { position: 'absolute', height: 10, borderRadius: RADIUS.xs },
  metaRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  meta: { flex: 1, fontSize: SIZE.micro, color: colors.textMuted },
  roi: { ...numeric, fontSize: SIZE.micro, fontWeight: '700', marginLeft: SPACE.sm },
});

// ── Screen ───────────────────────────────────────────────────────────────────

type APeriodFilter = '7d' | '30d' | 'all';
const A_PERIOD_OPTIONS: Array<{ key: APeriodFilter; label: string }> = [
  { key: '7d', label: '7 дней' },
  { key: '30d', label: '30 дней' },
  { key: 'all', label: 'Всё время' },
];

function AnalyticsContent() {
  const bets = useBetsStore((s) => s.bets);
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
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACE.xxl }}>
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
      {/* Promoted out of the collapsed section: which sport actually earns is
          a first-screen question, and the bars answer it without arithmetic. */}
      <SportBreakdown stats={extended.sport} />
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
  periodRow: { flexDirection: 'row', paddingHorizontal: SPACE.lg, gap: SPACE.sm, marginTop: SPACE.sm, marginBottom: SPACE.md },
  periodBtn: {
    minHeight: TOUCH, justifyContent: 'center',
    flex: 1, paddingVertical: SPACE.sm, borderRadius: RADIUS.sm, backgroundColor: colors.bgCard,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  periodBtnActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  periodText: { fontSize: SIZE.caption, fontWeight: '600', color: colors.textSecondary },
  periodTextActive: { color: '#fff' },
  extToggle: {
    minHeight: TOUCH,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: SPACE.lg, marginTop: SPACE.xs, marginBottom: SPACE.md, paddingVertical: SPACE.md, paddingHorizontal: SPACE.lg,
    backgroundColor: colors.bgElevated, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: alpha(colors.purple, 0.35),
  },
  extToggleText: { fontSize: SIZE.body, fontWeight: '700', color: colors.purpleText },
  extChevron: { fontSize: GLYPH.sm, color: colors.textMuted },
});
