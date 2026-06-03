import React from 'react';
import { colors } from '../theme/colors';
import { Analytics } from '../utils/analytics';

const PARTNERS = [
  {
    id: 'fonbet',
    name: 'Fonbet',
    emoji: '🎯',
    category: 'Топ букмекер',
    description: 'Крупнейший легальный букмекер России. Широкая линия на спорт и киберспорт, быстрые выплаты.',
    bonus: 'Бонус до 10 000 ₽ новым игрокам',
    refUrl: 'https://fonbet.ru',
  },
  {
    id: 'betcity',
    name: 'BetCity',
    emoji: '🏆',
    category: 'Спорт',
    description: 'Высокие лимиты, удобное мобильное приложение. Быстрые выплаты на карту и кошельки.',
    bonus: 'Фрибет 1 000 ₽ при регистрации',
    refUrl: 'https://betcity.ru',
  },
  {
    id: '1xbet',
    name: '1xBet',
    emoji: '⚡',
    category: 'Широкая линия',
    description: 'Огромная линия событий, высокие кэфы. Live-ставки с трансляциями матчей.',
    bonus: 'Бонус 100% на первый депозит до 100 €',
    refUrl: 'https://1xbet.com',
  },
  {
    id: 'parimatch',
    name: 'Parimatch',
    emoji: '🎪',
    category: 'Киберспорт',
    description: 'Популярный букмекер с акцентом на киберспорт. Хорошие кэфы на Dota 2, CS2, Valorant.',
    bonus: 'Фрибет до 2 500 ₽',
    refUrl: 'https://parimatch.ru',
  },
  {
    id: 'leon',
    name: 'Leon',
    emoji: '🦁',
    category: 'Аналитика',
    description: 'Удобная статистика прямо в линии. Трансляции матчей, быстрые выплаты, кэшбэк.',
    bonus: 'Кэшбэк до 10% на проигранные ставки',
    refUrl: 'https://leon.ru',
  },
  {
    id: 'winline',
    name: 'Winline',
    emoji: '🎲',
    category: 'Топ букмекер',
    description: 'Легальный букмекер с хорошими бонусами и широкой линией на российский спорт.',
    bonus: 'Страховка ставки до 2 000 ₽',
    refUrl: 'https://winline.ru',
  },
];

export function PartnersPage() {
  function openPartner(partner: typeof PARTNERS[number]) {
    Analytics.partnerLinkTapped(partner.id);
    window.open(partner.refUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <h1 style={s.title}>Партнёры</h1>
        <p style={s.subtitle}>Проверенные букмекеры — используй реферальную ссылку и получи бонус при регистрации.</p>
        <div style={s.notice}>
          ⚠️ Это партнёрские ссылки — мы получаем комиссию при регистрации. Ставки несут финансовый риск. Играй ответственно.
        </div>
      </div>

      <div style={s.grid}>
        {PARTNERS.map((p) => (
          <div key={p.id} style={s.card}>
            <div style={s.cardTop}>
              <span style={s.emoji}>{p.emoji}</span>
              <div style={s.cardInfo}>
                <div style={s.partnerName}>{p.name}</div>
                <div style={s.category}>{p.category}</div>
              </div>
            </div>
            <p style={s.description}>{p.description}</p>
            <div style={s.bonus}>🎁 {p.bonus}</div>
            <button style={s.btn} onClick={() => openPartner(p)}>
              Открыть {p.name} →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    padding: '32px 36px', overflowY: 'auto', flex: 1,
    maxWidth: 960, margin: '0 auto', width: '100%',
  },
  header: { marginBottom: 32 },
  title: { fontSize: 26, fontWeight: 800, color: colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 14, lineHeight: '1.5' },
  notice: {
    fontSize: 12, color: colors.textMuted, backgroundColor: colors.bgElevated,
    border: `1px solid ${colors.border}`, borderRadius: 8, padding: '10px 14px',
    lineHeight: '1.5',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },
  card: {
    backgroundColor: colors.bgCard, border: `1px solid ${colors.border}`,
    borderRadius: 16, padding: 20,
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  cardTop: { display: 'flex', alignItems: 'center', gap: 14 },
  emoji: { fontSize: 32, flexShrink: 0 },
  cardInfo: {},
  partnerName: { fontSize: 17, fontWeight: 700, color: colors.textPrimary },
  category: {
    fontSize: 11, color: colors.purple, fontWeight: 600,
    backgroundColor: colors.purpleDim, borderRadius: 4, padding: '2px 6px',
    display: 'inline-block', marginTop: 2,
  },
  description: {
    fontSize: 13, color: colors.textSecondary, lineHeight: '1.6', flex: 1, margin: 0,
  },
  bonus: {
    fontSize: 13, color: colors.accent, fontWeight: 600,
    backgroundColor: colors.accentDim, borderRadius: 8, padding: '8px 12px',
  },
  btn: {
    backgroundColor: colors.purple, color: '#fff', border: 'none',
    borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', width: '100%',
  },
};
