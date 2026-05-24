import React, { useState, useMemo } from 'react';
import type { Bet, BetStatus } from '@sharklog/core';
import { SPORTS, BET_TYPES, formatMoney, formatOdds } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';
import { colors } from '../theme/colors';

interface Props {
  onAdd: () => void;
  onEdit: (bet: Bet) => void;
}

const STATUS_LABELS: Record<BetStatus, string> = {
  pending: 'Ожидание', won: 'Победа', lost: 'Проигрыш', refund: 'Возврат',
};
const STATUS_COLORS: Record<BetStatus, string> = {
  pending: colors.pending, won: colors.won, lost: colors.lost, refund: colors.refund,
};

const FILTERS: Array<{ key: BetStatus | 'all'; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'pending', label: 'Ожидание' },
  { key: 'won', label: 'Победы' },
  { key: 'lost', label: 'Проигрыши' },
  { key: 'refund', label: 'Возвраты' },
];

export function BetsPage({ onAdd, onEdit }: Props) {
  const { bets, deleteBet, updateBet, settings } = useBetsStore();
  const [filter, setFilter] = useState<BetStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);

  const freeLeft = Math.max(0, 50 - bets.length);

  const filtered = useMemo(() => {
    let result = [...bets];
    if (filter !== 'all') result = result.filter((b) => b.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((b) =>
        b.event.toLowerCase().includes(q) || b.pick.toLowerCase().includes(q),
      );
    }
    return result;
  }, [bets, filter, search]);

  function handleClose(bet: Bet, status: BetStatus) {
    updateBet(bet.id, { status });
  }

  function handleDelete(bet: Bet) {
    if (window.confirm(`Удалить ставку?\n${bet.event}`)) deleteBet(bet.id);
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Ставки</h1>
          <div style={s.subtitle}>
            {settings.isPro ? `${bets.length} ставок` : `${freeLeft} из 50 осталось`}
          </div>
        </div>
        <button style={s.addBtn} onClick={onAdd}>+ Добавить ставку</button>
      </div>

      {!settings.isPro && bets.length >= 40 && (
        <div style={s.limitBanner}>
          {freeLeft <= 0
            ? '🔒 Лимит 50 ставок достигнут — перейди на Pro'
            : `⚠️ Осталось ${freeLeft} бесплатных ставок`}
        </div>
      )}

      {/* Toolbar */}
      <div style={s.toolbar}>
        <input
          style={s.search}
          placeholder="Поиск по событию или выбору..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={s.filters}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              style={{ ...s.filterBtn, ...(filter === f.key ? s.filterBtnActive : {}) }}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={s.empty}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🦈</div>
          <div style={s.emptyTitle}>{search ? 'Ничего не найдено' : 'Ставок пока нет'}</div>
          {!search && <div style={s.emptySub}>Нажми «+ Добавить ставку» чтобы начать</div>}
        </div>
      ) : (
        <div style={s.card}>
          <table style={s.table}>
            <thead>
              <tr>
                {['Дата', 'Событие', 'Выбор', 'Спорт', 'Тип', 'Коэф.', 'Ставка', 'P&L', 'Статус', ''].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((bet) => {
                const pnl = bet.status === 'won' ? Math.round(bet.stake * (bet.odds - 1))
                  : bet.status === 'lost' ? -bet.stake : null;
                const isHov = hovered === bet.id;
                return (
                  <tr
                    key={bet.id}
                    style={{ ...s.tr, ...(isHov ? s.trHover : {}) }}
                    onMouseEnter={() => setHovered(bet.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <td style={{ ...s.td, color: colors.textMuted }}>{bet.date}</td>
                    <td style={s.td}>
                      <div style={s.eventName}>{bet.event}</div>
                      {bet.notes && <div style={s.noteText}>{bet.notes}</div>}
                    </td>
                    <td style={{ ...s.td, color: colors.accent, fontWeight: 600 }}>{bet.pick}</td>
                    <td style={{ ...s.td, color: colors.textSecondary }}>{SPORTS[bet.sport]}</td>
                    <td style={{ ...s.td, color: colors.textSecondary }}>{BET_TYPES[bet.betType]}</td>
                    <td style={{ ...s.td, fontWeight: 700 }}>×{formatOdds(bet.odds)}</td>
                    <td style={s.td}>{formatMoney(bet.stake)}</td>
                    <td style={{ ...s.td, fontWeight: 700, color: pnl === null ? colors.textMuted : pnl >= 0 ? colors.won : colors.lost }}>
                      {pnl !== null ? (pnl >= 0 ? '+' : '') + formatMoney(pnl) : '—'}
                    </td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, color: STATUS_COLORS[bet.status], backgroundColor: STATUS_COLORS[bet.status] + '22' }}>
                        {STATUS_LABELS[bet.status]}
                      </span>
                    </td>
                    <td style={s.td}>
                      <div style={s.actions}>
                        {bet.status === 'pending' && (
                          <select
                            style={s.closeSelect}
                            value=""
                            onChange={(e) => handleClose(bet, e.target.value as BetStatus)}
                          >
                            <option value="" disabled>Закрыть</option>
                            <option value="won">Победа</option>
                            <option value="lost">Проигрыш</option>
                            <option value="refund">Возврат</option>
                          </select>
                        )}
                        <button style={s.editBtn} onClick={() => onEdit(bet)}>✏️</button>
                        <button style={s.delBtn} onClick={() => handleDelete(bet)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', flex: 1, overflow: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 700, color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  addBtn: {
    backgroundColor: colors.purple, color: '#fff', border: 'none',
    padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  limitBanner: {
    backgroundColor: colors.lost + '15', border: `1px solid ${colors.lost}44`,
    borderRadius: 10, padding: '10px 16px', marginBottom: 16,
    color: colors.lost, fontSize: 13, fontWeight: 600,
  },
  toolbar: { display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' },
  search: {
    flex: 1, backgroundColor: colors.bgCard, border: `1px solid ${colors.border}`,
    borderRadius: 8, padding: '8px 14px', color: colors.textPrimary, fontSize: 14,
    outline: 'none',
  },
  filters: { display: 'flex', gap: 6 },
  filterBtn: {
    padding: '7px 12px', borderRadius: 8, border: `1px solid ${colors.border}`,
    backgroundColor: colors.bgCard, color: colors.textSecondary, fontSize: 13, cursor: 'pointer',
  },
  filterBtnActive: {
    backgroundColor: colors.purple, borderColor: colors.purple, color: '#fff', fontWeight: 700,
  },
  empty: { textAlign: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: 600, color: colors.textPrimary, marginBottom: 6 },
  emptySub: { fontSize: 14, color: colors.textSecondary },
  card: { backgroundColor: colors.bgCard, borderRadius: 14, border: `1px solid ${colors.border}`, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5,
    padding: '12px 14px', textAlign: 'left', borderBottom: `1px solid ${colors.border}`,
    backgroundColor: colors.bgElevated,
  },
  tr: { borderBottom: `1px solid ${colors.border}`, transition: 'background 0.1s' },
  trHover: { backgroundColor: colors.bgElevated },
  td: { padding: '12px 14px', fontSize: 13, color: colors.textPrimary },
  eventName: { fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  noteText: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontStyle: 'italic' },
  badge: { padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 },
  actions: { display: 'flex', gap: 4, alignItems: 'center' },
  closeSelect: {
    backgroundColor: colors.bgElevated, border: `1px solid ${colors.border}`,
    borderRadius: 6, padding: '4px 8px', color: colors.textPrimary, fontSize: 12, cursor: 'pointer',
  },
  editBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '4px 6px', borderRadius: 6, fontSize: 14,
  },
  delBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '4px 6px', borderRadius: 6, fontSize: 14,
  },
};
