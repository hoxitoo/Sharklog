import React, { useState, useMemo, useCallback } from 'react';
import {
  View, SectionList, StyleSheet, TouchableOpacity, Text, TextInput, ScrollView, RefreshControl, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Bet, BetStatus } from '@sharklog/core';
import { formatMoney, isInTilt, calcDailyBreakdown, calcDashboard } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { colors } from '../../theme/colors';
import { ScreenHeader } from '../../components/ScreenHeader';
import { BetCard } from './BetCard';
import { SwipeableRow } from './SwipeableRow';
import { Coachmark } from '../../components/Coachmark';
import { haptic } from '../../utils/haptics';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n/index';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function formatDateTitle(dateStr: string, todayLabel: string, yesterdayLabel: string): string {
  const todayStr = new Date().toISOString().split('T')[0] ?? '';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0] ?? '';
  if (dateStr === todayStr) return todayLabel;
  if (dateStr === yesterdayStr) return yesterdayLabel;
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1);
  const locale = i18n.language === 'en' ? 'en-US' : 'ru-RU';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
}

const STATUS_FILTER_KEYS: Array<BetStatus | 'all'> = ['all', 'pending', 'won', 'lost', 'refund', 'cashout'];

type SortKey = 'date_desc' | 'date_asc' | 'odds_desc' | 'odds_asc' | 'stake_desc' | 'stake_asc';

