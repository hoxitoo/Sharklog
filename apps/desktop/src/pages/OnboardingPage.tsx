import React, { useState } from 'react';
import { DEFAULT_BOOKMAKERS } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';
import { colors } from '../theme/colors';

interface Props {
  onFinish: (openAddBet: boolean) => void;
}

const FEATURES = [
  { icon: '📊', label: 'Статистика', desc: 'ROI, WR, P&L по 7 срезам' },
  { icon: '💰', label: 'Банкролл', desc: 'Калькулятор Келли + кривая' },
  { icon: '🧠', label: 'Тилт-контроль', desc: 'Алерт при серии поражений' },
  { icon: '📋', label: 'Дневник', desc: 'Дисциплина и настрой' },
];

export function OnboardingPage({ onFinish }: Props) {
  const { updateSettings, settings } = useBetsStore();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set(settings.bookmakers));
  const [customBk, setCustomBk] = useState('');

  function toggleBk(bk: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(bk)) next.delete(bk);
      else next.add(bk);
      return next;
    });
  }

  function addCustomBk() {
    const t = customBk.trim();
    if (!t) return;
    setSelected((prev) => new Set([...prev, t]));
    setCustomBk('');
  }

  function finish(openBet: boolean) {
    updateSettings({ bookmakers: [...selected], onboardingComplete: true });
    onFinish(openBet);
  }

  return (
    <div style={s.root}>
      <div style={s.card}>
        {/* Steps indicator */}
        <div style={s.steps}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ ...s.dot, ...(step >= i ? s.dotActive : {}) }} />
          ))}
        </div>

        {step === 0 && (
          <div style={s.stepContent}>
            <img src="/logo.png" alt="SharkLog" style={{ width: 160, height: 160, objectFit: 'contain', marginBottom: 12 }} />
            <h1 style={s.title}>Добро пожаловать в SharkLog</h1>
            <p style={s.subtitle}>Профессиональный трекер ставок — анализируй, контролируй, побеждай</p>
            <div style={s.features}>
              {FEATURES.map((f) => (
                <div key={f.label} style={s.featureCard}>
                  <span style={{ fontSize: 24 }}>{f.icon}</span>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary, marginTop: 6 }}>{f.label}</div>
                  <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{f.desc}</div>
                </div>
              ))}
            </div>
            <button style={s.btnPrimary} onClick={() => setStep(1)}>
              Начать →
            </button>
          </div>
        )}

        {step === 1 && (
          <div style={s.stepContent}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏦</div>
            <h2 style={s.title}>Выбери букмекеров</h2>
            <p style={s.subtitle}>Отметь тех, с кем работаешь. Это можно изменить в настройках.</p>
            <div style={s.bkGrid}>
              {DEFAULT_BOOKMAKERS.map((bk) => (
                <button
                  key={bk}
                  style={{ ...s.bkChip, ...(selected.has(bk) ? s.bkChipActive : {}) }}
                  onClick={() => toggleBk(bk)}
                >
                  {selected.has(bk) && <span style={{ marginRight: 4 }}>✓</span>}
                  {bk}
                </button>
              ))}
              {[...selected].filter((b) => !DEFAULT_BOOKMAKERS.includes(b)).map((bk) => (
                <button
                  key={bk}
                  style={{ ...s.bkChip, ...s.bkChipActive }}
                  onClick={() => toggleBk(bk)}
                >
                  ✓ {bk}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              <input
                style={s.input}
                placeholder="Добавить другого..."
                value={customBk}
                onChange={(e) => setCustomBk(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomBk()}
              />
              <button style={s.btnAdd} onClick={addCustomBk}>+</button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={s.btnSecondary} onClick={() => setStep(0)}>← Назад</button>
              <button style={s.btnPrimary} onClick={() => setStep(2)}>
                Далее →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={s.stepContent}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
            <h2 style={s.title}>Всё готово!</h2>
            <p style={s.subtitle}>
              Выбрано {selected.size} букмекер{selected.size === 1 ? '' : selected.size < 5 ? 'а' : 'ов'}.
              Начни добавлять ставки и наблюдай за своей статистикой в реальном времени.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320 }}>
              <button style={s.btnPrimary} onClick={() => finish(true)}>
                🎯 Добавить первую ставку
              </button>
              <button style={s.btnSecondary} onClick={() => finish(false)}>
                Начать без ставки
              </button>
            </div>
            <button style={{ ...s.btnSecondary, marginTop: 8 }} onClick={() => setStep(1)}>← Назад</button>
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', backgroundColor: colors.bg, padding: 24,
  },
  card: {
    backgroundColor: colors.bgCard, borderRadius: 20, padding: '40px 48px',
    border: `1px solid ${colors.border}`, maxWidth: 600, width: '100%',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  steps: { display: 'flex', gap: 8, marginBottom: 32 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border, transition: 'background 0.2s' },
  dotActive: { backgroundColor: colors.purple, width: 24 },
  stepContent: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', textAlign: 'center' },
  title: { fontSize: 26, fontWeight: 700, color: colors.textPrimary, margin: '0 0 8px', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textSecondary, margin: '0 0 24px', lineHeight: 1.5, maxWidth: 420 },
  features: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%', marginBottom: 28 },
  featureCard: {
    backgroundColor: colors.bgElevated, borderRadius: 12, padding: '14px 12px',
    border: `1px solid ${colors.border}`, textAlign: 'center',
  },
  bkGrid: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16, width: '100%' },
  bkChip: {
    padding: '8px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
    cursor: 'pointer', border: `1px solid ${colors.border}`,
    backgroundColor: colors.bgElevated, color: colors.textSecondary, transition: 'all 0.15s',
  },
  bkChipActive: {
    backgroundColor: colors.purple + '22', borderColor: colors.purple,
    color: colors.purpleText, fontWeight: 700,
  },
  input: {
    flex: 1, backgroundColor: colors.bgElevated, border: `1px solid ${colors.border}`,
    borderRadius: 8, padding: '8px 12px', color: colors.textPrimary, fontSize: 14, outline: 'none',
  },
  btnAdd: {
    backgroundColor: colors.purple, color: '#fff', border: 'none',
    borderRadius: 8, width: 40, fontSize: 20, cursor: 'pointer', fontWeight: 700,
  },
  btnPrimary: {
    backgroundColor: colors.purple, color: '#fff', border: 'none',
    borderRadius: 12, padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
    width: '100%', maxWidth: 320,
  },
  btnSecondary: {
    background: 'none', border: `1px solid ${colors.border}`, borderRadius: 12,
    padding: '10px 20px', fontSize: 14, color: colors.textSecondary, cursor: 'pointer',
    width: '100%', maxWidth: 320,
  },
};
