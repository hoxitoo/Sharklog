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
import { useTranslation } from 'react-i18next';

interface Props {
  children: React.ReactNode;
  feature: string;
}

export function ProGate({ children, feature }: Props) {
  const isPro = useBetsStore((s) => s.settings.isPro);
  const updateSettings = useBetsStore((s) => s.updateSettings);
  const { t } = useTranslation();

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
      Alert.alert(t('common.error'), t('proGate.purchaseError'));
    } finally {
      setPurchasing(false);
    }
  }, [offerings, updateSettings, t]);

  const handleRestore = useCallback(async () => {
    setPurchasing(true);
    try {
      const pro = await restorePurchases();
      if (pro === null) {
        // The store was never reached — not the same as "nothing to restore".
        Alert.alert(t('common.error'), t('errors.storeUnreachable'));
      } else if (pro) {
        updateSettings({ isPro: true });
      } else {
        Alert.alert(t('settings.restoreNoneTitle'), t('settings.restoreNoneMsg'));
      }
    } finally {
      setPurchasing(false);
    }
  }, [updateSettings, t]);

  if (isPro) return <>{children}</>;

  const monthlyPrice = offerings.monthly?.product.priceString ?? '199 ₽';
  const annualPrice = offerings.annual?.product.priceString ?? '990 ₽';

  return (
    <View style={styles.overlay}>
      <Text style={styles.icon}>👑</Text>
      <Text style={styles.title}>SharkLog Pro</Text>
      {/* "<feature> — in Pro": a dash, not a verb, so nothing has to agree
          with the feature's gender ("аналитика доступно" was the old result). */}
      <Text style={styles.subtitle}>{feature} — {t('proGate.inPro')}</Text>

      <View style={styles.perks}>
        {PERKS.map((p) => (
          <Text key={p} style={styles.perk}>• {t(p)}</Text>
        ))}
      </View>

      <Text style={styles.trialBadge}>{t('proGate.trial')}</Text>

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
            <Text style={styles.buttonText}>{t('proGate.annual', { price: annualPrice })}</Text>
            <Text style={styles.buttonSub}>{t('proGate.annualSave')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            activeOpacity={0.8}
            disabled={purchasing}
            onPress={() => handlePurchase('monthly')}
          >
            <Text style={styles.buttonTextSecondary}>{t('proGate.monthly', { price: monthlyPrice })}</Text>
          </TouchableOpacity>
        </>
      )}

      {purchasing && <ActivityIndicator color={colors.purple} style={{ marginTop: SPACE.md }} />}

      <TouchableOpacity onPress={handleRestore} disabled={purchasing} style={styles.restore}>
        <Text style={styles.restoreText}>{t('settings.restorePurchases')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const PERKS = [
  'proGate.perkUnlimited',
  'proGate.perkAnalytics',
  'proGate.perkTilt',
  'proGate.perkChecklist',
  'proGate.perkExport',
] as const;

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
  button: {
    minHeight: TOUCH, justifyContent: 'center',
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
