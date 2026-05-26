import React from 'react';
import { useToastStore } from '../store/toastStore';
import { colors } from '../theme/colors';

const TYPE_STYLES: Record<string, { bg: string; border: string; color: string; icon: string }> = {
  success: { bg: colors.won + '18', border: colors.won + '55', color: colors.won, icon: '✓' },
  error:   { bg: colors.lost + '18', border: colors.lost + '55', color: colors.lost, icon: '✕' },
  info:    { bg: colors.purple + '18', border: colors.purple + '55', color: colors.purple, icon: 'ℹ' },
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none',
    }}>
      {toasts.map((t) => {
        const st = TYPE_STYLES[t.type] ?? TYPE_STYLES['info']!;
        return (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            className="sl-toast"
            style={{
              pointerEvents: 'auto', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10,
              backgroundColor: st.bg, border: `1px solid ${st.border}`,
              borderRadius: 10, padding: '12px 16px',
              minWidth: 260, maxWidth: 380,
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 700, color: st.color, flexShrink: 0 }}>{st.icon}</span>
            <span style={{ fontSize: 13, color: '#E2E2EF', lineHeight: 1.4 }}>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
