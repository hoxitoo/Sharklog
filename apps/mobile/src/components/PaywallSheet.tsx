import React, { useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ProGate } from './ProGate';
import { useBetsStore } from '../store/betsStore';
import { colors } from '../theme/colors';
import { SPACE, RADIUS, hitSlopFor } from '../theme/layout';
import { GLYPH } from '../theme/typography';

/**
 * The paywall as a bottom sheet, for places that offer Pro without gating a
 * screen behind it (Settings rows, "Support the author"). The sheet itself is
 * `ProGate` with nothing behind the gate.
 *
 * Closes itself once Pro turns on: the purchase lands in the store, and a sheet
 * still asking a paying user to pay is the wrong thing to leave on screen.
 */
export function PaywallSheet({ visible, onClose, feature }: {
  visible: boolean;
  onClose: () => void;
  feature: string;
}) {
  const { t } = useTranslation();
  const isPro = useBetsStore((s) => s.settings.isPro);

  useEffect(() => {
    if (isPro && visible) onClose();
  }, [isPro, visible, onClose]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* Tap outside the sheet to dismiss (standard bottom-sheet behavior) */}
      <Pressable style={styles.bg} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <TouchableOpacity
            style={styles.close}
            hitSlop={hitSlopFor(32)}
            onPress={onClose}
            accessibilityLabel={t('common.close')}
          >
            <Ionicons name="close" size={GLYPH.md} color={colors.textSecondary} />
          </TouchableOpacity>
          <ProGate feature={feature}>
            <View />
          </ProGate>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet,
    minHeight: '75%', overflow: 'hidden',
  },
  close: {
    position: 'absolute', top: SPACE.md, right: SPACE.lg, zIndex: 10,
    width: 32, height: 32, borderRadius: RADIUS.pill,
    backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center',
  },
});
