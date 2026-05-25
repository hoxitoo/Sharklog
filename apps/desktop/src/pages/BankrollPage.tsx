import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { calcDashboard, formatMoney, kellyFraction, expectedValue, impliedProbability } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';
import { colors } from '../theme/colors';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function KellyCalc({ bankroll }: { bankroll: number }) {
  const [odds, setOdds] = useState('');
  const [prob, setProb] = useState('');
  const oddsNum = parseFloat(odds);
  const probNum = parseFloat(prob) / 100;
  const kelly = !isNaN(oddsNum) && !isNaN(probNum) ? kellyFraction(oddsNum, probNum) : null;
  const ev = !isNaN(oddsNum) && !isNaN(probNum) ? expectedValue(oddsNum, probNum) : null;
  const implied = !isNaN(oddsNum) ? impliedProbability(oddsNum) * 100 : null;
  const halfStake = kelly !== null && bankroll > 0 ? Math.round((kelly / 2) * bankroll) : null;

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>Калькулятор Келли</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={s.label}>Коэффициент</label>
          <input style={s.input} placeholder="2.10" type="number" step="0.01" value={odds} onChange={(e) => setOdds(e.target.value)} />
          {implied !== null && <span style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, display: 'block' }}>Implied: {implied.toFixed(1)}%</span>}
        </div>
        <div>
          <label style={s.label}>Твоя вероятность %</label>
          <input style={s.input} placeholder="55" type="number" value={prob} onChange={(e) => setProb(e.target.value)} />
        </div>
      </div>
      {ev !== null && (
        <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 14 }}>
          <Row label="Expected Value" value={`${ev >= 0 ? '+' : ''}${(ev * 100).toFixed(1)}% ${ev >= 0 ? '✅' : '❌'}`} color={ev >= 0 ? colors.won : colors.lost} />
          <Row label="Full Kelly" value={`${((kelly ?? 0) * 100).toFixed(1)}% банка`} />
          <Row label="½ Kelly (рекомендовано)" value={halfStake !== null ? formatMoney(halfStake) : '—'} color={colors.accent} />
        </div>
      )}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
      <span style={{ fontSize: 13, color: colors.textSecondary }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: color ?? colors.textPrimary }}>{value}</span>
    </div>
  );
}

