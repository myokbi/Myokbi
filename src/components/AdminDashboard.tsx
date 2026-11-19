import React, { useEffect, useState } from 'react';
import { apiRequest, createRealtimeStream } from '../lib/api';
import type {
  AdminOverviewResponse,
  PublicUserProfile,
} from '../types';
import AdminSidebar, { type AdminTab } from './admin/AdminSidebar';
import AdminTopBar from './admin/AdminTopBar';
import BroadcastModal from './admin/modals/BroadcastModal';
import DatabaseImportModal from './admin/modals/DatabaseImportModal';
import DatabaseRecordModal from './admin/modals/DatabaseRecordModal';
import MemberDetailModal from './admin/modals/MemberDetailModal';
import AdNetworkTab from './admin/tabs/AdNetworkTab';
import ApprovalsTab from './admin/tabs/ApprovalsTab';
import DatabaseExplorerTab, { type DbCollectionName } from './admin/tabs/DatabaseExplorerTab';
import DistrictAgentsTab from './admin/tabs/DistrictAgentsTab';
import GitHubSyncTab from './admin/tabs/GitHubSyncTab';
import InvitesTab from './admin/tabs/InvitesTab';
import OverviewTab from './admin/tabs/OverviewTab';
import SiteCmsTab from './admin/tabs/SiteCmsTab';
import SupportSecurityTab from './admin/tabs/SupportSecurityTab';
import TasksManagerTab from './admin/tabs/TasksManagerTab';
import UsersManagerTab from './admin/tabs/UsersManagerTab';

interface AdminDashboardProps {
  onBackToPortal: () => void;
  onLockConsole: () => Promise<void>;
}

