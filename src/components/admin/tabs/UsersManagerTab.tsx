import React, { useMemo, useState } from 'react';
import {
  CreditCard,
  Edit2,
  Filter,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import type { AdminOverviewResponse, PublicUserProfile } from '../../../types';

interface UsersManagerTabProps {
  overview: AdminOverviewResponse;
  onRefresh: () => Promise<void>;
  onSelectUser: (user: PublicUserProfile) => void;
  showToast: (type: 'ok' | 'err', text: string) => void;
}

export default function UsersManagerTab({
  overview,
  onRefresh,
  onSelectUser,
  showToast,
}: UsersManagerTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Suspended'>('all');
  const [quickAdjustUser, setQuickAdjustUser] = useState<PublicUserProfile | null>(null);
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustType, setAdjustType] = useState<'balance' | 'depositBalance'>('balance');
  const [adjustMemo, setAdjustMemo] = useState('');
  const [adjustBusy, setAdjustBusy] = useState(false);

  const users = overview.users;

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q) ||
          u.phone.toLowerCase().includes(q) ||
          u.referCode.toLowerCase().includes(q) ||
          (u.referredBy && u.referredBy.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [users, statusFilter, search]);

  const activeCount = useMemo(() => users.filter((u) => u.status === 'Active').length, [users]);
  const suspendedCount = useMemo(() => users.filter((u) => u.status === 'Suspended').length, [users]);
  const totalBalance = useMemo(() => users.reduce((sum, u) => sum + u.balance, 0), [users]);

  async function handleQuickAdjustSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quickAdjustUser) return;
    const delta = Number(adjustDelta);
    if (isNaN(delta) || delta === 0) {
      showToast('err', 'Please enter a valid non-zero amount.');
      return;
    }

    setAdjustBusy(true);
    try {
      await apiRequest(`/api/admin/users/${quickAdjustUser.id}/adjust-balance`, {
        method: 'POST',
        body: JSON.stringify({ delta, type: adjustType, memo: adjustMemo }),
      });
      showToast(
        'ok',
        `Adjusted ${delta > 0 ? `+${delta}` : delta} ৳ for ${quickAdjustUser.name}.`
      );
      setQuickAdjustUser(null);
      setAdjustDelta('');
      setAdjustMemo('');
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Balance adjustment failed.');
    } finally {
      setAdjustBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Overview Stats Bar */}
      <div className="surface-card p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Members & Account Ledgers</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Full directory of registered members. Inspect balances, credit or debit funds, toggle suspension, and view referral trees.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-xs font-mono-num">
          <div className="p-2.5 px-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500">Active:</span>{' '}
            <strong className="text-emerald-700 font-bold">{activeCount}</strong>
          </div>
          <div className="p-2.5 px-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500">Suspended:</span>{' '}
            <strong className="text-red-700 font-bold">{suspendedCount}</strong>
          </div>
          <div className="p-2.5 px-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500">Total BDT:</span>{' '}
            <strong className="text-slate-900 font-bold">{totalBalance.toLocaleString()} ৳</strong>
          </div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="surface-card p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, user ID, refer code..."
            className="input-atelier pl-9 text-xs"
          />
        </div>

        <div className="segment-track grid-cols-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`segment-btn ${statusFilter === 'all' ? 'segment-btn-active' : 'segment-btn-idle'}`}
          >
            All Members ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('Active')}
            className={`segment-btn ${statusFilter === 'Active' ? 'segment-btn-active' : 'segment-btn-idle'}`}
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('Suspended')}
            className={`segment-btn ${statusFilter === 'Suspended' ? 'segment-btn-active' : 'segment-btn-idle'}`}
          >
            Suspended ({suspendedCount})
          </button>
        </div>
      </div>

      {/* Members Table */}
      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="px-3.5 py-2.5">Member</th>
                <th className="px-3.5 py-2.5">Contact</th>
                <th className="px-3.5 py-2.5">Refer Code</th>
                <th className="px-3.5 py-2.5 text-right">Main Balance</th>
                <th className="px-3.5 py-2.5 text-right">Deposit Pool</th>
                <th className="px-3.5 py-2.5 text-right">Today Earn</th>
                <th className="px-3.5 py-2.5">Status</th>
                <th className="px-3.5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No members found matching "{search}".
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isActive = u.status === 'Active';
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={u.photoUrl || '/src/assets/images/avatar_member_default_1795024942538.jpg'}
                            alt={u.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{u.name}</p>
                            <p className="text-[11px] text-slate-500 font-mono-num truncate">{u.id}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-3.5 py-2.5 text-slate-700">
                        <p className="truncate">{u.email}</p>
                        <p className="text-[11px] text-slate-500 font-mono-num">{u.phone}</p>
                      </td>

                      <td className="px-3.5 py-2.5 font-mono-num text-[11px]">
                        <span className="font-semibold text-slate-900">{u.referCode}</span>
                        {u.referredBy && (
                          <p className="text-slate-400 text-[10px]">ref: {u.referredBy}</p>
                        )}
                      </td>

                      <td className="px-3.5 py-2.5 text-right font-mono-num font-bold text-slate-900">
                        {u.balance.toLocaleString()} ৳
                      </td>

                      <td className="px-3.5 py-2.5 text-right font-mono-num text-slate-700">
                        {u.depositBalance.toLocaleString()} ৳
                      </td>

                      <td className="px-3.5 py-2.5 text-right font-mono-num text-emerald-700 font-semibold">
                        {u.todayEarn > 0 ? `+${u.todayEarn.toLocaleString()} ৳` : '0 ৳'}
                      </td>

                      <td className="px-3.5 py-2.5">
                        <span
                          className={`inline-block font-semibold text-[11px] ${
                            isActive ? 'text-emerald-700' : 'text-red-700 font-bold'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>

                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setQuickAdjustUser(u);
                              setAdjustDelta('');
                              setAdjustMemo('');
                            }}
                            className="px-2 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                            title="Quick Adjust Balance (+/-)"
                          >
                            <span>+/- ৳</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelectUser(u)}
                            className="btn-secondary min-h-[30px] px-2.5 py-1 text-xs"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Profile</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50/70 border-t border-slate-200/90 text-xs text-slate-500 flex items-center justify-between">
          <span>Showing {filteredUsers.length} of {users.length} members</span>
          <span className="font-mono-num text-[11px]">Realtime Member Accounts</span>
        </div>
      </div>

      {/* Quick Balance Adjuster Modal */}
      {quickAdjustUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Adjust Member Balance</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Member: <strong className="text-slate-800">{quickAdjustUser.name}</strong> ({quickAdjustUser.id})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickAdjustUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickAdjustSubmit} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between font-mono-num">
                <span>Current Main Balance:</span>
                <strong className="text-slate-900 font-bold">{quickAdjustUser.balance} ৳</strong>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Balance Type
                </label>
                <div className="segment-track grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('balance')}
                    className={`segment-btn ${adjustType === 'balance' ? 'segment-btn-active' : 'segment-btn-idle'}`}
                  >
                    Main Balance
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('depositBalance')}
                    className={`segment-btn ${adjustType === 'depositBalance' ? 'segment-btn-active' : 'segment-btn-idle'}`}
                  >
                    Deposit Pool
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount Delta (BDT)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  placeholder="e.g. 500 for addition or -200 for deduction"
                  className="input-atelier text-sm font-mono-num"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Positive number adds money; negative number (e.g. -100) deducts money.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Audit Memo / Reason (Optional)
                </label>
                <input
                  type="text"
                  value={adjustMemo}
                  onChange={(e) => setAdjustMemo(e.target.value)}
                  placeholder="e.g. Admin bonus, Manual correction, Offline recharge"
                  className="input-atelier text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickAdjustUser(null)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustBusy}
                  className="btn-primary btn-sm"
                >
                  {adjustBusy ? 'Applying...' : 'Apply Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
