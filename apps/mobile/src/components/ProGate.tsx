import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors.js';
import { useBetsStore } from '../store/betsStore.js';

interface Props {
  children: React.ReactNode;
  feature: string;
}

export function ProGate({ children, feature }: Props) {
  const isPro = useBetsStore((s) => s.settings.isPro);

  if (isPro) return <>{children}</>;

  return (
    <View style={styles.overlay}>
      <Text style={styles.icon}>👑</Text>
      <Text style={styles.title}>Функция PRO</Text>
      <Text style={styles.subtitle}>{feature} доступно в подписке SharkLog Pro</Text>
      <TouchableOpacity style={styles.button} activeOpacity={0.8}>
        <Text style={styles.buttonText}>Попробовать Pro — 7 дней бесплатно</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: colors.bg,
  },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: colors.gold, marginBottom: 8 },
  subtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 32 },
  button: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: { fontSize: 15, fontWeight: '700', color: '#000000' },
});
