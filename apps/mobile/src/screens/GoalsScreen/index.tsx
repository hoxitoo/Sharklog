import { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { activeGoals, calcGoalProgress, goalsFor, isInTilt, mainGoal, toYmd, FREE_LIMITS, type Goal, type GoalProgress } from '@sharklog/core';
import { AppText as Text } from '../../components/AppText';
import { AppIcon } from '../../components/icons/AppIcon';
import { PaywallSheet } from '../../components/PaywallSheet';
import { useBetsStore, effectiveTiltThreshold } from '../../store/betsStore';
import { useBottomPad } from '../../utils/useBottomPad';
import { useFormatMoney } from '../../utils/useFormatMoney';
import { colors, signalInk, signalTint } from '../../theme/colors';
import { themedStyles } from '../../theme/themed';
import { SPACE, RADIUS, TOUCH } from '../../theme/layout';
import { SIZE, GLYPH, numeric } from '../../theme/typography';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { GoalCard } from './GoalCard';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Goals: what the book is working toward, measured from the bets themselves.
 * The first goal still to reach is the main one (mainGoal) — on the bets
 * screen's header button, with the chart. A reached goal is done: it folds to
 * one line at the bottom, and a tap opens it whole on its own screen (when it
 * was reached, what it took). Free keeps one active goal; more goals, the pace
 * and the reality check are Pro.
 */
export function GoalsScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const fmt = useFormatMoney();
  const bottomPad = useBottomPad(SPACE.xxl);
  const goals = useBetsStore((s) => s.goals);
  const bets = useBetsStore((s) => s.bets);
  const transactions = useBetsStore((s) => s.bankroll.transactions);
  const isPro = useBetsStore((s) => s.settings.isPro);
  const tiltThreshold = useBetsStore((s) => effectiveTiltThreshold(s.settings));
  const makeMainGoal = useBetsStore((s) => s.makeMainGoal);
  const [showArchive, setShowArchive] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const closePaywall = useCallback(() => setPaywall(false), []);

  const active = useMemo(() => activeGoals(goals), [goals]);
  // Free opens one goal; the rest stay stored, locked — a trial that ended or a
  // Pro phone's backup must not leave every goal open (goalsFor).
  const { open, locked } = useMemo(() => goalsFor(goals, isPro, FREE_LIMITS.MAX_GOALS), [goals, isPro]);
  const archived = useMemo(() => goals.filter((g) => g.archived), [goals]);
  const today = toYmd(new Date());
  const progress = useMemo(() => {
    const out = new Map<string, GoalProgress>();
    for (const g of goals) out.set(g.id, calcGoalProgress(g, bets, transactions));
    return out;
  }, [goals, bets, transactions, today]); // `today`: re-run after midnight
  const inTilt = useMemo(() => isInTilt(bets, tiltThreshold), [bets, tiltThreshold]);
  // Still to reach — full cards, the main one first; reached — one line each, below.
  const { main, going, reached } = useMemo(() => {
    const isReached = (g: Goal) => progress.get(g.id)!.achieved;
    return { main: mainGoal(open, isReached), going: open.filter((g) => !isReached(g)), reached: open.filter(isReached) };
  }, [open, progress]);

  function addGoal() {
    if (!isPro && active.length >= FREE_LIMITS.MAX_GOALS) {
      setPaywall(true);
      return;
    }
    navigation.navigate('GoalEdit', {});
  }

  const edit = (id: string) => navigation.navigate('GoalEdit', { goalId: id });

  return (
    <View style={s.root}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.scroll, { paddingBottom: bottomPad }]}>
        {inTilt && active.length > 0 ? (
          <View style={s.tilt}>
            <Text style={s.tiltText}>{t('goals.tiltNote')}</Text>
          </View>
        ) : null}

        {active.length === 0 ? (
          <View style={s.empty}>
            <AppIcon name="goals" size={GLYPH.hero} color={colors.purpleText} />
            <Text style={s.emptyTitle}>{t('goals.emptyTitle')}</Text>
            <Text style={s.emptyText}>{t('goals.emptyText')}</Text>
          </View>
        ) : (
          going.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              p={progress.get(g.id)!}
              main={g.id === main?.id}
              chart={g.id === main?.id}
              isPro={isPro}
              inTilt={inTilt}
              onEdit={() => edit(g.id)}
              onMakeMain={() => makeMainGoal(g.id)}
              onPaywall={() => setPaywall(true)}
              onBankroll={() => navigation.navigate('Bankroll')}
            />
          ))
        )}

        {reached.length > 0 ? <Text style={s.sectionLabel}>{t('goals.reachedSection')}</Text> : null}
        {reached.map((g) => (
          <TouchableOpacity
            key={g.id}
            style={s.archived}
            onPress={() => navigation.navigate('Goal', { goalId: g.id })}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={t('goals.reachedRowA11y', { title: g.title })}
          >
            <Text style={s.check}>✓</Text>
            <Text style={s.archivedTitle} numberOfLines={1}>{g.title}</Text>
            <Text style={s.reachedValue}>{fmt(progress.get(g.id)!.current)}</Text>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        ))}

        {locked.map((g) => (
          <TouchableOpacity
            key={g.id}
            style={s.archived}
            onPress={() => setPaywall(true)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityHint={t('goals.lockedHint')}
          >
            <View style={s.lockedText}>
              <Text style={s.archivedTitle} numberOfLines={1}>{g.title}</Text>
              <Text style={s.lockedHint}>{t('goals.lockedHint')}</Text>
            </View>
            <Text style={s.proBadge}>{t('common.pro')}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={s.addBtn} onPress={addGoal} activeOpacity={0.8} accessibilityRole="button">
          <Text style={s.addText}>＋ {t('goals.add')}</Text>
          {!isPro && active.length >= FREE_LIMITS.MAX_GOALS ? <Text style={s.proBadge}>{t('common.pro')}</Text> : null}
        </TouchableOpacity>

        {archived.length > 0 ? (
          <>
            <TouchableOpacity
              style={s.archiveToggle}
              onPress={() => setShowArchive((v) => !v)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ expanded: showArchive }}
            >
              <Text style={s.archiveText}>{t('goals.archive', { n: archived.length })}</Text>
              <Text style={s.archiveText}>{showArchive ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showArchive ? archived.map((g) => {
              const p = progress.get(g.id)!;
              return (
                <TouchableOpacity key={g.id} style={s.archived} onPress={() => edit(g.id)} activeOpacity={0.75}>
                  <Text style={s.archivedTitle} numberOfLines={1}>{g.title}</Text>
                  <Text style={s.archivedValue}>{fmt(p.current)} / {fmt(p.target)}</Text>
                </TouchableOpacity>
              );
            }) : null}
          </>
        ) : null}

        <Text style={s.disclaimer}>{t('goals.disclaimer')}</Text>
      </ScrollView>
      <PaywallSheet visible={paywall} onClose={closePaywall} feature={t('goals.proFeature')} />
    </View>
  );
}

const s = themedStyles(() => ({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: SPACE.lg },
  tilt: {
    padding: SPACE.md, borderRadius: RADIUS.md, marginBottom: SPACE.md,
    backgroundColor: signalTint(colors.pending, 0.094), borderWidth: 1, borderColor: signalTint(colors.pending, 0.333),
  },
  tiltText: { fontSize: SIZE.caption, fontWeight: '600', color: signalInk(colors.pending), lineHeight: 17 },
  empty: { alignItems: 'center', paddingVertical: SPACE.xxl, paddingHorizontal: SPACE.lg, gap: SPACE.sm },
  emptyTitle: { fontSize: SIZE.title, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  emptyText: { fontSize: SIZE.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  addBtn: {
    minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm,
    backgroundColor: colors.purple, borderRadius: RADIUS.md, paddingHorizontal: SPACE.lg, marginTop: SPACE.xs,
  },
  addText: { fontSize: SIZE.lead, fontWeight: '700', color: '#fff' },
  proBadge: { fontSize: SIZE.micro, fontWeight: '800', color: colors.onGold, backgroundColor: colors.gold, borderRadius: RADIUS.xs, paddingHorizontal: SPACE.xs, overflow: 'hidden' },
  archiveToggle: {
    minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACE.lg,
  },
  archiveText: { fontSize: SIZE.caption, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  archived: {
    minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md,
    paddingHorizontal: SPACE.md, borderRadius: RADIUS.md, backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border, marginBottom: SPACE.sm,
  },
  archivedTitle: { flex: 1, fontSize: SIZE.body, color: colors.textSecondary },
  lockedText: { flex: 1, paddingVertical: SPACE.sm },
  lockedHint: { fontSize: SIZE.caption, color: colors.textMuted, marginTop: 2 },
  archivedValue: { ...numeric, fontSize: SIZE.caption, fontWeight: '400', color: colors.textMuted },
  sectionLabel: {
    fontSize: SIZE.caption, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: SPACE.sm, marginBottom: SPACE.sm,
  },
  check: { fontSize: SIZE.body, fontWeight: '700', color: signalInk(colors.won) },
  reachedValue: { ...numeric, fontSize: SIZE.caption, fontWeight: '700', color: signalInk(colors.won) },
  chevron: { fontSize: SIZE.title, fontWeight: '400', color: colors.textMuted },
  disclaimer: { fontSize: SIZE.caption, color: colors.textMuted, lineHeight: 17, marginTop: SPACE.xl, textAlign: 'center' },
}));
