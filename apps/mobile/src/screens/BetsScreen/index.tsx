import React, { useState, useMemo, useCallback } from 'react';
import {
  View, SectionList, StyleSheet, TouchableOpacity, Text, TextInput, ScrollView, Alert, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Bet, BetStatus } from '@sharklog/core';
import { formatMoney } from '@sharklog/core';
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
  { key: 'refund', label: 'Выкупы' },
];

type SortKey = 'date_desc' | 'date_asc' | 'odds_desc' | 'stake_desc';

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'date_desc', label: 'Новые' },
  { key: 'date_asc', label: 'Старые' },
  { key: 'odds_desc', label: 'Кэф ↓' },
  { key: 'stake_desc', label: 'Сумма ↓' },
];

export function BetsScreen() {
  const navigation = useNavigation<Nav>();
  const { bets, settings, canAddBet, deleteBet } = useBetsStore();
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
        {SORT_OPTIONS.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.sortBtn, sort === s.key && styles.sortBtnActive]}
            onPress={() => { haptic.selection(); setSort(s.key); }}
          >
            <Text style={[styles.sortText, sort === s.key && styles.sortTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
            <Text style={styles.emptyIcon}>🦈</Text>
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
  filtersScroll: { marginBottom: 8 },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    paddingBottom: 2,
  },
  filterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
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
  emptyIcon: { fontSize: 48, marginBottom: 12 },
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
});
