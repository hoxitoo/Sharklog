import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';
import { calcDashboard, isInTilt } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors } from '../../theme/colors';
import type { DiaryEntry } from '@sharklog/core';

const MOODS: Array<{ value: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }> = [
  { value: 1, emoji: '😫', label: 'Тилт' },
  { value: 2, emoji: '😟', label: 'Плохо' },
  { value: 3, emoji: '😐', label: 'Норм' },
  { value: 4, emoji: '😊', label: 'Хорошо' },
  { value: 5, emoji: '😄', label: 'Отлично' },
];

const RULES = [
  'Никогда не ставь в состоянии тилта',
  'Следуй стратегии — не импровизируй',
  'Ставь только то, что готов потерять',
  'Веди дневник каждой ставки',
  'Анализируй ошибки, а не только победы',
  'Не гонись за убытками',
  'Устанавливай дневные лимиты',
  'Дисциплина важнее интуиции',
];

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0] ?? '';
}

function MoodPicker({
  selected,
  onSelect,
}: {
  selected: 1 | 2 | 3 | 4 | 5 | null;
  onSelect: (v: 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <View style={mp.row}>
      {MOODS.map((m) => (
        <TouchableOpacity
          key={m.value}
          style={[mp.btn, selected === m.value && mp.btnActive]}
          onPress={() => onSelect(m.value)}
          activeOpacity={0.7}
        >
          <Text style={mp.emoji}>{m.emoji}</Text>
          <Text style={[mp.label, selected === m.value && mp.labelActive]}>{m.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const mp = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  btn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnActive: {
    borderColor: colors.purple,
    backgroundColor: colors.purpleDim,
  },
  emoji: { fontSize: 22 },
  label: { fontSize: 9, color: colors.textMuted, marginTop: 3, textAlign: 'center' },
  labelActive: { color: colors.purple },
});

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={card.container}>
      <Text style={card.title}>{title}</Text>
      {children}
    </View>
  );
}

const card = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 14 },
});

export function DisciplineScreen() {
  const { bets, diary, settings, addDiaryEntry } = useBetsStore();
  const stats = calcDashboard(bets);
  const inTilt = isInTilt(bets, settings.tiltThreshold);

  const today = todayStr();
  const todayEntry = diary.find((d) => d.date === today);

  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5 | null>(todayEntry?.mood ?? null);
  const [note, setNote] = useState(todayEntry?.text ?? '');
  const [saved, setSaved] = useState(!!todayEntry);

  function handleSave() {
    if (!mood) {
      Alert.alert('Выбери настроение', 'Отметь, как себя чувствуешь сегодня');
      return;
    }
    const entryBase = { id: todayEntry?.id ?? uuid(), date: today, mood };
    const entry: DiaryEntry = note.trim() ? { ...entryBase, text: note.trim() } : entryBase;
    addDiaryEntry(entry);
    setSaved(true);
  }

  const todayBets = bets.filter((b) => b.date === today);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStr = weekAgo.toISOString().split('T')[0] ?? '';
  const weekLosses = bets.filter((b) => b.date >= weekStr && b.status === 'lost').length;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Дисциплина" subtitle="Психология и контроль" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {inTilt && (
          <View style={styles.tiltBanner}>
            <Text style={styles.tiltEmoji}>🔥</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.tiltTitle}>Стоп. Ты в тилте.</Text>
              <Text style={styles.tiltSub}>
                {stats.currentStreak.count} поражений подряд. Закрой приложение и отдохни.
              </Text>
            </View>
          </View>
        )}

        <Card title="Мой день">
          <MoodPicker
            selected={saved ? (todayEntry?.mood ?? mood) : mood}
            onSelect={(v) => { setMood(v); setSaved(false); }}
          />
          <TextInput
            style={styles.noteInput}
            placeholder="Заметка на день (мысли, причины ставок)..."
            placeholderTextColor={colors.textMuted}
            value={note}
            onChangeText={(t) => { setNote(t); setSaved(false); }}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          {saved ? (
            <View style={styles.savedRow}>
              <Text style={styles.savedText}>✓ Сохранено</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Сохранить запись</Text>
            </TouchableOpacity>
          )}
        </Card>

        <Card title="Статистика тилта">
          <View style={styles.tiltGrid}>
            <View style={styles.tiltStat}>
              <Text style={styles.tiltStatValue}>{stats.currentStreak.type === 'loss' ? stats.currentStreak.count : 0}</Text>
              <Text style={styles.tiltStatLabel}>Серия поражений</Text>
            </View>
            <View style={styles.tiltStat}>
              <Text style={styles.tiltStatValue}>{todayBets.length}</Text>
              <Text style={styles.tiltStatLabel}>Ставок сегодня</Text>
            </View>
            <View style={styles.tiltStat}>
              <Text style={[styles.tiltStatValue, { color: weekLosses > 5 ? colors.lost : colors.textPrimary }]}>
                {weekLosses}
              </Text>
              <Text style={styles.tiltStatLabel}>Поражений за неделю</Text>
            </View>
          </View>
        </Card>

        <Card title="8 правил профи">
          {RULES.map((rule, i) => (
            <View key={i} style={styles.ruleRow}>
              <View style={styles.ruleNum}>
                <Text style={styles.ruleNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.ruleText}>{rule}</Text>
            </View>
          ))}
        </Card>

        {diary.length > 0 && (
          <Card title="Дневник">
            {diary.slice(0, 10).map((entry) => {
              const moodObj = MOODS.find((m) => m.value === entry.mood);
              return (
                <View key={entry.id} style={styles.diaryRow}>
                  <Text style={styles.diaryEmoji}>{moodObj?.emoji ?? '😐'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.diaryDate}>{entry.date}</Text>
                    {entry.text ? (
                      <Text style={styles.diaryText} numberOfLines={2}>{entry.text}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </Card>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tiltBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 14,
    backgroundColor: colors.lost + '15',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lost + '44',
  },
  tiltEmoji: { fontSize: 28 },
  tiltTitle: { fontSize: 15, fontWeight: '700', color: colors.lost },
  tiltSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  noteInput: {
    marginTop: 12,
    backgroundColor: colors.bgElevated,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
    height: 80,
  },
  saveBtn: {
    marginTop: 12,
    backgroundColor: colors.purple,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  savedRow: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.accent + '15',
    borderWidth: 1,
    borderColor: colors.accent + '44',
  },
  savedText: { fontSize: 14, fontWeight: '600', color: colors.accent },
  tiltGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  tiltStat: { alignItems: 'center', gap: 4 },
  tiltStatValue: { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
  tiltStatLabel: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  ruleNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.purpleDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.purple + '44',
    flexShrink: 0,
  },
  ruleNumText: { fontSize: 12, fontWeight: '700', color: colors.purple },
  ruleText: { fontSize: 14, color: colors.textPrimary, flex: 1, lineHeight: 20 },
  diaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  diaryEmoji: { fontSize: 22, marginTop: 1 },
  diaryDate: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  diaryText: { fontSize: 13, color: colors.textSecondary },
});
