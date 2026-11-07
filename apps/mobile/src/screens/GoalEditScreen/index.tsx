import React, { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  activeGoals, addDays, parseMoneyInput, toYmd, FREE_LIMITS, GOAL_KINDS, type Goal, type GoalKind,
} from '@sharklog/core';
import { AppText as Text, AppTextInput as TextInput } from '../../components/AppText';
import { FilterPicker } from '../../components/FilterPicker';
import { DateField } from '../../components/DateField';
import { Field, inputStyle } from '../../components/FormField';
import { addMonths, followStart } from '../../utils/calendar';
import { useBetsStore } from '../../store/betsStore';
import { useBottomPad } from '../../utils/useBottomPad';
import { useCurrencySymbol } from '../../utils/useFormatMoney';
import { uuid } from '../../utils/uuid';
import { colors } from '../../theme/colors';
import { themedStyles } from '../../theme/themed';
import { SPACE, RADIUS, TOUCH } from '../../theme/layout';
import { SIZE } from '../../theme/typography';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'GoalEdit'>;

/** The deadline chips, in months from the start. */
const PRESET_MONTHS = [3, 6, 12, 36];

/** The text an amount field opens with: whole units, as typed ("150000"). */
const amountText = (kopecks: number) => String(Math.round(kopecks) / 100);

/**
 * A goal's form. `goalId` edits that goal; none — a new one. The Free limit is
 * checked where a goal is added (the goals screen) and where an archived one
 * would come back — the two ways the active count grows.
 */
