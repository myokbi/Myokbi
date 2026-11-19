import React, { useCallback, useEffect, useState } from 'react';
import AdNetworkHubView from './components/AdNetworkHubView';
import AdminAuthPortal from './components/AdminAuthPortal';
import AdminDashboard from './components/AdminDashboard';
import AgentWithdrawView from './components/AgentWithdrawView';
import AuthPortal from './components/AuthPortal';
import CryptoMarketView from './components/CryptoMarketView';
import DashboardHome from './components/DashboardHome';
import DepositWithdrawView from './components/DepositWithdrawView';
import HelplineView from './components/HelplineView';
import HistoryView from './components/HistoryView';
import LeaderboardView from './components/LeaderboardView';
import MemberLayout from './components/MemberLayout';
import P2PTransferView from './components/P2PTransferView';
import PrivateGate from './components/PrivateGate';
import ProfileCardView from './components/ProfileCardView';
import ReferEarnView from './components/ReferEarnView';
import TasksWorkspace from './components/TasksWorkspace';
import {
  apiRequest,
  createRealtimeStream,
  setAdminToken,
  setPrivateToken,
  setUserToken,
} from './lib/api';
import { applyThemeVariables, DEFAULT_UI_THEME } from './lib/theme';
import type { AccessStatus, MemberPage, MemberStateResponse } from './types';

