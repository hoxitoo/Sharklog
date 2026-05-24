import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FREE_LIMITS } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { colors } from '../../theme/colors';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={row.container}>
      <Text style={row.label}>{label}</Text>
      <View style={row.right}>{children}</View>
    </View>
  );
}

const row = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: { fontSize: 15, color: colors.textPrimary, flex: 1 },
  right: { alignItems: 'flex-end' },
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sec.container}>
      <Text style={sec.title}>{title}</Text>
      <View style={sec.card}>{children}</View>
    </View>
  );
}

const sec = StyleSheet.create({
  container: { marginHorizontal: 16, marginBottom: 20 },
  title: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, bets } = useBetsStore();
  const [newBookmaker, setNewBookmaker] = useState('');

  function handleClearData() {
    Alert.alert(
      'Очистить все данные?',
      'Все ставки, банкролл и настройки будут удалены. Это действие нельзя отменить.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Очистить',
          style: 'destructive',
          onPress: () => {
            updateSettings({ bookmakers: ['1xBet', 'Parimatch', 'Fonbet'] });
          },
        },
      ],
    );
  }

  function handleAddBookmaker() {
    const trimmed = newBookmaker.trim();
    if (!trimmed) return;
    if (settings.bookmakers.includes(trimmed)) {
      Alert.alert('Уже есть', `${trimmed} уже в списке`);
      return;
    }
    updateSettings({ bookmakers: [...settings.bookmakers, trimmed] });
    setNewBookmaker('');
  }

  function handleRemoveBookmaker(bk: string) {
    updateSettings({ bookmakers: settings.bookmakers.filter((b) => b !== bk) });
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Настройки</Text>
        {!settings.isPro && (
          <TouchableOpacity
            style={styles.proBtn}
            onPress={() => updateSettings({ isPro: true })}
          >
            <Text style={styles.proBtnText}>👑 Попробовать Pro</Text>
          </TouchableOpacity>
        )}
        {settings.isPro && (
          <View style={styles.proBadge}>
            <Text style={styles.proBadgeText}>👑 PRO</Text>
          </View>
        )}
      </View>

      <Section title="Тилт-контроль">
        <Row label="Порог тилт-алерта">
          <Text style={styles.value}>
            {settings.isPro ? `${settings.tiltThreshold} поражений` : `${FREE_LIMITS.TILT_ALERT_THRESHOLD} (Free)`}
          </Text>
        </Row>
        {settings.isPro && (
          <Row label="Дневной лимит ставок">
            <Text style={styles.value}>
              {settings.dailyBetLimit === 0 ? 'Без лимита' : `${settings.dailyBetLimit} ставок`}
            </Text>
          </Row>
        )}
      </Section>

      <Section title="Букмекеры">
        {settings.bookmakers.map((bk) => (
          <Row key={bk} label={bk}>
            <TouchableOpacity onPress={() => handleRemoveBookmaker(bk)}>
              <Text style={styles.removeText}>Удалить</Text>
            </TouchableOpacity>
          </Row>
        ))}
        <View style={styles.addBkRow}>
          <TextInput
            style={styles.addBkInput}
            placeholder="Добавить букмекера..."
            placeholderTextColor={colors.textMuted}
            value={newBookmaker}
            onChangeText={setNewBookmaker}
            onSubmitEditing={handleAddBookmaker}
          />
          <TouchableOpacity style={styles.addBkBtn} onPress={handleAddBookmaker}>
            <Text style={styles.addBkBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </Section>

      <Section title="Данные">
        <Row label="Всего ставок">
          <Text style={styles.value}>{bets.length}</Text>
        </Row>
        <Row label="Статус подписки">
          <Text style={[styles.value, { color: settings.isPro ? colors.gold : colors.textSecondary }]}>
            {settings.isPro ? 'Pro' : `Free (${Math.max(0, 50 - bets.length)} ставок осталось)`}
          </Text>
        </Row>
      </Section>

      <Section title="Опасная зона">
        <TouchableOpacity style={styles.dangerBtn} onPress={handleClearData}>
          <Text style={styles.dangerBtnText}>Очистить все данные</Text>
        </TouchableOpacity>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  proBtn: {
    backgroundColor: colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  proBtnText: { fontSize: 13, fontWeight: '700', color: '#000' },
  proBadge: {
    backgroundColor: colors.gold + '22',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.gold + '66',
  },
  proBadgeText: { fontSize: 13, fontWeight: '700', color: colors.gold },
  value: { fontSize: 14, color: colors.textSecondary },
  removeText: { fontSize: 13, color: colors.lost },
  addBkRow: { flexDirection: 'row', gap: 8, paddingVertical: 12 },
  addBkInput: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addBkBtn: {
    backgroundColor: colors.accent,
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBkBtnText: { fontSize: 22, color: '#000', fontWeight: '700', lineHeight: 26 },
  dangerBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  dangerBtnText: { fontSize: 15, color: colors.lost, fontWeight: '600' },
});
