import React, { useMemo, useState } from 'react';
import {
  Headphones,
  KeyRound,
  Lock,
  Megaphone,
  Send,
  ShieldCheck,
  User,
} from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import type { AdminOverviewResponse, HelplineMessage } from '../../../types';

interface SupportSecurityTabProps {
  overview: AdminOverviewResponse;
  onRefresh: () => Promise<void>;
  onOpenBroadcast: () => void;
  showToast: (type: 'ok' | 'err', text: string) => void;
}

export default function SupportSecurityTab({
  overview,
  onRefresh,
  onOpenBroadcast,
  showToast,
}: SupportSecurityTabProps) {
  const [selectedChatUserId, setSelectedChatUserId] = useState<string>('');
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);

  // Passkey rotation state
  const [newPasskey, setNewPasskey] = useState('');
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  // Group messages by user
  const chatThreads = useMemo(() => {
    const map = new Map<string, { userName: string; messages: HelplineMessage[] }>();
    for (const m of overview.helplineMessages) {
      const existing = map.get(m.userId) || { userName: m.userName, messages: [] };
      existing.messages.push(m);
      map.set(m.userId, existing);
    }
    return map;
  }, [overview.helplineMessages]);

  const activeUserId = selectedChatUserId || (Array.from(chatThreads.keys())[0] || '');
  const activeThread = activeUserId ? chatThreads.get(activeUserId) : null;

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!activeUserId || !replyText.trim()) return;
    setReplyBusy(true);

    try {
      await apiRequest('/api/admin/helpline/reply', {
        method: 'POST',
        body: JSON.stringify({ userId: activeUserId, text: replyText.trim() }),
      });
      setReplyText('');
      showToast('ok', 'Reply sent to member in real time.');
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to send reply.');
    } finally {
      setReplyBusy(false);
    }
  }

  async function handleRotatePasskey(e: React.FormEvent) {
    e.preventDefault();
    if (newPasskey.length < 6) {
      showToast('err', 'Passkey must be at least 6 characters.');
      return;
    }
    setPasskeyBusy(true);
    try {
      await apiRequest('/api/admin/passkey', {
        method: 'POST',
        body: JSON.stringify({ newPasskey: newPasskey.trim() }),
      });
      setNewPasskey('');
      showToast('ok', 'Owner passkey rotated securely.');
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to rotate passkey.');
    } finally {
      setPasskeyBusy(false);
    }
  }

  const CANNED_REPLIES = [
    'আপনার ডিপোজিট ভেরিফাই করা হচ্ছে, অনুগ্রহ করে ৫ মিনিট অপেক্ষা করুন।',
    'উত্তোলন অনুমোদিত হয়েছে, আপনার একাউন্টে টাকা পৌঁছে যাবে।',
    'গুগল শিট টাস্ক লিঙ্কটি ভিউ পারমিশন সহ সাবমিট করুন।',
    'ধন্যবাদ! যেকোনো প্রয়োজনে আমাদের সাথেই থাকুন।',
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="surface-card p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Headphones className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">Live Support Chat & Security Desk</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time chat helpline (auto-purges after 30 minutes of inactivity), live system broadcasts, and Owner Passkey security.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenBroadcast}
          className="btn-primary btn-sm"
        >
          <Megaphone className="w-3.5 h-3.5" />
          <span>Broadcast Message</span>
        </button>
      </div>

      {/* Two Columns: Chat on Left, Passkey/Security on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Support Chat Split-Pane */}
        <div className="lg:col-span-2 surface-card overflow-hidden flex flex-col h-[580px]">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900">Active Member Support Tickets</h3>
            <span className="text-[11px] text-slate-500 font-mono-num">
              {chatThreads.size} active chat threads
            </span>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Thread List Sidebar */}
            <div className="w-1/3 border-r border-slate-200 overflow-y-auto bg-slate-50/50 p-2 space-y-1">
              {chatThreads.size === 0 ? (
                <p className="text-xs text-slate-400 p-4 text-center">
                  No active helpline messages right now.
                </p>
              ) : (
                Array.from(chatThreads.entries()).map(([uid, thread]) => {
                  const isSelected = uid === activeUserId;
                  const lastMsg = thread.messages[thread.messages.length - 1];
                  return (
                    <button
                      key={uid}
                      type="button"
                      onClick={() => setSelectedChatUserId(uid)}
                      className={`w-full p-2.5 text-left rounded-xl transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white shadow-xs border border-slate-200 text-slate-900 font-semibold'
                          : 'hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold truncate">{thread.userName}</span>
                        <span className="text-[10px] font-mono-num text-slate-400">
                          {thread.messages.length}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono-num truncate mt-0.5">{uid}</p>
                      {lastMsg && (
                        <p className="text-[10px] text-slate-400 truncate mt-1">
                          {lastMsg.text}
                        </p>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Conversation Window */}
            <div className="flex-1 flex flex-col bg-white overflow-hidden">
              {activeThread ? (
                <>
                  {/* Thread Header */}
                  <div className="p-3 border-b border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">{activeThread.userName}</span>
                    <span className="font-mono-num text-slate-400">{activeUserId}</span>
                  </div>

                  {/* Messages Bubble Area */}
                  <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
                    {activeThread.messages.map((m) => {
                      const isUser = m.sender === 'User';
                      const isAgent = m.sender === 'Agent';
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${
                            isAgent ? 'items-end' : isUser ? 'items-start' : 'items-center'
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs ${
                              isAgent
                                ? 'bg-emerald-600 text-white rounded-br-none'
                                : isUser
                                ? 'bg-slate-100 text-slate-900 rounded-bl-none'
                                : 'bg-slate-50 text-slate-500 border border-slate-200 text-center text-[11px]'
                            }`}
                          >
                            <div className="text-[10px] font-bold opacity-75 mb-0.5">
                              {m.sender === 'Agent' ? 'Support Agent (You)' : m.sender === 'User' ? m.userName : 'Server Bot'}
                            </div>
                            <p>{m.text}</p>
                            <span className="block text-[9px] opacity-75 mt-1 font-mono-num text-right">
                              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Canned Quick Replies */}
                  <div className="p-2 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto bg-slate-50/70">
                    {CANNED_REPLIES.map((canned, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setReplyText(canned)}
                        className="px-2 py-1 text-[10px] bg-white border border-slate-200 rounded-lg text-slate-700 hover:border-emerald-600 whitespace-nowrap cursor-pointer shrink-0"
                      >
                        {canned.slice(0, 24)}...
                      </button>
                    ))}
                  </div>

                  {/* Reply Input Form */}
                  <form onSubmit={handleSendReply} className="p-3 border-t border-slate-100 flex gap-2">
                    <input
                      type="text"
                      required
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type agent reply..."
                      className="input-atelier text-xs flex-1"
                    />
                    <button
                      type="submit"
                      disabled={replyBusy}
                      className="btn-primary btn-sm shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center p-6 text-slate-400 text-xs">
                  Select a member thread on the left to start responding.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Security & Passkey Management */}
        <div className="space-y-4">
          <div className="surface-card p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <KeyRound className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-bold text-slate-900">Rotate Owner Passkey</h3>
            </div>
            <p className="text-xs text-slate-500">
              The Owner Passkey grants full master console administrative access. Set a secure passphrase (min 6 characters).
            </p>

            <form onSubmit={handleRotatePasskey} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Master Passkey</label>
                <input
                  type="password"
                  required
                  value={newPasskey}
                  onChange={(e) => setNewPasskey(e.target.value)}
                  placeholder="Min 6 characters"
                  className="input-atelier text-xs font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={passkeyBusy}
                className="btn-secondary btn-sm w-full"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{passkeyBusy ? 'Updating...' : 'Update Passkey'}</span>
              </button>
            </form>
          </div>

          <div className="surface-card p-5 space-y-3">
            <div className="flex items-center gap-2 text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">Security Invariants</h3>
            </div>
            <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside">
              <li>Sessions signed using cryptographic HMAC SHA-256 tokens.</li>
              <li>Passwords salted and derived with Scrypt.</li>
              <li>Transient helpline auto-purges messages older than 30 minutes.</li>
              <li>Database state committed atomically to prevent corruption.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
