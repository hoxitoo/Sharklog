import React, { useMemo } from 'react';
import { SPACE, RADIUS } from '../../theme/layout';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import Svg, { Polyline, Circle, Rect } from 'react-native-svg';
import type { DayStats } from '@sharklog/core';
import { colors } from '../../theme/colors';
import { SERIES } from '../../theme/chartColors';
import { SIZE } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { themedStyles } from '../../theme/themed';

export { SERIES } from '../../theme/chartColors';

/**
 * The spotlight veil: black at this strength over everything but the chosen
 * day. Black on every theme — the light one has to darken too, not wash out.
 * A page under the veil is the same colour as `mix('#000000', bg, SCRIM_ALPHA)`,
 * which is how the expanded view darkens the gaps between veiled blocks.
 */
export const SCRIM_ALPHA = 0.55;
export const SCRIM = `rgba(0,0,0,${SCRIM_ALPHA})`;
const FOCUS_MIN = 16;

export interface ChartToggles {
  pnl: boolean;
  balance: boolean;
  cash: boolean; // deposit / withdrawal markers
}

interface Props {
  days: DayStats[];
  width: number;
  height: number;          // bars area height (zero line centred)
  toggles: ChartToggles;
  selected: number | null; // index into `days`
  onSelect: (i: number) => void;
  labelEvery?: number;     // show an x label every N columns (default: auto)
  /**
   * Veil every column but the selected one and frame it. The chart then sits
   * on an opaque page-coloured ground, so the veil darkens it exactly as much
   * as the darkened page around it.
   */
  spotlight?: boolean;
  /** Label days `DD.MM`, not just the day: across months a bare "7" says little. */
  fullDates?: boolean;
}

function dayLabel(date: string): string {
  const parts = date.split('-');
  return String(Number(parts[2] ?? 0));
}

function monthDay(date: string): string {
  const [, m, d] = date.split('-');
  return `${d}.${m}`;
}

const LABEL_ROW = 16;

