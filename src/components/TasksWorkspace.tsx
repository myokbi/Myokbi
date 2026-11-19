import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock,
  ExternalLink,
  Film,
  GitBranch,
  LineChart,
  Lock,
  Mail,
  Megaphone,
  Play,
  Share2,
  ShieldAlert,
  Sparkles,
  Table2,
  TrendingUp,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { resolveUiCopy } from '../lib/theme';
import { WORKSPACE_TASKS } from '../lib/workspaceIndex';
import type { CustomTaskItem, MemberStateResponse, VideoAdCampaign } from '../types';
import { StatusText } from './BrandAssets';
import VideoAdPlayerModal from './VideoAdPlayerModal';

interface TasksWorkspaceProps {
  data: MemberStateResponse;
  defaultTab?: 'my-jobs' | 'video-ads' | 'all-tasks';
  focusedTaskName?: string | null;
  onClearFocusedTask?: () => void;
  onRefresh: () => Promise<void>;
}

const TASK_ICON_MAP: Record<string, React.ReactNode> = {
  seo: <LineChart className="w-5 h-5 text-emerald-700" />,
  'social-marketing': <Share2 className="w-5 h-5 text-sky-600" />,
  'captcha-join': <ShieldAlert className="w-5 h-5 text-rose-600" />,
  'traffic-analyze': <TrendingUp className="w-5 h-5 text-indigo-600" />,
  'email-marketing': <Mail className="w-5 h-5 text-amber-700" />,
  'social-ad-manager': <Megaphone className="w-5 h-5 text-teal-600" />,
  'git-create': <GitBranch className="w-5 h-5 text-slate-800" />,
};