export function BetsScreen({ dateFilter, onClearDateFilter }: {
  dateFilter?: string | null;
  onClearDateFilter?: () => void;
} = {}) {
  const navigation = useNavigation<Nav>();
  const { bets, settings, bankroll, deleteBet } = useBetsStore();
  const { t } = useTranslation();
  const todayLabel = t('dashboard.today');
  const yesterdayLabel = t('dashboard.yesterday');
  const inTilt = isInTilt(bets, settings.tiltThreshold);
  const [statusFilter, setStatusFilter] = useState<BetStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('date_desc');
  const [refreshing, setRefreshing] = useState(false);

  // Working context while logging bets: today's result, money currently at risk, bank.
  const today = useMemo(() => calcDailyBreakdown(bets, [], { days: 1 })[0] ?? null, [bets]);
  const exposure = useMemo(
    () => bets.filter((b) => b.status === 'pending').reduce((sum, b) => sum + b.stake, 0),
    [bets],
  );
  const bank = useMemo(() => {
    const cash = bankroll.transactions.reduce(
      (sum, t) => (t.type === 'deposit' ? sum + t.amount : sum - t.amount), 0);
    return cash + calcDashboard(bets).pnl;
  }, [bets, bankroll.transactions]);

  const onRefresh = useCallback(() => {
    // Data is local and reactive — there's nothing to fetch. Acknowledge the gesture
    // but do NOT wipe the user's active search/filter/sort (that was destructive).
    setRefreshing(true);
    haptic.selection();
    setTimeout(() => setRefreshing(false), 300);
  }, []);

  const sections = useMemo(() => {
    let result = [...bets];
    if (dateFilter) result = result.filter((b) => b.date === dateFilter);
    if (statusFilter !== 'all') result = result.filter((b) => b.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) => b.event.toLowerCase().includes(q) || b.pick.toLowerCase().includes(q),
      );
    }

    // For odds/stake sorts — flat global list (no date grouping)
    const isGlobalSort = sort === 'odds_desc' || sort === 'odds_asc' || sort === 'stake_desc' || sort === 'stake_asc';
    if (isGlobalSort) {
      result.sort((a, b) => {
        switch (sort) {
          case 'odds_desc': return b.odds - a.odds;
          case 'odds_asc': return a.odds - b.odds;
          case 'stake_desc': return b.stake - a.stake;
          case 'stake_asc': return a.stake - b.stake;
          default: return 0;
        }
      });
      const totalPnl = result.reduce((sum, b) => {
        if (b.status === 'won') return sum + Math.round(b.stake * b.odds) - b.stake;
        if (b.status === 'lost') return sum - b.stake;
        if (b.status === 'cashout' && b.cashoutAmount != null) return sum + b.cashoutAmount - b.stake;
        return sum;
      }, 0);
      return [{ title: t('bet.allBets'), date: '', dailyPnl: totalPnl, data: result }];
    }

    // Group by date for date sorts
    const map = new Map<string, Bet[]>();
    for (const bet of result) {
      const arr = map.get(bet.date) ?? [];
      arr.push(bet);
      map.set(bet.date, arr);
    }
    const sortedDates = [...map.keys()].sort((a, b) =>
      sort === 'date_asc' ? a.localeCompare(b) : b.localeCompare(a),
    );
    return sortedDates.map((date) => {
      const data = [...(map.get(date) ?? [])];
      data.sort((a, b) =>
        sort === 'date_asc'
          ? (a.time ?? '').localeCompare(b.time ?? '')
          : (b.time ?? '').localeCompare(a.time ?? ''),
      );
      const dailyPnl = data.reduce((sum, b) => {
        if (b.status === 'won') return sum + Math.round(b.stake * b.odds) - b.stake;
        if (b.status === 'lost') return sum - b.stake;
        if (b.status === 'cashout' && b.cashoutAmount != null) return sum + b.cashoutAmount - b.stake;
        return sum;
      }, 0);
      return { title: formatDateTitle(date, todayLabel, yesterdayLabel), date, dailyPnl, data };
    });
  }, [bets, statusFilter, search, sort, dateFilter]);

  const freeLeft = Math.max(0, 50 - bets.length);

  function handleEdit(bet: Bet) {
    navigation.navigate('AddBet', { betId: bet.id });
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t('nav.bets')}
        subtitle={settings.isPro ? `${bets.length} ${t('common.bets')}` : `${freeLeft} ${t('common.of')} 50`}
      />

      {dateFilter && (
        <TouchableOpacity
          style={styles.dateChip}
          onPress={() => { haptic.selection(); onClearDateFilter?.(); }}
          activeOpacity={0.75}
        >
          <Text style={styles.dateChipText}>
            Только {dateFilter.split('-').reverse().slice(0, 2).join('.')}
          </Text>
          <Text style={styles.dateChipX}>✕</Text>
        </TouchableOpacity>
      )}

      <View style={styles.todayStrip}>
        <View style={styles.todayCell}>
          <Text style={styles.todayLabel}>Сегодня</Text>
          <Text style={[
            styles.todayValue,
            { color: !today || today.settledCount === 0 ? colors.textMuted
              : today.pnl >= 0 ? colors.won : colors.lost },
          ]} numberOfLines={1} adjustsFontSizeToFit>
            {today && today.settledCount > 0
              ? `${today.pnl >= 0 ? '+' : ''}${formatMoney(today.pnl)}`
              : '—'}
          </Text>
          <Text style={styles.todaySub}>{today?.betCount ?? 0} ст. · {formatMoney(today?.turnover ?? 0)}</Text>
        </View>
        <View style={styles.todayDivider} />
        <TouchableOpacity
          style={styles.todayCell}
          onPress={() => { haptic.selection(); navigation.navigate('Pending'); }}
          activeOpacity={0.75}
        >
          <Text style={styles.todayLabel}>В игре →</Text>
          <Text style={[styles.todayValue, { color: exposure > 0 ? colors.pending : colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit>
            {exposure > 0 ? formatMoney(exposure) : '—'}
          </Text>
          <Text style={styles.todaySub}>закрыть результаты</Text>
        </TouchableOpacity>
        <View style={styles.todayDivider} />
        <TouchableOpacity style={styles.todayCell} onPress={() => { haptic.selection(); navigation.navigate('Bankroll'); }} activeOpacity={0.75}>
          <Text style={styles.todayLabel}>Банк →</Text>
          <Text style={[styles.todayValue, { color: bank >= 0 ? colors.textPrimary : colors.lost }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(bank)}
          </Text>
          <Text style={styles.todaySub}>текущий баланс</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.search}
        placeholder={t('bet.searchPlaceholder')}
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filters}>
        {STATUS_FILTER_KEYS.map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.filterBtn, statusFilter === key && styles.filterBtnActive]}
            onPress={() => { haptic.selection(); setStatusFilter(key); }}
          >
            <Text style={[styles.filterText, statusFilter === key && styles.filterTextActive]}>
              {key === 'all' ? t('status.all') : t(`status.${key}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.sortRow}>
        {(['date_desc', 'date_asc', 'odds_desc', 'stake_desc'] as const).map((key) => {
          const isOdds = key === 'odds_desc';
          const isStake = key === 'stake_desc';
          const isActive =
            sort === key ||
            (isOdds && sort === 'odds_asc') ||
            (isStake && sort === 'stake_asc');
          const label = isOdds
            ? `${t('bet.sortByOdds')} ${sort === 'odds_asc' ? '↑' : '↓'}`
            : isStake
            ? `${t('bet.sortByStake')} ${sort === 'stake_asc' ? '↑' : '↓'}`
            : key === 'date_desc' ? t('bet.sortNewest') : t('bet.sortOldest');
          return (
            <TouchableOpacity
              key={key}
              style={[styles.sortBtn, isActive && styles.sortBtnActive]}
              onPress={() => {
                haptic.selection();
                if (isOdds) setSort(sort === 'odds_desc' ? 'odds_asc' : 'odds_desc');
                else if (isStake) setSort(sort === 'stake_desc' ? 'stake_asc' : 'stake_desc');
                else setSort(key);
              }}
            >
              <Text style={[styles.sortText, isActive && styles.sortTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {inTilt && (
        <View style={styles.tiltBanner}>
          <Text style={styles.tiltEmoji}>🔥</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.tiltTitle}>{t('bet.tiltTitle')}</Text>
            <Text style={styles.tiltSub}>{t('bet.tiltSub')}</Text>
          </View>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={useCallback(({ item }: { item: import('@sharklog/core').Bet }) => (
          <SwipeableRow onDelete={() => { haptic.error(); deleteBet(item.id); }}>
            <BetCard bet={item} onEdit={handleEdit} />
          </SwipeableRow>
        // eslint-disable-next-line react-hooks/exhaustive-deps
        ), [deleteBet, handleEdit])}
        renderSectionHeader={useCallback(({ section }: { section: { title: string; dailyPnl: number } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionDate}>{section.title}</Text>
            {section.dailyPnl !== 0 && (
              <Text style={[styles.sectionPnl, { color: section.dailyPnl > 0 ? colors.won : colors.lost }]}>
                {section.dailyPnl > 0 ? '+' : ''}{formatMoney(section.dailyPnl)}
              </Text>
            )}
          </View>
        ), [])}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.purple}
            colors={[colors.purple]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Image source={require('../../../assets/icon.png')} style={styles.emptyIcon} resizeMode="contain" />
            <Text style={styles.emptyTitle}>{t('bet.noBetsYet')}</Text>
            <Text style={styles.emptySubtitle}>
              {search ? t('bet.notFound') : t('bet.noBetsStart')}
            </Text>
          </View>
        }
      />

      {!settings.isPro && bets.length >= 40 && (
        <View style={styles.limitBanner}>
          <Text style={styles.limitText}>
            {50 - bets.length <= 0
              ? t('bet.limitReached', { count: 50 })
              : t('bet.limitWarning', { count: 50 - bets.length })}
          </Text>
        </View>
      )}

      <Coachmark
        storageKey="@sharklog/tip_bets_seen"
        title={t('nav.bets')}
        body="Swipe left to delete · Tap to edit · + to add new"
        position="bottom"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  search: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filtersScroll: { marginBottom: 8, flexGrow: 0, flexShrink: 0 },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    paddingBottom: 2,
    alignItems: 'center',
  },
  filterBtn: {
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'center',
  },
  filterBtnActive: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  filterText: { fontSize: 12, color: colors.textSecondary },
  filterTextActive: { color: '#fff', fontWeight: '700' },
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 10,
    alignItems: 'center',
  },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortBtnActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  sortText: { fontSize: 11, color: colors.textMuted },
  sortTextActive: { color: colors.accent, fontWeight: '600' },
  dateChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: colors.purpleDim, borderRadius: 20,
    borderWidth: 1, borderColor: colors.purple,
  },
  dateChipText: { fontSize: 12, color: colors.purple, fontWeight: '700' },
  dateChipX: { fontSize: 12, color: colors.purple, fontWeight: '700' },
  todayStrip: {
    flexDirection: 'row', alignItems: 'stretch',
    marginHorizontal: 16, marginBottom: 12, padding: 12,
    backgroundColor: colors.bgCard, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  todayCell: { flex: 1, paddingHorizontal: 4 },
  todayDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: 4 },
  todayLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  todayValue: { fontSize: 16, fontWeight: '800', marginTop: 3 },
  todaySub: { fontSize: 9, color: colors.textMuted, marginTop: 2 },
  list: { paddingBottom: 96 }, // clear the floating "+" FAB so the last row isn't covered
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  sectionDate: { fontSize: 11, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionPnl: { fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { width: 90, height: 90, marginBottom: 12, alignSelf: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  limitBanner: {
    margin: 16,
    padding: 12,
    backgroundColor: '#FF47570F',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.lost + '44',
  },
  limitText: { color: colors.lost, fontSize: 13, textAlign: 'center', fontWeight: '600' },
  tiltBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    backgroundColor: colors.lost + '18',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lost + '55',
  },
  tiltEmoji: { fontSize: 22 },
  tiltTitle: { fontSize: 14, fontWeight: '700', color: colors.lost },
  tiltSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
