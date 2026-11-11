import { useMemo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { calcGoalProgress, goalsFor, mainGoal, toYmd, FREE_LIMITS, type Goal, type GoalProgress } from '@sharklog/core';
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
  const isPro = useBetsStore((s) => s.settings.isPro);
  // The day is in the key: a month's loss cap must reset at midnight even when
  // no bet was saved since (the bets screen stays mounted for hours).
  const today = toYmd(new Date());
  // The goals screen's main goal: the first OPEN one still to reach — a
  // reached goal is done and folded at the bottom there, so the button moves on.
  const { goal, p } = useMemo(() => {
    const seen = new Map<string, GoalProgress>();
    const of = (g: Goal) => {
      let hit = seen.get(g.id);
      if (!hit) { hit = calcGoalProgress(g, bets, transactions); seen.set(g.id, hit); }
      return hit;
    };
    const { open } = goalsFor(goals, isPro, FREE_LIMITS.MAX_GOALS);
    const main = mainGoal(open, (g) => of(g).achieved);
    return { goal: main, p: main ? of(main) : null };
  }, [goals, isPro, bets, transactions, today]); // `today`: re-run after midnight

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
      {/* Two short lines, not "current / target" on one: that ran past the
          button and cut the target to "150 т…", and a wide button squeezed the
          screen title ("Ставкалар") on a 360 dp phone. */}
      <View style={pill.texts}>
        <Text style={pill.value} numberOfLines={1}>{p.achieved ? '✓' : `${goalPercent(p.ratio)}%`}</Text>
        <Text style={pill.of} numberOfLines={1}>{target}</Text>
        <View style={pill.track}>
          <View style={[pill.fill, { width: `${goalPercent(p.ratio)}%`, backgroundColor: tint }]} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const pill = themedStyles(() => ({
  box: {
    minHeight: TOUCH, maxWidth: 136, justifyContent: 'center',
    paddingHorizontal: SPACE.md, borderRadius: RADIUS.pill,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  add: { fontSize: SIZE.body, fontWeight: '700', color: colors.purpleText },
  texts: { flexShrink: 1, gap: 1 },
  value: { ...numeric, fontSize: SIZE.caption, fontWeight: '700', color: colors.textPrimary },
  of: { ...numeric, fontSize: SIZE.micro, fontWeight: '400', color: colors.textMuted },
  track: { height: 3, borderRadius: RADIUS.pill, backgroundColor: colors.bgElevated, overflow: 'hidden' },
  fill: { height: 3, borderRadius: RADIUS.pill },
}));
