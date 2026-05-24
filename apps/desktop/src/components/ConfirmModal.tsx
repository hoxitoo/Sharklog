import React from 'react';
import { colors } from '../theme/colors';

interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  danger?: boolean;
}

export function ConfirmModal({ message, onConfirm, onCancel, confirmLabel = 'Удалить', danger = true }: Props) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
      }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div style={{
        backgroundColor: colors.bgCard, borderRadius: 14, padding: '28px 28px 24px',
        border: `1px solid ${colors.border}`, width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 15, color: colors.textPrimary, lineHeight: 1.5, marginBottom: 24 }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              background: 'none', border: `1px solid ${colors.border}`,
              borderRadius: 8, padding: '8px 18px', fontSize: 13,
              color: colors.textSecondary, cursor: 'pointer',
            }}
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            style={{
              border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: danger ? colors.lost : colors.purple,
              color: '#fff',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
