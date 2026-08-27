import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import type { Bet } from '@sharklog/core';
import { SPORTS, BET_TYPES, formatMoney, formatOdds, parseMoneyInput } from '@sharklog/core';
import { colors } from '../../theme/colors';
import { StatusBadge, STATUS_COLORS } from '../../components/StatusBadge';
import { useBetsStore } from '../../store/betsStore';
import { haptic } from '../../utils/haptics';
import { useTranslation } from 'react-i18next';

interface Props {
  bet: Bet;
  /** A tap opens the action wheel — editing is one of its wedges, not the default. */
  onPress: (bet: Bet) => void;
  /**
   * Whether this card shows the inline cashout field. Owned by the parent so
   * that two cards can never be left open at once: opening one closes the other
   * by construction, rather than by each card watching the other.
   */
  cashoutOpen?: boolean;
  onRequestCashout?: () => void;
  onCloseCashout?: () => void;
}

export function displayEvent(event: string): string {
  // Strip stored per-leg odds ("M80 vs NRG|1.10 / ...") → "M80 vs NRG / ..."
  return event.split(' / ').map(p => p.split('|')[0] ?? p).join(' / ');
}

export const BetCard = React.memo(function BetCard({
  bet, onPress, cashoutOpen = false, onRequestCashout, onCloseCashout,
}: Props) {
  const { updateBet } = useBetsStore();
  const { t } = useTranslation();
  // Inline cashout entry: the amount is typed here rather than in the full editor.
  const [cashoutText, setCashoutText] = useState('');

  // The parent can close this field without the card being told (opening the
  // cashout on another card closes this one), so the typed amount is cleared by
  // watching the flag rather than inside the close handler. Otherwise reopening
  // the card showed a stale sum, autofocused, one tap from being recorded.
  useEffect(() => {
    if (!cashoutOpen) setCashoutText('');
  }, [cashoutOpen]);

  function closeCashout() {
    onCloseCashout?.();
  }

  function confirmCashout() {
    const amount = parseMoneyInput(cashoutText);
    if (amount <= 0) { haptic.error(); return; }
    haptic.success();
    updateBet(bet.id, { status: 'cashout', cashoutAmount: amount });
    closeCashout();
  }

  const potentialWin = Math.round(bet.stake * bet.odds);
  const pnl = bet.status === 'won'
    ? potentialWin - bet.stake
    : bet.status === 'lost'
    ? (bet.isFreebet ? 0 : -bet.stake)
    : bet.status === 'cashout' && bet.cashoutAmount != null
    ? bet.cashoutAmount - bet.stake
    : null;

  function handleQuickResult(status: 'won' | 'lost' | 'refund' | 'cashout') {
    if (status === 'won') haptic.success();
    else if (status === 'lost') haptic.error();
    else haptic.warning();
    updateBet(bet.id, { status });
  }

  const accent = STATUS_COLORS[bet.status];

  return (
    <TouchableOpacity
      style={styles.card}
      // While entering a cashout amount, don't let a stray tap on the card body
      // navigate to the editor and discard the in-progress input.
      onPress={cashoutOpen ? undefined : () => onPress(bet)}
      activeOpacity={cashoutOpen ? 1 : 0.8}
    >
      {/* The right edge carries the outcome — green won, red lost, amber pending,
          violet refund/cashout — so a scroll reads without stopping at the badge. */}
      <View pointerEvents="none" style={[styles.edge, { backgroundColor: accent }]} />

      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.sport}>
            {bet.customSport || SPORTS[bet.sport]} · {bet.customBetType || BET_TYPES[bet.betType]}
          </Text>
          <Text style={styles.event} numberOfLines={1}>{displayEvent(bet.event)}</Text>
          <Text style={styles.pick}>{bet.pick}</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.odds}>× {formatOdds(bet.odds)}</Text>
          <Text style={styles.stake}>{formatMoney(bet.stake)}</Text>
          {pnl !== null && pnl !== 0 && (
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
        {bet.isFreebet && (
          <View style={styles.freebetBadge}>
            <Text style={styles.freebetBadgeText}>🎁 Фрибет</Text>
          </View>
        )}
        <Text style={styles.date}>{bet.date} {bet.time}</Text>
        {bet.bookmaker ? (
          <View style={styles.bkBadge}>
            <Text style={styles.bkText}>{bet.bookmaker}</Text>
          </View>
        ) : null}
      </View>

      {bet.status === 'pending' && !cashoutOpen && (
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
            onPress={() => { haptic.selection(); onRequestCashout?.(); }}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, { color: colors.refund }]}>C</Text>
          </TouchableOpacity>
        </View>
      )}

      {cashoutOpen && (
        <View style={styles.cashoutRow}>
          <TextInput
            style={styles.cashoutInput}
            placeholder={t('bet.cashoutPrompt')}
            placeholderTextColor={colors.textMuted}
            value={cashoutText}
            onChangeText={setCashoutText}
            keyboardType="numeric"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={confirmCashout}
          />
          <TouchableOpacity
            style={[styles.cashoutBtn, styles.cashoutConfirm]}
            onPress={confirmCashout}
            activeOpacity={0.75}
          >
            <Text style={[styles.cashoutBtnText, { color: colors.won }]}>✓</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cashoutBtn, styles.cashoutCancel]}
            onPress={() => { haptic.selection(); closeCashout(); }}
            activeOpacity={0.75}
          >
            <Text style={[styles.cashoutBtnText, { color: colors.textMuted }]}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {bet.notes ? (
        <Text style={styles.notes} numberOfLines={1}>{bet.notes}</Text>
      ) : null}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
  },
  edge: {
    position: 'absolute',
    right: 0, top: 0, bottom: 0, width: 4,
    // 16 (card) − 1 (border) so the rail follows the corner instead of cutting it.
    borderTopRightRadius: 15, borderBottomRightRadius: 15,
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
  cashoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cashoutInput: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.refund + '55',
    color: colors.textPrimary,
    fontSize: 14,
  },
  cashoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cashoutConfirm: { backgroundColor: colors.won + '18', borderColor: colors.won + '55' },
  cashoutCancel: { backgroundColor: colors.bgElevated, borderColor: colors.border },
  cashoutBtnText: { fontSize: 16, fontWeight: '700' },
  notes: { fontSize: 12, color: colors.textMuted, marginTop: 6, fontStyle: 'italic' },
  cashoutAmt: { fontSize: 11, color: colors.refund, marginTop: 1 },
  freebetBadge: {
    backgroundColor: colors.accent + '1A',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.accent + '44',
  },
  freebetBadgeText: { fontSize: 10, color: colors.accent, fontWeight: '600' },
});
