import React, { useMemo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { calcGoalProgress, mainGoal } from '@sharklog/core';
import { AppText as Text } from './AppText';
import { AppIcon } from './icons/AppIcon';
import { useBetsStore } from '../store/betsStore';
import { useCompactMoney } from '../utils/useFormatMoney';
import { goalPercent } from '../utils/goalText';
import { colors } from '../theme/colors';
import { themedStyles } from '../theme/themed';
import { SPACE, RADIUS, TOUCH } from '../theme/layout';
import { SIZE, GLYPH, numeric } from '../theme/typography';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * The header button of the bets screen: the main goal's target AND how far it
 * has come — "12% · 150 тыс ₽" over a bar. The target alone never changes and
 * stops being read after a day; the share moves with every bet. No goal yet —
 * an invitation.
 */
export function GoalPill() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const compact = useCompactMoney();
  const goals = useBetsStore((s) => s.goals);
  const bets = useBetsStore((s) => s.bets);
  const transactions = useBetsStore((s) => s.bankroll.transactions);
  const goal = mainGoal(goals);
  const p = useMemo(() => (goal ? calcGoalProgress(goal, bets, transactions) : null), [goal, bets, transactions]);

  const open = () => navigation.navigate('Goals');

  if (!goal || !p) {
    return (
      <TouchableOpacity
        style={[pill.box, pill.row]}
        onPress={open}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={t('goals.pillAddA11y')}
      >
        <AppIcon name="goals" size={GLYPH.md} color={colors.purpleText} />
        <Text style={pill.add}>{t('goals.pillAdd')}</Text>
      </TouchableOpacity>
    );
  }

  const cur = compact(p.current);
  const target = compact(p.target);
  // A loss cap fills toward trouble; a goal fills toward success.
  const tint = p.kind === 'lossCap'
    ? (p.capState === 'over' ? colors.lost : p.capState === 'near' ? colors.pending : colors.accent)
    : p.achieved ? colors.accent : colors.purpleText;

  return (
    <TouchableOpacity
      style={[pill.box, pill.row]}
      onPress={open}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={t('goals.pillA11y', { title: goal.title, cur, target })}
    >
      <AppIcon name="goals" size={GLYPH.md} color={tint} />
      <View style={pill.texts}>
        {/* Share and target, not "current / target": two short sums still ran
            past a 190 pt button and cut the target to "150 т…". */}
        <Text style={pill.value} numberOfLines={1} adjustsFontSizeToFit>
          {p.achieved ? '✓' : `${goalPercent(p.ratio)}%`}
          <Text style={pill.of}> · {target}</Text>
        </Text>
        <View style={pill.track}>
          <View style={[pill.fill, { width: `${Math.round(p.ratio * 100)}%`, backgroundColor: tint }]} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const pill = themedStyles(() => ({
  box: {
    minHeight: TOUCH, maxWidth: 190, justifyContent: 'center',
    paddingHorizontal: SPACE.md, borderRadius: RADIUS.pill,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  add: { fontSize: SIZE.body, fontWeight: '700', color: colors.purpleText },
  texts: { flexShrink: 1, gap: SPACE.xs },
  value: { ...numeric, fontSize: SIZE.caption, fontWeight: '700', color: colors.textPrimary },
  of: { ...numeric, fontSize: SIZE.caption, fontWeight: '400', color: colors.textMuted },
  track: { height: 3, borderRadius: RADIUS.pill, backgroundColor: colors.bgElevated, overflow: 'hidden' },
  fill: { height: 3, borderRadius: RADIUS.pill },
}));
