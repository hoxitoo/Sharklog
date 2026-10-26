import React, { useEffect, useState } from 'react';
import {
  Modal, Pressable, View, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText as Text, AppTextInput as TextInput } from './AppText';
import { applyRestoreCode, type CodeResult } from '../services/purchase';
import { colors } from '../theme/colors';
import { SPACE, RADIUS, TOUCH } from '../theme/layout';
import { SIZE, numeric } from '../theme/typography';
import { themedStyles } from '../theme/themed';
import { useBottomPad } from '../utils/useBottomPad';

/**
 * Paste a restore code (the signed licence) to bring Pro back — on a new phone,
 * after a reinstall, or when the backup is not at hand. There is no account to
 * restore from: the code IS the purchase. It is checked against the licence
 * server's public key before anything is saved.
 */
export function RestoreCodeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const bottomPad = useBottomPad(SPACE.xxl);
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  // Why the code was not taken — "invalid" is not the only answer: a code this
  // phone saw revoked is asked about again (a mistaken revoke can be undone).
  const [problem, setProblem] = useState<Exclude<CodeResult, 'ok'> | null>(null);
  const [busy, setBusy] = useState(false);

  // A fresh field every time it opens: a half-pasted code from last time is noise.
  useEffect(() => {
    if (visible) {
      setCode('');
      setProblem(null);
    }
  }, [visible]);

  async function apply() {
    setBusy(true);
    const result = await applyRestoreCode(code).finally(() => setBusy(false));
    if (result !== 'ok') {
      setProblem(result);
      return;
    }
    onClose();
    // After the modal is gone: an alert raised by an unmounting modal can be lost.
    requestAnimationFrame(() => Alert.alert(t('common.success'), t('settings.restoreCodeDone')));
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.bg} onPress={onClose}>
          <Pressable style={[styles.sheet, { paddingBottom: bottomPad }]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>{t('settings.restoreCode')}</Text>
            <Text style={styles.prompt}>{t('settings.restoreCodePrompt')}</Text>
            <TextInput
              style={[styles.input, problem && styles.inputInvalid]}
              value={code}
              onChangeText={(v) => { setCode(v); setProblem(null); }}
              placeholder="SL1.…"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              autoFocus
            />
            {problem && (
              <Text style={styles.error}>
                {t(problem === 'revoked' ? 'settings.restoreCodeRevoked'
                  : problem === 'unreachable' ? 'settings.restoreCodeOffline'
                  : 'settings.restoreCodeInvalid')}
              </Text>
            )}
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.btnGhostText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, (!code.trim() || busy) && styles.btnOff]}
                onPress={apply}
                disabled={!code.trim() || busy}
                activeOpacity={0.8}
              >
                {busy
                  ? <ActivityIndicator color={colors.textMuted} />
                  : (
                    <Text style={[styles.btnPrimaryText, !code.trim() && styles.btnOffText]}>
                      {t('settings.restoreCodeApply')}
                    </Text>
                  )}
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
