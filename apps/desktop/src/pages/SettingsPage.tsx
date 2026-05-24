import React, { useState } from 'react';
import { DEFAULT_BOOKMAKERS, FREE_LIMITS } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';
import { colors } from '../theme/colors';

export function SettingsPage() {
  const { settings, updateSettings, bets, clearAll } = useBetsStore();
  const [newBk, setNewBk] = useState('');

  function addBookmaker() {
    const t = newBk.trim();
    if (!t || settings.bookmakers.includes(t)) return;
    updateSettings({ bookmakers: [...settings.bookmakers, t] });
    setNewBk('');
  }

  function removeBookmaker(bk: string) {
    updateSettings({ bookmakers: settings.bookmakers.filter((b) => b !== bk) });
  }

  function handleExportJSON() {
    const { bets: b, settings: s, bankroll, diary, teams } = useBetsStore.getState();
    const blob = new Blob([JSON.stringify({ bets: b, settings: s, bankroll, diary, teams }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sharklog-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportCSV() {
    const { bets: allBets } = useBetsStore.getState();
    const rows = [
      ['Дата', 'Событие', 'Выбор', 'Коэф.', 'Ставка', 'Статус', 'P&L', 'Букмекер', 'Стратегия'],
      ...allBets.map((b) => {
        const pnl = b.status === 'won' ? Math.round(b.stake * b.odds) - b.stake : b.status === 'lost' ? -b.stake : 0;
        return [b.date, b.event, b.pick, b.odds, (b.stake / 100).toFixed(2), b.status, (pnl / 100).toFixed(2), b.bookmaker, b.strategy];
      }),
    ];
    const csv = '﻿' + rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sharklog-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleClearData() {
    if (window.confirm('Очистить все данные? Это действие нельзя отменить.')) {
      clearAll();
    }
  }

  return (
    <div style={s.page}>
      <h1 style={s.title}>Настройки</h1>

      {/* Subscription */}
      <div style={s.card}>
        <div style={s.cardTitle}>Подписка</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, color: settings.isPro ? colors.gold : colors.textSecondary, fontWeight: 600 }}>
              {settings.isPro ? '👑 SharkLog Pro' : 'Free'}
            </div>
            <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 3 }}>
              {settings.isPro
                ? 'Все функции открыты'
                : `${Math.max(0, 50 - bets.length)} ставок осталось`}
            </div>
          </div>
          {!settings.isPro && (
            <button style={s.proBtn} onClick={() => updateSettings({ isPro: true })}>
              👑 Попробовать Pro
            </button>
          )}
          {settings.isPro && (
            <button style={{ ...s.proBtn, backgroundColor: colors.bgElevated, color: colors.textMuted }} onClick={() => updateSettings({ isPro: false })}>
              Отключить (dev)
            </button>
          )}
        </div>
      </div>

      {/* Tilt control */}
      <div style={s.card}>
        <div style={s.cardTitle}>Тилт-контроль</div>
        <div style={s.row}>
          <span style={s.rowLabel}>Порог тилт-алерта</span>
          <span style={s.rowValue}>
            {settings.isPro
              ? `${settings.tiltThreshold} поражений`
              : `${FREE_LIMITS.TILT_ALERT_THRESHOLD} (Free, не настраивается)`}
          </span>
        </div>
      </div>

      {/* Bookmakers */}
      <div style={s.card}>
        <div style={s.cardTitle}>Букмекеры</div>
        {settings.bookmakers.map((bk) => (
          <div key={bk} style={s.row}>
            <span style={s.rowLabel}>{bk}</span>
            <button style={s.removeBtn} onClick={() => removeBookmaker(bk)}>Удалить</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            style={{ ...s.input, flex: 1 }}
            placeholder="Добавить букмекера..."
            value={newBk}
            onChange={(e) => setNewBk(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addBookmaker()}
          />
          <button style={s.addBtn} onClick={addBookmaker}>+</button>
        </div>
      </div>

      {/* Data & Export */}
      <div style={s.card}>
        <div style={s.cardTitle}>Данные и экспорт</div>
        <div style={s.row}>
          <span style={s.rowLabel}>Всего ставок</span>
          <span style={s.rowValue}>{bets.length}</span>
        </div>
        <div style={s.row}>
          <span style={s.rowLabel}>Хранилище</span>
          <span style={s.rowValue}>localStorage</span>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button style={{ ...s.exportBtn, backgroundColor: colors.accent + '22', color: colors.accent, border: `1px solid ${colors.accent}44` }} onClick={handleExportCSV}>
            📥 Экспорт CSV
          </button>
          <button style={{ ...s.exportBtn, backgroundColor: colors.purple + '22', color: colors.purple, border: `1px solid ${colors.purple}44` }} onClick={handleExportJSON}>
            💾 Резервная копия JSON
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div style={{ ...s.card, borderColor: colors.lost + '44' }}>
        <div style={s.cardTitle}>Опасная зона</div>
        <button style={s.dangerBtn} onClick={handleClearData}>
          Очистить все данные
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', flex: 1, overflow: 'auto' },
  title: { fontSize: 28, fontWeight: 700, color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 24 },
  card: { backgroundColor: colors.bgCard, borderRadius: 14, padding: 20, border: `1px solid ${colors.border}`, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 14 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${colors.border}` },
  rowLabel: { fontSize: 14, color: colors.textPrimary },
  rowValue: { fontSize: 14, color: colors.textSecondary },
  removeBtn: { background: 'none', border: 'none', color: colors.lost, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  input: { backgroundColor: colors.bgElevated, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '8px 12px', color: colors.textPrimary, fontSize: 14, outline: 'none' },
  addBtn: { backgroundColor: colors.purple, color: '#fff', border: 'none', borderRadius: 8, width: 40, fontSize: 20, cursor: 'pointer', fontWeight: 700 },
  proBtn: { backgroundColor: colors.gold, color: '#000', border: 'none', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  exportBtn: { borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  dangerBtn: { background: 'none', border: 'none', color: colors.lost, cursor: 'pointer', fontSize: 15, fontWeight: 600, padding: '4px 0' },
};
