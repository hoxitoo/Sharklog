import React, { useMemo, useState } from 'react';
import { SPACE, RADIUS, TOUCH } from '../../theme/layout';
import {
  View, StyleSheet, TouchableOpacity, Modal, FlatList, useWindowDimensions,
} from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DayStats } from '@sharklog/core';
import { summarizeDays } from '@sharklog/core';
import { useFormatMoney } from '../../utils/useFormatMoney';
import { haptic } from '../../utils/haptics';
import { colors } from '../../theme/colors';
import { DailyChart, ChartLegend, SERIES, type ChartToggles } from './DailyChart';
import { SIZE } from '../../theme/typography';

interface Props {
  visible: boolean;
  days: DayStats[];       // full series (unfiltered)
  onClose: () => void;
}

function fmtDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${d}.${m}`;
}

function Chip({ active, label, color, onPress }: {
  active: boolean; label: string; color?: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[ex.chip, active && ex.chipActive, active && color ? { borderColor: color } : null]}
      onPress={() => { haptic.selection(); onPress(); }}
      activeOpacity={0.75}
    >
      {color ? <View style={[ex.chipDot, { backgroundColor: active ? color : colors.textMuted }]} /> : null}
      <Text style={[ex.chipText, active && ex.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ExpandedDashboard({ visible, days, onClose }: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const fmt = useFormatMoney();

  const [hideEmpty, setHideEmpty] = useState(false);
  const [hideNoResult, setHideNoResult] = useState(false);
  const [toggles, setToggles] = useState<ChartToggles>({ pnl: true, balance: false, cash: true });
  const [selected, setSelected] = useState<number | null>(null);

  const shown = useMemo(() => {
    let out = days;
    if (hideEmpty) out = out.filter((d) => d.betCount > 0);
    if (hideNoResult) out = out.filter((d) => d.wonAmount > 0 || d.lostAmount > 0);
    return out;
  }, [days, hideEmpty, hideNoResult]);

  const summary = useMemo(() => summarizeDays(shown), [shown]);
  const sel = selected != null ? shown[selected] ?? null : null;

  // Landscape canvas: swap W/H and rotate. Avoids a native orientation dependency
  // (adding one would force a fresh native build).
  const LW = H;
  const LH = W;

  // The canvas is rotated 90° CLOCKWISE, so the phone's edges map onto different
  // sides of our layout: phone-bottom (nav bar) becomes our RIGHT edge, phone-top
  // (status bar / notch) becomes our LEFT. Pad accordingly or controls sit under
  // the system buttons.
  const padTop = 12 + insets.right;
  const padRight = 16 + insets.bottom;
  const padBottom = 12 + insets.left;
  const padLeft = 16 + insets.top;
  const chartW = LW - padLeft - padRight;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View
          style={{
            position: 'absolute',
            width: LW,
            height: LH,
            left: (W - LW) / 2,
            top: (H - LH) / 2,
            transform: [{ rotate: '90deg' }],
            paddingTop: padTop,
            paddingRight: padRight,
            paddingBottom: padBottom,
            paddingLeft: padLeft,
          }}
        >
          {/* Header */}
          <View style={ex.header}>
            <Text style={ex.title}>Статистика по дням</Text>
            <View style={ex.headerStats}>
              <Text style={ex.headerStat}>
                Оборот <Text style={ex.headerStatVal}>{fmt(summary.turnover)}</Text>
              </Text>
              <Text style={ex.headerStat}>
                Профит <Text style={[ex.headerStatVal, { color: summary.pnl >= 0 ? SERIES.win : SERIES.loss }]}>
                  {summary.pnl >= 0 ? '+' : ''}{fmt(summary.pnl)}
                </Text>
              </Text>
              <Text style={ex.headerStat}>
                Дней <Text style={ex.headerStatVal}>{summary.activeDays}</Text>
                <Text style={ex.headerStatDim}>/{shown.length}</Text>
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={ex.closeBtn} activeOpacity={0.75}>
              <Text style={ex.closeText}>✕ Свернуть</Text>
            </TouchableOpacity>
          </View>

          {/* Filters + chart toggles */}
          <View style={ex.controls}>
            <Text style={ex.controlLabel}>Дни:</Text>
            <Chip active={hideEmpty} label="Скрыть без ставок" onPress={() => { setSelected(null); setHideEmpty((v) => !v); }} />
            <Chip active={hideNoResult} label="Скрыть без результата" onPress={() => { setSelected(null); setHideNoResult((v) => !v); }} />
            <View style={ex.controlDivider} />
            <Text style={ex.controlLabel}>График:</Text>
            <Chip active={toggles.pnl} color={SERIES.pnl} label="P&L" onPress={() => setToggles((t) => ({ ...t, pnl: !t.pnl }))} />
            <Chip active={toggles.balance} color={SERIES.balance} label="Баланс" onPress={() => setToggles((t) => ({ ...t, balance: !t.balance }))} />
            <Chip active={toggles.cash} color={SERIES.deposit} label="Деп/выводы" onPress={() => setToggles((t) => ({ ...t, cash: !t.cash }))} />
          </View>

          {/* Chart */}
          {shown.length > 0 ? (
            <View style={ex.chartWrap}>
              <DailyChart
                days={shown}
                width={chartW}
                height={Math.max(90, Math.round(LH * 0.28))}
                toggles={toggles}
                selected={selected}
                onSelect={(i) => { haptic.selection(); setSelected(i === selected ? null : i); }}
              />
            </View>
          ) : (
            <Text style={ex.empty}>Нет дней под выбранные фильтры</Text>
          )}

          {sel && (
            <View style={ex.selRow}>
              <Text style={ex.selDate}>{fmtDate(sel.date)}</Text>
              <Text style={ex.selItem}>Оборот <Text style={ex.selVal}>{fmt(sel.turnover)}</Text></Text>
              <Text style={ex.selItem}>Выигрыш <Text style={[ex.selVal, { color: SERIES.win }]}>{fmt(sel.wonAmount)}</Text></Text>
              <Text style={ex.selItem}>Проигрыш <Text style={[ex.selVal, { color: SERIES.loss }]}>{fmt(sel.lostAmount)}</Text></Text>
              <Text style={ex.selItem}>Профит <Text style={[ex.selVal, { color: sel.pnl >= 0 ? SERIES.win : SERIES.loss }]}>
                {sel.pnl >= 0 ? '+' : ''}{fmt(sel.pnl)}
              </Text></Text>
              <Text style={ex.selItem}>Баланс <Text style={ex.selVal}>{fmt(sel.balance)}</Text></Text>
            </View>
          )}

          <ChartLegend toggles={toggles} />

          {/* Day table */}
          <View style={ex.tableHead}>
            <Text style={[ex.th, ex.cDate]}>Дата</Text>
            <Text style={[ex.th, ex.cNum]}>Ставок</Text>
            <Text style={[ex.th, ex.cMoney]}>Оборот</Text>
            <Text style={[ex.th, ex.cMoney]}>Выигрыш</Text>
            <Text style={[ex.th, ex.cMoney]}>Проигрыш</Text>
            <Text style={[ex.th, ex.cMoney]}>Профит</Text>
            <Text style={[ex.th, ex.cMoney]}>Баланс</Text>
          </View>
          <FlatList
            data={shown}
            keyExtractor={(d) => d.date}
            style={{ flex: 1 }}
            initialNumToRender={20}
            windowSize={7}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[ex.tr, selected === index && ex.trSel]}
                onPress={() => { haptic.selection(); setSelected(index === selected ? null : index); }}
                activeOpacity={0.7}
              >
                <Text style={[ex.td, ex.cDate]}>{fmtDate(item.date)}</Text>
                <Text style={[ex.td, ex.cNum]}>{item.betCount || '—'}</Text>
                <Text style={[ex.td, ex.cMoney]}>{item.turnover ? fmt(item.turnover) : '—'}</Text>
                <Text style={[ex.td, ex.cMoney, item.wonAmount > 0 && { color: SERIES.win }]}>
                  {item.wonAmount ? fmt(item.wonAmount) : '—'}
                </Text>
                <Text style={[ex.td, ex.cMoney, item.lostAmount > 0 && { color: SERIES.loss }]}>
                  {item.lostAmount ? fmt(item.lostAmount) : '—'}
                </Text>
                <Text style={[ex.td, ex.cMoney, item.settledCount > 0 && { color: item.pnl >= 0 ? SERIES.win : SERIES.loss, fontWeight: '700' }]}>
                  {item.settledCount ? `${item.pnl >= 0 ? '+' : ''}${fmt(item.pnl)}` : '—'}
                </Text>
                <Text style={[ex.td, ex.cMoney]}>{fmt(item.balance)}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const ex = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  title: { fontSize: SIZE.lead, fontWeight: '800', color: colors.textPrimary },
  headerStats: { flexDirection: 'row', gap: SPACE.lg, flex: 1 },
  headerStat: { fontSize: SIZE.caption, color: colors.textMuted },
  headerStatVal: { fontSize: SIZE.caption, color: colors.textPrimary, fontWeight: '700' },
  headerStatDim: { fontSize: SIZE.caption, color: colors.textMuted, fontWeight: '400' },
  closeBtn: { minHeight: TOUCH, justifyContent: 'center',
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, borderRadius: RADIUS.sm,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  closeText: { fontSize: SIZE.caption, color: colors.textSecondary, fontWeight: '600' },

  controls: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.sm, flexWrap: 'wrap' },
  controlLabel: { fontSize: SIZE.caption, color: colors.textMuted },
  controlDivider: { width: 1, height: 16, backgroundColor: colors.border, marginHorizontal: SPACE.xs },
  chip: { minHeight: TOUCH,
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xs,
    paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xs, borderRadius: RADIUS.sm,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.bgElevated, borderColor: colors.purple },
  chipDot: { width: 7, height: 7, borderRadius: RADIUS.xs },
  chipText: { fontSize: SIZE.caption, color: colors.textMuted },
  chipTextActive: { color: colors.textPrimary, fontWeight: '600' },

  chartWrap: { marginTop: SPACE.sm },
  empty: { fontSize: SIZE.body, color: colors.textMuted, marginTop: SPACE.lg, textAlign: 'center' },

  selRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.sm,
    paddingVertical: SPACE.xs, paddingHorizontal: SPACE.sm,
    backgroundColor: colors.bgElevated, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  selDate: { fontSize: SIZE.caption, fontWeight: '800', color: colors.textPrimary },
  selItem: { fontSize: SIZE.caption, color: colors.textMuted },
  selVal: { fontSize: SIZE.caption, color: colors.textPrimary, fontWeight: '700' },

  tableHead: {
    flexDirection: 'row', marginTop: SPACE.md, paddingBottom: SPACE.xs,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  th: { fontSize: SIZE.micro, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  tr: { minHeight: TOUCH,
    flexDirection: 'row', paddingVertical: SPACE.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border + '55',
  },
  trSel: { backgroundColor: colors.bgElevated },
  td: { fontSize: SIZE.caption, color: colors.textSecondary },
  cDate: { width: 60 },
  cNum: { width: 60, textAlign: 'right' },
  cMoney: { flex: 1, textAlign: 'right', paddingRight: SPACE.sm },
});
