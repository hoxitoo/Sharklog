import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { STRATEGY_QUESTIONS, buildStrategy, STRATEGIES, BET_TYPES } from '@sharklog/core';
import type { StrategyAnswers, GeneratedStrategy } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { colors } from '../../theme/colors';
import { ProGate } from '../../components/ProGate';
import { haptic } from '../../utils/haptics';

const DISCLAIMER =
  'Данная стратегия носит рекомендательный характер и не гарантирует прибыли. ' +
  'Ставки сопряжены с риском потери денег. Играйте ответственно.';

function ResultScreen({ strategy, onReset }: { strategy: GeneratedStrategy; onReset: () => void }) {
  const { updateSettings } = useBetsStore();

  const items = [
    { icon: '📅', label: 'Ставок в день',          value: `≤ ${strategy.betsPerDay}` },
    { icon: '💰', label: 'Размер ставки',           value: `${strategy.stakePercent}% от банкролла` },
    { icon: '📈', label: 'Коэффициенты',            value: `${strategy.oddsMin.toFixed(2)} – ${strategy.oddsMax.toFixed(2)}` },
    { icon: '🎯', label: 'Тип ставок',              value: strategy.betTypeAdvice },
    { icon: '⚽', label: 'Спорт',                   value: strategy.sportAdvice },
    { icon: '⚡', label: 'Тилт-стоп',              value: `${strategy.tiltThreshold} пораж. подряд` },
    { icon: '📊', label: 'Метод Kelly',             value: `× ${strategy.kellyMultiplier}` },
  ];

  function handleSave() {
    haptic.success();
    updateSettings({ generatedStrategy: strategy });
    Alert.alert('Готово', 'Стратегия применена и отображается на дашборде');
  }

  return (
    <ScrollView contentContainerStyle={s.scroll}>
      <View style={s.badge}>
        <Text style={s.badgeText}>🎯 Стратегия готова</Text>
      </View>
      <Text style={s.resultName}>{strategy.name}</Text>
      <Text style={s.resultDesc}>{strategy.description}</Text>

      {strategy.rationale ? (
        <View style={s.rationaleBox}>
          <Text style={s.sectionTitle}>Почему эта стратегия подходит тебе</Text>
          <Text style={s.rationaleText}>{strategy.rationale}</Text>
        </View>
      ) : null}

      {items.map((item) => (
        <View key={item.label} style={s.recItem}>
          <Text style={s.recIcon}>{item.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.recLabel}>{item.label}</Text>
            <Text style={s.recValue}>{item.value}</Text>
          </View>
        </View>
      ))}

      {strategy.recommendedBetTypes && strategy.recommendedBetTypes.length > 0 ? (
        <View style={s.sectionBox}>
          <Text style={s.sectionTitle}>Рекомендуемые рынки</Text>
          <View style={s.chipRow}>
            {strategy.recommendedBetTypes.map((bt) => (
              <View key={bt} style={[s.chip, s.chipGreen]}>
                <Text style={s.chipTextGreen}>{BET_TYPES[bt]}</Text>
              </View>
            ))}
          </View>
          {strategy.betTypeRationale ? (
            <Text style={s.subNote}>{strategy.betTypeRationale}</Text>
          ) : null}
        </View>
      ) : null}

      {strategy.recommendedApproaches && strategy.recommendedApproaches.length > 0 ? (
        <View style={s.sectionBox}>
          <Text style={s.sectionTitle}>Подходы к анализу</Text>
          <View style={s.chipRow}>
            {strategy.recommendedApproaches.map((app) => (
              <View key={app} style={s.chip}>
                <Text style={s.chipText}>{STRATEGIES[app]}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {strategy.oddsRationale ? (
        <View style={s.sectionBox}>
          <Text style={s.sectionTitle}>О диапазоне коэффициентов</Text>
          <Text style={s.rationaleText}>{strategy.oddsRationale}</Text>
        </View>
      ) : null}

      {strategy.keyPrinciples && strategy.keyPrinciples.length > 0 ? (
        <View style={s.sectionBox}>
          <Text style={s.sectionTitle}>Ключевые принципы</Text>
          {strategy.keyPrinciples.map((rule, i) => (
            <View key={i} style={s.principleRow}>
              <Text style={s.principleNum}>{i + 1}</Text>
              <Text style={s.principleText}>{rule}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={s.disclaimerBox}>
        <Text style={s.disclaimerText}>{DISCLAIMER}</Text>
      </View>

      <TouchableOpacity style={s.btnPrimary} onPress={handleSave} activeOpacity={0.8}>
        <Text style={s.btnPrimaryText}>Применить стратегию</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.btnSecondary} onPress={onReset} activeOpacity={0.8}>
        <Text style={s.btnSecondaryText}>Пересоздать</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function WizardScreen({ onDone }: { onDone: (strategy: GeneratedStrategy) => void }) {
  const total = STRATEGY_QUESTIONS.length;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<StrategyAnswers>>({});

  const q = STRATEGY_QUESTIONS[step];
  if (!q) return null;

  function handleAnswer(value: string) {
    haptic.selection();
    const next = { ...answers, [q!.key]: value } as Partial<StrategyAnswers>;
    setAnswers(next);
    if (step < total - 1) {
      setStep(step + 1);
    } else {
      onDone(buildStrategy(next as StrategyAnswers));
    }
  }

  const progress = step / total;

  return (
    <ScrollView contentContainerStyle={s.scroll}>
      {/* Progress */}
      <View style={s.progressWrap}>
        <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
      </View>
      <Text style={s.progressLabel}>Вопрос {step + 1} из {total}</Text>

      {/* Question */}
      <View style={s.qCard}>
        <Text style={s.qText}>{q.text}</Text>
        {q.options.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={s.optionBtn}
            onPress={() => handleAnswer(opt.value)}
            activeOpacity={0.75}
          >
            <Text style={s.optionLabel}>{opt.label}</Text>
            {opt.desc ? <Text style={s.optionDesc}>{opt.desc}</Text> : null}
          </TouchableOpacity>
        ))}
      </View>

      {step > 0 && (
        <TouchableOpacity style={s.backBtn} onPress={() => { haptic.selection(); setStep(step - 1); }}>
          <Text style={s.backText}>← Назад</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

export function StrategyBuilderScreen() {
  const { settings, updateSettings } = useBetsStore();
  const [result, setResult] = useState<GeneratedStrategy | null>(settings.generatedStrategy ?? null);
  const [building, setBuilding] = useState(!settings.generatedStrategy);

  function handleReset() {
    setResult(null);
    setBuilding(true);
    updateSettings({ generatedStrategy: undefined as any });
  }

  function handleDone(strategy: GeneratedStrategy) {
    setResult(strategy);
    setBuilding(false);
  }

  return (
    <View style={s.root}>
      <ProGate feature="Персональный билдер стратегий">
        {!building && result
          ? <ResultScreen strategy={result} onReset={handleReset} />
          : <WizardScreen onDone={handleDone} />
        }
      </ProGate>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 40 },
  progressWrap: {
    height: 5, backgroundColor: colors.bgElevated,
    borderRadius: 3, overflow: 'hidden', marginBottom: 6,
  },
  progressFill: { height: '100%', backgroundColor: colors.purple, borderRadius: 3 },
  progressLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 20 },
  qCard: {
    backgroundColor: colors.bgCard, borderRadius: 14, padding: 20,
    borderWidth: 1, borderColor: colors.border, marginBottom: 16,
  },
  qText: {
    fontSize: 18, fontWeight: '700', color: colors.textPrimary,
    marginBottom: 20, lineHeight: 26,
  },
  optionBtn: {
    backgroundColor: colors.bgElevated, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  optionLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  optionDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 8 },
  backText: { fontSize: 13, color: colors.textSecondary },
  // Result
  badge: {
    alignSelf: 'flex-start', backgroundColor: colors.purple + '22',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: colors.purple + '44', marginBottom: 14,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: colors.purple },
  resultName: {
    fontSize: 24, fontWeight: '700', color: colors.textPrimary,
    letterSpacing: -0.5, marginBottom: 8,
  },
  resultDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: 20 },
  recItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.bgCard, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  recIcon: { fontSize: 22, width: 28, textAlign: 'center' },
  recLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  recValue: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginTop: 2 },
  disclaimerBox: {
    backgroundColor: colors.bgCard, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginVertical: 16,
  },
  disclaimerText: { fontSize: 11, color: colors.textMuted, lineHeight: 18 },
  btnPrimary: {
    backgroundColor: colors.purple, borderRadius: 12, padding: 14,
    alignItems: 'center', marginBottom: 10,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnSecondary: {
    borderRadius: 12, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  btnSecondaryText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
  rationaleBox: {
    backgroundColor: colors.bgCard, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  sectionBox: {
    backgroundColor: colors.bgCard, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11, color: colors.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 10, fontWeight: '700',
  },
  rationaleText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  subNote: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: colors.purple + '22', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.purple + '44',
  },
  chipGreen: {
    backgroundColor: colors.accent + '22',
    borderColor: colors.accent + '44',
  },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.purple },
  chipTextGreen: { fontSize: 12, fontWeight: '600', color: colors.accent },
  principleRow: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8,
  },
  principleNum: {
    fontSize: 13, fontWeight: '700', color: colors.purple,
    width: 18, textAlign: 'center', marginTop: 1,
  },
  principleText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
});
