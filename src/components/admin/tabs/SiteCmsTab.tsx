import React, { useState } from 'react';
import {
  Bell,
  CreditCard,
  Image,
  Plus,
  Save,
  Sliders,
  Sparkles,
  Trash2,
  Trophy,
} from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import type { BannerSlide, LeaderboardChampion, SiteConfig } from '../../../types';

interface SiteCmsTabProps {
  config: SiteConfig;
  onRefresh: () => Promise<void>;
  showToast: (type: 'ok' | 'err', text: string) => void;
}

export default function SiteCmsTab({ config, onRefresh, showToast }: SiteCmsTabProps) {
  const [draft, setDraft] = useState<SiteConfig>(() => structuredClone(config));
  const [busy, setBusy] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'notice' | 'gateways' | 'rates' | 'banners' | 'champions'>('general');

  // Slide form state
  const [newSlideBadge, setNewSlideBadge] = useState('FEATURED');
  const [newSlideTitle, setNewSlideTitle] = useState('');
  const [newSlideSubtitle, setNewSlideSubtitle] = useState('');

  // Champion form state
  const [newChampRank, setNewChampRank] = useState<1 | 2 | 3>(1);
  const [newChampId, setNewChampId] = useState('');
  const [newChampRefers, setNewChampRefers] = useState(10);
  const [newChampPrize, setNewChampPrize] = useState('');
  const [newChampPhoto, setNewChampPhoto] = useState('/src/assets/images/avatar_member_default_1795024942538.jpg');

  async function handleSaveConfig(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setBusy(true);
    try {
      await apiRequest('/api/admin/config', {
        method: 'PUT',
        body: JSON.stringify(draft),
      });
      showToast('ok', 'Site configuration saved and broadcast live to all clients!');
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to save configuration.');
    } finally {
      setBusy(false);
    }
  }

  function handleAddSlide(e: React.FormEvent) {
    e.preventDefault();
    if (!newSlideTitle.trim()) return;
    const newSlide: BannerSlide = {
      id: `slide-${Date.now()}`,
      badge: newSlideBadge.trim() || 'UPDATE',
      title: newSlideTitle.trim(),
      subtitle: newSlideSubtitle.trim(),
    };
    setDraft({
      ...draft,
      banners: [...draft.banners, newSlide],
    });
    setNewSlideTitle('');
    setNewSlideSubtitle('');
    showToast('ok', 'Banner slide added to draft. Click "Save Live CMS" to publish.');
  }

  function handleDeleteSlide(id: string) {
    setDraft({
      ...draft,
      banners: draft.banners.filter((b) => b.id !== id),
    });
  }

  function handleAddChampion(e: React.FormEvent) {
    e.preventDefault();
    if (!newChampId.trim()) return;
    const champ: LeaderboardChampion = {
      rank: newChampRank,
      maskedId: newChampId.trim(),
      refers: Number(newChampRefers),
      prizeLabel: newChampPrize.trim() || 'Prize Tag',
      photoUrl: newChampPhoto.trim(),
    };
    const updated = draft.champions.filter((c) => c.rank !== newChampRank);
    updated.push(champ);
    updated.sort((a, b) => a.rank - b.rank);
    setDraft({
      ...draft,
      champions: updated,
    });
    setNewChampId('');
    setNewChampPrize('');
    showToast('ok', `Champion Rank #${newChampRank} updated in draft. Click "Save Live CMS" to publish.`);
  }

  return (
    <div className="space-y-4">
      {/* CMS Header & Save Bar */}
      <div className="surface-card p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Website Content Management System (CMS)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Full control over brand identity, live notices, payment gateway numbers, financial rates, hero slides, and leaderboard awards.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleSaveConfig()}
          disabled={busy}
          className="btn-primary btn-sm shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>{busy ? 'Saving...' : 'Save Live CMS'}</span>
        </button>
      </div>

      {/* Sub-Tabs Nav */}
      <div className="overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 min-w-max border-b border-slate-200">
          {[
            { id: 'general', label: 'General & Access' },
            { id: 'notice', label: 'Live Notice & Marquee' },
            { id: 'gateways', label: 'Payment Gateways' },
            { id: 'rates', label: 'Financial Limits & Rates' },
            { id: 'banners', label: 'Hero Slides' },
            { id: 'champions', label: 'Champions Hub' },
          ].map((tab) => {
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id as typeof activeSubTab)}
                className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-t-xl transition-all cursor-pointer border-b-2 ${
                  active
                    ? 'border-emerald-600 text-slate-900 bg-white shadow-sm'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. General & Access Control */}
      {activeSubTab === 'general' && (
        <div className="surface-card p-5 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Site Identity & Access Policies</h3>
            <p className="text-xs text-slate-500 mt-0.5">Configure app branding and access control gates.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Website Brand Name</label>
              <input
                type="text"
                value={draft.siteName}
                onChange={(e) => setDraft({ ...draft, siteName: e.target.value })}
                className="input-atelier"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tagline</label>
              <input
                type="text"
                value={draft.tagline}
                onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
                className="input-atelier"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">Private Gate (Invite Links Only)</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    When enabled, members cannot access the portal without an authorized private invite code.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={draft.privateMode}
                  onChange={(e) => setDraft({ ...draft, privateMode: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">Maintenance Mode</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Show maintenance splash screen to all non-admin visitors.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={draft.maintenanceMode}
                  onChange={(e) => setDraft({ ...draft, maintenanceMode: e.target.checked })}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Live Notice & Marquee */}
      {activeSubTab === 'notice' && (
        <div className="surface-card p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Platform Announcement & Marquee Notice</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Renders prominently on user dashboard and updates instantly on all connected tabs.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-700">Display Notice:</label>
              <input
                type="checkbox"
                checked={draft.notice.active}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    notice: { ...draft.notice, active: e.target.checked },
                  })
                }
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notice Headline</label>
              <input
                type="text"
                value={draft.notice.title}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    notice: { ...draft.notice, title: e.target.value },
                  })
                }
                className="input-atelier"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Announcement Body Text</label>
              <textarea
                rows={4}
                value={draft.notice.text}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    notice: { ...draft.notice, text: e.target.value },
                  })
                }
                className="input-atelier font-sans text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. Payment Gateways */}
      {activeSubTab === 'gateways' && (
        <div className="surface-card p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Deposit Payment Numbers & Addresses</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              These official accounts are shown to members when making cash-in / deposit requests.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">bKash (Personal / Agent)</label>
              <input
                type="text"
                value={draft.adminNumbers.bKash}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    adminNumbers: { ...draft.adminNumbers, bKash: e.target.value },
                  })
                }
                className="input-atelier font-mono-num"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nagad (Personal / Agent)</label>
              <input
                type="text"
                value={draft.adminNumbers.Nagad}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    adminNumbers: { ...draft.adminNumbers, Nagad: e.target.value },
                  })
                }
                className="input-atelier font-mono-num"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Rocket (Personal / Agent)</label>
              <input
                type="text"
                value={draft.adminNumbers.Rocket}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    adminNumbers: { ...draft.adminNumbers, Rocket: e.target.value },
                  })
                }
                className="input-atelier font-mono-num"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">USDT (TRC-20 Wallet Address)</label>
              <input
                type="text"
                value={draft.adminNumbers.USDT}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    adminNumbers: { ...draft.adminNumbers, USDT: e.target.value },
                  })
                }
                className="input-atelier font-mono-num"
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. Financial Limits & Rates */}
      {activeSubTab === 'rates' && (
        <div className="surface-card p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Platform Thresholds, Tasks & Referral Rates</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Set minimum deposit/withdraw amounts, work payouts, and P2P transaction fees.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Min Deposit (BDT)</label>
              <input
                type="number"
                value={draft.rates.minDeposit}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    rates: { ...draft.rates, minDeposit: Number(e.target.value) },
                  })
                }
                className="input-atelier font-mono-num"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Min Standard Withdraw</label>
              <input
                type="number"
                value={draft.rates.minWithdraw}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    rates: { ...draft.rates, minWithdraw: Number(e.target.value) },
                  })
                }
                className="input-atelier font-mono-num"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Min Agent Withdraw</label>
              <input
                type="number"
                value={draft.rates.minAgentWithdraw}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    rates: { ...draft.rates, minAgentWithdraw: Number(e.target.value) },
                  })
                }
                className="input-atelier font-mono-num"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Default Task Reward (BDT)</label>
              <input
                type="number"
                value={draft.rates.taskReward}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    rates: { ...draft.rates, taskReward: Number(e.target.value) },
                  })
                }
                className="input-atelier font-mono-num"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Referral Signup Bonus</label>
              <input
                type="number"
                value={draft.rates.referralSignupBonus}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    rates: { ...draft.rates, referralSignupBonus: Number(e.target.value) },
                  })
                }
                className="input-atelier font-mono-num"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">P2P Min Transfer</label>
              <input
                type="number"
                value={draft.rates.p2pMin}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    rates: { ...draft.rates, p2pMin: Number(e.target.value) },
                  })
                }
                className="input-atelier font-mono-num"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">P2P Max Transfer</label>
              <input
                type="number"
                value={draft.rates.p2pMax}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    rates: { ...draft.rates, p2pMax: Number(e.target.value) },
                  })
                }
                className="input-atelier font-mono-num"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">P2P Fee per 1000 ৳</label>
              <input
                type="number"
                value={draft.rates.p2pFeePerThousand}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    rates: { ...draft.rates, p2pFeePerThousand: Number(e.target.value) },
                  })
                }
                className="input-atelier font-mono-num"
              />
            </div>
          </div>
        </div>
      )}

      {/* 5. Hero Slides */}
      {activeSubTab === 'banners' && (
        <div className="surface-card p-5 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Hero Carousel Banners</h3>
            <p className="text-xs text-slate-500 mt-0.5">Slides shown in the rotating banner on the member dashboard.</p>
          </div>

          {/* Existing Slides List */}
          <div className="space-y-2.5">
            {draft.banners.map((slide, idx) => (
              <div
                key={slide.id}
                className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                      {slide.badge}
                    </span>
                    <strong className="text-xs font-bold text-slate-900">{slide.title}</strong>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 truncate">{slide.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteSlide(slide.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                  title="Delete slide"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Add Slide Form */}
          <form onSubmit={handleAddSlide} className="p-4 bg-slate-100/70 rounded-xl border border-slate-200/80 space-y-3">
            <h4 className="text-xs font-bold text-slate-800">Add New Banner Slide</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Badge Tag</label>
                <input
                  type="text"
                  value={newSlideBadge}
                  onChange={(e) => setNewSlideBadge(e.target.value)}
                  placeholder="e.g. LIVE, REWARD"
                  className="input-atelier text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Headline</label>
                <input
                  type="text"
                  required
                  value={newSlideTitle}
                  onChange={(e) => setNewSlideTitle(e.target.value)}
                  placeholder="e.g. Explore OKB Pro Market"
                  className="input-atelier text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Subtitle / Description</label>
              <input
                type="text"
                value={newSlideSubtitle}
                onChange={(e) => setNewSlideSubtitle(e.target.value)}
                placeholder="e.g. Complete verified tasks and earn in real time."
                className="input-atelier text-xs"
              />
            </div>
            <button type="submit" className="btn-secondary btn-sm">
              <Plus className="w-3.5 h-3.5" />
              <span>Add Slide to Draft</span>
            </button>
          </form>
        </div>
      )}

      {/* 6. Champions Hub */}
      {activeSubTab === 'champions' && (
        <div className="surface-card p-5 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Leaderboard Champions & Hall of Fame</h3>
            <p className="text-xs text-slate-500 mt-0.5">Top referrer awards shown on the Champions Hall of Fame.</p>
          </div>

          {/* Existing Champions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {draft.champions.map((champ) => (
              <div key={champ.rank} className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2">
                <span className="text-xs font-bold text-amber-700 font-mono-num">
                  Rank #{champ.rank}
                </span>
                <img
                  src={champ.photoUrl}
                  alt={champ.maskedId}
                  className="w-12 h-12 rounded-full mx-auto object-cover border border-amber-400"
                />
                <p className="text-xs font-bold font-mono-num text-slate-900">{champ.maskedId}</p>
                <p className="text-[11px] text-slate-500">{champ.refers} Verified Refers</p>
                <p className="text-xs font-bold text-emerald-700 bg-emerald-50 py-1 px-2 rounded-lg border border-emerald-200">
                  {champ.prizeLabel}
                </p>
              </div>
            ))}
          </div>

          {/* Add / Edit Champion Form */}
          <form onSubmit={handleAddChampion} className="p-4 bg-slate-100/70 rounded-xl border border-slate-200/80 space-y-3">
            <h4 className="text-xs font-bold text-slate-800">Update Champion Rank</h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Rank</label>
                <select
                  value={newChampRank}
                  onChange={(e) => setNewChampRank(Number(e.target.value) as 1 | 2 | 3)}
                  className="input-atelier text-xs"
                >
                  <option value={1}>1st Place</option>
                  <option value={2}>2nd Place</option>
                  <option value={3}>3rd Place</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Masked ID</label>
                <input
                  type="text"
                  required
                  value={newChampId}
                  onChange={(e) => setNewChampId(e.target.value)}
                  placeholder="e.g. M102****88"
                  className="input-atelier text-xs font-mono-num"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Refers Count</label>
                <input
                  type="number"
                  required
                  value={newChampRefers}
                  onChange={(e) => setNewChampRefers(Number(e.target.value))}
                  className="input-atelier text-xs font-mono-num"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Prize Label</label>
                <input
                  type="text"
                  required
                  value={newChampPrize}
                  onChange={(e) => setNewChampPrize(e.target.value)}
                  placeholder="e.g. ১৮০,০০০ ৳"
                  className="input-atelier text-xs"
                />
              </div>
            </div>
            <button type="submit" className="btn-secondary btn-sm">
              <Trophy className="w-3.5 h-3.5" />
              <span>Update Champion in Draft</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
