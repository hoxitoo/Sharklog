import React from 'react';
import { View, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { AppText as Text } from './AppText';
import Svg, { Rect, Line } from 'react-native-svg';
import type { PnlBucket } from '@sharklog/core';
import { colors, alpha } from '../theme/colors';
import { RADIUS } from '../theme/layout';
import { SIZE } from '../theme/typography';

interface Props {
  buckets: PnlBucket[];
  width: number;
  height?: number;
  /** Index of the highlighted bucket, or null. */
  selected: number | null;
  onSelect: (index: number | null) => void;
  /** Tick label under a bar; return '' to leave it out. */
  labelFor: (bucket: PnlBucket, index: number) => string;
}

const LABEL_H = 16;

/**
 * Net P&L per bucket, above or below a zero line.
 *
 * This replaced a cumulative line: on a cumulative curve a winning day still
 * points downhill whenever it follows a bigger losing one, which reads as the
 * chart contradicting the result. A bar per period only ever states what that
 * period earned, so a green streak looks green.
 */
export function PnlBars({ buckets, width, height = 120, selected, onSelect, labelFor }: Props) {
  if (buckets.length === 0) return null;

  const plotH = height - LABEL_H;
  const peak = Math.max(...buckets.map((b) => Math.abs(b.pnl)), 1);
  const zeroY = plotH / 2;
  const slot = width / buckets.length;
  const barW = Math.max(2, Math.min(22, slot * 0.62));

  function handleTouch(x: number) {
    const idx = Math.max(0, Math.min(buckets.length - 1, Math.floor(x / slot)));
    onSelect(idx === selected ? null : idx);
  }

  return (
    <TouchableWithoutFeedback onPress={(e) => handleTouch(e.nativeEvent.locationX)}>
      <View style={{ width, height }}>
        <Svg width={width} height={height}>
          {/* The column band, drawn first so bars and axis sit on top of it.
              Dimming the other bars alone was too quiet a signal — on a month
              that earned little there is barely any bar to dim, and nothing
              said which one was picked except a bolder tick label. */}
          {selected !== null && (
            <Rect
              x={selected * slot + 1}
              y={0}
              width={slot - 2}
              height={height}
              rx={RADIUS.xs}
              fill={alpha(colors.textPrimary, 0.07)}
              stroke={alpha(colors.textPrimary, 0.18)}
              strokeWidth={1}
            />
          )}
          <Line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke={colors.border} strokeWidth={1} />
          {buckets.map((b, i) => {
            const up = b.pnl >= 0;
            const base = up ? colors.won : colors.lost;
            // Every non-zero bucket keeps a visible stub, otherwise a small day
            // reads as "no bets" instead of "a little".
            const h = b.pnl === 0 ? 0 : Math.max(2, (Math.abs(b.pnl) / peak) * (zeroY - 4));
            const dim = selected !== null && selected !== i;
            return (
              <Rect
                key={b.start}
                x={i * slot + (slot - barW) / 2}
                y={up ? zeroY - h : zeroY}
                width={barW}
                height={h}
                rx={Math.min(3, barW / 2)}
                // No outline on the selected bar itself: a stub is 2px tall and
                // a 1px rim would repaint it white. The band behind it says
                // which column is picked, and it says so at any bar height.
                fill={dim ? alpha(base, 0.25) : base}
              />
            );
          })}
        </Svg>

        <View style={[bars.labels, { width }]}>
          {buckets.map((b, i) => {
            const text = labelFor(b, i);
            return (
              <Text
                key={b.start}
                numberOfLines={1}
                style={[
                  bars.label,
                  { width: slot },
                  selected === i ? { color: colors.textPrimary, fontWeight: '700' } : null,
                ]}
              >
                {text}
              </Text>
            );
          })}
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const bars = StyleSheet.create({
  labels: { position: 'absolute', bottom: 0, left: 0, flexDirection: 'row' },
  label: { fontSize: SIZE.micro, color: colors.textMuted, textAlign: 'center' },
});