export default function TasksWorkspace({
  data,
  defaultTab = 'my-jobs',
  focusedTaskName = null,
  onClearFocusedTask,
  onRefresh,
}: TasksWorkspaceProps) {
  const copy = resolveUiCopy(data.site.config.copy);
  const sheetInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<'my-jobs' | 'video-ads' | 'all-tasks'>(defaultTab);
  const [sheetUrl, setSheetUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [lockedTaskModal, setLockedTaskModal] = useState<string | null>(null);
  const [activeAdCampaign, setActiveAdCampaign] = useState<VideoAdCampaign | null>(null);
  const [adSmartlinkLaunched, setAdSmartlinkLaunched] = useState(false);
  const [adPlayerKey, setAdPlayerKey] = useState(0);
  const [adRewardNotice, setAdRewardNotice] = useState<string | null>(null);

  const serverTasks: CustomTaskItem[] = useMemo(
    () => (data.customTasks || []).filter((t) => t.active),
    [data.customTasks]
  );

  const [selectedTaskId, setSelectedTaskId] = useState<string>(serverTasks[0]?.id || '');
  const [selectedCategory, setSelectedCategory] = useState(serverTasks[0]?.title || 'Data Entry');

  const selectedTask = useMemo(
    () => serverTasks.find((t) => t.id === selectedTaskId) || serverTasks[0] || null,
    [serverTasks, selectedTaskId]
  );

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (focusedTaskName) {
      setTab('all-tasks');
      setLockedTaskModal(focusedTaskName);
    }
  }, [focusedTaskName]);

  function handleSelectAdminTask(task: CustomTaskItem) {
    setSelectedTaskId(task.id);
    setSelectedCategory(task.title);
    setTab('my-jobs');
    setFeedback(null);
    setTimeout(() => {
      sheetInputRef.current?.focus();
    }, 60);
  }

  const lockedCategories = WORKSPACE_TASKS.filter((task) => !task.available).map((task) => ({
    ...task,
    icon: TASK_ICON_MAP[task.id] || <Briefcase className="w-5 h-5 text-slate-600" />,
  }));

  const adNetwork = data.site.config.adNetwork;
  const activeCampaigns = useMemo(
    () => (adNetwork?.campaigns || []).filter((c) => c.active),
    [adNetwork]
  );

  const activeSmartlinkPool = useMemo(() => {
    return (adNetwork?.smartlinks || []).filter((s) => s.active && /^https?:\/\//i.test(s.url));
  }, [adNetwork]);

  function resolveCampaignSmartlink(camp: VideoAdCampaign, index = 0): string {
    if (camp.thirdPartyTagUrl && /^https?:\/\//i.test(camp.thirdPartyTagUrl.trim())) {
      return camp.thirdPartyTagUrl.trim();
    }
    if (activeSmartlinkPool.length > 0) {
      return activeSmartlinkPool[index % activeSmartlinkPool.length].url;
    }
    return adNetwork?.primarySmartlinkUrl?.trim() || '';
  }

  useEffect(() => {
    if (tab !== 'video-ads') return;
    const customScript = adNetwork?.customScriptUrl?.trim();
    if (customScript && /^https?:\/\//i.test(customScript)) {
      const existing = document.querySelector(`script[data-okb-ad-src="${customScript}"]`);
      if (!existing) {
        const script = document.createElement('script');
        script.src = customScript;
        script.async = true;
        script.dataset.okbAdSrc = customScript;
        document.body.appendChild(script);
      }
    }
  }, [tab, adNetwork?.customScriptUrl]);

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const adLogs = data.adWatchLogs || [];
  const todayAdLogs = adLogs.filter((l) => l.timestamp >= todayStart);
  const todayAdEarnings = todayAdLogs.reduce((sum, l) => sum + Number(l.rewardBdt || 0), 0);

  async function handleSubmitTask(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    try {
      await apiRequest('/api/work/submit', {
        method: 'POST',
        body: JSON.stringify({
          taskId: selectedTask?.id || undefined,
          category: selectedTask?.title || selectedCategory,
          sheetUrl,
          notes,
        }),
      });
      setSheetUrl('');
      setNotes('');
      setFeedback({ type: 'ok', text: 'Google Sheet link submitted successfully. Waiting for admin verification.' });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Submission failed.' });
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenAd(campaign: VideoAdCampaign, launchedSmartlink = false) {
    setAdRewardNotice(null);
    setAdSmartlinkLaunched(launchedSmartlink);
    setActiveAdCampaign(campaign);
    setAdPlayerKey((k) => k + 1);
  }

  function handleWatchNextAd() {
    if (!activeCampaigns.length || !activeAdCampaign) {
      setAdPlayerKey((k) => k + 1);
      return;
    }
    const idx = activeCampaigns.findIndex((c) => c.id === activeAdCampaign.id);
    const nextIdx = (idx + 1) % activeCampaigns.length;
    const nextCampaign = activeCampaigns[nextIdx];
    const hasLink = Boolean(resolveCampaignSmartlink(nextCampaign, nextIdx));
    setAdSmartlinkLaunched(hasLink);
    setActiveAdCampaign(nextCampaign);
    setAdPlayerKey((k) => k + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Work &amp; Task Workspace</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            অ্যাডমিন থেকে পাঠানো লাইভ টাস্ক সম্পূর্ণ করে গুগল শিট লিংক জমা দিন এবং আয় করুন
          </p>
        </div>

        <div className="segment-track grid-cols-3 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setTab('my-jobs')}
            className={`segment-btn ${tab === 'my-jobs' ? 'segment-btn-active' : 'segment-btn-idle'}`}
          >
            {copy.myJobsBtnLabel}
          </button>
          <button
            type="button"
            onClick={() => setTab('video-ads')}
            className={`segment-btn flex items-center justify-center gap-1.5 ${
              tab === 'video-ads' ? 'segment-btn-active' : 'segment-btn-idle'
            }`}
          >
            <Film className="w-3.5 h-3.5 shrink-0" />
            <span>ভিডিও এড</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('all-tasks')}
            className={`segment-btn ${tab === 'all-tasks' ? 'segment-btn-active' : 'segment-btn-idle'}`}
          >
            {copy.tasksBtnLabel}
          </button>
        </div>
      </div>

      {tab === 'my-jobs' && (
        <div className="space-y-6">
          {/* Live Tasks Assigned by Admin */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-950">
                Live Tasks from Admin ({serverTasks.length})
              </h3>
              <span className="text-xs text-slate-500">
                টাস্ক সিলেক্ট করে কাজ শেষে নিচে গুগল শিট লিংক জমা দিন
              </span>
            </div>

            {serverTasks.length === 0 ? (
              <div className="surface-card p-6 text-center text-xs text-slate-500">
                No active tasks assigned by Admin right now. Please check back shortly.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {serverTasks.map((task) => {
                  const isSelected = selectedTask?.id === task.id;
                  return (
                    <div
                      key={task.id}
                      className={`p-4 sm:p-5 rounded-2xl border flex flex-col justify-between gap-3 transition-all ${
                        isSelected
                          ? 'bg-[#0b1220] text-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                          : 'surface-card hover:border-emerald-500'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className={`font-semibold ${isSelected ? 'text-emerald-400' : 'text-emerald-700'}`}>
                            {task.category}
                          </span>
                          <span className="font-mono-num font-bold text-amber-500">
                            +{task.rewardBdt} ৳
                          </span>
                        </div>
                        <h4 className={`text-sm font-bold leading-snug ${isSelected ? 'text-white' : 'text-slate-950'}`}>
                          {task.title}
                        </h4>
                        <p className={`text-xs leading-relaxed ${isSelected ? 'text-slate-300' : 'text-slate-600'}`}>
                          {task.description || task.instructions}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-200/20 flex items-center justify-between gap-2">
                        {task.sheetUrl ? (
                          <a
                            href={task.sheetUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={`text-xs font-semibold inline-flex items-center gap-1 hover:underline ${
                              isSelected ? 'text-emerald-300' : 'text-emerald-700'
                            }`}
                          >
                            <span>Open Sheet</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-[11px] opacity-70 font-mono-num">{task.id}</span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleSelectAdminTask(task)}
                          className={isSelected ? 'btn-gold btn-sm' : 'btn-primary btn-sm'}
                        >
                          {isSelected ? 'Selected ✓' : 'Select Task'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-5 surface-card p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#0b1220] text-emerald-400 flex items-center justify-center shrink-0">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-950 truncate">
                      {selectedTask ? selectedTask.title : 'গুগল শিট কাজ জমা দিন'}
                    </h3>
                    <p className="text-xs text-slate-500 truncate">
                      {selectedTask ? selectedTask.category : 'Google Sheet Work Submission'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-700 font-mono-num shrink-0">
                  +{selectedTask ? selectedTask.rewardBdt : data.site.config.rates.taskReward} ৳ / Task
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 space-y-1.5 leading-relaxed">
                <p className="font-semibold text-slate-900">কাজের নির্দেশনা:</p>
                <p>
                  {selectedTask?.instructions ||
                    '১. আপনার নির্ধারিত Google Sheet ফাইলটি সম্পূর্ণ পূরণ করুন এবং শেয়ারিং লিংক "Anyone with the link" করুন।'}
                </p>
                <p>২. কাজ শেষে নিচের বক্সে Google Sheet URL পেস্ট করে সাবমিট করুন। অ্যাডমিন যাচাই করলে আপনার মেইন ব্যালেন্সে রিওয়ার্ড যুক্ত হবে।</p>
              </div>

              <form onSubmit={handleSubmitTask} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Active Admin Task
                  </label>
                  <select
                    value={selectedTask?.id || ''}
                    onChange={(e) => {
                      const found = serverTasks.find((t) => t.id === e.target.value);
                      if (found) {
                        setSelectedTaskId(found.id);
                        setSelectedCategory(found.title);
                      }
                    }}
                    className="input-atelier text-xs"
                  >
                    {serverTasks.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.title} (+{st.rewardBdt} ৳)
                      </option>
                    ))}
                    {serverTasks.length === 0 && <option value="">Data Entry (Google Sheet)</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Google Sheet Link (https://...)
                  </label>
                  <input
                    ref={sheetInputRef}
                    type="url"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="input-atelier"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Work Summary / Row Count (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Completed 50 verified entries"
                    className="input-atelier"
                  />
                </div>

                {feedback && (
                  <p
                    className={`text-xs rounded-xl px-3.5 py-2.5 border ${
                      feedback.type === 'ok'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    {feedback.text}
                  </p>
                )}

                <button type="submit" disabled={submitting} className="btn-primary w-full group">
                  <span>{submitting ? 'Submitting Task...' : copy.submitWorkBtnLabel}</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </form>
            </section>

            <section className="lg:col-span-7 surface-card p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-950">Your Submitted Google Sheets</h3>
                <span className="text-xs text-slate-500 font-mono-num">{data.workSubmissions.length} entries</span>
              </div>

              {data.workSubmissions.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl">
                  <Table2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">No work submissions yet</p>
                  <p className="text-xs text-slate-500 mt-1">Select a task above and submit your Google Sheet link to start earning.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.workSubmissions.map((sub) => (
                    <div key={sub.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <a
                            href={sub.sheetUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-emerald-800 hover:underline inline-flex items-center gap-1 truncate max-w-[240px]"
                          >
                            <span>{sub.category}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs text-slate-500 font-mono-num">
                            {new Date(sub.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        {sub.notes && <p className="text-xs text-slate-500 truncate mt-0.5">{sub.notes}</p>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-bold text-slate-900 font-mono-num">+{sub.reward} ৳</span>
                        <StatusText status={sub.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {tab === 'video-ads' && (
        <div className="space-y-6">
          <div className="surface-card p-4 flex flex-wrap items-center justify-between gap-3 text-xs font-mono-num">
            <div>
              <span className="text-slate-500">আজকের ভিউ: </span>
              <strong className="text-slate-950">{todayAdLogs.length}</strong>
              <span className="mx-2 text-slate-300">·</span>
              <span className="text-slate-500">আজকের আয়: </span>
              <strong className="text-emerald-700">+{todayAdEarnings.toFixed(2)} ৳</strong>
            </div>
            <div>
              <span className="text-slate-500">মেইন ব্যালেন্স: </span>
              <strong className="text-slate-950">{data.user.balance.toFixed(2)} ৳</strong>
            </div>
          </div>

          {adRewardNotice && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{adRewardNotice}</span>
            </div>
          )}

          {!adNetwork?.enabled ? (
            <div className="surface-card p-8 text-center">
              <Lock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-900">ভিডিও এড নেটওয়ার্ক সাময়িকভাবে বন্ধ আছে</p>
              <p className="text-xs text-slate-500 mt-1">অ্যাডমিন পুনরায় চালু করলে এখান থেকে ভিডিও এড দেখতে পারবেন।</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {activeCampaigns.map((camp, idx) => {
                const paisa = Math.round(camp.rewardBdt * 100);
                const smartlinkHref = resolveCampaignSmartlink(camp, idx);
                const placementBadge = camp.placementName || adNetwork?.placementName || '';
                return (
                  <div
                    key={camp.id}
                    className="surface-card p-4 sm:p-5 flex flex-col justify-between gap-4 hover:border-emerald-500 transition-all duration-150"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold font-mono-num text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                          {camp.id}
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                          {smartlinkHref && (
                            <span className="text-amber-700 font-bold">
                              {placementBadge ? `${placementBadge} ·` : 'Live Smartlink ·'}
                            </span>
                          )}
                          <Clock className="w-3.5 h-3.5" />
                          <span>{camp.durationSeconds} সেকেন্ড</span>
                        </span>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide truncate">
                          {camp.networkName} · {camp.category}
                        </p>
                        <h4 className="text-sm font-bold text-slate-950 mt-0.5 truncate">{camp.companyName}</h4>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">{camp.title}</p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] text-slate-500">ইনস্ট্যান্ট রিওয়ার্ড</p>
                        <p className="text-sm font-bold text-emerald-700 font-mono-num">
                          +{camp.rewardBdt.toFixed(2)} ৳ ({paisa} পয়সা)
                        </p>
                      </div>

                      {smartlinkHref ? (
                        <a
                          href={smartlinkHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleOpenAd(camp, true)}
                          className="btn-primary btn-sm shrink-0"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>এড দেখুন</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenAd(camp, false)}
                          className="btn-primary btn-sm shrink-0"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>এড দেখুন</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Member Ad Watch History */}
          <section className="surface-card p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-950">সাম্প্রতিক ভিডিও এড আয়</h3>
                <p className="text-xs text-slate-500">আপনার প্রতিটি সম্পূর্ণ ভিডিও এড মেইন ব্যালেন্সে রিয়েল-টাইম যুক্ত হয়</p>
              </div>
              <span className="text-xs font-mono-num text-slate-500">{adLogs.length} views</span>
            </div>

            {adLogs.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl">
                <Film className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-600">এখনো কোনো ভিডিও এড দেখা হয়নি।</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {adLogs.slice(0, 12).map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">
                        {log.adId} · {log.companyName} ({log.networkName})
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono-num">
                        {log.durationSeconds}s Non-Skippable · {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <span className="font-bold text-emerald-700 font-mono-num shrink-0">
                      +{Number(log.rewardBdt).toFixed(2)} ৳ ({Math.round(log.rewardBdt * 100)} পয়সা)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'all-tasks' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Active Admin Tasks */}
            {serverTasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => handleSelectAdminTask(task)}
                className="group bg-[#0b1220] text-white border border-slate-800 hover:border-emerald-500 rounded-2xl p-4 flex items-center justify-between text-left transition-all duration-150 active:scale-[0.99] cursor-pointer shadow-sm"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
                    <Table2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{task.title}</h4>
                    <p className="text-xs text-slate-300 truncate">{task.description || task.category}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 shrink-0 font-mono-num">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>+{task.rewardBdt} ৳</span>
                </span>
              </button>
            ))}

            {/* Video Ads Shortcut Card */}
            <button
              type="button"
              onClick={() => setTab('video-ads')}
              className="group bg-gradient-to-r from-emerald-950 to-[#0b1220] text-white border border-emerald-700/70 hover:border-emerald-400 rounded-2xl p-4 flex items-center justify-between text-left transition-all duration-150 active:scale-[0.99] cursor-pointer shadow-sm"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                  <Film className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white">ভিডিও এড নেটওয়ার্ক (Video Ads)</h4>
                  <p className="text-xs text-slate-300 truncate">৩০ সেকেন্ডের এডে ৩০ পয়সা · আনলিমিটেড</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
                <span>লাইভ</span>
              </span>
            </button>

            {/* Locked #2 - #8 */}
            {lockedCategories.map((cat, idx) => (
              <button
                key={cat.name}
                type="button"
                onClick={() => setLockedTaskModal(cat.name)}
                className="group surface-card hover:border-slate-400 rounded-2xl p-4 flex items-center justify-between text-left transition-all duration-150 active:scale-[0.99] cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0 group-hover:bg-slate-200/70 transition-colors">
                    {cat.icon}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-950">
                      {idx + 2}. {cat.name}
                    </h4>
                    <p className="text-xs text-slate-500 truncate">{cat.desc}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 shrink-0">
                  <Lock className="w-3.5 h-3.5" />
                  <span>লকড</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeAdCampaign && (
        <VideoAdPlayerModal
          key={`${activeAdCampaign.id}-${adPlayerKey}`}
          campaign={activeAdCampaign}
          adNetwork={adNetwork}
          initialSmartlinkLaunched={adSmartlinkLaunched}
          nextSmartlinkUrl={(() => {
            if (!activeCampaigns.length) return '';
            const idx = activeCampaigns.findIndex((c) => c.id === activeAdCampaign.id);
            const nextIdx = (idx + 1) % activeCampaigns.length;
            return resolveCampaignSmartlink(activeCampaigns[nextIdx], nextIdx);
          })()}
          onClaimed={async (rewardBdt) => {
            setAdRewardNotice(
              `+${rewardBdt.toFixed(2)} ৳ (${Math.round(rewardBdt * 100)} পয়সা) মেইন একাউন্টে যোগ হয়েছে — ${activeAdCampaign.companyName}`
            );
            await onRefresh();
          }}
          onWatchAnother={handleWatchNextAd}
          onClose={() => setActiveAdCampaign(null)}
        />
      )}

      {lockedTaskModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="surface-card max-w-sm w-full p-6 text-center shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-950">দুঃখিত!</h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              &ldquo;{lockedTaskModal}&rdquo; - এটি এই মুহূর্তে আপনার অ্যাকাউন্টের জন্য এভেলেবেল নেই।
            </p>
            <button
              type="button"
              onClick={() => {
                setLockedTaskModal(null);
                onClearFocusedTask?.();
              }}
              className="btn-obsidian mt-5 w-full"
            >
              ঠিক আছে
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
