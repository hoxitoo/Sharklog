import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';
import { FONTS } from '../../theme/typography';

interface Props {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  positive?: boolean;
  negative?: boolean;
  onInfo?: () => void;
}

export function StatCard({ label, value, sub, accent, positive, negative, onInfo }: Props) {
  const valueColor = accent
    ? colors.accent
    : positive
    ? colors.won
    : negative
    ? colors.lost
    : colors.textPrimary;

  return (
    <View style={styles.card}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {onInfo && (
          <TouchableOpacity
            onPress={onInfo}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <View style={styles.infoBtn}>
              <Text style={styles.infoBtnText}>?</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
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
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: { fontSize: 11, fontFamily: FONTS.sans, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 22, fontFamily: FONTS.monoMedium },
  sub: { fontSize: 12, fontFamily: FONTS.sans, color: colors.textSecondary, marginTop: 2 },
  infoBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBtnText: { fontSize: 10, fontWeight: '700', color: colors.textMuted, lineHeight: 14 },
});
