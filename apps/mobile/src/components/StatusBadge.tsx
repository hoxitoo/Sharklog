import React from 'react';
import { SPACE, RADIUS } from '../theme/layout';
import { View, StyleSheet } from 'react-native';
import { AppText as Text } from './AppText';
import type { BetStatus } from '@sharklog/core';
import { colors } from '../theme/colors';
import { useTranslation } from 'react-i18next';
import { SIZE } from '../theme/typography';
import { themedStyles } from '../theme/themed';

/** Shared so the card's edge rail always matches the badge. Getters: the active theme's colours. */
export const STATUS_COLORS: Record<BetStatus, string> = {
  get pending() { return colors.pending; },
  get won() { return colors.won; },
  get lost() { return colors.lost; },
  get refund() { return colors.refund; },
  get cashout() { return colors.refund; },
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

const styles = themedStyles(() => ({
  badge: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
  },
  text: { fontSize: SIZE.caption, fontWeight: '600' },
}));
