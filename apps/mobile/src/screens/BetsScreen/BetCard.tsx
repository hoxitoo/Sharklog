import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
  const { updateBet } = useBetsStore();

  const potentialWin = Math.round(bet.stake * bet.odds);
  const pnl = bet.status === 'won'
    ? potentialWin - bet.stake
    : bet.status === 'lost'
    ? -bet.stake
    : bet.status === 'cashout' && bet.cashoutAmount != null
    ? bet.cashoutAmount - bet.stake
    : null;

  function handleQuickResult(status: 'won' | 'lost' | 'refund' | 'cashout') {
    if (status === 'won') haptic.success();
    else if (status === 'lost') haptic.error();
    else haptic.warning();
    updateBet(bet.id, { status });
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onEdit(bet)}
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
          {bet.status === 'cashout' && bet.cashoutAmount != null && (
            <Text style={styles.cashoutAmt}>
              Выкуп: {formatMoney(bet.cashoutAmount)}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <StatusBadge status={bet.status} />
        <Text style={styles.date}>{bet.date} {bet.time}</Text>
        {bet.bookmaker ? (
          <View style={styles.bkBadge}>
            <Text style={styles.bkText}>{bet.bookmaker}</Text>
          </View>
        ) : null}
      </View>

      {bet.status === 'pending' && (
        <View style={styles.quickResultRow}>
          <TouchableOpacity
            style={[styles.resultChip, styles.chipWon]}
            onPress={() => handleQuickResult('won')}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, { color: colors.won }]}>W</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.resultChip, styles.chipLost]}
            onPress={() => handleQuickResult('lost')}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, { color: colors.lost }]}>L</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.resultChip, styles.chipRefund]}
            onPress={() => handleQuickResult('refund')}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, { color: colors.refund }]}>R</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.resultChip, styles.chipRefund]}
            onPress={() => {
              haptic.warning();
              updateBet(bet.id, { status: 'cashout' });
              onEdit(bet);
            }}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, { color: colors.refund }]}>C</Text>
          </TouchableOpacity>
          <Text style={styles.quickResultHint}>Нажми для закрытия</Text>
        </View>
      )}

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
  bkBadge: {
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bkText: { fontSize: 10, color: colors.textMuted },
  quickResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resultChip: {
    width: 36,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipWon: { backgroundColor: colors.won + '18', borderColor: colors.won + '55' },
  chipLost: { backgroundColor: colors.lost + '18', borderColor: colors.lost + '55' },
  chipRefund: { backgroundColor: colors.refund + '18', borderColor: colors.refund + '55' },
  chipText: { fontSize: 13, fontWeight: '700' },
  quickResultHint: { fontSize: 11, color: colors.textMuted, marginLeft: 4 },
  notes: { fontSize: 12, color: colors.textMuted, marginTop: 6, fontStyle: 'italic' },
  cashoutAmt: { fontSize: 11, color: colors.refund, marginTop: 1 },
});
