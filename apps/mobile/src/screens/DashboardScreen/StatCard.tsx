import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  positive?: boolean;
  negative?: boolean;
}

export function StatCard({ label, value, sub, accent, positive, negative }: Props) {
  const valueColor = accent
    ? colors.accent
    : positive
    ? colors.won
    : negative
    ? colors.lost
    : colors.textPrimary;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: '45%',
  },
  label: { fontSize: 11, color: colors.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 22, fontWeight: '700' },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
