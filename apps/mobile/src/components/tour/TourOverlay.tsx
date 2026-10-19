import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, ScrollView, type LayoutChangeEvent } from 'react-native';
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
import { useBetsStore } from '../../store/betsStore';
import { dateLocale } from '../../i18n';

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
  const trialEndsAt = useBetsStore((s) => s.settings.proExpiresAt);

  const rootRef = useRef<View>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [target, setTarget] = useState<Box | null>(null);
  const [cardH, setCardH] = useState(200);
  const [ready, setReady] = useState(false);
  // Two layers, two fades. The scrim fades in once, when the tour opens, and
  // then STAYS: fading it with each step flashed the undimmed screen between
  // steps. Only the card and the arrow fade from step to step.
  const scrim = useRef(new Animated.Value(0)).current;
  const content = useRef(new Animated.Value(0)).current;
  const step = active ? steps[index] : undefined;

  useEffect(() => {
    if (!active) { scrim.setValue(0); setReady(false); }
  }, [active, scrim]);

  // Before paint: the new step's text must not show for a frame at the old
  // step's position, and an invisible "next" must not take a second tap.
  useLayoutEffect(() => {
    if (!step) return;
    content.setValue(0);
    setReady(false);
  }, [step, content]);

  useEffect(() => {
    if (!step) return;
    let cancelled = false;

    const measureRoot = () => new Promise<{ x: number; y: number } | null>((resolve) => {
      const node = rootRef.current;
      if (!node) { resolve(null); return; }
      node.measureInWindow((x, y) => resolve({ x, y }));
    });

    (async () => {
      // The first step waits for the screen to settle (scrolled to the top,
      // panel expanded); later ones for this frame's layout and the card's.
      await wait(index === 0 ? 350 : 32);
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
      setReady(true);
      // Short timings, not springs: the buttons ride on these views, and a
      // native animation still running under them cancels the first tap.
      Animated.timing(scrim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      Animated.timing(content, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    })();
    return () => { cancelled = true; };
  }, [step, index, next, scrim, content]);

  if (!step) return null;

  const last = index === steps.length - 1;
  const layout = tourLayout(step.target ? target : null, size, cardH);
  const date = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long' })
    : '';
  const title = t(`tour.${step.key}Title`, { date });
  const body = t(`tour.${step.key}Body`, { date });
  const counter = t('tour.counter', { n: index + 1, total: steps.length });

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
      {size.width > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: scrim }]} pointerEvents="none">
          <Svg width={size.width} height={size.height}>
            <Path d={dimPath(size, layout.hole)} fill={SCRIM} fillRule="evenodd" />
            {layout.hole && (
              <Rect
                x={layout.hole.x} y={layout.hole.y}
                width={layout.hole.width} height={layout.hole.height}
                rx={HOLE_RADIUS} ry={HOLE_RADIUS}
                fill="none" stroke={ACCENT} strokeWidth={2}
              />
            )}
          </Svg>
        </Animated.View>
      )}

      {/* The card's natural height, measured off screen. The visible card may
          be capped (its text then scrolls), and measuring THAT would feed the
          cap back into the layout that set it. */}
      <View
        style={[styles.card, styles.measure]}
        pointerEvents="none"
        // A copy for measuring only — a screen reader must not read it twice.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onLayout={(e) => {
          const h = Math.round(e.nativeEvent.layout.height);
          if (Math.abs(h - cardH) > 1) setCardH(h);
        }}
      >
        <Text style={styles.counter}>{counter}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <View style={styles.actions}>
          <View style={styles.skip}><Text style={styles.skipText}>{t('tour.skip')}</Text></View>
          <View style={styles.next}><Text style={styles.nextText}>{last ? t('tour.done') : t('tour.next')}</Text></View>
        </View>
      </View>

      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: content }]}
        // Not tappable until it is visible: on Android an invisible view still
        // takes touches, and a quick double tap skipped a step unseen.
        pointerEvents={ready ? 'box-none' : 'none'}
      >
        {size.width > 0 && layout.shaft ? (
          <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Path d={layout.shaft} fill="none" stroke={ACCENT} strokeWidth={2.5} strokeLinecap="round" />
            <Path d={layout.head} fill="none" stroke={ACCENT} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        ) : null}

        <View
          style={[
            styles.card,
            { top: layout.cardTop },
            layout.cardMaxHeight !== undefined ? { maxHeight: layout.cardMaxHeight } : null,
          ]}
        >
          <Text style={styles.counter}>{counter}</Text>
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={styles.bodyScroll} keyboardShouldPersistTaps="handled" bounces={false}>
            <Text style={styles.body}>{body}</Text>
          </ScrollView>
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
  bodyScroll: { flexGrow: 0, flexShrink: 1 },
  // Off screen and invisible: only its height is wanted.
  measure: { top: -10000, opacity: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACE.sm },
  skip: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: SPACE.xs },
  skipText: { fontSize: SIZE.body, fontWeight: '600', color: colors.textMuted },
  next: {
    minHeight: TOUCH, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: SPACE.xl, borderRadius: RADIUS.md, backgroundColor: colors.purple,
  },
  nextText: { fontSize: SIZE.body, fontWeight: '700', color: '#fff' },
}));