export default function App() {
  const isAdminRoute =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [memberState, setMemberState] = useState<MemberStateResponse | null>(null);
  const [activePage, setActivePage] = useState<MemberPage>('dashboard');
  const [focusedTaskName, setFocusedTaskName] = useState<string | null>(null);
  const [initialReferCode, setInitialReferCode] = useState('');
  const [inviteNotice, setInviteNotice] = useState('');
  const [booting, setBooting] = useState(true);

  const [broadcastAlert, setBroadcastAlert] = useState<{
    title: string;
    message: string;
    level: 'info' | 'warning' | 'success';
  } | null>(null);

  const handleNavigate = useCallback((page: MemberPage, taskName?: string | null) => {
    setActivePage(page);
    setFocusedTaskName(taskName ?? null);
  }, []);

  const loadMemberState = useCallback(async () => {
    if (isAdminRoute) return;
    try {
      const state = await apiRequest<MemberStateResponse>('/api/member/state');
      setMemberState(state);
    } catch {
      setMemberState(null);
    }
  }, [isAdminRoute]);

  const refreshAll = useCallback(async () => {
    const status = await apiRequest<AccessStatus>('/api/access/status');
    setAccessStatus(status);
    if (!isAdminRoute && status.hasInviteAccess && status.isLoggedInUser) {
      await loadMemberState();
    } else {
      setMemberState(null);
    }
  }, [isAdminRoute, loadMemberState]);

  // Apply real-time UI theme tokens to User App (keep Admin Console neutral)
  useEffect(() => {
    if (isAdminRoute) {
      applyThemeVariables(DEFAULT_UI_THEME);
      return;
    }
    const activeTheme = memberState?.site?.config?.theme || accessStatus?.theme;
    if (activeTheme) {
      applyThemeVariables(activeTheme);
    }
  }, [isAdminRoute, memberState?.site?.config?.theme, accessStatus?.theme]);

  useEffect(() => {
    async function bootstrap() {
      try {
        if (!isAdminRoute) {
          const params = new URLSearchParams(window.location.search);
          const inviteParam = params.get('invite');
          const refParam = params.get('ref');
          if (refParam) setInitialReferCode(refParam);

          if (inviteParam) {
            try {
              const res = await apiRequest<{ ok: boolean; privateToken: string }>('/api/access/verify-invite', {
                method: 'POST',
                body: JSON.stringify({ token: inviteParam }),
              });
              setPrivateToken(res.privateToken);
              params.delete('invite');
              const cleanQuery = params.toString();
              const newUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}`;
              window.history.replaceState({}, '', newUrl);
            } catch (err) {
              setInviteNotice(err instanceof Error ? err.message : 'Invite link invalid or expired.');
            }
          }
        }

        await refreshAll();
      } finally {
        setBooting(false);
      }
    }

    bootstrap();
  }, [isAdminRoute, refreshAll]);

  useEffect(() => {
    if (isAdminRoute) return;
    if (!accessStatus?.hasInviteAccess) {
      return;
    }

    const disconnect = createRealtimeStream((eventType, payload) => {
      if (
        eventType === 'state:updated' ||
        eventType === 'config:updated' ||
        eventType === 'chat:updated'
      ) {
        void loadMemberState();
      } else if (eventType === 'broadcast:message') {
        const data = payload as { title?: string; message?: string; level?: 'info' | 'warning' | 'success' };
        if (data?.message) {
          setBroadcastAlert({
            title: data.title || 'Official Announcement',
            message: data.message,
            level: data.level || 'info',
          });
        }
      }
    });

    return () => {
      disconnect();
    };
  }, [isAdminRoute, accessStatus?.hasInviteAccess, loadMemberState]);

  async function handleMemberLogout() {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    setUserToken('');
    setMemberState(null);
    await refreshAll();
  }

  async function handleAdminLock() {
    await apiRequest('/api/admin/logout', { method: 'POST' });
    setAdminToken('');
    await refreshAll();
  }

  if (booting || !accessStatus) {
    return (
      <div className="min-h-screen bg-[#f3f5f8] flex items-center justify-center p-6">
        <div className="surface-card px-6 py-4 text-sm font-medium text-slate-700">
          Connecting to Myokbi Private Server...
        </div>
      </div>
    );
  }

  // Dedicated Browser Route 1: Admin Console (/admin)
  if (isAdminRoute) {
    if (!accessStatus.isAdmin) {
      return <AdminAuthPortal accessStatus={accessStatus} onAuthenticated={refreshAll} />;
    }
    return (
      <AdminDashboard
        onBackToPortal={() => {
          window.open('/', '_blank', 'noopener,noreferrer');
        }}
        onLockConsole={handleAdminLock}
      />
    );
  }

  // Dedicated Browser Route 2: User App (/)
  if (!accessStatus.hasInviteAccess) {
    return (
      <div>
        {inviteNotice && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 text-center text-xs font-medium text-red-700">
            {inviteNotice}
          </div>
        )}
        <PrivateGate accessStatus={accessStatus} onUnlocked={refreshAll} />
      </div>
    );
  }

  if (!memberState) {
    return (
      <AuthPortal
        siteName={accessStatus.siteName}
        tagline={accessStatus.tagline}
        initialReferCode={initialReferCode}
        onSuccess={refreshAll}
      />
    );
  }

  return (
    <>
      {broadcastAlert && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 animate-in fade-in slide-in-from-top-3 duration-200">
          <div
            className={`p-3.5 rounded-2xl shadow-xl border flex items-start justify-between gap-3 text-xs ${
              broadcastAlert.level === 'warning'
                ? 'bg-amber-950 text-amber-100 border-amber-800'
                : broadcastAlert.level === 'success'
                ? 'bg-emerald-950 text-emerald-100 border-emerald-800'
                : 'bg-slate-950 text-slate-100 border-slate-800'
            }`}
          >
            <div>
              <p className="font-bold uppercase tracking-wider text-[10px] opacity-80">
                {broadcastAlert.title}
              </p>
              <p className="mt-0.5 text-xs font-medium">{broadcastAlert.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setBroadcastAlert(null)}
              className="text-white/60 hover:text-white p-1 cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      <MemberLayout
        data={memberState}
        activePage={activePage}
        onNavigate={handleNavigate}
        onRefresh={loadMemberState}
        onLogout={handleMemberLogout}
      >
        {activePage === 'dashboard' && <DashboardHome data={memberState} onNavigate={handleNavigate} />}
        {activePage === 'ad-network' && <AdNetworkHubView data={memberState} onRefresh={loadMemberState} />}
        {activePage === 'work' && (
          <TasksWorkspace key="my-jobs" data={memberState} defaultTab="my-jobs" onRefresh={loadMemberState} />
        )}
        {activePage === 'video-ads' && (
          <TasksWorkspace key="video-ads" data={memberState} defaultTab="video-ads" onRefresh={loadMemberState} />
        )}
        {activePage === 'all-tasks' && (
          <TasksWorkspace
            key="all-tasks"
            data={memberState}
            defaultTab="all-tasks"
            focusedTaskName={focusedTaskName}
            onClearFocusedTask={() => setFocusedTaskName(null)}
            onRefresh={loadMemberState}
          />
        )}
        {activePage === 'deposit-withdraw' && (
          <DepositWithdrawView data={memberState} onRefresh={loadMemberState} />
        )}
        {activePage === 'agent' && <AgentWithdrawView data={memberState} onRefresh={loadMemberState} />}
        {activePage === 'p2p' && <P2PTransferView data={memberState} onRefresh={loadMemberState} />}
        {activePage === 'refer' && <ReferEarnView data={memberState} />}
        {activePage === 'crypto' && <CryptoMarketView data={memberState} onRefresh={loadMemberState} />}
        {activePage === 'leader' && <LeaderboardView data={memberState} />}
        {activePage === 'profile' && (
          <ProfileCardView data={memberState} onNavigate={handleNavigate} onRefresh={loadMemberState} />
        )}
        {activePage === 'helpline' && <HelplineView data={memberState} onRefresh={loadMemberState} />}
        {activePage === 'history' && <HistoryView data={memberState} />}
      </MemberLayout>
    </>
  );
}
