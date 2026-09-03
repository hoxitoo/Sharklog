import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { AppText as Text } from './AppText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import { SIZE } from '../theme/typography';

interface Props {
  storageKey: string;
  title: string;
  body: string;
  position?: 'top' | 'bottom';
}

export function Coachmark({ storageKey, title, body, position = 'bottom' }: Props) {
  const [visible, setVisible] = React.useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(storageKey).then((seen) => {
      if (!seen) setVisible(true);
    });
  }, [storageKey]);

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [visible, opacity]);

  function dismiss() {
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setVisible(false);
    });
    AsyncStorage.setItem(storageKey, '1');
  }

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, position === 'top' ? styles.top : styles.bottom, { opacity }]}>
      <View style={styles.bubble}>
        <View style={styles.row}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.body}>{body}</Text>
        <TouchableOpacity style={styles.btn} onPress={dismiss}>
          <Text style={styles.btnText}>Понятно</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 999,
  },
  top: { top: 80 },
  bottom: { bottom: 100 },
  bubble: {
    backgroundColor: colors.purple,
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: { fontSize: SIZE.body, fontWeight: '700', color: '#fff' },
  close: { fontSize: SIZE.caption, color: 'rgba(255,255,255,0.7)' },
  body: { fontSize: SIZE.body, color: 'rgba(255,255,255,0.85)', lineHeight: 20, marginBottom: 12 },
  btn: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnText: { fontSize: SIZE.body, fontWeight: '600', color: '#fff' },
});
