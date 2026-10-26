import React, { useLayoutEffect, useMemo, useState } from 'react';
import { SPACE, RADIUS, TOUCH, hitSlopFor } from '../../theme/layout';
import {
  View, TouchableOpacity, Modal, ScrollView, SectionList, useWindowDimensions,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DayStats } from '@sharklog/core';
import { summarizeDays } from '@sharklog/core';
import { useFormatMoney } from '../../utils/useFormatMoney';
import { haptic } from '../../utils/haptics';
import { colors, mix } from '../../theme/colors';
import { DailyChart, ChartLegend, SERIES, SCRIM, SCRIM_ALPHA, type ChartToggles } from './DailyChart';
import { SIZE, numeric } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { themedStyles } from '../../theme/themed';

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

/**
 * A block that darkens with the rest of the screen while a day is chosen. It
 * stands on an opaque page-coloured ground, so the veil over it lands on the
 * same colour as the darkened page in the gaps around it — one even dimming,
 * with the chosen day as the only hole. `edge` reaches over a bottom border.
 */
function Dim({ on, edge, style, children }: {
  on: boolean; edge?: boolean; style?: StyleProp<ViewStyle>; children: React.ReactNode;
}) {
  return (
    <View style={[ex.ground, style]}>
      {children}
      {on ? <View pointerEvents="none" style={edge ? ex.veilEdge : ex.veil} /> : null}
    </View>
  );
}

