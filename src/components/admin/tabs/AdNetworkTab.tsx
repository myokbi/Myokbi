import React, { useState } from 'react';
import {
  ExternalLink,
  Film,
  Link2,
  Play,
  Plus,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import type { AdDashboardId, AdminOverviewResponse, SiteConfig, VideoAdCampaign } from '../../../types';

interface AdNetworkTabProps {
  overview: AdminOverviewResponse;
  onRefresh: () => Promise<void>;
  showToast: (type: 'ok' | 'err', text: string) => void;
}

export default function AdNetworkTab({ overview, onRefresh, showToast }: AdNetworkTabProps) {
  const adNetwork = overview.config.adNetwork;

  const [activeSubTab, setActiveSubTab] = useState<'campaigns' | 'smartlinks' | 'dashboards' | 'tags'>('campaigns');

  // New Campaign Form State
  const [newAdDashboardId, setNewAdDashboardId] = useState<AdDashboardId>('video-dashboard');
  const [newAdNetwork, setNewAdNetwork] = useState('Adsterra High-CPM');
  const [newAdCompany, setNewAdCompany] = useState('');
  const [newAdTitle, setNewAdTitle] = useState('');
  const [newAdCategory, setNewAdCategory] = useState('FinTech & Crypto');
  const [newAdDuration, setNewAdDuration] = useState<10 | 15 | 30>(30);
  const [newAdReward, setNewAdReward] = useState('0.30');
  const [newAdVideoUrl, setNewAdVideoUrl] = useState('');
  const [newAdTagUrl, setNewAdTagUrl] = useState('');
  const [addingCampaign, setAddingCampaign] = useState(false);

  // Smartlink Batch Import State
  const [smartlinkImportText, setSmartlinkImportText] = useState('');
  const [smartlinkCreateCampaigns, setSmartlinkCreateCampaigns] = useState(true);
  const [importDashboardId, setImportDashboardId] = useState<AdDashboardId>('video-dashboard');
  const [importing, setImporting] = useState(false);

  // Global settings state
  const [savingGlobal, setSavingGlobal] = useState(false);

  // Video preview state
  const [previewCampaign, setPreviewCampaign] = useState<VideoAdCampaign | null>(null);

  async function handleToggleAdNetwork() {
    setSavingGlobal(true);
    try {
      await apiRequest('/api/admin/config', {
        method: 'PUT',
        body: JSON.stringify({
          adNetwork: { ...adNetwork, enabled: !adNetwork.enabled },
        }),
      });
      showToast('ok', `Ad Network ${!adNetwork.enabled ? 'activated' : 'paused'} across the website.`);
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to toggle Ad Network.');
    } finally {
      setSavingGlobal(false);
    }
  }

  async function handleAddAdCampaign(e: React.FormEvent) {
    e.preventDefault();
    setAddingCampaign(true);
    try {
      const adKind =
        newAdDashboardId === 'video-dashboard'
          ? 'video'
          : newAdDashboardId === 'direct-dashboard'
          ? 'direct'
          : 'express';
      const defaultReward = newAdDashboardId === 'video-dashboard' ? 0.3 : 0.1;

      await apiRequest('/api/admin/ads/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          dashboardId: newAdDashboardId,
          adKind,
          networkName: newAdNetwork,
          companyName: newAdCompany,
          title: newAdTitle,
          category: newAdCategory,
          durationSeconds: newAdDuration,
          rewardBdt: Number(newAdReward || defaultReward),
          videoUrl: newAdVideoUrl,
          thirdPartyTagUrl: newAdTagUrl,
        }),
      });

      setNewAdCompany('');
      setNewAdTitle('');
      setNewAdVideoUrl('');
      setNewAdTagUrl('');
      showToast('ok', 'New ad campaign created and live inside selected dashboard!');
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to add campaign.');
    } finally {
      setAddingCampaign(false);
    }
  }

  async function handleToggleCampaign(id: string, currentActive: boolean) {
    const updated = adNetwork.campaigns.map((c) =>
      c.id === id ? { ...c, active: !currentActive } : c
    );
    try {
      await apiRequest('/api/admin/config', {
        method: 'PUT',
        body: JSON.stringify({
          adNetwork: { ...adNetwork, campaigns: updated },
        }),
      });
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to toggle campaign.');
    }
  }

  async function handleDeleteCampaign(id: string) {
    if (!confirm('Are you sure you want to delete this ad campaign?')) return;
    try {
      await apiRequest(`/api/admin/ads/campaigns/${id}`, { method: 'DELETE' });
      showToast('ok', 'Campaign deleted.');
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to delete campaign.');
    }
  }

  async function handleImportSmartlinks(e: React.FormEvent) {
    e.preventDefault();
    if (!smartlinkImportText.trim()) return;
    setImporting(true);
    try {
      const res = await apiRequest<{ importedCount: number; addedCount: number }>(
        '/api/admin/ads/smartlinks/import',
        {
          method: 'POST',
          body: JSON.stringify({
            rawText: smartlinkImportText,
            createCampaigns: smartlinkCreateCampaigns,
            dashboardId: importDashboardId,
            durationSeconds: importDashboardId === 'video-dashboard' ? 30 : 10,
          }),
        }
      );
      setSmartlinkImportText('');
      showToast(
        'ok',
        `Successfully imported ${res.importedCount} Smartlinks (${res.addedCount} new).`
      );
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Smartlink import failed.');
    } finally {
      setImporting(false);
    }
  }

  async function handleDeleteSmartlink(id: string) {
    const updated = (adNetwork.smartlinks || []).filter((s) => s.id !== id);
    try {
      await apiRequest('/api/admin/config', {
        method: 'PUT',
        body: JSON.stringify({
          adNetwork: { ...adNetwork, smartlinks: updated },
        }),
      });
      showToast('ok', 'Smartlink removed from pool.');
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to remove smartlink.');
    }
  }

  return (
    <div className="space-y-4">
      {/* Ad Network Header Card */}
      <div className="surface-card p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">Ad Networks & Video Ad Hub</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage the 3 Adsterra/Monetag earning dashboards: Video Ads (30s/30p), Direct Offers (10s/10p), and Express Pop Ads (10s/10p).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500 text-right">
            <span>Global Status:</span>{' '}
            <strong className={adNetwork.enabled ? 'text-emerald-700' : 'text-red-700'}>
              {adNetwork.enabled ? 'Enabled' : 'Paused'}
            </strong>
          </div>
          <button
            type="button"
            onClick={handleToggleAdNetwork}
            disabled={savingGlobal}
            className={adNetwork.enabled ? 'btn-danger btn-sm' : 'btn-primary btn-sm'}
          >
            <span>{adNetwork.enabled ? 'Pause Ad Network' : 'Enable Ad Network'}</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs Nav */}
      <div className="overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 min-w-max border-b border-slate-200">
          {[
            { id: 'campaigns', label: `Active Campaigns (${adNetwork.campaigns.length})` },
            { id: 'smartlinks', label: `Smartlink Pool (${(adNetwork.smartlinks || []).length})` },
            { id: 'dashboards', label: '3 Dashboards Config' },
            { id: 'tags', label: 'VAST Tags & Scripts' },
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

      {/* 1. Campaigns Tab */}
      {activeSubTab === 'campaigns' && (
        <div className="space-y-4">
          {/* Add Campaign Form */}
          <div className="surface-card p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add New Sponsored Campaign</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Paste your Adsterra video or direct offer link to immediately launch an earning spot for members.
              </p>
            </div>

            <form onSubmit={handleAddAdCampaign} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Target Dashboard</label>
                  <select
                    value={newAdDashboardId}
                    onChange={(e) => {
                      const val = e.target.value as AdDashboardId;
                      setNewAdDashboardId(val);
                      if (val === 'video-dashboard') {
                        setNewAdDuration(30);
                        setNewAdReward('0.30');
                      } else {
                        setNewAdDuration(10);
                        setNewAdReward('0.10');
                      }
                    }}
                    className="input-atelier text-xs"
                  >
                    <option value="video-dashboard">ড্যাশবোর্ড ১: ভিডিও এড (৩০ সেকেন্ড / ৩০ পয়সা)</option>
                    <option value="direct-dashboard">ড্যাশবোর্ড ২: ডাইরেক্ট অফার (১০ সেকেন্ড / ১০ পয়সা)</option>
                    <option value="express-dashboard">ড্যাশবোর্ড ৩: এক্সপ্রেস পপ (১০ সেকেন্ড / ১০ পয়সা)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Network Provider</label>
                  <input
                    type="text"
                    value={newAdNetwork}
                    onChange={(e) => setNewAdNetwork(e.target.value)}
                    placeholder="e.g. Adsterra High-CPM"
                    className="input-atelier text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Company / Sponsor Name</label>
                  <input
                    type="text"
                    value={newAdCompany}
                    onChange={(e) => setNewAdCompany(e.target.value)}
                    placeholder="e.g. AsiaFilm Partner Video"
                    className="input-atelier text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Ad Title / Headline</label>
                  <input
                    type="text"
                    value={newAdTitle}
                    onChange={(e) => setNewAdTitle(e.target.value)}
                    placeholder="e.g. 30s High-CPM Verified Commercial"
                    className="input-atelier text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Duration (s)</label>
                    <input
                      type="number"
                      value={newAdDuration}
                      onChange={(e) => setNewAdDuration(Number(e.target.value) as 10 | 15 | 30)}
                      className="input-atelier text-xs font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Reward (BDT)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newAdReward}
                      onChange={(e) => setNewAdReward(e.target.value)}
                      className="input-atelier text-xs font-mono-num"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Smartlink / Direct Ad URL (https://...)
                  </label>
                  <input
                    type="url"
                    value={newAdTagUrl}
                    onChange={(e) => setNewAdTagUrl(e.target.value)}
                    placeholder="https://auctionr.org/4/..."
                    className="input-atelier text-xs font-mono-num"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Video Media URL (Optional if using built-in /ads/*.mp4)
                  </label>
                  <input
                    type="text"
                    value={newAdVideoUrl}
                    onChange={(e) => setNewAdVideoUrl(e.target.value)}
                    placeholder="/ads/adsterra-30s.mp4"
                    className="input-atelier text-xs font-mono-num"
                  />
                </div>
              </div>

              <button type="submit" disabled={addingCampaign} className="btn-primary btn-sm">
                <Plus className="w-3.5 h-3.5" />
                <span>{addingCampaign ? 'Adding...' : 'Launch Campaign'}</span>
              </button>
            </form>
          </div>

          {/* Existing Campaigns Table */}
          <div className="surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="px-3.5 py-2.5">Campaign & Dashboard</th>
                    <th className="px-3.5 py-2.5">Sponsor</th>
                    <th className="px-3.5 py-2.5">Duration</th>
                    <th className="px-3.5 py-2.5 text-right">Reward</th>
                    <th className="px-3.5 py-2.5">Status</th>
                    <th className="px-3.5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adNetwork.campaigns.map((camp) => (
                    <tr key={camp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3.5 py-2.5">
                        <div className="font-semibold text-slate-900 truncate max-w-[240px]">
                          {camp.title}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono-num flex items-center gap-1.5 mt-0.5">
                          <span>{camp.id}</span>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{camp.dashboardId || 'video-dashboard'}</span>
                        </div>
                      </td>

                      <td className="px-3.5 py-2.5 text-slate-700">
                        <p className="font-medium">{camp.companyName}</p>
                        <p className="text-[11px] text-slate-400">{camp.networkName}</p>
                      </td>

                      <td className="px-3.5 py-2.5 font-mono-num text-slate-800">
                        {camp.durationSeconds}s
                      </td>

                      <td className="px-3.5 py-2.5 text-right font-mono-num font-bold text-emerald-700">
                        {camp.rewardBdt.toFixed(2)} ৳
                      </td>

                      <td className="px-3.5 py-2.5">
                        <span
                          className={`font-semibold text-[11px] ${
                            camp.active ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {camp.active ? 'Live' : 'Paused'}
                        </span>
                      </td>

                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {camp.videoUrl && (
                            <button
                              type="button"
                              onClick={() => setPreviewCampaign(camp)}
                              className="p-1 text-slate-500 hover:text-emerald-700 cursor-pointer"
                              title="Preview Video"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleToggleCampaign(camp.id, camp.active)}
                            className="px-2 py-0.5 text-xs font-semibold rounded border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            {camp.active ? 'Pause' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCampaign(camp.id)}
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. Smartlink Pool & Batch Import */}
      {activeSubTab === 'smartlinks' && (
        <div className="space-y-4">
          {/* Smartlinks Batch CSV Import Form */}
          <div className="surface-card p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Batch Import Smartlinks</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Paste raw CSV or lines from Adsterra / Monetag (e.g. Zone Name, Placement Name, Placement ID, URL).
              </p>
            </div>

            <form onSubmit={handleImportSmartlinks} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Assign to Dashboard</label>
                  <select
                    value={importDashboardId}
                    onChange={(e) => setImportDashboardId(e.target.value as AdDashboardId)}
                    className="input-atelier text-xs"
                  >
                    <option value="video-dashboard">ড্যাশবোর্ড ১: ভিডিও এড (৩০ সেকেন্ড / ৩০ পয়সা)</option>
                    <option value="direct-dashboard">ড্যাশবোর্ড ২: ডাইরেক্ট অফার (১০ সেকেন্ড / ১০ পয়সা)</option>
                    <option value="express-dashboard">ড্যাশবোর্ড ৩: এক্সপ্রেস পপ (১০ সেকেন্ড / ১০ পয়সা)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="chkAutoCampaign"
                    checked={smartlinkCreateCampaigns}
                    onChange={(e) => setSmartlinkCreateCampaigns(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <label htmlFor="chkAutoCampaign" className="text-xs font-medium text-slate-700">
                    Automatically create active campaigns for each imported link
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Paste URLs or CSV Rows (one per line)
                </label>
                <textarea
                  rows={4}
                  required
                  value={smartlinkImportText}
                  onChange={(e) => setSmartlinkImportText(e.target.value)}
                  placeholder={`smart-link-3562738,Smartlink_1,32355300,https://auctionr.org/4/0a606d1b048f77bbea217fd6022adfb9\nhttps://asiafilm.org/4/ba5f0cab7d2c9b6a8e58a39f6361c4ca`}
                  className="input-atelier font-mono text-xs"
                />
              </div>

              <button type="submit" disabled={importing} className="btn-primary btn-sm">
                <Upload className="w-3.5 h-3.5" />
                <span>{importing ? 'Importing...' : 'Import to Pool'}</span>
              </button>
            </form>
          </div>

          {/* Smartlinks List */}
          <div className="surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="px-3.5 py-2.5">Zone & Placement</th>
                    <th className="px-3.5 py-2.5">Dashboard</th>
                    <th className="px-3.5 py-2.5">Destination URL</th>
                    <th className="px-3.5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(adNetwork.smartlinks || []).map((sl) => (
                    <tr key={sl.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3.5 py-2.5">
                        <p className="font-semibold text-slate-900">{sl.placementName}</p>
                        <p className="text-[11px] text-slate-400 font-mono-num">
                          Zone: {sl.zoneName} · ID: {sl.placementId}
                        </p>
                      </td>
                      <td className="px-3.5 py-2.5 capitalize text-slate-600 font-mono-num text-[11px]">
                        {sl.dashboardId || 'video-dashboard'}
                      </td>
                      <td className="px-3.5 py-2.5 max-w-[320px] truncate">
                        <a
                          href={sl.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-700 hover:underline font-mono-num text-[11px] truncate flex items-center gap-1"
                        >
                          <span className="truncate">{sl.url}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </td>
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDeleteSmartlink(sl.id)}
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. Dashboards Config */}
      {activeSubTab === 'dashboards' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(adNetwork.dashboards || []).map((dash) => (
            <div key={dash.id} className="surface-card p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-900">{dash.title}</span>
                <span className="font-mono-num text-xs font-bold text-emerald-700">{dash.rewardBdt} ৳</span>
              </div>
              <p className="text-xs text-slate-500">{dash.subtitle}</p>
              <div className="text-[11px] space-y-1 font-mono-num text-slate-600 pt-2 border-t border-slate-100">
                <div>Duration: <strong>{dash.durationSeconds}s</strong></div>
                <div>Require Click: <strong>{dash.requireSmartlinkClick ? 'Yes' : 'No'}</strong></div>
                <div>Allow Skip: <strong>{dash.allowSkip ? 'Yes' : 'No (Non-Skippable)'}</strong></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. VAST & Custom Scripts */}
      {activeSubTab === 'tags' && (
        <div className="surface-card p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">VAST XML URL & Third-Party Network Script</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Integrate external ad servers (e.g., Google IMA, Monetag script tags).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">VAST XML Tag URL</label>
            <input
              type="url"
              defaultValue={adNetwork.vastTagUrl}
              placeholder="https://vast.adnetwork.com/tag.xml"
              className="input-atelier font-mono-num text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Custom Ad Network Script URL</label>
            <input
              type="url"
              defaultValue={adNetwork.customScriptUrl}
              placeholder="https://alwingulla.com/88/tag.min.js"
              className="input-atelier font-mono-num text-xs"
            />
          </div>
        </div>
      )}

      {/* Video Preview Modal */}
      {previewCampaign && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">{previewCampaign.title}</h3>
              <button
                type="button"
                onClick={() => setPreviewCampaign(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center">
              <video
                src={previewCampaign.videoUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewCampaign(null)}
                className="btn-secondary btn-sm"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
