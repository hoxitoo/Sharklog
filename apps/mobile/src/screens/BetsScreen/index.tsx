import React, { useState, useMemo, useCallback, useRef } from 'react';
import { SPACE, RADIUS, TOUCH, FAB_CLEARANCE, hitSlopFor } from '../../theme/layout';
import { cardSurface } from '../../components/Card';
import {
  View, SectionList, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Image,
  Animated, Easing, type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../../components/AppText';
import type { TextInput as TextInputRef } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFormatMoney } from '../../utils/useFormatMoney';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Bet, BetStatus } from '@sharklog/core';
import { isInTilt, calcDailyBreakdown, currentBank, betBacksTeam, toYmd } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { colors, mix, toneSurface } from '../../theme/colors';
import type { BetsFilter } from '../../components/DrawerContext';
import { ScreenHeader } from '../../components/ScreenHeader';
import { BetCard } from './BetCard';
import { SwipeableRow } from './SwipeableRow';
import { FilterPicker } from '../../components/FilterPicker';
import { useBetActions } from '../../components/useBetActions';
import { Coachmark } from '../../components/Coachmark';
import { haptic } from '../../utils/haptics';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n/index';
import { SIZE, GLYPH, numeric } from '../../theme/typography';

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

type T = (key: string) => string;

/** Both filters spell out every option, so no state is hidden behind a toggle. */
const STATUS_OPTIONS = (t: T) => STATUS_FILTER_KEYS.map((key) => ({
  key,
  label: key === 'all' ? t('status.all') : t(`status.${key}`),
}));

const SEARCH_SLOP = hitSlopFor(28);

