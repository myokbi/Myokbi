import React, { useState } from 'react';
import {
  Code,
  Database,
  Plus,
  Save,
  Table2,
  Trash2,
  X,
} from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import type { DbCollectionName } from '../tabs/DatabaseExplorerTab';

interface DatabaseRecordModalProps {
  collection: DbCollectionName;
  initialRecord: Record<string, unknown> | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  showToast: (type: 'ok' | 'err', text: string) => void;
}

export default function DatabaseRecordModal({
  collection,
  initialRecord,
  onClose,
  onRefresh,
  showToast,
}: DatabaseRecordModalProps) {
  const isEditing = initialRecord !== null;
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(
      initialRecord || {
        id: `${collection.slice(0, 3).toUpperCase()}-${Date.now()}`,
        name: '',
        active: true,
      },
      null,
      2
    )
  );
  const [mode, setMode] = useState<'json' | 'form'>('json');
  const [busy, setBusy] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setParseError(null);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Record must be a valid JSON object.');
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Invalid JSON format.');
      return;
    }

    setBusy(true);
    try {
      if (isEditing) {
        const id = String(initialRecord.id || parsed.id);
        await apiRequest(`/api/admin/db/record/${collection}/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(parsed),
        });
        showToast('ok', `Document ${id} updated in ${collection}.`);
      } else {
        await apiRequest('/api/admin/db/record', {
          method: 'POST',
          body: JSON.stringify({ collection, record: parsed }),
        });
        showToast('ok', `New document created in ${collection}.`);
      }
      await onRefresh();
      onClose();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Operation failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 select-none">
      <div className="surface-card w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <Database className="w-4 h-4 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isEditing ? `Edit ${collection} Record` : `Insert into ${collection}`}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono-num">
                {isEditing ? `ID: ${String(initialRecord.id)}` : 'Realtime Document Store'}
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

        {/* Editor Body */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden p-5 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">Document Payload (JSON)</span>
            <span className="text-[11px] text-slate-400 font-mono-num">Auto-type inference enabled</span>
          </div>

          <div className="flex-1 min-h-[300px] flex flex-col">
            <textarea
              rows={14}
              required
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                setParseError(null);
              }}
              className="input-atelier flex-1 font-mono text-xs p-3 leading-relaxed bg-slate-900 text-emerald-400 focus:bg-slate-900 focus:text-emerald-300 resize-none rounded-xl"
            />
          </div>

          {parseError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-mono-num">
              <strong>Syntax Error:</strong> {parseError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-secondary btn-sm">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn-primary btn-sm">
              <Save className="w-3.5 h-3.5" />
              <span>{busy ? 'Saving...' : isEditing ? 'Save Changes' : 'Insert Document'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
