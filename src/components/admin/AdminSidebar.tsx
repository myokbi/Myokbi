import React from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  Film,
  GitBranch,
  Headphones,
  Link2,
  ListTodo,
  Lock,
  MapPin,
  Sliders,
  Users,
} from 'lucide-react';
import { MYOKBI_LOGO_URL } from '../BrandAssets';

export type AdminTab =
  | 'overview'
  | 'database'
  | 'approvals'
  | 'users'
  | 'cms'
  | 'ads'
  | 'tasks'
  | 'districts'
  | 'invites'
  | 'github'
  | 'support';

interface AdminSidebarProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  siteName: string;
  pendingApprovalsCount: number;
  openHelplineCount: number;
  connectedClients: number;
  githubConnected: boolean;
  onBackToPortal: () => void;
  onLockConsole: () => Promise<void>;
}

export default function AdminSidebar({
  currentTab,
  onSelectTab,
  siteName,
  pendingApprovalsCount,
  openHelplineCount,
  connectedClients,
  githubConnected,
  onBackToPortal,
  onLockConsole,
}: AdminSidebarProps) {
  const navGroups: Array<{
    group: string;
    items: Array<{
      id: AdminTab;
      label: string;
      icon: React.ReactNode;
      badge?: number;
      dot?: 'emerald' | 'amber';
    }>;
  }> = [
    {
      group: 'Core Operations',
      items: [
        { id: 'overview', label: 'Server Overview', icon: <Database className="w-4 h-4" /> },
        {
          id: 'approvals',
          label: 'Approvals Queue',
          icon: <CheckCircle2 className="w-4 h-4" />,
          badge: pendingApprovalsCount,
        },
        { id: 'users', label: 'Members & Balances', icon: <Users className="w-4 h-4" /> },
        {
          id: 'support',
          label: 'Live Support & Broadcast',
          icon: <Headphones className="w-4 h-4" />,
          badge: openHelplineCount,
        },
      ],
    },
    {
      group: 'Content & Workspaces',
      items: [
        { id: 'cms', label: 'Site CMS & Branding', icon: <Sliders className="w-4 h-4" /> },
        { id: 'ads', label: 'Ad Networks & Videos', icon: <Film className="w-4 h-4" /> },
        { id: 'tasks', label: 'Tasks & Job Manager', icon: <ListTodo className="w-4 h-4" /> },
        { id: 'districts', label: '64-District Agents', icon: <MapPin className="w-4 h-4" /> },
        { id: 'invites', label: 'Private Invite Links', icon: <Link2 className="w-4 h-4" /> },
      ],
    },
    {
      group: 'Database & Infrastructure',
      items: [
        {
          id: 'database',
          label: 'Realtime DB Explorer',
          icon: <Database className="w-4 h-4" />,
        },
        {
          id: 'github',
          label: 'GitHub Server Sync',
          icon: <GitBranch className="w-4 h-4" />,
          dot: githubConnected ? 'emerald' : 'amber',
        },
      ],
    },
  ];

  return (
    <aside className="lg:w-64 lg:fixed lg:inset-y-0 bg-[#0b1220] text-slate-100 flex flex-col border-r border-slate-800 z-30 select-none">
      {/* Brand & Server Header */}
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={MYOKBI_LOGO_URL}
            alt={siteName}
            className="w-9 h-9 rounded-xl object-cover border border-emerald-500/40 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white tracking-tight truncate">{siteName} Server</p>
            <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span>Realtime Engine</span>
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-5">
        {navGroups.map((group) => (
          <div key={group.group} className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-semibold tracking-wider uppercase text-slate-400">
              {group.group}
            </div>
            {group.items.map((item) => {
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2.5 transition-all duration-150 cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_4px_rgba(5,150,105,0.2)]'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className={active ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {item.dot && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          item.dot === 'emerald' ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                      />
                    )}
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-mono-num font-bold bg-white/20 rounded-md text-white">
                        {item.badge}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer System Status & Exit Actions */}
      <div className="p-3 border-t border-slate-800 space-y-2 bg-[#080d17]">
        <div className="px-3 py-2 bg-slate-900/80 rounded-xl border border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span>Connected Clients</span>
          <span className="font-mono-num font-semibold text-emerald-400">{connectedClients} online</span>
        </div>
        <button
          type="button"
          onClick={onBackToPortal}
          className="btn-gold w-full btn-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Member Portal</span>
        </button>
        <button
          type="button"
          onClick={onLockConsole}
          className="w-full min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/70 hover:bg-red-950/40 hover:border-red-900/60 text-slate-300 hover:text-red-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Lock className="w-4 h-4" />
          <span>Lock Console</span>
        </button>
      </div>
    </aside>
  );
}
