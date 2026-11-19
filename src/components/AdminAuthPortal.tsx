import React, { useState } from 'react';
import { ArrowRight, ExternalLink, KeyRound, ShieldCheck } from 'lucide-react';
import { apiRequest, setAdminToken, setPrivateToken } from '../lib/api';
import type { AccessStatus } from '../types';
import { MYOKBI_LOGO_URL } from './BrandAssets';

interface AdminAuthPortalProps {
  accessStatus: AccessStatus;
  onAuthenticated: () => Promise<void>;
}

export default function AdminAuthPortal({ accessStatus, onAuthenticated }: AdminAuthPortalProps) {
  const [passkey, setPasskey] = useState('');
  const [confirmPasskey, setConfirmPasskey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!accessStatus.adminInitialized && passkey !== confirmPasskey) {
      setError('Passkeys do not match.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = accessStatus.adminInitialized ? '/api/admin/login' : '/api/admin/setup';
      const res = await apiRequest<{ ok: boolean; adminToken: string; privateToken: string }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ passkey }),
      });
      setAdminToken(res.adminToken);
      setPrivateToken(res.privateToken);
      await onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1220] text-slate-100 flex flex-col justify-between p-4 sm:p-8">
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between gap-6 py-2">
        <div className="flex items-center gap-3">
          <img
            src={MYOKBI_LOGO_URL}
            alt={accessStatus.siteName}
            className="w-9 h-9 rounded-xl object-cover border border-emerald-500/40"
          />
          <div>
            <span className="text-base font-bold tracking-tight text-white">
              {accessStatus.siteName} Admin Server
            </span>
            <p className="text-[11px] text-emerald-400">Dedicated Owner Browser Console</p>
          </div>
        </div>

        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 inline-flex items-center gap-2 transition-colors"
        >
          <span>Open User App</span>
          <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
        </a>
      </header>

      <main className="max-w-md w-full mx-auto my-8">
        <div className="bg-white text-slate-900 rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-[#0b1220] text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-950">Owner Management Console</h1>
              <p className="text-xs text-slate-500">
                {accessStatus.adminInitialized
                  ? 'Sign in with your Owner Passkey to manage the live network.'
                  : 'First-time setup: Create your Owner Server Passkey.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {accessStatus.adminInitialized ? 'Owner Server Passkey' : 'Set Owner Passkey (min 6 chars)'}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  value={passkey}
                  onChange={(e) => setPasskey(e.target.value)}
                  placeholder="Enter owner passkey"
                  className="input-atelier pl-10"
                  required
                />
              </div>
            </div>

            {!accessStatus.adminInitialized && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm Owner Passkey
                </label>
                <input
                  type="password"
                  value={confirmPasskey}
                  onChange={(e) => setConfirmPasskey(e.target.value)}
                  placeholder="Re-enter passkey"
                  className="input-atelier"
                  required
                />
              </div>
            )}

            {error && (
              <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full group">
              <span>
                {loading
                  ? 'Authenticating...'
                  : accessStatus.adminInitialized
                  ? 'Unlock Admin Dashboard'
                  : 'Initialize Passkey & Enter'}
              </span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Admin URL: /admin</span>
            <span>User App URL: /</span>
          </div>
        </div>
      </main>

      <footer className="max-w-5xl w-full mx-auto text-center text-xs text-slate-400 py-2">
        <span>{accessStatus.siteName} Server Control</span>
        <span className="mx-2">·</span>
        <span>Isolated Admin Browser Mode</span>
      </footer>
    </div>
  );
}
