import React, { useState } from 'react';
import { Database, FileUp, Upload, X } from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import type { DatabaseState } from '../../../types';

interface DatabaseImportModalProps {
  onClose: () => void;
  onRefresh: () => Promise<void>;
  showToast: (type: 'ok' | 'err', text: string) => void;
}

export default function DatabaseImportModal({
  onClose,
  onRefresh,
  showToast,
}: DatabaseImportModalProps) {
  const [jsonText, setJsonText] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewState, setPreviewState] = useState<DatabaseState | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      setJsonText(content);
      verifyJson(content);
    };
    reader.readAsText(file);
  }

  function verifyJson(text: string) {
    setParseError(null);
    setPreviewState(null);
    try {
      const parsed = JSON.parse(text) as DatabaseState;
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('File content must be a JSON object.');
      }
      setPreviewState(parsed);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Invalid JSON file.');
    }
  }

  async function handleImportSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!previewState) {
      verifyJson(jsonText);
      return;
    }

    if (
      !confirm(
        'WARNING: Importing this snapshot will completely replace the server database with this imported dataset. A snapshot will also be synced to GitHub if configured. Proceed?'
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      await apiRequest('/api/admin/db/import', {
        method: 'POST',
        body: JSON.stringify({ state: previewState }),
      });
      showToast('ok', 'Database snapshot restored and broadcast live!');
      await onRefresh();
      onClose();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Database import failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 select-none">
      <div className="surface-card w-full max-w-lg p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Restore Database Snapshot</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Upload a valid exported <code className="font-mono">.json</code> backup file or paste JSON below to restore entire database collections (Firebase Realtime Database alternative).
        </p>

        <form onSubmit={handleImportSubmit} className="space-y-4">
          {/* File Picker */}
          <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
              id="db-file-upload"
            />
            <label htmlFor="db-file-upload" className="cursor-pointer block space-y-1">
              <FileUp className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">
                {fileName ? fileName : 'Click to select JSON backup file'}
              </p>
              <p className="text-[11px] text-slate-400">or paste JSON content in the editor below</p>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Raw JSON Payload</label>
            <textarea
              rows={6}
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                verifyJson(e.target.value);
              }}
              placeholder='{"version": 1, "config": { ... }, "users": { ... }}'
              className="input-atelier font-mono text-xs p-3"
            />
          </div>

          {parseError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-mono-num">
              <strong>Error:</strong> {parseError}
            </div>
          )}

          {previewState && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1 font-mono-num">
              <p className="font-bold text-emerald-800">Snapshot Verified Valid:</p>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-emerald-700">
                <span>Site: {previewState.config?.siteName || 'Unknown'}</span>
                <span>Users: {Object.keys(previewState.users || {}).length}</span>
                <span>Deposits: {(previewState.deposits || []).length}</span>
                <span>Withdraws: {(previewState.withdraws || []).length}</span>
                <span>Tasks: {(previewState.customTasks || []).length}</span>
                <span>Invites: {(previewState.invites || []).length}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-secondary btn-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !previewState}
              className="btn-danger btn-sm"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{busy ? 'Restoring...' : 'Restore Database'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
