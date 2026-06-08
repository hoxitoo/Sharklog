import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, Animated } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  appReady: boolean;
  onFinish: () => void;
}

export function AnimatedSplash({ appReady, onFinish }: Props) {
  const logoScale   = useRef(new Animated.Value(0.55)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const [introsDone, setIntrosDone] = useState(false);

  // Phase 1+2: intro animation (always plays immediately)
  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 70,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start(() => setIntrosDone(true));
  }, []);

  // Phase 3: exit — waits for both intro done AND app data ready
  useEffect(() => {
    if (!introsDone || !appReady) return;
    Animated.sequence([
      Animated.delay(320),
      Animated.timing(exitOpacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start(() => onFinish());
  }, [introsDone, appReady]);

  return (
    <Animated.View style={[styles.container, { opacity: exitOpacity }]}>
      <Animated.Image
        source={require('../../assets/icon.png')}
        style={[
          styles.logo,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
        resizeMode="contain"
      />
      <Animated.View style={[styles.textBlock, { opacity: textOpacity }]}>
        <Text style={styles.name}>SharkLog</Text>
        <Text style={styles.tagline}>Трекер ставок</Text>
      </Animated.View>

      {/* Dots loader — visible only while waiting for app data after intro */}
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
    <View style={styles.dots}>
      {[dot1, dot2, dot3].map((d, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: d }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 110,
    height: 110,
    borderRadius: 22,
    marginBottom: 22,
  },
  textBlock: {
    alignItems: 'center',
  },
  name: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.8,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: colors.textMuted,
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
