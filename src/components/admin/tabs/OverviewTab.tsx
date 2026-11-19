import React from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
  Film,
  GitBranch,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import type { AdminOverviewResponse } from '../../../types';
import type { AdminTab } from '../AdminSidebar';

interface OverviewTabProps {
  overview: AdminOverviewResponse;
  onNavigateTab: (tab: AdminTab) => void;
  onPushGitHub: () => Promise<void>;
  ghBusy: boolean;
}

export default function OverviewTab({
  overview,
  onNavigateTab,
  onPushGitHub,
  ghBusy,
}: OverviewTabProps) {
  const { serverStats, config, github } = overview;

  const uptimeDays = Math.floor(serverStats.uptimeSeconds / 86400);
  const uptimeHours = Math.floor((serverStats.uptimeSeconds % 86400) / 3600);
  const uptimeMinutes = Math.floor((serverStats.uptimeSeconds % 3600) / 60);

  const pendingTotal =
    serverStats.pendingDeposits + serverStats.pendingWithdraws + serverStats.pendingWork;

  return (
    <div className="space-y-6">
      {/* Top Banner Notice if Maintenance is Active */}
      {config.maintenanceMode && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Maintenance Mode Active
              </p>
              <p className="text-xs text-amber-700">
                Non-admin members are currently seeing the maintenance notice screen.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('cms')}
            className="btn-secondary btn-sm"
          >
            Manage CMS
          </button>
        </div>
      )}

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Members */}
        <div className="surface-card p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Registered Members</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono-num text-slate-900">
            {serverStats.totalUsers.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{serverStats.connectedClients} active live sessions</span>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="surface-card p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Pending Approvals</span>
            <CheckCircle2 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono-num text-slate-900">
            {pendingTotal}
          </div>
          <div className="mt-2 text-xs text-slate-500 truncate">
            {serverStats.pendingDeposits} Dep · {serverStats.pendingWithdraws} Wit · {serverStats.pendingWork} Work
          </div>
        </div>

        {/* Member Balances Vault */}
        <div className="surface-card p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Member Total Balance</span>
            <Wallet className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono-num text-slate-900">
            {serverStats.totalBalanceBdt.toLocaleString()} <span className="text-sm font-normal text-slate-500">৳</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 truncate">
            Deposit pool: {serverStats.totalDepositBalanceBdt.toLocaleString()} ৳
          </div>
        </div>

        {/* Ad Network Payouts */}
        <div className="surface-card p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Ad Views & Payouts</span>
            <Film className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono-num text-slate-900">
            {serverStats.totalAdPayoutBdt.toLocaleString()} <span className="text-sm font-normal text-slate-500">৳</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 truncate">
            {serverStats.totalAdWatches.toLocaleString()} verified ad impressions
          </div>
        </div>
      </div>

      {/* Quick Action Cards & Realtime Server Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pending Items Inbox Banner */}
        <div className="lg:col-span-2 surface-card p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Financial Approvals Inbox</h3>
              <p className="text-xs text-slate-500 mt-1">
                Review and approve member deposits (bKash/Nagad/Rocket/USDT), district agent cashouts, and submitted Google Sheet data entry jobs in real time.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('approvals')}
              className="btn-primary btn-sm shrink-0"
            >
              <span>Open Queue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-xs text-slate-500">Pending Deposits</span>
              <p className="text-lg font-bold font-mono-num text-slate-900 mt-0.5">
                {serverStats.pendingDeposits}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-xs text-slate-500">Pending Withdraws</span>
              <p className="text-lg font-bold font-mono-num text-slate-900 mt-0.5">
                {serverStats.pendingWithdraws}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-xs text-slate-500">Pending Jobs</span>
              <p className="text-lg font-bold font-mono-num text-slate-900 mt-0.5">
                {serverStats.pendingWork}
              </p>
            </div>
          </div>
        </div>

        {/* GitHub & Persistence Architecture Card */}
        <div className="surface-card p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">GitHub Server Sync</span>
              <GitBranch className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-xs text-slate-600">
              {github.configured
                ? `Syncing state to ${github.owner}/${github.repo} (${github.branch})`
                : 'GitHub repository not yet configured.'}
            </p>
          </div>

          <div className="space-y-1.5 text-xs text-slate-500 font-mono-num">
            <div className="flex justify-between">
              <span>Auto-sync on save:</span>
              <strong className="text-slate-800">{github.autoSync ? 'Enabled' : 'Disabled'}</strong>
            </div>
            <div className="flex justify-between">
              <span>Live Watch (pull):</span>
              <strong className="text-slate-800">{github.liveWatch ? 'Active (15s)' : 'Off'}</strong>
            </div>
            <div className="flex justify-between">
              <span>Last Commit:</span>
              <strong className="text-slate-800">
                {github.lastCommitSha ? github.lastCommitSha.slice(0, 7) : 'None'}
              </strong>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex gap-2">
            <button
              type="button"
              onClick={onPushGitHub}
              disabled={!github.configured || ghBusy || github.syncing}
              className="btn-secondary btn-sm flex-1 text-xs"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>{github.syncing || ghBusy ? 'Pushing...' : 'Push Now'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('github')}
              className="btn-secondary btn-sm"
            >
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* Realtime Engine Telemetry & Server Metadata */}
      <div className="surface-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Realtime Database & Server Health</h3>
          </div>
          <span className="text-xs text-slate-500 font-mono-num">
            Uptime: {uptimeDays}d {uptimeHours}h {uptimeMinutes}m
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-500">Storage Engine</span>
            <p className="font-semibold text-slate-900 mt-1">Atomic JSON + GitHub Sync</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-500">Stream Protocol</span>
            <p className="font-semibold text-slate-900 mt-1">Server-Sent Events (SSE)</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-500">Pool Market Cap (USD)</span>
            <p className="font-semibold text-slate-900 font-mono-num mt-1">
              ${serverStats.poolMarketCapUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-500">Security Gate</span>
            <p className="font-semibold text-slate-900 mt-1">
              {config.privateMode ? 'Private Invite Only' : 'Public Access'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => onNavigateTab('database')}
          className="surface-card p-4 text-left hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <Database className="w-5 h-5 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
          <p className="text-xs font-bold text-slate-900">Realtime DB Explorer</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Direct Firebase RTDB replacement to inspect and edit collections</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('users')}
          className="surface-card p-4 text-left hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <Users className="w-5 h-5 text-sky-600 mb-2 group-hover:scale-110 transition-transform" />
          <p className="text-xs font-bold text-slate-900">Members & Balances</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Manage user accounts, adjust balances, and view referral trees</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('cms')}
          className="surface-card p-4 text-left hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <TrendingUp className="w-5 h-5 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
          <p className="text-xs font-bold text-slate-900">Site CMS & Gateways</p>
          <p className="text-[11px] text-slate-500 mt-0.5">bKash/Nagad/Rocket numbers, rates, banners, and notice bar</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('ads')}
          className="surface-card p-4 text-left hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <Film className="w-5 h-5 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
          <p className="text-xs font-bold text-slate-900">Ad Networks & Videos</p>
          <p className="text-[11px] text-slate-500 mt-0.5">30s video ads, 10s smartlinks, campaigns, and ad payouts</p>
        </button>
      </div>
    </div>
  );
}
