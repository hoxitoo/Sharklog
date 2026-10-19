import React, { useEffect } from 'react';
import { Modal, Pressable, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ProOffer } from './ProGate';
import { useBetsStore, ownsPro } from '../store/betsStore';
import { colors } from '../theme/colors';
import { SPACE, RADIUS, hitSlopFor } from '../theme/layout';
import { GLYPH } from '../theme/typography';
import { themedStyles } from '../theme/themed';

/**
 * The paywall as a bottom sheet, for places that offer Pro without gating a
 * screen behind it (Settings rows, "Support the author"). Opens during the
 * trial too — buying before it runs out must be possible — so it shows the
 * offer itself, not `ProGate` (which would show the gated content instead).
 *
 * Closes itself once Pro is BOUGHT: a licence arrived, or the store granted
 * it (which drops the trial date). Pro alone is not the signal — a trial user
 * is Pro and still came here to buy.
 */
export function PaywallSheet({ visible, onClose, feature }: {
  visible: boolean;
  onClose: () => void;
  feature: string;
}) {
  const { t } = useTranslation();
  const owned = useBetsStore((s) => ownsPro(s.settings));

  useEffect(() => {
    if (owned && visible) onClose();
  }, [owned, visible, onClose]);

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
          <ProOffer feature={feature} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = themedStyles(() => ({
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
}));