const SORT_OPTIONS = (t: T): Array<{ key: SortKey; label: string }> => [
  { key: 'date_desc',  label: t('bet.sortNewest') },
  { key: 'date_asc',   label: t('bet.sortOldest') },
  { key: 'odds_desc',  label: t('bet.sortOddsDesc') },
  { key: 'odds_asc',   label: t('bet.sortOddsAsc') },
  { key: 'stake_desc', label: t('bet.sortStakeDesc') },
  { key: 'stake_asc',  label: t('bet.sortStakeAsc') },
];

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
  const fmt = useFormatMoney();

  // The filter bar rides above the list rather than pushing it down, and when
  // you scroll it does not vanish — it collapses into a small floating tray
  // that still says what is filtered and what today came to. Vanishing left a
  // band of empty page at the top, because the list keeps the bar's padding.
  const [barHeight, setBarHeight] = useState(0);
  const [collapsedState, setCollapsedState] = useState(false);
  const barH = useRef(0);
  // 0 = full panel, 1 = tray. One value drives both layers so they cross-fade.
  const t01 = useRef(new Animated.Value(0)).current;
  const collapsed = useRef(false);
  const lastY = useRef(0);
  const listRef = useRef<SectionList<Bet, { title: string; dailyPnl: number }>>(null);

  const setCollapsed = useCallback((next: boolean) => {
    if (collapsed.current === next || barH.current === 0) return;
    collapsed.current = next;
    setCollapsedState(next);
    Animated.timing(t01, {
      toValue: next ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [t01]);

  // Distance since the last direction change, not the jump between two frames:
  // a slow drag delivers 1–3px per event and never crossed a per-event
  // threshold, so the panel could sit half-gone for another seven rows.
  const acc = useRef(0);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - lastY.current;
    lastY.current = y;
    // The list reserves the panel's height at the top. While any of that
    // reserved band is on screen the panel has to be in it, or the user sees a
    // strip of empty page where the panel used to be.
    if (y < barH.current) { acc.current = 0; setCollapsed(false); return; }
    if (dy === 0) return;
    // Reverse direction and the tally starts over, so a flick back up counts
    // from zero rather than having to undo the whole scroll down.
    if ((dy > 0) !== (acc.current > 0)) acc.current = 0;
    acc.current += dy;
    if (acc.current > 24) setCollapsed(true);
    else if (acc.current < -24) setCollapsed(false);
  }, [setCollapsed]);

  /** Tapping the tray returns to the top, where the full panel lives. */
  const searchRef = useRef<TextInputRef>(null);
  const expandFromTray = useCallback((focusSearch?: boolean) => {
    haptic.selection();
    listRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true });
    setCollapsed(false);
    // The magnifier is the collapsed form of the search field, so it should
    // land in the field — not merely show it.
    if (focusSearch) requestAnimationFrame(() => searchRef.current?.focus());
  }, [setCollapsed]);

  // A collapsed panel is only recoverable by scrolling up or tapping the tray,
  // so it must never be collapsed over a list that cannot scroll.
  const viewportH = useRef(0);
  const onContentSizeChange = useCallback((_w: number, h: number) => {
    if (h <= viewportH.current + barH.current) setCollapsed(false);
  }, [setCollapsed]);

  const onListLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    viewportH.current = e.nativeEvent.layout.height;
  }, []);

  const onBarLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    const h = e.nativeEvent.layout.height;
    if (h === barH.current) return;
    barH.current = h;
    setBarHeight(h);
  }, []);

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

      <View style={styles.body}>
        <SectionList
          ref={listRef}
          style={styles.listFlex}
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
                  {section.dailyPnl > 0 ? '+' : ''}{fmt(section.dailyPnl)}
                </Text>
              )}
            </View>
          // `fmt` is a fresh closure per render and carries the rounding
          // setting, so a memo that omits it freezes the section totals at
          // whatever the setting was on mount.
          ), [fmt])}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[styles.list, { paddingTop: barHeight }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
          onContentSizeChange={onContentSizeChange}
          onLayout={onListLayout}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.purple}
              colors={[colors.purple]}
              progressViewOffset={barHeight}
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

        {/* Two layers over the list: the full panel, and the tray it becomes. */}
        <Animated.View
          style={[styles.topBar, {
            opacity: t01.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: 'clamp' }),
            transform: [{ translateY: t01.interpolate({ inputRange: [0, 1], outputRange: [0, -barHeight] }) }],
          }]}
          pointerEvents={collapsedState ? 'none' : 'auto'}
          onLayout={onBarLayout}
        >
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
                  ? `${today.pnl >= 0 ? '+' : ''}${fmt(today.pnl)}`
                  : '—'}
              </Text>
              <Text style={styles.todaySub}>{today?.betCount ?? 0} ст. · {fmt(today?.turnover ?? 0)}</Text>
            </View>
            <View style={styles.todayDivider} />
            <TouchableOpacity
              style={styles.todayCell}
              onPress={() => { haptic.selection(); navigation.navigate('Pending'); }}
              activeOpacity={0.75}
            >
              <Text style={styles.todayLabel}>В игре →</Text>
              <Text style={[styles.todayValue, { color: exposure > 0 ? colors.pending : colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit>
                {exposure > 0 ? fmt(exposure) : '—'}
              </Text>
              <Text style={styles.todaySub}>закрыть результаты</Text>
            </TouchableOpacity>
            <View style={styles.todayDivider} />
            <TouchableOpacity style={styles.todayCell} onPress={() => { haptic.selection(); navigation.navigate('Bankroll'); }} activeOpacity={0.75}>
              <Text style={styles.todayLabel}>Банк →</Text>
              <Text style={[styles.todayValue, { color: bank >= 0 ? colors.textPrimary : colors.lost }]} numberOfLines={1} adjustsFontSizeToFit>
                {fmt(bank)}
              </Text>
              <Text style={styles.todaySub}>текущий баланс</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            ref={searchRef}
            style={styles.search}
            placeholder={t('bet.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />

          <View style={styles.filterRow}>
            <FilterPicker
              label={t('bet.filterStatus')}
              options={STATUS_OPTIONS(t)}
              value={statusFilter}
              onChange={setStatusFilter}
              active={statusFilter !== 'all'}
            />
            <FilterPicker
              label={t('bet.filterSort')}
              options={SORT_OPTIONS(t)}
              value={sort}
              onChange={setSort}
              active={sort !== 'date_desc'}
            />
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
        </Animated.View>

        {/* The collapsed form: a floating pill that still answers "what am I
            looking at, and how did today go", and taps back to the top. */}
        <Animated.View
          style={[styles.trayWrap, {
            opacity: t01.interpolate({ inputRange: [0.4, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
            transform: [
              { translateY: t01.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
              { scale: t01.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
            ],
          }]}
          pointerEvents={collapsedState ? 'box-none' : 'none'}
        >
          <TouchableOpacity style={styles.tray} onPress={() => expandFromTray()} activeOpacity={0.85}>
            <TouchableOpacity
              style={styles.traySearch}
              onPress={() => expandFromTray(true)}
              hitSlop={SEARCH_SLOP}
              activeOpacity={0.7}
            >
              <Ionicons name="search" size={GLYPH.md} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.trayDivider} />

            <View style={styles.trayCell}>
              {/* Same words as the expanded panel, so the tray reads as the
                  same thing shrunk rather than a different one. */}
              <Text style={styles.trayLabel}>Банк</Text>
              <Text style={[styles.trayValue, { color: bank >= 0 ? colors.textPrimary : colors.lost }]}
                numberOfLines={1} adjustsFontSizeToFit>
                {fmt(bank)}
              </Text>
            </View>

            <View style={styles.trayDivider} />

            <View style={styles.trayCell}>
              <Text style={styles.trayLabel}>В игре</Text>
              <Text style={[styles.trayValue, { color: exposure > 0 ? colors.pending : colors.textMuted }]}
                numberOfLines={1} adjustsFontSizeToFit>
                {exposure > 0 ? fmt(exposure) : '—'}
              </Text>
            </View>

            {statusFilter !== 'all' && (
              <View style={styles.trayFilterDot} />
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>


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
  filterRow: { flexDirection: 'row', gap: SPACE.sm, marginHorizontal: SPACE.lg, marginBottom: SPACE.sm },
  dateChip: {
    minHeight: TOUCH,
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, alignSelf: 'flex-start',
    marginHorizontal: SPACE.lg, marginBottom: SPACE.sm, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm,
    backgroundColor: colors.purpleDim, borderRadius: RADIUS.pill,
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
  // overflow hidden, or the hidden bar keeps painting over the screen header:
  // RN does not clip absolutely-positioned children by default.
  body: { flex: 1, overflow: 'hidden' },
  // Absolute so sliding it never reflows the list, and last in the tree so it
  // paints over the rows on both platforms without fighting zIndex.
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: colors.bg,
    paddingBottom: SPACE.xs,
    // The cards carry elevation 3 of their own, and on Android that can lift a
    // row above a sibling that merely comes later in the tree.
    zIndex: 2, elevation: 4,
  },
  listFlex: { flex: 1 },
  trayWrap: { position: 'absolute', top: SPACE.sm, left: 0, right: 0, alignItems: 'center' },
  tray: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm,
    marginHorizontal: SPACE.lg,
    backgroundColor: colors.bgElevated,
    borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: colors.borderStrong,
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  traySearch: {
    width: 28, height: 28, borderRadius: RADIUS.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  trayDivider: { width: 1, height: 24, backgroundColor: colors.border },
  trayCell: { alignItems: 'center', minWidth: 76 },
  trayLabel: { fontSize: SIZE.micro, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  trayValue: { ...numeric, fontSize: SIZE.body, fontWeight: '700', marginTop: 1 },
  /** A live status filter is not visible in the collapsed form otherwise. */
  trayFilterDot: { width: 6, height: 6, borderRadius: RADIUS.pill, backgroundColor: colors.purple },
  list: { paddingBottom: FAB_CLEARANCE }, // clear the floating "+" FAB so the last row isn't covered
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
  empty: { alignItems: 'center', paddingTop: 80 },
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
