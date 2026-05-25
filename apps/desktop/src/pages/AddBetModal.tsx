import React, { useState, useMemo } from 'react';
import type { Sport, BetType, Strategy, BetStatus, EsportsDiscipline, Team } from '@sharklog/core';
import {
  SPORTS, BET_TYPES, STRATEGIES, ESPORTS_DISCIPLINES,
  parseMoneyInput, formatMoney, CURRENT_SCHEMA_VERSION, FREE_LIMITS,
  impliedProbability, expectedValue, halfKelly, recommendedStake,
} from '@sharklog/core';
import type { Bet } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';
import { ChecklistModal } from '../components/ChecklistModal';
import { colors } from '../theme/colors';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface Props {
  editBet?: Bet;
  onClose: () => void;
}

function Field({ label, error, children }: { label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <div style={f.container}>
      <label style={f.label}>{label}</label>
      {children}
      {error && <span style={f.error}>{error}</span>}
    </div>
  );
}
const f: Record<string, React.CSSProperties> = {
  container: { marginBottom: 14 },
  label: { display: 'block', fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  error: { display: 'block', fontSize: 11, color: colors.lost, marginTop: 3 },
};

const inputStyle: React.CSSProperties = {
  width: '100%', backgroundColor: colors.bgElevated, border: `1px solid ${colors.border}`,
  borderRadius: 8, padding: '9px 12px', color: colors.textPrimary, fontSize: 14, outline: 'none',
  boxSizing: 'border-box',
};

function SegmentRow<T extends string>({
  options, value, onChange,
}: { options: Array<{ key: T; label: string }>; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          style={{
            padding: '6px 11px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
            border: `1px solid ${value === opt.key ? colors.purple : colors.border}`,
            backgroundColor: value === opt.key ? colors.purple : colors.bgElevated,
            color: value === opt.key ? '#fff' : colors.textSecondary,
            fontWeight: value === opt.key ? 700 : 400,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function TeamAutocomplete({
  value, onChange, sport, discipline,
}: { value: string; onChange: (v: string) => void; sport: Sport; discipline: EsportsDiscipline }) {
  const teams = useBetsStore((s) => s.teams);
  const [focused, setFocused] = useState(false);

  const vsParts = value.split(' vs ');
  const hasVs = vsParts.length >= 2;
  const activePart = (vsParts[vsParts.length - 1] ?? '').trimStart();
  const prefix = hasVs ? vsParts.slice(0, -1).join(' vs ') + ' vs ' : '';

  const suggestions = useMemo<Team[]>(() => {
    if (!focused || activePart.length < 1) return [];
    return teams
      .filter((t) => {
        if (t.sport !== sport) return false;
        if (sport === 'esports' && t.discipline && t.discipline !== discipline) return false;
        return t.name.toLowerCase().includes(activePart.toLowerCase());
      })
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 6);
  }, [teams, activePart, sport, discipline, focused]);

  return (
    <div style={{ position: 'relative' }}>
      <input
        style={inputStyle}
        placeholder="NaVi vs Virtus.pro"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
      />
      {focused && suggestions.length > 0 && (
        <div style={ac.dropdown}>
          {suggestions.map((team) => (
            <div
              key={team.id}
              style={ac.item}
              onMouseDown={() => onChange(hasVs ? prefix + team.name : prefix + team.name + ' vs ')}
            >
              <span style={ac.name}>{team.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {team.discipline && (
                  <span style={ac.badge}>{ESPORTS_DISCIPLINES[team.discipline]}</span>
                )}
                <span style={ac.count}>{team.usageCount}×</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ac: Record<string, React.CSSProperties> = {
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
    backgroundColor: colors.bgCard, border: `1px solid ${colors.border}`,
    borderRadius: 8, marginTop: 4, overflow: 'hidden',
  },
  item: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '9px 12px', cursor: 'pointer', borderBottom: `1px solid ${colors.border}`,
  },
  name: { fontSize: 13, color: colors.textPrimary },
  badge: {
    fontSize: 10, color: colors.purple,
    backgroundColor: colors.purpleDim, padding: '2px 6px', borderRadius: 5,
  },
  count: { fontSize: 11, color: colors.textMuted },
};

function KellyHelper({ odds, bankKopecks, onApply }: {
  odds: number;
  bankKopecks: number;
  onApply: (roubles: string) => void;
}) {
  const [prob, setProb] = useState(0.5);
  const implied = impliedProbability(odds);
  const ev = expectedValue(odds, prob);
  const kellyPct = halfKelly(odds, prob) * 100;
  const stake = bankKopecks > 0 ? recommendedStake(bankKopecks, odds, prob) : 0;

  function step(dir: 1 | -1) {
    setProb((p) => Math.min(0.95, Math.max(0.05, Math.round((p + dir * 0.05) * 100) / 100)));
  }

  return (
    <div style={kl.container}>
      <div style={kl.impliedRow}>
        <span style={kl.impliedLabel}>Имплицитная вероятность букмекера</span>
        <span style={kl.impliedValue}>{(implied * 100).toFixed(1)}%</span>
      </div>
      <div style={kl.stepRow}>
        <span style={kl.stepLabel}>Моя оценка</span>
        <div style={kl.stepper}>
          <button type="button" style={kl.stepBtn} onClick={() => step(-1)}>−</button>
          <span style={kl.stepValue}>{(prob * 100).toFixed(0)}%</span>
          <button type="button" style={kl.stepBtn} onClick={() => step(1)}>+</button>
        </div>
      </div>
      <div style={kl.resultsRow}>
        <div style={kl.resultCell}>
          <span style={{ ...kl.resultValue, color: ev > 0 ? colors.won : colors.lost }}>
            {ev >= 0 ? '+' : ''}{(ev * 100).toFixed(1)}%
          </span>
          <span style={kl.resultLabel}>EV</span>
        </div>
        <div style={kl.resultCell}>
          <span style={kl.resultValue}>{kellyPct.toFixed(1)}%</span>
          <span style={kl.resultLabel}>Half-Kelly</span>
        </div>
        <div style={kl.resultCell}>
          <span style={{ ...kl.resultValue, color: stake > 0 ? colors.accent : colors.textMuted }}>
            {stake > 0 ? formatMoney(stake) : '—'}
          </span>
          <span style={kl.resultLabel}>Рек. ставка</span>
        </div>
      </div>
      {stake > 0 && (
        <button type="button" style={kl.applyBtn} onClick={() => onApply(String(stake / 100))}>
          Применить {formatMoney(stake)}
        </button>
      )}
    </div>
  );
}

const kl: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: colors.bgElevated, borderRadius: 10, padding: 14,
    marginBottom: 14, border: `1px solid ${colors.border}`,
  },
  impliedRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  impliedLabel: { fontSize: 12, color: colors.textMuted },
  impliedValue: { fontSize: 13, fontWeight: 600, color: colors.textSecondary },
  stepRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  stepLabel: { fontSize: 13, color: colors.textPrimary, fontWeight: 500 },
  stepper: { display: 'flex', alignItems: 'center', gap: 10 },
  stepBtn: {
    width: 30, height: 30, borderRadius: 7, backgroundColor: colors.bgCard,
    border: `1px solid ${colors.border}`, fontSize: 16, color: colors.textPrimary, cursor: 'pointer',
  },
  stepValue: { fontSize: 16, fontWeight: 700, color: colors.textPrimary, minWidth: 44, textAlign: 'center' as const },
  resultsRow: { display: 'flex', justifyContent: 'space-around', marginBottom: 10 },
  resultCell: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 },
  resultValue: { fontSize: 16, fontWeight: 700, color: colors.textPrimary },
  resultLabel: { fontSize: 10, color: colors.textMuted },
  applyBtn: {
    width: '100%', backgroundColor: colors.accentDim, border: `1px solid ${colors.accent}66`,
    borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 700, color: colors.accent, cursor: 'pointer',
  },
};

export function AddBetModal({ editBet, onClose }: Props) {
  const { addBet, updateBet, settings, bankroll, canAddBet } = useBetsStore();
  const now = new Date();
  const defaultDate = now.toISOString().split('T')[0] ?? '';
  const defaultTime = now.toTimeString().slice(0, 5);

  const [event, setEvent] = useState(editBet?.event ?? '');
  const [pick, setPick] = useState(editBet?.pick ?? '');
  const [odds, setOdds] = useState(editBet ? String(editBet.odds) : '');
  const [stake, setStake] = useState(editBet ? String(editBet.stake / 100) : '');
  const [date, setDate] = useState(editBet?.date ?? defaultDate);
  const [time, setTime] = useState(editBet?.time ?? defaultTime);
  const [sport, setSport] = useState<Sport>(editBet?.sport ?? 'football');
  const [discipline, setDiscipline] = useState<EsportsDiscipline>(editBet?.discipline ?? 'csgo');
  const [betType, setBetType] = useState<BetType>(editBet?.betType ?? '1X2');
  const [strategy, setStrategy] = useState<Strategy>(editBet?.strategy ?? 'value');
  const [status, setStatus] = useState<BetStatus>(editBet?.status ?? 'pending');
  const [bookmaker, setBookmaker] = useState(editBet?.bookmaker ?? (settings.bookmakers[0] ?? ''));
  const [notes, setNotes] = useState(editBet?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [kellyOpen, setKellyOpen] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);

  const oddsNum = parseFloat(odds);
  const stakeKopecks = parseMoneyInput(stake);
  const potentialWin = oddsNum > 1 && stakeKopecks > 0
    ? formatMoney(Math.round(stakeKopecks * oddsNum))
    : null;

  function validate() {
    const e: Record<string, string> = {};
    if (!event.trim()) e['event'] = 'Введи название события';
    if (!pick.trim()) e['pick'] = 'Укажи выбор';
    if (isNaN(oddsNum) || oddsNum <= 1) e['odds'] = 'Коэффициент должен быть больше 1';
    if (stakeKopecks <= 0) e['stake'] = 'Укажи сумму ставки';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editBet && !canAddBet()) return;
    if (!validate()) return;
    if (!editBet && settings.isPro) {
      setShowChecklist(true);
      return;
    }
    doSave();
  }

  function doSave() {
    const extras = {
      ...(sport === 'esports' ? { discipline } : {}),
      ...(notes ? { notes } : {}),
    };
    if (editBet) {
      updateBet(editBet.id, { event, pick, odds: oddsNum, stake: stakeKopecks, sport, betType, strategy, status, bookmaker, date: date || defaultDate, time: time || defaultTime, ...extras });
    } else {
      addBet({
        id: uuid(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        date: date || defaultDate,
        time: time || defaultTime,
        event, pick, odds: oddsNum, stake: stakeKopecks, sport,
        betType, strategy, status, bookmaker, schemaVersion: CURRENT_SCHEMA_VERSION,
        ...extras,
      });
    }
    onClose();
  }

  const sportOptions = Object.entries(SPORTS).map(([k, v]) => ({ key: k as Sport, label: v }));
  const discOptions = Object.entries(ESPORTS_DISCIPLINES).map(([k, v]) => ({ key: k as EsportsDiscipline, label: v }));
  const betTypeOptions = Object.entries(BET_TYPES).map(([k, v]) => ({ key: k as BetType, label: v }));
  const strategyOptions = Object.entries(STRATEGIES).map(([k, v]) => ({ key: k as Strategy, label: v }));

  return (
    <>
      {showChecklist && (
        <ChecklistModal
          onConfirm={() => { setShowChecklist(false); doSave(); }}
          onCancel={() => setShowChecklist(false)}
        />
      )}
    <div className="sl-overlay" style={m.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sl-modal" style={m.modal}>
        <div style={m.modalHeader}>
          <h2 style={m.modalTitle}>{editBet ? 'Редактировать ставку' : 'Новая ставка'}</h2>
          <button style={m.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={m.body}>
          {!editBet && !canAddBet() && (
            <div style={m.limitBanner}>
              🔒 Лимит {FREE_LIMITS.MAX_BETS} ставок достигнут. Перейди на Pro для безлимитного трекинга.
            </div>
          )}
          <Field label="Событие *" {...(errors['event'] ? { error: errors['event'] } : {})}>
            <TeamAutocomplete value={event} onChange={setEvent} sport={sport} discipline={discipline} />
          </Field>

          <Field label="Выбор *" {...(errors['pick'] ? { error: errors['pick'] } : {})}>
            <input style={inputStyle} placeholder="П1, ТБ 2.5, Ф1(-1.5)..." value={pick} onChange={(e) => setPick(e.target.value)} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Коэффициент *" {...(errors['odds'] ? { error: errors['odds'] } : {})}>
              <input style={inputStyle} placeholder="1.85" type="number" step="0.01" value={odds} onChange={(e) => setOdds(e.target.value)} />
            </Field>
            <Field label="Сумма (₽) *" {...(errors['stake'] ? { error: errors['stake'] } : {})}>
              <input style={inputStyle} placeholder="1000" type="number" value={stake} onChange={(e) => setStake(e.target.value)} />
            </Field>
          </div>

          {oddsNum > 1 && (
            <button
              type="button"
              onClick={() => setKellyOpen((v) => !v)}
              style={{
                ...m.kellyToggle,
                ...(kellyOpen ? m.kellyToggleActive : {}),
              }}
            >
              📊 Калькулятор Келли {kellyOpen ? '▲' : '▼'}
            </button>
          )}

          {kellyOpen && oddsNum > 1 && (
            <KellyHelper
              odds={oddsNum}
              bankKopecks={bankroll.transactions.reduce((sum, t) => sum + (t.type === 'deposit' ? t.amount : -t.amount), 0)}
              onApply={(roubles) => setStake(roubles)}
            />
          )}

          {potentialWin && (
            <div style={m.winPreview}>
              <span style={{ color: colors.accent }}>Потенциальный выигрыш</span>
              <span style={{ color: colors.accent, fontWeight: 700, fontSize: 16 }}>{potentialWin}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 0 }}>
            <Field label="Дата">
              <input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Время">
              <input style={inputStyle} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>

          <Field label="Вид спорта">
            <SegmentRow options={sportOptions} value={sport} onChange={setSport} />
          </Field>

          {sport === 'esports' && (
            <Field label="Дисциплина">
              <SegmentRow options={discOptions} value={discipline} onChange={setDiscipline} />
            </Field>
          )}

          <Field label="Тип ставки">
            <SegmentRow options={betTypeOptions} value={betType} onChange={setBetType} />
          </Field>

          <Field label="Стратегия">
            <SegmentRow options={strategyOptions} value={strategy} onChange={setStrategy} />
          </Field>

          <Field label="Букмекер">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {settings.bookmakers.map((bk) => (
                <button key={bk} type="button" onClick={() => setBookmaker(bk)} style={{
                  padding: '6px 11px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                  border: `1px solid ${bookmaker === bk ? colors.purple : colors.border}`,
                  backgroundColor: bookmaker === bk ? colors.purple : colors.bgElevated,
                  color: bookmaker === bk ? '#fff' : colors.textSecondary,
                  fontWeight: bookmaker === bk ? 700 : 400,
                }}>
                  {bk}
                </button>
              ))}
            </div>
          </Field>

          {editBet && (
            <Field label="Статус">
              <SegmentRow
                options={[
                  { key: 'pending' as BetStatus, label: 'Ожидание' },
                  { key: 'won' as BetStatus, label: 'Победа' },
                  { key: 'lost' as BetStatus, label: 'Проигрыш' },
                  { key: 'refund' as BetStatus, label: 'Возврат' },
                ]}
                value={status}
                onChange={setStatus}
              />
            </Field>
          )}

          <Field label="Заметки">
            <textarea
              style={{ ...inputStyle, height: 72, resize: 'vertical' }}
              placeholder="Анализ, причины выбора..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>

          <button type="submit" style={m.submitBtn}>
            {editBet ? 'Сохранить изменения' : 'Добавить ставку'}
          </button>
        </form>
      </div>
    </div>
    </>
  );
}

const m: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    paddingTop: 40, zIndex: 1000, overflowY: 'auto',
  },
  modal: {
    backgroundColor: colors.bgCard, borderRadius: 16, width: 580,
    border: `1px solid ${colors.border}`, marginBottom: 40,
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 24px', borderBottom: `1px solid ${colors.border}`,
  },
  modalTitle: { fontSize: 18, fontWeight: 700, color: colors.textPrimary },
  closeBtn: { background: 'none', border: 'none', color: colors.textMuted, fontSize: 18, cursor: 'pointer' },
  body: { padding: 24 },
  limitBanner: {
    backgroundColor: colors.lost + '15', border: `1px solid ${colors.lost}44`,
    borderRadius: 8, padding: '10px 14px', marginBottom: 14,
    color: colors.lost, fontSize: 13, fontWeight: 600,
  },
  winPreview: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.accentDim, borderRadius: 8, padding: '10px 14px', marginBottom: 14,
  },
  kellyToggle: {
    width: '100%', backgroundColor: 'transparent', border: `1px solid ${colors.border}`,
    borderRadius: 8, padding: '8px 0', fontSize: 13, color: colors.textSecondary,
    cursor: 'pointer', marginBottom: 10, textAlign: 'center' as const,
  },
  kellyToggleActive: { borderColor: colors.accent + '66', backgroundColor: colors.accentDim, color: colors.accent },
  submitBtn: {
    width: '100%', backgroundColor: colors.purple, color: '#fff', border: 'none',
    borderRadius: 10, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4,
  },
};
