import React, { useState, useMemo } from 'react';
import { SPACE, RADIUS, TOUCH, hitSlopFor } from '../../theme/layout';
import { cardSurface } from '../../components/Card';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Alert, useWindowDimensions,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../../components/AppText';
import { haptic } from '../../utils/haptics';
import { useTranslation } from 'react-i18next';
import { dateLocale } from '../../i18n';
import { txNoteLabel } from '../../utils/labels';
import type { ChartSeries } from '../../components/BalanceChart';
import { TX_NOTE, calcDashboard, parseMoneyInput, kellyFraction, expectedValue, impliedProbability, calcDailyBreakdown, currentBank, pendingExposure } from '@sharklog/core';

/** How much of the history the screen shows before asking. */
const TX_PREVIEW = 5;

/** Height of a series segment — deliberate, so the touch area is added back. */
const SERIES_BTN_H = 28;
const SERIES_OPTIONS: Array<{ key: ChartSeries; label: string }> = [
  { key: 'pnl', label: 'P&L' },
  { key: 'balance', label: 'bet.bank' },
];

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
  const { t } = useTranslation();
  const fmt = useFormatMoney();
  const [odds, setOdds] = useState('');
  const [prob, setProb] = useState('');

  // A Russian keyboard types "2,10", and parseFloat stops at the comma: the
  // calculator was silently working out Kelly for odds of 2.00.
  const oddsNum = parseFloat(odds.replace(',', '.'));
  const probNum = parseFloat(prob.replace(',', '.')) / 100;
  const kelly = !isNaN(oddsNum) && !isNaN(probNum) ? kellyFraction(oddsNum, probNum) : null;
  const ev = !isNaN(oddsNum) && !isNaN(probNum) ? expectedValue(oddsNum, probNum) : null;
  const implied = !isNaN(oddsNum) ? impliedProbability(oddsNum) * 100 : null;
  const halfKellyStake = kelly !== null && bankroll > 0 ? Math.round((kelly / 2) * bankroll) : null;

  return (
    <View style={kc.container}>
      <View style={kc.titleRow}>
        <Text style={kc.title}>{t('bankroll.kelly')}</Text>
        <TouchableOpacity
          onPress={() => Alert.alert(
            t('bankroll.kellyHelpTitle'),
            t('bankroll.kellyHelp'),
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
          <Text style={kc.label}>{t('bet.odds')}</Text>
          <TextInput
            style={kc.input} placeholder="2.10" placeholderTextColor={colors.textMuted}
            value={odds} onChangeText={setOdds} keyboardType="decimal-pad"
          />
          {implied !== null && <Text style={kc.hint}>Implied: {implied.toFixed(1)}%</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={kc.label}>{t('bankroll.yourProb')}</Text>
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
            <Text style={kc.resultValue}>{t('bankroll.ofBank', { pct: ((kelly ?? 0) * 100).toFixed(1) })}</Text>
          </View>
          <View style={kc.resultRow}>
            <Text style={kc.resultLabel}>{t('bankroll.halfKelly')}</Text>
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
  const { t } = useTranslation();
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
      if (!hasNumber) { Alert.alert(t('common.error'), t('bankroll.errEnterBalance')); return; }
      if (delta === 0) { Alert.alert(t('bankroll.inSyncTitle'), t('bankroll.inSyncMsg')); return; }
      onSubmit(delta, note.trim());
      return;
    }
    if (typed <= 0) { Alert.alert(t('common.error'), t('bankroll.errAmount')); return; }
    onSubmit(typed, note.trim());
  }

  return (
    <View style={tf.container}>
      <Text style={tf.label}>
        {isAdjust ? t('bankroll.adjustLabel')
          : isWithdrawal ? t('bankroll.withdrawLabel') : t('bankroll.depositLabel')}
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
            <Text style={tf.hintLabel}>{t('bankroll.expectedAtBook')}</Text>
            <Text style={tf.hintValue}>{fmt(expected)}</Text>
          </View>
          {hasNumber && (
            <View style={tf.hintRow}>
              <Text style={tf.hintLabel}>{t('bankroll.difference')}</Text>
              <Text style={[tf.hintValue, {
                color: delta > 0 ? colors.won : delta < 0 ? colors.lost : colors.textMuted,
              }]}>
                {delta > 0 ? '+' : ''}{fmt(delta)}
              </Text>
            </View>
          )}
          {exposure > 0 && (
            <Text style={tf.hintNote}>
              {t('bankroll.exposureNote', { amount: fmt(exposure) })}
            </Text>
          )}
        </View>
      )}

      <TextInput
        style={tf.noteInput}
        placeholder={isAdjust ? t('bankroll.reasonPh') : t('bankroll.notePh')}
        placeholderTextColor={colors.textMuted}
        value={note} onChangeText={setNote} returnKeyType="done" onSubmitEditing={handleSubmit}
      />
      <View style={tf.actions}>
        <TouchableOpacity style={tf.cancelBtn} onPress={onCancel}>
          <Text style={tf.cancelText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[tf.confirmBtn, { backgroundColor: accent }]} onPress={handleSubmit}>
          <Text style={tf.confirmText}>
            {isAdjust ? t('bankroll.align') : isWithdrawal ? t('bankroll.withdraw') : t('bankroll.fill')}
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
  deposit: 'bankroll.deposit', withdrawal: 'bankroll.withdrawal', adjustment: 'bankroll.adjustment',
};
const TX_ICON: Record<BankrollTxType, string> = {
  deposit: '↑', withdrawal: '↓', adjustment: '=',
};

