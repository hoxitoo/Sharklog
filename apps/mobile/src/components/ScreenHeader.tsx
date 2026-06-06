import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { FONTS } from '../theme/typography';
import { useDrawer } from './DrawerContext';

interface Props {
  title: string;
  subtitle?: string;
  rightAction?: { label: string; onPress: () => void };
}

function HamburgerIcon() {
  return (
    <View style={{ gap: 4, padding: 2 }}>
      <View style={styles.line} />
      <View style={styles.line} />
      <View style={styles.line} />
    </View>
  );
}

export function ScreenHeader({ title, subtitle, rightAction }: Props) {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useDrawer();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity style={styles.hamburger} onPress={openDrawer} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <HamburgerIcon />
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
  line: {
    width: 20,
    height: 2,
    backgroundColor: colors.textSecondary,
    borderRadius: 1,
  },
  center: { flex: 1 },
  title: { fontSize: 24, fontFamily: FONTS.sansBold, color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontFamily: FONTS.sans, color: colors.textSecondary, marginTop: 2 },
  action: {
    backgroundColor: colors.purple,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  actionPlaceholder: { width: 36 },
});
