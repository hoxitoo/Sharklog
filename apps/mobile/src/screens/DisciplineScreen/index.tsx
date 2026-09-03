import React, { useState } from 'react';
import { SPACE, RADIUS, TOUCH } from '../../theme/layout';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../../components/AppText';
import { calcDashboard, isInTilt, toYmd } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors } from '../../theme/colors';
import { haptic } from '../../utils/haptics';
import type { DiaryEntry } from '@sharklog/core';
import { SIZE, GLYPH } from '../../theme/typography';

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
  const c = (globalThis as any).crypto;
  if (c && typeof c.getRandomValues === 'function') {
    const buf = new Uint8Array(16);
    c.getRandomValues(buf);
    buf[6] = (buf[6]! & 0x0f) | 0x40;
    buf[8] = (buf[8]! & 0x3f) | 0x80;
    let s = '';
    for (let i = 0; i < 16; i++) {
      if (i === 4 || i === 6 || i === 8 || i === 10) s += '-';
      s += buf[i]!.toString(16).padStart(2, '0');
    }
    return s;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function todayStr(): string {
  return toYmd(new Date());
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
          onPress={() => { haptic.selection(); onSelect(m.value); }}
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
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.xs },
  btn: {
    minHeight: TOUCH, justifyContent: 'center',
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnActive: {
    borderColor: colors.purple,
    backgroundColor: colors.purpleDim,
  },
  emoji: { fontSize: GLYPH.lg },
  label: { fontSize: SIZE.micro, color: colors.textMuted, marginTop: 3, textAlign: 'center' },
  labelActive: { color: colors.purpleText },
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
    borderRadius: RADIUS.md,
    padding: SPACE.lg,
    marginHorizontal: SPACE.lg,
    marginBottom: SPACE.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: SIZE.lead, fontWeight: '700', color: colors.textPrimary, marginBottom: SPACE.md },
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
    haptic.success();
    setSaved(true);
  }

  const todayBets = bets.filter((b) => b.date === today);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStr = toYmd(weekAgo);
  const weekLosses = bets.filter((b) => b.date >= weekStr && b.status === 'lost').length;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Дисциплина" subtitle="Психология и контроль" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACE.xxl }}>

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
              <Text style={[
                styles.tiltStatValue,
                settings.isPro && settings.dailyBetLimit > 0 && todayBets.length >= settings.dailyBetLimit
                  ? { color: colors.lost }
                  : settings.isPro && settings.dailyBetLimit > 0 && todayBets.length >= Math.ceil(settings.dailyBetLimit * 0.8)
                  ? { color: colors.pending }
                  : {},
              ]}>
                {todayBets.length}{settings.isPro && settings.dailyBetLimit > 0 ? `/${settings.dailyBetLimit}` : ''}
              </Text>
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
    gap: SPACE.md,
    marginHorizontal: SPACE.lg,
    marginBottom: SPACE.md,
    padding: SPACE.md,
    backgroundColor: colors.lost + '15',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.lost + '44',
  },
  tiltEmoji: { fontSize: GLYPH.xl },
  tiltTitle: { fontSize: SIZE.lead, fontWeight: '700', color: colors.lost },
  tiltSub: { fontSize: SIZE.caption, color: colors.textSecondary, marginTop: 2 },
  noteInput: {
    marginTop: SPACE.md,
    backgroundColor: colors.bgElevated,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    color: colors.textPrimary,
    fontSize: SIZE.body,
    borderWidth: 1,
    borderColor: colors.border,
    height: 80,
  },
  saveBtn: {
    minHeight: TOUCH, justifyContent: 'center',
    marginTop: SPACE.md,
    backgroundColor: colors.purple,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACE.md,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: SIZE.body, fontWeight: '700', color: '#fff' },
  savedRow: {
    marginTop: SPACE.md,
    alignItems: 'center',
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: colors.accent + '15',
    borderWidth: 1,
    borderColor: colors.accent + '44',
  },
  savedText: { fontSize: SIZE.body, fontWeight: '600', color: colors.accent },
  // Equal cells with a gap: at content width the three labels ran together into
  // "Серия пораженийСтавок сегодняПоражений за неделю". With flex they wrap
  // inside their own column instead, which also survives longer translations.
  tiltGrid: { flexDirection: 'row', gap: SPACE.sm },
  tiltStat: { flex: 1, alignItems: 'center', gap: SPACE.xs },
  tiltStatValue: { fontSize: SIZE.hero, fontWeight: '700', color: colors.textPrimary },
  tiltStatLabel: { fontSize: SIZE.caption, color: colors.textMuted, textAlign: 'center' },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE.md,
    marginBottom: SPACE.md,
  },
  ruleNum: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.md,
    backgroundColor: colors.purpleDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.purple + '44',
    flexShrink: 0,
  },
  ruleNumText: { fontSize: SIZE.caption, fontWeight: '700', color: colors.purpleText },
  ruleText: { fontSize: SIZE.body, color: colors.textPrimary, flex: 1, lineHeight: 20 },
  diaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE.sm,
    paddingVertical: SPACE.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  diaryEmoji: { fontSize: GLYPH.lg, marginTop: 1 },
  diaryDate: { fontSize: SIZE.caption, color: colors.textMuted, marginBottom: 2 },
  diaryText: { fontSize: SIZE.body, color: colors.textSecondary },
});
