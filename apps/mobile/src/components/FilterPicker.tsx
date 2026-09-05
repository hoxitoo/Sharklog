import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
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

  return (
    <>
      <TouchableOpacity
        style={[picker.btn, active && picker.btnActive]}
        onPress={() => { haptic.selection(); setOpen(true); }}
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

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* Tap outside to dismiss — the standard way out of a sheet. */}
        <Pressable style={picker.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={picker.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={picker.handle} />
            <Text style={picker.sheetTitle}>{label}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" style={picker.sheetScroll}>
              {options.map((o) => {
                const isCurrent = o.key === value;
                return (
                  <TouchableOpacity
                    key={o.key}
                    style={[picker.option, isCurrent && picker.optionCurrent]}
                    onPress={() => { haptic.selection(); onChange(o.key); setOpen(false); }}
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
