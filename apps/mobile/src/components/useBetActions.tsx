import React, { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Bet, BetStatus } from '@sharklog/core';
import { formatMoney } from '@sharklog/core';
import { useTranslation } from 'react-i18next';
import { useBetsStore } from '../store/betsStore';
import { colors } from '../theme/colors';
import { haptic } from '../utils/haptics';
import { ActionWheel, type WheelAction } from './ActionWheel';
import { displayEvent } from '../screens/BetsScreen/BetCard';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATUS_META: Array<{
  key: BetStatus;
  icon: WheelAction['icon'];
  color: string;
}> = [
  { key: 'won',     icon: 'checkmark-circle-outline', color: colors.won },
  { key: 'lost',    icon: 'close-circle-outline',     color: colors.lost },
  { key: 'refund',  icon: 'arrow-undo-outline',       color: colors.refund },
  { key: 'cashout', icon: 'cash-outline',             color: colors.refund },
  { key: 'pending', icon: 'time-outline',             color: colors.pending },
];

/**
 * Everything a bet card can do, as one radial menu.
 *
 * Both the bets list and the pending screen show BetCard, so the actions live
 * here rather than in either screen — two copies of a menu drift, and the wedge
 * positions have to stay identical for the muscle memory to be worth anything.
 *
 * The hook also owns which card has its inline cashout field open: "Выкуп" only
 * reveals that field, it never settles on its own, and holding the id here means
 * two cards can never be left open at once.
 */
export function useBetActions() {
  const navigation = useNavigation<Nav>();
  const { updateBet, deleteBet } = useBetsStore();
  const { t } = useTranslation();

  const [bet, setBet] = useState<Bet | null>(null);
  const [level, setLevel] = useState<'root' | 'status'>('root');
  const [cashoutFor, setCashoutFor] = useState<string | null>(null);

  function open(target: Bet) {
    haptic.light();
    setLevel('root');
    setBet(target);
  }

  function close() {
    setBet(null);
    setLevel('root');
  }

  const statusAction = (key: BetStatus): WheelAction => {
    const meta = STATUS_META.find((m) => m.key === key)!;
    return { key, label: t(`status.${key}`), icon: meta.icon, color: meta.color };
  };

  const actions: WheelAction[] = useMemo(() => {
    if (!bet) return [];
    const common: WheelAction[] = [
      { key: 'duplicate', label: t('bet.duplicate'), icon: 'copy-outline',   color: colors.purpleText },
      { key: 'edit',      label: t('bet.editShort'), icon: 'create-outline', color: colors.textSecondary },
      { key: 'delete',    label: t('common.delete'), icon: 'trash-outline',  danger: true },
    ];
    // Offering the status a bet already has would be a dead wedge.
    if (level === 'status') {
      return STATUS_META.filter((m) => m.key !== bet.status).map((m) => statusAction(m.key));
    }
    // A pending bet is almost always opened to settle it, so the outcomes are one
    // tap away; a settled one only needs the rarer "change the result".
    return bet.status === 'pending'
      ? [
          ...STATUS_META.filter((m) => m.key !== 'pending').map((m) => statusAction(m.key)),
          ...common,
        ]
      : [
          { key: 'status', label: t('bet.changeResult'), icon: 'swap-horizontal-outline', color: colors.pending },
          ...common,
        ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bet, level, t]);

  /** Moving off `cashout` must drop the stored amount, or it resurrects on edit. */
  function setStatus(target: Bet, status: BetStatus) {
    // updateBet merges, so an omitted key keeps its old value — the amount has to
    // be passed explicitly as undefined to actually clear it.
    updateBet(target.id, {
      status,
      cashoutAmount: target.status === 'cashout' ? undefined : target.cashoutAmount,
    } as Partial<Bet>);
  }

  function select(key: string) {
    if (!bet) return;
    if (key === 'status') { haptic.selection(); setLevel('status'); return; }

    close();
    // The wheel's Modal unmounts on this commit. Anything that presents another
    // native surface — an alert, a modal screen, a field that grabs focus — has
    // to wait a frame, or it can be dismissed along with the wheel or never take
    // focus at all. Status writes are pure JS and need no such care.
    const afterWheel = (fn: () => void) => requestAnimationFrame(fn);

    switch (key) {
      case 'won':     haptic.success(); setStatus(bet, 'won'); break;
      case 'lost':    haptic.error();   setStatus(bet, 'lost'); break;
      case 'refund':  haptic.warning(); setStatus(bet, 'refund'); break;
      case 'pending': haptic.warning(); setStatus(bet, 'pending'); break;
      // The amount is typed inline on the card — this only reveals that field.
      case 'cashout': haptic.selection(); afterWheel(() => setCashoutFor(bet.id)); break;
      case 'duplicate':
        haptic.selection();
        afterWheel(() => navigation.navigate('AddBet', { duplicateOf: bet.id }));
        break;
      case 'edit':
        haptic.selection();
        afterWheel(() => navigation.navigate('AddBet', { betId: bet.id }));
        break;
      case 'delete': {
        haptic.warning();
        const target = bet;
        afterWheel(() => {
          Alert.alert(
            t('bet.confirmDelete'),
            `${displayEvent(target.event)}\n${target.pick} · ${formatMoney(target.stake)}`,
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('common.delete'),
                style: 'destructive',
                onPress: () => { haptic.error(); deleteBet(target.id); },
              },
            ],
          );
        });
        break;
      }
    }
  }

  const element = (
    <ActionWheel
      visible={bet !== null}
      {...(bet ? {
        title: displayEvent(bet.event),
        subtitle: `${bet.pick} · × ${bet.odds.toFixed(2)} · ${formatMoney(bet.stake)}`,
      } : {})}
      actions={actions}
      onSelect={select}
      onClose={() => (level === 'status' ? setLevel('root') : close())}
      centerIcon={level === 'status' ? 'arrow-back' : 'close'}
    />
  );

  return {
    open,
    element,
    /** Id of the card whose inline cashout field is open, if any. */
    cashoutFor,
    openCashout: (id: string) => setCashoutFor(id),
    closeCashout: () => setCashoutFor(null),
  };
}
