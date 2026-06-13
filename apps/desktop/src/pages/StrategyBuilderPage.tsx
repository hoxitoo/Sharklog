import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  STRATEGY_QUESTIONS, buildStrategy, formatMoney, STRATEGIES, BET_TYPES,
} from '@sharklog/core';
import type { StrategyAnswers, GeneratedStrategy } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';
import { colors } from '../theme/colors';

const DISCLAIMER =
  'Данная стратегия носит рекомендательный характер и не гарантирует прибыли. ' +
  'Ставки сопряжены с риском потери денег. Играйте ответственно.';

// ── Result card ─────────────────────────────────────────────────────────────

function ResultCard({ strategy, onReset }: { strategy: GeneratedStrategy; onReset: () => void }) {
  const { updateSettings } = useBetsStore();

  function handleSave() {
    updateSettings({ generatedStrategy: strategy });
  }

  const items: Array<{ icon: string; label: string; value: string }> = [
    { icon: '📅', label: 'Ставок в день', value: `≤ ${strategy.betsPerDay}` },
    { icon: '💰', label: 'Размер ставки', value: `${strategy.stakePercent}% от банкролла` },
    { icon: '📈', label: 'Коэффициенты', value: `${strategy.oddsMin.toFixed(2)} – ${strategy.oddsMax.toFixed(2)}` },
    { icon: '🎯', label: 'Тип ставок', value: strategy.betTypeAdvice },
    { icon: '⚽', label: 'Спорт', value: strategy.sportAdvice },
    { icon: '⚡', label: 'Тилт-алерт', value: `${strategy.tiltThreshold} поражения подряд — стоп` },
    { icon: '📊', label: 'Метод расчёта ставки', value: `Kelly × ${strategy.kellyMultiplier}` },
  ];

  return (
    <div style={s.result}>
      <div style={s.resultBadge}>🎯 Стратегия готова</div>
      <h2 style={s.resultName}>{strategy.name}</h2>
      <p style={s.resultDesc}>{strategy.description}</p>

      {strategy.rationale && (
        <div style={s.sectionBox}>
          <div style={s.sectionLabel}>Почему эта стратегия подходит тебе</div>
          <div style={s.sectionText}>{strategy.rationale}</div>
        </div>
      )}

      <div style={s.recGrid}>
        {items.map((item) => (
          <div key={item.label} style={s.recItem}>
            <span style={s.recIcon}>{item.icon}</span>
            <div>
              <div style={s.recLabel}>{item.label}</div>
              <div style={s.recValue}>{item.value}</div>
            </div>
          </div>
        ))}
      </div>

      {strategy.recommendedBetTypes && strategy.recommendedBetTypes.length > 0 && (
        <div style={s.sectionBox}>
          <div style={s.sectionLabel}>Рекомендуемые рынки</div>
          <div style={s.chipRow}>
            {strategy.recommendedBetTypes.map((bt) => (
              <span key={bt} style={{ ...s.chip, ...s.chipGreen }}>{BET_TYPES[bt]}</span>
            ))}
          </div>
          {strategy.betTypeRationale && (
            <div style={s.subNote}>{strategy.betTypeRationale}</div>
          )}
        </div>
      )}

      {strategy.recommendedApproaches && strategy.recommendedApproaches.length > 0 && (
        <div style={s.sectionBox}>
          <div style={s.sectionLabel}>Подходы к анализу</div>
          <div style={s.chipRow}>
            {strategy.recommendedApproaches.map((app) => (
              <span key={app} style={s.chip}>{STRATEGIES[app]}</span>
            ))}
          </div>
        </div>
      )}

      {strategy.oddsRationale && (
        <div style={s.sectionBox}>
          <div style={s.sectionLabel}>О диапазоне коэффициентов</div>
          <div style={s.sectionText}>{strategy.oddsRationale}</div>
        </div>
      )}

      {strategy.keyPrinciples && strategy.keyPrinciples.length > 0 && (
        <div style={s.sectionBox}>
          <div style={s.sectionLabel}>Ключевые принципы</div>
          <ol style={s.principlesList}>
            {strategy.keyPrinciples.map((rule, i) => (
              <li key={i} style={s.principleItem}>{rule}</li>
            ))}
          </ol>
        </div>
      )}

      <div style={s.disclaimer}>{DISCLAIMER}</div>

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button style={s.btnPrimary} onClick={handleSave}>
          Применить стратегию
        </button>
        <button style={s.btnSecondary} onClick={onReset}>
          Пересоздать
        </button>
      </div>
    </div>
  );
}

