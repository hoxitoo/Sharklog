import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText as Text } from './AppText';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { FONTS, SIZE } from '../theme/typography';
import { useDrawer } from './DrawerContext';

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
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.bg,
    gap: 10,
  },
  hamburger: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  center: { flex: 1 },
  title: { fontSize: SIZE.hero, fontFamily: FONTS.sansBold, color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: SIZE.body, fontFamily: FONTS.sans, color: colors.textSecondary, marginTop: 2 },
  action: {
    backgroundColor: colors.purple,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionText: { fontSize: SIZE.body, fontWeight: '700', color: '#fff' },
  actionPlaceholder: { width: 36 },
});
