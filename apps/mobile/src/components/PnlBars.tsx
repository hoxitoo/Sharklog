import React from 'react';
import { View, Text, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import Svg, { Rect, Line } from 'react-native-svg';
import type { PnlBucket } from '@sharklog/core';
import { colors, alpha } from '../theme/colors';

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
                fill={dim ? alpha(base, 0.3) : base}
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
  label: { fontSize: 9, color: colors.textMuted, textAlign: 'center' },
});
