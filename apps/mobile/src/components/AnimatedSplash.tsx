import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  onFinish: () => void;
}

const ND = { useNativeDriver: true } as const;

const COEFFS = [
  { v: '1.85', top:  48, left:  24 },
  { v: '2.40', top:  44, right: 22 },
  { v: '3.10', top: 148, left:  38 },
  { v: '1.65', top: 144, right: 36 },
  { v: '2.75', top:  96, left:   8 },
];

export function AnimatedSplash({ onFinish }: Props) {
  const line1Scale    = useRef(new Animated.Value(0)).current;
  const line2Scale    = useRef(new Animated.Value(0)).current;
  const line3Scale    = useRef(new Animated.Value(0)).current;
  const textOpacity   = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(14)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const coeffOpacity  = useRef(new Animated.Value(0)).current;
  const exitOpacity   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Coefficients fade in slowly in parallel with main sequence
    Animated.timing(coeffOpacity, {
      toValue: 1, duration: 2200, ...ND,
    }).start();

    // Main sequence: lines top→bottom, then text, then hold, then exit
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
    ]).start(() => onFinish());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const coeffInterp = coeffOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.10] });

  return (
    <Animated.View style={[s.container, { opacity: exitOpacity }]}>
      {COEFFS.map((c) => (
        <Animated.Text
          key={c.v}
          style={[
            s.coeff,
            { opacity: coeffInterp, top: c.top },
            'left' in c ? { left: c.left } : { right: (c as any).right },
          ]}
        >
          {c.v}
        </Animated.Text>
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
  coeff: {
    position: 'absolute',
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: 0.3,
  },
});
