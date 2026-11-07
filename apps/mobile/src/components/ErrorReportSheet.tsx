import { useEffect, useRef, useState } from 'react';
import { Modal, View, Pressable, ScrollView, TouchableOpacity, Linking, Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText as Text } from './AppText';
import { supportUrl } from '../utils/storeLinks';
import { useBottomPad } from '../utils/useBottomPad';
import { colors } from '../theme/colors';
import { themedStyles } from '../theme/themed';
import { SPACE, RADIUS, TOUCH } from '../theme/layout';
import { SIZE } from '../theme/typography';

interface Props {
  visible: boolean;
  /** The report text (services/crashReport → reportFor): shown first, sent as is. */
  report: string;
  onClose: () => void;
}

/**
 * The error report, before anything is sent: the user reads exactly what goes
 * to the author and sends it themselves — copied into a message to support
 * (EXPO_PUBLIC_SUPPORT_URL) or through the system share sheet. No service in
 * between, no send without a tap.
 */
export function ErrorReportSheet({ visible, report, onClose }: Props) {
  const { t } = useTranslation();
  const bottomPad = useBottomPad(SPACE.lg);
  const contact = supportUrl();
  const [copied, setCopied] = useState(false);
  // The text stays while the window fades out: every caller clears it on
  // close, and the modal is still drawn during the fade — it went blank and
  // shrank on its way out.
  const shown = useRef(report);
  if (visible && report) shown.current = report;
  const text = shown.current;

  // A fresh window says nothing about a copy made the last time.
  useEffect(() => { if (visible) setCopied(false); }, [visible]);

  const close = onClose;

  async function copy(): Promise<boolean> {
    try {
      // Loaded on use, not with the window: a build made before the native
      // module was added fails on importing it — on the error screens, of all
      // places, and before the crash handler is in (review 2026-11-07).
      const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
      await Clipboard.setStringAsync(text);
      setCopied(true);
      return true;
    } catch {
      return false;
    }
  }

  function share() {
    Share.share({ message: text }).catch(() => {});
  }

  async function copyAndContact() {
    // A copy that failed would open the chat with nothing to paste: share instead.
    if (!(await copy())) { share(); return; }
    if (contact) Linking.openURL(contact).catch(() => {});
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      {/* `accessible={false}`: an accessible Pressable hides its children from
          VoiceOver (pickerGuards.test.ts). */}
      <Pressable style={s.backdrop} onPress={close} accessible={false}>
        <View
          style={[s.sheet, { paddingBottom: bottomPad }]}
          accessibilityViewIsModal
          onAccessibilityEscape={close}
        >
          {/* Taps inside the sheet must not reach the backdrop's close. */}
          <Pressable onPress={(e) => e.stopPropagation()} accessible={false}>
            <View style={s.handle} />
            <Text style={s.title} accessibilityRole="header">{t('errorReport.title')}</Text>
            <Text style={s.intro}>{t('errorReport.intro')}</Text>
            <ScrollView style={s.preview} contentContainerStyle={s.previewInner} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              <Text style={s.previewText} selectable>{text}</Text>
            </ScrollView>
            {copied ? <Text style={s.copied} accessibilityLiveRegion="polite">{t('errorReport.copied')}</Text> : null}
            {contact ? (
              <>
                <TouchableOpacity style={s.primary} onPress={copyAndContact} activeOpacity={0.8} accessibilityRole="button">
                  <Text style={s.primaryText}>{t('errorReport.copyAndContact')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.secondary} onPress={share} activeOpacity={0.8} accessibilityRole="button">
                  <Text style={s.secondaryText}>{t('errorReport.share')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={s.primary} onPress={share} activeOpacity={0.8} accessibilityRole="button">
                  <Text style={s.primaryText}>{t('errorReport.share')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.secondary} onPress={copy} activeOpacity={0.8} accessibilityRole="button">
                  <Text style={s.secondaryText}>{t('errorReport.copy')}</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={s.secondary} onPress={close} activeOpacity={0.8} accessibilityRole="button">
              <Text style={s.closeText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const s = themedStyles(() => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    paddingHorizontal: SPACE.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    width: 36, height: 4, borderRadius: RADIUS.pill,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center', marginTop: SPACE.md, marginBottom: SPACE.md,
  },
  title: { fontSize: SIZE.lead, fontWeight: '700', color: colors.textPrimary, marginBottom: SPACE.xs },
  intro: { fontSize: SIZE.caption, color: colors.textSecondary, lineHeight: 17, marginBottom: SPACE.md },
  preview: {
    maxHeight: 220,
    backgroundColor: colors.bgSunken,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: SPACE.md,
  },
  previewInner: { padding: SPACE.md },
  previewText: { fontSize: SIZE.micro, color: colors.textSecondary, fontFamily: 'DMMono_400Regular', lineHeight: 15 },
  copied: { fontSize: SIZE.caption, color: colors.won, marginBottom: SPACE.sm, textAlign: 'center' },
  primary: {
    minHeight: TOUCH, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.purple, borderRadius: RADIUS.md, paddingHorizontal: SPACE.lg,
    marginBottom: SPACE.sm,
  },
  primaryText: { fontSize: SIZE.body, fontWeight: '700', color: '#fff' },
  secondary: { minHeight: TOUCH, justifyContent: 'center', alignItems: 'center' },
  secondaryText: { fontSize: SIZE.body, fontWeight: '700', color: colors.purpleText },
  closeText: { fontSize: SIZE.body, color: colors.textMuted },
}));
