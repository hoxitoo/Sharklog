import React, { useState } from 'react';
import { DEFAULT_BOOKMAKERS, FREE_LIMITS, SPORTS } from '@sharklog/core';
import type { Sport } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';
import { useToastStore } from '../store/toastStore';
import { ConfirmModal } from '../components/ConfirmModal';
import { colors } from '../theme/colors';

export function SettingsPage() {
  const { settings, updateSettings, bets, teams, deleteTeam, clearAll } = useBetsStore();
  const toast = useToastStore((s) => s.show);
  const [newBk, setNewBk] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

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
    const { bets: b, settings: s, bankroll, diary, teams: t } = useBetsStore.getState();
    const blob = new Blob([JSON.stringify({ bets: b, settings: s, bankroll, diary, teams: t }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sharklog-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Резервная копия сохранена (${b.length} ставок)`, 'success');
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
    toast(`CSV экспортирован (${allBets.length} ставок)`, 'success');
  }

  function handleImportJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string);
          if (!parsed || typeof parsed !== 'object') throw new Error('Bad format');
          const store = useBetsStore.getState();
          useBetsStore.setState({
            ...(parsed.bets ? { bets: parsed.bets } : {}),
            ...(parsed.settings ? { settings: { ...store.settings, ...parsed.settings } } : {}),
            ...(parsed.bankroll ? { bankroll: parsed.bankroll } : {}),
            ...(parsed.diary ? { diary: parsed.diary } : {}),
            ...(parsed.teams ? { teams: parsed.teams } : {}),
          });
          store.persist();
          toast('Данные восстановлены успешно!', 'success');
        } catch {
          toast('Ошибка: файл повреждён или неверный формат.', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function handleClearData() {
    setConfirmClear(true);
  }

  return (
    <div style={s.page}>
      {confirmClear && (
        <ConfirmModal
          message="Очистить все данные? Это действие нельзя отменить."
          confirmLabel="Очистить"
          onConfirm={() => { clearAll(); setConfirmClear(false); toast('Данные очищены', 'info'); }}
          onCancel={() => setConfirmClear(false)}
        />
      )}

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
          <div>
            <span style={s.rowLabel}>Порог тилт-алерта</span>
            {!settings.isPro && <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>PRO — настраивается</div>}
          </div>
          {settings.isPro ? (
            <div style={s.stepper}>
              <button style={s.stepBtn} onClick={() => updateSettings({ tiltThreshold: Math.max(2, settings.tiltThreshold - 1) })}>−</button>
              <span style={s.stepVal}>{settings.tiltThreshold} поражений</span>
              <button style={s.stepBtn} onClick={() => updateSettings({ tiltThreshold: Math.min(10, settings.tiltThreshold + 1) })}>+</button>
            </div>
          ) : (
            <span style={s.rowValue}>{FREE_LIMITS.TILT_ALERT_THRESHOLD} (фикс.)</span>
          )}
        </div>
        <div style={{ ...s.row, borderBottom: 'none' }}>
          <div>
            <span style={s.rowLabel}>Дневной лимит ставок</span>
            {!settings.isPro && <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>PRO — настраивается</div>}
          </div>
          {settings.isPro ? (
            <div style={s.stepper}>
              <button style={s.stepBtn} onClick={() => updateSettings({ dailyBetLimit: Math.max(0, settings.dailyBetLimit - 1) })}>−</button>
              <span style={s.stepVal}>{settings.dailyBetLimit === 0 ? '∞ без лимита' : `${settings.dailyBetLimit} в день`}</span>
              <button style={s.stepBtn} onClick={() => updateSettings({ dailyBetLimit: Math.min(20, settings.dailyBetLimit + 1) })}>+</button>
            </div>
          ) : (
            <span style={s.rowValue}>—</span>
          )}
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

      {/* Teams */}
      {teams.length > 0 && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={s.cardTitle}>Сохранённые команды</div>
            <span style={{ fontSize: 12, color: colors.textMuted }}>{teams.length} команд</span>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {[...teams].sort((a, b) => b.usageCount - a.usageCount).map((team) => (
              <div key={team.id} style={s.row}>
                <div>
                  <span style={s.rowLabel}>{team.name}</span>
                  <span style={{ fontSize: 11, color: colors.textMuted, marginLeft: 8 }}>
                    {SPORTS[team.sport as Sport] ?? team.sport}
                    {team.discipline ? ` · ${team.discipline}` : ''}
                    {' · '}{team.usageCount}×
                  </span>
                </div>
                <button style={s.removeBtn} onClick={() => deleteTeam(team.id)}>Удалить</button>
              </div>
            ))}
          </div>
        </div>
      )}

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
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <button style={{ ...s.exportBtn, backgroundColor: colors.accent + '22', color: colors.accent, border: `1px solid ${colors.accent}44` }} onClick={handleExportCSV}>
            📥 Экспорт CSV
          </button>
          <button style={{ ...s.exportBtn, backgroundColor: colors.purple + '22', color: colors.purple, border: `1px solid ${colors.purple}44` }} onClick={handleExportJSON}>
            💾 Резервная копия JSON
          </button>
          <button style={{ ...s.exportBtn, backgroundColor: colors.pending + '22', color: colors.pending, border: `1px solid ${colors.pending}44` }} onClick={handleImportJSON}>
            📂 Восстановить из JSON
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
  stepper: { display: 'flex', alignItems: 'center', gap: 8 },
  stepBtn: { background: 'none', border: `1px solid ${colors.border}`, borderRadius: 6, width: 28, height: 28, fontSize: 16, color: colors.textPrimary, cursor: 'pointer' },
  stepVal: { fontSize: 14, fontWeight: 600, color: colors.textPrimary, minWidth: 120, textAlign: 'center' as const },
  proBtn: { backgroundColor: colors.gold, color: '#000', border: 'none', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  exportBtn: { borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  dangerBtn: { background: 'none', border: 'none', color: colors.lost, cursor: 'pointer', fontSize: 15, fontWeight: 600, padding: '4px 0' },
};
