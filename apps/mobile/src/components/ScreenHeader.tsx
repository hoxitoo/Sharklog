import React from 'react';
import { SPACE, RADIUS, TOUCH } from '../theme/layout';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText as Text } from './AppText';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { FONTS, SIZE, sansFor } from '../theme/typography';
import { useDrawer } from './DrawerContext';

/**
 * Header type, defined once for both kinds of header.
 *
 * Drawer screens use the component below; stack screens use the native header
 * from react-navigation. They had drifted apart — the native one sat on
 * `bgCard` instead of the page, and since `headerTitleStyle` never named a
 * family it rendered five screen titles in the system font while the rest of
 * the app moved to DM Sans.
 *
 * `fontWeight` is deliberately absent: the weight has already chosen the file,
 * and leaving it set fake-bolds a face that is already bold.
 */
const HEADER_FACE = {
  fontFamily: sansFor('700'),
  color: colors.textPrimary,
};

/** Drawer screens: a large title that owns the top of the page. */
export const HEADER_TITLE = { ...HEADER_FACE, fontSize: SIZE.hero, letterSpacing: -0.5 };

/**
 * Stack screens: a nav-bar title, sharing a row with the back button.
 *
 * No `letterSpacing` on purpose. react-navigation's native stack forwards only
 * family, size, weight and colour to the native header and drops the rest, so
 * setting it here would read as shared and render as nothing.
 */
export const NAV_TITLE = { ...HEADER_FACE, fontSize: SIZE.title };

interface Props {
  title: string;
  subtitle?: string;
  rightAction?: { label: string; onPress: () => void };
}

export function ScreenHeader({ title, subtitle, rightAction }: Props) {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useDrawer();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity style={styles.hamburger} onPress={openDrawer} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="menu" size={24} color={colors.textSecondary} />
      </TouchableOpacity>
      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightAction ? (
        <TouchableOpacity style={styles.action} onPress={rightAction.onPress} activeOpacity={0.7}>
          <Text style={styles.actionText}>{rightAction.label}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.actionPlaceholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.md,
    backgroundColor: colors.bg,
    gap: SPACE.sm,
  },
  hamburger: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
  },
  center: { flex: 1 },
  title: HEADER_TITLE,
  subtitle: { fontSize: SIZE.body, fontFamily: FONTS.sans, color: colors.textSecondary, marginTop: 2 },
  action: {
    minHeight: TOUCH, justifyContent: 'center',
    backgroundColor: colors.purple,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.lg,
  },
  actionText: { fontSize: SIZE.body, fontWeight: '700', color: '#fff' },
  actionPlaceholder: { width: 36 },
});
