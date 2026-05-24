import React from 'react';
import { colors } from '../theme/colors';
import { useBetsStore } from '../store/betsStore';

export type Page = 'dashboard' | 'bets' | 'analytics' | 'bankroll' | 'settings';

const NAV: Array<{ id: Page; icon: string; label: string }> = [
  { id: 'dashboard', icon: '📊', label: 'Дашборд' },
  { id: 'bets', icon: '📋', label: 'Ставки' },
  { id: 'analytics', icon: '🔬', label: 'Аналитика' },
  { id: 'bankroll', icon: '💰', label: 'Банкролл' },
  { id: 'settings', icon: '⚙️', label: 'Настройки' },
];

interface Props {
  page: Page;
  onNavigate: (p: Page) => void;
  children: React.ReactNode;
}

export function AppLayout({ page, onNavigate, children }: Props) {
  const betsCount = useBetsStore((s) => s.bets.length);
  const isPro = useBetsStore((s) => s.settings.isPro);

  return (
    <div style={s.root}>
      <aside style={s.sidebar}>
        {/* Logo */}
        <div style={s.logo}>
          <span style={{ fontSize: 24 }}>🦈</span>
          <span style={s.logoText}>SharkLog</span>
        </div>

        {/* Nav */}
        <nav style={s.nav}>
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                ...s.navItem,
                ...(page === item.id ? s.navItemActive : {}),
              }}
            >
              <span style={s.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom info */}
        <div style={s.sidebarBottom}>
          {isPro ? (
            <div style={s.proBadge}>👑 PRO</div>
          ) : (
            <div style={s.freeInfo}>
              <span style={{ color: colors.textMuted, fontSize: 11 }}>
                {betsCount} / 50 ставок
              </span>
              <div style={s.freeBar}>
                <div style={{ ...s.freeBarFill, width: `${Math.min(100, (betsCount / 50) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
      </aside>

      <main style={s.main}>
        {children}
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  sidebar: {
    width: 220,
    flexShrink: 0,
    backgroundColor: colors.bgCard,
    borderRight: `1px solid ${colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 12px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 8,
    marginBottom: 28,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 700,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  nav: { display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 10,
    border: 'none',
    background: 'transparent',
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
    textAlign: 'left',
    width: '100%',
  },
  navItemActive: {
    backgroundColor: colors.purpleDim,
    color: colors.purple,
    fontWeight: 700,
  },
  navIcon: { fontSize: 18, width: 22, textAlign: 'center' },
  sidebarBottom: { marginTop: 'auto' },
  proBadge: {
    textAlign: 'center',
    padding: '8px 0',
    color: colors.gold,
    fontSize: 13,
    fontWeight: 700,
    backgroundColor: colors.gold + '18',
    borderRadius: 8,
    border: `1px solid ${colors.gold}44`,
  },
  freeInfo: { padding: '4px 4px' },
  freeBar: {
    marginTop: 6,
    height: 4,
    backgroundColor: colors.bgElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  freeBarFill: {
    height: '100%',
    backgroundColor: colors.purple,
    borderRadius: 2,
    transition: 'width 0.3s',
  },
  main: {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
};
