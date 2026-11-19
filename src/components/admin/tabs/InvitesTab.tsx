import React, { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  Plus,
  Trash2,
} from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import type { AdminOverviewResponse } from '../../../types';

interface InvitesTabProps {
  overview: AdminOverviewResponse;
  onRefresh: () => Promise<void>;
  showToast: (type: 'ok' | 'err', text: string) => void;
}

export default function InvitesTab({ overview, onRefresh, showToast }: InvitesTabProps) {
  const invites = overview.invites;

  const [invLabel, setInvLabel] = useState('');
  const [invRole, setInvRole] = useState<'member' | 'vip'>('member');
  const [invMaxUses, setInvMaxUses] = useState('50');
  const [invExpiresDays, setInvExpiresDays] = useState('30');
  const [invCustomCode, setInvCustomCode] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await apiRequest('/api/admin/invites', {
        method: 'POST',
        body: JSON.stringify({
          label: invLabel.trim() || 'Private Access Link',
          role: invRole,
          maxUses: Number(invMaxUses || 50),
          expiresInDays: invExpiresDays ? Number(invExpiresDays) : null,
          customCode: invCustomCode.trim() || undefined,
        }),
      });
      setInvLabel('');
      setInvCustomCode('');
      showToast('ok', 'New private invite access link generated!');
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to create invite link.');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleInvite(id: string, currentActive: boolean) {
    try {
      await apiRequest(`/api/admin/invites/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !currentActive }),
      });
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to update invite.');
    }
  }

  async function handleDeleteInvite(id: string) {
    if (!confirm('Are you sure you want to delete this invite link?')) return;
    try {
      await apiRequest(`/api/admin/invites/${id}`, { method: 'DELETE' });
      showToast('ok', 'Invite link deleted.');
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to delete invite.');
    }
  }

  function handleCopyInviteUrl(id: string, token: string) {
    const shareUrl = `${window.location.origin}/?invite=${encodeURIComponent(token)}`;
    navigator.clipboard?.writeText(shareUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="surface-card p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">Private Invite Access Links</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            When Private Mode is enabled, users must open an authorized invite link to unlock registration and member workspace.
          </p>
        </div>

        <span className="text-xs font-mono-num text-slate-500">
          {invites.length} active and issued links
        </span>
      </div>

      {/* Create New Invite Form */}
      <div className="surface-card p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">Generate New Invite Link</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure target role, usage quota, and optional vanity invitation code.
          </p>
        </div>

        <form onSubmit={handleCreateInvite} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Invite Label / Purpose</label>
              <input
                type="text"
                required
                value={invLabel}
                onChange={(e) => setInvLabel(e.target.value)}
                placeholder="e.g. VIP Telegram Members"
                className="input-atelier text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Role Granted</label>
              <select
                value={invRole}
                onChange={(e) => setInvRole(e.target.value as 'member' | 'vip')}
                className="input-atelier text-xs"
              >
                <option value="member">Standard Member Access</option>
                <option value="vip">VIP Member Access</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Custom Code (Optional)</label>
              <input
                type="text"
                value={invCustomCode}
                onChange={(e) => setInvCustomCode(e.target.value)}
                placeholder="e.g. OKB-VIP-2026"
                className="input-atelier text-xs font-mono-num"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Max Redemptions / Uses</label>
              <input
                type="number"
                min="1"
                required
                value={invMaxUses}
                onChange={(e) => setInvMaxUses(e.target.value)}
                className="input-atelier text-xs font-mono-num"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Expires In (Days - leave empty for lifetime)
              </label>
              <input
                type="number"
                min="1"
                value={invExpiresDays}
                onChange={(e) => setInvExpiresDays(e.target.value)}
                placeholder="e.g. 30"
                className="input-atelier text-xs font-mono-num"
              />
            </div>
          </div>

          <button type="submit" disabled={creating} className="btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" />
            <span>{creating ? 'Generating...' : 'Generate Invite Link'}</span>
          </button>
        </form>
      </div>

      {/* Invites List */}
      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="px-3.5 py-2.5">Code & Purpose</th>
                <th className="px-3.5 py-2.5">Role</th>
                <th className="px-3.5 py-2.5">Redemptions</th>
                <th className="px-3.5 py-2.5">Expires</th>
                <th className="px-3.5 py-2.5">Status</th>
                <th className="px-3.5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invites.map((inv) => {
                const isCopied = copiedId === inv.id;
                const isExpired = inv.expiresAt && Date.now() > inv.expiresAt;

                return (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3.5 py-2.5">
                      <div className="font-mono-num font-bold text-slate-900">{inv.token}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{inv.label}</div>
                    </td>

                    <td className="px-3.5 py-2.5 font-semibold uppercase text-[10px] text-emerald-800">
                      {inv.role}
                    </td>

                    <td className="px-3.5 py-2.5 font-mono-num text-slate-700">
                      <strong>{inv.usedCount}</strong> / {inv.maxUses}
                    </td>

                    <td className="px-3.5 py-2.5 font-mono-num text-[11px] text-slate-500">
                      {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : 'Never'}
                    </td>

                    <td className="px-3.5 py-2.5">
                      <span
                        className={`font-semibold text-[11px] ${
                          isExpired
                            ? 'text-red-700'
                            : inv.active
                            ? 'text-emerald-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {isExpired ? 'Expired' : inv.active ? 'Active' : 'Revoked'}
                      </span>
                    </td>

                    <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyInviteUrl(inv.id, inv.token)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{isCopied ? 'Copied' : 'Copy Link'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleInvite(inv.id, inv.active)}
                          className="px-2 py-0.5 text-xs font-semibold rounded border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          {inv.active ? 'Revoke' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteInvite(inv.id)}
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
