import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { colors } from '../theme/colors';

const CHECKLIST = [
  { emoji: '🧠', text: 'Я не в состоянии тилта' },
  { emoji: '📋', text: 'Ставка соответствует моей стратегии' },
  { emoji: '🔍', text: 'Я проанализировал событие' },
  { emoji: '📊', text: 'Я укладываюсь в дневной лимит' },
  { emoji: '💸', text: 'Я готов потерять эту сумму' },
];

interface Props {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ChecklistModal({ visible, onConfirm, onCancel }: Props) {
  const [checked, setChecked] = useState<boolean[]>(Array(CHECKLIST.length).fill(false));

  const allChecked = checked.every(Boolean);

  function toggle(i: number) {
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  function handleConfirm() {
    setChecked(Array(CHECKLIST.length).fill(false));
    onConfirm();
  }

  function handleCancel() {
    setChecked(Array(CHECKLIST.length).fill(false));
    onCancel();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>Готов к ставке? 🦈</Text>
          <Text style={styles.subtitle}>
            Отметь все пункты — это занимает 10 секунд и сохраняет дисциплину
          </Text>

          <ScrollView style={{ marginBottom: 20 }} showsVerticalScrollIndicator={false}>
            {CHECKLIST.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.item, checked[i] && styles.itemChecked]}
                onPress={() => toggle(i)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, checked[i] && styles.checkboxChecked]}>
                  {checked[i] && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.emoji}>{item.emoji}</Text>
                <Text style={[styles.itemText, checked[i] && styles.itemTextChecked]}>
                  {item.text}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.confirmBtn, !allChecked && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!allChecked}
            activeOpacity={0.85}
          >
            <Text style={[styles.confirmText, !allChecked && styles.confirmTextDisabled]}>
              {allChecked ? 'Ставить 💪' : `Отметь все (${checked.filter(Boolean).length}/${CHECKLIST.length})`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelText}>Отмена</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.bgElevated,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemChecked: {
    borderColor: colors.accent + '66',
    backgroundColor: colors.accent + '0D',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxChecked: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  checkmark: { fontSize: 14, color: '#000', fontWeight: '700' },
  emoji: { fontSize: 18, flexShrink: 0 },
  itemText: { fontSize: 14, color: colors.textSecondary, flex: 1, lineHeight: 20 },
  itemTextChecked: { color: colors.textPrimary },
  confirmBtn: {
    backgroundColor: colors.purple,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmBtnDisabled: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  confirmTextDisabled: { color: colors.textMuted },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { fontSize: 14, color: colors.textMuted },
});