// ── Wizard ──────────────────────────────────────────────────────────────────

export function StrategyBuilderPage() {
  const { settings, updateSettings } = useBetsStore();
  const { i18n } = useTranslation();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<StrategyAnswers>>({});
  const [result, setResult] = useState<GeneratedStrategy | null>(
    settings.generatedStrategy ?? null,
  );
  const [building, setBuilding] = useState(!settings.generatedStrategy);

  const total = STRATEGY_QUESTIONS.length;
  const q = STRATEGY_QUESTIONS[step];

  function handleAnswer(value: string) {
    const next = { ...answers, [q!.key]: value } as Partial<StrategyAnswers>;
    setAnswers(next);
    if (step < total - 1) {
      setStep(step + 1);
    } else {
      const built = buildStrategy(next as StrategyAnswers, i18n.language);
      setResult(built);
      setBuilding(false);
    }
  }

  function handleReset() {
    setStep(0);
    setAnswers({});
    setResult(null);
    setBuilding(true);
    updateSettings({ ...({} as any), generatedStrategy: undefined });
  }

  if (!settings.isPro) {
    return (
      <div style={s.page}>
        <h1 style={s.title}>Билдер стратегий</h1>
        <div style={s.proGate}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👑</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: colors.gold, marginBottom: 8 }}>PRO</div>
          <div style={{ color: colors.textSecondary, marginBottom: 24 }}>
            Персональный билдер стратегий доступен в подписке SharkLog Pro
          </div>
          <button style={s.btnPrimary} onClick={() => updateSettings({ isPro: true })}>
            Попробовать Pro — 7 дней бесплатно
          </button>
        </div>
      </div>
    );
  }

  // Show saved strategy
  if (!building && result) {
    return (
      <div style={s.page}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={s.title}>Билдер стратегий</h1>
            <p style={s.subtitle}>Твоя персональная стратегия</p>
          </div>
        </div>
        <ResultCard strategy={result} onReset={handleReset} />
      </div>
    );
  }

  // Wizard
  if (!q) return null;
  const progress = ((step) / total) * 100;

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={s.title}>Билдер стратегий</h1>
        <p style={s.subtitle}>Ответь на {total} вопросов — получи персональную стратегию</p>
      </div>

      {/* Progress */}
      <div style={s.progressWrap}>
        <div style={{ ...s.progressFill, width: `${progress}%` }} />
      </div>
      <div style={s.progressLabel}>Вопрос {step + 1} из {total}</div>

      {/* Question card */}
      <div style={s.qCard}>
        <div style={s.qText}>{q.text}</div>
        <div style={s.optionList}>
          {q.options.map((opt) => (
            <button
              key={opt.value}
              style={s.optionBtn}
              className="sl-strategy-opt"
              onClick={() => handleAnswer(opt.value)}
            >
              <span style={s.optionLabel}>{opt.label}</span>
              {opt.desc && <span style={s.optionDesc}>{opt.desc}</span>}
            </button>
          ))}
        </div>
      </div>

      {step > 0 && (
        <button style={s.backBtn} onClick={() => setStep(step - 1)}>
          ← Назад
        </button>
      )}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', flex: 1, overflow: 'auto', maxWidth: 680 },
  title: { fontSize: 28, fontWeight: 700, color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.textSecondary },
  progressWrap: {
    height: 6, backgroundColor: colors.bgElevated, borderRadius: 3,
    overflow: 'hidden', marginBottom: 8,
  },
  progressFill: {
    height: '100%', backgroundColor: colors.purple, borderRadius: 3,
    transition: 'width 0.3s ease',
  },
  progressLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 24 },
  qCard: {
    backgroundColor: colors.bgCard, borderRadius: 16,
    border: `1px solid ${colors.border}`, padding: 28, marginBottom: 16,
  },
  qText: {
    fontSize: 20, fontWeight: 700, color: colors.textPrimary,
    marginBottom: 24, letterSpacing: -0.3, lineHeight: '1.4',
  },
  optionList: { display: 'flex', flexDirection: 'column', gap: 10 },
  optionBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    padding: '14px 18px', borderRadius: 12,
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.bgElevated,
    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
  },
  optionLabel: { fontSize: 15, fontWeight: 600, color: colors.textPrimary },
  optionDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  backBtn: {
    background: 'none', border: 'none', color: colors.textSecondary,
    fontSize: 13, cursor: 'pointer', padding: '4px 0',
  },
  // Result
  result: {
    backgroundColor: colors.bgCard, borderRadius: 16,
    border: `1px solid ${colors.border}`, padding: 28,
  },
  resultBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    backgroundColor: colors.purple + '22', color: colors.purple,
    border: `1px solid ${colors.purple}44`, borderRadius: 8,
    padding: '4px 12px', fontSize: 12, fontWeight: 700, marginBottom: 16,
  },
  resultName: {
    fontSize: 26, fontWeight: 700, color: colors.textPrimary,
    letterSpacing: -0.5, marginBottom: 8,
  },
  resultDesc: { fontSize: 14, color: colors.textSecondary, lineHeight: '1.6', marginBottom: 24 },
  recGrid: {
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  recItem: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '12px 16px', borderRadius: 10,
    backgroundColor: colors.bgElevated, border: `1px solid ${colors.border}`,
  },
  recIcon: { fontSize: 22, width: 28, textAlign: 'center', flexShrink: 0 },
  recLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  recValue: { fontSize: 14, fontWeight: 600, color: colors.textPrimary, marginTop: 2 },
  disclaimer: {
    marginTop: 20, padding: 14, borderRadius: 10,
    backgroundColor: colors.bgElevated, border: `1px solid ${colors.border}`,
    fontSize: 11, color: colors.textMuted, lineHeight: '1.6',
  },
  btnPrimary: {
    backgroundColor: colors.purple, color: '#fff', border: 'none',
    padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  btnSecondary: {
    backgroundColor: 'transparent', color: colors.textSecondary,
    border: `1px solid ${colors.border}`,
    padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  proGate: { textAlign: 'center' as const, paddingTop: 80 },
  sectionBox: {
    marginTop: 16, padding: '14px 16px', borderRadius: 10,
    backgroundColor: colors.bgElevated, border: `1px solid ${colors.border}`,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: 700, color: colors.textMuted,
    textTransform: 'uppercase' as const, letterSpacing: 0.6, marginBottom: 10,
  },
  sectionText: { fontSize: 13, color: colors.textSecondary, lineHeight: '1.6' },
  subNote: { fontSize: 12, color: colors.textMuted, lineHeight: '1.6', marginTop: 10 },
  chipRow: { display: 'flex', flexWrap: 'wrap' as const, gap: 6 },
  chip: {
    display: 'inline-block', padding: '3px 10px', borderRadius: 6,
    backgroundColor: colors.purple + '22', border: `1px solid ${colors.purple}44`,
    fontSize: 12, fontWeight: 600, color: colors.purple,
  },
  chipGreen: {
    backgroundColor: colors.accent + '22', border: `1px solid ${colors.accent}44`,
    color: colors.accent,
  },
  principlesList: {
    margin: 0, paddingLeft: 20,
  },
  principleItem: {
    fontSize: 13, color: colors.textSecondary, lineHeight: '1.6', marginBottom: 4,
  },
};
