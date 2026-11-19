import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ExternalLink,
  Filter,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import type { AdminOverviewResponse, DepositRequest, WithdrawRequest, WorkSubmission } from '../../../types';

type ApprovalCategory = 'all' | 'deposits' | 'withdraws' | 'work';
type ApprovalStatusFilter = 'Pending' | 'Approved' | 'Rejected' | 'all';

interface ApprovalsTabProps {
  overview: AdminOverviewResponse;
  onRefresh: () => Promise<void>;
  showToast: (type: 'ok' | 'err', text: string) => void;
}

export default function ApprovalsTab({ overview, onRefresh, showToast }: ApprovalsTabProps) {
  const [category, setCategory] = useState<ApprovalCategory>('all');
  const [statusFilter, setStatusFilter] = useState<ApprovalStatusFilter>('Pending');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);

  // Normalize all items into a unified approval list
  interface UnifiedApprovalItem {
    id: string;
    type: 'deposit' | 'withdraw' | 'work';
    userId: string;
    userName: string;
    label: string;
    detail: string;
    amountBdt: number;
    status: 'Pending' | 'Approved' | 'Rejected';
    timestamp: number;
    url?: string;
  }

  const items = useMemo<UnifiedApprovalItem[]>(() => {
    const list: UnifiedApprovalItem[] = [];

    if (category === 'all' || category === 'deposits') {
      for (const d of overview.deposits) {
        list.push({
          id: d.id,
          type: 'deposit',
          userId: d.userId,
          userName: d.userName,
          label: `${d.gateway} Deposit`,
          detail: `TrxID: ${d.trxId} · Sender: ${d.senderNumber}`,
          amountBdt: d.amount,
          status: d.status,
          timestamp: d.timestamp,
        });
      }
    }

    if (category === 'all' || category === 'withdraws') {
      for (const w of overview.withdraws) {
        list.push({
          id: w.id,
          type: 'withdraw',
          userId: w.userId,
          userName: w.userName,
          label: w.type === 'agent' ? `District Agent (${w.district})` : `${w.method} Payout`,
          detail: w.type === 'agent'
            ? `Agent: ${w.agentName || 'Assigned'} · Acct: ${w.accountNumber}`
            : `Method: ${w.method} · Acct: ${w.accountNumber}`,
          amountBdt: w.amount,
          status: w.status,
          timestamp: w.timestamp,
        });
      }
    }

    if (category === 'all' || category === 'work') {
      for (const w of overview.workSubmissions) {
        list.push({
          id: w.id,
          type: 'work',
          userId: w.userId,
          userName: w.userName,
          label: `Work: ${w.category}`,
          detail: w.notes ? `Note: ${w.notes}` : 'Google Sheet submission',
          amountBdt: w.reward,
          status: w.status,
          timestamp: w.timestamp,
          url: w.sheetUrl,
        });
      }
    }

    // Sort newest first
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [overview, category]);

  // Filter items
  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          item.id.toLowerCase().includes(q) ||
          item.userName.toLowerCase().includes(q) ||
          item.userId.toLowerCase().includes(q) ||
          item.detail.toLowerCase().includes(q) ||
          item.label.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, statusFilter, search]);

  const pendingCount = useMemo(() => {
    return items.filter((i) => i.status === 'Pending').length;
  }, [items]);

  const pendingAmountBdt = useMemo(() => {
    return items
      .filter((i) => i.status === 'Pending')
      .reduce((sum, i) => sum + i.amountBdt, 0);
  }, [items]);

  async function handleSingleReview(item: UnifiedApprovalItem, action: 'Approved' | 'Rejected') {
    setProcessingId(item.id);
    const endpointType =
      item.type === 'deposit' ? 'deposits' : item.type === 'withdraw' ? 'withdraws' : 'work';

    try {
      await apiRequest(`/api/admin/${endpointType}/${item.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      showToast('ok', `${item.label} marked as ${action}.`);
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Review action failed.');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleBatchReview(action: 'Approved' | 'Rejected') {
    if (selectedIds.length === 0) return;
    setBatchBusy(true);

    // Group selected IDs by type
    const depositIds = items.filter((i) => selectedIds.includes(i.id) && i.type === 'deposit').map((i) => i.id);
    const withdrawIds = items.filter((i) => selectedIds.includes(i.id) && i.type === 'withdraw').map((i) => i.id);
    const workIds = items.filter((i) => selectedIds.includes(i.id) && i.type === 'work').map((i) => i.id);

    try {
      if (depositIds.length > 0) {
        await apiRequest('/api/admin/approvals/batch', {
          method: 'POST',
          body: JSON.stringify({ type: 'deposits', ids: depositIds, action }),
        });
      }
      if (withdrawIds.length > 0) {
        await apiRequest('/api/admin/approvals/batch', {
          method: 'POST',
          body: JSON.stringify({ type: 'withdraws', ids: withdrawIds, action }),
        });
      }
      if (workIds.length > 0) {
        await apiRequest('/api/admin/approvals/batch', {
          method: 'POST',
          body: JSON.stringify({ type: 'work', ids: workIds, action }),
        });
      }

      showToast('ok', `Successfully marked ${selectedIds.length} items as ${action}.`);
      setSelectedIds([]);
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Batch review failed.');
    } finally {
      setBatchBusy(false);
    }
  }

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleSelectAll() {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((i) => i.id));
    }
  }

  return (
    <div className="space-y-4">
      {/* Overview Stats Bar */}
      <div className="surface-card p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Financial Settlements & Approvals</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time multi-gateway verification desk. Approve deposit credits, disburse withdrawals, and review work submissions.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono-num">
          <div className="p-2.5 px-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500">Pending Queue:</span>{' '}
            <strong className="text-slate-900 font-bold">{pendingCount}</strong>
          </div>
          <div className="p-2.5 px-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900">
            <span className="text-emerald-700">Volume:</span>{' '}
            <strong className="font-bold">{pendingAmountBdt.toLocaleString()} ৳</strong>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="surface-card p-3 space-y-3">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto">
            <button
              type="button"
              onClick={() => setCategory('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                category === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              All Items
            </button>
            <button
              type="button"
              onClick={() => setCategory('deposits')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                category === 'deposits'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Deposits ({overview.serverStats.pendingDeposits})
            </button>
            <button
              type="button"
              onClick={() => setCategory('withdraws')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                category === 'withdraws'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Withdrawals ({overview.serverStats.pendingWithdraws})
            </button>
            <button
              type="button"
              onClick={() => setCategory('work')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                category === 'work'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Work Submissions ({overview.serverStats.pendingWork})
            </button>
          </div>

          {/* Status Tabs */}
          <div className="segment-track grid-cols-4 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('Pending')}
              className={`segment-btn ${statusFilter === 'Pending' ? 'segment-btn-active' : 'segment-btn-idle'}`}
            >
              Pending
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('Approved')}
              className={`segment-btn ${statusFilter === 'Approved' ? 'segment-btn-active' : 'segment-btn-idle'}`}
            >
              Approved
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('Rejected')}
              className={`segment-btn ${statusFilter === 'Rejected' ? 'segment-btn-active' : 'segment-btn-idle'}`}
            >
              Rejected
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`segment-btn ${statusFilter === 'all' ? 'segment-btn-active' : 'segment-btn-idle'}`}
            >
              All Status
            </button>
          </div>
        </div>

        {/* Search & Batch Actions Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, user ID, trx ID, number..."
              className="input-atelier pl-9 text-xs"
            />
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-xs text-slate-600 font-medium">
                {selectedIds.length} selected
              </span>
              <button
                type="button"
                onClick={() => handleBatchReview('Approved')}
                disabled={batchBusy}
                className="btn-primary btn-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve Selected</span>
              </button>
              <button
                type="button"
                onClick={() => handleBatchReview('Rejected')}
                disabled={batchBusy}
                className="btn-danger btn-sm"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reject</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Approvals Table */}
      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="px-3.5 py-2.5 w-10">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </th>
                <th className="px-3.5 py-2.5">Item & Member</th>
                <th className="px-3.5 py-2.5">Details</th>
                <th className="px-3.5 py-2.5 text-right">Amount</th>
                <th className="px-3.5 py-2.5">Status</th>
                <th className="px-3.5 py-2.5">Time</th>
                <th className="px-3.5 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No items in this queue matching filters.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isProcessing = processingId === item.id;
                  const isPending = item.status === 'Pending';
                  const isSelected = selectedIds.includes(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      <td className="px-3.5 py-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(item.id)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>

                      <td className="px-3.5 py-2.5">
                        <div className="font-semibold text-slate-900">{item.label}</div>
                        <div className="text-[11px] text-slate-500 font-mono-num flex items-center gap-1.5 mt-0.5">
                          <span>{item.userName}</span>
                          <span aria-hidden="true">·</span>
                          <span>{item.userId}</span>
                        </div>
                      </td>

                      <td className="px-3.5 py-2.5 max-w-[280px]">
                        <p className="text-slate-700 truncate" title={item.detail}>
                          {item.detail}
                        </p>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline mt-0.5"
                          >
                            <span>Open Google Sheet</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </td>

                      <td className="px-3.5 py-2.5 text-right font-mono-num font-bold text-slate-900 text-sm">
                        {item.amountBdt.toLocaleString()} ৳
                      </td>

                      <td className="px-3.5 py-2.5">
                        <span
                          className={`inline-block font-semibold text-[11px] ${
                            item.status === 'Approved'
                              ? 'text-emerald-700'
                              : item.status === 'Rejected'
                              ? 'text-red-700'
                              : 'text-amber-700 font-bold'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td className="px-3.5 py-2.5 font-mono-num text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(item.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSingleReview(item, 'Approved')}
                              disabled={isProcessing}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSingleReview(item, 'Rejected')}
                              disabled={isProcessing}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-100 hover:bg-red-200 text-red-800 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Reviewed</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50/70 border-t border-slate-200/90 text-xs text-slate-500 flex items-center justify-between">
          <span>Showing {filtered.length} approvals</span>
          <span className="font-mono-num text-[11px]">Auto-settling Realtime Stream</span>
        </div>
      </div>
    </div>
  );
}
