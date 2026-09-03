import React, { useRef, useState } from 'react';
import {
  Animated, PanResponder, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { colors } from '../../theme/colors';
import { haptic } from '../../utils/haptics';

const DELETE_W = 76;

interface Props {
  children: React.ReactNode;
  onDelete: () => void;
}

export const SwipeableRow = React.memo(function SwipeableRow({ children, onDelete }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpenRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);

  function snapTo(open: boolean) {
    Animated.spring(translateX, {
      toValue: open ? -DELETE_W : 0,
      useNativeDriver: true,
      overshootClamping: true,
      tension: 120,
      friction: 14,
    }).start();
    isOpenRef.current = open;
    setIsOpen(open);
  }

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6,

      onPanResponderMove: (_, { dx }) => {
        const base = isOpenRef.current ? -DELETE_W : 0;
        translateX.setValue(Math.max(-DELETE_W, Math.min(0, base + dx)));
      },

      onPanResponderRelease: (_, { dx, vx }) => {
        if (isOpenRef.current) {
          // Close if swiped right far enough or fast enough
          snapTo(!(dx > DELETE_W / 2 || vx > 0.5));
        } else {
          // Open if swiped left far enough or fast enough
          if (dx < -DELETE_W / 2 || vx < -0.5) {
            haptic.light();
            snapTo(true);
          } else {
            snapTo(false);
          }
        }
      },
    }),
  ).current;

  function handleDelete() {
    snapTo(false);
    // Small delay so close animation plays before item disappears
    setTimeout(onDelete, 180);
  }

  return (
    <View style={styles.container}>
      {/* Delete zone — revealed when card slides left */}
      <View
        style={[styles.deleteZone, { width: DELETE_W }]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.75}>
          <Text style={styles.deleteIcon}>🗑</Text>
          <Text style={styles.deleteText}>Удалить</Text>
        </TouchableOpacity>
      </View>

      {/* Card */}
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX }] }}>
        {isOpen ? (
          <TouchableWithoutFeedback onPress={() => snapTo(false)}>
            <View>{children}</View>
          </TouchableWithoutFeedback>
        ) : (
          children
        )}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  deleteZone: {
    position: 'absolute',
    // Align with BetCard's card area (marginHorizontal:16, marginBottom:10)
    right: 16,
    top: 0,
    bottom: 10,
    backgroundColor: colors.lost,
    // Must match BetCard's radius, or the red backing peeks out at the corners.
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: { alignItems: 'center', gap: 3 },
  deleteIcon: { fontSize: 18 },
  deleteText: { fontSize: 10, fontWeight: '700', color: '#fff' },
});
