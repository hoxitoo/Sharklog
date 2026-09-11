import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';
import { AppText as Text } from './AppText';
import Svg, { Polyline, Polygon, Line, Circle } from 'react-native-svg';
import type { DayStats } from '@sharklog/core';
import { colors } from '../theme/colors';
import { SERIES } from '../theme/chartColors';
import { chartScale, formatChartYLabel, pickIndex, PLOT_INSET as R } from '../utils/chartScale';
import { numeric, SIZE } from '../theme/typography';
import { SPACE, RADIUS } from '../theme/layout';
import { useFormatMoney } from '../utils/useFormatMoney';
import { haptic } from '../utils/haptics';

interface Props {
  days: DayStats[];
  width: number;
  height: number;
  color?: string;
}

const GUTTER = 46; // room for Y-axis labels

/** `2026-09-11` → `11.09`. */
function dayLabel(date: string): string {
  const [, m, d] = date.split('-');
  return `${d}.${m}`;
}

/**
 * Bank balance over time, aggregated per DAY (not per bet), so the line reads as a
 * trend instead of a spike storm. Deposits/withdrawals are marked directly on the
 * line — gifted-charts' `customDataPoint` is swallowed by `hideDataPoints`, which is
 * why those markers never showed before.
 */
export function BalanceChart({ days, width, height, color = SERIES.balance }: Props) {
  const plotW = Math.max(width - GUTTER, 40);
  const fmt = useFormatMoney();
  const [sel, setSel] = useState<number | null>(null);
  const [pillW, setPillW] = useState(0);

  // A touch that leaves the plot must keep reading the plot's own x. Android
  // recomputes `locationX` against whatever view is under the finger on every
  // move, so dragging off the left edge into the Y-axis gutter jumps the
  // reading several days FORWARD. `pageX` minus the origin captured at
  // touch-down (where locationX is still trustworthy) is stable for the whole
  // gesture. iOS does not have this problem, so it will not show in a sim.
  const originX = useRef(0);
  const selRef = useRef<number | null>(null);

  // Written in an effect, not during render: a ref assignment in render is a
  // side effect React is allowed to throw away. Effects run before any touch
  // can arrive, so the handler is never stale.
  const pick = useRef<(x: number) => void>(() => {});
  useEffect(() => {
    pick.current = (x: number) => {
      if (days.length < 2) return;
      const i = pickIndex(x, plotW, days.length);
      if (selRef.current === i) return;
      // Outside the state updater: React may re-run an updater when rebasing,
      // and a haptic is not something to fire twice.
      selRef.current = i;
      haptic.selection();
      setSel(i);
    };
  });

  // The series can shift under a held selection — deleting the oldest
  // transaction moves every day one slot left — and a marker the user never
  // placed would keep pointing at a different day.
  useEffect(() => {
    selRef.current = null;
    setSel(null);
  }, [days]);

  const scrub = useRef(
    PanResponder.create({
      // Claim on touch-down so a plain tap reads a value.
      onStartShouldSetPanResponder: () => true,
      // Android only: without this, becoming the JS responder calls
      // requestDisallowInterceptTouchEvent(true) on every ancestor, and the
      // enclosing ScrollView never sees the gesture — the chart becomes a
      // 150pt band you cannot scroll past. `onPanResponderTerminationRequest`
      // does NOT cover this: Android cancels the responder outright rather
      // than asking, so it is consulted only on an iOS-style JS handover.
      onShouldBlockNativeResponder: () => false,
      onPanResponderTerminationRequest: () => true,
      onPanResponderGrant: (e) => {
        const { pageX, locationX } = e.nativeEvent;
        originX.current = pageX - locationX;
        pick.current(locationX);
      },
      onPanResponderMove: (e) => pick.current(e.nativeEvent.pageX - originX.current),
    }),
  ).current;

  const geom = useMemo(() => {
    if (days.length < 2) return null;
    const vals = days.map((d) => d.balance / 100); // rubles for nice tick rounding
    const scale = chartScale(vals, 4);
    const top = scale.maxValue;
    const bottom = scale.sectionsBelow > 0 ? scale.mostNegativeValue : 0;
    const span = top - bottom || 1;

    const y = (rub: number) => ((top - rub) / span) * height;
    const x = (i: number) => R + (i / (days.length - 1)) * Math.max(plotW - 2 * R, 1);

    const pts = days.map((d, i) => `${x(i)},${y(d.balance / 100)}`).join(' ');
    const baselineY = y(Math.max(bottom, 0));
    const area = `${x(0)},${baselineY} ${pts} ${x(days.length - 1)},${baselineY}`;

    const ticks: Array<{ v: number; y: number }> = [];
    for (let v = bottom; v <= top + 0.0001; v += scale.stepValue) {
      ticks.push({ v, y: y(v) });
    }

    const markers = days
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => d.deposits > 0 || d.withdrawals > 0)
      .map(({ d, i }) => ({
        key: d.date,
        cx: x(i),
        cy: y(d.balance / 100),
        // A day can hold both; deposit wins the dot, withdrawal gets a ring.
        fill: d.deposits > 0 ? SERIES.deposit : SERIES.withdrawal,
        both: d.deposits > 0 && d.withdrawals > 0,
      }));

    return {
      pts, area, ticks, markers, x, y,
      zeroY: bottom < 0 ? y(0) : null,
      lastX: x(days.length - 1),
      lastY: y(days[days.length - 1]!.balance / 100),
    };
  }, [days, plotW, height]);

  // Clamped so the pill never hangs off either edge of the plot.
  const active = sel != null ? days[sel] : undefined;
  const activeX = geom && sel != null ? geom.x(sel) : 0;
  const activeY = geom && active ? geom.y(active.balance / 100) : 0;
  const pillLeft = Math.min(Math.max(activeX - pillW / 2, 0), Math.max(plotW - pillW, 0));

  if (!geom) {
    return (
      <View style={[bc.empty, { width, height }]}>
        <Text style={bc.emptyText}>Мало данных для графика</Text>
      </View>
    );
  }

  return (
    <View style={{ width, height }}>
      {/* Y-axis labels */}
      <View style={{ position: 'absolute', left: 0, top: 0, width: GUTTER - 6, height }}>
        {geom.ticks.map((t) => (
          <Text
            key={t.v}
            style={[bc.yLabel, { top: Math.min(Math.max(t.y - 6, 0), height - 12) }]}
            numberOfLines={1}
          >
            {formatChartYLabel(String(t.v))}
          </Text>
        ))}
      </View>

      <View style={{ position: 'absolute', left: GUTTER, top: 0 }} {...scrub.panHandlers}>
        <Svg width={plotW} height={height}>
          {geom.ticks.map((t) => (
            <Line
              key={`g-${t.v}`}
              x1={0} y1={t.y} x2={plotW} y2={t.y}
              stroke={colors.border} strokeWidth={1} opacity={0.5}
            />
          ))}
          {geom.zeroY != null && (
            <Line x1={0} y1={geom.zeroY} x2={plotW} y2={geom.zeroY} stroke={colors.border} strokeWidth={1.5} />
          )}
          <Polygon points={geom.area} fill={color} opacity={0.13} />
          <Polyline points={geom.pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
          {geom.markers.map((m) => (
            <React.Fragment key={m.key}>
              {m.both && <Circle cx={m.cx} cy={m.cy} r={6} fill="none" stroke={SERIES.withdrawal} strokeWidth={1.5} />}
              <Circle cx={m.cx} cy={m.cy} r={3.5} fill={m.fill} stroke={colors.bgCard} strokeWidth={1} />
            </React.Fragment>
          ))}
          <Circle cx={geom.lastX} cy={geom.lastY} r={3.5} fill={color} />

          {active && (
            <>
              <Line x1={activeX} y1={0} x2={activeX} y2={height} stroke={colors.borderStrong} strokeWidth={1} />
              <Circle cx={activeX} cy={activeY} r={5} fill={color} stroke={colors.bgCard} strokeWidth={2} />
            </>
          )}
        </Svg>

        {active && (
          <View
            style={[bc.pill, { left: pillLeft, opacity: pillW > 0 ? 1 : 0 }]}
            onLayout={(e) => setPillW(e.nativeEvent.layout.width)}
            pointerEvents="none"
          >
            <Text style={bc.pillDate}>{dayLabel(active.date)}</Text>
            <Text style={[bc.pillValue, { color: active.balance >= 0 ? colors.textPrimary : colors.lost }]}>
              {fmt(active.balance)}
            </Text>
            {active.deposits > 0 && (
              <Text style={[bc.pillFlow, { color: SERIES.deposit }]}>+{fmt(active.deposits)}</Text>
            )}
            {active.withdrawals > 0 && (
              <Text style={[bc.pillFlow, { color: SERIES.withdrawal }]}>−{fmt(active.withdrawals)}</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const bc = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: SIZE.caption, color: colors.textMuted },
  yLabel: { position: 'absolute', right: 0, fontSize: SIZE.micro, color: colors.textMuted, textAlign: 'right' },
  pill: {
    position: 'absolute', top: 0,
    paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xs,
    backgroundColor: colors.bgElevated,
    borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: colors.borderStrong,
    alignItems: 'center',
  },
  pillDate: { fontSize: SIZE.micro, color: colors.textMuted },
  pillValue: { ...numeric, fontSize: SIZE.caption, fontWeight: '700' },
  pillFlow: { ...numeric, fontSize: SIZE.micro, fontWeight: '700' },
});
