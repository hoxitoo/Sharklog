import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  onFinish: () => void;
}

const ND = { useNativeDriver: true } as const;

// 6 rows × 4 coefficients — wave sweeps top → bottom
const COEFF_ROWS = [
  ['1.85', '2.40', '3.10', '1.65'],
  ['2.75', '1.55', '4.20', '2.10'],
  ['1.90', '3.50', '1.72', '2.30'],
  ['2.60', '1.48', '3.80', '1.95'],
  ['1.75', '2.85', '1.60', '3.20'],
  ['2.15', '4.50', '1.88', '2.45'],
];

// Horizontal positions for each of 4 coefficients in a row
const COL_X = [8, 28, 56, 78]; // percent of screen width approximated via left/right

export function AnimatedSplash({ onFinish }: Props) {
  const line1Scale    = useRef(new Animated.Value(0)).current;
  const line2Scale    = useRef(new Animated.Value(0)).current;
  const line3Scale    = useRef(new Animated.Value(0)).current;
  const textOpacity   = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(14)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const exitOpacity   = useRef(new Animated.Value(1)).current;

  // Per-row animated values for the wave effect
  const rowOp0 = useRef(new Animated.Value(0)).current;
  const rowOp1 = useRef(new Animated.Value(0)).current;
  const rowOp2 = useRef(new Animated.Value(0)).current;
  const rowOp3 = useRef(new Animated.Value(0)).current;
  const rowOp4 = useRef(new Animated.Value(0)).current;
  const rowOp5 = useRef(new Animated.Value(0)).current;
  const rowOps = [rowOp0, rowOp1, rowOp2, rowOp3, rowOp4, rowOp5];

  useEffect(() => {
    const WAVE_STAGGER = 380; // ms between each row lighting up
    const ROW_RISE = 260;     // ms to reach peak opacity
    const ROW_DIM  = 360;     // ms to dim to resting

    // Wave: each row brightens then dims as next row lights up
    const waveAnimations = rowOps.map((op, i) =>
      Animated.sequence([
        Animated.delay(i * WAVE_STAGGER),
        Animated.timing(op, { toValue: 1, duration: ROW_RISE, easing: Easing.out(Easing.quad), ...ND }),
        Animated.timing(op, { toValue: 0, duration: ROW_DIM, easing: Easing.in(Easing.quad), ...ND }),
      ])
    );

    Animated.parallel([
      // Wave loops once
      Animated.parallel(waveAnimations),

      // Main sequence: lines, text, tagline, hold, exit
      Animated.sequence([
        Animated.timing(line1Scale, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), ...ND }),
        Animated.timing(line2Scale, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), ...ND }),
        Animated.timing(line3Scale, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), ...ND }),
        Animated.delay(160),
        Animated.parallel([
          Animated.timing(textOpacity,   { toValue: 1, duration: 380, ...ND }),
          Animated.timing(textTranslate, { toValue: 0, duration: 380, ...ND }),
        ]),
        Animated.delay(120),
        Animated.timing(taglineOpacity, { toValue: 1, duration: 280, ...ND }),
        Animated.delay(600),
        Animated.timing(exitOpacity, { toValue: 0, duration: 360, ...ND }),
      ]),
    ]).start(() => onFinish());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Interpolate each row: peak opacity 0.22, resting 0.07
  const rowInterps = rowOps.map((op) =>
    op.interpolate({ inputRange: [0, 1], outputRange: [0.07, 0.22] })
  );

  const ROW_TOP_START = 32;
  const ROW_GAP = 38;

  return (
    <Animated.View style={[s.container, { opacity: exitOpacity }]}>
      {/* Wave coefficients — 6 rows × 4 values */}
      {COEFF_ROWS.map((row, ri) => (
        <Animated.View
          key={ri}
          style={[s.coeffRow, { top: ROW_TOP_START + ri * ROW_GAP, opacity: rowInterps[ri] }]}
        >
          {row.map((v, ci) => (
            <Text key={ci} style={[s.coeff, { left: `${COL_X[ci]}%` as any }]}>
              {v}
            </Text>
          ))}
        </Animated.View>
      ))}

      <View style={s.linesWrap}>
        <Animated.View style={[s.line, { width: 120, transform: [{ scaleX: line1Scale }] }]} />
        <Animated.View style={[s.line, { width: 80,  transform: [{ scaleX: line2Scale }] }]} />
        <Animated.View style={[s.line, { width: 50,  transform: [{ scaleX: line3Scale }] }]} />
      </View>

      <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: textTranslate }] }}>
        <Text style={s.name}>SharkLog</Text>
      </Animated.View>
      <Animated.Text style={[s.tagline, { opacity: taglineOpacity }]}>
        Трекер ставок
      </Animated.Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coeffRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
  },
  coeff: {
    position: 'absolute',
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: 0.3,
  },
  linesWrap: {
    alignItems: 'center',
    gap: 7,
    marginBottom: 28,
  },
  line: {
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },
  name: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -1,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 13,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 6,
    textAlign: 'center',
  },
});
