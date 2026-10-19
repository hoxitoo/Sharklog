import React, { useState, useEffect, useCallback } from 'react';
import { SPACE, RADIUS, TOUCH } from '../theme/layout';
import {
  View, TouchableOpacity, ActivityIndicator, Alert, Linking,
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
import { BILLING, PRIVACY_URL } from '../services/billing';
import {
  getOffer, createPayment, getPendingPayment, clearPendingPayment,
  type Offer, type PendingPayment,
} from '../services/licenseServer';
import { resumePendingPayment, takePaidNotice } from '../services/purchase';
import { Analytics } from '../services/analytics';
import { formatMoney } from '@sharklog/core';
import { dateLocale } from '../i18n';
import { SIZE, GLYPH } from '../theme/typography';
import { useTranslation } from 'react-i18next';
import { themedStyles } from '../theme/themed';

interface Props {
  children: React.ReactNode;
  feature: string;
}

/** Pro content behind a paywall: the children for Pro (or a running trial), the offer otherwise. */
export function ProGate({ children, feature }: Props) {
  const isPro = useBetsStore((s) => s.settings.isPro);
  if (isPro) return <>{children}</>;
  return <ProOffer feature={feature} />;
}

/**
 * The offer itself. Also shown on its own (PaywallSheet) — during the trial
 * too, where ProGate would show the content instead: buying before the trial
 * runs out has to be possible.
 */
export function ProOffer({ feature }: { feature: string }) {
  const { t } = useTranslation();
  const trialEndsAt = useBetsStore((s) => s.settings.proExpiresAt);
  const trialMs = trialEndsAt ? new Date(trialEndsAt).getTime() : NaN;
  const now = Date.now();

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

      {/* What the trial means right now — never a promise this user can't
          take up: the trial starts by itself at onboarding, so anyone looking
          at this offer either is in it or has had it. */}
      {Number.isFinite(trialMs) && (
        <Text style={styles.trialNote}>
          {trialMs > now
            ? t('proGate.trialUntil', { date: new Date(trialMs).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long' }) })
            : t('proGate.trialEnded')}
        </Text>
      )}

      {BILLING === 'robokassa' ? <RobokassaCheckout /> : <StoreCheckout />}
    </View>
  );
}

// ── RuStore build: one-time purchase through Robokassa ──────────────────────

type Phase = 'loading' | 'ready' | 'unavailable' | 'opening' | 'awaiting' | 'checking';

function RobokassaCheckout() {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('loading');
  const [offer, setOffer] = useState<Offer | null>(null);
  const [pending, setPending] = useState<PendingPayment | null>(null);

  const loadOffer = useCallback(async () => {
    setPhase('loading');
    const waiting = await getPendingPayment();
    if (waiting) {
      setPending(waiting);
      setPhase('awaiting');
      return;
    }
    const o = await getOffer();
    setOffer(o);
    setPhase(o ? 'ready' : 'unavailable');
  }, []);

  useEffect(() => { loadOffer(); }, [loadOffer]);

  async function buy() {
    setPhase('opening');
    Analytics.proUpgradeStarted('robokassa');
    // Returns the invoice already waiting, if another paywall opened one.
    const p = await createPayment().catch(() => null);
    if (!p) {
      setPhase('ready');
      Alert.alert(t('common.error'), t('proGate.createError'));
      return;
    }
    setPending(p);
    setPhase('awaiting');
    Linking.openURL(p.url).catch(() => Alert.alert(t('common.error'), t('proGate.createError')));
  }

  async function check() {
    setPhase('checking');
    const r = await resumePendingPayment();
    if (r === 'paid') {
      // The gate opens by itself (isPro) and a sheet around it closes; say why,
      // once, a frame later — an alert raised from a closing Modal can vanish
      // with it on iOS.
      if (takePaidNotice()) {
        requestAnimationFrame(() => Alert.alert(t('proGate.paidTitle'), t('proGate.paid')));
      }
      return;
    }
    if (r === 'none') {
      await loadOffer();
      return;
    }
    setPhase('awaiting');
    Alert.alert(
      r === 'pending' ? t('proGate.awaitingTitle') : t('common.error'),
      r === 'pending' ? t('proGate.notYet') : t('proGate.checkError'),
    );
  }

  function cancel() {
    // Cancelling forgets the invoice on this phone. If the money is already on
    // its way, that is how a paid Pro gets lost — so ask first.
    Alert.alert(t('proGate.cancelConfirmTitle'), t('proGate.cancelConfirmMsg'), [
      { text: t('proGate.keepWaiting'), style: 'cancel' },
      {
        text: t('proGate.cancelPayment'),
        style: 'destructive',
        onPress: async () => {
          await clearPendingPayment();
          setPending(null);
          loadOffer();
        },
      },
    ]);
  }

  if (phase === 'loading') {
    return <ActivityIndicator color={colors.purpleText} style={{ marginTop: SPACE.xl }} />;
  }

  if (phase === 'unavailable') {
    return (
      <>
        <Text style={styles.note}>{t('proGate.unavailable')}</Text>
        <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={loadOffer} activeOpacity={0.8}>
          <Text style={styles.buttonTextSecondary}>{t('proGate.retry')}</Text>
        </TouchableOpacity>
        <PrivacyLink />
      </>
    );
  }

  if ((phase === 'awaiting' || phase === 'checking') && pending) {
    const busy = phase === 'checking';
    return (
      <>
        <Text style={styles.awaitingTitle}>{t('proGate.awaitingTitle')}</Text>
        <Text style={styles.note}>{t('proGate.awaitingHint')}</Text>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={check}
          disabled={busy}
          activeOpacity={0.8}
        >
          {busy
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>{t('proGate.check')}</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={() => Linking.openURL(pending.url).catch(() => {})}
          disabled={busy}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonTextSecondary}>{t('proGate.openAgain')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={cancel} disabled={busy} style={styles.restore}>
          <Text style={styles.restoreText}>{t('proGate.cancelPayment')}</Text>
        </TouchableOpacity>
      </>
    );
  }

  // ready / opening
  const opening = phase === 'opening';
  return (
    <>
      <TouchableOpacity
        style={[styles.button, styles.buttonPrimary]}
        activeOpacity={0.8}
        disabled={opening || !offer}
        onPress={buy}
      >
        {opening
          ? <ActivityIndicator color="#fff" />
          : (
            <Text style={styles.buttonText}>
              {/* Whole roubles: the price is set in roubles, and "399,00 ₽" on a button reads as a bill. */}
              {t('proGate.lifetime', { price: formatMoney((offer?.price ?? 0) * 100, '₽', 0) })}
            </Text>
          )}
      </TouchableOpacity>
      <Text style={styles.note}>{t('proGate.oneTime')}</Text>
      <Text style={styles.noteMuted}>{t('proGate.via')}</Text>
      <PrivacyLink />
    </>
  );
}

function PrivacyLink() {
  const { t } = useTranslation();
  return (
    <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})} style={styles.restore}>
      <Text style={styles.link}>{t('proGate.privacy')}</Text>
    </TouchableOpacity>
  );
}

