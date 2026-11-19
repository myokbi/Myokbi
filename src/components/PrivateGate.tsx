import React, { useState } from 'react';
import { ArrowRight, Link2, Lock } from 'lucide-react';
import { apiRequest, setPrivateToken } from '../lib/api';
import type { AccessStatus } from '../types';
import { MYOKBI_LOGO_URL } from './BrandAssets';

interface PrivateGateProps {
  accessStatus: AccessStatus;
  onUnlocked: () => Promise<void>;
}

export default function PrivateGate({ accessStatus, onUnlocked }: PrivateGateProps) {
  const [inviteInput, setInviteInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleVerifyInvite(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ ok: boolean; privateToken: string }>('/api/access/verify-invite', {
        method: 'POST',
        body: JSON.stringify({ token: inviteInput }),
      });
      setPrivateToken(res.privateToken);
      await onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify invite link.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 sm:p-8" style={{ backgroundColor: 'var(--okb-bg)' }}>
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between gap-8 py-2">
        <span className="text-lg font-bold tracking-tight whitespace-nowrap shrink-0" style={{ color: 'var(--okb-text)' }}>
          {accessStatus.siteName}
        </span>
        <div className="flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
          <Lock className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--okb-primary)' }} />
          <span>Invite-Only Member Portal</span>
        </div>
      </header>

      <main className="max-w-5xl w-full mx-auto my-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch gap-6">
          {/* Left Obsidian Showcase Panel */}
          <section className="lg:col-span-5 surface-vault p-7 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 p-1.5 flex items-center justify-center mb-6">
                <img
                  src={MYOKBI_LOGO_URL}
                  alt={accessStatus.siteName}
                  className="w-full h-full rounded-xl object-cover"
                />
              </div>
              <p className="text-xs font-semibold text-emerald-400">Private Network</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mt-2 leading-tight">
                Authorized Member Workspace
              </h1>
              <p className="text-sm text-slate-300 mt-3 leading-relaxed">
                Enter your private invite link or code to sign in, complete published tasks, and trade inside the {accessStatus.siteName} currency network.
              </p>
            </div>

            <div className="pt-6 mt-8 border-t border-white/10 grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-slate-400">Access Policy</p>
                <p className="text-white font-semibold mt-0.5">Invite-Only Gate</p>
              </div>
              <div>
                <p className="text-slate-400">Internal Exchange</p>
                <p className="text-emerald-400 font-semibold mt-0.5">1 USD = 122 BDT</p>
              </div>
            </div>
          </section>

          {/* Right Invite Verification Card */}
          <section className="lg:col-span-7 surface-card p-6 sm:p-8 flex flex-col justify-center">
            <div className="mb-6">
              <div className="flex items-center gap-2 text-xs font-semibold mb-1.5" style={{ color: 'var(--okb-primary)' }}>
                <Link2 className="w-4 h-4 shrink-0" />
                <span>Private Invite Verification</span>
              </div>
              <h2 className="text-xl font-bold" style={{ color: 'var(--okb-text)' }}>
                Unlock Member Portal
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Paste the shareable invite link or code provided to you to access your account.
              </p>
            </div>

            <form onSubmit={handleVerifyInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Private Invite Link or Code
                </label>
                <input
                  type="text"
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  placeholder="Paste private link or code (e.g. OKB-XXXX)"
                  className="input-atelier font-mono-num"
                  required
                />
              </div>

              {error && (
                <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} className="btn-obsidian w-full group">
                <span>{loading ? 'Verifying Access...' : 'Unlock Member Portal'}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>
          </section>
        </div>
      </main>

      <footer className="max-w-5xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 py-2">
        <div>
          <span>{accessStatus.siteName}</span>
          <span className="mx-2">·</span>
          <span>{accessStatus.tagline}</span>
        </div>
        <a
          href="/admin"
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-400 hover:text-slate-700 transition-colors"
        >
          Owner Admin Browser (/admin) →
        </a>
      </footer>
    </div>
  );
}
