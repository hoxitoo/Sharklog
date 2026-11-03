import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Polyline, Line, Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { daysBetween, type Goal, type GoalProgress } from '@sharklog/core';
import { AppText as Text } from '../../components/AppText';
import { colors } from '../../theme/colors';
import { SERIES } from '../../theme/chartColors';
import { themedStyles } from '../../theme/themed';
import { SPACE, RADIUS } from '../../theme/layout';
import { SIZE } from '../../theme/typography';
import { dayLabel } from '../../utils/goalText';

const HEIGHT = 120;
const PAD = 6;
/** Enough points for a phone's width; years of daily values would only cost layout. */
const MAX_POINTS = 240;

/**
 * The measure day by day, against the straight line the deadline asks for.
 * Above the dashed line — ahead of the plan; below — behind it. No plan line
 * without a deadline: there is nothing to be on time for.
 */
export function GoalChart({ goal, p }: { goal: Goal; p: GoalProgress }) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const series = p.series;
  if (series.length < 2) return null;

  const from = goal.startDate < series[0]!.date ? goal.startDate : series[0]!.date;
  const last = series[series.length - 1]!.date;
  const to = goal.deadline && goal.deadline > last ? goal.deadline : last;
  const span = Math.max(1, daysBetween(from, to));

  const values = series.map((s) => s.value);
  // A bank is a level far above zero: zero on the axis would flatten it.
  const floor = goal.kind === 'bank' ? Infinity : 0;
  const yMin = Math.min(floor, p.startValue, ...values);
  const yMax = Math.max(p.target, p.startValue, ...values);
  const yRange = Math.max(1, yMax - yMin);

  const x = (date: string) => PAD + (daysBetween(from, date) / span) * (width - PAD * 2);
  const y = (v: number) => PAD + (1 - (v - yMin) / yRange) * (HEIGHT - PAD * 2);

  const step = Math.max(1, Math.ceil(series.length / MAX_POINTS));
  const picked = series.filter((_, i) => i % step === 0 || i === series.length - 1);
  const points = picked.map((s) => `${x(s.date).toFixed(1)},${y(s.value).toFixed(1)}`).join(' ');
  const line = goal.kind === 'bank' ? SERIES.balance : goal.kind === 'withdraw' ? SERIES.withdrawal : SERIES.pnl;
  const end = series[series.length - 1]!;

  return (
    <View>
      <View style={chart.box} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            <Line
              x1={PAD} y1={y(p.target)} x2={width - PAD} y2={y(p.target)}
              stroke={colors.borderStrong} strokeWidth={1} strokeDasharray="2 4"
            />
            {goal.deadline ? (
              <Line
                x1={x(goal.startDate)} y1={y(p.startValue)} x2={x(goal.deadline)} y2={y(p.target)}
                stroke={colors.textMuted} strokeWidth={1.5} strokeDasharray="6 5"
              />
            ) : null}
            <Polyline points={points} fill="none" stroke={line} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            <Circle cx={x(end.date)} cy={y(end.value)} r={4} fill={line} />
          </Svg>
        ) : null}
      </View>
      <View style={chart.axis}>
        <Text style={chart.axisText}>{dayLabel(from)}</Text>
        <View style={chart.legend}>
          <View style={[chart.swatch, { backgroundColor: line }]} />
          <Text style={chart.axisText}>{t('goals.chartActual')}</Text>
          {goal.deadline ? (
            <>
              <View style={[chart.swatch, chart.dashed]} />
              <Text style={chart.axisText}>{t('goals.chartPlan')}</Text>
            </>
          ) : null}
        </View>
        <Text style={chart.axisText}>{dayLabel(to)}</Text>
      </View>
    </View>
  );
}

const chart = themedStyles(() => ({
  box: { height: HEIGHT, marginTop: SPACE.md, backgroundColor: colors.bgSunken, borderRadius: RADIUS.sm },
  axis: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACE.xs },
  axisText: { fontSize: SIZE.micro, color: colors.textMuted },
  legend: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  swatch: { width: 12, height: 3, borderRadius: RADIUS.pill },
  dashed: { backgroundColor: colors.textMuted, opacity: 0.6 },
}));
