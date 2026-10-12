import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking, Share, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppText as Text } from '../../components/AppText';
import { cardSurface } from '../../components/Card';
import { PaywallSheet } from '../../components/PaywallSheet';
import { useBetsStore } from '../../store/betsStore';
import { Analytics } from '../../services/analytics';
import { LANDING_URL, storeReviewUrls, supportUrl } from '../../utils/storeLinks';
import { colors, alpha } from '../../theme/colors';
import { SPACE, RADIUS, TOUCH } from '../../theme/layout';
import { SIZE, GLYPH } from '../../theme/typography';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

/*
 * "Support the author" — only ways that both stores accept.
 *
 * A tip to the developer is a digital purchase in the eyes of both the App
 * Store and Google Play, so a link out to a donation page risks the review.
 * Pro is the in-store way to pay; a rating and a word to a friend cost nothing.
 * If tips are added, they go through the store as consumable purchases.
 */

function Row({ icon, tint, title, sub, onPress }: {
  icon: IoniconsName;
  tint: string;
  title: string;
  sub: string;
  onPress?: () => void;
}) {
  const body = (
    <>
      <View style={[styles.icon, { backgroundColor: alpha(tint, 0.12), borderColor: alpha(tint, 0.32) }]}>
        <Ionicons name={icon} size={GLYPH.md} color={tint} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={GLYPH.sm} color={colors.textMuted} /> : null}
    </>
  );
  return onPress
    ? <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>{body}</TouchableOpacity>
    : <View style={styles.row}>{body}</View>;
}

export function SupportScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isPro = useBetsStore((s) => s.settings.isPro);
  const [paywall, setPaywall] = useState(false);
  const closePaywall = useCallback(() => setPaywall(false), []);
  const review = storeReviewUrls(Platform.OS);
  const contact = supportUrl();

  function openPro() {
    Analytics.supportAction('pro');
    setPaywall(true);
  }

  async function rate() {
    if (!review) return;
    Analytics.supportAction('rate');
    // Not canOpenURL: on Android 11+ it answers false for `market://` unless
    // the manifest declares the query, and the fallback would never be tried.
    try {
      await Linking.openURL(review[0]);
    } catch {
      try {
        await Linking.openURL(review[1]);
      } catch {
        Alert.alert(t('common.error'), t('support.openFailed'));
      }
    }
  }

  function write() {
    if (!contact) return;
    Analytics.supportAction('write');
    // An https link, not tg:// — it opens the Telegram app when it is
    // installed and the web page when it is not, so nobody hits a dead end.
    Linking.openURL(contact).catch(() => Alert.alert(t('common.error'), t('support.linkFailed')));
  }

  function share() {
    Analytics.supportAction('share');
    Share.share({ message: t('support.shareMessage', { url: LANDING_URL }) }).catch(() => {});
  }

  return (
    <>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.root}
        contentContainerStyle={{ padding: SPACE.lg, paddingBottom: insets.bottom + SPACE.xl, gap: SPACE.sm }}
      >
        {/* The native stack header already names the screen. */}
        <Text style={styles.intro}>{t('support.intro')}</Text>

        {isPro
          ? <Row icon="star" tint={colors.gold} title={t('support.proActive')} sub={t('support.proSub')} />
          : <Row icon="star-outline" tint={colors.gold} title={t('support.pro')} sub={t('support.proSub')} onPress={openPro} />}

        {review && (
          <Row icon="thumbs-up-outline" tint={colors.accent} title={t('support.rate')} sub={t('support.rateSub')} onPress={rate} />
        )}

        <Row icon="share-social-outline" tint={colors.purple} title={t('support.share')} sub={t('support.shareSub')} onPress={share} />

        {contact && (
          <Row icon="paper-plane-outline" tint={colors.violet} title={t('support.write')} sub={t('support.writeSub')} onPress={write} />
        )}
      </ScrollView>

      <PaywallSheet visible={paywall} onClose={closePaywall} feature={t('support.proFeature')} />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  intro: { fontSize: SIZE.body, color: colors.textSecondary, lineHeight: 20, marginBottom: SPACE.sm },
  row: {
    ...cardSurface,
    minHeight: TOUCH,
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    padding: SPACE.md,
  },
  icon: {
    width: 40, height: 40, borderRadius: RADIUS.pill, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: SIZE.lead, fontWeight: '600', color: colors.textPrimary },
  rowSub: { fontSize: SIZE.caption, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },
});