export function BankrollPage() {
  const { bets, bankroll, updateBankroll, updateSettings, settings } = useBetsStore();
  const stats = calcDashboard(bets);
  const [depositInput, setDepositInput] = useState('');
  const [withdrawInput, setWithdrawInput] = useState('');

  const deposited = bankroll.transactions.filter((t) => t.type === 'deposit').reduce((a, t) => a + t.amount, 0);
  const withdrawn = bankroll.transactions.filter((t) => t.type === 'withdrawal').reduce((a, t) => a + t.amount, 0);
  const currentBank = deposited - withdrawn + stats.pnl;
  const unit = Math.round(currentBank * bankroll.unitPercent / 100);

  const equityCurve = useMemo(() => {
    const events: Array<{ date: string; delta: number }> = [];
    for (const tx of bankroll.transactions) {
      const date = tx.date.split('T')[0] ?? tx.date;
      events.push({ date, delta: tx.type === 'deposit' ? tx.amount : -tx.amount });
    }
    for (const bet of bets) {
      if (bet.status === 'pending') continue;
      const pnl = bet.status === 'won' ? Math.round(bet.stake * bet.odds) - bet.stake
        : bet.status === 'lost' ? -bet.stake : 0;
      events.push({ date: bet.date, delta: pnl });
    }
    if (events.length < 2) return [];
    const byDate = new Map<string, number>();
    for (const e of events) byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.delta);
    let balance = 0;
    return [...byDate.keys()].sort().map((date) => {
      balance += byDate.get(date) ?? 0;
      return { date, value: balance / 100 };
    });
  }, [bets, bankroll.transactions]);

  if (!settings.isPro) {
    return (
      <div style={s.page}>
        <h1 style={s.title}>Банкролл</h1>
        <div style={s.gate}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👑</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: colors.gold, marginBottom: 8 }}>Функция PRO</div>
          <div style={{ color: colors.textSecondary, marginBottom: 24 }}>Банкролл-трекер и калькулятор Келли доступны в подписке</div>
          <button style={s.proBtn} onClick={() => updateSettings({ isPro: true })}>Попробовать Pro — 7 дней бесплатно</button>
        </div>
      </div>
    );
  }

  function addTransaction(type: 'deposit' | 'withdrawal', inputVal: string) {
    const amount = Math.round(parseFloat(inputVal.replace(',', '.')) * 100);
    if (isNaN(amount) || amount <= 0) return;
    updateBankroll({
      transactions: [
        ...bankroll.transactions,
        { id: uuid(), type, amount, date: new Date().toISOString() },
      ],
    });
    if (type === 'deposit') setDepositInput('');
    else setWithdrawInput('');
  }

  const pnlPositive = stats.pnl >= 0;

  return (
    <div style={s.page}>
      <h1 style={s.title}>Банкролл</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Summary */}
        <div style={s.card}>
          <div style={s.label}>Текущий банк</div>
          <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: currentBank >= 0 ? colors.textPrimary : colors.lost, margin: '8px 0 16px' }}>
            {formatMoney(currentBank)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            <div>
              <div style={s.metaLabel}>Внесено</div>
              <div style={s.metaValue}>{formatMoney(deposited)}</div>
            </div>
            <div>
              <div style={s.metaLabel}>P&L</div>
              <div style={{ ...s.metaValue, color: stats.pnl >= 0 ? colors.won : colors.lost }}>
                {stats.pnl >= 0 ? '+' : ''}{formatMoney(stats.pnl)}
              </div>
            </div>
            <div>
              <div style={s.metaLabel}>1 юнит</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <button
                  style={{ ...s.stepBtn, opacity: bankroll.unitPercent <= 0.5 ? 0.4 : 1 }}
                  onClick={() => updateBankroll({ unitPercent: Math.max(0.5, Math.round((bankroll.unitPercent - 0.5) * 10) / 10) })}
                  disabled={bankroll.unitPercent <= 0.5}
                >−</button>
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.accent, minWidth: 44, textAlign: 'center' }}>
                  {bankroll.unitPercent}% · {formatMoney(unit)}
                </span>
                <button
                  style={{ ...s.stepBtn, opacity: bankroll.unitPercent >= 10 ? 0.4 : 1 }}
                  onClick={() => updateBankroll({ unitPercent: Math.min(10, Math.round((bankroll.unitPercent + 0.5) * 10) / 10) })}
                  disabled={bankroll.unitPercent >= 10}
                >+</button>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...s.input, flex: 1 }} placeholder="Пополнить ₽" type="number" value={depositInput} onChange={(e) => setDepositInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTransaction('deposit', depositInput)} />
            <button style={{ ...s.actionBtn, backgroundColor: colors.accent }} onClick={() => addTransaction('deposit', depositInput)}>+ Пополнить</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input style={{ ...s.input, flex: 1 }} placeholder="Вывести ₽" type="number" value={withdrawInput} onChange={(e) => setWithdrawInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTransaction('withdrawal', withdrawInput)} />
            <button style={{ ...s.actionBtn, backgroundColor: colors.lost }} onClick={() => addTransaction('withdrawal', withdrawInput)}>− Вывести</button>
          </div>
        </div>

        <KellyCalc bankroll={currentBank} />
      </div>

      {/* Equity curve */}
      {equityCurve.length >= 2 && (
        <div style={{ ...s.card, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={s.cardTitle}>Кривая банкролла</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: pnlPositive ? colors.won : colors.lost }}>
              {pnlPositive ? '+' : ''}{formatMoney(stats.pnl)}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={equityCurve}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={pnlPositive ? colors.accent : colors.lost} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={pnlPositive ? colors.accent : colors.lost} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
              <XAxis dataKey="date" hide />
              <YAxis tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}₽`} />
              <Tooltip
                contentStyle={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 8 }}
                formatter={(v: number) => [`${v.toFixed(0)} ₽`, 'Банк']}
                labelStyle={{ color: colors.textMuted }}
              />
              <Area type="monotone" dataKey="value" stroke={pnlPositive ? colors.accent : colors.lost} strokeWidth={2} fill="url(#eqGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Transaction history */}
      {bankroll.transactions.length > 0 && (
        <div style={s.card}>
          <div style={s.cardTitle}>История транзакций</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Дата', 'Тип', 'Сумма', ''].map((h) => (
                  <th key={h} style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, padding: '0 0 8px', textAlign: 'left', borderBottom: `1px solid ${colors.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...bankroll.transactions].reverse().map((t) => (
                <tr key={t.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <td style={{ padding: '10px 0', fontSize: 13, color: colors.textMuted }}>{new Date(t.date).toLocaleDateString('ru-RU')}</td>
                  <td style={{ padding: '10px 0', fontSize: 13, color: colors.textPrimary }}>{t.type === 'deposit' ? '↑ Пополнение' : '↓ Вывод'}</td>
                  <td style={{ padding: '10px 0', fontSize: 14, fontWeight: 700, color: t.type === 'deposit' ? colors.won : colors.lost }}>
                    {t.type === 'deposit' ? '+' : '-'}{formatMoney(t.amount)}
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right' }}>
                    <button
                      style={{ background: 'none', border: 'none', color: colors.lost, cursor: 'pointer', fontSize: 13, opacity: 0.6 }}
                      onClick={() => updateBankroll({ transactions: bankroll.transactions.filter((tx) => tx.id !== t.id) })}
                    >✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', flex: 1, overflow: 'auto' },
  title: { fontSize: 28, fontWeight: 700, color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 24 },
  card: { backgroundColor: colors.bgCard, borderRadius: 14, padding: 20, border: `1px solid ${colors.border}` },
  cardTitle: { fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 0 },
  label: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 4, display: 'block' },
  metaLabel: { fontSize: 11, color: colors.textMuted },
  metaValue: { fontSize: 15, fontWeight: 600, color: colors.textPrimary, marginTop: 3 },
  input: {
    backgroundColor: colors.bgElevated, border: `1px solid ${colors.border}`,
    borderRadius: 8, padding: '8px 12px', color: colors.textPrimary, fontSize: 14, outline: 'none',
  },
  actionBtn: { color: '#000', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const },
  stepBtn: { background: 'none', border: `1px solid ${colors.border}`, borderRadius: 6, width: 26, height: 26, fontSize: 16, color: colors.textPrimary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  gate: { textAlign: 'center' as const, paddingTop: 80 },
  proBtn: { backgroundColor: colors.purple, color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
};