// ── Google Play / App Store build: subscriptions through RevenueCat ─────────

function StoreCheckout() {
  const { t } = useTranslation();
  const refreshPro = useBetsStore((s) => s.refreshPro);
  const [offerings, setOfferings] = useState<OfferingPackages>({ monthly: null, annual: null });
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    getOfferings().then((o) => {
      setOfferings(o);
      setLoading(false);
    });
  }, []);

  const handlePurchase = useCallback(async (type: 'monthly' | 'annual') => {
    const pkg = offerings[type];
    if (!pkg) return;
    setPurchasing(true);
    try {
      const pro = await purchasePackage(pkg);
      if (pro) refreshPro(true);
    } catch {
      Alert.alert(t('common.error'), t('proGate.purchaseError'));
    } finally {
      setPurchasing(false);
    }
  }, [offerings, refreshPro, t]);

  const handleRestore = useCallback(async () => {
    setPurchasing(true);
    try {
      const pro = await restorePurchases();
      if (pro === null) {
        // The store was never reached — not the same as "nothing to restore".
        Alert.alert(t('common.error'), t('errors.storeUnreachable'));
      } else if (pro) {
        refreshPro(true);
      } else {
        Alert.alert(t('settings.restoreNoneTitle'), t('settings.restoreNoneMsg'));
      }
    } finally {
      setPurchasing(false);
    }
  }, [refreshPro, t]);

  if (loading) return <ActivityIndicator color={colors.purpleText} style={{ marginTop: SPACE.xl }} />;

  // No packages = the store did not answer (or the build has no RevenueCat
  // key). Buttons with a made-up price that do nothing on tap were the old
  // answer to that; say it instead.
  const { monthly, annual } = offerings;
  return (
    <>
      {annual || monthly ? (
        <>
          {annual && (
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              activeOpacity={0.8}
              disabled={purchasing}
              onPress={() => handlePurchase('annual')}
            >
              <Text style={styles.buttonText}>{t('proGate.annual', { price: annual.product.priceString })}</Text>
              <Text style={styles.buttonSub}>{t('proGate.annualSave')}</Text>
            </TouchableOpacity>
          )}
          {monthly && (
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              activeOpacity={0.8}
              disabled={purchasing}
              onPress={() => handlePurchase('monthly')}
            >
              <Text style={styles.buttonTextSecondary}>{t('proGate.monthly', { price: monthly.product.priceString })}</Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <Text style={styles.note}>{t('proGate.unavailable')}</Text>
      )}

      {purchasing && <ActivityIndicator color={colors.purpleText} style={{ marginTop: SPACE.md }} />}

      <TouchableOpacity onPress={handleRestore} disabled={purchasing} style={styles.restore}>
        <Text style={styles.restoreText}>{t('settings.restorePurchases')}</Text>
      </TouchableOpacity>
      <PrivacyLink />
    </>
  );
}

const PERKS = [
  'proGate.perkUnlimited',
  'proGate.perkAnalytics',
  'proGate.perkTilt',
  'proGate.perkChecklist',
  // Only what Free lacks: CSV export used to be listed here, and it is free.
  'bankroll.proFeatureFull',
] as const;

const styles = themedStyles(() => ({
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
  trialNote: {
    fontSize: SIZE.body,
    color: colors.accent,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: SPACE.xl,
  },
  awaitingTitle: { fontSize: SIZE.lead, fontWeight: '700', color: colors.textPrimary, marginBottom: SPACE.xs, textAlign: 'center' },
  note: { fontSize: SIZE.caption, color: colors.textSecondary, textAlign: 'center', marginBottom: SPACE.md, lineHeight: 18 },
  noteMuted: { fontSize: SIZE.caption, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
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
  restore: { marginTop: SPACE.lg, minHeight: TOUCH, justifyContent: 'center' },
  restoreText: { fontSize: SIZE.body, color: colors.textSecondary },
  link: { fontSize: SIZE.caption, color: colors.purpleText, textDecorationLine: 'underline' },
}));
