import React, { useState } from 'react';
import { isInTilt, formatMoney } from '@sharklog/core';
import type { DiaryEntry } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';
import { colors } from '../theme/colors';
import { useTranslation } from 'react-i18next';

function uuid(): string {
  return crypto.randomUUID();
}

export function DiaryPage() {
  const { bets, diary, settings, addDiaryEntry } = useBetsStore();
  const { t, i18n } = useTranslation();
  const today = new Date().toISOString().split('T')[0] ?? '';
  const todayEntry = diary.find((d) => d.date === today);

  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5>(todayEntry?.mood ?? 3);
  const [text, setText] = useState(todayEntry?.text ?? '');

  const MOOD_LABELS: Record<number, string> = {
    1: `😤 ${t('discipline.moodTilt')}`,
    2: `😟 ${t('discipline.moodBadLabel')}`,
    3: `😐 ${t('discipline.moodNeutralLabel')}`,
    4: `🙂 ${t('discipline.moodGoodLabel')}`,
    5: `😎 ${t('discipline.moodFlow')}`,
  };

  const RULES = [
    t('discipline.rule1'),
    t('discipline.rule2'),
    t('discipline.rule3'),
    t('discipline.rule4'),
    t('discipline.rule5'),
    t('discipline.rule6'),
    t('discipline.rule7'),
    t('discipline.rule8'),
  ];

  const inTilt = isInTilt(bets, settings.tiltThreshold);
  const lostStreak = (() => {
    let count = 0;
    for (const bet of [...bets].filter((b) => b.status === 'won' || b.status === 'lost').sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      if (bet.status === 'lost') count++;
      else break;
    }
    return count;
  })();
  const winStreak = (() => {
    let count = 0;
    for (const bet of [...bets].filter((b) => b.status === 'won' || b.status === 'lost').sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      if (bet.status === 'won') count++;
      else break;
    }
    return count;
  })();

  const todayBets = bets.filter((b) => b.date === today);
  const todayPnl = todayBets.reduce((sum, b) => {
    if (b.status === 'won') return sum + Math.round(b.stake * b.odds) - b.stake;
    if (b.status === 'lost') return sum - b.stake;
    return sum;
  }, 0);

  function handleSave() {
    const entry: DiaryEntry = {
      id: todayEntry?.id ?? uuid(),
      date: today,
      mood,
      ...(text.trim() ? { text: text.trim() } : {}),
    };
    addDiaryEntry(entry);
  }

  const locale = i18n.language === 'en' ? 'en-US' : 'ru-RU';

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>{t('discipline.title')}</h1>
          <div style={s.subtitle}>{t('discipline.subtitle')}</div>
        </div>
      </div>

      {inTilt && (
        <div style={s.tiltBanner}>
          <span style={{ fontSize: 22 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: colors.lost }}>
              {t('discipline.tiltBannerTitle', { count: lostStreak })}
            </div>
            <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
              {t('discipline.tiltBannerSub')}
            </div>
          </div>
        </div>
      )}

      <div style={s.grid}>
        {/* Left column: today's entry */}
        <div>
          {/* Mood picker */}
          <div style={s.card}>
            <div style={s.cardTitle}>{t('discipline.todayMood')}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {([1, 2, 3, 4, 5] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMood(m)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10, cursor: 'pointer',
                    border: `2px solid ${mood === m ? colors.purple : colors.border}`,
                    backgroundColor: mood === m ? colors.purpleDim : colors.bgElevated,
                    fontSize: 11, color: mood === m ? colors.purple : colors.textSecondary,
                    fontWeight: mood === m ? 700 : 400,
                    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 4,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{MOOD_LABELS[m]?.split(' ')[0]}</span>
                  <span>{m}</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 14, textAlign: 'center' }}>
              {MOOD_LABELS[mood]}
            </div>

            <textarea
              style={s.textarea}
              placeholder={t('discipline.notesPlaceholder')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
            />

            <button style={s.saveBtn} onClick={handleSave}>
              {todayEntry ? t('discipline.updateEntry') : t('discipline.saveEntry')}
            </button>
          </div>

          {/* Tilt statistics */}
          <div style={s.card}>
            <div style={s.cardTitle}>{t('discipline.tiltStats')}</div>
            <div style={s.statsGrid}>
              <div style={s.statCell}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: lostStreak > 0 ? colors.lost : colors.textPrimary }}>
                  {lostStreak}
                </div>
                <div style={s.statLabel}>{t('discipline.lostStreak')}</div>
              </div>
              <div style={s.statCell}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: winStreak > 0 ? colors.won : colors.textPrimary }}>
                  {winStreak}
                </div>
                <div style={s.statLabel}>{t('discipline.winStreak')}</div>
              </div>
              <div style={s.statCell}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
                  {settings.tiltThreshold}
                </div>
                <div style={s.statLabel}>{t('discipline.tiltThresholdLabel')}</div>
              </div>
              <div style={s.statCell}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: todayBets.length > 0 ? colors.accent : colors.textPrimary }}>
                  {todayBets.length}
                </div>
                <div style={s.statLabel}>{t('discipline.betsToday')}</div>
              </div>
            </div>
            {todayBets.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: colors.textMuted }}>{t('discipline.pnlToday')}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: todayPnl >= 0 ? colors.won : colors.lost }}>
                  {todayPnl >= 0 ? '+' : ''}{formatMoney(todayPnl)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right column: rules + diary history */}
        <div>
          <div style={s.card}>
            <div style={s.cardTitle}>{t('discipline.rules')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {RULES.map((rule, i) => (
                <div key={i} style={s.ruleRow}>
                  <div style={s.ruleNum}>{i + 1}</div>
                  <div style={{ fontSize: 13, color: colors.textPrimary }}>{rule}</div>
                </div>
              ))}
            </div>
          </div>

          {diary.length > 0 && (
            <div style={s.card}>
              <div style={s.cardTitle}>{t('discipline.diaryHistory')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                {[...diary].sort((a, b) => b.date.localeCompare(a.date)).map((entry) => {
                  const moodEmoji = {
                    1: '😤', 2: '😟', 3: '😐', 4: '🙂', 5: '😎',
                  }[entry.mood] ?? '😐';
                  return (
                    <div key={entry.id} style={s.diaryRow}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: entry.text ? 6 : 0 }}>
                        <span style={{ fontSize: 12, color: colors.textMuted }}>
                          {new Date(entry.date + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                        </span>
                        <span style={{ fontSize: 18 }}>{moodEmoji}</span>
                      </div>
                      {entry.text && <div style={{ fontSize: 13, color: colors.textSecondary }}>{entry.text}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', flex: 1, overflow: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 700, color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  tiltBanner: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: 16, borderRadius: 12, marginBottom: 20,
    backgroundColor: colors.lost + '15', border: `1px solid ${colors.lost}44`,
  },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  card: {
    backgroundColor: colors.bgCard, borderRadius: 14, padding: 20,
    border: `1px solid ${colors.border}`, marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 16 },
  textarea: {
    width: '100%', backgroundColor: colors.bgElevated, border: `1px solid ${colors.border}`,
    borderRadius: 8, padding: '10px 12px', color: colors.textPrimary, fontSize: 13,
    outline: 'none', resize: 'vertical' as const, boxSizing: 'border-box' as const,
    fontFamily: 'inherit', marginBottom: 12,
  },
  saveBtn: {
    width: '100%', backgroundColor: colors.purple, color: '#fff', border: 'none',
    borderRadius: 10, padding: '10px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 },
  statCell: { textAlign: 'center' as const, padding: '8px 0' },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  ruleRow: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '8px 0', borderBottom: `1px solid ${colors.border}`,
  },
  ruleNum: {
    minWidth: 22, height: 22, borderRadius: 6,
    backgroundColor: colors.purple + '22', color: colors.purple,
    fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  diaryRow: {
    backgroundColor: colors.bgElevated, borderRadius: 8, padding: '10px 12px',
    border: `1px solid ${colors.border}`,
  },
};
