import React from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AppText as Text } from '../../components/AppText';
import { THEMES, type ThemeId } from '../../theme/themes';
import { colors } from '../../theme/colors';
import { SPACE, RADIUS, TOUCH } from '../../theme/layout';
import { SIZE, GLYPH } from '../../theme/typography';

const LABEL_KEY: Record<ThemeId, string> = {
  dark: 'settings.themeDark',
  light: 'settings.themeLight',
  oldschool: 'settings.themeOldschool',
};

/**
 * Three preview tiles, each painted in its own theme. Only the dark theme is
 * real; the others are marked "soon" and say so when tapped — a tile that
 * silently did nothing would read as broken.
 */
export function ThemePicker() {
  const { t } = useTranslation();
  const current: ThemeId = 'dark';

  return (
    <View style={s.row}>
      {THEMES.map((theme) => {
        const active = theme.id === current;
        const { swatch } = theme;
        return (
          <TouchableOpacity
            key={theme.id}
            style={s.cell}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: !theme.available }}
            onPress={() => {
              if (!theme.available) Alert.alert(t(LABEL_KEY[theme.id]), t('settings.themeSoonMsg'));
            }}
          >
            <View style={[s.tile, { backgroundColor: swatch.bg, borderColor: active ? colors.purple : colors.border }]}>
              <View style={[s.card, { backgroundColor: swatch.card }]}>
                <View style={[s.line, { backgroundColor: swatch.text }]} />
                <View style={[s.lineShort, { backgroundColor: swatch.text }]} />
              </View>
              <View style={[s.dot, { backgroundColor: swatch.accent }]} />
              {active && (
                <View style={s.check}>
                  <Ionicons name="checkmark" size={GLYPH.sm} color="#fff" />
                </View>
              )}
            </View>
            <Text style={[s.label, active && s.labelActive]} numberOfLines={1}>{t(LABEL_KEY[theme.id])}</Text>
            {!theme.available && <Text style={s.soon}>{t('common.soon')}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACE.sm, paddingVertical: SPACE.md },
  cell: { flex: 1, alignItems: 'center', minHeight: TOUCH },
  tile: {
    alignSelf: 'stretch', height: 64, borderRadius: RADIUS.md, borderWidth: 2,
    padding: SPACE.sm, justifyContent: 'space-between', overflow: 'hidden',
  },
  card: { borderRadius: RADIUS.xs, padding: SPACE.xs, gap: 3 },
  line: { height: 3, width: '70%', borderRadius: RADIUS.xs, opacity: 0.85 },
  lineShort: { height: 3, width: '40%', borderRadius: RADIUS.xs, opacity: 0.5 },
  dot: { width: 16, height: 6, borderRadius: RADIUS.xs, alignSelf: 'flex-end' },
  check: {
    position: 'absolute', top: SPACE.xs, right: SPACE.xs,
    width: 18, height: 18, borderRadius: RADIUS.pill,
    backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: SIZE.caption, color: colors.textSecondary, marginTop: SPACE.xs },
  labelActive: { color: colors.textPrimary, fontWeight: '700' },
  soon: { fontSize: SIZE.micro, color: colors.textMuted },
});
