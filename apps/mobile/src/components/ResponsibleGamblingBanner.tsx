import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { AppText as Text } from './AppText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';

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
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  icon: { fontSize: 14 },
  title: { flex: 1, fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  chevron: { fontSize: 10, color: colors.textMuted },
  body: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  text: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
