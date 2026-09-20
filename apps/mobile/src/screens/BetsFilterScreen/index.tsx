import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../../components/AppText';
import { useNavigation } from '@react-navigation/native';
import { useBetsStore } from '../../store/betsStore';
import { useBetsQuery } from '../../components/BetsQueryContext';
import { EMPTY_BETS_QUERY, betsVocabulary, suggest, countBetsQuery, type BetsQuery } from '../../utils/betsQuery';
import { colors } from '../../theme/colors';
import { SPACE, RADIUS, TOUCH } from '../../theme/layout';
import { SIZE, numeric } from '../../theme/typography';
import { haptic } from '../../utils/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const inputStyle = {
  backgroundColor: colors.bgCard,
  borderRadius: RADIUS.sm,
  paddingHorizontal: SPACE.md,
  paddingVertical: SPACE.md,
  color: colors.textPrimary,
  fontSize: SIZE.lead,
  borderWidth: 1,
  borderColor: colors.border,
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      {children}
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

/**
 * Chips of values that actually exist in the data.
 *
 * Without them the tournament field is a guessing game: the stored name
 * carries a season ("StarLadder StarSeries Fall 26") and nothing on screen
 * ever showed it. They appear as you type, so a full list of 40 tournaments
 * never has to be rendered.
 */
function Suggestions({ pool, input, onPick }: {
  pool: string[]; input: string; onPick: (v: string) => void;
}) {
  const items = useMemo(() => suggest(pool, input, 6), [pool, input]);
  if (items.length === 0) return null;
  return (
    <View style={s.chips}>
      {items.map((v) => (
        <TouchableOpacity
          key={v}
          style={s.chip}
          onPress={() => { haptic.selection(); onPick(v); }}
          activeOpacity={0.75}
        >
          <Text style={s.chipText} numberOfLines={1}>{v}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function BetsFilterScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const bets = useBetsStore((b) => b.bets);
  const { query, setQuery } = useBetsQuery();

  // A local draft: nothing is applied until OK, so backing out of the screen
  // leaves the list exactly as it was found.
  const [draft, setDraft] = useState<BetsQuery>(query);
  const set = (k: keyof BetsQuery) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const vocab = useMemo(() => betsVocabulary(bets), [bets]);
  const active = countBetsQuery(draft);

  function apply() {
    haptic.selection();
    setQuery(draft);
    navigation.goBack();
  }

  return (
    <View style={s.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.body}
          showsVerticalScrollIndicator={false}
        >
          <Field label="Турнир / лига" hint="Часть названия — «StarLadder» найдёт «StarLadder StarSeries Fall 26»">
            <TextInput
              style={inputStyle}
              placeholder="Любой"
              placeholderTextColor={colors.textMuted}
              value={draft.tournament}
              onChangeText={set('tournament')}
              autoCorrect={false}
            />
            <Suggestions pool={vocab.tournaments} input={draft.tournament} onPick={set('tournament')} />
          </Field>

          <Field label="Команда / спортсмен" hint="Только ставки НА эту команду, а не все матчи с ней">
            <TextInput
              style={inputStyle}
              placeholder="Любая"
              placeholderTextColor={colors.textMuted}
              value={draft.team}
              onChangeText={set('team')}
              autoCorrect={false}
            />
            <Suggestions pool={vocab.teams} input={draft.team} onPick={set('team')} />
          </Field>

          <Field label="Коэффициент">
            <View style={s.pair}>
              <TextInput
                style={[inputStyle, numeric, s.pairCell]}
                placeholder="от"
                placeholderTextColor={colors.textMuted}
                value={draft.oddsFrom}
                onChangeText={set('oddsFrom')}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[inputStyle, numeric, s.pairCell]}
                placeholder="до"
                placeholderTextColor={colors.textMuted}
                value={draft.oddsTo}
                onChangeText={set('oddsTo')}
                keyboardType="decimal-pad"
              />
            </View>
          </Field>

          <Field label="Дата" hint="ГГГГ-ММ-ДД — как в форме ставки">
            <View style={s.pair}>
              <TextInput
                style={[inputStyle, numeric, s.pairCell]}
                placeholder="от"
                placeholderTextColor={colors.textMuted}
                value={draft.dateFrom}
                onChangeText={set('dateFrom')}
                autoCorrect={false}
              />
              <TextInput
                style={[inputStyle, numeric, s.pairCell]}
                placeholder="до"
                placeholderTextColor={colors.textMuted}
                value={draft.dateTo}
                onChangeText={set('dateTo')}
                autoCorrect={false}
              />
            </View>
          </Field>

          <Text style={s.note}>
            Фильтр складывается со статусом и сортировкой — они остаются как выбраны.
          </Text>
        </ScrollView>

        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, SPACE.md) }]}>
          <TouchableOpacity
            style={s.reset}
            onPress={() => { haptic.selection(); setDraft(EMPTY_BETS_QUERY); }}
            activeOpacity={0.75}
            disabled={active === 0}
          >
            <Text style={[s.resetText, active === 0 && s.resetTextOff]}>Сбросить</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.ok} onPress={apply} activeOpacity={0.85}>
            <Text style={s.okText}>ОК{active > 0 ? ` · ${active}` : ''}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { padding: SPACE.lg, paddingBottom: SPACE.xxl },
  field: { marginBottom: SPACE.xl },
  label: { fontSize: SIZE.caption, color: colors.textSecondary, marginBottom: SPACE.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  hint: { fontSize: SIZE.micro, color: colors.textMuted, marginTop: SPACE.xs, lineHeight: 14 },
  pair: { flexDirection: 'row', gap: SPACE.sm },
  pairCell: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.sm },
  chip: {
    minHeight: TOUCH, justifyContent: 'center',
    maxWidth: '100%',
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.sm, backgroundColor: colors.bgElevated,
    borderWidth: 1, borderColor: colors.border,
  },
  chipText: { fontSize: SIZE.body, color: colors.textPrimary },
  note: { fontSize: SIZE.micro, color: colors.textMuted, lineHeight: 15 },
  footer: {
    flexDirection: 'row', gap: SPACE.sm,
    paddingHorizontal: SPACE.lg, paddingTop: SPACE.md,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg,
  },
  reset: {
    minHeight: TOUCH, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: SPACE.lg, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  resetText: { fontSize: SIZE.body, fontWeight: '600', color: colors.textSecondary },
  resetTextOff: { color: colors.textMuted, opacity: 0.5 },
  ok: {
    flex: 1, minHeight: TOUCH, justifyContent: 'center', alignItems: 'center',
    borderRadius: RADIUS.sm, backgroundColor: colors.purple,
  },
  okText: { fontSize: SIZE.lead, fontWeight: '700', color: '#fff' },
});
