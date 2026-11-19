import React, { useMemo, useState } from 'react';
import {
  CreditCard,
  Edit2,
  Mail,
  Phone,
  Save,
  Shield,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import type { AdminOverviewResponse, PublicUserProfile } from '../../../types';

interface MemberDetailModalProps {
  user: PublicUserProfile;
  overview: AdminOverviewResponse;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  showToast: (type: 'ok' | 'err', text: string) => void;
}

export default function MemberDetailModal({
  user,
  overview,
  onClose,
  onRefresh,
  showToast,
}: MemberDetailModalProps) {
  const [draftUser, setDraftUser] = useState<PublicUserProfile>({ ...user });
  const [activeTab, setActiveTab] = useState<'profile' | 'deposits' | 'withdraws' | 'work' | 'network'>('profile');
  const [saving, setSaving] = useState(false);

  // Quick adjust
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'balance' | 'depositBalance'>('balance');
  const [adjustMemo, setAdjustMemo] = useState('');
  const [adjustBusy, setAdjustBusy] = useState(false);

  // User activity collections
  const userDeposits = useMemo(() => overview.deposits.filter((d) => d.userId === user.id), [overview.deposits, user.id]);
  const userWithdraws = useMemo(() => overview.withdraws.filter((w) => w.userId === user.id), [overview.withdraws, user.id]);
  const userWork = useMemo(() => overview.workSubmissions.filter((w) => w.userId === user.id), [overview.workSubmissions, user.id]);
  const downline = useMemo(
    () => overview.users.filter((u) => u.referredBy === user.referCode || u.referredBy === user.id),
    [overview.users, user]
  );

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify(draftUser),
      });
      showToast('ok', 'Member profile updated.');
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to update user.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAdjustBalance(e: React.FormEvent) {
    e.preventDefault();
    const delta = Number(adjustAmount);
    if (isNaN(delta) || delta === 0) return;
    setAdjustBusy(true);
    try {
      await apiRequest(`/api/admin/users/${user.id}/adjust-balance`, {
        method: 'POST',
        body: JSON.stringify({ delta, type: adjustType, memo: adjustMemo }),
      });
      showToast('ok', `Adjusted balance by ${delta > 0 ? `+${delta}` : delta} ৳.`);
      setAdjustAmount('');
      setAdjustMemo('');
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to adjust balance.');
    } finally {
      setAdjustBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 select-none">
      <div className="surface-card w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/70">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={user.photoUrl || '/src/assets/images/avatar_member_default_1795024942538.jpg'}
              alt={user.name}
              className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
            />
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 truncate">{user.name}</h3>
              <p className="text-xs text-slate-500 font-mono-num flex items-center gap-1.5 truncate">
                <span>{user.id}</span>
                <span aria-hidden="true">·</span>
                <span>Code: {user.referCode}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="px-5 border-b border-slate-200 overflow-x-auto flex gap-1 pt-2">
          {[
            { id: 'profile', label: 'Profile & Balance' },
            { id: 'deposits', label: `Deposits (${userDeposits.length})` },
            { id: 'withdraws', label: `Withdrawals (${userWithdraws.length})` },
            { id: 'work', label: `Work (${userWork.length})` },
            { id: 'network', label: `Referral Tree (${downline.length})` },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer ${
                  active
                    ? 'border-emerald-600 text-slate-900 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'profile' && (
            <div className="space-y-5">
              {/* Balances Highlight */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500">Main Balance</span>
                  <p className="text-lg font-bold font-mono-num text-slate-900 mt-0.5">
                    {user.balance.toLocaleString()} ৳
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500">Deposit Pool</span>
                  <p className="text-lg font-bold font-mono-num text-slate-900 mt-0.5">
                    {user.depositBalance.toLocaleString()} ৳
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500">Today Earn</span>
                  <p className="text-lg font-bold font-mono-num text-emerald-700 mt-0.5">
                    {user.todayEarn.toLocaleString()} ৳
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500">Tasks Done</span>
                  <p className="text-lg font-bold font-mono-num text-slate-900 mt-0.5">
                    {user.completedTasks}
                  </p>
                </div>
              </div>

              {/* Balance Adjuster Section */}
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-800">Quick Balance Adjustment</h4>
                <form onSubmit={handleAdjustBalance} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Target</label>
                      <select
                        value={adjustType}
                        onChange={(e) => setAdjustType(e.target.value as 'balance' | 'depositBalance')}
                        className="input-atelier text-xs"
                      >
                        <option value="balance">Main Balance</option>
                        <option value="depositBalance">Deposit Pool</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Amount (+/- BDT)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(e.target.value)}
                        placeholder="e.g. 200 or -50"
                        className="input-atelier text-xs font-mono-num"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Memo</label>
                      <input
                        type="text"
                        value={adjustMemo}
                        onChange={(e) => setAdjustMemo(e.target.value)}
                        placeholder="e.g. Reward bonus"
                        className="input-atelier text-xs"
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={adjustBusy} className="btn-secondary btn-sm">
                    <span>{adjustBusy ? 'Applying...' : 'Apply Balance Adjustment'}</span>
                  </button>
                </form>
              </div>

              {/* Edit Details Form */}
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={draftUser.name}
                      onChange={(e) => setDraftUser({ ...draftUser, name: e.target.value })}
                      className="input-atelier text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                    <input
                      type="text"
                      required
                      value={draftUser.phone}
                      onChange={(e) => setDraftUser({ ...draftUser, phone: e.target.value })}
                      className="input-atelier text-xs font-mono-num"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Membership Level</label>
                    <input
                      type="text"
                      value={draftUser.level}
                      onChange={(e) => setDraftUser({ ...draftUser, level: e.target.value })}
                      className="input-atelier text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Account Status</label>
                    <select
                      value={draftUser.status}
                      onChange={(e) => setDraftUser({ ...draftUser, status: e.target.value as 'Active' | 'Suspended' })}
                      className="input-atelier text-xs"
                    >
                      <option value="Active">Active (Permitted)</option>
                      <option value="Suspended">Suspended (Blocked)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button type="button" onClick={onClose} className="btn-secondary btn-sm">
                    Close
                  </button>
                  <button type="submit" disabled={saving} className="btn-primary btn-sm">
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'deposits' && (
            <div className="divide-y divide-slate-100 text-xs">
              {userDeposits.length === 0 ? (
                <p className="text-center py-6 text-slate-400">No deposit history for this member.</p>
              ) : (
                userDeposits.map((d) => (
                  <div key={d.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{d.gateway} Cash-in ({d.amount} ৳)</p>
                      <p className="text-[11px] text-slate-400 font-mono-num">
                        Trx: {d.trxId} · {new Date(d.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`font-semibold ${d.status === 'Approved' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {d.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'withdraws' && (
            <div className="divide-y divide-slate-100 text-xs">
              {userWithdraws.length === 0 ? (
                <p className="text-center py-6 text-slate-400">No withdrawal history for this member.</p>
              ) : (
                userWithdraws.map((w) => (
                  <div key={w.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {w.type === 'agent' ? `District Agent (${w.district})` : w.method} ({w.amount} ৳)
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono-num">
                        Acct: {w.accountNumber} · {new Date(w.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`font-semibold ${w.status === 'Approved' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {w.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'work' && (
            <div className="divide-y divide-slate-100 text-xs">
              {userWork.length === 0 ? (
                <p className="text-center py-6 text-slate-400">No work submissions from this member.</p>
              ) : (
                userWork.map((w) => (
                  <div key={w.id} className="py-2.5 flex items-center justify-between">
                    <div className="min-w-0 max-w-[70%]">
                      <p className="font-semibold text-slate-900">{w.category} ({w.reward} ৳)</p>
                      <a href={w.sheetUrl} target="_blank" rel="noreferrer" className="text-emerald-700 truncate block text-[11px]">
                        {w.sheetUrl}
                      </a>
                    </div>
                    <span className={`font-semibold ${w.status === 'Approved' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {w.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'network' && (
            <div className="divide-y divide-slate-100 text-xs">
              {downline.length === 0 ? (
                <p className="text-center py-6 text-slate-400">No downline members referred yet.</p>
              ) : (
                downline.map((down) => (
                  <div key={down.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{down.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono-num">{down.id} · {down.level}</p>
                    </div>
                    <span className="font-mono-num text-slate-600">{down.balance} ৳</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
