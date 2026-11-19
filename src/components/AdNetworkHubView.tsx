import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Film,
  Globe,
  Layers,
  Lock,
  Play,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { AdDashboardConfig, AdDashboardId, MemberStateResponse, VideoAdCampaign } from '../types';
import VideoAdPlayerModal from './VideoAdPlayerModal';

interface AdNetworkHubViewProps {
  data: MemberStateResponse;
  onRefresh: () => Promise<void>;
}

const FALLBACK_DASHBOARDS: AdDashboardConfig[] = [
  {
    id: 'video-dashboard',
    title: 'ড্যাশবোর্ড ১: ভিডিও এড নেটওয়ার্ক',
    subtitle: 'প্রতিটি ৩০ সেকেন্ডের ভিডিও এডে সরাসরি ৩০ পয়সা (0.30 ৳) আয়',
    adKind: 'video',
    rewardBdt: 0.3,
    durationSeconds: 30,
    requireSmartlinkClick: true,
    allowSkip: false,
    rules: [
      'প্রতিটি ভিডিও এড অবশ্যই সম্পূর্ণ ৩০ সেকেন্ড দেখতে হবে — কোনো এড স্কিপ করা যাবে না।',
      'প্রতিটি সম্পূর্ণ ভিডিও এডের বিনিময়ে ৩০ পয়সা (0.30 ৳) সরাসরি মেইন একাউন্টে যোগ হবে।',
      'অ্যাড দেখার জন্য লাইভ বিজ্ঞাপন ওপেন রেখে পুরো সময় অপেক্ষা করতে হবে।',
    ],
    active: true,
  },
  {
    id: 'direct-dashboard',
    title: 'ড্যাশবোর্ড ২: ডাইরেক্ট স্মার্টলিংক ও অফার এড',
    subtitle: 'ভিডিও ছাড়া অন্যান্য ডাইরেক্ট এডে প্রতিবার ১০ পয়সা (0.10 ৳) আয়',
    adKind: 'direct',
    rewardBdt: 0.1,
    durationSeconds: 10,
    requireSmartlinkClick: true,
    allowSkip: false,
    rules: [
      'অন্যান্য ডাইরেক্ট ও স্পনসর এডের বিনিময়ে প্রতিবার ১০ পয়সা (0.10 ৳) যোগ হবে।',
      'অ্যাড ওপেন করে অন্তত ১০ সেকেন্ড বিজ্ঞাপন পেজে থাকতে হবে।',
    ],
    active: true,
  },
  {
    id: 'express-dashboard',
    title: 'ড্যাশবোর্ড ৩: এক্সপ্রেস, পপ ও ব্যানার এড',
    subtitle: 'এক্সপ্রেস ও ব্যানার এডে প্রতিবার ১০ পয়সা (0.10 ৳) আয়',
    adKind: 'express',
    rewardBdt: 0.1,
    durationSeconds: 10,
    requireSmartlinkClick: true,
    allowSkip: false,
    rules: [
      'এক্সপ্রেস, পপ-এড ও ব্যানার এডে প্রতিবার ১০ পয়সা (0.10 ৳) মেইন ব্যালেন্সে যোগ হবে।',
      'ক্লিক করার পর ১০ সেকেন্ড অপেক্ষা করলেই অটোমেটিক ভেরিফাই হয়ে পেমেন্ট পাবেন।',
    ],
    active: true,
  },
];

