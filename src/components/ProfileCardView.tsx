import React, { useRef, useState } from 'react';
import {
  ArrowUpRight,
  Award,
  Briefcase,
  Camera,
  Check,
  Copy,
  CreditCard,
  Gift,
  Headphones,
  History,
  Link2,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { resolveUiCopy } from '../lib/theme';
import type { MemberPage, MemberStateResponse } from '../types';
import { AvatarImage, StatusText } from './BrandAssets';

interface ProfileCardViewProps {
  data: MemberStateResponse;
  onNavigate: (page: MemberPage) => void;
  onRefresh?: () => Promise<void>;
}

async function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const size = 360;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function ProfileCardView({ data, onNavigate, onRefresh }: ProfileCardViewProps) {
  const { user, site } = data;
  const copy = resolveUiCopy(site.config.copy);
  const usdRateBdt = site.config.rates.usdRateBdt || 122;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const absolutePhotoLink =
    typeof window !== 'undefined' && user.photoUrl.startsWith('/')
      ? `${window.location.origin}${user.photoUrl}`
      : user.photoUrl;

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    setUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const res = await apiRequest<{ ok: boolean; photoUrl: string }>('/api/member/photo', {
        method: 'POST',
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      setFeedback({
        type: 'ok',
        text: `Photo uploaded and linked to your ID card (${res.photoUrl})!`,
      });
      await onRefresh?.();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to upload photo.',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleLinkUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!customUrl.trim()) return;
    setFeedback(null);
    setUploading(true);
    try {
      await apiRequest('/api/member/photo', {
        method: 'POST',
        body: JSON.stringify({ photoUrl: customUrl.trim() }),
      });
      setCustomUrl('');
      setFeedback({ type: 'ok', text: 'Photo URL linked to your ID card!' });
      await onRefresh?.();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Invalid photo URL.',
      });
    } finally {
      setUploading(false);
    }
  }

  function handleCopyPhotoLink() {
    navigator.clipboard.writeText(absolutePhotoLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Futuristic Linked Member ID Card */}
        <section className="lg:col-span-6 surface-vault p-6 space-y-5 relative overflow-hidden border border-emerald-500/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold tracking-widest uppercase text-emerald-400">
                {copy.idCardHeaderTitle}
              </span>
            </div>
            <span className="text-xs font-semibold text-amber-300">{user.level}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <AvatarImage
                src={user.photoUrl}
                alt={user.name}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-400 shadow-lg"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Upload New ID Photo"
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center border border-slate-900 shadow cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white truncate">{user.name}</h2>
              <p className="text-xs text-slate-300 truncate">{user.email}</p>
              <p className="text-xs text-slate-300 font-mono-num mt-0.5">{user.phone}</p>
              <p className="text-[11px] text-emerald-300 font-mono-num mt-1">
                Refer: {user.referCode}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10 text-xs">
            <div>
              <p className="text-slate-400">Member ID</p>
              <p className="font-bold font-mono-num text-white mt-0.5">{user.id}</p>
            </div>
            <div>
              <p className="text-slate-400">Main Balance</p>
              <p className="font-bold font-mono-num text-emerald-400 mt-0.5">
                ৳{user.balance.toFixed(2)}
              </p>
              <p className="text-[10px] text-slate-400 font-mono-num">
                ${(user.balance / usdRateBdt).toFixed(2)} USD
              </p>
            </div>
            <div>
              <p className="text-slate-400">Account Status</p>
              <div className="mt-0.5">
                <StatusText status={user.status} />
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2 min-w-0">
              <Link2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate font-mono-num text-slate-300">{absolutePhotoLink}</span>
            </div>
            <button
              type="button"
              onClick={handleCopyPhotoLink}
              className="text-emerald-300 hover:text-white font-semibold shrink-0 flex items-center gap-1 cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </section>

        {/* Photo Upload & Metrics Panel */}
        <section className="lg:col-span-6 space-y-4">
          <div className="surface-card p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-950">Upload &amp; Link ID Card Photo</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload your portrait photo — it links directly to a hosted URL and renders on your Future ID Card.
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileSelected}
              className="hidden"
            />

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn-primary btn-sm"
              >
                <Upload className="w-4 h-4" />
                <span>{uploading ? 'Uploading...' : 'Upload Photo from Device'}</span>
              </button>
            </div>

            <form onSubmit={handleLinkUrl} className="flex gap-2">
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="Or paste image URL (https://...)"
                className="input-atelier text-xs flex-1"
              />
              <button type="submit" disabled={uploading || !customUrl.trim()} className="btn-secondary btn-sm">
                Link URL
              </button>
            </form>

            {feedback && (
              <p
                className={`text-xs rounded-xl px-3.5 py-2 border ${
                  feedback.type === 'ok'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {feedback.text}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="surface-card p-4">
              <p className="text-xs text-slate-500">{copy.mainBalanceLabel}</p>
              <p className="text-xl font-bold text-slate-950 font-mono-num mt-1">
                ৳{user.balance.toFixed(2)}
              </p>
              <p className="text-[11px] text-slate-500 font-mono-num">
                ${(user.balance / usdRateBdt).toFixed(2)} USD
              </p>
            </div>
            <div className="surface-card p-4">
              <p className="text-xs text-slate-500">Today&apos;s Earn (24H)</p>
              <p className="text-xl font-bold text-emerald-700 font-mono-num mt-1">
                ৳{user.todayEarn.toFixed(2)}
              </p>
            </div>
            <div className="surface-card p-4">
              <p className="text-xs text-slate-500">Completed Task</p>
              <p className="text-xl font-bold text-slate-950 font-mono-num mt-1">
                {user.completedTasks}
              </p>
            </div>
            <div className="surface-card p-4">
              <p className="text-xs text-slate-500">Referral Bonus</p>
              <p className="text-xl font-bold text-amber-700 font-mono-num mt-1">
                ৳{user.referralBonus.toFixed(2)}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Quick Navigation Shortcuts */}
      <section className="surface-card p-5">
        <h3 className="text-sm font-bold text-slate-950 mb-3.5">Quick Shortcuts</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { id: 'leader' as MemberPage, label: copy.workerListBtnLabel, icon: <Award className="w-4 h-4 text-amber-600" /> },
            { id: 'history' as MemberPage, label: copy.historyBtnLabel, icon: <History className="w-4 h-4 text-slate-700" /> },
            { id: 'helpline' as MemberPage, label: copy.helplineBtnLabel, icon: <Headphones className="w-4 h-4 text-emerald-700" /> },
            { id: 'work' as MemberPage, label: copy.myJobsBtnLabel, icon: <Briefcase className="w-4 h-4 text-slate-700" /> },
            { id: 'deposit-withdraw' as MemberPage, label: copy.depositWithdrawBtnLabel, icon: <CreditCard className="w-4 h-4 text-emerald-700" /> },
            { id: 'refer' as MemberPage, label: copy.referBtnLabel, icon: <Gift className="w-4 h-4 text-amber-600" /> },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className="btn-secondary min-h-[50px] justify-between px-3.5 group"
            >
              <span className="flex items-center gap-2 truncate">
                {item.icon}
                <span className="truncate">{item.label}</span>
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 shrink-0" />
            </button>
          ))}
        </div>
      </section>

      <footer className="surface-card p-5 text-center">
        <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
          {copy.footerAboutTitle}
        </h4>
        <p className="text-xs text-slate-600 mt-1.5 max-w-xl mx-auto leading-relaxed">
          {copy.footerAboutText}
        </p>
      </footer>
    </div>
  );
}
