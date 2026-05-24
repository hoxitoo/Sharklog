import React, { useState } from 'react';
import { calcDashboard, formatMoney, kellyFraction, expectedValue, impliedProbability } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';
import { colors } from '../theme/colors';

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
  const { bets, bankroll, updateBankroll, settings } = useBetsStore();
  const stats = calcDashboard(bets);
  const [depositInput, setDepositInput] = useState('');
  const [withdrawInput, setWithdrawInput] = useState('');

  if (!settings.isPro) {
    return (
      <div style={s.page}>
        <h1 style={s.title}>Банкролл</h1>
        <div style={s.gate}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👑</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: colors.gold, marginBottom: 8 }}>Функция PRO</div>
          <div style={{ color: colors.textSecondary, marginBottom: 24 }}>Банкролл-трекер и калькулятор Келли доступны в подписке</div>
          <button style={s.proBtn}>Попробовать Pro — 7 дней бесплатно</button>
        </div>
      </div>
    );
  }

  const deposited = bankroll.transactions.filter((t) => t.type === 'deposit').reduce((a, t) => a + t.amount, 0);
  const withdrawn = bankroll.transactions.filter((t) => t.type === 'withdrawal').reduce((a, t) => a + t.amount, 0);
  const currentBank = deposited - withdrawn + stats.pnl;
  const unit = Math.round(currentBank * bankroll.unitPercent / 100);

  function addTransaction(type: 'deposit' | 'withdrawal', inputVal: string) {
    const amount = Math.round(parseFloat(inputVal.replace(',', '.')) * 100);
    if (isNaN(amount) || amount <= 0) return;
    updateBankroll({
      transactions: [
        ...bankroll.transactions,
        { id: Date.now().toString(), type, amount, date: new Date().toISOString() },
      ],
    });
    if (type === 'deposit') setDepositInput('');
    else setWithdrawInput('');
  }

  return (
    <div style={s.page}>
      <h1 style={s.title}>Банкролл</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Summary */}
        <div style={s.card}>
          <div style={s.label}>Текущий банк</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: colors.textPrimary, margin: '8px 0 16px' }}>{formatMoney(currentBank)}</div>
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
              <div style={s.metaLabel}>1 юнит ({bankroll.unitPercent}%)</div>
              <div style={{ ...s.metaValue, color: colors.accent }}>{formatMoney(unit)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...s.input, flex: 1 }} placeholder="Пополнить ₽" type="number" value={depositInput} onChange={(e) => setDepositInput(e.target.value)} />
            <button style={{ ...s.actionBtn, backgroundColor: colors.accent }} onClick={() => addTransaction('deposit', depositInput)}>+ Пополнить</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input style={{ ...s.input, flex: 1 }} placeholder="Вывести ₽" type="number" value={withdrawInput} onChange={(e) => setWithdrawInput(e.target.value)} />
            <button style={{ ...s.actionBtn, backgroundColor: colors.lost }} onClick={() => addTransaction('withdrawal', withdrawInput)}>− Вывести</button>
          </div>
        </div>

        <KellyCalc bankroll={currentBank} />
      </div>

      {/* Transaction history */}
      {bankroll.transactions.length > 0 && (
        <div style={s.card}>
          <div style={s.cardTitle}>История транзакций</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Дата', 'Тип', 'Сумма'].map((h) => (
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
  cardTitle: { fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 14 },
  label: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 4, display: 'block' },
  metaLabel: { fontSize: 11, color: colors.textMuted },
  metaValue: { fontSize: 15, fontWeight: 600, color: colors.textPrimary, marginTop: 3 },
  input: {
    backgroundColor: colors.bgElevated, border: `1px solid ${colors.border}`,
    borderRadius: 8, padding: '8px 12px', color: colors.textPrimary, fontSize: 14, outline: 'none',
  },
  actionBtn: { color: '#000', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const },
  gate: { textAlign: 'center' as const, paddingTop: 80 },
  proBtn: { backgroundColor: colors.purple, color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
};
