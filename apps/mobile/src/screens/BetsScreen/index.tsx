import React, { useState, useMemo } from 'react';
import {
  View, FlatList, StyleSheet, TouchableOpacity, Text, TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Bet, BetStatus } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { colors } from '../../theme/colors';
import { ScreenHeader } from '../../components/ScreenHeader';
import { BetCard } from './BetCard';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATUS_FILTERS: Array<{ key: BetStatus | 'all'; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'pending', label: 'Ожидание' },
  { key: 'won', label: 'Победы' },
  { key: 'lost', label: 'Проигрыши' },
  { key: 'refund', label: 'Возвраты' },
];

export function BetsScreen() {
  const navigation = useNavigation<Nav>();
  const { bets, settings, canAddBet } = useBetsStore();
  const [statusFilter, setStatusFilter] = useState<BetStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let result = [...bets];
    if (statusFilter !== 'all') result = result.filter((b) => b.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) => b.event.toLowerCase().includes(q) || b.pick.toLowerCase().includes(q),
      );
    }
    return result;
  }, [bets, statusFilter, search]);

  const freeLeft = Math.max(0, 50 - bets.length);

  function handleAdd() {
    if (!canAddBet()) {
      return;
    }
    navigation.navigate('AddBet', {});
  }

  function handleEdit(bet: Bet) {
    navigation.navigate('AddBet', { betId: bet.id });
  }

  return (
    <View style={styles.container}>
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

      <View style={styles.filters}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, statusFilter === f.key && styles.filterBtnActive]}
            onPress={() => setStatusFilter(f.key)}
          >
            <Text style={[styles.filterText, statusFilter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <BetCard bet={item} onEdit={handleEdit} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
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
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 12,
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
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterText: { fontSize: 12, color: colors.textSecondary },
  filterTextActive: { color: '#000', fontWeight: '700' },
  list: { paddingBottom: 20 },
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
