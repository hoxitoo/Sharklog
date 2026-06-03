import React, { useState } from 'react';
import { DEFAULT_BOOKMAKERS, FREE_LIMITS, SPORTS } from '@sharklog/core';
import type { Sport } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';
import { useToastStore } from '../store/toastStore';
import { ConfirmModal } from '../components/ConfirmModal';
import { colors } from '../theme/colors';
import { importFromCSV, importFromXLSX } from '../utils/importBets';

const IS_TAURI = typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;

export function SettingsPage() {
  const { settings, updateSettings, bets, teams, deleteTeam, clearAll } = useBetsStore();
  const toast = useToastStore((s) => s.show);
  const [newBk, setNewBk] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearMessage, setClearMessage] = useState('');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'latest' | 'error'>('idle');

  const daysSinceBackup = settings.lastBackupAt
    ? Math.floor((Date.now() - new Date(settings.lastBackupAt).getTime()) / 86_400_000)
    : null;
  const showBackupBanner = bets.length > 0 && (daysSinceBackup === null || daysSinceBackup > 30);

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
    updateSettings({ lastBackupAt: new Date().toISOString() });
    toast(`Резервная копия сохранена (${b.length} ставок)`, 'success');
  }

  function handleExportCSV() {
    const { bets: allBets } = useBetsStore.getState();
    const rows = [
      ['Дата', 'Событие', 'Выбор', 'Коэф.', 'Ставка', 'Статус', 'P&L', 'Букмекер', 'Стратегия', 'Спорт', 'Тип ставки', 'Заметка'],
      ...allBets.map((b) => {
        const pnl = b.status === 'won' ? Math.round(b.stake * b.odds) - b.stake : b.status === 'lost' ? -b.stake : 0;
        return [b.date, b.event, b.pick, b.odds, (b.stake / 100).toFixed(2), b.status, (pnl / 100).toFixed(2), b.bookmaker, b.strategy, b.sport, b.betType, b.notes ?? ''];
      }),
    ];
    const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
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
      if (file.size > 10 * 1024 * 1024) { toast('Файл слишком большой (максимум 10 МБ)', 'error'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string);
          if (!parsed || typeof parsed !== 'object') throw new Error('Bad format');
          const store = useBetsStore.getState();
          // Strip isPro and proExpiresAt — subscription state must not be imported from a file
          const { isPro: _ip, proExpiresAt: _pe, ...importedSettings } = parsed.settings ?? {};
          useBetsStore.setState({
            ...(parsed.bets ? { bets: parsed.bets } : {}),
            ...(parsed.settings ? { settings: { ...store.settings, ...importedSettings } } : {}),
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

  function handleImportCSV() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { toast('Файл слишком большой (максимум 10 МБ)', 'error'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const result = importFromCSV(reader.result as string);
          if (result.bets.length === 0) { toast('Не найдено ни одной корректной ставки в файле.', 'error'); return; }
          const store = useBetsStore.getState();
          const existingIds = new Set(store.bets.map((b) => b.id));
          const newBets = result.bets.filter((b) => !existingIds.has(b.id));
          useBetsStore.setState({ bets: [...store.bets, ...newBets] });
          store.persist();
          const skipped = result.skipped + (result.bets.length - newBets.length);
          toast(`Импортировано ${newBets.length} ставок${skipped > 0 ? `, пропущено ${skipped}` : ''}`, 'success');
        } catch {
          toast('Ошибка при чтении CSV файла.', 'error');
        }
      };
      reader.readAsText(file, 'utf-8');
    };
    input.click();
  }

  function handleImportXLSX() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { toast('Файл слишком большой (максимум 10 МБ)', 'error'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const result = importFromXLSX(reader.result as ArrayBuffer);
          if (result.bets.length === 0) { toast('Не найдено ни одной корректной ставки в файле.', 'error'); return; }
          const store = useBetsStore.getState();
          const existingIds = new Set(store.bets.map((b) => b.id));
          const newBets = result.bets.filter((b) => !existingIds.has(b.id));
          useBetsStore.setState({ bets: [...store.bets, ...newBets] });
          store.persist();
          const skipped = result.skipped + (result.bets.length - newBets.length);
          toast(`Импортировано ${newBets.length} ставок${skipped > 0 ? `, пропущено ${skipped}` : ''}`, 'success');
        } catch {
          toast('Ошибка при чтении Excel файла.', 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  }

  async function handleCheckUpdate() {
    if (!IS_TAURI) { toast('Проверка обновлений доступна только в Tauri-приложении', 'info'); return; }
    setUpdateStatus('checking');
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update?.available) {
        setUpdateStatus('available');
        toast(`Доступно обновление v${update.version}! Устанавливаем...`, 'info');
        await update.downloadAndInstall();
      } else {
        setUpdateStatus('latest');
        toast('У вас последняя версия SharkLog', 'success');
      }
    } catch (err) {
      const msg = String(err);
      // 404 = релиз ещё не опубликован, не ошибка приложения
      if (msg.includes('404') || msg.includes('Not Found') || msg.includes('failed to fetch')) {
        setUpdateStatus('latest');
        toast('У вас актуальная версия SharkLog', 'success');
      } else {
        setUpdateStatus('error');
        toast('Не удалось проверить обновления — нет сети или сервер недоступен', 'error');
      }
    }
  }

  function handleClearData() {
    const proNote = settings.isPro
      ? '\n\n⚠️ Подписка Pro на десктопе хранится локально — она будет сброшена вместе с данными. Активируй её снова через «Попробовать Pro».'
      : '';
    const backupNote = daysSinceBackup === null
      ? '\n\n💾 Ты ещё ни разу не делал резервную копию. Рекомендуем сначала нажать «Резервная копия JSON».'
      : '';
    setClearMessage(`Все ставки, банкролл, дневник и команды будут удалены НАВСЕГДА — без возможности восстановления.${proNote}${backupNote}`);
    setConfirmClear(true);
  }

  return (
    <div style={s.page}>
      {confirmClear && (
        <ConfirmModal
          message={clearMessage}
          confirmLabel="Очистить"
          onConfirm={() => { clearAll(); setConfirmClear(false); toast('Данные очищены', 'info'); }}
          onCancel={() => setConfirmClear(false)}
        />
      )}

      <h1 style={s.title}>Настройки</h1>

      {/* Backup banner */}
      {showBackupBanner && (
        <div style={s.backupBanner} onClick={handleExportJSON}>
          <span style={{ fontSize: 24 }}>💾</span>
          <div style={{ flex: 1 }}>
            <div style={s.backupBannerTitle}>
              {daysSinceBackup === null ? 'Резервная копия не создана' : `Последняя копия: ${daysSinceBackup} дн. назад`}
            </div>
            <div style={s.backupBannerSub}>
              Данные хранятся только на этом компьютере. Нажми чтобы сохранить резервную копию.
            </div>
          </div>
          <span style={{ fontSize: 18, color: colors.pending }}>→</span>
        </div>
      )}

      {/* Subscription */}
      <div style={s.card}>
        <div style={s.cardTitle}>Подписка</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, color: settings.isPro ? colors.gold : colors.textSecondary, fontWeight: 600 }}>
              {settings.isPro ? '👑 SharkLog Pro' : '🆓 Бесплатная версия'}
            </div>
            <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 3, maxWidth: 340, lineHeight: 1.4 }}>
              {settings.isPro
                ? 'Все функции открыты. Подписка на десктопе хранится локально — не забывай делать резервные копии.'
                : `До 50 ставок (осталось ${Math.max(0, 50 - bets.length)}). Купи Pro для неограниченного учёта.`}
            </div>
            {settings.isPro && settings.proExpiresAt && (
              <div style={{ fontSize: 12, color: colors.pending, marginTop: 4 }}>
                ⏰ Пробный период до {new Date(settings.proExpiresAt).toLocaleDateString('ru')}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            {!settings.isPro && (
              <button style={s.proBtn} onClick={() => {
                const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
                updateSettings({ isPro: true, proExpiresAt: expires });
              }}>
                👑 Попробовать Pro (7 дней)
              </button>
            )}
            {settings.isPro && import.meta.env.DEV && (
              <button style={{ ...s.proBtn, backgroundColor: colors.bgElevated, color: colors.textMuted }} onClick={() => updateSettings({ isPro: false })}>
                Отключить (dev)
              </button>
            )}
          </div>
        </div>
        <div style={{ fontSize: 12, color: colors.textMuted, paddingTop: 8, borderTop: `1px solid ${colors.border}`, lineHeight: 1.4 }}>
          💡 На десктопе Pro-статус хранится локально. При очистке данных он будет сброшен. Делай резервные копии регулярно.
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
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Экспорт</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <button style={{ ...s.exportBtn, backgroundColor: colors.accent + '22', color: colors.accent, border: `1px solid ${colors.accent}44` }} onClick={handleExportCSV}>
              📥 Экспорт CSV
            </button>
            <button style={{ ...s.exportBtn, backgroundColor: colors.purple + '22', color: colors.purple, border: `1px solid ${colors.purple}44` }} onClick={handleExportJSON}>
              💾 Резервная копия JSON
            </button>
          </div>
          <div style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Импорт</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button style={{ ...s.exportBtn, backgroundColor: colors.pending + '22', color: colors.pending, border: `1px solid ${colors.pending}44` }} onClick={handleImportCSV}>
              📊 Импорт CSV
            </button>
            <button style={{ ...s.exportBtn, backgroundColor: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44' }} onClick={handleImportXLSX}>
              📗 Импорт Excel (.xlsx)
            </button>
            <button style={{ ...s.exportBtn, backgroundColor: colors.pending + '22', color: colors.pending, border: `1px solid ${colors.pending}44` }} onClick={handleImportJSON}>
              📂 Восстановить из JSON
            </button>
          </div>
        </div>
      </div>

      {/* About / Updates */}
      <div style={s.card}>
        <div style={s.cardTitle}>О приложении</div>
        <div style={s.row}>
          <span style={s.rowLabel}>Версия</span>
          <span style={s.rowValue}>0.1.0</span>
        </div>
        <div style={{ ...s.row, borderBottom: 'none' }}>
          <span style={s.rowLabel}>Обновления</span>
          <button
            style={{ ...s.exportBtn, backgroundColor: colors.purple + '22', color: colors.purple, border: `1px solid ${colors.purple}44`, opacity: updateStatus === 'checking' ? 0.6 : 1 }}
            onClick={handleCheckUpdate}
            disabled={updateStatus === 'checking'}
          >
            {updateStatus === 'checking' ? '⏳ Проверяем...' : updateStatus === 'available' ? '⬇️ Устанавливаем...' : updateStatus === 'latest' ? '✅ Актуальная версия' : '🔄 Проверить обновления'}
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
  backupBanner: { display: 'flex', alignItems: 'center', gap: 14, backgroundColor: colors.pending + '18', border: `1px solid ${colors.pending}44`, borderRadius: 12, padding: '14px 18px', marginBottom: 16, cursor: 'pointer' },
  backupBannerTitle: { fontSize: 14, fontWeight: 700, color: colors.pending, marginBottom: 2 },
  backupBannerSub: { fontSize: 12, color: colors.textSecondary, lineHeight: 1.4 },
};