export function DailyChart({ days, width, height, toggles, selected, onSelect, labelEvery, spotlight, fullDates }: Props) {
  const half = Math.floor((height - 1) / 2);
  const colW = days.length > 0 ? width / days.length : width;
  const step = labelEvery ?? Math.max(1, Math.ceil(days.length / 12));
  const labelW = fullDates ? 40 : 24;

  // Bars: symmetric scale so wins (up) and losses (down) stay comparable.
  const maxAbs = useMemo(
    () => Math.max(...days.map((d) => Math.max(d.wonAmount, d.lostAmount)), 1),
    [days],
  );

  // Lines live on their own scale (money totals are far larger than a single day's swing).
  const linePoints = useMemo(() => {
    const series: number[][] = [];
    if (toggles.pnl) series.push(days.map((d) => d.cumPnl));
    if (toggles.balance) series.push(days.map((d) => d.balance));
    if (series.length === 0) return null;

    const flat = series.flat();
    let lo = Math.min(...flat);
    let hi = Math.max(...flat);
    if (hi === lo) { hi = lo + 1; lo = lo - 1; }
    const span = hi - lo;
    const y = (v: number) => ((hi - v) / span) * (height - 6) + 3;
    const x = (i: number) => i * colW + colW / 2;

    return {
      pnl: toggles.pnl ? days.map((d, i) => `${x(i)},${y(d.cumPnl)}`).join(' ') : null,
      balance: toggles.balance ? days.map((d, i) => `${x(i)},${y(d.balance)}`).join(' ') : null,
      lastPnl: toggles.pnl && days.length > 0
        ? { x: x(days.length - 1), y: y(days[days.length - 1]!.cumPnl) } : null,
      lastBalance: toggles.balance && days.length > 0
        ? { x: x(days.length - 1), y: y(days[days.length - 1]!.balance) } : null,
    };
  }, [days, toggles.pnl, toggles.balance, colW, height]);

  // Centred on the day, wider than it, kept inside the chart.
  const centred = (i: number, w: number) => Math.min(Math.max(i * colW + colW / 2 - w / 2, 0), Math.max(width - w, 0));

  const spot = spotlight && selected != null && selected < days.length ? selected : null;
  // A year of days leaves ~3 px per column: a frame that narrow is a hairline,
  // not a highlight. The frame never shrinks below FOCUS_MIN; under it only the
  // day's own column stays lit, so the neighbours inside the frame do not pass
  // for part of it. In the label row the hole is the chosen day's label.
  const frameW = Math.min(width, Math.max(colW, FOCUS_MIN));

  return (
    <View style={[{ width }, spotlight && ch.ground]}>
      <View style={{ height, width, position: 'relative' }}>
        {/* Columns (tappable) */}
        <View style={{ flexDirection: 'row', height }}>
          {days.map((d, i) => {
            const isSel = selected === i;
            const winH = d.wonAmount > 0 ? Math.max((d.wonAmount / maxAbs) * half, 2) : 0;
            const lossH = d.lostAmount > 0 ? Math.max((d.lostAmount / maxAbs) * half, 2) : 0;
            const barW = Math.max(Math.min(colW - 4, 22), 3);
            return (
              <TouchableOpacity
                key={d.date}
                style={[{ width: colW }, isSel && ch.colSelected]}
                onPress={() => onSelect(i)}
                activeOpacity={0.7}
              >
                <View style={{ height: half, justifyContent: 'flex-end', alignItems: 'center' }}>
                  {winH > 0 && (
                    <View style={{
                      width: barW, height: winH, borderTopLeftRadius: RADIUS.xs, borderTopRightRadius: RADIUS.xs,
                      backgroundColor: isSel ? SERIES.win : SERIES.win + 'CC',
                    }} />
                  )}
                </View>
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <View style={{ height: half, justifyContent: 'flex-start', alignItems: 'center' }}>
                  {lossH > 0 && (
                    <View style={{
                      width: barW, height: lossH, borderBottomLeftRadius: RADIUS.xs, borderBottomRightRadius: RADIUS.xs,
                      backgroundColor: isSel ? SERIES.loss : SERIES.loss + 'CC',
                    }} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Overlay: cumulative lines + cash markers */}
        <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
          {toggles.cash && days.map((d, i) => {
            if (d.deposits === 0 && d.withdrawals === 0) return null;
            const cx = i * colW + colW / 2;
            return (
              <React.Fragment key={`cash-${d.date}`}>
                {d.deposits > 0 && (
                  <Rect x={cx - 3} y={2} width={6} height={6} rx={1} fill={SERIES.deposit} />
                )}
                {d.withdrawals > 0 && (
                  <Rect x={cx - 3} y={height - 8} width={6} height={6} rx={1} fill={SERIES.withdrawal} />
                )}
              </React.Fragment>
            );
          })}
          {linePoints?.balance && (
            <Polyline points={linePoints.balance} fill="none" stroke={SERIES.balance} strokeWidth={2} />
          )}
          {linePoints?.pnl && (
            <Polyline points={linePoints.pnl} fill="none" stroke={SERIES.pnl} strokeWidth={2} />
          )}
          {linePoints?.lastBalance && (
            <Circle cx={linePoints.lastBalance.x} cy={linePoints.lastBalance.y} r={3} fill={SERIES.balance} />
          )}
          {linePoints?.lastPnl && (
            <Circle cx={linePoints.lastPnl.x} cy={linePoints.lastPnl.y} r={3} fill={SERIES.pnl} />
          )}
        </Svg>
      </View>

      {/* X labels. Each is centred on its day but wider than it: a year of
          days leaves ~3 px per column, and a label boxed into its own column
          was clipped to a sliver. A label that would touch the chosen day's
          gives way to it. */}
      <View style={{ width, height: LABEL_ROW, marginTop: SPACE.xs }}>
        {days.map((d, i) => {
          const isSel = selected === i;
          if (!isSel) {
            if (i % step !== 0) return null;
            if (selected != null && Math.abs(i - selected) * colW < labelW) return null;
          }
          // In the spotlight the chosen label is drawn above the veil, below.
          if (isSel && spot != null) return null;
          return (
            <View key={`lbl-${d.date}`} style={[ch.xLabelBox, { left: centred(i, labelW), width: labelW }]}>
              <Text style={[ch.xLabel, isSel && ch.xLabelSel]} numberOfLines={1}>
                {fullDates ? monthDay(d.date) : dayLabel(d.date)}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Spotlight: veil both sides of the chosen column (labels included) and
          frame it. The veils take no touches — a dimmed day is still a tap
          away from being the chosen one. */}
      {spot != null && (
        <>
          <View pointerEvents="none" style={[ch.veil, { top: 0, height, left: 0, width: spot * colW }]} />
          <View pointerEvents="none" style={[ch.veil, { top: 0, height, left: (spot + 1) * colW, right: 0 }]} />
          <View pointerEvents="none" style={[ch.veil, { top: height, bottom: 0, left: 0, right: 0 }]} />
          <View pointerEvents="none" style={[ch.focus, { top: 0, height, left: centred(spot, frameW), width: frameW }]} />
          <View
            pointerEvents="none"
            style={[ch.xLabelBox, { top: height + SPACE.xs, left: centred(spot, labelW), width: labelW }]}
          >
            <View style={ch.xLabelPill}>
              <Text style={[ch.xLabel, ch.xLabelSel, ch.xLabelSpot]} numberOfLines={1}>
                {fullDates ? monthDay(days[spot]!.date) : dayLabel(days[spot]!.date)}
              </Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const ch = themedStyles(() => ({
  ground: { backgroundColor: colors.bg },
  veil: { position: 'absolute', backgroundColor: SCRIM },
  focus: {
    position: 'absolute',
    borderWidth: 2, borderColor: colors.purpleText, borderRadius: RADIUS.sm,
  },
  colSelected: { backgroundColor: colors.bgElevated, borderRadius: RADIUS.sm },
  xLabelBox: { position: 'absolute', top: 0, alignItems: 'center' },
  xLabel: { fontSize: SIZE.micro, color: colors.textMuted },
  xLabelSel: { color: colors.textPrimary, fontWeight: '700' },
  // The chosen day's date in the spotlight: the same purple tag as in the bar above.
  xLabelPill: { backgroundColor: colors.purple, borderRadius: RADIUS.xs, paddingHorizontal: 2 },
  xLabelSpot: { color: '#fff' },
}));

/** Small colour-key row shared by the compact and expanded views. */
export function ChartLegend({ toggles }: { toggles: ChartToggles }) {
  const { t } = useTranslation();
  // `label`, not `t`: the field used to be called `t`, which now names the translator.
  const items: Array<{ c: string; label: string }> = [
    { c: SERIES.win, label: t('dashboard.won') },
    { c: SERIES.loss, label: t('dashboard.lost') },
    ...(toggles.pnl ? [{ c: SERIES.pnl, label: 'P&L' }] : []),
    ...(toggles.balance ? [{ c: SERIES.balance, label: t('dashboard.balance') }] : []),
    ...(toggles.cash ? [
      { c: SERIES.deposit, label: t('dashboard.deposit') },
      { c: SERIES.withdrawal, label: t('dashboard.withdrawal') },
    ] : []),
  ];
  return (
    <View style={lg.wrap}>
      {items.map((it) => (
        <View key={it.label} style={lg.item}>
          <View style={[lg.dot, { backgroundColor: it.c }]} />
          <Text style={lg.text}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

const lg = themedStyles(() => ({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md, marginTop: SPACE.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  dot: { width: 8, height: 8, borderRadius: RADIUS.xs },
  text: { fontSize: SIZE.micro, color: colors.textMuted },
}));
