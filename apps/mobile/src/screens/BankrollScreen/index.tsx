import React, { useState, useMemo } from 'react';
import { SPACE, RADIUS, TOUCH, hitSlopFor } from '../../theme/layout';
import { cardSurface } from '../../components/Card';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Alert, useWindowDimensions,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../../components/AppText';
import { calcDashboard, parseMoneyInput, kellyFraction, expectedValue, impliedProbability, calcDailyBreakdown, currentBank, pendingExposure } from '@sharklog/core';

function uuid(): string {
  const c = (globalThis as any).crypto;
  if (c && typeof c.getRandomValues === 'function') {
    const buf = new Uint8Array(16);
    c.getRandomValues(buf);
    buf[6] = (buf[6]! & 0x0f) | 0x40;
    buf[8] = (buf[8]! & 0x3f) | 0x80;
    let s = '';
    for (let i = 0; i < 16; i++) {
      if (i === 4 || i === 6 || i === 8 || i === 10) s += '-';
      s += buf[i]!.toString(16).padStart(2, '0');
    }
    return s;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
import { useFormatMoney } from '../../utils/useFormatMoney';
import type { BankrollTransaction, BankrollTxType } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { ProGate } from '../../components/ProGate';
import { colors, alpha, toneSurface } from '../../theme/colors';
import { FONTS, numeric, SIZE, GLYPH } from '../../theme/typography';
import { BalanceChart } from '../../components/BalanceChart';
import { SERIES } from '../../theme/chartColors';

const STEP_SLOP = hitSlopFor(28);

// ── Kelly Calculator ──────────────────────────────────────────────────────────

function KellyCalculator({ bankroll }: { bankroll: number }) {
  const fmt = useFormatMoney();
  const [odds, setOdds] = useState('');
  const [prob, setProb] = useState('');

  const oddsNum = parseFloat(odds);
  const probNum = parseFloat(prob) / 100;
  const kelly = !isNaN(oddsNum) && !isNaN(probNum) ? kellyFraction(oddsNum, probNum) : null;
  const ev = !isNaN(oddsNum) && !isNaN(probNum) ? expectedValue(oddsNum, probNum) : null;
  const implied = !isNaN(oddsNum) ? impliedProbability(oddsNum) * 100 : null;
  const halfKellyStake = kelly !== null && bankroll > 0 ? Math.round((kelly / 2) * bankroll) : null;

  return (
    <View style={kc.container}>
      <View style={kc.titleRow}>
        <Text style={kc.title}>Калькулятор Келли</Text>
        <TouchableOpacity
          onPress={() => Alert.alert(
            'Критерий Келли',
            'Формула для расчёта оптимального размера ставки на основе вашей оценки вероятности и коэффициента.\n\nПример: коэф 2.10, ваша оценка вероятности 55% → Half-Kelly ≈ 2.4% банка.\n\nМы рекомендуем Half-Kelly (50% от полного Келли) для снижения дисперсии.',
          )}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <View style={kc.infoBtn}>
            <Text style={kc.infoBtnText}>?</Text>
          </View>
        </TouchableOpacity>
      </View>
      <View style={kc.row}>
        <View style={{ flex: 1 }}>
          <Text style={kc.label}>Коэффициент</Text>
          <TextInput
            style={kc.input} placeholder="2.10" placeholderTextColor={colors.textMuted}
            value={odds} onChangeText={setOdds} keyboardType="decimal-pad"
          />
          {implied !== null && <Text style={kc.hint}>Implied: {implied.toFixed(1)}%</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={kc.label}>Твоя вероятность %</Text>
          <TextInput
            style={kc.input} placeholder="55" placeholderTextColor={colors.textMuted}
            value={prob} onChangeText={setProb} keyboardType="decimal-pad"
          />
        </View>
      </View>
      {ev !== null && (
        <View style={kc.results}>
          <View style={kc.resultRow}>
            <Text style={kc.resultLabel}>Expected Value</Text>
            <Text style={[kc.resultValue, { color: ev > 0 ? colors.won : colors.lost }]}>
              {ev > 0 ? '+' : ''}{(ev * 100).toFixed(1)}%{ev > 0 ? ' ✅' : ' ❌'}
            </Text>
          </View>
          <View style={kc.resultRow}>
            <Text style={kc.resultLabel}>Full Kelly</Text>
            <Text style={kc.resultValue}>{((kelly ?? 0) * 100).toFixed(1)}% банка</Text>
          </View>
          <View style={kc.resultRow}>
            <Text style={kc.resultLabel}>Half Kelly (рекомендовано)</Text>
            <Text style={[kc.resultValue, { color: colors.accent }]}>
              {halfKellyStake !== null ? fmt(halfKellyStake) : '—'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const kc = StyleSheet.create({
  container: {
    ...cardSurface,
    padding: SPACE.lg, marginHorizontal: SPACE.lg, marginBottom: SPACE.md,
  },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACE.md },
  title: { fontSize: SIZE.lead, fontWeight: '700', color: colors.textPrimary },
  infoBtn: {
    width: 18, height: 18, borderRadius: RADIUS.pill,
    backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  infoBtnText: { fontSize: SIZE.micro, fontWeight: '700', color: colors.textMuted, lineHeight: 14 },
  row: { flexDirection: 'row', gap: SPACE.md, marginBottom: SPACE.xs },
  label: { fontSize: SIZE.caption, color: colors.textSecondary, marginBottom: SPACE.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.bgElevated, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm,
    color: colors.textPrimary, fontSize: SIZE.lead, borderWidth: 1, borderColor: colors.border,
  },
  hint: { fontSize: SIZE.caption, color: colors.textMuted, marginTop: SPACE.xs },
  results: { marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: colors.border, gap: SPACE.sm },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultLabel: { fontSize: SIZE.body, color: colors.textSecondary },
  resultValue: { fontSize: SIZE.body, fontWeight: '700', color: colors.textPrimary },
});

// ── Inline transaction form ───────────────────────────────────────────────────

type TxType = 'deposit' | 'withdrawal' | 'adjustment';

function TxForm({
  type, bank, exposure, onSubmit, onCancel,
}: {
  type: TxType;
  bank: number;
  exposure: number;
  onSubmit: (amount: number, note: string) => void;
  onCancel: () => void;
}) {
  const fmt = useFormatMoney();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const isWithdrawal = type === 'withdrawal';
  const isAdjust = type === 'adjustment';

  // In reconcile mode the field is the real balance, not a movement: the app
  // works out the difference itself, because nobody knows offhand that they are
  // 25 ₽ short — they only know what the bookmaker shows.
  const typed = parseMoneyInput(amount);
  // parseMoneyInput returns 0 for text with no digits, and "0" is a legitimate
  // balance — so gate on a digit being present, not on the parsed value.
  const hasNumber = /\d/.test(amount);
  // The bookmaker already took the open stakes out of its balance, so that is
  // what the typed number must be compared against. Comparing it to the raw
  // bank would book the exposure as a shortfall and then lose it for good once
  // those bets settled — and the next reconciliation would do it again.
  const expected = bank - exposure;
  const delta = isAdjust && hasNumber ? typed - expected : 0;
  const accent = isAdjust ? colors.violet : isWithdrawal ? colors.lost : colors.purple;

  function handleSubmit() {
    if (isAdjust) {
      if (!hasNumber) { Alert.alert('Ошибка', 'Введи баланс у букмекера'); return; }
      if (delta === 0) { Alert.alert('Всё сходится', 'Баланс уже совпадает — корректировка не нужна'); return; }
      onSubmit(delta, note.trim());
      return;
    }
    if (typed <= 0) { Alert.alert('Ошибка', 'Введи корректную сумму'); return; }
    onSubmit(typed, note.trim());
  }

  return (
    <View style={tf.container}>
      <Text style={tf.label}>
        {isAdjust ? 'Реальный баланс у букмекера (₽)'
          : isWithdrawal ? 'Сумма вывода (₽)' : 'Сумма пополнения (₽)'}
      </Text>
      <TextInput
        style={[tf.input, { borderColor: accent }]}
        placeholder={isAdjust ? String(Math.round(expected / 100)) : '1000'}
        placeholderTextColor={colors.textMuted}
        value={amount} onChangeText={setAmount}
        keyboardType="numeric" autoFocus returnKeyType="next"
      />

      {isAdjust && (
        <View style={tf.hintBox}>
          <View style={tf.hintRow}>
            <Text style={tf.hintLabel}>Ожидаем у бука</Text>
            <Text style={tf.hintValue}>{fmt(expected)}</Text>
          </View>
          {hasNumber && (
            <View style={tf.hintRow}>
              <Text style={tf.hintLabel}>Разница</Text>
              <Text style={[tf.hintValue, {
                color: delta > 0 ? colors.won : delta < 0 ? colors.lost : colors.textMuted,
              }]}>
                {delta > 0 ? '+' : ''}{fmt(delta)}
              </Text>
            </View>
          )}
          {exposure > 0 && (
            <Text style={tf.hintNote}>
              {fmt(exposure)} сейчас в незавершённых ставках — букмекер списал их
              сразу, поэтому и вычтены. Вводи баланс так, как его показывает бук.
            </Text>
          )}
        </View>
      )}

      <TextInput
        style={tf.noteInput}
        placeholder={isAdjust ? 'Причина (необязательно)' : 'Заметка (необязательно)'}
        placeholderTextColor={colors.textMuted}
        value={note} onChangeText={setNote} returnKeyType="done" onSubmitEditing={handleSubmit}
      />
      <View style={tf.actions}>
        <TouchableOpacity style={tf.cancelBtn} onPress={onCancel}>
          <Text style={tf.cancelText}>Отмена</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[tf.confirmBtn, { backgroundColor: accent }]} onPress={handleSubmit}>
          <Text style={tf.confirmText}>
            {isAdjust ? 'Выровнять' : isWithdrawal ? 'Вывести' : 'Пополнить'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const tf = StyleSheet.create({
  container: { gap: SPACE.sm, marginTop: SPACE.xs },
  label: { fontSize: SIZE.caption, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    backgroundColor: colors.bgElevated, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.md,
    color: colors.textPrimary, fontSize: SIZE.lead, borderWidth: 1,
  },
  noteInput: {
    backgroundColor: colors.bgElevated, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm,
    color: colors.textPrimary, fontSize: SIZE.body, borderWidth: 1, borderColor: colors.border,
  },
  hintBox: {
    backgroundColor: colors.bgElevated, borderRadius: RADIUS.sm, padding: SPACE.sm,
    borderWidth: 1, borderColor: colors.border, gap: SPACE.xs,
  },
  hintRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  hintLabel: { fontSize: SIZE.caption, color: colors.textSecondary },
  hintValue: { fontSize: SIZE.lead, fontWeight: '700' },
  hintNote: { fontSize: SIZE.caption, color: colors.textMuted, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: SPACE.sm },
  cancelBtn: {
    minHeight: TOUCH, justifyContent: 'center',
    flex: 1, backgroundColor: colors.bgElevated, borderRadius: RADIUS.sm,
    paddingVertical: SPACE.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  cancelText: { fontSize: SIZE.lead, fontWeight: '600', color: colors.textSecondary },
  confirmBtn: { minHeight: TOUCH, justifyContent: 'center', flex: 1, borderRadius: RADIUS.sm, paddingVertical: SPACE.md, alignItems: 'center' },
  confirmText: { fontSize: SIZE.lead, fontWeight: '700', color: '#fff' },
});

// ── Transaction row ───────────────────────────────────────────────────────────

const TX_LABEL: Record<BankrollTxType, string> = {
  deposit: 'Пополнение', withdrawal: 'Вывод', adjustment: 'Сверка',
};
const TX_ICON: Record<BankrollTxType, string> = {
  deposit: '↑', withdrawal: '↓', adjustment: '=',
};

function TxRow({ tx, onDelete }: { tx: BankrollTransaction; onDelete: () => void }) {
  const fmt = useFormatMoney();
  const date = new Date(tx.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  // A withdrawal's sign lives in its type; an adjustment carries it in the amount.
  const signed = tx.type === 'withdrawal' ? -tx.amount : tx.amount;
  const label = TX_LABEL[tx.type];

  function confirmDelete() {
    const sign = signed >= 0 ? '+' : '−';
    Alert.alert('Удалить транзакцию?', `${label} ${sign}${fmt(Math.abs(signed))}`, [
      { text: 'Удалить', style: 'destructive', onPress: onDelete },
      { text: 'Отмена', style: 'cancel' },
    ]);
  }

  return (
    <TouchableOpacity style={tx_.row} onLongPress={confirmDelete} activeOpacity={0.8}>
      <View style={tx_.left}>
        <Text style={tx_.icon}>{TX_ICON[tx.type]}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={tx_.type}>{label}</Text>
        {tx.note ? <Text style={tx_.note} numberOfLines={1}>{tx.note}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[tx_.amount, {
          color: tx.type === 'adjustment' ? colors.violet : signed >= 0 ? colors.won : colors.lost,
        }]}>
          {signed >= 0 ? '+' : '−'}{fmt(Math.abs(signed))}
        </Text>
        <Text style={tx_.date}>{date}</Text>
      </View>
    </TouchableOpacity>
  );
}

const tx_ = StyleSheet.create({
  row: {
    minHeight: TOUCH,
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    backgroundColor: colors.bgCard, borderRadius: RADIUS.sm,
    padding: SPACE.md, marginBottom: SPACE.xs, borderWidth: 1, borderColor: colors.border,
  },
  left: {
    width: 32, height: 32, borderRadius: RADIUS.pill,
    backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: GLYPH.md, color: colors.textSecondary },
  type: { fontSize: SIZE.body, fontWeight: '600', color: colors.textPrimary },
  note: { fontSize: SIZE.caption, color: colors.textMuted, marginTop: 1 },
  amount: { fontSize: SIZE.body, fontWeight: '700' },
  date: { fontSize: SIZE.caption, color: colors.textMuted, marginTop: 2 },
});

// ── Main content ──────────────────────────────────────────────────────────────

function BankrollContent() {
  const fmt = useFormatMoney();
  const { bets, bankroll, updateBankroll } = useBetsStore();
  const { width } = useWindowDimensions();
  const stats = calcDashboard(bets);
  const [activeTxForm, setActiveTxForm] = useState<TxType | null>(null);

  const deposited = bankroll.transactions.filter((t) => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
  const withdrawn = bankroll.transactions.filter((t) => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0);
  const bank = currentBank(bankroll.transactions, bets);
  const exposure = pendingExposure(bets);
  const unitAmount = Math.round(bank * bankroll.unitPercent / 100);

  // Bank curve, aggregated per DAY (readable trend, not a spike storm) with real
  // deposit/withdrawal markers — gifted-charts swallowed customDataPoint under
  // hideDataPoints, so those markers never rendered.
  const dailySeries = useMemo(
    () => calcDailyBreakdown(bets, bankroll.transactions),
    [bets, bankroll.transactions],
  );

  const chartBlock = useMemo(() => {
    if (dailySeries.length < 2) return null;
    const hasDeposit = dailySeries.some((d) => d.deposits > 0);
    const hasWithdrawal = dailySeries.some((d) => d.withdrawals > 0);
    return (
      <View style={bk.chartCard}>
        <View style={bk.chartHeader}>
          <Text style={bk.chartTitle}>Кривая банкролла</Text>
          <Text style={[bk.chartCurrentBank, { color: bank >= 0 ? colors.won : colors.lost }]}>
            {bank >= 0 ? '+' : ''}{fmt(bank)}
          </Text>
        </View>
        <BalanceChart days={dailySeries} width={width - 64} height={150} />
        <View style={bk.legendRow}>
          <Text style={bk.legendPeriod}>
            {dailySeries.length} дней · с {dailySeries[0]!.date.split('-').reverse().slice(0, 2).join('.')}
          </Text>
          {hasDeposit && (
            <View style={bk.legendItem}>
              <View style={[bk.legendDot, { backgroundColor: SERIES.deposit }]} />
              <Text style={bk.legendText}>депозит</Text>
            </View>
          )}
          {hasWithdrawal && (
            <View style={bk.legendItem}>
              <View style={[bk.legendDot, { backgroundColor: SERIES.withdrawal }]} />
              <Text style={bk.legendText}>вывод</Text>
            </View>
          )}
        </View>
      </View>
    );
  }, [dailySeries, bank, width]);

  function handleTxSubmit(type: TxType, amount: number, note: string) {
    if (type === 'adjustment') {
      const tx: BankrollTransaction = {
        id: uuid(), type, amount, date: new Date().toISOString(),
        note: note || 'Сверка с букмекером',
      };
      updateBankroll({ transactions: [...bankroll.transactions, tx] });
      setActiveTxForm(null);
      return;
    }
    if (type === 'withdrawal' && amount > bank) {
      Alert.alert('Недостаточно средств', `Максимум для вывода: ${fmt(bank)}`);
      return;
    }
    const newTx: BankrollTransaction = {
      id: uuid(),
      type,
      amount,
      date: new Date().toISOString(),
      ...(note ? { note } : {}),
    };
    updateBankroll({ transactions: [...bankroll.transactions, newTx] });
    setActiveTxForm(null);
  }

  function handleDeleteTx(id: string) {
    updateBankroll({ transactions: bankroll.transactions.filter((t) => t.id !== id) });
  }

  function handleUnitPercentChange(delta: number) {
    const next = Math.round((bankroll.unitPercent + delta) * 10) / 10;
    if (next < 0.5 || next > 10) return;
    updateBankroll({ unitPercent: next });
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACE.xl }}>

      {/* Summary card */}
      <View style={bk.summaryCard}>
        <Text style={bk.bankLabel}>Текущий банк</Text>
        <Text style={[bk.bankValue, { color: bank >= 0 ? colors.textPrimary : colors.lost }]}>
          {fmt(bank)}
        </Text>

        <View style={bk.metaRow}>
          <View style={bk.metaCell}>
            <Text style={bk.metaLabel}>Внесено</Text>
            <Text style={bk.metaValue} numberOfLines={1} adjustsFontSizeToFit>{fmt(deposited)}</Text>
          </View>
          <View style={bk.metaCell}>
            <Text style={bk.metaLabel}>Выведено</Text>
            <Text style={[bk.metaValue, { color: withdrawn > 0 ? colors.lost : colors.textPrimary }]}
              numberOfLines={1} adjustsFontSizeToFit>
              {withdrawn > 0 ? '−' : ''}{fmt(withdrawn)}
            </Text>
          </View>
          <View style={bk.metaCell}>
            <Text style={bk.metaLabel}>P&L</Text>
            <Text style={[bk.metaValue, { color: stats.pnl >= 0 ? colors.won : colors.lost }]}
              numberOfLines={1} adjustsFontSizeToFit>
              {stats.pnl >= 0 ? '+' : ''}{fmt(stats.pnl)}
            </Text>
          </View>
        </View>

        {exposure > 0 && (
          <Text style={bk.exposureNote}>
            В игре {fmt(exposure)} · у букмекера сейчас ≈ {fmt(bank - exposure)}
          </Text>
        )}

        {/* Unit % config */}
        <View style={bk.unitRow}>
          <View>
            <Text style={bk.metaLabel}>1 юнит</Text>
            <Text style={[bk.unitValue, { color: colors.accent }]}>{fmt(unitAmount)}</Text>
          </View>
          <View style={bk.unitStepper}>
            <TouchableOpacity
              style={[bk.stepBtn, bankroll.unitPercent <= 0.5 && bk.stepBtnDisabled]}
          hitSlop={STEP_SLOP}
              onPress={() => handleUnitPercentChange(-0.5)}
              disabled={bankroll.unitPercent <= 0.5}
            >
              <Text style={bk.stepBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={bk.unitPct}>{bankroll.unitPercent}%</Text>
            <TouchableOpacity
              style={[bk.stepBtn, bankroll.unitPercent >= 10 && bk.stepBtnDisabled]}
          hitSlop={STEP_SLOP}
              onPress={() => handleUnitPercentChange(0.5)}
              disabled={bankroll.unitPercent >= 10}
            >
              <Text style={bk.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* TX form or buttons */}
        {activeTxForm ? (
          <TxForm
            type={activeTxForm}
            bank={bank}
            exposure={exposure}
            onSubmit={(amount, note) => handleTxSubmit(activeTxForm, amount, note)}
            onCancel={() => setActiveTxForm(null)}
          />
        ) : (
          <View style={bk.txButtons}>
            <TouchableOpacity style={bk.depositBtn} onPress={() => setActiveTxForm('deposit')}>
              <Text style={bk.depositBtnText}>+ Пополнить</Text>
            </TouchableOpacity>
            <TouchableOpacity style={bk.withdrawBtn} onPress={() => setActiveTxForm('withdrawal')}>
              <Text style={bk.withdrawBtnText}>− Вывести</Text>
            </TouchableOpacity>
            <TouchableOpacity style={bk.adjustBtn} onPress={() => setActiveTxForm('adjustment')}>
              <Text style={bk.adjustBtnText}>= Сверить</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Equity curve */}
      {chartBlock}

      {/* Kelly Calculator */}
      <KellyCalculator bankroll={bank} />

      {/* Transaction history */}
      <View style={bk.history}>
        <Text style={bk.historyTitle}>История транзакций</Text>
        <Text style={bk.historyHint}>Удержи для удаления</Text>
        {bankroll.transactions.length === 0 ? (
          <Text style={bk.emptyText}>Транзакций нет</Text>
        ) : (
          [...bankroll.transactions].reverse().map((t) => (
            <TxRow key={t.id} tx={t} onDelete={() => handleDeleteTx(t.id)} />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const bk = StyleSheet.create({
  summaryCard: {
    ...cardSurface, ...toneSurface('profit'),
    padding: SPACE.lg, marginHorizontal: SPACE.lg, marginBottom: SPACE.md,
  },
  bankLabel: { fontSize: SIZE.caption, fontFamily: FONTS.sans, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  bankValue: { fontSize: SIZE.display, fontFamily: FONTS.monoMedium, marginTop: SPACE.xs, marginBottom: SPACE.lg },
  // Equal cells with a real gap. These held three money values in cells sized
  // to their content and distributed by space-between: once the values grew
  // wide enough to fill the row, the spacing went to zero and "146 507 ₽" ran
  // straight into "−135 045,4 ₽".
  metaRow: { flexDirection: 'row', gap: SPACE.md, marginBottom: SPACE.lg },
  metaCell: { flex: 1 },
  metaLabel: { fontSize: SIZE.caption, color: colors.textMuted },
  metaValue: { ...numeric, fontSize: SIZE.body, fontWeight: '600', color: colors.textPrimary, marginTop: 2 },
  // The unit sits alone on its own row and keeps the larger size.
  unitValue: { ...numeric, fontSize: SIZE.lead, fontWeight: '600', marginTop: 2 },
  unitRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: SPACE.md, marginTop: SPACE.xs, borderTopWidth: 1, borderTopColor: colors.border, marginBottom: SPACE.lg,
  },
  unitStepper: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  stepBtn: {
    width: 28, height: 28, borderRadius: RADIUS.sm,
    backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  stepBtnDisabled: { opacity: 0.35 },
  stepBtnText: { fontSize: GLYPH.md, color: colors.textPrimary, fontWeight: '700', lineHeight: 20 },
  unitPct: { fontSize: SIZE.lead, fontWeight: '700', color: colors.accent, minWidth: 40, textAlign: 'center' },
  txButtons: { flexDirection: 'row', gap: SPACE.sm },
  adjustBtn: {
    minHeight: TOUCH, justifyContent: 'center',
    flex: 1, borderRadius: RADIUS.sm, paddingVertical: SPACE.md, alignItems: 'center',
    backgroundColor: alpha(colors.violet, 0.16), borderWidth: 1, borderColor: colors.violet,
  },
  adjustBtnText: { fontSize: SIZE.body, fontWeight: '700', color: colors.violet },
  exposureNote: { fontSize: SIZE.caption, color: colors.textMuted, marginTop: SPACE.sm, textAlign: 'center' },
  depositBtn: { minHeight: TOUCH, justifyContent: 'center', flex: 1, backgroundColor: colors.purple, borderRadius: RADIUS.sm, paddingVertical: SPACE.md, alignItems: 'center' },
  depositBtnText: { fontSize: SIZE.lead, fontWeight: '700', color: '#fff' },
  withdrawBtn: {
    minHeight: TOUCH, justifyContent: 'center',
    flex: 1, backgroundColor: 'transparent', borderRadius: RADIUS.sm, paddingVertical: SPACE.md, alignItems: 'center',
    borderWidth: 1, borderColor: colors.lost,
  },
  withdrawBtnText: { fontSize: SIZE.lead, fontWeight: '700', color: colors.lost },
  chartCard: {
    ...cardSurface, ...toneSurface('violet'),
    padding: SPACE.lg, marginHorizontal: SPACE.lg, marginBottom: SPACE.md,
  },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: SPACE.xs },
  chartTitle: { fontSize: SIZE.body, fontWeight: '700', color: colors.textPrimary },
  chartCurrentBank: { ...numeric, fontSize: SIZE.body, fontWeight: '700' },
  chartHint: { fontSize: SIZE.micro, color: colors.textMuted, marginBottom: SPACE.sm },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.sm },
  legendPeriod: { fontSize: SIZE.micro, color: colors.textMuted, flex: 1 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  legendDot: { width: 8, height: 8, borderRadius: RADIUS.xs },
  legendText: { fontSize: SIZE.micro, color: colors.textMuted },
  txMarker: { width: 8, height: 8, borderRadius: RADIUS.xs, marginTop: -4, marginLeft: -4 },
  history: { paddingHorizontal: SPACE.lg },
  historyTitle: { fontSize: SIZE.lead, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  historyHint: { fontSize: SIZE.caption, color: colors.textMuted, marginBottom: SPACE.sm },
  emptyText: { fontSize: SIZE.body, color: colors.textMuted },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export function BankrollScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ProGate feature="Банкролл-трекер и калькулятор Келли">
        <BankrollContent />
      </ProGate>
    </View>
  );
}
