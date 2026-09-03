import React, { useState, useMemo, useCallback } from 'react';
import { SPACE, RADIUS, TOUCH } from '../../theme/layout';
import { cardSurface } from '../../components/Card';
import {
  View, SectionList, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Image,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../../components/AppText';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Bet, BetStatus } from '@sharklog/core';
import { formatMoney, isInTilt, calcDailyBreakdown, currentBank, betBacksTeam, toYmd } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { colors, mix, toneSurface } from '../../theme/colors';
import type { BetsFilter } from '../../components/DrawerContext';
import { ScreenHeader } from '../../components/ScreenHeader';
import { BetCard } from './BetCard';
import { SwipeableRow } from './SwipeableRow';
import { useBetActions } from '../../components/useBetActions';
import { Coachmark } from '../../components/Coachmark';
import { haptic } from '../../utils/haptics';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n/index';
import { SIZE, GLYPH } from '../../theme/typography';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function formatDateTitle(dateStr: string, todayLabel: string, yesterdayLabel: string): string {
  const todayStr = toYmd(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toYmd(yesterday);
  if (dateStr === todayStr) return todayLabel;
  if (dateStr === yesterdayStr) return yesterdayLabel;
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1);
  const locale = i18n.language === 'en' ? 'en-US' : 'ru-RU';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
}

const STATUS_FILTER_KEYS: Array<BetStatus | 'all'> = ['all', 'pending', 'won', 'lost', 'refund', 'cashout'];

type SortKey = 'date_desc' | 'date_asc' | 'odds_desc' | 'odds_asc' | 'stake_desc' | 'stake_asc';

export function BetsScreen({ filter, onClearFilter }: {
  filter?: BetsFilter | null;
  onClearFilter?: () => void;
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
  const bank = useMemo(
    () => currentBank(bankroll.transactions, bets),
    [bets, bankroll.transactions],
  );

  const onRefresh = useCallback(() => {
    // Data is local and reactive — there's nothing to fetch. Acknowledge the gesture
    // but do NOT wipe the user's active search/filter/sort (that was destructive).
    setRefreshing(true);
    haptic.selection();
    setTimeout(() => setRefreshing(false), 300);
  }, []);

  const filterLabel = useMemo(() => {
    const dm = (ymd: string) => ymd.split('-').reverse().slice(0, 2).join('.');
    // The period suffix matters: without it the count here would not match the
    // Insights tile the user tapped, and a mismatched number reads as a bug.
    const since = filter?.from ? ` · с ${dm(filter.from)}` : '';
    const year = filter?.year ? ` · ${filter.year}` : '';
    if (filter?.date) return `Только ${dm(filter.date)}`;
    if (filter?.tournament) return `Турнир: ${filter.tournament}${year}${since}`;
    if (filter?.noTournament) return `Без турнира${year}${since}`;
    if (filter?.team) return `Команда: ${filter.team}${year}${since}`;
    if (filter?.year) return `${filter.year} год`;
    return null;
  }, [filter]);

  const sections = useMemo(() => {
    let result = [...bets];
    if (filter?.date) result = result.filter((b) => b.date === filter.date);
    if (filter?.tournament) {
      // Trimmed on both sides: calcByTournament groups on the trimmed name, so
      // comparing the raw one would let a bar count bets the list then hides.
      const want = filter.tournament.trim().toLowerCase();
      result = result.filter((b) => (b.tournament ?? '').trim().toLowerCase() === want);
    }
    if (filter?.team) result = result.filter((b) => betBacksTeam(b, filter.team!));
    if (filter?.from) result = result.filter((b) => b.date > filter.from!);
    if (filter?.year) result = result.filter((b) => b.date.startsWith(String(filter.year)));
    if (filter?.noTournament) result = result.filter((b) => !(b.tournament ?? '').trim());
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
  }, [bets, statusFilter, search, sort, filter, todayLabel, yesterdayLabel, t]);

  const freeLeft = Math.max(0, 50 - bets.length);

  const betActions = useBetActions();

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t('nav.bets')}
        subtitle={settings.isPro ? `${bets.length} ${t('common.bets')}` : `${freeLeft} ${t('common.of')} 50`}
      />

      {filterLabel && (
        <TouchableOpacity
          style={styles.dateChip}
          onPress={() => { haptic.selection(); onClearFilter?.(); }}
          activeOpacity={0.75}
        >
          <Text style={styles.dateChipText} numberOfLines={1}>{filterLabel}</Text>
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
            <BetCard
              bet={item}
              onPress={betActions.open}
              cashoutOpen={betActions.cashoutFor === item.id}
              onRequestCashout={() => betActions.openCashout(item.id)}
              onCloseCashout={betActions.closeCashout}
            />
          </SwipeableRow>
        // eslint-disable-next-line react-hooks/exhaustive-deps
        ), [deleteBet, betActions.cashoutFor])}
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
            <Image source={require('../../../assets/adaptive-icon.png')} style={styles.emptyIcon} resizeMode="contain" />
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
        body={t('bet.tipWheel')}
        position="bottom"
      />

      {betActions.element}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  search: {
    marginHorizontal: SPACE.lg,
    marginBottom: SPACE.sm,
    backgroundColor: colors.bgCard,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    color: colors.textPrimary,
    fontSize: SIZE.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filtersScroll: { marginBottom: SPACE.sm, flexGrow: 0, flexShrink: 0 },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: SPACE.lg,
    gap: SPACE.xs,
    paddingBottom: 2,
    alignItems: 'center',
  },
  filterBtn: { minHeight: TOUCH, justifyContent: 'center',
    flexShrink: 0,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.sm,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'center',
  },
  filterBtnActive: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  filterText: { fontSize: SIZE.caption, color: colors.textSecondary },
  filterTextActive: { color: '#fff', fontWeight: '700' },
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACE.lg,
    gap: SPACE.xs,
    marginBottom: SPACE.sm,
    alignItems: 'center',
  },
  sortBtn: { minHeight: TOUCH, justifyContent: 'center',
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortBtnActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  sortText: { fontSize: SIZE.caption, color: colors.textMuted },
  sortTextActive: { color: colors.accent, fontWeight: '600' },
  dateChip: { minHeight: TOUCH,
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, alignSelf: 'flex-start',
    marginHorizontal: SPACE.lg, marginBottom: SPACE.sm, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm,
    backgroundColor: colors.purpleDim, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: colors.purple,
  },
  dateChipText: { fontSize: SIZE.caption, color: colors.purpleText, fontWeight: '700' },
  dateChipX: { fontSize: SIZE.caption, color: colors.purpleText, fontWeight: '700' },
  todayStrip: {
    ...cardSurface, ...toneSurface('info'),
    flexDirection: 'row', alignItems: 'stretch',
    marginHorizontal: SPACE.lg, marginBottom: SPACE.md, padding: SPACE.md,
  },
  todayCell: { flex: 1, paddingHorizontal: SPACE.xs },
  todayDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: SPACE.xs },
  todayLabel: { fontSize: SIZE.micro, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  todayValue: { fontSize: SIZE.lead, fontWeight: '800', marginTop: 3 },
  todaySub: { fontSize: SIZE.micro, color: colors.textMuted, marginTop: 2 },
  list: { paddingBottom: SPACE.xxl }, // clear the floating "+" FAB so the last row isn't covered
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.xs,
  },
  sectionDate: { fontSize: SIZE.caption, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionPnl: { fontSize: SIZE.caption, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: SPACE.xxl },
  emptyIcon: { width: 90, height: 90, marginBottom: SPACE.md, alignSelf: 'center' },
  emptyTitle: { fontSize: SIZE.title, fontWeight: '600', color: colors.textPrimary, marginBottom: SPACE.xs },
  emptySubtitle: { fontSize: SIZE.body, color: colors.textSecondary, textAlign: 'center' },
  limitBanner: {
    margin: SPACE.lg,
    padding: SPACE.md,
    backgroundColor: mix(colors.lost, colors.bgCard, 0.06),
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: colors.lost + '44',
  },
  limitText: { color: colors.lost, fontSize: SIZE.body, textAlign: 'center', fontWeight: '600' },
  tiltBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    marginHorizontal: SPACE.lg,
    marginBottom: SPACE.sm,
    padding: SPACE.md,
    backgroundColor: colors.lost + '18',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.lost + '55',
  },
  tiltEmoji: { fontSize: GLYPH.lg },
  tiltTitle: { fontSize: SIZE.body, fontWeight: '700', color: colors.lost },
  tiltSub: { fontSize: SIZE.caption, color: colors.textSecondary, marginTop: 2 },
});
