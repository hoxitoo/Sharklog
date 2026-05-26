import React from 'react';
import { colors } from '../theme/colors';

interface Props { children: React.ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[SharkLog crash]', error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={s.root}>
        <div style={s.card}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🦈💥</div>
          <h2 style={s.title}>Что-то пошло не так</h2>
          <p style={s.msg}>{error.message}</p>
          <details style={s.details}>
            <summary style={{ cursor: 'pointer', color: colors.textMuted, fontSize: 12 }}>Детали ошибки</summary>
            <pre style={s.stack}>{error.stack}</pre>
          </details>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button style={s.btn} onClick={() => this.setState({ error: null })}>
              Попробовать снова
            </button>
            <button style={{ ...s.btn, backgroundColor: colors.bgElevated, color: colors.textSecondary }}
              onClick={() => window.location.reload()}>
              Перезагрузить
            </button>
          </div>
        </div>
      </div>
    );
  }
}

const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', backgroundColor: colors.bg, padding: 32,
  },
  card: {
    backgroundColor: colors.bgCard, border: `1px solid ${colors.border}`,
    borderRadius: 16, padding: 36, maxWidth: 520, width: '100%', textAlign: 'center',
  },
  title: { fontSize: 22, fontWeight: 700, color: colors.textPrimary, margin: '0 0 8px' },
  msg: { fontSize: 14, color: colors.lost, margin: '0 0 16px', fontFamily: "'DM Mono', monospace" },
  details: { textAlign: 'left', marginTop: 8 },
  stack: {
    fontSize: 11, color: colors.textMuted, backgroundColor: colors.bgElevated,
    borderRadius: 8, padding: 12, overflow: 'auto', maxHeight: 160, marginTop: 6,
  },
  btn: {
    backgroundColor: colors.purple, color: '#fff', border: 'none',
    borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
};
