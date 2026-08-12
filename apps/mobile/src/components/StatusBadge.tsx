import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { BetStatus } from '@sharklog/core';
import { colors } from '../theme/colors';
import { useTranslation } from 'react-i18next';

/** Shared so the card's edge rail always matches the badge. */
export const STATUS_COLORS: Record<BetStatus, string> = {
  pending:  colors.pending,
  won:      colors.won,
  lost:     colors.lost,
  refund:   colors.refund,
  cashout:  colors.refund,
};

export function StatusBadge({ status }: { status: BetStatus }) {
  const { t } = useTranslation();
  const color = STATUS_COLORS[status];
  return (
    <View style={[styles.badge, { backgroundColor: color + '22' }]}>
      <Text style={[styles.text, { color }]}>{t(`status.${status}`)}</Text>
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
