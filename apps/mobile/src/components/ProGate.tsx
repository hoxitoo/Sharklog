import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors } from '../theme/colors';
import { useBetsStore } from '../store/betsStore';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  type OfferingPackages,
} from '../services/revenueCat';

interface Props {
  children: React.ReactNode;
  feature: string;
}

export function ProGate({ children, feature }: Props) {
  const isPro = useBetsStore((s) => s.settings.isPro);
  const updateSettings = useBetsStore((s) => s.updateSettings);

  const [offerings, setOfferings] = useState<OfferingPackages>({ monthly: null, annual: null });
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (!isPro) {
      getOfferings().then((o) => {
        setOfferings(o);
        setLoading(false);
      });
    }
  }, [isPro]);

  const handlePurchase = useCallback(async (type: 'monthly' | 'annual') => {
    const pkg = offerings[type];
    if (!pkg) return;
    setPurchasing(true);
    try {
      const pro = await purchasePackage(pkg);
      if (pro) updateSettings({ isPro: true });
    } catch {
      Alert.alert('Ошибка', 'Не удалось завершить покупку. Попробуйте ещё раз.');
    } finally {
      setPurchasing(false);
    }
  }, [offerings, updateSettings]);

  const handleRestore = useCallback(async () => {
    setPurchasing(true);
    try {
      const pro = await restorePurchases();
      if (pro) {
        updateSettings({ isPro: true });
      } else {
        Alert.alert('Ничего не найдено', 'Активная подписка Pro не обнаружена.');
      }
    } finally {
      setPurchasing(false);
    }
  }, [updateSettings]);

  if (isPro) return <>{children}</>;

  const monthlyPrice = offerings.monthly?.product.priceString ?? '199 ₽';
  const annualPrice = offerings.annual?.product.priceString ?? '990 ₽';

  return (
    <View style={styles.overlay}>
      <Text style={styles.icon}>👑</Text>
      <Text style={styles.title}>SharkLog Pro</Text>
      <Text style={styles.subtitle}>{feature} доступно в подписке</Text>

      <View style={styles.perks}>
        {PERKS.map((p) => (
          <Text key={p} style={styles.perk}>• {p}</Text>
        ))}
      </View>

      <Text style={styles.trialBadge}>7 дней бесплатно для новых пользователей</Text>

      {loading ? (
        <ActivityIndicator color={colors.purple} style={{ marginTop: 24 }} />
      ) : (
        <>
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            activeOpacity={0.8}
            disabled={purchasing}
            onPress={() => handlePurchase('annual')}
          >
            <Text style={styles.buttonText}>Годовая — {annualPrice}/год</Text>
            <Text style={styles.buttonSub}>Выгоднее на 58%</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            activeOpacity={0.8}
            disabled={purchasing}
            onPress={() => handlePurchase('monthly')}
          >
            <Text style={styles.buttonTextSecondary}>Месячная — {monthlyPrice}/мес</Text>
          </TouchableOpacity>
        </>
      )}

      {purchasing && <ActivityIndicator color={colors.purple} style={{ marginTop: 12 }} />}

      <TouchableOpacity onPress={handleRestore} disabled={purchasing} style={styles.restore}>
        <Text style={styles.restoreText}>Восстановить покупку</Text>
      </TouchableOpacity>
    </View>
  );
}

const PERKS = [
  'Безлимитные ставки',
  'Расширенная аналитика',
  'Настраиваемый тилт-алерт',
  'Чеклист дисциплины перед ставкой',
  'Экспорт CSV',
];

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: colors.bg,
  },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', color: colors.gold, marginBottom: 6 },
  subtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  perks: { alignSelf: 'stretch', marginBottom: 16 },
  perk: { fontSize: 14, color: colors.textPrimary, marginBottom: 6 },
  trialBadge: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
    marginBottom: 24,
  },
  button: {
    alignSelf: 'stretch',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonPrimary: { backgroundColor: colors.purple },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.purple,
  },
  buttonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  buttonSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  buttonTextSecondary: { fontSize: 15, fontWeight: '600', color: colors.purple },
  restore: { marginTop: 16 },
  restoreText: { fontSize: 13, color: colors.textSecondary },
});
