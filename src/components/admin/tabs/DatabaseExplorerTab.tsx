import React, { useMemo, useState } from 'react';
import {
  Code,
  Copy,
  Database,
  Download,
  Edit2,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Search,
  Table2,
  Trash2,
  Upload,
} from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import type { AdminOverviewResponse } from '../../../types';

export type DbCollectionName =
  | 'users'
  | 'deposits'
  | 'withdraws'
  | 'workSubmissions'
  | 'p2pTransactions'
  | 'helplineMessages'
  | 'adWatchLogs'
  | 'invites'
  | 'districtAgents'
  | 'customTasks'
  | 'config';

interface DatabaseExplorerTabProps {
  overview: AdminOverviewResponse;
  onRefresh: () => Promise<void>;
  onOpenRecordEditor: (collection: DbCollectionName, record: Record<string, unknown> | null) => void;
  onOpenImportModal: () => void;
  onExportDatabase: () => void;
  showToast: (type: 'ok' | 'err', text: string) => void;
}

export default function DatabaseExplorerTab({
  overview,
  onRefresh,
  onOpenRecordEditor,
  onOpenImportModal,
  onExportDatabase,
  showToast,
}: DatabaseExplorerTabProps) {
  const [selectedCollection, setSelectedCollection] = useState<DbCollectionName>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  const [copiedJson, setCopiedJson] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const collectionsMeta: Array<{ id: DbCollectionName; label: string; count: number }> = [
    { id: 'users', label: 'users', count: overview.users.length },
    { id: 'deposits', label: 'deposits', count: overview.deposits.length },
    { id: 'withdraws', label: 'withdraws', count: overview.withdraws.length },
    { id: 'workSubmissions', label: 'workSubmissions', count: overview.workSubmissions.length },
    { id: 'p2pTransactions', label: 'p2pTransactions', count: overview.p2pTransactions.length },
    { id: 'helplineMessages', label: 'helplineMessages', count: overview.helplineMessages.length },
    { id: 'adWatchLogs', label: 'adWatchLogs', count: overview.adWatchLogs.length },
    { id: 'invites', label: 'invites', count: overview.invites.length },
    { id: 'districtAgents', label: 'districtAgents', count: (overview.districtAgents || []).length },
    { id: 'customTasks', label: 'customTasks', count: (overview.customTasks || []).length },
    { id: 'config', label: 'config', count: 1 },
  ];

  // Resolve collection records as array
  const rawItems = useMemo<Record<string, unknown>[]>(() => {
    switch (selectedCollection) {
      case 'users':
        return overview.users as unknown as Record<string, unknown>[];
      case 'deposits':
        return overview.deposits as unknown as Record<string, unknown>[];
      case 'withdraws':
        return overview.withdraws as unknown as Record<string, unknown>[];
      case 'workSubmissions':
        return overview.workSubmissions as unknown as Record<string, unknown>[];
      case 'p2pTransactions':
        return overview.p2pTransactions as unknown as Record<string, unknown>[];
      case 'helplineMessages':
        return overview.helplineMessages as unknown as Record<string, unknown>[];
      case 'adWatchLogs':
        return overview.adWatchLogs as unknown as Record<string, unknown>[];
      case 'invites':
        return overview.invites as unknown as Record<string, unknown>[];
      case 'districtAgents':
        return (overview.districtAgents || []) as unknown as Record<string, unknown>[];
      case 'customTasks':
        return (overview.customTasks || []) as unknown as Record<string, unknown>[];
      case 'config':
        return [overview.config as unknown as Record<string, unknown>];
      default:
        return [];
    }
  }, [overview, selectedCollection]);

  // Filter items by search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return rawItems;
    const q = searchQuery.toLowerCase();
    return rawItems.filter((item) => {
      return Object.values(item).some((val) => {
        if (typeof val === 'string' || typeof val === 'number') {
          return String(val).toLowerCase().includes(q);
        }
        return false;
      });
    });
  }, [rawItems, searchQuery]);

  // Get primary display columns for table mode
  const displayColumns = useMemo<string[]>(() => {
    if (filteredItems.length === 0) return ['id'];
    const keys = new Set<string>();
    // Pick first 8 simple primitive keys
    for (const item of filteredItems.slice(0, 50)) {
      for (const k of Object.keys(item)) {
        if (typeof item[k] !== 'object' || item[k] === null) {
          keys.add(k);
        }
      }
    }
    // Always lead with 'id', then others
    const arr = Array.from(keys);
    const sorted = ['id', ...arr.filter((k) => k !== 'id')];
    return sorted.slice(0, 8);
  }, [filteredItems]);

  async function handleDeleteRecord(id: string) {
    if (selectedCollection === 'config') {
      showToast('err', 'Root site configuration cannot be deleted.');
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete record ${id} from "${selectedCollection}"?`)) {
      return;
    }
    setDeletingId(id);
    try {
      await apiRequest(`/api/admin/db/record/${selectedCollection}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      showToast('ok', `Record ${id} deleted from ${selectedCollection}.`);
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to delete record.');
    } finally {
      setDeletingId(null);
    }
  }

  function handleCopyJson() {
    const text = JSON.stringify(filteredItems, null, 2);
    navigator.clipboard?.writeText(text);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Realtime Engine Banner */}
      <div className="surface-card p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">Realtime Database Engine</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Zero-Firebase self-hosted document store. Directly browse, search, edit, create, export, and restore database nodes with live synchronization across all connected clients.
          </p>
        </div>

        {/* Global Database Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onExportDatabase}
            className="btn-secondary btn-sm"
            title="Export entire database as JSON file"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export JSON</span>
          </button>
          <button
            type="button"
            onClick={onOpenImportModal}
            className="btn-secondary btn-sm"
            title="Import and restore database from JSON"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span>Restore / Import</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenRecordEditor(selectedCollection, null)}
            className="btn-primary btn-sm"
            disabled={selectedCollection === 'config'}
            title="Insert a new document into the current collection"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Record</span>
          </button>
        </div>
      </div>

      {/* Collection Navigation Tabs */}
      <div className="overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 min-w-max border-b border-slate-200">
          {collectionsMeta.map((c) => {
            const active = selectedCollection === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelectedCollection(c.id);
                  setSearchQuery('');
                }}
                className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
                  active
                    ? 'border-emerald-600 text-slate-900 bg-white shadow-sm'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
                }`}
              >
                <span>{c.label}</span>
                <span className="font-mono-num text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                  {c.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search, Filter & View Controls Bar */}
      <div className="surface-card p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${selectedCollection} records...`}
            className="input-atelier pl-9 text-xs"
          />
        </div>

        {/* View Toggle & Copy Tools */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="segment-track grid-cols-2">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`segment-btn ${viewMode === 'table' ? 'segment-btn-active' : 'segment-btn-idle'}`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('json')}
              className={`segment-btn ${viewMode === 'json' ? 'segment-btn-active' : 'segment-btn-idle'}`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyJson}
            className="btn-secondary btn-sm"
            title="Copy current filtered data as JSON"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedJson ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Main Content: Table or JSON Tree */}
      {viewMode === 'table' ? (
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  {displayColumns.map((col) => (
                    <th key={col} className="px-3.5 py-2.5 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                  <th className="px-3.5 py-2.5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={displayColumns.length + 1} className="p-8 text-center text-slate-400">
                      No records found matching "{searchQuery}".
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => {
                    const rowId = String(item.id || `record-${idx}`);
                    return (
                      <tr key={rowId} className="hover:bg-slate-50/80 transition-colors">
                        {displayColumns.map((col) => {
                          const val = item[col];
                          let formatted = '';
                          if (val === null || val === undefined) {
                            formatted = '—';
                          } else if (typeof val === 'boolean') {
                            formatted = val ? 'true' : 'false';
                          } else if (typeof val === 'number') {
                            formatted = val.toLocaleString();
                          } else {
                            formatted = String(val);
                          }

                          const isId = col === 'id' || col.toLowerCase().includes('id');
                          const isTimestamp = col === 'timestamp' || col === 'createdAt' || col === 'reviewedAt';

                          return (
                            <td
                              key={col}
                              className={`px-3.5 py-2.5 max-w-[200px] truncate ${
                                isId || isTimestamp ? 'font-mono-num text-[11px] text-slate-600' : 'text-slate-800'
                              }`}
                              title={String(val ?? '')}
                            >
                              {isTimestamp && typeof val === 'number'
                                ? new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : formatted}
                            </td>
                          );
                        })}
                        <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onOpenRecordEditor(selectedCollection, item)}
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Edit record"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {selectedCollection !== 'config' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteRecord(rowId)}
                                disabled={deletingId === rowId}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
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
            <span>
              Showing {filteredItems.length} of {rawItems.length} records in{' '}
              <strong className="text-slate-800 font-mono-num">{selectedCollection}</strong>
            </span>
            <span className="font-mono-num text-[11px]">Realtime State Synchronized</span>
          </div>
        </div>
      ) : (
        <div className="surface-card p-4 overflow-hidden">
          <pre className="font-mono text-xs text-slate-800 bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto max-h-[550px] leading-relaxed">
            {JSON.stringify(filteredItems, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
