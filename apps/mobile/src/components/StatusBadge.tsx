import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { BetStatus } from '@sharklog/core';
import { colors } from '../theme/colors';

const STATUS_CONFIG: Record<BetStatus, { label: string; color: string }> = {
  pending:  { label: 'Ожидание', color: colors.pending },
  won:      { label: 'Победа',   color: colors.won },
  lost:     { label: 'Проигрыш', color: colors.lost },
  refund:   { label: 'Возврат',  color: colors.refund },
  cashout:  { label: 'Выкуп',    color: colors.refund },
};

export function StatusBadge({ status }: { status: BetStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.color + '22' }]}>
      <Text style={[styles.text, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11, fontWeight: '600' },
});
