import React from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../theme/colors';

/**
 * A placeholder until the partner programme is settled — the same call as on
 * mobile.
 *
 * The previous page listed made-up bonuses ("Бонус до 10 000 ₽ новым игрокам")
 * next to real bookmaker names, claimed a commission no programme paid, and
 * linked to an offshore bookmaker: advertising of betting without the marking
 * and wording the law asks for, and of a brand that is illegal in Russia.
 * Nothing goes back here without real offers from the affiliate network.
 */
export function PartnersPage() {
  const { t } = useTranslation();
  return (
    <div style={s.root}>
      <div style={s.badge}>🎁</div>
      <h1 style={s.title}>{t('partners.stubTitle')}</h1>
      <p style={s.text}>{t('partners.stubText')}</p>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 12, padding: '32px 36px', textAlign: 'center',
  },
  badge: {
    width: 72, height: 72, borderRadius: 36, fontSize: 32,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentDim, border: `1px solid ${colors.border}`,
    marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: 800, color: colors.textPrimary, margin: 0 },
  text: { fontSize: 14, color: colors.textSecondary, lineHeight: '1.5', margin: 0, maxWidth: 420 },
};
