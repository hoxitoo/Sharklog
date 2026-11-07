import { View, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { addDays, PACE_MIN_DAYS, toYmd, type Goal, type GoalProgress } from '@sharklog/core';
import { AppText as Text } from '../../components/AppText';
import { cardSurface } from '../../components/Card';
import { useFormatMoney } from '../../utils/useFormatMoney';
import { dayLabel, durationLabel, goalPercent } from '../../utils/goalText';
import { colors, signalInk, signalTint } from '../../theme/colors';
import { themedStyles } from '../../theme/themed';
import { SPACE, RADIUS, TOUCH } from '../../theme/layout';
import { SIZE, numeric } from '../../theme/typography';
import { GoalChart } from './GoalChart';

/** A percentage the way people say it: "55%", "3.4%". */
const pct = (n: number) => (Math.abs(n) >= 10 ? Math.round(n) : Math.round(n * 10) / 10).toString();

interface Props {
  goal: Goal;
  p: GoalProgress;
  /** The first active goal: on the header button, with the chart. */
  main: boolean;
  isPro: boolean;
  /** A losing streak right now: "behind schedule" is not what to say then. */
  inTilt: boolean;
  onEdit: () => void;
  onMakeMain: () => void;
  onPaywall: () => void;
  onBankroll: () => void;
}

export function GoalCard(props: Props) {
  return props.goal.kind === 'lossCap' ? <LossCapCard {...props} /> : <AccumulationCard {...props} />;
}

function Head({ goal, main, onEdit }: Pick<Props, 'goal' | 'main' | 'onEdit'>) {
  const { t } = useTranslation();
  return (
    <View style={card.head}>
      <View style={card.chips}>
        <Text style={card.kind}>{t(`goals.kind.${goal.kind}`)}</Text>
        {main ? <Text style={card.mainBadge}>{t('goals.main')}</Text> : null}
      </View>
      <TouchableOpacity
        onPress={onEdit}
        style={card.editBtn}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('goals.editA11y', { title: goal.title })}
      >
        <Text style={card.editText}>{t('goals.edit')}</Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * What moves this goal, in full. The kind sheet says it in one sentence; here,
 * next to the numbers it explains, there is room for the cases people ask
 * about — a cash-out, a deposit, a bet still in play.
 */
function How({ goal }: { goal: Goal }) {
  const { t } = useTranslation();
  return (
    <View style={card.how}>
      <Text style={card.howTitle}>{t('goals.howTitle')}</Text>
      <Text style={card.howText}>{t(`goals.how.${goal.kind}`, { date: dayLabel(goal.startDate) })}</Text>
    </View>
  );
}

function Bar({ ratio, color }: { ratio: number; color: string }) {
  return (
    <View style={card.track}>
      <View style={[card.fill, { width: `${goalPercent(ratio)}%`, backgroundColor: color }]} />
    </View>
  );
}

function AccumulationCard({ goal, p, main, isPro, inTilt, onEdit, onMakeMain, onPaywall, onBankroll }: Props) {
  const { t } = useTranslation();
  const fmt = useFormatMoney();
  const today = toYmd(new Date());
  const tint = p.achieved ? colors.accent : colors.purpleText;

  let when: string;
  if (!p.started) when = t('goals.startsOn', { date: dayLabel(goal.startDate) });
  else if (!goal.deadline) when = t('goals.noDeadline');
  else if (p.expired) when = t('goals.expired', { date: dayLabel(goal.deadline) });
  // Reached, and the deadline is behind: not "by … · 0 d left".
  else if ((p.daysLeft ?? 0) < 0) when = t('goals.deadlineWas', { date: dayLabel(goal.deadline) });
  else when = t('goals.until', { date: dayLabel(goal.deadline), left: durationLabel(t, p.daysLeft ?? 0) });

  return (
    <View style={[card.box, main && card.boxMain]}>
      <Head goal={goal} main={main} onEdit={onEdit} />
      <Text style={card.title}>{goal.title}</Text>

      <Text style={[card.amount, { color: p.current < 0 ? colors.lost : p.achieved ? colors.accent : colors.textPrimary }]}>
        {fmt(p.current)}
        <Text style={card.amountOf}> / {fmt(p.target)}</Text>
      </Text>
      <Bar ratio={p.ratio} color={tint} />
      <View style={card.metaRow}>
        <Text style={card.meta}>{goalPercent(p.ratio)}%</Text>
        {!p.achieved ? <Text style={card.meta}>{t('goals.left', { amount: fmt(p.remaining) })}</Text> : null}
      </View>
      <Text style={card.when}>{when}</Text>

      {p.achieved ? (
        <View style={card.done}>
          <Text style={card.doneTitle}>{t('goals.achieved')}</Text>
          {goal.kind !== 'withdraw' ? (
            <>
              <Text style={card.doneText}>{t('goals.achievedHint')}</Text>
              <TouchableOpacity style={card.doneBtn} onPress={onBankroll} activeOpacity={0.8}>
                <Text style={card.doneBtnText}>{t('goals.toBankroll')}</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : null}

      {/* On a losing streak the whole block goes, not one sentence: a negative
          pace, "not getting closer" and a "needed per month" that grows after
          every loss all say "chase". The tilt note above says what to do. */}
      {p.started && !p.achieved && !p.expired && !inTilt ? (
        <View style={card.pace}>
          {p.needPerMonth !== null ? (
            <Row label={t('goals.needPerMonth')} value={fmt(Math.round(p.needPerMonth))} />
          ) : null}
          {isPro ? (
            <>
              {p.pacePerMonth !== null ? (
                <Row
                  // A bank goal's pace is its bets: a deposit is a lump sum, not a pace.
                  label={t(goal.kind === 'bank' ? 'goals.paceBets' : 'goals.pace', { d: p.paceDays })}
                  value={fmt(Math.round(p.pacePerMonth))}
                  color={p.pacePerMonth < 0 ? colors.lost : undefined}
                />
              ) : (
                <Text style={card.note}>{t('goals.paceFew', { d: PACE_MIN_DAYS - p.paceDays })}</Text>
              )}
              {p.pacePerMonth !== null ? (
                <Text style={card.note}>
                  {p.projectedDays === null
                    ? t('goals.projectedNever')
                    : p.projectedDays > 3650
                      ? t('goals.projectedFar')
                      : t('goals.projected', { date: dayLabel(addDays(today, p.projectedDays)) })}
                </Text>
              ) : null}
              {p.onTrack !== null ? (
                <Text style={[card.track_, { color: p.onTrack ? signalInk(colors.won) : signalInk(colors.pending) }]}>
                  {t(p.onTrack ? 'goals.onTrack' : 'goals.offTrack')}
                </Text>
              ) : null}
              {p.roiNeeded !== null && p.roiNow !== null ? (
                <View style={card.reality}>
                  <Text style={card.realityTitle}>{t('goals.roiCheckTitle')}</Text>
                  <Text style={card.realityText}>{t('goals.roiCheck', { need: pct(p.roiNeeded), now: pct(p.roiNow), n: p.roiBets })}</Text>
                </View>
              ) : null}
            </>
          ) : (
            <TouchableOpacity style={card.locked} onPress={onPaywall} activeOpacity={0.75} accessibilityRole="button">
              <Text style={card.lockedText}>{t('goals.proLocked')}</Text>
              <Text style={card.proBadge}>{t('common.pro')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {p.pendingCount > 0 ? (
        <Text style={card.note}>{t('goals.inPlay', { n: p.pendingCount, amount: fmt(p.inPlayStake) })}</Text>
      ) : null}

      {main ? <GoalChart goal={goal} p={p} /> : null}

      <How goal={goal} />

      {goal.note ? <Text style={card.userNote}>{goal.note}</Text> : null}

      {!main ? (
        <TouchableOpacity style={card.linkBtn} onPress={onMakeMain} activeOpacity={0.7} accessibilityRole="button">
          <Text style={card.link}>{t('goals.makeMain')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function LossCapCard({ goal, p, main, onEdit, onMakeMain }: Props) {
  const { t } = useTranslation();
  const fmt = useFormatMoney();
  const month = t(`monthsLong.${new Date().getMonth() + 1}`);
  const tone = p.capState === 'over' ? colors.lost : p.capState === 'near' ? colors.pending : colors.accent;
  const state = p.capState === 'over'
    ? t('goals.capOver', { amount: fmt(p.current - p.target) })
    : p.capState === 'near'
      ? t('goals.capNear', { amount: fmt(p.remaining) })
      : t('goals.capOk', { amount: fmt(p.remaining) });

  return (
    <View style={[card.box, main && card.boxMain]}>
      <Head goal={goal} main={main} onEdit={onEdit} />
      <Text style={card.title}>{goal.title}</Text>
      <Text style={card.capLine}>{t('goals.capMonth', { month, loss: fmt(p.current), cap: fmt(p.target) })}</Text>
      <Bar ratio={p.ratio} color={tone} />
      <Text style={[card.capState, { color: signalInk(tone) }]}>{state}</Text>
      {p.started ? (
        <Text style={card.when}>{t('goals.capDays', { left: durationLabel(t, p.daysLeft ?? 0) })}</Text>
      ) : (
        <Text style={card.when}>{t('goals.startsOn', { date: dayLabel(goal.startDate) })}</Text>
      )}
      {p.wouldExceed ? <Text style={card.note}>{t('goals.capRisk', { amount: fmt(p.pendingStake) })}</Text> : null}
      <How goal={goal} />
      {goal.note ? <Text style={card.userNote}>{goal.note}</Text> : null}
      {!main ? (
        <TouchableOpacity style={card.linkBtn} onPress={onMakeMain} activeOpacity={0.7} accessibilityRole="button">
          <Text style={card.link}>{t('goals.makeMain')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string | undefined }) {
  return (
    <View style={card.row}>
      <Text style={card.rowLabel}>{label}</Text>
      <Text style={[card.rowValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const card = themedStyles(() => ({
  box: { ...cardSurface, padding: SPACE.lg, marginBottom: SPACE.md },
  boxMain: { borderColor: colors.purple },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flexShrink: 1 },
  kind: { fontSize: SIZE.micro, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  mainBadge: {
    fontSize: SIZE.micro, fontWeight: '700', color: signalInk(colors.purpleText),
    backgroundColor: signalTint(colors.purpleText, 0.133), borderRadius: RADIUS.xs,
    paddingHorizontal: SPACE.xs, paddingVertical: 1, overflow: 'hidden',
  },
  editBtn: { minHeight: TOUCH, justifyContent: 'center', paddingLeft: SPACE.md },
  editText: { fontSize: SIZE.caption, fontWeight: '700', color: colors.purpleText },
  title: { fontSize: SIZE.title, fontWeight: '700', color: colors.textPrimary, marginBottom: SPACE.sm },
  amount: { ...numeric, fontSize: SIZE.hero, fontWeight: '700' },
  amountOf: { ...numeric, fontSize: SIZE.body, fontWeight: '400', color: colors.textMuted },
  track: { height: 8, borderRadius: RADIUS.pill, backgroundColor: colors.bgElevated, overflow: 'hidden', marginTop: SPACE.sm },
  fill: { height: 8, borderRadius: RADIUS.pill },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACE.xs },
  meta: { ...numeric, fontSize: SIZE.caption, fontWeight: '400', color: colors.textSecondary },
  when: { fontSize: SIZE.caption, color: colors.textMuted, marginTop: SPACE.xs },
  done: {
    marginTop: SPACE.md, padding: SPACE.md, borderRadius: RADIUS.md,
    backgroundColor: signalTint(colors.won, 0.133), borderWidth: 1, borderColor: signalTint(colors.won, 0.333),
  },
  doneTitle: { fontSize: SIZE.body, fontWeight: '700', color: signalInk(colors.won) },
  doneText: { fontSize: SIZE.caption, color: colors.textSecondary, marginTop: SPACE.xs, lineHeight: 17 },
  doneBtn: { minHeight: TOUCH, justifyContent: 'center', alignSelf: 'flex-start' },
  doneBtnText: { fontSize: SIZE.body, fontWeight: '700', color: colors.purpleText },
  pace: { marginTop: SPACE.md, gap: SPACE.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: SPACE.md },
  rowLabel: { fontSize: SIZE.body, color: colors.textSecondary, flexShrink: 1 },
  rowValue: { ...numeric, fontSize: SIZE.body, fontWeight: '700', color: colors.textPrimary },
  note: { fontSize: SIZE.caption, color: colors.textSecondary, lineHeight: 17, marginTop: SPACE.xs },
  track_: { fontSize: SIZE.caption, fontWeight: '700' },
  reality: {
    marginTop: SPACE.sm, padding: SPACE.md, borderRadius: RADIUS.md,
    backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border,
  },
  realityTitle: { fontSize: SIZE.caption, fontWeight: '700', color: colors.textPrimary },
  realityText: { fontSize: SIZE.caption, color: colors.textSecondary, lineHeight: 17, marginTop: SPACE.xs },
  locked: {
    minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    paddingHorizontal: SPACE.md, borderRadius: RADIUS.md, backgroundColor: colors.bgElevated, marginTop: SPACE.xs,
  },
  lockedText: { flex: 1, fontSize: SIZE.caption, color: colors.textSecondary },
  proBadge: { fontSize: SIZE.micro, fontWeight: '800', color: colors.gold },
  how: { marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: colors.border },
  howTitle: { fontSize: SIZE.micro, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  howText: { fontSize: SIZE.caption, color: colors.textSecondary, lineHeight: 17, marginTop: SPACE.xs },
  userNote: {
    fontSize: SIZE.body, color: colors.textSecondary, lineHeight: 20, marginTop: SPACE.md,
    paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: colors.border,
  },
  linkBtn: { minHeight: TOUCH, justifyContent: 'center', alignSelf: 'flex-start', marginTop: SPACE.xs },
  link: { fontSize: SIZE.body, fontWeight: '700', color: colors.purpleText },
  // A sentence with sums in it, not a column of sums: the wide mono face pushed
  // the currency sign onto a line of its own at 360 dp.
  capLine: { fontSize: SIZE.body, fontWeight: '700', color: colors.textPrimary },
  capState: { fontSize: SIZE.caption, fontWeight: '700', marginTop: SPACE.sm },
}));
