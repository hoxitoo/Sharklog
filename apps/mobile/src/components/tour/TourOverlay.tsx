import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, type LayoutChangeEvent } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { AppText as Text } from '../AppText';
import { useTourStore, measureTarget } from './tour';
import { tourLayout, dimPath, HOLE_RADIUS, type Box, type Size } from './geometry';
import { colors } from '../../theme/colors';
import { PALETTES } from '../../theme/palettes';
import { SPACE, RADIUS, TOUCH } from '../../theme/layout';
import { SIZE } from '../../theme/typography';
import { themedStyles } from '../../theme/themed';
import { haptic } from '../../utils/haptics';

/*
 * The tour's overlay: the screen dimmed, a rounded window cut over the control
 * being explained, an arrow from a card of text to it, and "skip" / "next".
 *
 * It sits over the whole drawer screen and takes every touch while it is up —
 * a tap meant for "next" must not land on the bet list underneath.
 *
 * The arrow and the window's outline are drawn on the scrim, so they keep the
 * brand teal in every theme (the rule for anything on a scrim: fixed colours).
 * The card itself is a themed surface.
 */

const ACCENT = PALETTES.dark.accent;
const SCRIM = 'rgba(0,0,0,0.72)';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function TourOverlay() {
  const { t } = useTranslation();
  const active = useTourStore((s) => s.active);
  const steps = useTourStore((s) => s.steps);
  const index = useTourStore((s) => s.index);
  const next = useTourStore((s) => s.next);
  const finish = useTourStore((s) => s.finish);

  const rootRef = useRef<View>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [target, setTarget] = useState<Box | null>(null);
  const [cardH, setCardH] = useState(200);
  const opacity = useRef(new Animated.Value(0)).current;
  const step = active ? steps[index] : undefined;

  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    opacity.setValue(0);

    const measureRoot = () => new Promise<{ x: number; y: number } | null>((resolve) => {
      const node = rootRef.current;
      if (!node) { resolve(null); return; }
      node.measureInWindow((x, y) => resolve({ x, y }));
    });

    (async () => {
      // The first step waits for the screen to settle (scrolled to the top,
      // panel expanded); later ones only for this frame's layout.
      await wait(index === 0 ? 350 : 16);
      let rect: Box | null = null;
      if (step.target) {
        for (let attempt = 0; attempt < 10 && !cancelled; attempt++) {
          const [r, root] = await Promise.all([measureTarget(step.target), measureRoot()]);
          if (r && root) {
            // Window coordinates → the overlay's own (it may sit under a translucent status bar).
            rect = { x: r.x - root.x, y: r.y - root.y, width: r.width, height: r.height };
            break;
          }
          await wait(100);
        }
        // The control is not on screen: skip the step rather than point at nothing.
        if (!rect) { if (!cancelled) next(); return; }
      }
      if (cancelled) return;
      setTarget(rect);
      // A short timing, not a spring: the buttons ride on this view, and a
      // native animation still running under them cancels the first tap.
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    })();
    return () => { cancelled = true; };
  }, [step, index, next, opacity]);

  if (!step) return null;

  const last = index === steps.length - 1;
  const layout = tourLayout(step.target ? target : null, size, cardH);

  function onRootLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  }

  return (
    <View
      ref={rootRef}
      style={styles.root}
      onLayout={onRootLayout}
      // Swallow every touch that is not on the card's buttons.
      onStartShouldSetResponder={() => true}
      accessibilityViewIsModal
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="box-none">
        {size.width > 0 && (
          <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Path d={dimPath(size, layout.hole)} fill={SCRIM} fillRule="evenodd" />
            {layout.hole && (
              <Rect
                x={layout.hole.x} y={layout.hole.y}
                width={layout.hole.width} height={layout.hole.height}
                rx={HOLE_RADIUS} ry={HOLE_RADIUS}
                fill="none" stroke={ACCENT} strokeWidth={2}
              />
            )}
            {layout.shaft ? (
              <Path d={layout.shaft} fill="none" stroke={ACCENT} strokeWidth={2.5} strokeLinecap="round" />
            ) : null}
            {layout.head ? (
              <Path d={layout.head} fill="none" stroke={ACCENT} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            ) : null}
          </Svg>
        )}

        <View
          style={[styles.card, { top: layout.cardTop }]}
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            if (Math.abs(h - cardH) > 1) setCardH(h);
          }}
        >
          <Text style={styles.counter}>{t('tour.counter', { n: index + 1, total: steps.length })}</Text>
          <Text style={styles.title}>{t(`tour.${step.key}Title`)}</Text>
          <Text style={styles.body}>{t(`tour.${step.key}Body`)}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.skip} onPress={finish} activeOpacity={0.7}>
              <Text style={styles.skipText}>{t('tour.skip')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.next}
              onPress={() => { haptic.selection(); next(); }}
              activeOpacity={0.8}
            >
              <Text style={styles.nextText}>{last ? t('tour.done') : t('tour.next')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000 },
  card: {
    position: 'absolute', left: SPACE.lg, right: SPACE.lg,
    backgroundColor: colors.bgCard,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.borderStrong,
    padding: SPACE.lg, gap: SPACE.xs,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 12,
  },
  counter: { fontSize: SIZE.micro, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.5 },
  title: { fontSize: SIZE.lead, fontWeight: '700', color: colors.textPrimary },
  body: { fontSize: SIZE.body, color: colors.textSecondary, lineHeight: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACE.sm },
  skip: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: SPACE.xs },
  skipText: { fontSize: SIZE.body, fontWeight: '600', color: colors.textMuted },
  next: {
    minHeight: TOUCH, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: SPACE.xl, borderRadius: RADIUS.md, backgroundColor: colors.purple,
  },
  nextText: { fontSize: SIZE.body, fontWeight: '700', color: '#fff' },
}));
