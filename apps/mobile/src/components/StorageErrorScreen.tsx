import { useLayoutEffect, useState } from 'react';
import { View, TouchableOpacity, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText as Text } from './AppText';
import { ErrorReportSheet } from './ErrorReportSheet';
import { useBetsStore, lastStorageFailure } from '../store/betsStore';
import { reportFor } from '../services/crashReport';
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
  // The report, built when the window opens: the exception that stopped the load.
  const [report, setReport] = useState<string | null>(null);
  const contact = supportUrl();

  // A retry that failed again: said, or the button just blinks and nothing seems to happen.
  const [stillFailing, setStillFailing] = useState(false);

  // The settings were not read, so there is no saved language: the phone's —
  // before the first paint, not after it (useLayoutEffect).
  useLayoutEffect(() => { applyLanguage(undefined); }, []);

  async function retry() {
    setBusy(true);
    await load();
    // Still on this screen (a success unmounts it): say so.
    if (useBetsStore.getState().loadError) {
      setBusy(false);
      setStillFailing(true);
    }
  }

  return (
    <View style={[s.root, { paddingBottom: bottomPad }]}>
      <Text style={s.title} accessibilityRole="header">{t('storageError.title')}</Text>
      <Text style={s.body}>{t('storageError.body')}</Text>
      {stillFailing ? <Text style={s.still} accessibilityLiveRegion="polite">{t('storageError.stillFailing')}</Text> : null}
      <TouchableOpacity
        style={[s.button, busy && s.buttonBusy]}
        onPress={retry}
        disabled={busy}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        <Text style={[s.buttonText, busy && s.buttonTextBusy]}>{t('storageError.retry')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={s.link}
        onPress={() => setReport(reportFor(lastStorageFailure() ?? new Error('unknown'), 'storage'))}
        accessibilityRole="button"
      >
        <Text style={s.linkText}>{t('errorReport.open')}</Text>
      </TouchableOpacity>
      {contact ? (
        <TouchableOpacity style={s.link} onPress={() => { Linking.openURL(contact).catch(() => {}); }} accessibilityRole="link">
          <Text style={s.linkText}>{t('storageError.support')}</Text>
        </TouchableOpacity>
      ) : null}
      <ErrorReportSheet visible={report !== null} report={report ?? ''} onClose={() => setReport(null)} />
    </View>
  );
}

const s = themedStyles(() => ({
  root: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', paddingHorizontal: SPACE.xl, gap: SPACE.lg },
  title: { fontSize: SIZE.title, fontWeight: '700', color: colors.textPrimary },
  body: { fontSize: SIZE.body, color: colors.textSecondary, lineHeight: 21 },
  still: { fontSize: SIZE.body, color: colors.pending, lineHeight: 21 },
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