export function ExpandedDashboard({ visible, days, onClose }: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const fmt = useFormatMoney();
  const { t } = useTranslation();

  const [hideEmpty, setHideEmpty] = useState(false);
  const [hideNoResult, setHideNoResult] = useState(false);
  const [toggles, setToggles] = useState<ChartToggles>({ pnl: true, balance: false, cash: true });
  // The chosen day by DATE, not by index: the series can change under an open
  // view (a bet settled from a notification), and an index would silently
  // move the spotlight to a different day.
  const [selected, setSelected] = useState<string | null>(null);

  const shown = useMemo(() => {
    let out = days;
    if (hideEmpty) out = out.filter((d) => d.betCount > 0);
    if (hideNoResult) out = out.filter((d) => d.wonAmount > 0 || d.lostAmount > 0);
    return out;
  }, [days, hideEmpty, hideNoResult]);

  const summary = useMemo(() => summarizeDays(shown), [shown]);
  // Newest first: the table is read for the last days, and oldest-first put
  // them a year of rows down — a recent day picked on the chart lit a row
  // nobody could see.
  const sections = useMemo(
    () => (shown.length > 0 ? [{ key: 'days', data: [...shown].reverse() }] : []),
    [shown],
  );
  const selIndex = selected != null ? shown.findIndex((d) => d.date === selected) : -1;
  const sel = selIndex >= 0 ? shown[selIndex] ?? null : null;
  const spot = sel != null;

  const pick = (date: string) => {
    haptic.selection();
    setSelected((cur) => (cur === date ? null : date));
  };
  // Reopening should not greet the user with a darkened screen. Cleared on
  // OPEN, before the first frame, not on close: iOS keeps drawing the modal
  // through its fade-out, and a reset there lit the screen up mid-fade.
  useLayoutEffect(() => {
    if (visible) setSelected(null);
  }, [visible]);

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
  // The chart scrolls away with the table, so it no longer competes with the
  // rows for height and can be the size that reads.
  const chartH = Math.max(100, Math.round(LH * 0.34));

  const signed = (v: number) => `${v >= 0 ? '+' : ''}${fmt(v)}`;

  // Title, period totals, chart and legend scroll away with the table: in
  // landscape there are ~390 pt of height, and a fixed chart left the table
  // two rows. Only the bar with the controls stays put.
  const listHeader = (
    <View>
      <Dim on={spot} style={ex.titleRow}>
        <Text style={ex.title}>{t('dashboard.expTitle')}</Text>
        <Text style={ex.headerStat}>
          {t('dashboard.turnover')} <Text style={ex.headerStatVal}>{fmt(summary.turnover)}</Text>
        </Text>
        <Text style={ex.headerStat}>
          {t('dashboard.profit')} <Text style={[ex.headerStatVal, { color: summary.pnl >= 0 ? SERIES.win : SERIES.loss }]}>
            {signed(summary.pnl)}
          </Text>
        </Text>
        <Text style={ex.headerStat}>
          {t('dashboard.days')} <Text style={ex.headerStatVal}>{summary.activeDays}</Text>
          <Text style={ex.headerStatDim}>/{shown.length}</Text>
        </Text>
      </Dim>

      {shown.length > 0 ? (
        <>
          <View style={ex.chartWrap}>
            <DailyChart
              days={shown}
              width={chartW}
              height={chartH}
              toggles={toggles}
              selected={sel ? selIndex : null}
              onSelect={(i) => { const d = shown[i]; if (d) pick(d.date); }}
              spotlight
              fullDates
            />
          </View>
          <Dim on={spot}>
            <ChartLegend toggles={toggles} />
          </Dim>
        </>
      ) : (
        <Text style={ex.empty}>{t('dashboard.noDays')}</Text>
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      // Android "back" first lets go of the chosen day, then closes.
      onRequestClose={() => (spot ? setSelected(null) : onClose())}
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={{ flex: 1, backgroundColor: spot ? mix('#000000', colors.bg, SCRIM_ALPHA) : colors.bg }}>
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
          {/* Fixed bar. While a day is chosen it IS that day — same height as
              the controls it replaces, so nothing below shifts under the finger. */}
          <View style={ex.topBar}>
            {sel ? (
              <View style={ex.dayBar}>
                <View style={ex.dayDate}>
                  <Text style={ex.dayDateText}>{fmtDate(sel.date)}</Text>
                </View>
                <ScrollView
                  horizontal
                  keyboardShouldPersistTaps="handled"
                  showsHorizontalScrollIndicator={false}
                  style={ex.flex}
                  contentContainerStyle={ex.dayItems}
                >
                  <Text style={ex.selItem}>{t('dashboard.betsCol')} <Text style={ex.selVal}>{sel.betCount}</Text></Text>
                  <Text style={ex.selItem}>{t('dashboard.turnover')} <Text style={ex.selVal}>{fmt(sel.turnover)}</Text></Text>
                  <Text style={ex.selItem}>{t('dashboard.won')} <Text style={[ex.selVal, { color: SERIES.win }]}>{fmt(sel.wonAmount)}</Text></Text>
                  <Text style={ex.selItem}>{t('dashboard.lost')} <Text style={[ex.selVal, { color: SERIES.loss }]}>{fmt(sel.lostAmount)}</Text></Text>
                  <Text style={ex.selItem}>
                    {t('dashboard.profit')} <Text style={[ex.selVal, { color: sel.pnl >= 0 ? SERIES.win : SERIES.loss }]}>{signed(sel.pnl)}</Text>
                  </Text>
                  <Text style={ex.selItem}>{t('dashboard.balance')} <Text style={ex.selVal}>{fmt(sel.balance)}</Text></Text>
                </ScrollView>
                <TouchableOpacity
                  style={ex.dayClear}
                  onPress={() => { haptic.selection(); setSelected(null); }}
                  hitSlop={hitSlopFor({ width: TOUCH, height: TOUCH - 2 })}
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard.clearDay')}
                  activeOpacity={0.75}
                >
                  <Text style={ex.dayClearText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                horizontal
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
                style={ex.flex}
                contentContainerStyle={ex.controls}
              >
                <Text style={ex.controlLabel}>{t('dashboard.filterDays')}</Text>
                <Chip active={hideEmpty} label={t('dashboard.hideEmpty')} onPress={() => setHideEmpty((v) => !v)} />
                <Chip active={hideNoResult} label={t('dashboard.hideNoResult')} onPress={() => setHideNoResult((v) => !v)} />
                <View style={ex.controlDivider} />
                <Text style={ex.controlLabel}>{t('dashboard.chartLabel')}</Text>
                <Chip active={toggles.pnl} color={SERIES.pnl} label="P&L" onPress={() => setToggles((prev) => ({ ...prev, pnl: !prev.pnl }))} />
                <Chip active={toggles.balance} color={SERIES.balance} label={t('dashboard.balance')} onPress={() => setToggles((prev) => ({ ...prev, balance: !prev.balance }))} />
                <Chip active={toggles.cash} color={SERIES.deposit} label={t('dashboard.cashFlows')} onPress={() => setToggles((prev) => ({ ...prev, cash: !prev.cash }))} />
              </ScrollView>
            )}
            <TouchableOpacity onPress={onClose} style={ex.closeBtn} activeOpacity={0.75}>
              <Text style={ex.closeText}>✕ {t('common.collapse')}</Text>
              {spot ? <View pointerEvents="none" style={ex.veilFrame} /> : null}
            </TouchableOpacity>
          </View>

          <SectionList
            keyboardShouldPersistTaps="handled"
            sections={sections}
            keyExtractor={(d) => d.date}
            extraData={sel?.date ?? null}
            style={ex.list}
            ListHeaderComponent={listHeader}
            // The column names stay on top while the rows scroll under them.
            // Android does not stick section headers unless asked.
            stickySectionHeadersEnabled
            initialNumToRender={20}
            windowSize={9}
            renderSectionHeader={() => (
              <Dim on={spot} edge style={ex.tableHead}>
                <Text style={[ex.th, ex.cDate]}>{t('bet.date')}</Text>
                <Text style={[ex.th, ex.cNum]}>{t('dashboard.betsCol')}</Text>
                <Text style={[ex.th, ex.cMoney]}>{t('dashboard.turnover')}</Text>
                <Text style={[ex.th, ex.cMoney]}>{t('dashboard.won')}</Text>
                <Text style={[ex.th, ex.cMoney]}>{t('dashboard.lost')}</Text>
                <Text style={[ex.th, ex.cMoney]}>{t('dashboard.profit')}</Text>
                <Text style={[ex.th, ex.cMoney]}>{t('dashboard.balance')}</Text>
              </Dim>
            )}
            renderItem={({ item }) => {
              const isSel = item.date === sel?.date;
              return (
                <TouchableOpacity
                  style={[ex.tr, isSel && ex.trSel]}
                  onPress={() => pick(item.date)}
                  activeOpacity={0.7}
                >
                  {isSel ? <View style={ex.trMark} /> : null}
                  <Text style={[ex.td, isSel && ex.tdSel, ex.cDate]}>{fmtDate(item.date)}</Text>
                  <Text style={[ex.td, isSel && ex.tdSel, ex.cNum]}>{item.betCount || '—'}</Text>
                  <Text style={[ex.td, isSel && ex.tdSel, ex.cMoney]}>{item.turnover ? fmt(item.turnover) : '—'}</Text>
                  <Text style={[ex.td, isSel && ex.tdSel, ex.cMoney, item.wonAmount > 0 && { color: SERIES.win }]}>
                    {item.wonAmount ? fmt(item.wonAmount) : '—'}
                  </Text>
                  <Text style={[ex.td, isSel && ex.tdSel, ex.cMoney, item.lostAmount > 0 && { color: SERIES.loss }]}>
                    {item.lostAmount ? fmt(item.lostAmount) : '—'}
                  </Text>
                  <Text style={[ex.td, isSel && ex.tdSel, ex.cMoney, item.settledCount > 0 && { color: item.pnl >= 0 ? SERIES.win : SERIES.loss, fontWeight: '700' }]}>
                    {item.settledCount ? signed(item.pnl) : '—'}
                  </Text>
                  <Text style={[ex.td, isSel && ex.tdSel, ex.cMoney]}>{fmt(item.balance)}</Text>
                  {spot && !isSel ? <View pointerEvents="none" style={ex.veilEdge} /> : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const ex = themedStyles(() => ({
  flex: { flex: 1 },
  ground: { backgroundColor: colors.bg },
  veil: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: SCRIM },
  // Absolute insets count from the inside of the border (Yoga), so a veil that
  // stopped at 0 would leave the row's hairline bright across a dark table.
  veilEdge: { position: 'absolute', left: 0, right: 0, top: 0, bottom: -1, backgroundColor: SCRIM },
  veilFrame: {
    position: 'absolute', left: -1, right: -1, top: -1, bottom: -1,
    borderRadius: RADIUS.sm, backgroundColor: SCRIM,
  },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, height: TOUCH },
  closeBtn: {
    minHeight: TOUCH, justifyContent: 'center',
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, borderRadius: RADIUS.sm,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  closeText: { fontSize: SIZE.caption, color: colors.textSecondary, fontWeight: '600' },

  controls: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  controlLabel: { fontSize: SIZE.caption, color: colors.textMuted },
  controlDivider: { width: 1, height: 16, backgroundColor: colors.border, marginHorizontal: SPACE.xs },
  chip: {
    minHeight: TOUCH,
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xs,
    paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xs, borderRadius: RADIUS.sm,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.bgElevated, borderColor: colors.purple },
  chipDot: { width: 7, height: 7, borderRadius: RADIUS.xs },
  chipText: { fontSize: SIZE.caption, color: colors.textMuted },
  chipTextActive: { color: colors.textPrimary, fontWeight: '600' },

  dayBar: {
    flex: 1, height: TOUCH,
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingLeft: SPACE.xs,
    backgroundColor: colors.bgElevated, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: colors.purpleText,
  },
  dayDate: { backgroundColor: colors.purple, borderRadius: RADIUS.xs, paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xs },
  // White is a palette rule on `purple` (theme.test holds it at 4.4+ on every theme).
  dayDateText: { fontSize: SIZE.caption, fontWeight: '800', color: '#fff', ...numeric },
  dayItems: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingRight: SPACE.sm },
  dayClear: { width: TOUCH, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  dayClearText: { fontSize: SIZE.body, fontWeight: '700', color: colors.textSecondary },
  selItem: { fontSize: SIZE.caption, color: colors.textMuted },
  selVal: { fontSize: SIZE.caption, color: colors.textPrimary, fontWeight: '700', ...numeric },

  list: { flex: 1, marginTop: SPACE.sm },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    columnGap: SPACE.lg, rowGap: SPACE.xs, paddingVertical: SPACE.xs,
  },
  title: { fontSize: SIZE.lead, fontWeight: '800', color: colors.textPrimary },
  headerStat: { fontSize: SIZE.caption, color: colors.textMuted },
  headerStatVal: { fontSize: SIZE.caption, color: colors.textPrimary, fontWeight: '700', ...numeric },
  headerStatDim: { fontSize: SIZE.caption, color: colors.textMuted, fontWeight: '400', ...numeric },

  chartWrap: { marginTop: SPACE.sm },
  empty: { fontSize: SIZE.body, color: colors.textMuted, marginTop: SPACE.lg, textAlign: 'center' },

  tableHead: {
    flexDirection: 'row', paddingTop: SPACE.md, paddingBottom: SPACE.xs, paddingLeft: SPACE.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  th: { fontSize: SIZE.micro, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  tr: {
    minHeight: TOUCH, paddingLeft: SPACE.sm,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg,
    borderBottomWidth: 1, borderBottomColor: colors.border + '55',
  },
  // Opaque and lighter than the page: under the veil everything else drops to
  // ~45%, and this row is the one that stays lit.
  trSel: { backgroundColor: colors.bgElevated },
  trMark: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: colors.purpleText },
  td: { fontSize: SIZE.caption, color: colors.textSecondary, ...numeric },
  tdSel: { color: colors.textPrimary },
  cDate: { width: 60 },
  cNum: { width: 60, textAlign: 'right' },
  cMoney: { flex: 1, textAlign: 'right', paddingRight: SPACE.sm },
}));
