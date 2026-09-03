import React, { useEffect, useRef, useState } from 'react';
import { SPACE, RADIUS, TOUCH } from '../theme/layout';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { AppText as Text } from './AppText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import { SIZE, GLYPH } from '../theme/typography';

const STORAGE_KEY = '@sharklog/responsible_expanded';

export function ResponsibleGamblingBanner() {
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const animHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      const shouldExpand = v !== 'false';
      setExpanded(shouldExpand);
      animHeight.setValue(shouldExpand ? 1 : 0);
      setLoaded(true);
    });
  }, []);

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    Animated.timing(animHeight, {
      toValue: next ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
    AsyncStorage.setItem(STORAGE_KEY, String(next));
  }

  if (!loaded) return null;

  const expandedHeight = animHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 40],
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.header} onPress={toggle} activeOpacity={0.7}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.title}>Ответственная игра · 18+</Text>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      <Animated.View style={[styles.body, { height: expandedHeight, overflow: 'hidden' }]}>
        <Text style={styles.text}>
          Ставки должны быть развлечением, а не источником дохода.
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACE.lg,
    marginBottom: SPACE.xl,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
  },
  header: { minHeight: TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  icon: { fontSize: GLYPH.md },
  title: { flex: 1, fontSize: SIZE.caption, color: colors.textMuted, fontWeight: '600' },
  chevron: { fontSize: GLYPH.sm, color: colors.textMuted },
  body: {
    paddingHorizontal: SPACE.md,
    paddingBottom: SPACE.sm,
  },
  text: {
    fontSize: SIZE.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
