import React, { useRef, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView, Animated, PanResponder,
} from 'react-native';
import { AppText as Text } from './AppText';
import { colors } from '../theme/colors';
import { SIZE, GLYPH } from '../theme/typography';
import { SPACE, RADIUS, TOUCH } from '../theme/layout';
import { haptic } from '../utils/haptics';

export interface PickerOption<T extends string> {
  key: T;
  label: string;
}

interface Props<T extends string> {
  /** Shown small above the value, e.g. "Статус". */
  label: string;
  options: Array<PickerOption<T>>;
  value: T;
  onChange: (key: T) => void;
  /** Marks the button as "not the default", so a live filter is visible at a glance. */
  active?: boolean;
}

/**
 * One filter as a button that opens a sheet, instead of a row of chips.
 *
 * Six statuses and six sort orders as chips needed two rows that still ran off
 * the right edge — you had to scroll sideways to find out what the options even
 * were, and the current one could be off-screen. A button states the current
 * choice in place and puts the rest one tap away, which also gives the bar back
 * enough height to be worth collapsing.
 */
export function FilterPicker<T extends string>({ label, options, value, onChange, active }: Props<T>) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.key === value);

  // Drag-to-dismiss. Tapping outside was the only way out, which is not where a
  // thumb goes after reading a sheet — it goes down.
  const dragY = useRef(new Animated.Value(0)).current;

  function open_() {
    dragY.setValue(0);
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  const drag = useRef(
    PanResponder.create({
      // Claim only a clear downward drag, so the option list can still scroll.
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) dragY.setValue(g.dy); },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
      onPanResponderRelease: (_, g) => {
        // Past a third of the way, or thrown down fast enough to mean it.
        if (g.dy > 120 || g.vy > 0.6) {
          Animated.timing(dragY, { toValue: 600, duration: 160, useNativeDriver: true })
            .start(() => close());
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
    }),
  ).current;

  return (
    <>
      <TouchableOpacity
        style={[picker.btn, active && picker.btnActive]}
        onPress={() => { haptic.selection(); open_(); }}
        activeOpacity={0.75}
      >
        <View style={picker.btnText}>
          <Text style={picker.label}>{label}</Text>
          <Text style={[picker.value, active && picker.valueActive]} numberOfLines={1}>
            {current?.label ?? ''}
          </Text>
        </View>
        <Text style={[picker.caret, active && picker.valueActive]}>⌄</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        {/* Tap outside, or drag the sheet down. */}
        <Pressable style={picker.backdrop} onPress={close}>
          <Animated.View style={[picker.sheet, { transform: [{ translateY: dragY }] }]}>
            {/* Shields the WHOLE sheet from the backdrop's dismiss. Without it,
                a thumb landing in the sheet's own padding — the 40pt band under
                the last option — closes it instead of choosing. */}
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View {...drag.panHandlers}>
                {/* The grab area: the handle plus the title beside it. */}
                <View style={picker.handle} />
                <Text style={picker.sheetTitle}>{label}</Text>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" style={picker.sheetScroll}>
              {options.map((o) => {
                const isCurrent = o.key === value;
                return (
                  <TouchableOpacity
                    key={o.key}
                    style={[picker.option, isCurrent && picker.optionCurrent]}
                    onPress={() => { haptic.selection(); onChange(o.key); close(); }}
                    activeOpacity={0.75}
                  >
                    <Text style={[picker.optionText, isCurrent && picker.optionTextCurrent]}>
                      {o.label}
                    </Text>
                    {isCurrent && <Text style={picker.check}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
              </ScrollView>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

const picker = StyleSheet.create({
  btn: {
    flex: 1,
    minHeight: TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnActive: { borderColor: colors.purple, backgroundColor: colors.purpleDim },
  btnText: { flex: 1 },
  label: { fontSize: SIZE.micro, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: SIZE.body, fontWeight: '700', color: colors.textPrimary, marginTop: 1 },
  valueActive: { color: colors.purpleText },
  caret: { fontSize: GLYPH.md, color: colors.textMuted, marginTop: -2 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    paddingBottom: 40,
    paddingHorizontal: SPACE.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    width: 36, height: 4, borderRadius: RADIUS.pill,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center', marginTop: SPACE.md, marginBottom: SPACE.md,
  },
  sheetTitle: {
    fontSize: SIZE.micro, color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACE.sm,
  },
  sheetScroll: { maxHeight: 360 },
  option: {
    minHeight: TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.md,
    paddingVertical: SPACE.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionCurrent: { borderBottomColor: colors.purple },
  optionText: { fontSize: SIZE.lead, color: colors.textSecondary },
  optionTextCurrent: { color: colors.purpleText, fontWeight: '700' },
  check: { fontSize: SIZE.lead, color: colors.purpleText, fontWeight: '700' },
});