export default function AdNetworkHubView({ data, onRefresh }: AdNetworkHubViewProps) {
  const adNetwork = data.site.config.adNetwork;
  const dashboards = useMemo(
    () => (adNetwork?.dashboards && adNetwork.dashboards.length > 0 ? adNetwork.dashboards : FALLBACK_DASHBOARDS),
    [adNetwork?.dashboards]
  );

  const [activeDashId, setActiveDashId] = useState<AdDashboardId>(dashboards[0]?.id || 'video-dashboard');
  const [activeAdCampaign, setActiveAdCampaign] = useState<VideoAdCampaign | null>(null);
  const [adSmartlinkLaunched, setAdSmartlinkLaunched] = useState(false);
  const [adPlayerKey, setAdPlayerKey] = useState(0);
  const [rewardNotice, setRewardNotice] = useState<string | null>(null);

  const selectedDashboard = useMemo(
    () => dashboards.find((d) => d.id === activeDashId) || dashboards[0],
    [dashboards, activeDashId]
  );

  useEffect(() => {
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
  }, [adNetwork?.customScriptUrl]);

  const activeCampaignsByDash = useMemo(() => {
    const allActive = (adNetwork?.campaigns || []).filter((c) => c.active);
    return {
      'video-dashboard': allActive.filter((c) => (c.dashboardId || 'video-dashboard') === 'video-dashboard'),
      'direct-dashboard': allActive.filter((c) => c.dashboardId === 'direct-dashboard'),
      'express-dashboard': allActive.filter((c) => c.dashboardId === 'express-dashboard'),
    } as Record<AdDashboardId, VideoAdCampaign[]>;
  }, [adNetwork?.campaigns]);

  const currentCampaigns = activeCampaignsByDash[selectedDashboard.id] || [];

  const activeSmartlinks = useMemo(
    () => (adNetwork?.smartlinks || []).filter((s) => s.active && /^https?:\/\//i.test(s.url)),
    [adNetwork?.smartlinks]
  );

  function resolveCampaignSmartlink(camp: VideoAdCampaign, index = 0): string {
    if (camp.thirdPartyTagUrl && /^https?:\/\//i.test(camp.thirdPartyTagUrl.trim())) {
      return camp.thirdPartyTagUrl.trim();
    }
    const dashLinks = activeSmartlinks.filter((s) => s.dashboardId === (camp.dashboardId || selectedDashboard.id));
    const pool = dashLinks.length > 0 ? dashLinks : activeSmartlinks;
    if (pool.length > 0) {
      return pool[index % pool.length].url;
    }
    return adNetwork?.primarySmartlinkUrl?.trim() || '';
  }

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const adLogs = data.adWatchLogs || [];
  const todayAdLogs = adLogs.filter((l) => l.timestamp >= todayStart);
  const todayAdEarnings = todayAdLogs.reduce((sum, l) => sum + Number(l.rewardBdt || 0), 0);

  function handleOpenAd(campaign: VideoAdCampaign, launchedSmartlink = false) {
    setRewardNotice(null);
    setAdSmartlinkLaunched(launchedSmartlink);
    setActiveAdCampaign(campaign);
    setAdPlayerKey((k) => k + 1);
  }

  function handleWatchNextAd() {
    if (!currentCampaigns.length || !activeAdCampaign) {
      setAdPlayerKey((k) => k + 1);
      return;
    }
    const idx = currentCampaigns.findIndex((c) => c.id === activeAdCampaign.id);
    const nextIdx = (idx + 1) % currentCampaigns.length;
    const nextCampaign = currentCampaigns[nextIdx];
    setAdSmartlinkLaunched(Boolean(resolveCampaignSmartlink(nextCampaign, nextIdx)));
    setActiveAdCampaign(nextCampaign);
    setAdPlayerKey((k) => k + 1);
  }

  const dashIcon = (id: AdDashboardId) => {
    if (id === 'video-dashboard') return <Film className="w-5 h-5" />;
    if (id === 'direct-dashboard') return <Globe className="w-5 h-5" />;
    return <Zap className="w-5 h-5" />;
  };

  return (
    <div className="space-y-5">
      {/* Compact Header & Today's Ad Stats (No Promotional Banner) */}
      <div className="surface-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-950">অ্যাড নেটওয়ার্ক · ৩টি ড্যাশবোর্ড</h2>
            <p className="text-xs text-slate-500">
              ভিডিও এড ৩০ পয়সা (0.30 ৳) · অন্যান্য এড ১০ পয়সা (0.10 ৳)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono-num">
          <div>
            <span className="text-slate-500">আজকের ভিউ: </span>
            <strong className="text-slate-950">{todayAdLogs.length}</strong>
          </div>
          <span className="text-slate-300">·</span>
          <div>
            <span className="text-slate-500">আয়: </span>
            <strong className="text-emerald-700">+{todayAdEarnings.toFixed(2)} ৳</strong>
          </div>
          <span className="text-slate-300">·</span>
          <div>
            <span className="text-slate-500">ব্যালেন্স: </span>
            <strong className="text-slate-950">{data.user.balance.toFixed(2)} ৳</strong>
          </div>
        </div>
      </div>

      {/* 3 Ad Dashboards Selector Grid */}
      <section aria-label="Three Ad Dashboards">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-950">অ্যাড নেটওয়ার্কের ৩টি ড্যাশবোর্ড</h3>
          <span className="text-xs text-slate-500">যেকোনো ড্যাশবোর্ড সিলেক্ট করে অ্যাড দেখুন</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {dashboards.map((dash, idx) => {
            const selected = dash.id === selectedDashboard.id;
            const liveCount = (activeCampaignsByDash[dash.id] || []).length;
            const paisa = Math.round(dash.rewardBdt * 100);
            const isVideo = dash.adKind === 'video';

            return (
              <button
                key={dash.id}
                type="button"
                onClick={() => setActiveDashId(dash.id)}
                className={`text-left rounded-2xl p-4 sm:p-5 border transition-all duration-150 cursor-pointer flex flex-col justify-between gap-3 ${
                  selected
                    ? 'bg-[#0b1220] text-white border-emerald-500 shadow-lg ring-2 ring-emerald-500/20'
                    : 'bg-white text-slate-950 border-slate-200 hover:border-emerald-400'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      selected
                        ? isVideo
                          ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                          : 'bg-amber-400/20 border border-amber-400/40 text-amber-300'
                        : 'bg-slate-100 border border-slate-200 text-slate-800'
                    }`}
                  >
                    {dashIcon(dash.id)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[11px] font-bold font-mono-num px-2 py-0.5 rounded-md border ${
                        selected
                          ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      }`}
                    >
                      +{paisa} পয়সা / এড
                    </span>
                  </div>
                </div>

                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${selected ? 'text-emerald-400' : 'text-slate-500'}`}>
                    Dashboard #{idx + 1} · {liveCount} Live Ads · {dash.durationSeconds}s
                  </p>
                  <h4 className={`text-sm font-bold mt-0.5 ${selected ? 'text-white' : 'text-slate-950'}`}>
                    {dash.title}
                  </h4>
                  <p className={`text-xs mt-1 leading-relaxed ${selected ? 'text-slate-300' : 'text-slate-600'}`}>
                    {dash.subtitle}
                  </p>
                </div>

                <div className="pt-2.5 border-t border-slate-200/20 flex items-center justify-between text-[11px] font-semibold">
                  <span className={selected ? 'text-amber-300' : 'text-slate-700'}>
                    {dash.active ? 'ড্যাশবোর্ড সক্রিয়' : 'সাময়িক বন্ধ'}
                  </span>
                  <span className={selected ? 'text-emerald-300' : 'text-emerald-700'}>
                    {selected ? 'ওপেন আছে ✓' : 'ওপেন করুন →'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {rewardNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{rewardNotice}</span>
        </div>
      )}

      {/* Selected Dashboard Rules & Enforcement Banner */}
      <section className="surface-card p-5 space-y-3 border-l-4 border-l-emerald-600">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
            <h3 className="text-sm font-bold text-slate-950">
              {selectedDashboard.title} — রুলস ও কাজের নিয়মাবলি
            </h3>
          </div>
          <span className="text-xs font-bold font-mono-num text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg self-start sm:self-auto">
            রিওয়ার্ড: +{selectedDashboard.rewardBdt.toFixed(2)} ৳ ({Math.round(selectedDashboard.rewardBdt * 100)} পয়সা) ·{' '}
            {selectedDashboard.durationSeconds} সেকেন্ড
          </span>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
          {selectedDashboard.rules.map((rule, idx) => (
            <li key={idx} className="flex items-start gap-2 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{rule}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Active Ads Inside Selected Dashboard */}
      {!adNetwork?.enabled || !selectedDashboard.active ? (
        <div className="surface-card p-8 text-center">
          <Lock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-900">এই অ্যাড ড্যাশবোর্ডটি সাময়িকভাবে বন্ধ আছে</p>
          <p className="text-xs text-slate-500 mt-1">অ্যাডমিন পুনরায় চালু করলে এখান থেকে অ্যাড দেখে আয় করতে পারবেন।</p>
        </div>
      ) : currentCampaigns.length === 0 ? (
        <div className="surface-card p-8 text-center">
          <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-900">এই ড্যাশবোর্ডে কোনো সক্রিয় অ্যাড নেই</p>
          <p className="text-xs text-slate-500 mt-1">
            এডমিন প্যানেল থেকে নতুন অ্যাড বা Smartlink যুক্ত করলে তা এখানে সরাসরি শো করবে।
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {currentCampaigns.map((camp, idx) => {
            const effectiveReward =
              camp.rewardBdt > 0 ? camp.rewardBdt : selectedDashboard.rewardBdt;
            const effectiveDuration =
              camp.durationSeconds > 0 ? camp.durationSeconds : selectedDashboard.durationSeconds;
            const paisa = Math.round(effectiveReward * 100);
            const smartlinkHref = resolveCampaignSmartlink(camp, idx);
            const placementLabel = camp.placementName || camp.networkName;

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
                          {placementLabel} ·
                        </span>
                      )}
                      <Clock className="w-3.5 h-3.5" />
                      <span>{effectiveDuration} সেকেন্ড</span>
                    </span>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide truncate">
                      {camp.networkName} · {camp.placementId ? `ID ${camp.placementId}` : camp.category}
                    </p>
                    <h4 className="text-sm font-bold text-slate-950 mt-0.5 truncate">{camp.companyName}</h4>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">{camp.title}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] text-slate-500">
                      {selectedDashboard.adKind === 'video' ? 'ভিডিও এড রিওয়ার্ড' : 'অ্যাড ভিজিট রিওয়ার্ড'}
                    </p>
                    <p className="text-sm font-bold text-emerald-700 font-mono-num">
                      +{effectiveReward.toFixed(2)} ৳ ({paisa} পয়সা)
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
                      <span>{selectedDashboard.adKind === 'video' ? 'এড দেখুন' : 'এড ওপেন করুন'}</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenAd(camp, false)}
                      className="btn-primary btn-sm shrink-0"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{selectedDashboard.adKind === 'video' ? 'এড দেখুন' : 'এড ওপেন করুন'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Live Ad Earnings Ledger */}
      <section className="surface-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-950">সাম্প্রতিক অ্যাড নেটওয়ার্ক আয়</h3>
            <p className="text-xs text-slate-500">প্রতিটি ভিডিও এড (৩০ পয়সা) ও অন্যান্য এড (১০ পয়সা) রিয়েল-টাইম মেইন ব্যালেন্সে যোগ হয়</p>
          </div>
          <span className="text-xs font-mono-num text-slate-500">{adLogs.length} views</span>
        </div>

        {adLogs.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl">
            <Film className="w-7 h-7 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-600">
              এখনো কোনো অ্যাড দেখা হয়নি। উপরের ৩টি ড্যাশবোর্ডের যেকোনো অ্যাডে ক্লিক করে আয় শুরু করুন!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {adLogs.slice(0, 15).map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">
                    {log.adId} · {log.companyName} ({log.networkName})
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono-num">
                    {log.durationSeconds}s Verified · {new Date(log.timestamp).toLocaleString()}
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

      {activeAdCampaign && (
        <VideoAdPlayerModal
          key={`${activeAdCampaign.id}-${adPlayerKey}`}
          campaign={activeAdCampaign}
          adNetwork={adNetwork}
          initialSmartlinkLaunched={adSmartlinkLaunched}
          nextSmartlinkUrl={(() => {
            if (!currentCampaigns.length) return '';
            const idx = currentCampaigns.findIndex((c) => c.id === activeAdCampaign.id);
            const nextIdx = (idx + 1) % currentCampaigns.length;
            return resolveCampaignSmartlink(currentCampaigns[nextIdx], nextIdx);
          })()}
          onClaimed={async (rewardBdt) => {
            setRewardNotice(
              `+${rewardBdt.toFixed(2)} ৳ (${Math.round(rewardBdt * 100)} পয়সা) মেইন একাউন্টে যোগ হয়েছে — ${activeAdCampaign.companyName}`
            );
            await onRefresh();
          }}
          onWatchAnother={handleWatchNextAd}
          onClose={() => setActiveAdCampaign(null)}
        />
      )}
    </div>
  );
}
