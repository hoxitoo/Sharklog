import React, { useState, useEffect } from 'react';
import type { Bet } from '@sharklog/core';
import { AppLayout, type Page } from './layouts/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { BetsPage } from './pages/BetsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { BankrollPage } from './pages/BankrollPage';
import { SettingsPage } from './pages/SettingsPage';
import { DiaryPage } from './pages/DiaryPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { AddBetModal } from './pages/AddBetModal';
import { Toaster } from './components/Toaster';
import { useBetsStore } from './store/betsStore';
import { colors } from './theme/colors';

const PAGE_ORDER: Page[] = ['dashboard', 'bets', 'analytics', 'bankroll', 'diary', 'settings'];

export function App() {
  const load = useBetsStore((s) => s.load);
  const isLoaded = useBetsStore((s) => s.isLoaded);
  const onboardingComplete = useBetsStore((s) => s.settings.onboardingComplete);
  const [page, setPage] = useState<Page>('dashboard');
  const [modalBet, setModalBet] = useState<Bet | null | 'new'>(null);

  useEffect(() => { load(); }, []);

  function openAdd() { setModalBet('new'); }
  function openEdit(bet: Bet) { setModalBet(bet); }
  function closeModal() { setModalBet(null); }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && modalBet !== null) { closeModal(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); openAdd(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '6') {
        const idx = parseInt(e.key, 10) - 1;
        const target = PAGE_ORDER[idx];
        if (target) { e.preventDefault(); setPage(target); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalBet]);

  if (!isLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: colors.bg }}>
        <div style={{ fontSize: 40 }}>🦈</div>
      </div>
    );
  }

  if (!onboardingComplete) {
    return (
      <>
        <OnboardingPage onFinish={(openBet) => { if (openBet) setModalBet('new'); }} />
        {modalBet !== null && (
          <AddBetModal {...(modalBet !== 'new' ? { editBet: modalBet as Bet } : {})} onClose={closeModal} />
        )}
        <Toaster />
      </>
    );
  }

  return (
    <>
      <AppLayout page={page} onNavigate={setPage} onAddBet={openAdd}>
        {page === 'dashboard' && <DashboardPage />}
        {page === 'bets' && <BetsPage onAdd={openAdd} onEdit={openEdit} />}
        {page === 'analytics' && <AnalyticsPage />}
        {page === 'bankroll' && <BankrollPage />}
        {page === 'diary' && <DiaryPage />}
        {page === 'settings' && <SettingsPage />}
      </AppLayout>

      {modalBet !== null && (
        <AddBetModal
          {...(modalBet !== 'new' ? { editBet: modalBet as Bet } : {})}
          onClose={closeModal}
        />
      )}

      <Toaster />
    </>
  );
}
