import React, { useState, useMemo, useCallback } from 'react';
import {
  View, SectionList, StyleSheet, TouchableOpacity, Text, TextInput, ScrollView, Alert, RefreshControl, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Bet, BetStatus } from '@sharklog/core';
import { formatMoney, isInTilt } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { colors } from '../../theme/colors';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ChecklistModal } from '../../components/ChecklistModal';
import { BetCard } from './BetCard';
import { SwipeableRow } from './SwipeableRow';
import { haptic } from '../../utils/haptics';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function formatDateTitle(dateStr: string): string {
  const todayStr = new Date().toISOString().split('T')[0] ?? '';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0] ?? '';
  if (dateStr === todayStr) return 'Сегодня';
  if (dateStr === yesterdayStr) return 'Вчера';
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

const STATUS_FILTERS: Array<{ key: BetStatus | 'all'; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'pending', label: 'Ожидание' },
  { key: 'won', label: 'Победы' },
  { key: 'lost', label: 'Проигрыши' },
  { key: 'refund', label: 'Возвраты' },
  { key: 'cashout', label: 'Выкупы' },
];

type SortKey = 'date_desc' | 'date_asc' | 'odds_desc' | 'odds_asc' | 'stake_desc' | 'stake_asc';

export function BetsScreen() {
  const navigation = useNavigation<Nav>();
  const { bets, settings, canAddBet, deleteBet } = useBetsStore();
  const inTilt = isInTilt(bets, settings.tiltThreshold);
  const [statusFilter, setStatusFilter] = useState<BetStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('date_desc');
  const [showChecklist, setShowChecklist] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    haptic.selection();
    // Reset filters to show all bets fresh
    setSearch('');
    setStatusFilter('all');
    setSort('date_desc');
    setTimeout(() => setRefreshing(false), 400);
  }, []);

  const sections = useMemo(() => {
    let result = [...bets];
    if (statusFilter !== 'all') result = result.filter((b) => b.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) => b.event.toLowerCase().includes(q) || b.pick.toLowerCase().includes(q),
      );
    }
    // Group by date
    const map = new Map<string, Bet[]>();
    for (const bet of result) {
      const arr = map.get(bet.date) ?? [];
      arr.push(bet);
      map.set(bet.date, arr);
    }
    // Sort section dates
    const sortedDates = [...map.keys()].sort((a, b) =>
      sort === 'date_asc' ? a.localeCompare(b) : b.localeCompare(a),
    );
    return sortedDates.map((date) => {
      const data = [...(map.get(date) ?? [])];
      data.sort((a, b) => {
        switch (sort) {
          case 'date_asc': return (a.time ?? '').localeCompare(b.time ?? '');
          case 'odds_desc': return b.odds - a.odds;
          case 'stake_desc': return b.stake - a.stake;
          case 'odds_asc': return a.odds - b.odds;
          case 'stake_asc': return a.stake - b.stake;
          default: return (b.time ?? '').localeCompare(a.time ?? '');
        }
      });
      const dailyPnl = data.reduce((sum, b) => {
        if (b.status === 'won') return sum + Math.round(b.stake * b.odds) - b.stake;
        if (b.status === 'lost') return sum - b.stake;
        return sum;
      }, 0);
      return { title: formatDateTitle(date), date, dailyPnl, data };
    });
  }, [bets, statusFilter, search, sort]);

  const freeLeft = Math.max(0, 50 - bets.length);

  function handleAdd() {
    if (!canAddBet()) {
      haptic.error();
      if (!settings.isPro) {
        Alert.alert('Лимит достигнут', 'Бесплатный план — до 50 ставок. Перейди на Pro для безлимитного трекинга.');
      } else {
        const today = new Date().toISOString().split('T')[0] ?? '';
        const todayCount = bets.filter((b) => b.date === today).length;
        Alert.alert('Дневной лимит', `Сегодня уже ${todayCount} ставок — установленный лимит ${settings.dailyBetLimit}. Измени лимит в Настройках.`);
      }
      return;
    }
    // PRO users get the pre-bet discipline checklist
    if (settings.isPro) {
      setShowChecklist(true);
    } else {
      navigation.navigate('AddBet', {});
    }
  }

  function handleEdit(bet: Bet) {
    navigation.navigate('AddBet', { betId: bet.id });
  }

  return (
    <View style={styles.container}>
      <ChecklistModal
        visible={showChecklist}
        onConfirm={() => { setShowChecklist(false); navigation.navigate('AddBet', {}); }}
        onCancel={() => setShowChecklist(false)}
      />
      <ScreenHeader
        title="Ставки"
        subtitle={settings.isPro ? `${bets.length} ставок` : `${freeLeft} из 50 осталось`}
        rightAction={{ label: '+ Добавить', onPress: handleAdd }}
      />

      <TextInput
        style={styles.search}
        placeholder="Поиск по событию или выбору..."
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filters}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, statusFilter === f.key && styles.filterBtnActive]}
            onPress={() => { haptic.selection(); setStatusFilter(f.key); }}
          >
            <Text style={[styles.filterText, statusFilter === f.key && styles.filterTextActive]}>
              {f.label}
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
            ? `Кэф ${sort === 'odds_asc' ? '↑' : '↓'}`
            : isStake
            ? `Сумма ${sort === 'stake_asc' ? '↑' : '↓'}`
            : key === 'date_desc' ? 'Новые' : 'Старые';
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
            <Text style={styles.tiltTitle}>Стоп. Ты в тилте.</Text>
            <Text style={styles.tiltSub}>Сделай паузу перед следующей ставкой.</Text>
          </View>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SwipeableRow onDelete={() => { haptic.error(); deleteBet(item.id); }}>
            <BetCard bet={item} onEdit={handleEdit} />
          </SwipeableRow>
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionDate}>{section.title}</Text>
            {section.dailyPnl !== 0 && (
              <Text style={[styles.sectionPnl, { color: section.dailyPnl > 0 ? colors.won : colors.lost }]}>
                {section.dailyPnl > 0 ? '+' : ''}{formatMoney(section.dailyPnl)}
              </Text>
            )}
          </View>
        )}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
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
            <Text style={styles.emptyTitle}>Ставок пока нет</Text>
            <Text style={styles.emptySubtitle}>
              {search ? 'Ничего не найдено' : 'Нажми «+ Добавить» чтобы начать'}
            </Text>
          </View>
        }
      />

      {!settings.isPro && bets.length >= 40 && (
        <View style={styles.limitBanner}>
          <Text style={styles.limitText}>
            {50 - bets.length <= 0
              ? '🔒 Лимит 50 ставок достигнут — перейди на Pro'
              : `⚠️ Осталось ${50 - bets.length} бесплатных ставок`}
          </Text>
        </View>
      )}
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
  filtersScroll: { marginBottom: 8, flexGrow: 0 },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    paddingBottom: 2,
    alignItems: 'center',
  },
  filterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
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
  list: { paddingBottom: 20 },
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
