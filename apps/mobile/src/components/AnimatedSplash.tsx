import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  appReady: boolean;
  onFinish: () => void;
}

const ND = { useNativeDriver: true } as const;

const LINES = [
  { width: 120, delay: 0 },
  { width: 80,  delay: 80 },
  { width: 50,  delay: 160 },
];

const COEFFS = [
  { v: '1.85', top:  48, left:  24 },
  { v: '2.40', top:  44, right: 22 },
  { v: '3.10', top: 148, left:  38 },
  { v: '1.65', top: 144, right: 36 },
  { v: '2.75', top:  96, left:   8 },
];

export function AnimatedSplash({ appReady, onFinish }: Props) {
  const line1Scale    = useRef(new Animated.Value(0)).current;
  const line2Scale    = useRef(new Animated.Value(0)).current;
  const line3Scale    = useRef(new Animated.Value(0)).current;
  const textOpacity   = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(12)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const coeffOpacity  = useRef(new Animated.Value(0)).current;
  const exitOpacity   = useRef(new Animated.Value(1)).current;

  const [introsDone, setIntrosDone] = useState(false);

  const lineScales = [line1Scale, line2Scale, line3Scale];

  useEffect(() => {
    Animated.parallel([
      ...LINES.map((l, i) =>
        Animated.sequence([
          Animated.delay(l.delay),
          Animated.timing(lineScales[i]!, {
            toValue: 1, duration: 320,
            easing: Easing.out(Easing.cubic), ...ND,
          }),
        ]),
      ),
      Animated.sequence([
        Animated.delay(300),
        Animated.parallel([
          Animated.timing(textOpacity,   { toValue: 1, duration: 320, ...ND }),
          Animated.timing(textTranslate, { toValue: 0, duration: 320, ...ND }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(taglineOpacity, { toValue: 1, duration: 260, ...ND }),
      ]),
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(coeffOpacity, { toValue: 1, duration: 500, ...ND }),
      ]),
    ]).start(() => setIntrosDone(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!introsDone || !appReady) return;
    Animated.sequence([
      Animated.delay(300),
      Animated.timing(exitOpacity, { toValue: 0, duration: 300, ...ND }),
    ]).start(() => onFinish());
  }, [introsDone, appReady]);

  const coeffInterp = coeffOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.10] });

  return (
    <Animated.View style={[s.container, { opacity: exitOpacity }]}>
      {/* Coefficient watermarks */}
      {COEFFS.map((c) => (
        <Animated.Text
          key={c.v}
          style={[s.coeff, { opacity: coeffInterp, top: c.top, ...('left' in c ? { left: c.left } : { right: (c as any).right }) }]}
        >
          {c.v}
        </Animated.Text>
      ))}

      {/* Signal lines */}
      <View style={s.linesWrap}>
        {LINES.map((l, i) => (
          <Animated.View
            key={i}
            style={[s.line, { width: l.width, transform: [{ scaleX: lineScales[i]! }] }]}
          />
        ))}
      </View>

      {/* Brand text */}
      <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: textTranslate }] }}>
        <Text style={s.name}>SharkLog</Text>
      </Animated.View>
      <Animated.Text style={[s.tagline, { opacity: taglineOpacity }]}>
        Трекер ставок
      </Animated.Text>

      {introsDone && !appReady && <LoadingDots />}
    </Animated.View>
  );
}

function LoadingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ]),
      );
    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 150);
    const a3 = pulse(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={s.dots}>
      {[dot1, dot2, dot3].map((d, i) => (
        <Animated.View key={i} style={[s.dot, { opacity: d }]} />
      ))}
    </View>
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
  dots: {
    position: 'absolute',
    bottom: 80,
    flexDirection: 'row',
    gap: 7,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.purple,
  },
});
