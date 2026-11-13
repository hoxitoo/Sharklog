import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { isInTilt } from '@sharklog/core';
import { PaywallSheet } from '../../components/PaywallSheet';
import { useBetsStore, effectiveTiltThreshold } from '../../store/betsStore';
import { useBottomPad } from '../../utils/useBottomPad';
import { useGoalBoard } from '../../utils/useGoalBoard';
import { colors } from '../../theme/colors';
import { themedStyles } from '../../theme/themed';
import { SPACE } from '../../theme/layout';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { GoalCard } from '../GoalsScreen/GoalCard';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * One goal, whole: what a reached goal's folded line on the goals screen opens
 * — when it was reached, in how many days, the bets' result per day, and the
 * chart. The same card as on the list, so the two never say different things.
 */
export function GoalScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'Goal'>>();
  const focused = useIsFocused();
  const { t } = useTranslation();
  const bottomPad = useBottomPad(SPACE.xxl);
  const bets = useBetsStore((s) => s.bets);
  const isPro = useBetsStore((s) => s.settings.isPro);
  const tiltThreshold = useBetsStore((s) => effectiveTiltThreshold(s.settings));
  const makeMainGoal = useBetsStore((s) => s.makeMainGoal);
  const [paywall, setPaywall] = useState(false);
  const closePaywall = useCallback(() => setPaywall(false), []);

  // Only a goal the goals screen shows: deleted or archived from its edit
  // form, or locked when Pro ended, it is not this screen's any more.
  const { progress, open, main } = useGoalBoard();
  const goal = open.find((g) => g.id === route.params.goalId);
  // On a losing streak the card hides the pace block (the goals screen says why).
  const inTilt = useMemo(() => isInTilt(bets, tiltThreshold), [bets, tiltThreshold]);

  // Back to the list once the goal is gone — only while this screen is on top:
  // a goBack fired from under the edit form would close the form too.
  useEffect(() => {
    if (!goal && focused) navigation.goBack();
  }, [goal, focused, navigation]);

  const p = goal ? progress.get(goal.id) : undefined;
  if (!goal || !p) return <View style={s.root} />;

  return (
    <View style={s.root}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.scroll, { paddingBottom: bottomPad }]}>
        <GoalCard
          goal={goal}
          p={p}
          main={goal.id === main?.id}
          chart
          isPro={isPro}
          inTilt={inTilt}
          onEdit={() => navigation.navigate('GoalEdit', { goalId: goal.id })}
          onMakeMain={() => makeMainGoal(goal.id)}
          onPaywall={() => setPaywall(true)}
          onBankroll={() => navigation.navigate('Bankroll')}
        />
      </ScrollView>
      <PaywallSheet visible={paywall} onClose={closePaywall} feature={t('goals.proFeature')} />
    </View>
  );
}

const s = themedStyles(() => ({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: SPACE.lg },
}));
