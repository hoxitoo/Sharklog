import React, { useState, useEffect, useCallback } from 'react';
import { SPACE, RADIUS, TOUCH } from '../theme/layout';
import {
  View, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { AppText as Text } from './AppText';
import { colors } from '../theme/colors';
import { useBetsStore } from '../store/betsStore';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  type OfferingPackages,
} from '../services/revenueCat';
import { SIZE, GLYPH } from '../theme/typography';

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
        <ActivityIndicator color={colors.purple} style={{ marginTop: SPACE.xl }} />
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

      {purchasing && <ActivityIndicator color={colors.purple} style={{ marginTop: SPACE.md }} />}

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
    padding: SPACE.xxl,
    backgroundColor: colors.bg,
  },
  icon: { fontSize: GLYPH.hero, marginBottom: SPACE.md },
  title: { fontSize: SIZE.hero, fontWeight: '700', color: colors.gold, marginBottom: SPACE.xs },
  subtitle: { fontSize: SIZE.lead, color: colors.textSecondary, textAlign: 'center', marginBottom: SPACE.lg },
  perks: { alignSelf: 'stretch', marginBottom: SPACE.lg },
  perk: { fontSize: SIZE.body, color: colors.textPrimary, marginBottom: SPACE.xs },
  trialBadge: {
    fontSize: SIZE.body,
    color: colors.accent,
    fontWeight: '600',
    marginBottom: SPACE.xl,
  },
  button: { minHeight: TOUCH, justifyContent: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginBottom: SPACE.sm,
  },
  buttonPrimary: { backgroundColor: colors.purple },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.purple,
  },
  buttonText: { fontSize: SIZE.lead, fontWeight: '700', color: '#fff' },
  buttonSub: { fontSize: SIZE.caption, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  buttonTextSecondary: { fontSize: SIZE.lead, fontWeight: '600', color: colors.purpleText },
  restore: { marginTop: SPACE.lg },
  restoreText: { fontSize: SIZE.body, color: colors.textSecondary },
});
