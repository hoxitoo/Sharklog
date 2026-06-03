import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { Analytics } from '../../services/analytics';

const PARTNERS = [
  {
    id: 'fonbet',
    name: 'Fonbet',
    emoji: '🎯',
    category: 'Топ букмекер',
    description: 'Крупнейший легальный букмекер России. Широкая линия на спорт и киберспорт, быстрые выплаты.',
    bonus: 'Бонус до 10 000 ₽ новым игрокам',
    refUrl: 'https://fonbet.ru',
  },
  {
    id: 'betcity',
    name: 'BetCity',
    emoji: '🏆',
    category: 'Спорт',
    description: 'Высокие лимиты, удобное мобильное приложение. Быстрые выплаты на карту и кошельки.',
    bonus: 'Фрибет 1 000 ₽ при регистрации',
    refUrl: 'https://betcity.ru',
  },
  {
    id: '1xbet',
    name: '1xBet',
    emoji: '⚡',
    category: 'Широкая линия',
    description: 'Огромная линия событий, высокие кэфы. Live-ставки с трансляциями матчей.',
    bonus: 'Бонус 100% на первый депозит до 100 €',
    refUrl: 'https://1xbet.com',
  },
  {
    id: 'parimatch',
    name: 'Parimatch',
    emoji: '🎪',
    category: 'Киберспорт',
    description: 'Популярный букмекер с акцентом на киберспорт. Хорошие кэфы на Dota 2, CS2, Valorant.',
    bonus: 'Фрибет до 2 500 ₽',
    refUrl: 'https://parimatch.ru',
  },
  {
    id: 'leon',
    name: 'Leon',
    emoji: '🦁',
    category: 'Аналитика',
    description: 'Удобная статистика прямо в линии. Трансляции матчей, кэшбэк на проигрыши.',
    bonus: 'Кэшбэк до 10% на проигранные ставки',
    refUrl: 'https://leon.ru',
  },
  {
    id: 'winline',
    name: 'Winline',
    emoji: '🎲',
    category: 'Топ букмекер',
    description: 'Легальный букмекер с хорошими бонусами и широкой линией на российский спорт.',
    bonus: 'Страховка ставки до 2 000 ₽',
    refUrl: 'https://winline.ru',
  },
];

async function openPartner(partner: typeof PARTNERS[number]) {
  Analytics.partnerLinkTapped(partner.id);
  const canOpen = await Linking.canOpenURL(partner.refUrl);
  if (canOpen) {
    Linking.openURL(partner.refUrl);
  } else {
    Alert.alert('Ошибка', 'Не удалось открыть ссылку');
  }
}

export function PartnersScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
    >
      <Text style={styles.title}>Партнёры</Text>
      <Text style={styles.subtitle}>
        Используй реферальную ссылку и получи бонус при регистрации у букмекера.
      </Text>

      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          ⚠️ Партнёрские ссылки — мы получаем комиссию. Ставки несут финансовый риск. Играй ответственно.
        </Text>
      </View>

      {PARTNERS.map((p) => (
        <View key={p.id} style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.emoji}>{p.emoji}</Text>
            <View style={styles.cardInfo}>
              <Text style={styles.partnerName}>{p.name}</Text>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{p.category}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.description}>{p.description}</Text>

          <View style={styles.bonusRow}>
            <Text style={styles.bonusText}>🎁 {p.bonus}</Text>
          </View>

          <TouchableOpacity
            style={styles.btn}
            onPress={() => openPartner(p)}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>Открыть {p.name} →</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: {
    fontSize: 26, fontWeight: '800', color: colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 14,
  },
  notice: {
    backgroundColor: colors.bgElevated, borderRadius: 10,
    padding: 12, marginBottom: 20,
    borderWidth: 1, borderColor: colors.border,
  },
  noticeText: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  card: {
    backgroundColor: colors.bgCard, borderRadius: 16,
    padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: colors.border,
    gap: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emoji: { fontSize: 32 },
  cardInfo: { flex: 1 },
  partnerName: {
    fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 4,
  },
  categoryBadge: {
    alignSelf: 'flex-start', backgroundColor: colors.purple + '22',
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  categoryText: { fontSize: 11, color: colors.purple, fontWeight: '600' },
  description: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  bonusRow: {
    backgroundColor: colors.accent + '18', borderRadius: 8, padding: 10,
  },
  bonusText: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  btn: {
    backgroundColor: colors.purple, borderRadius: 10,
    paddingVertical: 11, alignItems: 'center',
  },
  btnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
