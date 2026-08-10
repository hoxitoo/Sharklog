import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Sport, BetType, Strategy, BetStatus, EsportsDiscipline, Team, Bet } from '@sharklog/core';
import {
  SPORTS, BET_TYPES, STRATEGIES, ESPORTS_DISCIPLINES, parseMoneyInput, formatMoney,
  impliedProbability, halfKelly, expectedValue, recommendedStake, CURRENT_SCHEMA_VERSION, FREE_LIMITS, calcDashboard,
} from '@sharklog/core';
import { colors } from '../../theme/colors';
import { useBetsStore } from '../../store/betsStore';
import { haptic } from '../../utils/haptics';
import { Analytics } from '../../services/analytics';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AddBet'>;
type Route = RouteProp<RootStackParamList, 'AddBet'>;

type BetMode = 'single' | 'express';

type Pick1x2 = 'п1' | 'x' | 'п2';

interface FormData {
  betMode: BetMode;
  team1: string;
  team2: string;
  odds: string;
  stake: string;
  sport: Sport;
  discipline: EsportsDiscipline;
  betType: BetType;
  strategy: Strategy;
  status: BetStatus;
  notes: string;
  cashoutAmount: string;
  closingOdds: string;
  bookmaker: string;
  tournament: string;
  date: string;
  time: string;
  pick1x2: Pick1x2;
  customSport: string;
  customBetType: string;
  customStrategy: string;
  // Dynamic pick fields
  handicapSide: 'home' | 'away';
  pickValue: string;
  bothScoreYes: boolean;
}

interface ExpressLeg {
  team1: string;
  team2: string;
  odds: string;
  pick: string;
  sport: Sport;
  discipline: EsportsDiscipline;
}

function uuid(): string {
  const c = (globalThis as any).crypto;
  if (c && typeof c.getRandomValues === 'function') {
    const buf = new Uint8Array(16);
    c.getRandomValues(buf);
    buf[6] = (buf[6]! & 0x0f) | 0x40;
    buf[8] = (buf[8]! & 0x3f) | 0x80;
    let s = '';
    for (let i = 0; i < 16; i++) {
      if (i === 4 || i === 6 || i === 8 || i === 10) s += '-';
      s += buf[i]!.toString(16).padStart(2, '0');
    }
    return s;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Accept both comma and dot as decimal separator (Russian keyboard uses comma)
function nd(v: string): string {
  return v.replace(',', '.');
}

// ── Segmented Control ─────────────────────────────────────────────────────────

function SegmentedControl<T extends string>({
  label, options, value, onChange,
}: {
  label: string;
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={sc.container}>
      <Text style={sc.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={sc.row}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[sc.item, value === opt.key && sc.itemActive]}
              onPress={() => onChange(opt.key)}
            >
              <Text style={[sc.text, value === opt.key && sc.textActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const sc = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 12, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', gap: 6 },
  item: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
  },
  itemActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  text: { fontSize: 13, color: colors.textSecondary },
  textActive: { color: '#fff', fontWeight: '700' },
});

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <View style={field.container}>
      <Text style={field.label}>{label}</Text>
      {children}
      {error ? <Text style={field.error}>{error}</Text> : null}
    </View>
  );
}

const field = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 12, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  error: { fontSize: 12, color: colors.lost, marginTop: 4 },
});

const inputStyle = {
  backgroundColor: colors.bgCard,
  borderRadius: 10,
  paddingHorizontal: 14,
  paddingVertical: 12,
  color: colors.textPrimary,
  fontSize: 15,
  borderWidth: 1,
  borderColor: colors.border,
};

// ── Single Team Input with autocomplete ───────────────────────────────────────

