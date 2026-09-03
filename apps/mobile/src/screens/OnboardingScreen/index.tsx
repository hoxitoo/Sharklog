import React, { useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, StatusBar, Image,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../../components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_BOOKMAKERS, parseMoneyInput, formatMoney } from '@sharklog/core';

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
import { useBetsStore } from '../../store/betsStore';
import { colors } from '../../theme/colors';
import { SIZE, GLYPH } from '../../theme/typography';

const STEPS = 3;

const FEATURES = [
  { emoji: '📋', label: 'Учёт ставок', desc: 'История, фильтры, поиск' },
  { emoji: '📊', label: 'Аналитика', desc: '7 срезов статистики' },
  { emoji: '💰', label: 'Банкролл', desc: 'Kelly, юниты, P&L' },
  { emoji: '🧘', label: 'Дисциплина', desc: 'Анти-тилт система' },
];

export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { updateSettings, updateBankroll, bankroll } = useBetsStore();

  const [step, setStep] = useState(0);
  const [depositInput, setDepositInput] = useState('');
  const [selectedBookmakers, setSelectedBookmakers] = useState<string[]>(['1xBet', 'Parimatch', 'Fonbet']);
  const [customBk, setCustomBk] = useState('');

  function toggleBookmaker(bk: string) {
    setSelectedBookmakers((prev) =>
      prev.includes(bk) ? prev.filter((b) => b !== bk) : [...prev, bk],
    );
  }

  function addCustomBookmaker() {
    const trimmed = customBk.trim();
    if (!trimmed || selectedBookmakers.includes(trimmed)) return;
    setSelectedBookmakers((prev) => [...prev, trimmed]);
    setCustomBk('');
  }

  function handleFinish() {
    const bkList = selectedBookmakers.length > 0 ? selectedBookmakers : ['1xBet', 'Parimatch', 'Fonbet'];
    updateSettings({ bookmakers: bkList, onboardingComplete: true });

    const amount = parseMoneyInput(depositInput);
    if (amount > 0) {
      updateBankroll({
        transactions: [
          ...bankroll.transactions,
          {
            id: uuid(),
            type: 'deposit',
            amount,
            date: new Date().toISOString(),
            note: 'Начальный депозит',
          },
        ],
      });
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" />

      {/* Progress dots */}
      <View style={styles.dots}>
        {Array.from({ length: STEPS }).map((_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>

      {/* Step 0: Welcome */}
      {step === 0 && (
        <ScrollView contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
          <Image source={require('../../../assets/adaptive-icon.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.tagline}>Профессиональный трекер ставок</Text>

          <View style={styles.features}>
            {FEATURES.map((f) => (
              <View key={f.label} style={styles.featureRow}>
                <Text style={styles.featureEmoji}>{f.emoji}</Text>
                <View>
                  <Text style={styles.featureLabel}>{f.label}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.freeBadge}>
            <Text style={styles.freeBadgeText}>🎁 7 дней PRO бесплатно при регистрации</Text>
          </View>
        </ScrollView>
      )}

      {/* Step 1: Initial bankroll */}
      {step === 1 && (
        <View style={styles.stepContent}>
          <Text style={styles.stepEmoji}>💰</Text>
          <Text style={styles.stepTitle}>Начальный банкролл</Text>
          <Text style={styles.stepSubtitle}>
            Сколько ты готов выделить для ставок? Это поможет отслеживать P&L с первого дня.
          </Text>

          <TextInput
            style={styles.bankInput}
            placeholder="10 000 ₽"
            placeholderTextColor={colors.textMuted}
            value={depositInput}
            onChangeText={setDepositInput}
            keyboardType="numeric"
            autoFocus
          />

          {parseMoneyInput(depositInput) > 0 && (
            <Text style={styles.bankPreview}>
              Стартовый банк: {formatMoney(parseMoneyInput(depositInput))}
            </Text>
          )}

          <Text style={styles.skipHint}>
            Можешь пропустить — банк настраивается в разделе «Банкролл»
          </Text>
        </View>
      )}

      {/* Step 2: Bookmakers */}
      {step === 2 && (
        <ScrollView contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepEmoji}>🎰</Text>
          <Text style={styles.stepTitle}>Твои букмекеры</Text>
          <Text style={styles.stepSubtitle}>
            Выбери букмекеров, которыми пользуешься. Можно изменить позже.
          </Text>

          <View style={styles.bkGrid}>
            {DEFAULT_BOOKMAKERS.map((bk) => {
              const active = selectedBookmakers.includes(bk);
              return (
                <TouchableOpacity
                  key={bk}
                  style={[styles.bkChip, active && styles.bkChipActive]}
                  onPress={() => toggleBookmaker(bk)}
                >
                  <Text style={[styles.bkChipText, active && styles.bkChipTextActive]}>{bk}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              placeholder="Другой букмекер..."
              placeholderTextColor={colors.textMuted}
              value={customBk}
              onChangeText={setCustomBk}
              onSubmitEditing={addCustomBookmaker}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addBtn} onPress={addCustomBookmaker}>
              <Text style={styles.addBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {selectedBookmakers.filter((b) => !DEFAULT_BOOKMAKERS.includes(b)).map((bk) => (
            <TouchableOpacity
              key={bk}
              style={[styles.bkChip, styles.bkChipActive]}
              onPress={() => toggleBookmaker(bk)}
            >
              <Text style={[styles.bkChipText, styles.bkChipTextActive]}>{bk} ✕</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Navigation buttons */}
      <View style={[styles.nav, { paddingBottom: insets.bottom + 16 }]}>
        {step < STEPS - 1 ? (
          <>
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={() => setStep((s) => s + 1)}
              activeOpacity={0.85}
            >
              <Text style={styles.nextBtnText}>Далее →</Text>
            </TouchableOpacity>
            {step === 1 && (
              <TouchableOpacity onPress={() => setStep((s) => s + 1)}>
                <Text style={styles.skipText}>Пропустить</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={handleFinish}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>Начать работу 🦈</Text>
          </TouchableOpacity>
        )}

        {step > 0 && (
          <TouchableOpacity onPress={() => setStep((s) => s - 1)}>
            <Text style={styles.backText}>← Назад</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 12, paddingBottom: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { width: 20, backgroundColor: colors.purple },
  stepContent: { flex: 1, paddingHorizontal: 28, paddingTop: 24, paddingBottom: 16 },
  logo: { width: 180, height: 180, alignSelf: 'center', marginBottom: 8 },
  tagline: { fontSize: SIZE.lead, color: colors.textSecondary, textAlign: 'center', marginBottom: 36, marginTop: 6 },
  features: { gap: 16, marginBottom: 28 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  featureEmoji: { fontSize: GLYPH.xl, width: 40, textAlign: 'center' },
  featureLabel: { fontSize: SIZE.lead, fontWeight: '600', color: colors.textPrimary },
  featureDesc: { fontSize: SIZE.body, color: colors.textSecondary, marginTop: 1 },
  freeBadge: {
    backgroundColor: colors.gold + '18',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.gold + '44',
  },
  freeBadgeText: { fontSize: SIZE.body, color: colors.gold, textAlign: 'center', fontWeight: '600' },
  stepEmoji: { fontSize: GLYPH.hero, textAlign: 'center', marginBottom: 16 },
  stepTitle: { fontSize: SIZE.hero, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 10 },
  stepSubtitle: { fontSize: SIZE.lead, color: colors.textSecondary, textAlign: 'center', marginBottom: 28, lineHeight: 23 },
  bankInput: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: colors.textPrimary,
    fontSize: SIZE.hero,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors.purple + '66',
    textAlign: 'center',
    marginBottom: 12,
  },
  bankPreview: { fontSize: SIZE.body, color: colors.accent, textAlign: 'center', marginBottom: 16, fontWeight: '600' },
  skipHint: { fontSize: SIZE.caption, color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  bkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  bkChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
  },
  bkChipActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  bkChipText: { fontSize: SIZE.body, color: colors.textSecondary },
  bkChipTextActive: { color: '#fff', fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  addInput: {
    flex: 1, backgroundColor: colors.bgCard,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    color: colors.textPrimary, fontSize: SIZE.body,
    borderWidth: 1, borderColor: colors.border,
  },
  addBtn: {
    backgroundColor: colors.purple, width: 42, height: 42,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { fontSize: SIZE.hero, color: '#fff', fontWeight: '700', lineHeight: 30 },
  nav: { paddingHorizontal: 28, gap: 10 },
  nextBtn: {
    backgroundColor: colors.purple, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  nextBtnText: { fontSize: SIZE.lead, fontWeight: '700', color: '#fff' },
  skipText: { fontSize: SIZE.body, color: colors.textMuted, textAlign: 'center', paddingVertical: 4 },
  backText: { fontSize: SIZE.body, color: colors.textMuted, textAlign: 'center', paddingVertical: 4 },
});
