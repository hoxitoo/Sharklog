import React, { useState, useEffect } from 'react';
import type { Bet } from '@sharklog/core';
import { AppLayout, type Page } from './layouts/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { BetsPage } from './pages/BetsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { BankrollPage } from './pages/BankrollPage';
import { SettingsPage } from './pages/SettingsPage';
import { AddBetModal } from './pages/AddBetModal';
import { useBetsStore } from './store/betsStore';

export function App() {
  const load = useBetsStore((s) => s.load);
  const [page, setPage] = useState<Page>('dashboard');
  const [modalBet, setModalBet] = useState<Bet | null | 'new'>(null);

  useEffect(() => { load(); }, []);

  function openAdd() { setModalBet('new'); }
  function openEdit(bet: Bet) { setModalBet(bet); }
  function closeModal() { setModalBet(null); }

  return (
    <>
      <AppLayout page={page} onNavigate={setPage}>
        {page === 'dashboard' && <DashboardPage />}
        {page === 'bets' && <BetsPage onAdd={openAdd} onEdit={openEdit} />}
        {page === 'analytics' && <AnalyticsPage />}
        {page === 'bankroll' && <BankrollPage />}
        {page === 'settings' && <SettingsPage />}
      </AppLayout>

      {modalBet !== null && (
        <AddBetModal
          {...(modalBet !== 'new' ? { editBet: modalBet } : {})}
          onClose={closeModal}
        />
      )}
    </>
  );
}
