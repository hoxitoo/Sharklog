import React, { useRef, useState } from 'react';
import {
  View, TouchableOpacity, Modal, Pressable, Animated, PanResponder, Keyboard, type StyleProp, type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { toYmd } from '@sharklog/core';
import { AppText as Text } from './AppText';
import { AppIcon } from './icons/AppIcon';
import { colors } from '../theme/colors';
import { themedStyles } from '../theme/themed';
import { SPACE, RADIUS, TOUCH } from '../theme/layout';
import { SIZE, GLYPH, numeric } from '../theme/typography';
import { haptic } from '../utils/haptics';
import { useBottomPad } from '../utils/useBottomPad';
import { dayLabel } from '../utils/goalText';
import { isYmd, monthCells, monthOf, shiftMonth, weekdayOrder, weekStartFor } from '../utils/calendar';

export interface DatePreset {
  label: string;
  /** YYYY-MM-DD. */
  value: string;
}

interface Props {
  /** The field's name: the sheet's title and the start of what a screen reader says. */
  label: string;
  /** YYYY-MM-DD, or '' when nothing is chosen. */
  value: string;
  onChange: (ymd: string) => void;
  /** Said in the field while it is empty. */
  placeholder?: string;
  /** The first day that can be chosen; earlier days are drawn but cannot be tapped. */
  min?: string;
  /** One-tap answers above the grid ("3 мес.", "1 г." for a deadline). */
  presets?: DatePreset[];
  /** A word before the presets: what they count from. */
  presetsTitle?: string;
  /** Offers "no date" in the sheet — an optional field. */
  onClear?: () => void;
  /** The clear button's words; "Очистить" when not given. */
  clearLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A date as a field that opens a calendar, instead of a text box for
 * YYYY-MM-DD. Typing a date in an ISO format on a phone keyboard was the
 * complaint: a goal's deadline three years out took digits, dashes and a
 * format the user had to know.
 *
 * A tap on a day chooses it and closes the sheet; presets answer the common
 * case ("in a year") without paging. The calendar is drawn by the app, not
 * the system picker, so it wears the theme and speaks the app's language —
 * Android's own dialog follows the system's.
 */
export function DateField({ label, value, onChange, placeholder, min, presets, presetsTitle, onClear, clearLabel, style }: Props) {
  const { t, i18n } = useTranslation();
  const bottomPad = useBottomPad(SPACE.xl);
  const [open, setOpen] = useState(false);
  const today = toYmd(new Date());
  // A stored date can predate the calendar: a CSV import once kept an
  // unreadable one as typed. It is shown as it is and kept until another day is
  // chosen; the calendar then opens on today, not on a month it cannot read.
  const valid = isYmd(value);
  const [view, setView] = useState(() => monthOf(valid ? value : today));
  const weekStart = weekStartFor(i18n.language);
  const dragY = useRef(new Animated.Value(0)).current;

  function open_() {
    // The same rule as the picker sheets: a keyboard left up covers the sheet.
    Keyboard.dismiss();
    haptic.selection();
    // Reset on OPEN, not on close: resetting during the fade would jump the
    // closing sheet. Opens on the chosen day, else on the first allowed one.
    dragY.setValue(0);
    setView(monthOf(valid ? value : min && min > today ? min : today));
    setOpen(true);
  }

  const close = () => setOpen(false);

  function choose(ymd: string) {
    haptic.selection();
    onChange(ymd);
    close();
  }

  const drag = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) dragY.setValue(g.dy); },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.6) {
          Animated.timing(dragY, { toValue: 600, duration: 160, useNativeDriver: true }).start(() => close());
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
    }),
  ).current;

  const shown = valid ? dayLabel(value) : value.trim();
  const page = (delta: number) => setView((v) => shiftMonth(v.year, v.month, delta));
  const cells = monthCells(view.year, view.month, weekStart);
  const weeks = Array.from({ length: 6 }, (_, w) => cells.slice(w * 7, w * 7 + 7));

  return (
    <>
      <TouchableOpacity
        style={[s.field, style]}
        onPress={open_}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown || placeholder || ''}`}
        accessibilityHint={t('datePicker.openHint')}
      >
        {/* The mono face only for the digits: under a word ("Без срока") its
            wide spaces read as gaps. */}
        {/* Shrinks rather than cuts: at half width on a 360 dp phone with the
            system font enlarged, "05.11.2026" lost its year to an ellipsis. */}
        <Text
          style={[s.value, shown ? numeric : s.placeholder]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {shown || placeholder || ''}
        </Text>
        <AppIcon name="calendar" size={GLYPH.md} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        {/* Both Pressables are `accessible={false}`: a Pressable is accessible by
            default, and on iOS an accessible view hides everything inside it —
            VoiceOver would find one "close" element and no day to choose. The
            screen-reader way out is the escape gesture on the sheet. */}
        <Pressable style={s.backdrop} onPress={close} accessible={false}>
          <Animated.View
            style={[s.sheet, { paddingBottom: bottomPad, transform: [{ translateY: dragY }] }]}
            accessibilityViewIsModal
            onAccessibilityEscape={close}
          >
            {/* Shields the whole sheet from the backdrop's dismiss — a tap
                between two days must not close it. */}
            <Pressable onPress={(e) => e.stopPropagation()} accessible={false}>
              <View {...drag.panHandlers}>
                <View style={s.handle} />
                <Text style={s.title}>{label}</Text>
              </View>

              {presets && presets.length > 0 ? (
                <>
                {/* The caption on a line of its own: beside the chips it pushed
                    the fourth one to a second row at 360 dp in Kazakh. */}
                {presetsTitle ? <Text style={s.presetsTitle}>{presetsTitle}</Text> : null}
                <View style={s.presets}>
                  {presets.map((p) => {
                    const on = p.value === value;
                    return (
                      <TouchableOpacity
                        key={p.label}
                        style={[s.preset, on && s.presetOn]}
                        hitSlop={PRESET_SLOP}
                        onPress={() => choose(p.value)}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel={`${p.label}: ${dayLabel(p.value)}`}
                      >
                        <Text style={[s.presetText, on && s.presetTextOn]}>{p.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                </>
              ) : null}

              <View style={s.monthRow}>
                <Nav glyph="«" a11y={t('datePicker.prevYear')} onPress={() => page(-12)} />
                <Nav glyph="‹" a11y={t('datePicker.prevMonth')} onPress={() => page(-1)} />
                <Text style={s.month} accessibilityRole="header">
                  {t(`monthsLong.${view.month}`)} {view.year}
                </Text>
                <Nav glyph="›" a11y={t('datePicker.nextMonth')} onPress={() => page(1)} />
                <Nav glyph="»" a11y={t('datePicker.nextYear')} onPress={() => page(12)} />
              </View>

              <View style={s.week}>
                {weekdayOrder(weekStart).map((d) => (
                  <Text key={d} style={s.weekday}>{t(`weekdaysShort.${d}`)}</Text>
                ))}
              </View>

              {weeks.map((week, w) => (
                <View key={w} style={s.week}>
                  {week.map((day, i) => {
                    if (!day) return <View key={i} style={s.cell} />;
                    const off = !!min && day < min;
                    const chosen = day === value;
                    const isToday = day === today;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={s.cell}
                        onPress={() => choose(day)}
                        disabled={off}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={dayLabel(day)}
                        accessibilityState={{ selected: chosen, disabled: off }}
                      >
                        <View style={[s.dot, isToday && s.dotToday, chosen && s.dotChosen]}>
                          <Text style={[s.day, off && s.dayOff, isToday && s.dayToday, chosen && s.dayChosen]}>
                            {Number(day.slice(8))}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}

              <View style={s.footer}>
                {/* Not offered where today cannot be chosen (a deadline after
                    the start): there it would only page back to this month. */}
                {!min || today >= min ? (
                  <TouchableOpacity style={s.footerBtn} onPress={() => choose(today)} activeOpacity={0.7} accessibilityRole="button">
                    <Text style={s.footerText}>{t('datePicker.today')}</Text>
                  </TouchableOpacity>
                ) : <View />}
                {onClear ? (
                  <TouchableOpacity
                    style={s.footerBtn}
                    onPress={() => { haptic.selection(); onClear(); close(); }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                  >
                    <Text style={s.footerText}>{clearLabel ?? t('datePicker.clear')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

// The chips are 36 high on purpose (a row of four fits one line); the slop
// takes each to 44 without pushing the grid down.
const PRESET_SLOP = { top: 4, bottom: 4 };

function Nav({ glyph, a11y, onPress }: { glyph: string; a11y: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.nav} onPress={onPress} activeOpacity={0.6} accessibilityRole="button" accessibilityLabel={a11y}>
      <Text style={s.navText}>{glyph}</Text>
    </TouchableOpacity>
  );
}

const s = themedStyles(() => ({
  field: {
    minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    backgroundColor: colors.bgCard, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md, paddingVertical: SPACE.md,
    borderWidth: 1, borderColor: colors.border,
  },
  value: { flex: 1, fontSize: SIZE.lead, fontWeight: '400', color: colors.textPrimary },
  placeholder: { color: colors.textMuted },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgCard, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet,
    paddingHorizontal: SPACE.lg, borderTopWidth: 1, borderColor: colors.border,
  },
  handle: {
    width: 36, height: 4, borderRadius: RADIUS.pill, backgroundColor: colors.borderStrong,
    alignSelf: 'center', marginTop: SPACE.md, marginBottom: SPACE.md,
  },
  title: { fontSize: SIZE.micro, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACE.sm },

  presets: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm },
  presetsTitle: { fontSize: SIZE.caption, color: colors.textSecondary, marginBottom: SPACE.sm },
  preset: {
    minHeight: 36, justifyContent: 'center', paddingHorizontal: SPACE.md, borderRadius: RADIUS.pill,
    backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border,
  },
  presetOn: { borderColor: colors.purple, backgroundColor: colors.purpleDim },
  presetText: { fontSize: SIZE.body, fontWeight: '600', color: colors.textPrimary },
  presetTextOn: { color: colors.purpleText },

  monthRow: { flexDirection: 'row', alignItems: 'center' },
  month: { flex: 1, textAlign: 'center', fontSize: SIZE.lead, fontWeight: '700', color: colors.textPrimary },
  nav: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: SIZE.title, fontWeight: '700', color: colors.purpleText },

  week: { flexDirection: 'row' },
  weekday: {
    flex: 1, textAlign: 'center', fontSize: SIZE.caption, fontWeight: '600', color: colors.textMuted,
    paddingVertical: SPACE.xs,
  },
  // A seventh of the row, a full touch target high.
  cell: { flex: 1, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 36, height: 36, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  dotToday: { borderWidth: 1, borderColor: colors.purpleText },
  dotChosen: { backgroundColor: colors.purple, borderColor: colors.purple },
  day: { ...numeric, fontSize: SIZE.body, fontWeight: '400', color: colors.textPrimary },
  dayOff: { color: colors.textMuted, opacity: 0.45 },
  dayToday: { color: colors.purpleText, fontWeight: '700' },
  // White on the brand fill — the one place `#fff` is the palette's rule.
  dayChosen: { color: '#fff', fontWeight: '700' },

  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACE.xs },
  footerBtn: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: SPACE.xs },
  footerText: { fontSize: SIZE.body, fontWeight: '700', color: colors.purpleText },
}));