function TxRow({ tx, onDelete }: { tx: BankrollTransaction; onDelete: () => void }) {
  const fmt = useFormatMoney();
  const { t } = useTranslation();
  const date = new Date(tx.date).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });
  // A withdrawal's sign lives in its type; an adjustment carries it in the amount.
  const signed = tx.type === 'withdrawal' ? -tx.amount : tx.amount;
  const label = t(TX_LABEL[tx.type]);

  function confirmDelete() {
    const sign = signed >= 0 ? '+' : '−';
    Alert.alert(t('bankroll.deleteConfirm'), `${label} ${sign}${fmt(Math.abs(signed))}`, [
      { text: t('common.delete'), style: 'destructive', onPress: onDelete },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  return (
    <TouchableOpacity style={tx_.row} onLongPress={confirmDelete} activeOpacity={0.8}>
      <View style={tx_.left}>
        <Text style={tx_.icon}>{TX_ICON[tx.type]}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={tx_.type}>{label}</Text>
        {tx.note ? <Text style={tx_.note} numberOfLines={1}>{txNoteLabel(t, tx.note)}</Text> : null}
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
  const { t } = useTranslation();
  const bets = useBetsStore((s) => s.bets);
  const bankroll = useBetsStore((s) => s.bankroll);
  const updateBankroll = useBetsStore((s) => s.updateBankroll);
  const { width } = useWindowDimensions();
  const stats = useMemo(() => calcDashboard(bets), [bets]);
  const [activeTxForm, setActiveTxForm] = useState<TxType | null>(null);
  const [allTxShown, setAllTxShown] = useState(false);
  // P&L by default: the bank line is mostly a record of transfers, and the
  // question the screen is opened with is whether the betting is working.
  const [series, setSeries] = useState<ChartSeries>('pnl');

  const deposited = bankroll.transactions.filter((tx) => tx.type === 'deposit').reduce((s, tx) => s + tx.amount, 0);
  const withdrawn = bankroll.transactions.filter((tx) => tx.type === 'withdrawal').reduce((s, tx) => s + tx.amount, 0);
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
    const isPnl = series === 'pnl';
    // Legend dots describe marks on the line, and the P&L line carries none.
    const hasDeposit = !isPnl && dailySeries.some((d) => d.deposits > 0);
    const hasWithdrawal = !isPnl && dailySeries.some((d) => d.withdrawals > 0);
    const headline = isPnl ? stats.pnl : bank;
    return (
      <View style={bk.chartCard}>
        <View style={bk.chartHeader}>
          {/* The switch is the title: naming the series twice, once in a
              heading and once on the active segment, says nothing extra. */}
          <View style={bk.seriesSwitch}>
            {SERIES_OPTIONS.map((o) => (
              <TouchableOpacity
                key={o.key}
                style={[bk.seriesBtn, series === o.key && bk.seriesBtnActive]}
                hitSlop={hitSlopFor(SERIES_BTN_H, { maxHorizontal: 0 })}
                onPress={() => { haptic.selection(); setSeries(o.key); }}
                activeOpacity={0.8}
              >
                <Text style={[bk.seriesText, series === o.key && bk.seriesTextActive]}>{o.label === 'P&L' ? o.label : t(o.label)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[bk.chartCurrentBank, { color: headline >= 0 ? colors.won : colors.lost }]}>
            {headline >= 0 ? '+' : ''}{fmt(headline)}
          </Text>
        </View>
        <BalanceChart days={dailySeries} width={width - 64} height={150} series={series} />
        <View style={bk.legendRow}>
          <Text style={bk.legendPeriod}>
            {t('bankroll.periodSince', { count: dailySeries.length, date: dailySeries[0]!.date.split('-').reverse().slice(0, 2).join('.') })}
          </Text>
          {isPnl ? (
            <Text style={bk.legendText}>{t('bankroll.pnlLegend')}</Text>
          ) : (
            <>
              {hasDeposit && (
                <View style={bk.legendItem}>
                  <View style={[bk.legendDot, { backgroundColor: SERIES.deposit }]} />
                  <Text style={bk.legendText}>{t('bankroll.legendDeposit')}</Text>
                </View>
              )}
              {hasWithdrawal && (
                <View style={bk.legendItem}>
                  <View style={[bk.legendDot, { backgroundColor: SERIES.withdrawal }]} />
                  <Text style={bk.legendText}>{t('bankroll.legendWithdrawal')}</Text>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    );
  }, [dailySeries, bank, width, series, stats.pnl, fmt, t]);

  function handleTxSubmit(type: TxType, amount: number, note: string) {
    if (type === 'adjustment') {
      const tx: BankrollTransaction = {
        id: uuid(), type, amount, date: new Date().toISOString(),
        // Stored as the core token, shown translated (txNoteLabel) — the history
        // must not freeze in whatever language the reconciliation was made in.
        note: note || TX_NOTE.ADJUSTMENT,
      };
      updateBankroll({ transactions: [...bankroll.transactions, tx] });
      setActiveTxForm(null);
      return;
    }
    if (type === 'withdrawal' && amount > bank) {
      Alert.alert(t('bankroll.insufficientTitle'), t('bankroll.insufficientMsg', { amount: fmt(bank) }));
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
    updateBankroll({ transactions: bankroll.transactions.filter((tx) => tx.id !== id) });
  }

  function handleUnitPercentChange(delta: number) {
    const next = Math.round((bankroll.unitPercent + delta) * 10) / 10;
    if (next < 0.5 || next > 10) return;
    updateBankroll({ unitPercent: next });
  }

  // Newest first, and only the recent handful by default: the history grows
  // without bound and used to push the Kelly calculator an entire screen up.
  const orderedTx = useMemo(() => [...bankroll.transactions].reverse(), [bankroll.transactions]);
  const shownTx = allTxShown ? orderedTx : orderedTx.slice(0, TX_PREVIEW);
  const hiddenTxCount = orderedTx.length - shownTx.length;

  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACE.xl }}>

      {/* Summary card */}
      <View style={bk.summaryCard}>
        <Text style={bk.bankLabel}>{t('bankroll.currentBank')}</Text>
        <Text style={[bk.bankValue, { color: bank >= 0 ? colors.textPrimary : colors.lost }]}>
          {fmt(bank)}
        </Text>

        <View style={bk.metaRow}>
          <View style={bk.metaCell}>
            <Text style={bk.metaLabel}>{t('bankroll.deposited')}</Text>
            <Text style={bk.metaValue} numberOfLines={1} adjustsFontSizeToFit>{fmt(deposited)}</Text>
          </View>
          <View style={bk.metaCell}>
            <Text style={bk.metaLabel}>{t('bankroll.withdrawn')}</Text>
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
            {t('bankroll.atBookLine', { exposure: fmt(exposure), atBook: fmt(bank - exposure) })}
          </Text>
        )}

        {/* Unit % config */}
        <View style={bk.unitRow}>
          <View>
            <Text style={bk.metaLabel}>{t('bankroll.unit')}</Text>
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
              <Text style={bk.depositBtnText}>+ {t('bankroll.fill')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={bk.withdrawBtn} onPress={() => setActiveTxForm('withdrawal')}>
              <Text style={bk.withdrawBtnText}>− {t('bankroll.withdraw')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={bk.adjustBtn} onPress={() => setActiveTxForm('adjustment')}>
              <Text style={bk.adjustBtnText}>= {t('bankroll.reconcile')}</Text>
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
        <Text style={bk.historyTitle}>{t('bankroll.history')}</Text>
        <Text style={bk.historyHint}>{t('bankroll.holdToDelete')}</Text>
        {bankroll.transactions.length === 0 ? (
          <Text style={bk.emptyText}>{t('bankroll.noTransactions')}</Text>
        ) : (
          <>
            {shownTx.map((tx) => (
              <TxRow key={tx.id} tx={tx} onDelete={() => handleDeleteTx(tx.id)} />
            ))}
            {hiddenTxCount > 0 && (
              <TouchableOpacity
                style={bk.moreTx}
                onPress={() => { haptic.selection(); setAllTxShown(true); }}
                activeOpacity={0.8}
              >
                <Text style={bk.moreTxText}>{t('bankroll.moreTx', { count: hiddenTxCount })}</Text>
              </TouchableOpacity>
            )}
          </>
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
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACE.sm },
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
  seriesSwitch: {
    flexDirection: 'row', backgroundColor: colors.bgSunken,
    borderRadius: RADIUS.sm, padding: 2,
    borderWidth: 1, borderColor: colors.border,
  },
  seriesBtn: {
    height: SERIES_BTN_H, paddingHorizontal: SPACE.md,
    alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.xs,
  },
  seriesBtnActive: { backgroundColor: colors.bgElevated },
  seriesText: { fontSize: SIZE.caption, fontWeight: '700', color: colors.textMuted },
  seriesTextActive: { color: colors.textPrimary },
  moreTx: {
    minHeight: TOUCH, alignItems: 'center', justifyContent: 'center',
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgElevated, marginTop: SPACE.xs,
  },
  moreTxText: { fontSize: SIZE.body, fontWeight: '600', color: colors.textSecondary },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export function BankrollScreen() {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ProGate feature={t('bankroll.proFeatureFull')}>
        <BankrollContent />
      </ProGate>
    </View>
  );
}
