import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';
import { calcDashboard, formatMoney, parseMoneyInput, kellyFraction, expectedValue, impliedProbability } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { ProGate } from '../../components/ProGate';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors } from '../../theme/colors';

function KellyCalculator({ bankroll }: { bankroll: number }) {
  const [odds, setOdds] = useState('');
  const [prob, setProb] = useState('');

  const oddsNum = parseFloat(odds);
  const probNum = parseFloat(prob) / 100;

  const kelly = !isNaN(oddsNum) && !isNaN(probNum)
    ? kellyFraction(oddsNum, probNum)
    : null;
  const ev = !isNaN(oddsNum) && !isNaN(probNum)
    ? expectedValue(oddsNum, probNum)
    : null;
  const implied = !isNaN(oddsNum) ? impliedProbability(oddsNum) * 100 : null;

  const halfKellyStake = kelly !== null && bankroll > 0
    ? Math.round((kelly / 2) * bankroll)
    : null;

  return (
    <View style={kc.container}>
      <Text style={kc.title}>Калькулятор Келли</Text>

      <View style={kc.row}>
        <View style={{ flex: 1 }}>
          <Text style={kc.label}>Коэффициент</Text>
          <TextInput
            style={kc.input}
            placeholder="2.10"
            placeholderTextColor={colors.textMuted}
            value={odds}
            onChangeText={setOdds}
            keyboardType="decimal-pad"
          />
          {implied !== null && (
            <Text style={kc.hint}>Implied: {implied.toFixed(1)}%</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={kc.label}>Твоя вероятность %</Text>
          <TextInput
            style={kc.input}
            placeholder="55"
            placeholderTextColor={colors.textMuted}
            value={prob}
            onChangeText={setProb}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      {ev !== null && (
        <View style={kc.results}>
          <View style={kc.resultRow}>
            <Text style={kc.resultLabel}>Expected Value</Text>
            <Text style={[kc.resultValue, { color: ev > 0 ? colors.won : colors.lost }]}>
              {ev > 0 ? '+' : ''}{(ev * 100).toFixed(1)}%
              {ev > 0 ? ' ✅' : ' ❌'}
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
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 14 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  label: { fontSize: 11, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  results: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultLabel: { fontSize: 13, color: colors.textSecondary },
  resultValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
});

function BankrollContent() {
  const { bets, bankroll, updateBankroll } = useBetsStore();
  const stats = calcDashboard(bets);

  const deposited = bankroll.transactions
    .filter((t) => t.type === 'deposit')
    .reduce((s, t) => s + t.amount, 0);
  const withdrawn = bankroll.transactions
    .filter((t) => t.type === 'withdrawal')
    .reduce((s, t) => s + t.amount, 0);
  const currentBank = deposited - withdrawn + stats.pnl;
  const unitAmount = Math.round(currentBank * bankroll.unitPercent / 100);

  function handleAddDeposit() {
    Alert.prompt('Пополнение', 'Введи сумму в рублях:', (text) => {
      if (!text) return;
      const amount = parseMoneyInput(text);
      if (amount <= 0) return;
      updateBankroll({
        transactions: [
          ...bankroll.transactions,
          { id: Date.now().toString(), type: 'deposit', amount, date: new Date().toISOString() },
        ],
      });
    });
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={bk.summaryCard}>
        <Text style={bk.bankLabel}>Текущий банк</Text>
        <Text style={bk.bankValue}>{formatMoney(currentBank)}</Text>
        <View style={bk.row}>
          <View>
            <Text style={bk.metaLabel}>Внесено</Text>
            <Text style={bk.metaValue}>{formatMoney(deposited)}</Text>
          </View>
          <View>
            <Text style={bk.metaLabel}>P&L</Text>
            <Text style={[bk.metaValue, { color: stats.pnl >= 0 ? colors.won : colors.lost }]}>
              {stats.pnl >= 0 ? '+' : ''}{formatMoney(stats.pnl)}
            </Text>
          </View>
          <View>
            <Text style={bk.metaLabel}>1 юнит ({bankroll.unitPercent}%)</Text>
            <Text style={[bk.metaValue, { color: colors.accent }]}>{formatMoney(unitAmount)}</Text>
          </View>
        </View>
        <TouchableOpacity style={bk.depositBtn} onPress={handleAddDeposit}>
          <Text style={bk.depositBtnText}>+ Пополнить</Text>
        </TouchableOpacity>
      </View>

      <KellyCalculator bankroll={currentBank} />

      <View style={bk.history}>
        <Text style={bk.historyTitle}>История транзакций</Text>
        {bankroll.transactions.length === 0 ? (
          <Text style={bk.emptyText}>Транзакций нет</Text>
        ) : (
          [...bankroll.transactions].reverse().map((t) => (
            <View key={t.id} style={bk.txRow}>
              <Text style={bk.txType}>
                {t.type === 'deposit' ? '↑ Пополнение' : '↓ Вывод'}
              </Text>
              <Text style={[bk.txAmount, { color: t.type === 'deposit' ? colors.won : colors.lost }]}>
                {t.type === 'deposit' ? '+' : '-'}{formatMoney(t.amount)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const bk = StyleSheet.create({
  summaryCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bankLabel: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  bankValue: { fontSize: 36, fontWeight: '700', color: colors.textPrimary, marginTop: 4, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  metaLabel: { fontSize: 11, color: colors.textMuted },
  metaValue: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginTop: 2 },
  depositBtn: {
    backgroundColor: colors.purple,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  depositBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  history: { paddingHorizontal: 16 },
  historyTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
  emptyText: { fontSize: 14, color: colors.textMuted },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  txType: { fontSize: 14, color: colors.textPrimary },
  txAmount: { fontSize: 14, fontWeight: '700' },
});

export function BankrollScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Банкролл" subtitle="Управление капиталом" />
      <ProGate feature="Банкролл-трекер и калькулятор Келли">
        <BankrollContent />
      </ProGate>
    </View>
  );
}