function SingleTeamInput({
  value, onChange, onSubmitEditing, textInputRef, placeholder, sport, discipline,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmitEditing?: () => void;
  textInputRef?: React.RefObject<TextInput>;
  placeholder?: string;
  sport: Sport;
  discipline: EsportsDiscipline;
}) {
  const teams = useBetsStore((s) => s.teams);
  const [focused, setFocused] = useState(false);

  const suggestions = useMemo<Team[]>(() => {
    if (!focused || value.length < 1) return [];
    return teams
      .filter((t) => {
        if (sport === 'esports' && t.sport === 'esports' && t.discipline && t.discipline !== discipline) return false;
        return t.name.toLowerCase().includes(value.toLowerCase());
      })
      .sort((a, b) => {
        const sameA = a.sport === sport ? 1 : 0;
        const sameB = b.sport === sport ? 1 : 0;
        if (sameB !== sameA) return sameB - sameA;
        return b.usageCount - a.usageCount;
      })
      .slice(0, 5);
  }, [teams, value, sport, discipline, focused]);

  return (
    <View style={ac.wrapper}>
      <TextInput
        {...(textInputRef ? { ref: textInputRef } : {})}
        style={inputStyle}
        placeholder={placeholder ?? 'Команда...'}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 180)}
        returnKeyType={onSubmitEditing ? 'next' : 'default'}
        onSubmitEditing={onSubmitEditing}
        blurOnSubmit={!onSubmitEditing}
      />
      {focused && suggestions.length > 0 && (
        <View style={ac.dropdown}>
          {suggestions.map((team) => (
            <TouchableOpacity
              key={team.id}
              style={ac.item}
              onPress={() => {
                onChange(team.name);
                setFocused(false);
                onSubmitEditing?.();
              }}
              activeOpacity={0.7}
            >
              <Text style={ac.name}>{team.name}</Text>
              <View style={ac.right}>
                {team.sport === 'esports' && team.discipline ? (
                  <View style={ac.badge}>
                    <Text style={ac.badgeText}>{ESPORTS_DISCIPLINES[team.discipline]}</Text>
                  </View>
                ) : team.sport !== sport ? (
                  <View style={ac.badge}>
                    <Text style={ac.badgeText}>{SPORTS[team.sport]}</Text>
                  </View>
                ) : null}
                <Text style={ac.count}>{team.usageCount}×</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const ac = StyleSheet.create({
  wrapper: { position: 'relative' },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: colors.bgElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: { fontSize: 14, color: colors.textPrimary, flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: {
    backgroundColor: colors.purpleDim,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.purple + '44',
  },
  badgeText: { fontSize: 10, color: colors.purple, fontWeight: '600' },
  count: { fontSize: 11, color: colors.textMuted },
});

// ── Tournament Input with autocomplete ────────────────────────────────────────

function TournamentInput({ value, onChange, scrollRef }: {
  value: string;
  onChange: (v: string) => void;
  scrollRef?: React.RefObject<ScrollView>;
}) {
  const bets = useBetsStore((s) => s.bets);
  const [focused, setFocused] = useState(false);

  const suggestions = useMemo<string[]>(() => {
    if (!focused) return [];
    const q = value.toLowerCase().trim();
    const counts = new Map<string, number>();
    for (const b of bets) {
      const t = b.tournament?.trim();
      if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .filter(([t]) => !q || t.toLowerCase().includes(q))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([t]) => t);
  }, [bets, value, focused]);

  return (
    <View style={ac.wrapper}>
      <TextInput
        style={inputStyle}
        placeholder="Лига Чемпионов, РПЛ, CS2 Major..."
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChange}
        onFocus={() => {
          setFocused(true);
          setTimeout(() => scrollRef?.current?.scrollToEnd({ animated: true }), 120);
        }}
        onBlur={() => setTimeout(() => setFocused(false), 180)}
        returnKeyType="next"
      />
      {focused && suggestions.length > 0 && (
        <View style={ac.dropdown}>
          {suggestions.map((t) => (
            <TouchableOpacity
              key={t}
              style={ac.item}
              onPress={() => { onChange(t); setFocused(false); }}
              activeOpacity={0.7}
            >
              <Text style={ac.name}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Restore pick1x2 value from an existing 1X2 bet ────────────────────────────

function initPick1x2(editBet: { betType: BetType; pick?: string } | undefined, team1: string, team2: string): Pick1x2 {
  if (!editBet || editBet.betType !== '1X2') return 'п1';
  const pick = editBet.pick ?? '';
  if (pick === 'Ничья' || pick === 'X') return 'x';
  if ((team2.trim() && pick === team2.trim()) || pick === 'П2') return 'п2';
  return 'п1';
}

// ── Parse existing pick back into form fields ──────────────────────────────────

function parseEditPick(betType: BetType, pick: string): {
  handicapSide: 'home' | 'away';
  pickValue: string;
  bothScoreYes: boolean;
} {
  if (betType === 'handicap') {
    const side: 'home' | 'away' = pick.startsWith('Ф2') ? 'away' : 'home';
    const m = pick.match(/[+\-−]?\d+(?:[.,]\d+)?/);
    return { handicapSide: side, pickValue: m ? m[0]! : '', bothScoreYes: true };
  }
  if (betType === 'total_over') {
    return { handicapSide: 'home', pickValue: pick.replace(/^ТБ\s*/u, '').trim(), bothScoreYes: true };
  }
  if (betType === 'total_under') {
    return { handicapSide: 'home', pickValue: pick.replace(/^ТМ\s*/u, '').trim(), bothScoreYes: true };
  }
  if (betType === 'exact_score') {
    return { handicapSide: 'home', pickValue: pick, bothScoreYes: true };
  }
  if (betType === 'both_score') {
    return { handicapSide: 'home', pickValue: '', bothScoreYes: pick !== 'Нет' };
  }
  return { handicapSide: 'home', pickValue: '', bothScoreYes: true };
}

// ── Kelly Helper ───────────────────────────────────────────────────────────────

function KellyHelper({ odds, bankKopecks, onApply }: {
  odds: number;
  bankKopecks: number;
  onApply: (roubles: string) => void;
}) {
  const [prob, setProb] = useState(0.5);
  const implied = impliedProbability(odds);
  const ev = expectedValue(odds, prob);
  const kellyPct = halfKelly(odds, prob) * 100;
  const stake = bankKopecks > 0 ? recommendedStake(bankKopecks, odds, prob) : 0;
  const evPositive = ev > 0;

  function step(dir: 1 | -1) {
    setProb((p) => Math.min(0.95, Math.max(0.05, Math.round((p + dir * 0.05) * 100) / 100)));
  }

  return (
    <View style={kl.container}>
      <View style={kl.impliedRow}>
        <Text style={kl.impliedLabel}>Имплицитная вероятность букмекера</Text>
        <Text style={kl.impliedValue}>{(implied * 100).toFixed(1)}%</Text>
      </View>

      <View style={kl.stepRow}>
        <Text style={kl.stepLabel}>Моя оценка</Text>
        <View style={kl.stepper}>
          <TouchableOpacity style={kl.stepBtn} onPress={() => step(-1)} activeOpacity={0.7}>
            <Text style={kl.stepBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={kl.stepValue}>{(prob * 100).toFixed(0)}%</Text>
          <TouchableOpacity style={kl.stepBtn} onPress={() => step(1)} activeOpacity={0.7}>
            <Text style={kl.stepBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={kl.resultsRow}>
        <View style={kl.resultCell}>
          <Text style={[kl.resultValue, { color: evPositive ? colors.won : colors.lost }]}>
            {ev >= 0 ? '+' : ''}{(ev * 100).toFixed(1)}%
          </Text>
          <Text style={kl.resultLabel}>EV</Text>
        </View>
        <View style={kl.resultCell}>
          <Text style={kl.resultValue}>{kellyPct.toFixed(1)}%</Text>
          <Text style={kl.resultLabel}>Half-Kelly</Text>
        </View>
        <View style={kl.resultCell}>
          <Text style={[kl.resultValue, { color: stake > 0 ? colors.accent : colors.textMuted }]}>
            {stake > 0 ? formatMoney(stake) : '—'}
          </Text>
          <Text style={kl.resultLabel}>Рек. ставка</Text>
        </View>
      </View>

      {stake > 0 && (
        <TouchableOpacity style={kl.applyBtn} onPress={() => onApply(String(stake / 100))} activeOpacity={0.8}>
          <Text style={kl.applyText}>Применить {formatMoney(stake)}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const kl = StyleSheet.create({
  container: {
    backgroundColor: colors.bgElevated,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  impliedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  impliedLabel: { fontSize: 12, color: colors.textMuted },
  impliedValue: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  stepRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepLabel: { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { fontSize: 18, color: colors.textPrimary, lineHeight: 22 },
  stepValue: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, minWidth: 44, textAlign: 'center' },
  resultsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  resultCell: { alignItems: 'center', gap: 3 },
  resultValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  resultLabel: { fontSize: 10, color: colors.textMuted },
  applyBtn: {
    backgroundColor: colors.accent + '22',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent + '66',
  },
  applyText: { fontSize: 14, fontWeight: '700', color: colors.accent },
});

// ── Main Screen ────────────────────────────────────────────────────────────────

export function AddBetScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { bets, addBet, updateBet, settings, bankroll, canAddBet } = useBetsStore();
  const [kellyOpen, setKellyOpen] = useState(false);
  const team2Ref = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const editBet = route.params?.betId
    ? bets.find((b) => b.id === route.params?.betId)
    : undefined;

  const [isFreebet, setIsFreebet] = useState(editBet?.isFreebet ?? false);
  // Auto-expand extras when editing bet that has non-default values
  const hasExtraValues = !!(editBet?.tournament || editBet?.notes || editBet?.isFreebet || editBet?.closingOdds != null);
  const [showExtra, setShowExtra] = useState(hasExtraValues);

  const now = new Date();
  const defaultDate = now.toISOString().split('T')[0] ?? '';
  const defaultTime = now.toTimeString().slice(0, 5);

  const initialBetMode: BetMode = editBet?.betType === 'express' ? 'express' : 'single';
  const eventParts = editBet?.betType !== 'express' ? (editBet?.event ?? '').split(' vs ') : [];
  const initialTeam1 = eventParts[0]?.trim() ?? '';
  const initialTeam2 = eventParts.slice(1).join(' vs ').trim();

  const buildInitialLegs = (): ExpressLeg[] => {
    const defSport: Sport = editBet?.sport ?? 'football';
    const defDiscipline: EsportsDiscipline = editBet?.discipline ?? 'csgo';
    if (editBet?.betType === 'express') {
      const eventParts = editBet.event.split(' / ');
      // pick field stores per-leg picks as "П1 / ТБ 2.5", OR legacy "Экспресс"
      const pickParts = (editBet.pick && editBet.pick !== 'Экспресс')
        ? editBet.pick.split(' / ')
        : [];
      if (eventParts.length >= 2) {
        return eventParts.map((p, i) => {
          // Support stored odds in event: "M80 vs NRG|1.10"
          const [eventStr, storedOdds] = p.trim().split('|');
          const t = (eventStr ?? p).trim().split(' vs ');
          return {
            team1: t[0]?.trim() ?? '',
            team2: t[1]?.trim() ?? '',
            odds: storedOdds ?? '',
            pick: pickParts[i] ?? '',
            sport: defSport,
            discipline: defDiscipline,
          };
        });
      }
    }
    return [
      { team1: '', team2: '', odds: '', pick: '', sport: defSport, discipline: defDiscipline },
      { team1: '', team2: '', odds: '', pick: '', sport: defSport, discipline: defDiscipline },
    ];
  };

  const [legs, setLegs] = useState<ExpressLeg[]>(buildInitialLegs);

  const editBetType = (editBet?.betType && editBet.betType !== 'express') ? editBet.betType : '1X2';
  const editPickParsed = editBet ? parseEditPick(editBetType, editBet.pick ?? '') : null;

  const { control, handleSubmit, watch, setValue, clearErrors, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      betMode: initialBetMode,
      team1: initialTeam1,
      team2: initialTeam2,
      odds: editBet ? String(editBet.odds) : '',
      stake: editBet ? String(editBet.stake / 100) : '',
      sport: editBet?.sport ?? 'football',
      discipline: editBet?.discipline ?? 'csgo',
      betType: editBetType,
      strategy: editBet?.strategy ?? 'value',
      status: editBet?.status ?? 'pending',
      notes: editBet?.notes ?? '',
      cashoutAmount: editBet?.cashoutAmount != null ? String(editBet.cashoutAmount / 100) : '',
      closingOdds: editBet?.closingOdds != null ? String(editBet.closingOdds) : '',
      bookmaker: editBet?.bookmaker ?? (settings.bookmakers[0] ?? ''),
      tournament: editBet?.tournament ?? '',
      date: editBet?.date ?? defaultDate,
      time: editBet?.time ?? defaultTime,
      pick1x2: initPick1x2(editBet, initialTeam1, initialTeam2),
      customSport: editBet?.customSport ?? '',
      customBetType: editBet?.customBetType ?? '',
      customStrategy: editBet?.customStrategy ?? '',
      handicapSide: editPickParsed?.handicapSide ?? 'home',
      pickValue: editPickParsed?.pickValue ?? '',
      bothScoreYes: editPickParsed?.bothScoreYes ?? true,
    },
  });

  const betMode = watch('betMode');
  const isSingle = betMode === 'single';
  const watchedSport = watch('sport');
  const watchedDiscipline = watch('discipline');
  const watchedBetType = watch('betType');
  const watchedStrategy = watch('strategy');
  const watchedTeam1 = watch('team1');
  const watchedTeam2 = watch('team2');
  const stakeRaw = watch('stake');
  const stakeKopecks = parseMoneyInput(stakeRaw);
  const singleOdds = parseFloat(nd(watch('odds') || '0'));
  const watchedStatus = watch('status');
  const cashoutRaw = watch('cashoutAmount');
  const cashoutKopecks = parseMoneyInput(cashoutRaw || '0');
  const cashoutPnl = stakeKopecks > 0 && cashoutKopecks > 0 ? cashoutKopecks - stakeKopecks : null;

  // Stake as a share of the bank — discipline feedback at the moment of the decision,
  // not in a report afterwards. Compared against the generated strategy's limit if set.
  const bankTotal = useMemo(() => {
    const cash = bankroll.transactions.reduce(
      (sum, t) => (t.type === 'deposit' ? sum + t.amount : sum - t.amount), 0);
    return cash + calcDashboard(bets).pnl;
  }, [bets, bankroll.transactions]);
  const bankShare = bankTotal > 0 && stakeKopecks > 0 ? (stakeKopecks / bankTotal) * 100 : null;
  const strategyLimit = settings.generatedStrategy?.stakePercent ?? null;
  const overLimit = bankShare != null && strategyLimit != null && bankShare > strategyLimit;

  const expressOdds = legs.reduce((p, l) => {
    const o = parseFloat(nd(l.odds || '0'));
    return o > 1 ? p * o : p;
  }, 1);

  const activeOdds = isSingle ? singleOdds : expressOdds;
  const potentialProfit = activeOdds > 1 && stakeKopecks > 0
    ? formatMoney(Math.round(stakeKopecks * activeOdds) - stakeKopecks)
    : null;

  const bankKopecks = useMemo(() => {
    const deposited = bankroll.transactions.reduce(
      (sum, t) => (t.type === 'deposit' ? sum + t.amount : sum - t.amount), 0,
    );
    const pnl = bets.reduce((sum, b) => {
      if (b.status === 'won') return sum + Math.round(b.stake * b.odds) - b.stake;
      if (b.status === 'lost') return sum - b.stake;
      return sum;
    }, 0);
    return deposited + pnl;
  }, [bankroll.transactions, bets]);

  useEffect(() => {
    navigation.setOptions({ title: editBet ? 'Редактировать ставку' : 'Новая ставка' });
  }, [editBet]);

  // Clear field errors when switching bet mode
  useEffect(() => {
    clearErrors(['team1', 'odds', 'stake']);
  }, [betMode]);

  function updateLeg<K extends keyof ExpressLeg>(idx: number, key: K, val: ExpressLeg[K]) {
    setLegs((prev) => prev.map((l, i) => i === idx ? { ...l, [key]: val } : l));
  }

  function onSubmit(data: FormData) { try {
    const stakeVal = parseMoneyInput(data.stake);
    if (stakeVal <= 0) {
      Alert.alert('Ошибка', 'Укажи сумму ставки');
      return;
    }

    if (!editBet && !canAddBet()) {
      Alert.alert(
        settings.isPro ? 'Дневной лимит' : 'Лимит Free',
        settings.isPro
          ? `Дневной лимит (${settings.dailyBetLimit} ставок) достигнут. Измени лимит в Настройках.`
          : `Бесплатная версия позволяет не более ${FREE_LIMITS.MAX_BETS} ставок.\nПерейди на Pro для неограниченного учёта.`,
      );
      return;
    }

    const closingOddsVal = parseFloat(nd(data.closingOdds));
    const extras = {
      ...(data.sport === 'esports' ? { discipline: data.discipline } : {}),
      ...(data.notes ? { notes: data.notes } : {}),
      ...(data.tournament?.trim() ? { tournament: data.tournament.trim() } : {}),
      ...(!isNaN(closingOddsVal) && closingOddsVal > 1 ? { closingOdds: closingOddsVal } : {}),
      ...(data.sport === 'other' && data.customSport.trim() ? { customSport: data.customSport.trim() } : {}),
      ...(data.betType === 'other' && data.customBetType.trim() ? { customBetType: data.customBetType.trim() } : {}),
      ...(data.strategy === 'other' && data.customStrategy.trim() ? { customStrategy: data.customStrategy.trim() } : {}),
    };
    // On EDIT, an emptied closing-odds field must actively clear the stored value —
    // a plain {...bet, ...updates} merge would otherwise keep the old one.
    const closingOddsClear = { closingOdds: closingOddsVal > 1 ? closingOddsVal : undefined } as Partial<Bet>;
    const cashoutExtras = data.status === 'cashout' && data.cashoutAmount
      ? { cashoutAmount: parseMoneyInput(data.cashoutAmount) }
      : {};
    const dateVal = data.date.trim() || defaultDate;
    const timeVal = data.time.trim() || defaultTime;

    if (isSingle) {
      const oddsVal = parseFloat(nd(data.odds));
      if (isNaN(oddsVal) || oddsVal <= 1) {
        Alert.alert('Ошибка', 'Коэффициент должен быть больше 1');
        return;
      }
      const event = [data.team1.trim(), data.team2.trim()].filter(Boolean).join(' vs ');
      if (!event) {
        Alert.alert('Ошибка', 'Введи название команды или события');
        return;
      }
      const pv = data.pickValue.trim();
      const pick = (() => {
        if (data.betType === '1X2') {
          return data.pick1x2 === 'п1' ? (data.team1.trim() || 'П1')
               : data.pick1x2 === 'п2' ? (data.team2.trim() || 'П2')
               : 'Ничья';
        }
        if (data.betType === 'handicap') {
          const side = data.handicapSide === 'home' ? 'Ф1' : 'Ф2';
          return pv ? `${side} (${pv})` : side;
        }
        if (data.betType === 'total_over') return pv ? `ТБ ${pv}` : 'ТБ';
        if (data.betType === 'total_under') return pv ? `ТМ ${pv}` : 'ТМ';
        if (data.betType === 'both_score') return data.bothScoreYes ? 'Да' : 'Нет';
        if (data.betType === 'exact_score') return pv || '—';
        if (data.betType === 'other' && data.customBetType.trim()) return data.customBetType.trim();
        return BET_TYPES[data.betType] ?? '—';
      })();

      if (editBet) {
        updateBet(editBet.id, {
          event, pick, odds: oddsVal, stake: stakeVal,
          sport: data.sport, betType: data.betType, strategy: data.strategy,
          status: data.status, bookmaker: data.bookmaker,
          date: dateVal, time: timeVal, ...extras, ...closingOddsClear, ...cashoutExtras,
          ...(isFreebet ? { isFreebet: true } : {}),
        });
      } else {
        addBet({
          id: uuid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          date: dateVal, time: timeVal,
          event, pick, odds: oddsVal, stake: stakeVal,
          sport: data.sport, betType: data.betType, strategy: data.strategy,
          status: data.status, bookmaker: data.bookmaker, schemaVersion: CURRENT_SCHEMA_VERSION,
          ...extras, ...cashoutExtras, ...(isFreebet ? { isFreebet: true } : {}),
        });
        Analytics.betAdded({ sport: data.sport, betType: data.betType, bookmaker: data.bookmaker, status: data.status });
      }
    } else {
      const validLegs = legs.filter((l) => {
        const o = parseFloat(nd(l.odds || '0'));
        return l.team1.trim() && o > 1;
      });
      if (validLegs.length < 2) {
        Alert.alert('Ошибка', 'Экспресс: минимум 2 события с кэфом > 1');
        return;
      }
      const combinedOdds = parseFloat(
        validLegs.reduce((p, l) => p * parseFloat(nd(l.odds)), 1).toFixed(3),
      );
      // Store odds per leg in event: "M80 vs NRG|1.10 / Team Liquid vs Heroic|1.88"
      const event = validLegs
        .map((l) => {
          const evStr = [l.team1.trim(), l.team2.trim()].filter(Boolean).join(' vs ');
          return `${evStr}|${parseFloat(nd(l.odds)).toFixed(2)}`;
        })
        .join(' / ');
      // Store per-leg picks in pick field: "П1 / ТБ 2.5"
      const legPicks = validLegs.map(l => l.pick.trim() || '—');
      const pickStr = legPicks.every(p => p === '—') ? 'Экспресс' : legPicks.join(' / ');

      // Use sport of first valid leg for the bet record
      const expressSport = validLegs[0]?.sport ?? data.sport;
      const expressDiscipline = validLegs[0]?.discipline ?? data.discipline;
      const expressExtras = {
        ...extras,
        ...(expressSport === 'esports' ? { discipline: expressDiscipline } : {}),
      };

      if (editBet) {
        updateBet(editBet.id, {
          event, pick: pickStr, odds: combinedOdds, stake: stakeVal,
          sport: expressSport, betType: 'express', strategy: data.strategy,
          status: data.status, bookmaker: data.bookmaker,
          date: dateVal, time: timeVal, ...expressExtras, ...closingOddsClear, ...cashoutExtras,
          ...(isFreebet ? { isFreebet: true } : {}),
        });
      } else {
        addBet({
          id: uuid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          date: dateVal, time: timeVal,
          event, pick: pickStr, odds: combinedOdds, stake: stakeVal,
          sport: expressSport, betType: 'express', strategy: data.strategy,
          status: data.status, bookmaker: data.bookmaker, schemaVersion: CURRENT_SCHEMA_VERSION,
          ...expressExtras, ...cashoutExtras, ...(isFreebet ? { isFreebet: true } : {}),
        });
      }
    }

    haptic.success();
    navigation.goBack();
  } catch (e) {
    Alert.alert('Ошибка', e instanceof Error ? e.message : String(e));
  } }

  const sportOptions = Object.entries(SPORTS).map(([k, v]) => ({ key: k as Sport, label: v }));
  const betTypeOptions = Object.entries(BET_TYPES)
    .filter(([k]) => k !== 'express')
    .map(([k, v]) => ({ key: k as BetType, label: v }));
  const strategyOptions = Object.entries(STRATEGIES).map(([k, v]) => ({ key: k as Strategy, label: v }));
  const disciplineOptions = Object.entries(ESPORTS_DISCIPLINES).map(([k, v]) => ({ key: k as EsportsDiscipline, label: v }));

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Bet mode toggle ─── */}
        <Controller
          control={control}
          name="betMode"
          render={({ field: { onChange, value } }) => (
            <View style={styles.betModeRow}>
              <TouchableOpacity
                style={[styles.betModeBtn, value === 'single' && styles.betModeBtnActive]}
                onPress={() => { onChange('single'); haptic.selection(); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.betModeTxt, value === 'single' && styles.betModeTxtActive]}>
                  Ординар
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.betModeBtn, value === 'express' && styles.betModeBtnActive]}
                onPress={() => { onChange('express'); haptic.selection(); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.betModeTxt, value === 'express' && styles.betModeTxtActive]}>
                  Экспресс
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />

        {/* ── Single mode ─── */}
        {isSingle && (
          <>
            <Field label="Команда 1 *" {...(errors.team1?.message ? { error: errors.team1.message } : {})}>
              <Controller
                control={control}
                name="team1"
                rules={{ validate: (v) => !!v.trim() || 'Введи команду или событие' }}
                render={({ field: { onChange, value } }) => (
                  <SingleTeamInput
                    value={value}
                    onChange={onChange}
                    onSubmitEditing={() => team2Ref.current?.focus()}
                    placeholder="NaVi, FC Barcelona..."
                    sport={watchedSport}
                    discipline={watchedDiscipline}
                  />
                )}
              />
            </Field>

            <Field label="Команда 2">
              <Controller
                control={control}
                name="team2"
                render={({ field: { onChange, value } }) => (
                  <SingleTeamInput
                    value={value}
                    onChange={onChange}
                    textInputRef={team2Ref}
                    placeholder="Virtus.pro, Real Madrid..."
                    sport={watchedSport}
                    discipline={watchedDiscipline}
                  />
                )}
              />
            </Field>

            <View style={styles.row2}>
              <Field label="Коэффициент *" {...(errors.odds?.message ? { error: errors.odds.message } : {})}>
                <Controller
                  control={control}
                  name="odds"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      style={[inputStyle, styles.halfInput]}
                      placeholder="1.85"
                      placeholderTextColor={colors.textMuted}
                      value={value}
                      onChangeText={onChange}
                      keyboardType="decimal-pad"
                    />
                  )}
                />
              </Field>

              <Field label="Сумма (₽) *" {...(errors.stake?.message ? { error: errors.stake.message } : {})}>
                <Controller
                  control={control}
                  name="stake"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      style={[inputStyle, styles.halfInput]}
                      placeholder="1000"
                      placeholderTextColor={colors.textMuted}
                      value={value}
                      onChangeText={onChange}
                      keyboardType="decimal-pad"
                    />
                  )}
                />
              </Field>
            </View>
          </>
        )}

        {/* ── Express mode ─── */}
        {!isSingle && (
          <>
            {legs.map((leg, i) => (
              <View key={i} style={styles.legCard}>
                <View style={styles.legHeader}>
                  <Text style={styles.legTitle}>Матч {i + 1}</Text>
                  {legs.length > 2 && (
                    <TouchableOpacity
                      onPress={() => setLegs((prev) => prev.filter((_, j) => j !== i))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.legRemove}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Per-leg sport chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 5 }}>
                    {sportOptions.map((opt) => (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.legSportChip, leg.sport === opt.key && styles.legSportChipActive]}
                        onPress={() => updateLeg(i, 'sport', opt.key)}
                      >
                        <Text style={[styles.legSportChipText, leg.sport === opt.key && styles.legSportChipTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Per-leg discipline (only when esports) */}
                {leg.sport === 'esports' && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 5 }}>
                      {disciplineOptions.map((opt) => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.legSportChip, leg.discipline === opt.key && styles.legSportChipActive]}
                          onPress={() => updateLeg(i, 'discipline', opt.key)}
                        >
                          <Text style={[styles.legSportChipText, leg.discipline === opt.key && styles.legSportChipTextActive]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                )}

                <View style={{ marginBottom: 8 }}>
                  <SingleTeamInput
                    value={leg.team1}
                    onChange={(v) => updateLeg(i, 'team1', v)}
                    placeholder="Команда 1"
                    sport={leg.sport}
                    discipline={leg.discipline}
                  />
                </View>
                <View style={{ marginBottom: 8 }}>
                  <SingleTeamInput
                    value={leg.team2}
                    onChange={(v) => updateLeg(i, 'team2', v)}
                    placeholder="Команда 2"
                    sport={leg.sport}
                    discipline={leg.discipline}
                  />
                </View>
                <View style={styles.legOddsRow}>
                  <TextInput
                    style={[inputStyle, { flex: 1 }]}
                    placeholder="Кэф"
                    placeholderTextColor={colors.textMuted}
                    value={leg.odds}
                    onChangeText={(v) => updateLeg(i, 'odds', v)}
                    keyboardType="decimal-pad"
                  />
                  <TextInput
                    style={[inputStyle, { flex: 2 }]}
                    placeholder="Исход (П1, Фора, ТБ...)"
                    placeholderTextColor={colors.textMuted}
                    value={leg.pick}
                    onChangeText={(v) => updateLeg(i, 'pick', v)}
                    returnKeyType="next"
                  />
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={styles.addLegBtn}
              onPress={() => setLegs((prev) => [...prev, { team1: '', team2: '', odds: '', pick: '', sport: watchedSport, discipline: watchedDiscipline }])}
              activeOpacity={0.8}
            >
              <Text style={styles.addLegText}>+ Добавить матч</Text>
            </TouchableOpacity>

            {expressOdds > 1 && (
              <View style={styles.expressOddsRow}>
                <Text style={styles.expressOddsLabel}>Общий кэф</Text>
                <Text style={styles.expressOddsValue}>{expressOdds.toFixed(2)}</Text>
              </View>
            )}

            <Field label="Сумма (₽) *">
              <Controller
                control={control}
                name="stake"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={inputStyle}
                    placeholder="1000"
                    placeholderTextColor={colors.textMuted}
                    value={value}
                    onChangeText={onChange}
                    keyboardType="decimal-pad"
                  />
                )}
              />
            </Field>
          </>
        )}

        {/* ── Profit preview ─── */}
        {potentialProfit && (
          <View style={styles.winPreview}>
            <Text style={styles.winLabel}>Прибыль при победе</Text>
            <Text style={styles.winAmount}>{potentialProfit}</Text>
          </View>
        )}

        {bankShare != null && (
          <View style={[styles.bankShare, overLimit && styles.bankShareWarn]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bankShareLabel}>Доля банка</Text>
              <Text style={styles.bankShareBank}>банк {formatMoney(bankTotal)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.bankShareValue, { color: overLimit ? colors.lost : colors.accent }]}>
                {bankShare.toFixed(1)}%
              </Text>
              {strategyLimit != null && (
                <Text style={[styles.bankShareHint, overLimit && { color: colors.lost }]}>
                  {overLimit ? `выше лимита ${strategyLimit}%` : `лимит ${strategyLimit}%`}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ── Kelly calculator (single only) ─── */}
        {isSingle && singleOdds > 1 && (
          <TouchableOpacity
            style={[styles.kellyToggle, kellyOpen && styles.kellyToggleActive]}
            onPress={() => { haptic.selection(); setKellyOpen((v) => !v); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.kellyToggleText, kellyOpen && styles.kellyToggleTextActive]}>
              📊 Калькулятор Келли {kellyOpen ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
        )}

        {isSingle && kellyOpen && singleOdds > 1 && (
          <KellyHelper
            odds={singleOdds}
            bankKopecks={bankKopecks}
            onApply={(v) => { setValue('stake', v); haptic.success(); }}
          />
        )}

        {/* ── Sport (single mode only; express uses per-leg sport) ─── */}
        {isSingle && (
          <>
            <Controller
              control={control}
              name="sport"
              render={({ field: { onChange, value } }) => (
                <SegmentedControl label="Вид спорта" options={sportOptions} value={value} onChange={onChange} />
              )}
            />

            {watchedSport === 'other' && (
              <Field label="Уточни вид спорта">
                <Controller
                  control={control}
                  name="customSport"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      style={inputStyle}
                      placeholder="МMA, Бокс, Формула-1..."
                      placeholderTextColor={colors.textMuted}
                      value={value}
                      onChangeText={onChange}
                    />
                  )}
                />
              </Field>
            )}

            {watchedSport === 'esports' && (
              <Controller
                control={control}
                name="discipline"
                render={({ field: { onChange, value } }) => (
                  <SegmentedControl label="Дисциплина" options={disciplineOptions} value={value} onChange={onChange} />
                )}
              />
            )}
          </>
        )}

        {/* ── Bet type (single only, express option removed) ─── */}
        {isSingle && (
          <Controller
            control={control}
            name="betType"
            render={({ field: { onChange, value } }) => (
              <SegmentedControl label="Тип ставки" options={betTypeOptions} value={value} onChange={onChange} />
            )}
          />
        )}

        {/* ── П1/Ничья/П2 outcome picker (only for 1X2 single) ─── */}
        {isSingle && watchedBetType === '1X2' && (
          <Field label="Исход">
            <Controller
              control={control}
              name="pick1x2"
              render={({ field: { onChange, value } }) => (
                <View style={styles.outcomePicker}>
                  {(['п1', 'x', 'п2'] as const).map((choice) => {
                    const label = choice === 'п1'
                      ? (watchedTeam1.trim() || 'П1')
                      : choice === 'п2'
                      ? (watchedTeam2.trim() || 'П2')
                      : 'Ничья';
                    return (
                      <TouchableOpacity
                        key={choice}
                        style={[styles.outcomeBtn, value === choice && styles.outcomeBtnActive]}
                        onPress={() => { onChange(choice); haptic.selection(); }}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.outcomeTxt, value === choice && styles.outcomeTxtActive]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            />
          </Field>
        )}

        {/* ── Custom bet type label (when betType === 'other') ─── */}
        {isSingle && watchedBetType === 'other' && (
          <Field label="Уточни тип ставки">
            <Controller
              control={control}
              name="customBetType"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={inputStyle}
                  placeholder="Победитель турнира, Карточки..."
                  placeholderTextColor={colors.textMuted}
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
          </Field>
        )}

        {/* ── Handicap: side + value ─── */}
        {isSingle && watchedBetType === 'handicap' && (
          <>
            <Field label="Фора">
              <Controller
                control={control}
                name="handicapSide"
                render={({ field: { onChange, value } }) => (
                  <View style={styles.outcomePicker}>
                    {(['home', 'away'] as const).map((side) => {
                      const label = side === 'home'
                        ? `Ф1${watchedTeam1.trim() ? ` (${watchedTeam1.trim()})` : ''}`
                        : `Ф2${watchedTeam2.trim() ? ` (${watchedTeam2.trim()})` : ''}`;
                      return (
                        <TouchableOpacity
                          key={side}
                          style={[styles.outcomeBtn, value === side && styles.outcomeBtnActive]}
                          onPress={() => { onChange(side); haptic.selection(); }}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.outcomeTxt, value === side && styles.outcomeTxtActive]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              />
            </Field>
            <Field label="Значение форы (напр. −1.5, +2.5)">
              <Controller
                control={control}
                name="pickValue"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={inputStyle}
                    placeholder="-1.5"
                    placeholderTextColor={colors.textMuted}
                    value={value}
                    onChangeText={onChange}
                    keyboardType="numbers-and-punctuation"
                  />
                )}
              />
            </Field>
          </>
        )}

        {/* ── Total: threshold ─── */}
        {isSingle && (watchedBetType === 'total_over' || watchedBetType === 'total_under') && (
          <Field label={watchedBetType === 'total_over' ? 'Порог ТБ (напр. 2.5)' : 'Порог ТМ (напр. 2.5)'}>
            <Controller
              control={control}
              name="pickValue"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={inputStyle}
                  placeholder="2.5"
                  placeholderTextColor={colors.textMuted}
                  value={value}
                  onChangeText={onChange}
                  keyboardType="decimal-pad"
                />
              )}
            />
          </Field>
        )}

        {/* ── Both score: yes / no ─── */}
        {isSingle && watchedBetType === 'both_score' && (
          <Field label="Обе забьют?">
            <Controller
              control={control}
              name="bothScoreYes"
              render={({ field: { onChange, value } }) => (
                <View style={styles.outcomePicker}>
                  {([true, false] as const).map((yes) => (
                    <TouchableOpacity
                      key={String(yes)}
                      style={[styles.outcomeBtn, value === yes && styles.outcomeBtnActive]}
                      onPress={() => { onChange(yes); haptic.selection(); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.outcomeTxt, value === yes && styles.outcomeTxtActive]}>
                        {yes ? 'Да' : 'Нет'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />
          </Field>
        )}

        {/* ── Exact score: free text ─── */}
        {isSingle && watchedBetType === 'exact_score' && (
          <Field label="Точный счёт (напр. 2:1)">
            <Controller
              control={control}
              name="pickValue"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={inputStyle}
                  placeholder="2:1"
                  placeholderTextColor={colors.textMuted}
                  value={value}
                  onChangeText={onChange}
                  keyboardType="numbers-and-punctuation"
                />
              )}
            />
          </Field>
        )}

        {/* ── Extra fields toggle ─── */}
        <TouchableOpacity
          style={styles.extraToggle}
          onPress={() => { haptic.selection(); setShowExtra((v) => !v); }}
          activeOpacity={0.8}
        >
          <Text style={styles.extraToggleText}>
            {showExtra ? '▲  Скрыть детали' : '▼  Стратегия, букмекер, турнир, заметки...'}
          </Text>
        </TouchableOpacity>

        {showExtra && (
          <>
            <Controller
              control={control}
              name="strategy"
              render={({ field: { onChange, value } }) => (
                <SegmentedControl label="Стратегия" options={strategyOptions} value={value} onChange={onChange} />
              )}
            />

            {watchedStrategy === 'other' && (
              <Field label="Уточни стратегию">
                <Controller
                  control={control}
                  name="customStrategy"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      style={inputStyle}
                      placeholder="Матч-ставка, Арбитраж..."
                      placeholderTextColor={colors.textMuted}
                      value={value}
                      onChangeText={onChange}
                    />
                  )}
                />
              </Field>
            )}

            {/* ── Bookmaker ─── */}
            <Field label="Букмекер">
              <Controller
                control={control}
                name="bookmaker"
                render={({ field: { onChange, value } }) => (
                  <View style={styles.bookmakers}>
                    {settings.bookmakers.map((bk) => (
                      <TouchableOpacity
                        key={bk}
                        style={[styles.bkBtn, value === bk && styles.bkBtnActive]}
                        onPress={() => onChange(bk)}
                      >
                        <Text style={[styles.bkText, value === bk && styles.bkTextActive]}>{bk}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              />
            </Field>

            {/* ── Date + Time ─── */}
            <View style={styles.row2}>
              <Field label="Дата">
                <Controller
                  control={control}
                  name="date"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      style={[inputStyle, styles.halfInput]}
                      placeholder="ГГГГ-ММ-ДД"
                      placeholderTextColor={colors.textMuted}
                      value={value}
                      onChangeText={onChange}
                      keyboardType="numbers-and-punctuation"
                    />
                  )}
                />
              </Field>
              <Field label="Время">
                <Controller
                  control={control}
                  name="time"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      style={[inputStyle, styles.halfInput]}
                      placeholder="ЧЧ:ММ"
                      placeholderTextColor={colors.textMuted}
                      value={value}
                      onChangeText={onChange}
                      keyboardType="numbers-and-punctuation"
                    />
                  )}
                />
              </Field>
            </View>

            {/* ── Tournament + Notes ─── */}
            <Field label="Турнир / Лига">
              <Controller
                control={control}
                name="tournament"
                render={({ field: { onChange, value } }) => (
                  <TournamentInput value={value} onChange={onChange} scrollRef={scrollRef} />
                )}
              />
            </Field>

            <Field label="Кэф закрытия (CLV) — необязательно">
              <Controller
                control={control}
                name="closingOdds"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={inputStyle}
                    placeholder="Напр. 1.95 — коэф перед стартом матча"
                    placeholderTextColor={colors.textMuted}
                    value={value}
                    onChangeText={onChange}
                    keyboardType="decimal-pad"
                  />
                )}
              />
            </Field>

            <Field label="Заметки">
              <Controller
                control={control}
                name="notes"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[inputStyle, styles.notes]}
                    placeholder="Анализ, причины выбора..."
                    placeholderTextColor={colors.textMuted}
                    value={value}
                    onChangeText={onChange}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                )}
              />
            </Field>

            {/* ── Freebet toggle ─── */}
            <TouchableOpacity
              style={[styles.freebetToggle, isFreebet && styles.freebetToggleActive]}
              onPress={() => { haptic.selection(); setIsFreebet((v) => !v); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.freebetToggleText, isFreebet && styles.freebetToggleTextActive]}>
                🎁 Фрибет{isFreebet ? ' ✓ (потеря = 0 ₽)' : ' — не свои деньги'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Status (edit only) ─── */}
        {editBet && (
          <Controller
            control={control}
            name="status"
            render={({ field: { onChange, value } }) => (
              <SegmentedControl
                label="Статус"
                options={[
                  { key: 'pending' as BetStatus, label: 'Ожидание' },
                  { key: 'won' as BetStatus, label: 'Победа' },
                  { key: 'lost' as BetStatus, label: 'Проигрыш' },
                  { key: 'refund' as BetStatus, label: 'Возврат' },
                  { key: 'cashout' as BetStatus, label: 'Выкуп' },
                ]}
                value={value}
                onChange={onChange}
              />
            )}
          />
        )}

        {editBet && watchedStatus === 'cashout' && (
          <>
            <Field label="Сумма выкупа (₽)">
              <Controller
                control={control}
                name="cashoutAmount"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={inputStyle}
                    placeholder="500"
                    placeholderTextColor={colors.textMuted}
                    value={value}
                    onChangeText={onChange}
                    keyboardType="decimal-pad"
                  />
                )}
              />
            </Field>
            {cashoutPnl !== null && (
              <View style={styles.winPreview}>
                <Text style={styles.winLabel}>Результат выкупа</Text>
                <Text style={[styles.winAmount, { color: cashoutPnl >= 0 ? colors.won : colors.lost }]}>
                  {cashoutPnl >= 0 ? '+' : ''}{formatMoney(cashoutPnl)}
                </Text>
              </View>
            )}
          </>
        )}

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit(onSubmit)} activeOpacity={0.85}>
          <Text style={styles.submitText}>
            {editBet ? 'Сохранить изменения' : 'Добавить ставку'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  row2: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },

  betModeRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  betModeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  betModeBtnActive: { backgroundColor: colors.purple },
  betModeTxt: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  betModeTxtActive: { color: '#fff' },

  legCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legOddsRow: { flexDirection: 'row', gap: 8 },
  legHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  legTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  legRemove: { fontSize: 16, color: colors.lost },
  legSportChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legSportChipActive: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  legSportChipText: { fontSize: 11, color: colors.textSecondary },
  legSportChipTextActive: { color: '#fff', fontWeight: '700' },
  addLegBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.purple + '88',
    borderStyle: 'dashed',
    alignItems: 'center',
    marginBottom: 12,
  },
  addLegText: { fontSize: 14, fontWeight: '600', color: colors.purple },
  expressOddsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.purpleDim,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.purple + '44',
  },
  expressOddsLabel: { fontSize: 13, color: colors.purple },
  expressOddsValue: { fontSize: 18, fontWeight: '700', color: colors.purple },

  winPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.accentDim,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  winLabel: { fontSize: 13, color: colors.accent },
  winAmount: { fontSize: 16, fontWeight: '700', color: colors.accent },

  extraToggle: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.bgElevated,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  extraToggleText: {
    fontSize: 13,
    color: colors.purple,
    fontWeight: '600',
  },
  freebetToggle: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  freebetToggleActive: { borderColor: colors.accent + '66', backgroundColor: colors.accentDim },
  freebetToggleText: { fontSize: 13, color: colors.textSecondary },
  freebetToggleTextActive: { color: colors.accent, fontWeight: '600' },
  kellyToggle: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  kellyToggleActive: { borderColor: colors.accent + '66', backgroundColor: colors.accentDim },
  kellyToggleText: { fontSize: 13, color: colors.textSecondary },
  kellyToggleTextActive: { color: colors.accent, fontWeight: '600' },

  bookmakers: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bkBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
  },
  bkBtnActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  bkText: { fontSize: 13, color: colors.textSecondary },
  bkTextActive: { color: '#fff', fontWeight: '700' },
  notes: { height: 80 },
  bankShare: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 16, padding: 14, borderRadius: 12,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  bankShareWarn: { borderColor: colors.lost + '77', backgroundColor: colors.lost + '11' },
  bankShareLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  bankShareBank: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  bankShareValue: { fontSize: 20, fontWeight: '800' },
  bankShareHint: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  outcomePicker: {
    flexDirection: 'row',
    gap: 8,
  },
  outcomeBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  outcomeBtnActive: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  outcomeTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  outcomeTxtActive: { color: '#fff' },
  submitBtn: {
    backgroundColor: colors.purple,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
