import React, { useEffect, useRef } from 'react';
import {
  Modal, View, StyleSheet, Animated, Pressable, useWindowDimensions,
} from 'react-native';
import { AppText as Text } from './AppText';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, alpha, mix } from '../theme/colors';
import { SIZE } from '../theme/typography';

export interface WheelAction {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  /** Accent for the icon, the label and the sector tint. */
  color?: string;
  /** Destructive actions get a red wash so they are hard to hit by accident. */
  danger?: boolean;
}

interface Props {
  visible: boolean;
  /** Line above the wheel naming what is being acted on. */
  title?: string;
  subtitle?: string;
  actions: WheelAction[];
  onSelect: (key: string) => void;
  onClose: () => void;
  /** Center button glyph — a back arrow when the wheel is showing a sub-menu. */
  centerIcon?: React.ComponentProps<typeof Ionicons>['name'];
}

const GAP = 0.02;        // radians of background showing between sectors
const LABEL_WIDTH = 78;
const LABEL_HEIGHT = 54;  // icon + up to two wrapped lines

function polar(cx: number, cy: number, r: number, a: number): [number, number] {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** Ring segment between two radii — the shape of one wheel sector. */
function sectorPath(cx: number, cy: number, rOut: number, rIn: number, from: number, to: number): string {
  const [x1, y1] = polar(cx, cy, rOut, from);
  const [x2, y2] = polar(cx, cy, rOut, to);
  const [x3, y3] = polar(cx, cy, rIn, to);
  const [x4, y4] = polar(cx, cy, rIn, from);
  const large = to - from > Math.PI ? 1 : 0;
  return [
    `M ${x1} ${y1}`,
    `A ${rOut} ${rOut} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rIn} ${rIn} 0 ${large} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}

/**
 * Radial action menu over a dimmed backdrop.
 *
 * Every action is one thumb-sized wedge at a fixed angle, so the whole menu is
 * reachable without moving the hand down a list, and the same action always
 * sits in the same place. Sector count follows the action count — with four
 * actions the wheel is quarters, with seven it is narrower slices.
 */
export function ActionWheel({
  visible, title, subtitle, actions, onSelect, onClose, centerIcon = 'close',
}: Props) {
  const { width, height } = useWindowDimensions();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      anim.setValue(0);
      Animated.spring(anim, {
        toValue: 1, useNativeDriver: true, tension: 90, friction: 9,
      }).start();
    }
  }, [visible, anim]);

  if (actions.length === 0) return null;

  // Leave room for the title above and the safe area below on short screens,
  // but never shrink past the point where the labels stop fitting the ring.
  const size = Math.max(240, Math.min(width - 40, height - 260, 330));
  const rOut = size / 2;
  // Clamped against rOut: an unclamped floor of 46 inverts the ring on a short
  // viewport, and sectorPath would emit a self-crossing shape.
  const rIn = Math.min(Math.max(46, size * 0.2), rOut * 0.55);
  // Pushed past the middle of the ring: arc length per label grows with the
  // radius, and with seven wedges the labels were touching at mid-ring.
  const rLabel = rIn + (rOut - rIn) * 0.56;
  const step = (Math.PI * 2) / actions.length;
  // Sector 0 is centred at 12 o'clock; -PI/2 is straight up in SVG coordinates.
  const first = -Math.PI / 2 - step / 2;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={wheel.backdrop} onPress={onClose}>
        <Animated.View
          style={[
            wheel.stage,
            { opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }] },
          ]}
        >
          {title ? (
            <View style={wheel.head} pointerEvents="none">
              <Text style={wheel.title} numberOfLines={1}>{title}</Text>
              {subtitle ? <Text style={wheel.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
            </View>
          ) : null}

          {/* Pressable wrapper above swallows backdrop taps that land on the wheel. */}
          <Pressable onPress={() => {}}>
            <View style={{ width: size, height: size }}>
              <Svg width={size} height={size}>
                {actions.map((a, i) => {
                  const from = first + i * step + GAP / 2;
                  const to = first + (i + 1) * step - GAP / 2;
                  const accent = a.danger ? colors.lost : (a.color ?? colors.textSecondary);
                  return (
                    <Path
                      key={a.key}
                      d={sectorPath(rOut, rOut, rOut, rIn, from, to)}
                      fill={a.danger ? mix(colors.lost, colors.bgCard, 0.14) : mix(accent, colors.bgCard, 0.07)}
                      stroke={alpha(accent, 0.35)}
                      strokeWidth={1}
                      onPress={() => onSelect(a.key)}
                    />
                  );
                })}
              </Svg>

              {actions.map((a, i) => {
                const mid = first + i * step + step / 2;
                const [lx, ly] = polar(rOut, rOut, rLabel, mid);
                const accent = a.danger ? colors.lost : (a.color ?? colors.textPrimary);
                return (
                  <View
                    key={a.key}
                    pointerEvents="none"
                    style={[wheel.label, { left: lx - LABEL_WIDTH / 2, top: ly - LABEL_HEIGHT / 2 }]}
                  >
                    <Ionicons name={a.icon} size={22} color={accent} />
                    <Text style={[wheel.labelText, { color: accent }]} numberOfLines={2}>{a.label}</Text>
                  </View>
                );
              })}

              <Pressable
                style={[wheel.center, {
                  width: rIn * 1.55, height: rIn * 1.55, borderRadius: rIn,
                  left: rOut - rIn * 0.775, top: rOut - rIn * 0.775,
                }]}
                onPress={onClose}
              >
                <Ionicons name={centerIcon} size={26} color="#fff" />
              </Pressable>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const wheel = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: '#000000D0',
    alignItems: 'center', justifyContent: 'center',
  },
  stage: { alignItems: 'center' },
  head: { alignItems: 'center', marginBottom: 18, paddingHorizontal: 32 },
  title: { fontSize: SIZE.lead, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: SIZE.caption, color: colors.textMuted, marginTop: 3, textAlign: 'center' },
  label: {
    position: 'absolute', width: LABEL_WIDTH, height: LABEL_HEIGHT,
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  labelText: { fontSize: SIZE.caption, fontWeight: '600', textAlign: 'center' },
  center: {
    position: 'absolute', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.lost,
    borderWidth: 3, borderColor: colors.bg,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
});
