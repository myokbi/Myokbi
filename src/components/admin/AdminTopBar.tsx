import React from 'react';
import {
  Download,
  ExternalLink,
  GitBranch,
  Megaphone,
  RefreshCw,
  Upload,
} from 'lucide-react';
import type { GitHubSyncStatus } from '../../types';

interface AdminTopBarProps {
  currentTabLabel: string;
  github: GitHubSyncStatus;
  ghBusy: boolean;
  onRefresh: () => Promise<void>;
  onPushGitHub: () => Promise<void>;
  onOpenBroadcast: () => void;
  onExportDatabase: () => void;
}

export default function AdminTopBar({
  currentTabLabel,
  github,
  ghBusy,
  onRefresh,
  onPushGitHub,
  onOpenBroadcast,
  onExportDatabase,
}: AdminTopBarProps) {
  const isSyncing = github.syncing || ghBusy;

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 h-14 flex items-center justify-between gap-4 select-none">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-500 truncate">
        <span>Console</span>
        <span className="text-slate-300">/</span>
        <strong className="text-slate-900 font-semibold truncate">{currentTabLabel}</strong>
      </div>

      {/* Right: Actions & GitHub Sync Status */}
      <div className="flex items-center gap-2 shrink-0">
        {/* GitHub Quick Sync Indicator & Button */}
        {github.configured && (
          <button
            type="button"
            onClick={onPushGitHub}
            disabled={isSyncing}
            title={
              github.lastCommitSha
                ? `Last synced to GitHub (${github.lastCommitSha.slice(0, 7)})`
                : 'Push current database snapshot to GitHub'
            }
            className="hidden md:inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <GitBranch className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
            <span className="font-mono-num">
              {isSyncing ? 'Syncing...' : github.lastCommitSha ? github.lastCommitSha.slice(0, 7) : 'Sync GitHub'}
            </span>
          </button>
        )}

        {/* Quick Database Backup button */}
        <button
          type="button"
          onClick={onExportDatabase}
          title="Download live database backup (JSON)"
          className="hidden sm:inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Backup JSON</span>
        </button>

        {/* Live Broadcast Modal Trigger */}
        <button
          type="button"
          onClick={onOpenBroadcast}
          className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-colors cursor-pointer"
        >
          <Megaphone className="w-3.5 h-3.5 text-emerald-700" />
          <span className="hidden sm:inline">Broadcast</span>
        </button>

        {/* Refresh All Button */}
        <button
          type="button"
          onClick={onRefresh}
          className="btn-secondary min-h-[36px] px-3 py-1.5 text-xs"
          title="Refresh server state"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </header>
  );
}
