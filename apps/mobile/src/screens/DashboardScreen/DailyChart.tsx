import React, { useMemo } from 'react';
import { SPACE, RADIUS } from '../../theme/layout';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import Svg, { Polyline, Circle, Rect } from 'react-native-svg';
import type { DayStats } from '@sharklog/core';
import { colors } from '../../theme/colors';
import { SERIES } from '../../theme/chartColors';
import { SIZE } from '../../theme/typography';

export { SERIES } from '../../theme/chartColors';

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
}

function dayLabel(date: string): string {
  const parts = date.split('-');
  return String(Number(parts[2] ?? 0));
}

export function DailyChart({ days, width, height, toggles, selected, onSelect, labelEvery }: Props) {
  const half = Math.floor((height - 1) / 2);
  const colW = days.length > 0 ? width / days.length : width;
  const step = labelEvery ?? Math.max(1, Math.ceil(days.length / 12));

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

  return (
    <View style={{ width }}>
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

      {/* X labels */}
      <View style={{ flexDirection: 'row', width, marginTop: SPACE.xs }}>
        {days.map((d, i) => (
          <View key={`lbl-${d.date}`} style={{ width: colW, alignItems: 'center' }}>
            {(i % step === 0 || selected === i) && (
              <Text style={[ch.xLabel, selected === i && ch.xLabelSel]} numberOfLines={1}>
                {dayLabel(d.date)}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const ch = StyleSheet.create({
  colSelected: { backgroundColor: colors.bgElevated, borderRadius: RADIUS.sm },
  xLabel: { fontSize: SIZE.micro, color: colors.textMuted },
  xLabelSel: { color: colors.textPrimary, fontWeight: '700' },
});

/** Small colour-key row shared by the compact and expanded views. */
export function ChartLegend({ toggles }: { toggles: ChartToggles }) {
  const items: Array<{ c: string; t: string }> = [
    { c: SERIES.win, t: 'Выигрыш' },
    { c: SERIES.loss, t: 'Проигрыш' },
    ...(toggles.pnl ? [{ c: SERIES.pnl, t: 'P&L' }] : []),
    ...(toggles.balance ? [{ c: SERIES.balance, t: 'Баланс' }] : []),
    ...(toggles.cash ? [
      { c: SERIES.deposit, t: 'Депозит' },
      { c: SERIES.withdrawal, t: 'Вывод' },
    ] : []),
  ];
  return (
    <View style={lg.wrap}>
      {items.map((it) => (
        <View key={it.t} style={lg.item}>
          <View style={[lg.dot, { backgroundColor: it.c }]} />
          <Text style={lg.text}>{it.t}</Text>
        </View>
      ))}
    </View>
  );
}

const lg = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md, marginTop: SPACE.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  dot: { width: 8, height: 8, borderRadius: RADIUS.xs },
  text: { fontSize: SIZE.micro, color: colors.textMuted },
});
