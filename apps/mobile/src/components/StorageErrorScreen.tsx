import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText as Text } from './AppText';
import { useBetsStore } from '../store/betsStore';
import { applyLanguage } from '../i18n';
import { supportUrl } from '../utils/storeLinks';
import { useBottomPad } from '../utils/useBottomPad';
import { colors } from '../theme/colors';
import { themedStyles } from '../theme/themed';
import { SPACE, RADIUS, TOUCH } from '../theme/layout';
import { SIZE } from '../theme/typography';

/**
 * Shown when the stored data could not be READ. The store then writes nothing
 * (persist checks loadError): the app used to start empty here, and the first
 * save — finishing the onboarding it showed — replaced the real file. This
 * screen says the data is still there, offers a retry, and warns against the
 * one thing that would lose it for good: reinstalling.
 */
export function StorageErrorScreen() {
  const { t } = useTranslation();
  const load = useBetsStore((s) => s.load);
  const bottomPad = useBottomPad(SPACE.xl);
  const [busy, setBusy] = useState(false);
  const contact = supportUrl();

  // The settings were not read, so there is no saved language: the phone's.
  useEffect(() => { applyLanguage(undefined); }, []);

  async function retry() {
    setBusy(true);
    await load();
    setBusy(false);
  }

  return (
    <View style={[s.root, { paddingBottom: bottomPad }]}>
      <Text style={s.title} accessibilityRole="header">{t('storageError.title')}</Text>
      <Text style={s.body}>{t('storageError.body')}</Text>
      <TouchableOpacity
        style={[s.button, busy && s.buttonBusy]}
        onPress={retry}
        disabled={busy}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        <Text style={[s.buttonText, busy && s.buttonTextBusy]}>{t('storageError.retry')}</Text>
      </TouchableOpacity>
      {contact ? (
        <TouchableOpacity style={s.link} onPress={() => { Linking.openURL(contact).catch(() => {}); }} accessibilityRole="link">
          <Text style={s.linkText}>{t('storageError.support')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = themedStyles(() => ({
  root: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', paddingHorizontal: SPACE.xl, gap: SPACE.lg },
  title: { fontSize: SIZE.title, fontWeight: '700', color: colors.textPrimary },
  body: { fontSize: SIZE.body, color: colors.textSecondary, lineHeight: 21 },
  button: {
    minHeight: TOUCH, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.purple, borderRadius: RADIUS.md, paddingHorizontal: SPACE.lg,
  },
  buttonBusy: { backgroundColor: colors.bgElevated },
  buttonText: { fontSize: SIZE.lead, fontWeight: '700', color: '#fff' },
  buttonTextBusy: { color: colors.textMuted },
  link: { minHeight: TOUCH, justifyContent: 'center', alignSelf: 'center' },
  linkText: { fontSize: SIZE.body, fontWeight: '700', color: colors.purpleText },
}));
