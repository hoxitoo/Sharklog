import React, { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Bet } from '@sharklog/core';
import { formatMoney } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';
import { colors } from '../theme/colors';
import { haptic } from '../utils/haptics';
import { ActionWheel, type WheelAction } from './ActionWheel';
import { displayEvent } from '../screens/BetsScreen/BetCard';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATUS_ACTIONS: WheelAction[] = [
  { key: 'won',     label: 'Победа',     icon: 'checkmark-circle-outline', color: colors.won },
  { key: 'lost',    label: 'Поражение',  icon: 'close-circle-outline',     color: colors.lost },
  { key: 'refund',  label: 'Возврат',    icon: 'arrow-undo-outline',       color: colors.refund },
  { key: 'cashout', label: 'Выкуп',      icon: 'cash-outline',             color: colors.refund },
  { key: 'pending', label: 'В ожидание', icon: 'time-outline',             color: colors.pending },
];

const COMMON_ACTIONS: WheelAction[] = [
  { key: 'duplicate', label: 'Копия',    icon: 'copy-outline',   color: colors.purpleText },
  { key: 'edit',      label: 'Изменить', icon: 'create-outline', color: colors.textSecondary },
  { key: 'delete',    label: 'Удалить',  icon: 'trash-outline',  danger: true },
];

/**
 * Everything a bet card can do, as one radial menu.
 *
 * Both the bets list and the pending screen show BetCard, so the actions live
 * here rather than in either screen — two copies of a menu drift, and the wedge
 * positions have to stay identical for the muscle memory to be worth anything.
 *
 * Returns the wheel element to render and the cashout handshake: "Выкуп" only
 * reveals the inline amount field on the card, it never settles on its own.
 */
export function useBetActions() {
  const navigation = useNavigation<Nav>();
  const { updateBet, deleteBet } = useBetsStore();

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

  const actions: WheelAction[] = useMemo(() => {
    if (!bet) return [];
    // Offering the status a bet already has would be a dead wedge.
    if (level === 'status') return STATUS_ACTIONS.filter((a) => a.key !== bet.status);
    // A pending bet is almost always opened to settle it, so the outcomes are one
    // tap away; a settled one only needs the rarer "change the result".
    return bet.status === 'pending'
      ? [...STATUS_ACTIONS.filter((a) => a.key !== 'pending'), ...COMMON_ACTIONS]
      : [
          { key: 'status', label: 'Результат', icon: 'swap-horizontal-outline', color: colors.pending },
          ...COMMON_ACTIONS,
        ];
  }, [bet, level]);

  function select(key: string) {
    if (!bet) return;
    if (key === 'status') { haptic.selection(); setLevel('status'); return; }

    close();
    switch (key) {
      case 'won':     haptic.success(); updateBet(bet.id, { status: 'won' }); break;
      case 'lost':    haptic.error();   updateBet(bet.id, { status: 'lost' }); break;
      case 'refund':  haptic.warning(); updateBet(bet.id, { status: 'refund' }); break;
      case 'pending': haptic.warning(); updateBet(bet.id, { status: 'pending' }); break;
      case 'cashout': haptic.selection(); setCashoutFor(bet.id); break;
      case 'duplicate':
        haptic.selection();
        navigation.navigate('AddBet', { duplicateOf: bet.id });
        break;
      case 'edit':
        haptic.selection();
        navigation.navigate('AddBet', { betId: bet.id });
        break;
      case 'delete':
        haptic.warning();
        Alert.alert(
          'Удалить ставку?',
          `${displayEvent(bet.event)}\n${bet.pick} · ${formatMoney(bet.stake)}`,
          [
            { text: 'Отмена', style: 'cancel' },
            { text: 'Удалить', style: 'destructive', onPress: () => { haptic.error(); deleteBet(bet.id); } },
          ],
        );
        break;
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

  return { open, element, cashoutFor, clearCashout: () => setCashoutFor(null) };
}
