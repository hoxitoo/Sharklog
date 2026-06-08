import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, useWindowDimensions,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { calcDashboard, formatMoney, parseMoneyInput, kellyFraction, expectedValue, impliedProbability } from '@sharklog/core';

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
import type { BankrollTransaction } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { ProGate } from '../../components/ProGate';
import { colors } from '../../theme/colors';
import { FONTS } from '../../theme/typography';

// ── Kelly Calculator ──────────────────────────────────────────────────────────

function KellyCalculator({ bankroll }: { bankroll: number }) {
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
              {halfKellyStake !== null ? formatMoney(halfKellyStake) : '—'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const kc = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard, borderRadius: 14, padding: 16,
    marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border,
  },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  infoBtn: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  infoBtnText: { fontSize: 10, fontWeight: '700', color: colors.textMuted, lineHeight: 14 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  label: { fontSize: 11, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.bgElevated, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    color: colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: colors.border,
  },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  results: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultLabel: { fontSize: 13, color: colors.textSecondary },
  resultValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
});

// ── Inline transaction form ───────────────────────────────────────────────────

type TxType = 'deposit' | 'withdrawal';

function TxForm({
  type, onSubmit, onCancel,
}: { type: TxType; onSubmit: (amount: number, note: string) => void; onCancel: () => void }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const isWithdrawal = type === 'withdrawal';

  function handleSubmit() {
    const kopecks = parseMoneyInput(amount);
    if (kopecks <= 0) { Alert.alert('Ошибка', 'Введи корректную сумму'); return; }
    onSubmit(kopecks, note.trim());
  }

  return (
    <View style={tf.container}>
      <Text style={tf.label}>{isWithdrawal ? 'Сумма вывода (₽)' : 'Сумма пополнения (₽)'}</Text>
      <TextInput
        style={[tf.input, { borderColor: isWithdrawal ? colors.lost : colors.purple }]}
        placeholder="1000" placeholderTextColor={colors.textMuted}
        value={amount} onChangeText={setAmount}
        keyboardType="numeric" autoFocus returnKeyType="next"
      />
      <TextInput
        style={tf.noteInput} placeholder="Заметка (необязательно)"
        placeholderTextColor={colors.textMuted}
        value={note} onChangeText={setNote} returnKeyType="done" onSubmitEditing={handleSubmit}
      />
      <View style={tf.actions}>
        <TouchableOpacity style={tf.cancelBtn} onPress={onCancel}>
          <Text style={tf.cancelText}>Отмена</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[tf.confirmBtn, { backgroundColor: isWithdrawal ? colors.lost : colors.purple }]}
          onPress={handleSubmit}
        >
          <Text style={tf.confirmText}>{isWithdrawal ? 'Вывести' : 'Пополнить'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const tf = StyleSheet.create({
  container: { gap: 8, marginTop: 4 },
  label: { fontSize: 12, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    backgroundColor: colors.bgElevated, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    color: colors.textPrimary, fontSize: 16, borderWidth: 1,
  },
  noteInput: {
    backgroundColor: colors.bgElevated, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    color: colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: colors.border,
  },
  actions: { flexDirection: 'row', gap: 8 },
  cancelBtn: {
    flex: 1, backgroundColor: colors.bgElevated, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  confirmBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

// ── Transaction row ───────────────────────────────────────────────────────────

function TxRow({ tx, onDelete }: { tx: BankrollTransaction; onDelete: () => void }) {
  const isDeposit = tx.type === 'deposit';
  const date = new Date(tx.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

  function confirmDelete() {
    Alert.alert('Удалить транзакцию?', `${isDeposit ? 'Пополнение' : 'Вывод'} ${formatMoney(tx.amount)}`, [
      { text: 'Удалить', style: 'destructive', onPress: onDelete },
      { text: 'Отмена', style: 'cancel' },
    ]);
  }

  return (
    <TouchableOpacity style={tx_.row} onLongPress={confirmDelete} activeOpacity={0.8}>
      <View style={tx_.left}>
        <Text style={tx_.icon}>{isDeposit ? '↑' : '↓'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={tx_.type}>{isDeposit ? 'Пополнение' : 'Вывод'}</Text>
        {tx.note ? <Text style={tx_.note} numberOfLines={1}>{tx.note}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[tx_.amount, { color: isDeposit ? colors.won : colors.lost }]}>
          {isDeposit ? '+' : '−'}{formatMoney(tx.amount)}
        </Text>
        <Text style={tx_.date}>{date}</Text>
      </View>
    </TouchableOpacity>
  );
}

const tx_ = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.bgCard, borderRadius: 10,
    padding: 12, marginBottom: 6, borderWidth: 1, borderColor: colors.border,
  },
  left: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 16, color: colors.textSecondary },
  type: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  note: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  amount: { fontSize: 14, fontWeight: '700' },
  date: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});

// ── Main content ──────────────────────────────────────────────────────────────

function BankrollContent() {
  const { bets, bankroll, updateBankroll } = useBetsStore();
  const { width } = useWindowDimensions();
  const stats = calcDashboard(bets);
  const [activeTxForm, setActiveTxForm] = useState<TxType | null>(null);

  const equityCurve = useMemo(() => {
    const events: Array<{ date: string; delta: number }> = [];
    for (const tx of bankroll.transactions) {
      const date = (tx.date.split('T')[0]) ?? tx.date;
      events.push({ date, delta: tx.type === 'deposit' ? tx.amount : -tx.amount });
    }
    for (const bet of bets) {
      if (bet.status === 'pending') continue;
      const pnl = bet.status === 'won' ? Math.round(bet.stake * bet.odds) - bet.stake
        : bet.status === 'lost' ? (bet.isFreebet ? 0 : -bet.stake)
        : bet.status === 'cashout' && bet.cashoutAmount != null ? bet.cashoutAmount - bet.stake
        : 0;
      events.push({ date: bet.date, delta: pnl });
    }
    if (events.length < 2) return [];
    const byDate = new Map<string, number>();
    for (const e of events) {
      byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.delta);
    }
    let balance = 0;
    return [...byDate.keys()].sort().map((date) => {
      balance += byDate.get(date) ?? 0;
      return { date, value: balance };
    });
  }, [bets, bankroll.transactions]);

  const deposited = bankroll.transactions.filter((t) => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
  const withdrawn = bankroll.transactions.filter((t) => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0);
  const currentBank = deposited - withdrawn + stats.pnl;
  const unitAmount = Math.round(currentBank * bankroll.unitPercent / 100);

  function handleTxSubmit(type: TxType, amount: number, note: string) {
    if (type === 'withdrawal' && amount > currentBank) {
      Alert.alert('Недостаточно средств', `Максимум для вывода: ${formatMoney(currentBank)}`);
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
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>

      {/* Summary card */}
      <View style={bk.summaryCard}>
        <Text style={bk.bankLabel}>Текущий банк</Text>
        <Text style={[bk.bankValue, { color: currentBank >= 0 ? colors.textPrimary : colors.lost }]}>
          {formatMoney(currentBank)}
        </Text>

        <View style={bk.metaRow}>
          <View style={bk.metaCell}>
            <Text style={bk.metaLabel}>Внесено</Text>
            <Text style={bk.metaValue}>{formatMoney(deposited)}</Text>
          </View>
          <View style={bk.metaCell}>
            <Text style={bk.metaLabel}>Выведено</Text>
            <Text style={[bk.metaValue, { color: withdrawn > 0 ? colors.lost : colors.textPrimary }]}>
              {withdrawn > 0 ? '−' : ''}{formatMoney(withdrawn)}
            </Text>
          </View>
          <View style={bk.metaCell}>
            <Text style={bk.metaLabel}>P&L</Text>
            <Text style={[bk.metaValue, { color: stats.pnl >= 0 ? colors.won : colors.lost }]}>
              {stats.pnl >= 0 ? '+' : ''}{formatMoney(stats.pnl)}
            </Text>
          </View>
        </View>

        {/* Unit % config */}
        <View style={bk.unitRow}>
          <View>
            <Text style={bk.metaLabel}>1 юнит</Text>
            <Text style={[bk.metaValue, { color: colors.accent }]}>{formatMoney(unitAmount)}</Text>
          </View>
          <View style={bk.unitStepper}>
            <TouchableOpacity
              style={[bk.stepBtn, bankroll.unitPercent <= 0.5 && bk.stepBtnDisabled]}
              onPress={() => handleUnitPercentChange(-0.5)}
              disabled={bankroll.unitPercent <= 0.5}
            >
              <Text style={bk.stepBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={bk.unitPct}>{bankroll.unitPercent}%</Text>
            <TouchableOpacity
              style={[bk.stepBtn, bankroll.unitPercent >= 10 && bk.stepBtnDisabled]}
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
          </View>
        )}
      </View>

      {/* Equity curve */}
      {equityCurve.length >= 2 && (
        <View style={bk.chartCard}>
          <Text style={bk.chartTitle}>Кривая банкролла</Text>
          <LineChart
            data={equityCurve.map((p) => ({ value: p.value / 100 }))}
            width={width - 64}
            height={100}
            color={currentBank >= 0 ? colors.won : colors.lost}
            thickness={2}
            hideDataPoints
            areaChart
            startFillColor={currentBank >= 0 ? colors.won : colors.lost}
            endFillColor={colors.bgCard}
            startOpacity={0.2}
            endOpacity={0}
            backgroundColor={colors.bgCard}
            xAxisColor={colors.border}
            yAxisColor="transparent"
            rulesType="solid"
            rulesColor={colors.border + '55'}
            noOfSections={3}
            hideYAxisText
            adjustToWidth
            curved
          />
        </View>
      )}

      {/* Kelly Calculator */}
      <KellyCalculator bankroll={currentBank} />

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
    backgroundColor: colors.bgCard, borderRadius: 14, padding: 18,
    marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border,
  },
  bankLabel: { fontSize: 12, fontFamily: FONTS.sans, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  bankValue: { fontSize: 36, fontFamily: FONTS.monoMedium, marginTop: 4, marginBottom: 16 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  metaCell: {},
  metaLabel: { fontSize: 11, color: colors.textMuted },
  metaValue: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginTop: 2 },
  unitRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.border, marginBottom: 16,
  },
  unitStepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  stepBtnDisabled: { opacity: 0.35 },
  stepBtnText: { fontSize: 18, color: colors.textPrimary, fontWeight: '700', lineHeight: 22 },
  unitPct: { fontSize: 16, fontWeight: '700', color: colors.accent, minWidth: 40, textAlign: 'center' },
  txButtons: { flexDirection: 'row', gap: 10 },
  depositBtn: { flex: 1, backgroundColor: colors.purple, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  depositBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  withdrawBtn: {
    flex: 1, backgroundColor: 'transparent', borderRadius: 10, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: colors.lost,
  },
  withdrawBtnText: { fontSize: 15, fontWeight: '700', color: colors.lost },
  chartCard: {
    backgroundColor: colors.bgCard, borderRadius: 14, padding: 16,
    marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  chartTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
  history: { paddingHorizontal: 16 },
  historyTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  historyHint: { fontSize: 11, color: colors.textMuted, marginBottom: 10 },
  emptyText: { fontSize: 14, color: colors.textMuted },
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
