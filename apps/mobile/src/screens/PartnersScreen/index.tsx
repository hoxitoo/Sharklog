import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AppText as Text } from '../../components/AppText';
import { colors, alpha } from '../../theme/colors';
import { SPACE, RADIUS } from '../../theme/layout';
import { SIZE, GLYPH } from '../../theme/typography';
import { themedStyles } from '../../theme/themed';

/**
 * A placeholder until the partner programme is settled.
 *
 * The previous list carried made-up bonuses ("до 10 000 ₽ новым игрокам")
 * next to real bookmaker names and plain links — advertising of bookmakers
 * without the marking and wording the law asks for. Nothing goes back here
 * without real offers from the affiliate network.
 */
export function PartnersScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.root}>
      <View style={styles.badge}>
        <Ionicons name="gift-outline" size={GLYPH.xl} color={colors.accent} />
      </View>
      {/* The native stack header already names the section. */}
      <Text style={styles.title}>{t('partners.stubTitle')}</Text>
      <Text style={styles.text}>{t('partners.stubText')}</Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  root: {
    flex: 1, backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACE.xl, gap: SPACE.md,
  },
  badge: {
    width: 72, height: 72, borderRadius: RADIUS.pill,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: alpha(colors.accent, 0.1),
    borderWidth: 1, borderColor: alpha(colors.accent, 0.3),
    marginBottom: SPACE.sm,
  },
  title: { fontSize: SIZE.title, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  text: { fontSize: SIZE.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
}));
