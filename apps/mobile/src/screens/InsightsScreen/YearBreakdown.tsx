import React, { useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import type { Bet, TournamentStats } from '@sharklog/core';
import { calcBetYears, betsInYear, calcByTournament } from '@sharklog/core';
import { colors, alpha } from '../../theme/colors';
import { numeric } from '../../theme/typography';
import { useFormatMoney } from '../../utils/useFormatMoney';
import { haptic } from '../../utils/haptics';

interface Props {
  bets: Bet[];
  /** Opens the bets behind one bar. `tournament` is empty for the untagged group. */
  onOpen: (year: number, tournament: string) => void;
}

/** Russian counts agree with the number: 1 ставка, 2 ставки, 5 ставок. */
function betsWord(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'ставок';
  switch (n % 10) {
    case 1: return 'ставка';
    case 2: case 3: case 4: return 'ставки';
    default: return 'ставок';
  }
}

/** Bars past this many are folded away — a long season has a long tail. */
const VISIBLE = 8;

/**
 * P&L per tournament for one calendar year, as a diverging bar chart.
 *
 * Bars grow from a centre line: profits right, losses left, on one shared scale.
 * Tournament names are long, so the bars run horizontally — vertical columns
 * would leave no room to write which tournament each one is.
 *
 * The year switch is built from the data plus the current year, so a new year
 * appears by itself when the calendar turns.
 */
export function YearBreakdown({ bets, onOpen }: Props) {
  const fmt = useFormatMoney();
  const years = useMemo(() => calcBetYears(bets), [bets]);
  // The switch always offers the current year, but starting on it in January
  // would show an empty chart with the whole history one chip away.
  const defaultYear = useMemo(
    () => years.find((yr) => bets.some((b) => b.date.startsWith(String(yr)))) ?? years[0]!,
    [years, bets],
  );
  const [year, setYear] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Null until the user picks; a picked year that no longer exists falls back.
  const active = year != null && years.includes(year) ? year : defaultYear;

  const rows = useMemo(
    () => calcByTournament(betsInYear(bets, active), { includeUntagged: true }),
    [bets, active],
  );

  const total = rows.reduce((sum, r) => sum + r.pnl, 0);
  const count = rows.reduce((sum, r) => sum + r.count, 0);
  // One shared scale, so a bar twice as long really is twice the money.
  const peak = Math.max(...rows.map((r) => Math.abs(r.pnl)), 1);
  const shown = expanded ? rows : rows.slice(0, VISIBLE);

  return (
    <View>
      <Text style={y.sectionTitle}>По годам</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={y.yearRow}
      >
        {years.map((yr) => (
          <TouchableOpacity
            key={yr}
            style={[y.yearChip, yr === active && y.yearChipActive]}
            onPress={() => { haptic.selection(); setYear(yr); setExpanded(false); }}
            activeOpacity={0.8}
          >
            <Text style={[y.yearLabel, yr === active && y.yearLabelActive]}>{yr}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={y.card}>
        <View style={y.head}>
          <Text style={y.headLabel}>Итог {active}</Text>
          <Text style={[y.headValue, { color: total > 0 ? colors.won : total < 0 ? colors.lost : colors.textMuted }]}>
            {total > 0 ? '+' : ''}{fmt(total)}
          </Text>
        </View>
        <Text style={y.headSub}>
          {count === 0 ? 'Ставок за этот год ещё нет' : `${count} ${betsWord(count)}`}
        </Text>

        {rows.length > 0 && (
          <View style={y.bars}>
            {shown.map((r) => (
              <Bar
                key={r.tournament || '__none__'}
                row={r}
                peak={peak}
                fmt={fmt}
                onPress={() => onOpen(active, r.tournament)}
              />
            ))}
          </View>
        )}

        {rows.length > VISIBLE && (
          <TouchableOpacity
            style={y.moreBtn}
            onPress={() => { haptic.selection(); setExpanded((v) => !v); }}
            activeOpacity={0.8}
          >
            <Text style={y.moreText}>
              {expanded ? 'Свернуть' : `Ещё ${rows.length - VISIBLE}`} {expanded ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function Bar({ row, peak, fmt, onPress }: {
  row: TournamentStats; peak: number; fmt: (k: number) => string; onPress: () => void;
}) {
  const positive = row.pnl >= 0;
  const accent = row.pnl > 0 ? colors.won : row.pnl < 0 ? colors.lost : colors.textMuted;
  // Half the track per side, so the centre line is the zero.
  const share = (Math.abs(row.pnl) / peak) * 50;
  const name = row.tournament || 'Без турнира';

  return (
    <TouchableOpacity style={y.barRow} onPress={onPress} activeOpacity={0.7}>
      <View style={y.barHead}>
        <Text
          style={[y.barName, !row.tournament && { color: colors.textMuted, fontStyle: 'italic' }]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text style={[y.barValue, { color: accent }]}>
          {row.pnl > 0 ? '+' : ''}{fmt(row.pnl)}
        </Text>
      </View>
      <View style={y.track}>
        <View style={y.zeroLine} />
        <View
          style={[
            y.bar,
            {
              backgroundColor: accent,
              width: `${Math.max(share, row.pnl === 0 ? 0 : 1)}%`,
              ...(positive ? { left: '50%' } : { right: '50%' }),
            },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
}

const y = StyleSheet.create({
  sectionTitle: {
    fontSize: 12, color: colors.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.6, fontWeight: '700', marginBottom: 10, marginTop: 6,
  },
  yearRow: { gap: 8, paddingBottom: 12 },
  yearChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  yearChipActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  yearLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  yearLabelActive: { color: '#fff', fontWeight: '700' },

  card: {
    backgroundColor: colors.bgCard, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 16,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  headLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  headValue: { ...numeric, fontSize: 17, fontWeight: '800' },
  headSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  bars: { marginTop: 14, gap: 12 },
  barRow: {},
  barHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 },
  barName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, flex: 1, marginRight: 8 },
  barValue: { ...numeric, fontSize: 12, fontWeight: '700' },
  track: {
    height: 10, borderRadius: 5, backgroundColor: colors.bgSunken,
    borderWidth: 1, borderColor: colors.border, justifyContent: 'center',
  },
  zeroLine: {
    position: 'absolute', left: '50%', top: 0, bottom: 0,
    width: 1, backgroundColor: alpha(colors.borderStrong, 0.9),
  },
  bar: { position: 'absolute', top: 1, bottom: 1, borderRadius: 4 },

  moreBtn: { alignItems: 'center', paddingTop: 14, paddingBottom: 2 },
  moreText: { fontSize: 13, fontWeight: '700', color: colors.purpleText },
});
