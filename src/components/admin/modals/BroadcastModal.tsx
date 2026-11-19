import React, { useState } from 'react';
import { Megaphone, Send, X } from 'lucide-react';
import { apiRequest } from '../../../lib/api';

interface BroadcastModalProps {
  onClose: () => void;
  showToast: (type: 'ok' | 'err', text: string) => void;
}

export default function BroadcastModal({ onClose, showToast }: BroadcastModalProps) {
  const [title, setTitle] = useState('Official Server Update');
  const [message, setMessage] = useState('');
  const [level, setLevel] = useState<'info' | 'warning' | 'success'>('info');
  const [busy, setBusy] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);

    try {
      await apiRequest('/api/admin/broadcast', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), message: message.trim(), level }),
      });
      showToast('ok', 'Broadcast notification dispatched live to all connected clients!');
      onClose();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Broadcast failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="surface-card w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Realtime Live Broadcast</h3>
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
          This message will immediately appear in real-time on the screens of all connected visitors and members.
        </p>

        <form onSubmit={handleSend} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notice Headline</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-atelier text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Message Text</label>
            <textarea
              rows={3}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. নতুন ভিডিও এড ড্যাশবোর্ড চালু হয়েছে! এখনই দেখে ৩০ পয়সা আয় করুন।"
              className="input-atelier text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Alert Style</label>
            <div className="segment-track grid-cols-3">
              <button
                type="button"
                onClick={() => setLevel('info')}
                className={`segment-btn ${level === 'info' ? 'segment-btn-active' : 'segment-btn-idle'}`}
              >
                Informative
              </button>
              <button
                type="button"
                onClick={() => setLevel('success')}
                className={`segment-btn ${level === 'success' ? 'segment-btn-active' : 'segment-btn-idle'}`}
              >
                Success
              </button>
              <button
                type="button"
                onClick={() => setLevel('warning')}
                className={`segment-btn ${level === 'warning' ? 'segment-btn-active' : 'segment-btn-idle'}`}
              >
                Urgent / Alert
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-secondary btn-sm">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn-primary btn-sm">
              <Send className="w-3.5 h-3.5" />
              <span>{busy ? 'Broadcasting...' : 'Broadcast Now'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
