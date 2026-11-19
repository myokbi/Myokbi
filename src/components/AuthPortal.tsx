import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { apiRequest, setUserToken } from '../lib/api';
import { MYOKBI_LOGO_URL } from './BrandAssets';

interface AuthPortalProps {
  siteName: string;
  tagline: string;
  initialReferCode?: string;
  onSuccess: () => Promise<void>;
}

export default function AuthPortal({
  siteName,
  tagline,
  initialReferCode = '',
  onSuccess,
}: AuthPortalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialReferCode ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState(initialReferCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ ok: boolean; userToken: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setUserToken(res.userToken);
      await onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ ok: boolean; userToken: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, phone, password, referralCode }),
      });
      setUserToken(res.userToken);
      await onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 sm:p-8" style={{ backgroundColor: 'var(--okb-bg)' }}>
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between gap-8 py-2">
        <span className="text-lg font-bold tracking-tight whitespace-nowrap shrink-0" style={{ color: 'var(--okb-text)' }}>
          {siteName}
        </span>
        <span className="text-xs text-slate-500 font-medium">Member App</span>
      </header>

      <main className="max-w-md w-full mx-auto my-8">
        <div className="surface-card p-6 sm:p-8">
          <div className="text-center mb-6">
            <div
              className="w-16 h-16 rounded-2xl p-1.5 mx-auto mb-3.5 shadow-sm"
              style={{ backgroundColor: 'var(--okb-vault)' }}
            >
              <img
                src={MYOKBI_LOGO_URL}
                alt={siteName}
                className="w-full h-full rounded-xl object-cover"
              />
            </div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--okb-text)' }}>
              {siteName} Member Portal
            </h1>
            <p className="text-xs text-slate-500 mt-1">{tagline}</p>
          </div>

          <div className="segment-track grid-cols-2 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`segment-btn ${mode === 'login' ? 'segment-btn-active' : 'segment-btn-idle'}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`segment-btn ${mode === 'register' ? 'segment-btn-active' : 'segment-btn-idle'}`}
            >
              Registration
            </button>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="input-atelier"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="input-atelier"
                  required
                />
              </div>
              {error && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                  {error}
                </p>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full group">
                <span>{loading ? 'Signing in...' : 'Login Now'}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="input-atelier"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="input-atelier"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="input-atelier font-mono-num"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className="input-atelier"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Referral Code (Optional)</label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  placeholder="OKB-M123456"
                  className="input-atelier font-mono-num"
                />
              </div>
              {error && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                  {error}
                </p>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full group">
                <span>{loading ? 'Creating Account...' : 'Complete Registration'}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>
          )}
        </div>
      </main>

      <footer className="max-w-5xl w-full mx-auto text-center text-xs text-slate-500 py-2">
        <span>Secured by Myokbi Private Server</span>
      </footer>
    </div>
  );
}
