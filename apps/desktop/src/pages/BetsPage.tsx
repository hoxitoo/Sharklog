import React, { useState, useMemo } from 'react';
import type { Bet, BetStatus } from '@sharklog/core';
import { SPORTS, BET_TYPES, formatMoney, formatOdds, FREE_LIMITS, isInTilt } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';
import { useToastStore } from '../store/toastStore';
import { ConfirmModal } from '../components/ConfirmModal';
import { colors } from '../theme/colors';
import { useTranslation } from 'react-i18next';

interface Props {
  onAdd: () => void;
  onEdit: (bet: Bet) => void;
}

const STATUS_COLORS: Record<BetStatus, string> = {
  pending: colors.pending, won: colors.won, lost: colors.lost, refund: colors.refund, cashout: colors.refund,
};

type SortKey = 'date_desc' | 'date_asc' | 'odds_desc' | 'odds_asc' | 'stake_desc' | 'stake_asc';

export function BetsPage({ onAdd, onEdit }: Props) {
  const { bets, deleteBet, updateBet, settings } = useBetsStore();
  const toast = useToastStore((s) => s.show);
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<BetStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('date_desc');
  const [hovered, setHovered] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Bet | null>(null);

  const freeLeft = Math.max(0, FREE_LIMITS.MAX_BETS - bets.length);

  const STATUS_LABELS: Record<BetStatus, string> = {
    pending: t('status.pending'),
    won: t('status.won'),
    lost: t('status.lost'),
    refund: t('status.refund'),
    cashout: t('status.cashout'),
  };

  const FILTERS: Array<{ key: BetStatus | 'all'; label: string }> = [
    { key: 'all', label: t('status.all') },
    { key: 'pending', label: t('status.pending') },
    { key: 'won', label: t('status.won') },
    { key: 'lost', label: t('status.lost') },
    { key: 'refund', label: t('status.refund') },
    { key: 'cashout', label: t('status.cashout') },
  ];

  function formatDateTitle(dateStr: string): string {
    const today = new Date().toISOString().split('T')[0] ?? '';
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0] ?? '';
    if (dateStr === today) return t('dashboard.today');
    if (dateStr === yesterday) return t('dashboard.yesterday');
    const locale = i18n.language === 'en' ? 'en-US' : 'ru-RU';
    return new Date(dateStr + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  const sections = useMemo(() => {
    let result = [...bets];
    if (filter !== 'all') result = result.filter((b) => b.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((b) =>
        b.event.toLowerCase().includes(q) || b.pick.toLowerCase().includes(q),
      );
    }

    const map = new Map<string, Bet[]>();
    for (const bet of result) {
      const arr = map.get(bet.date) ?? [];
      arr.push(bet);
      map.set(bet.date, arr);
    }

    const sortedDates = [...map.keys()].sort((a, b) =>
      sort === 'date_asc' ? a.localeCompare(b) : b.localeCompare(a),
    );

    return sortedDates.map((date) => {
      const data = [...(map.get(date) ?? [])];
      if (sort === 'odds_desc') data.sort((a, b) => b.odds - a.odds);
      else if (sort === 'odds_asc') data.sort((a, b) => a.odds - b.odds);
      else if (sort === 'stake_desc') data.sort((a, b) => b.stake - a.stake);
      else if (sort === 'stake_asc') data.sort((a, b) => a.stake - b.stake);
      else if (sort === 'date_asc') data.sort((a, b) => a.time.localeCompare(b.time));
      else data.sort((a, b) => b.time.localeCompare(a.time));

      const dailyPnl = data.reduce((sum, b) => {
        if (b.status === 'won') return sum + Math.round(b.stake * b.odds) - b.stake;
        if (b.status === 'lost') return sum - b.stake;
        if (b.status === 'cashout' && b.cashoutAmount != null) return sum + b.cashoutAmount - b.stake;
        return sum;
      }, 0);

      return { date, title: formatDateTitle(date), dailyPnl, data };
    });
  }, [bets, filter, search, sort, i18n.language]);

  const totalFiltered = sections.reduce((n, s) => n + s.data.length, 0);

  function handleClose(bet: Bet, status: BetStatus) {
    updateBet(bet.id, { status });
    if (status === 'lost') {
      const updated = bets.map((b) => b.id === bet.id ? { ...b, status } : b);
      if (isInTilt(updated, settings.tiltThreshold)) {
        toast(`🚨 ${t('discipline.tiltAlert')} ${settings.tiltThreshold} ${t('settings.tiltThresholdHint')}`, 'error');
      }
    }
  }

  function handleDelete(bet: Bet) {
    setConfirmDelete(bet);
  }

  const COLS = [t('bet.event'), t('bet.pick'), t('bet.sport'), t('bet.betType'), t('bet.odds'), t('bet.stake'), 'P&L', t('common.status'), ''];

  return (
    <div style={s.page}>
      {confirmDelete && (
        <ConfirmModal
          message={`${t('bet.confirmDelete')}\n«${confirmDelete.event}»`}
          onConfirm={() => { deleteBet(confirmDelete.id); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>{t('nav.bets')}</h1>
          <div style={s.subtitle}>
            {settings.isPro
              ? `${bets.length} ${t('common.bets')}`
              : `${freeLeft} ${t('common.of')} ${FREE_LIMITS.MAX_BETS} ${t('common.bets')}`}
          </div>
        </div>
        <button style={s.addBtn} onClick={onAdd}>+ {t('bet.add')}</button>
      </div>

      {!settings.isPro && bets.length >= FREE_LIMITS.MAX_BETS - 10 && (
        <div style={s.limitBanner}>
          {freeLeft <= 0
            ? t('bet.limitReached', { count: FREE_LIMITS.MAX_BETS })
            : t('bet.limitWarning', { count: freeLeft })}
        </div>
      )}

      {/* Toolbar */}
      <div style={s.toolbar}>
        <input
          style={s.search}
          placeholder={t('bet.searchPlaceholder')}
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
        <div style={{ display: 'flex', gap: 4, marginLeft: 8, borderLeft: `1px solid ${colors.border}`, paddingLeft: 12 }}>
          {(['date_desc', 'date_asc'] as SortKey[]).map((k) => (
            <button key={k} style={{ ...s.sortBtn, ...(sort === k ? s.sortBtnActive : {}) }} onClick={() => setSort(k)}>
              {k === 'date_desc' ? t('bet.sortNewest') : t('bet.sortOldest')}
            </button>
          ))}
          <button
            style={{ ...s.sortBtn, ...(sort === 'odds_desc' || sort === 'odds_asc' ? s.sortBtnActive : {}) }}
            onClick={() => setSort(sort === 'odds_desc' ? 'odds_asc' : sort === 'odds_asc' ? 'odds_desc' : 'odds_desc')}
          >
            {t('bet.odds')}&nbsp;{sort === 'odds_asc' ? '↑' : '↓'}
          </button>
          <button
            style={{ ...s.sortBtn, ...(sort === 'stake_desc' || sort === 'stake_asc' ? s.sortBtnActive : {}) }}
            onClick={() => setSort(sort === 'stake_desc' ? 'stake_asc' : sort === 'stake_asc' ? 'stake_desc' : 'stake_desc')}
          >
            {t('bet.stake')}&nbsp;{sort === 'stake_asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Content */}
      {totalFiltered === 0 ? (
        <div style={s.empty}>
          {search
            ? <div style={{ fontSize: 52, marginBottom: 12 }}>🔍</div>
            : <img src="/logo.png" alt="SharkLog" style={{ width: 100, height: 100, objectFit: 'contain', marginBottom: 12, animation: 'sharkFloat 2.4s ease-in-out infinite' }} />
          }
          <div style={s.emptyTitle}>{search ? t('bet.notFound') : t('bet.noBetsYet')}</div>
          {search
            ? <div style={s.emptySub}>{t('bet.tryOtherSearch')}</div>
            : <>
                <div style={s.emptySub}>{t('bet.startTracking')}</div>
                <button onClick={onAdd} style={s.emptyBtn}>+ {t('bet.newBet')}</button>
              </>
          }
        </div>
      ) : (
        <div style={s.card}>
          <table style={s.table}>
            <thead>
              <tr>
                {COLS.map((h) => <th key={h} style={s.th}>{h}</th>)}
              </tr>
            </thead>
            {sections.map((section) => (
              <tbody key={section.date}>
                {/* Date section header */}
                <tr style={s.sectionHeader}>
                  <td colSpan={4} style={s.sectionDate}>{section.title}</td>
                  <td colSpan={5} style={{ ...s.sectionDate, textAlign: 'right' }}>
                    {section.dailyPnl !== 0 && (
                      <span style={{
                        fontSize: 12, fontWeight: 700,
                        color: section.dailyPnl > 0 ? colors.won : colors.lost,
                      }}>
                        {section.dailyPnl > 0 ? '+' : ''}{formatMoney(section.dailyPnl)}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: colors.textMuted, marginLeft: 8 }}>
                      {section.data.length} {t('common.bets')}
                    </span>
                  </td>
                </tr>

                {/* Bet rows */}
                {section.data.map((bet) => {
                  const pnl = bet.status === 'won' ? Math.round(bet.stake * (bet.odds - 1))
                    : bet.status === 'lost' ? -bet.stake
                    : bet.status === 'cashout' && bet.cashoutAmount != null ? bet.cashoutAmount - bet.stake
                    : null;
                  const isHov = hovered === bet.id;
                  return (
                    <tr
                      key={bet.id}
                      style={{ ...s.tr, ...(isHov ? s.trHover : {}) }}
                      onMouseEnter={() => setHovered(bet.id)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <td style={s.td}>
                        <div style={s.eventName}>{bet.event}</div>
                        {bet.notes && <div style={s.noteText}>{bet.notes}</div>}
                        {bet.bookmaker && <div style={s.bkBadge}>{bet.bookmaker}</div>}
                      </td>
                      <td style={{ ...s.td, color: colors.accent, fontWeight: 600 }}>{bet.pick}</td>
                      <td style={{ ...s.td, color: colors.textSecondary }}>{SPORTS[bet.sport]}</td>
                      <td style={{ ...s.td, color: colors.textSecondary }}>{BET_TYPES[bet.betType]}</td>
                      <td style={{ ...s.td, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>×{formatOdds(bet.odds)}</td>
                      <td style={{ ...s.td, fontFamily: "'DM Mono', monospace" }}>{formatMoney(bet.stake)}</td>
                      <td style={{ ...s.td, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: pnl === null ? colors.textMuted : pnl >= 0 ? colors.won : colors.lost }}>
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
                            <>
                              <button style={{ ...s.chip, color: colors.won, borderColor: colors.won + '55', backgroundColor: colors.won + '18' }} onClick={() => handleClose(bet, 'won')}>W</button>
                              <button style={{ ...s.chip, color: colors.lost, borderColor: colors.lost + '55', backgroundColor: colors.lost + '18' }} onClick={() => handleClose(bet, 'lost')}>L</button>
                              <button style={{ ...s.chip, color: colors.refund, borderColor: colors.refund + '55', backgroundColor: colors.refund + '18' }} onClick={() => handleClose(bet, 'refund')}>R</button>
                              <button style={{ ...s.chip, color: colors.refund, borderColor: colors.refund + '55', backgroundColor: colors.refund + '18' }} onClick={() => handleClose(bet, 'cashout')}>C</button>
                            </>
                          )}
                          <button style={s.editBtn} onClick={() => onEdit(bet)}>✏️</button>
                          <button style={s.delBtn} onClick={() => handleDelete(bet)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
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
  toolbar: { display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' },
  search: {
    flex: 1, minWidth: 180, backgroundColor: colors.bgCard, border: `1px solid ${colors.border}`,
    borderRadius: 8, padding: '8px 14px', color: colors.textPrimary, fontSize: 14, outline: 'none',
  },
  filters: { display: 'flex', gap: 4 },
  filterBtn: {
    padding: '7px 11px', borderRadius: 8, border: `1px solid ${colors.border}`,
    backgroundColor: colors.bgCard, color: colors.textSecondary, fontSize: 12, cursor: 'pointer',
  },
  filterBtnActive: {
    backgroundColor: colors.purple, borderColor: colors.purple, color: '#fff', fontWeight: 700,
  },
  sortBtn: {
    padding: '6px 10px', borderRadius: 7, border: `1px solid ${colors.border}`,
    backgroundColor: 'transparent', color: colors.textMuted, fontSize: 11, cursor: 'pointer',
  },
  sortBtnActive: { color: colors.accent, borderColor: colors.accent + '66', backgroundColor: colors.accent + '12', fontWeight: 700 },
  empty: { textAlign: 'center', paddingTop: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: 600, color: colors.textPrimary, marginBottom: 2 },
  emptySub: { fontSize: 14, color: colors.textSecondary },
  emptyBtn: {
    marginTop: 16, backgroundColor: colors.purple, color: '#fff', border: 'none',
    borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
    transition: 'transform 0.12s, box-shadow 0.12s',
  },
  card: { backgroundColor: colors.bgCard, borderRadius: 14, border: `1px solid ${colors.border}`, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5,
    padding: '11px 14px', textAlign: 'left', borderBottom: `1px solid ${colors.border}`,
    backgroundColor: colors.bgElevated,
  },
  sectionHeader: { backgroundColor: colors.bgElevated + 'aa' },
  sectionDate: {
    padding: '7px 14px', fontSize: 11, color: colors.textSecondary,
    fontWeight: 600, borderBottom: `1px solid ${colors.border}`,
    borderTop: `1px solid ${colors.border}`,
  },
  tr: { borderBottom: `1px solid ${colors.border}`, transition: 'background 0.1s' },
  trHover: { backgroundColor: colors.bgElevated },
  td: { padding: '11px 14px', fontSize: 13, color: colors.textPrimary },
  eventName: { fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  noteText: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 },
  bkBadge: { display: 'inline-block', marginTop: 3, fontSize: 10, color: colors.textMuted, backgroundColor: colors.bgElevated, borderRadius: 4, padding: '1px 5px', border: `1px solid ${colors.border}` },
  badge: { padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 },
  actions: { display: 'flex', gap: 4, alignItems: 'center' },
  chip: { border: '1px solid', borderRadius: 6, padding: '3px 7px', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  editBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, fontSize: 15, opacity: 0.65 },
  delBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, fontSize: 15, color: colors.lost, opacity: 0.6, fontWeight: 700 },
};