export default function AdminDashboard({ onBackToPortal, onLockConsole }: AdminDashboardProps) {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [ghBusy, setGhBusy] = useState(false);

  // Active Modals State
  const [inspectingUser, setInspectingUser] = useState<PublicUserProfile | null>(null);
  const [recordEditor, setRecordEditor] = useState<{
    collection: DbCollectionName;
    record: Record<string, unknown> | null;
  } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  function showToast(type: 'ok' | 'err', text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  }

  async function loadOverview() {
    try {
      const res = await apiRequest<AdminOverviewResponse>('/api/admin/overview');
      setOverview(res);
      // If inspecting user is open, update user data
      if (inspectingUser) {
        const refreshedUser = res.users.find((u) => u.id === inspectingUser.id);
        if (refreshedUser) setInspectingUser(refreshedUser);
      }
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to load server data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
    const disconnect = createRealtimeStream((eventType) => {
      if (
        eventType === 'state:updated' ||
        eventType === 'config:updated' ||
        eventType === 'chat:updated' ||
        eventType === 'admin:updated' ||
        eventType === 'github:status'
      ) {
        void loadOverview();
      }
    });
    return () => {
      disconnect();
    };
  }, []);

  async function handlePushGitHub() {
    setGhBusy(true);
    try {
      const res = await apiRequest<{ result: { sha: string } }>('/api/admin/github/push', {
        method: 'POST',
        body: JSON.stringify({ message: 'Myokbi Admin Snapshot Commit' }),
      });
      showToast('ok', `Snapshot pushed to GitHub repository (Commit ${res.result.sha.slice(0, 7)})`);
      await loadOverview();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'GitHub push failed.');
    } finally {
      setGhBusy(false);
    }
  }

  function handleExportDatabase() {
    if (!overview) return;
    const blob = new Blob([JSON.stringify(overview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `myokbi-db-snapshot-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('ok', 'Database JSON snapshot downloaded.');
  }

  if (loading || !overview) {
    return (
      <div className="min-h-screen bg-[#f3f5f8] flex items-center justify-center p-6 select-none">
        <div className="surface-card px-6 py-4 text-xs font-semibold text-slate-700 flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
          <span>Connecting to Myokbi Server Console...</span>
        </div>
      </div>
    );
  }

  const pendingApprovalsCount =
    overview.serverStats.pendingDeposits +
    overview.serverStats.pendingWithdraws +
    overview.serverStats.pendingWork;

  const TAB_LABELS: Record<AdminTab, string> = {
    overview: 'Server Overview',
    database: 'Realtime Database Explorer',
    approvals: 'Approvals & Financial Settlement',
    users: 'Members & Balances',
    cms: 'Site CMS & Branding',
    ads: 'Ad Networks & Video Ad Hub',
    tasks: 'Tasks & Job Manager',
    districts: '64-District Agent Network',
    invites: 'Private Invite Links',
    github: 'GitHub Server Sync',
    support: 'Live Support & Security',
  };

  return (
    <div className="min-h-screen bg-[#f3f5f8] flex flex-col lg:flex-row text-slate-900">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 border ${
              toast.type === 'ok'
                ? 'bg-emerald-950 text-emerald-100 border-emerald-800'
                : 'bg-red-950 text-red-100 border-red-800'
            }`}
          >
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <AdminSidebar
        currentTab={tab}
        onSelectTab={setTab}
        siteName={overview.config.siteName}
        pendingApprovalsCount={pendingApprovalsCount}
        openHelplineCount={overview.helplineMessages.length}
        connectedClients={overview.serverStats.connectedClients}
        githubConnected={overview.github.configured}
        onBackToPortal={onBackToPortal}
        onLockConsole={onLockConsole}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Top Header Bar */}
        <AdminTopBar
          currentTabLabel={TAB_LABELS[tab]}
          github={overview.github}
          ghBusy={ghBusy}
          onRefresh={loadOverview}
          onPushGitHub={handlePushGitHub}
          onOpenBroadcast={() => setShowBroadcastModal(true)}
          onExportDatabase={handleExportDatabase}
        />

        {/* Tab Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {tab === 'overview' && (
            <OverviewTab
              overview={overview}
              onNavigateTab={setTab}
              onPushGitHub={handlePushGitHub}
              ghBusy={ghBusy}
            />
          )}

          {tab === 'database' && (
            <DatabaseExplorerTab
              overview={overview}
              onRefresh={loadOverview}
              onOpenRecordEditor={(collection, record) => setRecordEditor({ collection, record })}
              onOpenImportModal={() => setShowImportModal(true)}
              onExportDatabase={handleExportDatabase}
              showToast={showToast}
            />
          )}

          {tab === 'approvals' && (
            <ApprovalsTab
              overview={overview}
              onRefresh={loadOverview}
              showToast={showToast}
            />
          )}

          {tab === 'users' && (
            <UsersManagerTab
              overview={overview}
              onRefresh={loadOverview}
              onSelectUser={setInspectingUser}
              showToast={showToast}
            />
          )}

          {tab === 'cms' && (
            <SiteCmsTab
              config={overview.config}
              onRefresh={loadOverview}
              showToast={showToast}
            />
          )}

          {tab === 'ads' && (
            <AdNetworkTab
              overview={overview}
              onRefresh={loadOverview}
              showToast={showToast}
            />
          )}

          {tab === 'tasks' && (
            <TasksManagerTab
              overview={overview}
              onRefresh={loadOverview}
              showToast={showToast}
            />
          )}

          {tab === 'districts' && (
            <DistrictAgentsTab
              overview={overview}
              onRefresh={loadOverview}
              showToast={showToast}
            />
          )}

          {tab === 'invites' && (
            <InvitesTab
              overview={overview}
              onRefresh={loadOverview}
              showToast={showToast}
            />
          )}

          {tab === 'github' && (
            <GitHubSyncTab
              overview={overview}
              onRefresh={loadOverview}
              showToast={showToast}
            />
          )}

          {tab === 'support' && (
            <SupportSecurityTab
              overview={overview}
              onRefresh={loadOverview}
              onOpenBroadcast={() => setShowBroadcastModal(true)}
              showToast={showToast}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {inspectingUser && (
        <MemberDetailModal
          user={inspectingUser}
          overview={overview}
          onClose={() => setInspectingUser(null)}
          onRefresh={loadOverview}
          showToast={showToast}
        />
      )}

      {recordEditor && (
        <DatabaseRecordModal
          collection={recordEditor.collection}
          initialRecord={recordEditor.record}
          onClose={() => setRecordEditor(null)}
          onRefresh={loadOverview}
          showToast={showToast}
        />
      )}

      {showImportModal && (
        <DatabaseImportModal
          onClose={() => setShowImportModal(false)}
          onRefresh={loadOverview}
          showToast={showToast}
        />
      )}

      {showBroadcastModal && (
        <BroadcastModal
          onClose={() => setShowBroadcastModal(false)}
          showToast={showToast}
        />
      )}
    </div>
  );
}
