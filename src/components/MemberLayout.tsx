import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  Briefcase,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Film,
  Globe,
  Headphones,
  History,
  Home,
  Layers,
  LayoutGrid,
  LineChart,
  Loader2,
  Lock,
  LogOut,
  MessageSquare,
  Search,
  Send,
  ShieldCheck,
  Table2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { resolveUiCopy } from '../lib/theme';
import { WORKSPACE_NAV_ITEMS, WORKSPACE_TASKS } from '../lib/workspaceIndex';
import type { MemberPage, MemberStateResponse } from '../types';
import { AvatarImage, MYOKBI_LOGO_URL } from './BrandAssets';

interface MemberLayoutProps {
  data: MemberStateResponse;
  activePage: MemberPage;
  onNavigate: (page: MemberPage, focusedTaskName?: string | null) => void;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
  children: React.ReactNode;
}

interface GroundingSearchResult {
  answer: string;
  sources: Array<{ title: string; uri: string }>;
  searchQueries?: string[];
}

interface FlatSearchAction {
  key: string;
  run: () => void;
}

export default function MemberLayout({
  data,
  activePage,
  onNavigate,
  onRefresh,
  onLogout,
  children,
}: MemberLayoutProps) {
  const copy = resolveUiCopy(data.site.config.copy);
  const usdRateBdt = data.site.config.rates.usdRateBdt || 122;
  const [chatOpen, setChatOpen] = useState(false);
  const [chatCategory, setChatCategory] = useState('Deposit Issue');
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  // Global search bar state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const [groundingLoading, setGroundingLoading] = useState(false);
  const [groundingError, setGroundingError] = useState<string | null>(null);
  const [groundingResult, setGroundingResult] = useState<GroundingSearchResult | null>(null);
  const [lastGroundedQuery, setLastGroundedQuery] = useState('');

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const navIcons: Record<MemberPage, React.ReactNode> = {
    dashboard: <Home className="w-4 h-4 shrink-0" />,
    'ad-network': <Layers className="w-4 h-4 shrink-0" />,
    work: <Briefcase className="w-4 h-4 shrink-0" />,
    'video-ads': <Film className="w-4 h-4 shrink-0" />,
    'all-tasks': <LayoutGrid className="w-4 h-4 shrink-0" />,
    'deposit-withdraw': <CreditCard className="w-4 h-4 shrink-0" />,
    agent: <UserCheck className="w-4 h-4 shrink-0" />,
    p2p: <Send className="w-4 h-4 shrink-0" />,
    refer: <Users className="w-4 h-4 shrink-0" />,
    crypto: <LineChart className="w-4 h-4 shrink-0" />,
    leader: <Award className="w-4 h-4 shrink-0" />,
    helpline: <Headphones className="w-4 h-4 shrink-0" />,
    history: <History className="w-4 h-4 shrink-0" />,
    profile: <UserCheck className="w-4 h-4 shrink-0" />,
  };

  const navLabelOverrides: Partial<Record<MemberPage, string>> = {
    'ad-network': copy.adNetworkBtnLabel,
    work: copy.myJobsBtnLabel,
    'all-tasks': copy.tasksBtnLabel,
    crypto: copy.marketBtnLabel,
    'deposit-withdraw': copy.depositWithdrawBtnLabel,
    agent: copy.agentBtnLabel,
    p2p: copy.p2pBtnLabel,
    refer: copy.referBtnLabel,
    leader: copy.workerListBtnLabel,
    helpline: copy.helplineBtnLabel,
    history: copy.historyBtnLabel,
    profile: copy.profileBtnLabel,
  };

  const navItems = WORKSPACE_NAV_ITEMS.map((item) => ({
    ...item,
    label: navLabelOverrides[item.id] || item.label,
    icon: navIcons[item.id],
  }));

  const mobileTabs: Array<{ id: MemberPage; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: 'Home', icon: <Home className="w-5 h-5" /> },
    { id: 'work', label: 'My.Jobs', icon: <Briefcase className="w-5 h-5" /> },
    { id: 'crypto', label: 'Market', icon: <LineChart className="w-5 h-5" /> },
    { id: 'helpline', label: 'Helpline', icon: <Headphones className="w-5 h-5" /> },
    { id: 'history', label: 'History', icon: <History className="w-5 h-5" /> },
  ];

  // Keyboard shortcut Ctrl+K / Cmd+K to focus global search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        if (window.innerWidth < 640) {
          setMobileSearchOpen(true);
          setTimeout(() => mobileInputRef.current?.focus(), 20);
        } else {
          desktopInputRef.current?.focus();
        }
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
        setMobileSearchOpen(false);
        desktopInputRef.current?.blur();
        mobileInputRef.current?.blur();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const matchedPages = useMemo(() => {
    if (!normalizedQuery) {
      return navItems.slice(0, 5);
    }
    return navItems
      .filter((item) => {
        const haystack = `${item.label} ${item.id} ${item.subtitle} ${item.keywords.join(' ')}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 6);
  }, [normalizedQuery, navItems]);

  const matchedTasks = useMemo(() => {
    if (!normalizedQuery) {
      return WORKSPACE_TASKS.slice(0, 3);
    }
    return WORKSPACE_TASKS.filter((task) => {
      const haystack = `${task.number} ${task.name} ${task.desc} ${task.keywords.join(' ')}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    }).slice(0, 5);
  }, [normalizedQuery]);

  const matchedSubmissions = useMemo(() => {
    if (!normalizedQuery) return [];
    return data.workSubmissions
      .filter((sub) => {
        const haystack = `${sub.id} ${sub.category} ${sub.notes} ${sub.status} ${sub.sheetUrl}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 4);
  }, [data.workSubmissions, normalizedQuery]);

  const flatActions: FlatSearchAction[] = useMemo(() => {
    const actions: FlatSearchAction[] = [];
    for (const p of matchedPages) {
      actions.push({
        key: `page-${p.id}`,
        run: () => selectDestination(p.id),
      });
    }
    for (const t of matchedTasks) {
      actions.push({
        key: `task-${t.id}`,
        run: () => selectDestination(t.targetPage, t.available ? null : t.name),
      });
    }
    for (const s of matchedSubmissions) {
      actions.push({
        key: `sub-${s.id}`,
        run: () => selectDestination('work'),
      });
    }
    return actions;
  }, [matchedPages, matchedTasks, matchedSubmissions]);

  useEffect(() => {
    setHighlightedIdx(0);
  }, [normalizedQuery]);

  function selectDestination(page: MemberPage, focusedTaskName?: string | null) {
    onNavigate(page, focusedTaskName ?? null);
    setSearchOpen(false);
    setMobileSearchOpen(false);
  }

  function clearSearch() {
    setSearchQuery('');
    setGroundingResult(null);
    setGroundingError(null);
    setLastGroundedQuery('');
  }

  async function runWebGroundingSearch(explicitQuery?: string) {
    const q = (explicitQuery ?? searchQuery).trim();
    if (q.length < 2) return;
    setGroundingLoading(true);
    setGroundingError(null);
    setLastGroundedQuery(q);
    try {
      const res = await apiRequest<{ ok: boolean } & GroundingSearchResult>('/api/search/grounding', {
        method: 'POST',
        body: JSON.stringify({ query: q }),
      });
      setGroundingResult({
        answer: res.answer,
        sources: res.sources || [],
        searchQueries: res.searchQueries,
      });
    } catch (err) {
      setGroundingResult(null);
      setGroundingError(err instanceof Error ? err.message : 'Unable to fetch web results.');
    } finally {
      setGroundingLoading(false);
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!searchOpen) setSearchOpen(true);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatActions.length > 0) {
        setHighlightedIdx((prev) => (prev + 1) % flatActions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatActions.length > 0) {
        setHighlightedIdx((prev) => (prev - 1 + flatActions.length) % flatActions.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = flatActions[highlightedIdx];
      if (selected) {
        selected.run();
      } else if (searchQuery.trim().length >= 2) {
        void runWebGroundingSearch();
      }
    }
  }

  async function handleQuickChatSend(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setSendingChat(true);
    try {
      await apiRequest('/api/helpline/messages', {
        method: 'POST',
        body: JSON.stringify({ topic: chatCategory, text: chatInput.trim() }),
      });
      setChatInput('');
      await onRefresh();
    } finally {
      setSendingChat(false);
    }
  }

  const renderSearchResultsPanel = () => {
    let flatPointer = 0;

    return (
      <div
        role="listbox"
        aria-label="Global workspace search results"
        className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-40 max-h-[75vh] overflow-y-auto"
      >
        {/* Pages */}
        {matchedPages.length > 0 && (
          <div className="p-2 border-b border-slate-100">
            <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {normalizedQuery ? 'Matching Pages' : 'Quick Jump Pages'}
            </p>
            <div className="space-y-0.5">
              {matchedPages.map((item) => {
                const idx = flatPointer++;
                const isHighlighted = idx === highlightedIdx;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setHighlightedIdx(idx)}
                    onClick={() => selectDestination(item.id)}
                    className={`w-full px-3 py-2 rounded-xl flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                      isHighlighted ? 'bg-emerald-50 text-slate-950' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isHighlighted ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{item.label}</p>
                        <p className="text-[11px] text-slate-500 truncate">{item.subtitle}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Workspace Tasks */}
        {matchedTasks.length > 0 && (
          <div className="p-2 border-b border-slate-100">
            <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Workspace Tasks
            </p>
            <div className="space-y-0.5">
              {matchedTasks.map((task) => {
                const idx = flatPointer++;
                const isHighlighted = idx === highlightedIdx;
                return (
                  <button
                    key={task.id}
                    type="button"
                    onMouseEnter={() => setHighlightedIdx(idx)}
                    onClick={() => selectDestination(task.targetPage, task.available ? null : task.name)}
                    className={`w-full px-3 py-2 rounded-xl flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                      isHighlighted ? 'bg-emerald-50 text-slate-950' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          task.available ? 'bg-[#0b1220] text-emerald-400' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <Table2 className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">
                          {task.number}. {task.name}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{task.desc}</p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold shrink-0 ${
                        task.available ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {task.available ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Available</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3" />
                          <span>Locked</span>
                        </>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* User's Submitted Tasks */}
        {matchedSubmissions.length > 0 && (
          <div className="p-2 border-b border-slate-100">
            <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Your Work Submissions
            </p>
            <div className="space-y-0.5">
              {matchedSubmissions.map((sub) => {
                const idx = flatPointer++;
                const isHighlighted = idx === highlightedIdx;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onMouseEnter={() => setHighlightedIdx(idx)}
                    onClick={() => selectDestination('work')}
                    className={`w-full px-3 py-2 rounded-xl flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                      isHighlighted ? 'bg-emerald-50 text-slate-950' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">
                        {sub.category} · {sub.id}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {sub.notes || sub.sheetUrl}
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-600 font-mono-num shrink-0">
                      {sub.status} · +{sub.reward} ৳
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* No Local Matches */}
        {normalizedQuery && matchedPages.length === 0 && matchedTasks.length === 0 && matchedSubmissions.length === 0 && (
          <div className="px-4 py-4 text-center border-b border-slate-100">
            <p className="text-xs font-medium text-slate-700">
              No matching pages or workspace tasks for &ldquo;{searchQuery.trim()}&rdquo;
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Use live Google Search below to look up real-time web information.
            </p>
          </div>
        )}

        {/* Live Google Search Grounding Action & Result */}
        {searchQuery.trim().length >= 2 && (
          <div className="p-2.5 bg-slate-50/90 space-y-2.5">
            <button
              type="button"
              onClick={() => void runWebGroundingSearch()}
              disabled={groundingLoading}
              className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-[#0b1220] hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer disabled:opacity-60"
            >
              <span className="flex items-center gap-2 min-w-0">
                {groundingLoading ? (
                  <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
                ) : (
                  <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <span className="truncate">
                  {groundingLoading
                    ? 'Searching Google for live data...'
                    : `Search Google Web: "${searchQuery.trim()}"`}
                </span>
              </span>
              <span className="text-[10px] font-mono-num text-emerald-300 shrink-0">Live Search</span>
            </button>

            {groundingError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {groundingError}
              </p>
            )}

            {groundingResult && lastGroundedQuery && (
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-slate-900 truncate">
                    Google Search Summary · {lastGroundedQuery}
                  </p>
                </div>
                <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                  {groundingResult.answer}
                </p>
                {groundingResult.sources.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Grounded Sources
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {groundingResult.sources.map((src) => (
                        <a
                          key={src.uri}
                          href={src.uri}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 text-[11px] font-medium text-emerald-800 border border-slate-200/80 transition-colors max-w-[220px]"
                        >
                          <span className="truncate">{src.title}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ backgroundColor: 'var(--okb-bg)' }}>
      {/* Desktop Navigation Rail */}
      <aside
        className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-slate-800 z-30"
        style={{ backgroundColor: 'var(--okb-vault)', color: 'var(--okb-sidebar-text)' }}
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
          <img
            src={MYOKBI_LOGO_URL}
            alt={data.site.config.siteName}
            className="w-9 h-9 rounded-xl object-cover border border-white/20"
          />
          <span className="text-base font-bold text-white tracking-tight truncate">
            {data.site.config.siteName}
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                style={
                  active
                    ? {
                        backgroundColor: 'var(--okb-primary)',
                        color: 'var(--okb-primary-text)',
                        borderRadius: 'var(--okb-btn-radius)',
                      }
                    : {
                        color: 'var(--okb-sidebar-text)',
                        borderRadius: 'var(--okb-btn-radius)',
                      }
                }
                className={`w-full min-h-[40px] px-3 py-2 text-xs font-semibold flex items-center gap-3 transition-all duration-150 whitespace-nowrap cursor-pointer ${
                  active ? 'shadow-sm' : 'hover:bg-white/10 hover:text-white opacity-90 hover:opacity-100'
                }`}
              >
                <span className={active ? 'opacity-100' : 'opacity-75'}>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-2">
          <button
            type="button"
            onClick={onLogout}
            style={{ borderRadius: 'var(--okb-btn-radius)' }}
            className="w-full min-h-[40px] px-3 py-2 border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen pb-20 lg:pb-8">
        {/* Sticky Navigation Header with Global Search */}
        <div ref={searchContainerRef} className="sticky top-0 z-20">
          <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 h-14 flex items-center justify-between gap-4 sm:gap-6">
            <div className="flex items-center gap-3 shrink-0 min-w-0">
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                className="lg:hidden min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer"
                aria-label="Open ID Card & Menu"
              >
                <img src={MYOKBI_LOGO_URL} alt="Menu" className="w-7 h-7 rounded-lg object-cover" />
              </button>
              <h1 className="text-sm sm:text-base font-bold text-slate-950 truncate max-w-[140px] sm:max-w-[190px]">
                {navItems.find((n) => n.id === activePage)?.label || 'Dashboard'}
              </h1>
            </div>

            {/* Global Search Bar (Tablet/Desktop center zone) */}
            <div className="hidden sm:block flex-1 max-w-md relative">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  ref={desktopInputRef}
                  type="text"
                  value={searchQuery}
                  onFocus={() => setSearchOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Jump to page, find task, or ask Google..."
                  aria-label="Global workspace search"
                  className="w-full min-h-[38px] pl-9 pr-14 text-xs bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-slate-200/90 focus:border-emerald-600 rounded-xl text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={clearSearch}
                    aria-label="Clear search"
                    className="absolute right-2 min-w-[26px] min-h-[26px] rounded-lg hover:bg-slate-200/80 text-slate-500 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <kbd className="absolute right-2.5 text-[10px] font-mono-num text-slate-400 bg-white border border-slate-200/90 rounded-md px-1.5 py-0.5 pointer-events-none">
                    ⌘K
                  </kbd>
                )}
              </div>

              {searchOpen && renderSearchResultsPanel()}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Mobile Search Trigger */}
              <button
                type="button"
                onClick={() => {
                  const next = !mobileSearchOpen;
                  setMobileSearchOpen(next);
                  setSearchOpen(next);
                  if (next) {
                    setTimeout(() => mobileInputRef.current?.focus(), 20);
                  }
                }}
                aria-label="Toggle global search"
                className="sm:hidden min-w-[40px] min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center cursor-pointer"
              >
                {mobileSearchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              </button>

              <div className="text-right hidden sm:block">
                <p className="text-[11px] text-slate-500">{copy.mainBalanceLabel}</p>
                <p className="text-xs font-bold font-mono-num" style={{ color: 'var(--okb-primary)' }}>
                  ৳{data.user.balance.toFixed(2)} · ${(data.user.balance / usdRateBdt).toFixed(2)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                className="min-w-[40px] min-h-[40px] rounded-xl p-0.5 border border-slate-200 hover:border-emerald-500 transition-colors flex items-center justify-center cursor-pointer"
                aria-label="Open Profile"
              >
                <AvatarImage
                  src={data.user.photoUrl}
                  alt={data.user.name}
                  className="w-8 h-8 rounded-lg object-cover"
                />
              </button>
            </div>
          </header>

          {/* Mobile Expandable Search Strip */}
          {mobileSearchOpen && (
            <div className="sm:hidden bg-white border-b border-slate-200 px-4 py-2.5 relative">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  ref={mobileInputRef}
                  type="text"
                  value={searchQuery}
                  onFocus={() => setSearchOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Jump to page, find task, or ask Google..."
                  aria-label="Mobile workspace search"
                  className="w-full min-h-[40px] pl-9 pr-9 text-xs bg-slate-100 focus:bg-white border border-slate-200 focus:border-emerald-600 rounded-xl text-slate-900 placeholder:text-slate-400 outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    aria-label="Clear search"
                    className="absolute right-2 min-w-[28px] min-h-[28px] rounded-lg text-slate-500 flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {searchOpen && <div className="relative">{renderSearchResultsPanel()}</div>}
            </div>
          )}
        </div>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>
      </div>

      {/* Floating Support Widget */}
      <div className="fixed bottom-20 lg:bottom-6 right-4 z-30">
        {chatOpen ? (
          <div className="w-80 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="bg-[#0b1220] text-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs font-bold">OKB Live Agent Support</span>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                aria-label="Close chat"
                className="min-w-[32px] min-h-[32px] rounded-lg hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 max-h-60 overflow-y-auto bg-[#f3f5f8] space-y-2 text-xs">
              <p className="text-slate-500 text-[11px]">
                চ্যাট ৩০ মিনিট পর স্বয়ংক্রিয়ভাবে মুছে যাবে।
              </p>
              {data.helplineMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`px-3 py-2 rounded-xl ${
                    msg.sender === 'User'
                      ? 'bg-emerald-700 text-white ml-6'
                      : 'bg-white border border-slate-200 text-slate-800 mr-6'
                  }`}
                >
                  <p className={`font-semibold text-[10px] mb-0.5 ${msg.sender === 'User' ? 'text-emerald-100' : 'text-slate-500'}`}>
                    {msg.sender === 'User' ? 'আপনি' : msg.sender}
                  </p>
                  <p>{msg.text}</p>
                </div>
              ))}
            </div>
            <form onSubmit={handleQuickChatSend} className="p-2.5 border-t border-slate-200 space-y-2 bg-white">
              <select
                value={chatCategory}
                onChange={(e) => setChatCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
              >
                <option value="Deposit Issue">ডিপোজিট সমস্যা</option>
                <option value="Withdrawal Issue">উইথড্র সমস্যা</option>
                <option value="Task Verification">টাস্ক সমস্যা</option>
                <option value="Other">অন্যান্য সমস্যা</option>
              </select>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="আপনার বার্তা লিখুন..."
                  className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
                <button type="submit" disabled={sendingChat} className="btn-primary btn-sm">
                  পাঠান
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            aria-label="Open Live Agent Support"
            className="w-12 h-12 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 hover:from-emerald-600 hover:to-emerald-700 text-white border border-slate-700 shadow-lg flex items-center justify-center transition-all duration-150 hover:-translate-y-0.5 active:scale-95 cursor-pointer"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 h-16 grid grid-cols-5 items-center px-1"
      >
        {mobileTabs.map((tab) => {
          const active = activePage === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`h-12 mx-0.5 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${
                active
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