export function GoalEditScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { t } = useTranslation();
  const currency = useCurrencySymbol();
  const bottomPad = useBottomPad(SPACE.xxl);
  const goals = useBetsStore((s) => s.goals);
  const isPro = useBetsStore((s) => s.settings.isPro);
  const saveGoal = useBetsStore((s) => s.saveGoal);
  const deleteGoal = useBetsStore((s) => s.deleteGoal);

  const existing = route.params?.goalId ? goals.find((g) => g.id === route.params?.goalId) : undefined;
  const [kind, setKind] = useState<GoalKind>(existing?.kind ?? 'profit');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [amount, setAmount] = useState(existing ? amountText(existing.target) : '');
  const [start, setStart] = useState(existing?.startDate ?? toYmd(new Date()));
  const [deadline, setDeadline] = useState(existing?.deadline ?? '');
  const [note, setNote] = useState(existing?.note ?? '');

  useEffect(() => {
    navigation.setOptions({ title: existing ? t('goals.editTitle') : t('goals.newTitle') });
  }, [existing, navigation, t]);

  const isCap = kind === 'lossCap';
  // In the sheet each kind says what it counts, in a sentence; the card says
  // how, in full (goals.how).
  const kindOptions = GOAL_KINDS.map((k) => ({ key: k, label: t(`goals.kind.${k}`), description: t(`goals.kindHint.${k}`) }));
  // A deadline is usually "in N months": one tap instead of paging the calendar.
  // Counted from the start; one already behind us is not offered — on an old
  // goal every chip would otherwise set a deadline that has passed.
  const today = toYmd(new Date());
  const deadlinePresets = PRESET_MONTHS
    .map((m) => ({
      label: m % 12 === 0 ? t('goals.dur.years', { y: m / 12 }) : t('goals.dur.months', { m }),
      value: addMonths(start, m),
    }))
    .filter((p) => p.value > today);

  /**
   * A moved start carries the deadline with it when the deadline was one of
   * the "+N months" answers (it meant "a year from the start"), and drops a
   * deadline the new start has passed — it would only fail on Save, and the
   * calendar would open on a month of greyed-out days.
   */
  function changeStart(next: string) {
    setDeadline((d) => followStart(d, start, next, PRESET_MONTHS));
    setStart(next);
  }

  /** The goal as the form describes it, or null after saying what is wrong. */
  function read(): Goal | null {
    const name = title.trim();
    if (!name) { Alert.alert(t('common.error'), t('goals.errTitle')); return null; }
    const target = parseMoneyInput(amount);
    if (!(target > 0)) { Alert.alert(t('common.error'), t('goals.errAmount')); return null; }
    // Both days come from the calendar, already YYYY-MM-DD. The deadline can
    // still fall behind the start: chosen first, then the start moved past it.
    const startDay = start;
    const end = !isCap && deadline ? deadline : null;
    if (end && end <= startDay) { Alert.alert(t('common.error'), t('goals.errDeadline')); return null; }
    const text = note.trim();
    return {
      id: existing?.id ?? uuid(),
      title: name,
      kind,
      target,
      startDate: startDay,
      ...(end ? { deadline: end } : {}),
      ...(text ? { note: text } : {}),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      ...(existing?.archived ? { archived: true } : {}),
    };
  }

  function save() {
    const goal = read();
    if (!goal) return;
    saveGoal(goal);
    navigation.goBack();
  }

  function toggleArchive() {
    if (!existing) return;
    const goal = read();
    if (!goal) return;
    if (existing.archived) {
      // Coming back from the archive adds an active goal — the same limit as adding one.
      if (!isPro && activeGoals(goals).length >= FREE_LIMITS.MAX_GOALS) {
        Alert.alert(t('goals.freeLimitTitle'), t('goals.freeLimitMsg'));
        return;
      }
      const { archived: _was, ...back } = goal;
      // Back at the END: in its old place it could land before the main goal
      // and silently take over the header button.
      deleteGoal(back.id);
      saveGoal(back);
    } else {
      saveGoal({ ...goal, archived: true });
    }
    navigation.goBack();
  }

  function remove() {
    if (!existing) return;
    Alert.alert(t('goals.deleteTitle'), t('goals.deleteMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => { deleteGoal(existing.id); navigation.goBack(); },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={s.flex}
        contentContainerStyle={[s.content, { paddingBottom: bottomPad }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.field}>
          <FilterPicker
            label={t('goals.kindLabel')}
            options={kindOptions}
            value={kind}
            onChange={setKind}
          />
          <Text style={s.hint}>{t(`goals.kindHint.${kind}`)}</Text>
        </View>

        <Field label={t('goals.titleLabel')}>
          <TextInput
            style={inputStyle}
            value={title}
            onChangeText={setTitle}
            placeholder={t(`goals.titlePh.${kind}`)}
            placeholderTextColor={colors.textMuted}
            maxLength={60}
          />
        </Field>

        <Field label={t(`goals.amount.${kind}`, { currency })}>
          <TextInput
            style={inputStyle}
            value={amount}
            onChangeText={setAmount}
            placeholder="100000"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
          />
        </Field>

        <View style={s.row}>
          <Field label={t('goals.startLabel')} style={s.half}>
            <DateField label={t('goals.startLabel')} value={start} onChange={changeStart} />
          </Field>
          {!isCap ? (
            <Field label={t('goals.deadlineLabel')} style={s.half}>
              <DateField
                label={t('goals.deadlineLabel')}
                value={deadline}
                onChange={setDeadline}
                placeholder={t('goals.noDeadline')}
                min={addDays(start, 1)}
                presets={deadlinePresets}
                presetsTitle={t('goals.deadlineFrom')}
                onClear={() => setDeadline('')}
                clearLabel={t('goals.noDeadline')}
              />
            </Field>
          ) : null}
        </View>
        {/* What the start date does differs by kind: a bank goal counts the
            whole bank and the start only draws the plan. */}
        <Text style={[s.hint, s.hintBelow]}>{t(`goals.startHint.${kind}`)}</Text>

        <Field label={t('goals.noteLabel')}>
          <TextInput
            style={[inputStyle, s.note]}
            value={note}
            onChangeText={setNote}
            placeholder={t('goals.notePh')}
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
          />
        </Field>

        <TouchableOpacity style={s.save} onPress={save} activeOpacity={0.8} accessibilityRole="button">
          <Text style={s.saveText}>{t('common.save')}</Text>
        </TouchableOpacity>

        {existing ? (
          <View style={s.secondary}>
            <TouchableOpacity style={s.secondaryBtn} onPress={toggleArchive} activeOpacity={0.75}>
              <Text style={s.secondaryText}>{t(existing.archived ? 'goals.unarchive' : 'goals.toArchive')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.secondaryBtn} onPress={remove} activeOpacity={0.75}>
              <Text style={[s.secondaryText, s.danger]}>{t('common.delete')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Getters for the colours: a plain object would keep the theme the app started with.
const s = themedStyles(() => ({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: SPACE.lg },
  field: { marginBottom: SPACE.lg },
  row: { flexDirection: 'row', gap: SPACE.md },
  half: { flex: 1, marginBottom: 0 },
  hint: { fontSize: SIZE.caption, color: colors.textMuted, marginTop: SPACE.xs, lineHeight: 17 },
  hintBelow: { marginBottom: SPACE.lg },
  note: { minHeight: 96 },
  save: {
    minHeight: TOUCH, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.purple, borderRadius: RADIUS.md, padding: SPACE.md,
  },
  saveText: { fontSize: SIZE.lead, fontWeight: '700', color: '#fff' },
  secondary: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACE.md },
  secondaryBtn: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: SPACE.sm },
  secondaryText: { fontSize: SIZE.body, fontWeight: '700', color: colors.purpleText },
  danger: { color: colors.lost },
}));
