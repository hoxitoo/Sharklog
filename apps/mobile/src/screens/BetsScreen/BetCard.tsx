import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import type { Bet } from '@sharklog/core';
import { SPORTS, BET_TYPES, formatMoney, formatOdds } from '@sharklog/core';
import { colors } from '../../theme/colors';
import { StatusBadge } from '../../components/StatusBadge';
import { useBetsStore } from '../../store/betsStore';
import { haptic } from '../../utils/haptics';

interface Props {
  bet: Bet;
  onEdit: (bet: Bet) => void;
}

export function BetCard({ bet, onEdit }: Props) {
  const { updateBet, deleteBet } = useBetsStore();

  const potentialWin = Math.round(bet.stake * bet.odds);
  const pnl = bet.status === 'won'
    ? potentialWin - bet.stake
    : bet.status === 'lost'
    ? -bet.stake
    : null;

  function handleStatusChange() {
    haptic.light();
    Alert.alert('Результат ставки', 'Выбери исход:', [
      { text: 'Победа 🏆', onPress: () => { haptic.success(); updateBet(bet.id, { status: 'won' }); } },
      { text: 'Проигрыш 💸', onPress: () => { haptic.error(); updateBet(bet.id, { status: 'lost' }); } },
      { text: 'Возврат ↩️', onPress: () => { haptic.warning(); updateBet(bet.id, { status: 'refund' }); } },
      { text: 'Отмена', style: 'cancel' },
    ]);
  }

  function handleDelete() {
    haptic.medium();
    Alert.alert('Удалить ставку?', `${bet.event}`, [
      { text: 'Удалить', style: 'destructive', onPress: () => { haptic.error(); deleteBet(bet.id); } },
      { text: 'Отмена', style: 'cancel' },
    ]);
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onEdit(bet)}
      onLongPress={handleDelete}
      activeOpacity={0.8}
    >
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.sport}>{SPORTS[bet.sport]} · {BET_TYPES[bet.betType]}</Text>
          <Text style={styles.event} numberOfLines={1}>{bet.event}</Text>
          <Text style={styles.pick}>{bet.pick}</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.odds}>× {formatOdds(bet.odds)}</Text>
          <Text style={styles.stake}>{formatMoney(bet.stake)}</Text>
          {pnl !== null && (
            <Text style={[styles.pnl, { color: pnl >= 0 ? colors.won : colors.lost }]}>
              {pnl >= 0 ? '+' : ''}{formatMoney(pnl)}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <StatusBadge status={bet.status} />
        <Text style={styles.date}>{bet.date} {bet.time}</Text>
        {bet.status === 'pending' && (
          <TouchableOpacity style={styles.closeBtn} onPress={handleStatusChange}>
            <Text style={styles.closeBtnText}>Закрыть</Text>
          </TouchableOpacity>
        )}
      </View>

      {bet.notes ? (
        <Text style={styles.notes} numberOfLines={1}>{bet.notes}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  left: { flex: 1, marginRight: 12 },
  right: { alignItems: 'flex-end' },
  sport: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
  event: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  pick: { fontSize: 13, color: colors.accent },
  odds: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  stake: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  pnl: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  date: { fontSize: 11, color: colors.textMuted, flex: 1 },
  closeBtn: {
    backgroundColor: colors.accentDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  closeBtnText: { fontSize: 12, color: colors.accent, fontWeight: '600' },
  notes: { fontSize: 12, color: colors.textMuted, marginTop: 6, fontStyle: 'italic' },
});
