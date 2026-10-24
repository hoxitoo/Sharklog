import React, { useEffect, useState } from 'react';
import {
  Modal, Pressable, View, TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText as Text, AppTextInput as TextInput } from './AppText';
import { useBetsStore } from '../store/betsStore';
import { checkLicenseStanding } from '../services/purchase';
import { colors } from '../theme/colors';
import { SPACE, RADIUS, TOUCH } from '../theme/layout';
import { SIZE, numeric } from '../theme/typography';
import { themedStyles } from '../theme/themed';

/**
 * Paste a restore code (the signed licence) to bring Pro back — on a new phone,
 * after a reinstall, or when the backup is not at hand. There is no account to
 * restore from: the code IS the purchase. It is checked against the licence
 * server's public key before anything is saved.
 */
export function RestoreCodeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const applyLicense = useBetsStore((s) => s.applyLicense);
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);

  // A fresh field every time it opens: a half-pasted code from last time is noise.
  useEffect(() => {
    if (visible) {
      setCode('');
      setInvalid(false);
    }
  }, [visible]);

  function apply() {
    if (!applyLicense(code)) {
      setInvalid(true);
      return;
    }
    // A code refunded and revoked must not hold Pro until the next launch on a
    // phone that has never seen it revoked. Off the main path: no answer, no change.
    checkLicenseStanding();
    onClose();
    // After the modal is gone: an alert raised by an unmounting modal can be lost.
    requestAnimationFrame(() => Alert.alert(t('common.success'), t('settings.restoreCodeDone')));
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.bg} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>{t('settings.restoreCode')}</Text>
            <Text style={styles.prompt}>{t('settings.restoreCodePrompt')}</Text>
            <TextInput
              style={[styles.input, invalid && styles.inputInvalid]}
              value={code}
              onChangeText={(v) => { setCode(v); setInvalid(false); }}
              placeholder="SL1.…"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              autoFocus
            />
            {invalid && <Text style={styles.error}>{t('settings.restoreCodeInvalid')}</Text>}
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.btnGhostText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, !code.trim() && styles.btnOff]}
                onPress={apply}
                disabled={!code.trim()}
                activeOpacity={0.8}
              >
                <Text style={[styles.btnPrimaryText, !code.trim() && styles.btnOffText]}>
                  {t('settings.restoreCodeApply')}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  flex: { flex: 1 },
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet,
    padding: SPACE.lg, paddingBottom: SPACE.xxl, gap: SPACE.sm,
  },
  title: { fontSize: SIZE.title, fontWeight: '700', color: colors.textPrimary },
  prompt: { fontSize: SIZE.body, color: colors.textSecondary, lineHeight: 20 },
  input: {
    ...numeric,
    minHeight: 88, fontSize: SIZE.caption, color: colors.textPrimary,
    backgroundColor: colors.bgSunken, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border,
    padding: SPACE.md, textAlignVertical: 'top',
  },
  inputInvalid: { borderColor: colors.lost },
  error: { fontSize: SIZE.caption, color: colors.lost, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.sm },
  btn: { flex: 1, minHeight: TOUCH, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: colors.bgElevated },
  btnGhostText: { fontSize: SIZE.lead, fontWeight: '600', color: colors.textSecondary },
  btnPrimary: { backgroundColor: colors.purple },
  btnPrimaryText: { fontSize: SIZE.lead, fontWeight: '700', color: '#fff' },
  btnOff: { backgroundColor: colors.bgElevated },
  btnOffText: { color: colors.textMuted },
}));
