import React, { useState } from 'react';
import { colors } from '../theme/colors';

const CHECKLIST = [
  { emoji: '🧠', text: 'Я не в состоянии тилта' },
  { emoji: '📋', text: 'Ставка соответствует моей стратегии' },
  { emoji: '🔍', text: 'Я проанализировал событие' },
  { emoji: '📊', text: 'Я укладываюсь в дневной лимит' },
  { emoji: '💸', text: 'Я готов потерять эту сумму' },
];

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

export function ChecklistModal({ onConfirm, onCancel }: Props) {
  const [checked, setChecked] = useState<boolean[]>(Array(CHECKLIST.length).fill(false));
  const allChecked = checked.every(Boolean);

  function toggle(i: number) {
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  function handleConfirm() {
    if (!allChecked) return;
    setChecked(Array(CHECKLIST.length).fill(false));
    onConfirm();
  }

  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={s.sheet}>
        <div style={s.title}>Готов к ставке? 🦈</div>
        <div style={s.subtitle}>
          Отметь все пункты — это занимает 10 секунд и сохраняет дисциплину
        </div>

        <div style={{ marginBottom: 20 }}>
          {CHECKLIST.map((item, i) => (
            <div
              key={i}
              style={{ ...s.item, ...(checked[i] ? s.itemChecked : {}) }}
              onClick={() => toggle(i)}
            >
              <div style={{ ...s.checkbox, ...(checked[i] ? s.checkboxChecked : {}) }}>
                {checked[i] && <span style={s.checkmark}>✓</span>}
              </div>
              <span style={s.emoji}>{item.emoji}</span>
              <span style={{ ...s.itemText, ...(checked[i] ? s.itemTextChecked : {}) }}>
                {item.text}
              </span>
            </div>
          ))}
        </div>

        <button style={{ ...s.confirmBtn, ...(!allChecked ? s.confirmBtnDisabled : {}) }} onClick={handleConfirm}>
          <span style={{ ...s.confirmText, ...(!allChecked ? s.confirmTextDisabled : {}) }}>
            {allChecked ? 'Ставить 💪' : `Отметь все (${checked.filter(Boolean).length}/${CHECKLIST.length})`}
          </span>
        </button>

        <button style={s.cancelBtn} onClick={onCancel}>Отмена</button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
  },
  sheet: {
    backgroundColor: colors.bgCard, borderRadius: 20, padding: 32,
    width: 420, border: `1px solid ${colors.border}`,
  },
  title: { fontSize: 22, fontWeight: 700, color: colors.textPrimary, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: '1.5' },
  item: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
    borderRadius: 12, backgroundColor: colors.bgElevated, marginBottom: 8,
    border: `1px solid ${colors.border}`, cursor: 'pointer',
  },
  itemChecked: { borderColor: colors.accent + '66', backgroundColor: colors.accentDim },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, border: `2px solid ${colors.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkboxChecked: { borderColor: colors.accent, backgroundColor: colors.accent },
  checkmark: { fontSize: 13, color: '#000', fontWeight: 700 },
  emoji: { fontSize: 18, flexShrink: 0 },
  itemText: { fontSize: 14, color: colors.textSecondary, flex: 1 },
  itemTextChecked: { color: colors.textPrimary },
  confirmBtn: {
    width: '100%', backgroundColor: colors.purple, border: 'none',
    borderRadius: 12, padding: '14px 0', marginBottom: 10, cursor: 'pointer',
  },
  confirmBtnDisabled: { backgroundColor: colors.bgElevated, border: `1px solid ${colors.border}`, cursor: 'not-allowed' },
  confirmText: { fontSize: 15, fontWeight: 700, color: '#fff' },
  confirmTextDisabled: { color: colors.textMuted },
  cancelBtn: {
    width: '100%', background: 'none', border: 'none', padding: '8px 0',
    color: colors.textMuted, fontSize: 14, cursor: 'pointer',
  },
};
