import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { AppText as Text } from './AppText';
import { FONTS } from '../theme/typography';
import { colors } from '../theme/colors';

interface Props {
  onFinish: () => void;
}

const ND = { useNativeDriver: true } as const;

// 12 rows × 4 coefficients — wave sweeps top → bottom across the FULL screen
const COEFF_ROWS = [
  ['1.85', '2.40', '3.10', '1.65'],
  ['2.75', '1.55', '4.20', '2.10'],
  ['1.90', '3.50', '1.72', '2.30'],
  ['2.60', '1.48', '3.80', '1.95'],
  ['1.75', '2.85', '1.60', '3.20'],
  ['2.15', '4.50', '1.88', '2.45'],
  ['3.40', '1.62', '2.05', '1.78'],
  ['1.52', '2.95', '1.70', '4.10'],
  ['2.25', '1.44', '3.60', '2.80'],
  ['1.98', '2.55', '1.58', '3.05'],
  ['2.70', '1.82', '2.35', '1.50'],
  ['1.68', '3.90', '2.20', '2.65'],
];

// Rows are distributed over the whole screen height (percent `top` positions)
const ROW_TOP_PCT = (i: number) => 3 + (i * 90) / (COEFF_ROWS.length - 1); // 3% … 93%

// Horizontal positions; odd rows are shifted for an organic layout
const COL_X_EVEN = [8, 28, 56, 78];
const COL_X_ODD = [14, 36, 62, 84];

export function AnimatedSplash({ onFinish }: Props) {
  const line1Scale    = useRef(new Animated.Value(0)).current;
  const line2Scale    = useRef(new Animated.Value(0)).current;
  const line3Scale    = useRef(new Animated.Value(0)).current;
  const textOpacity   = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(14)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const exitOpacity   = useRef(new Animated.Value(1)).current;

  // Per-row animated values for the wave effect (single stable ref — row count is constant)
  const rowOps = useRef(COEFF_ROWS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // 12 rows must sweep within the main sequence (~3.1s): 11×170 + 240 + 340 ≈ 2.5s
    const WAVE_STAGGER = 170; // ms between each row lighting up
    const ROW_RISE = 240;     // ms to reach peak opacity
    const ROW_DIM  = 340;     // ms to dim to resting

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

  // Memoized: rowOps hold stable Animated.Value refs, so this allocates once
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rowInterps = useMemo(
    () => rowOps.map((op) => op.interpolate({ inputRange: [0, 1], outputRange: [0.07, 0.22] })),
    [],
  );

  return (
    <Animated.View style={[s.container, { opacity: exitOpacity }]}>
      {/* Wave coefficients — 12 rows × 4 values covering the full screen height */}
      {COEFF_ROWS.map((row, ri) => {
        const cols = ri % 2 === 0 ? COL_X_EVEN : COL_X_ODD;
        return (
          <Animated.View
            key={ri}
            style={[s.coeffRow, { top: `${ROW_TOP_PCT(ri)}%` as any, opacity: rowInterps[ri] }]}
          >
            {row.map((v, ci) => (
              <Text key={ci} style={[s.coeff, { left: `${cols[ci]}%` as any }]}>
                {v}
              </Text>
            ))}
          </Animated.View>
        );
      })}

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
  // Animated.Text is not covered by the AppText alias, so this one names the
  // face itself — otherwise the first words of the app are in the system font.
  tagline: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 6,
    textAlign: 'center',
  },
});
