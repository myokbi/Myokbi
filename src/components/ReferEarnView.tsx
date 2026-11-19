import React, { useState } from 'react';
import { Check, ClipboardPaste, Copy, Gift, Users } from 'lucide-react';
import type { MemberStateResponse } from '../types';

export default function ReferEarnView({ data }: { data: MemberStateResponse }) {
  const { user, referredUsers, site } = data;
  const [copiedCode, setCopiedCode] = useState(false);
  const [pastedCode, setPastedCode] = useState('');

  const totalReferred = referredUsers.length;
  const giftProgress = Math.min(totalReferred, 20);
  const commissionPerRefer = site.config.rates.referralCommission;

  function handleCopy() {
    navigator.clipboard?.writeText(user.referCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  async function handlePaste() {
    try {
      const txt = await navigator.clipboard.readText();
      setPastedCode(txt);
    } catch {
      // ignore permission block
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="surface-vault p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
          <Users className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold">বন্ধুদের রেফার করুন</h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
            প্রতি সফল রেফারে নিশ্চিত আয় করুন · যত বেশি রেফার তত বেশি বোনাস
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: User Details & Code Copy */}
        <div className="lg:col-span-6 space-y-5">
          <section className="surface-card p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-950">ইউজার ডিটেলস</h3>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">User UID</span>
                <strong className="font-mono-num text-slate-900">{user.id}</strong>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Name</span>
                <strong className="text-slate-900">{user.name}</strong>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Email</span>
                <strong className="text-slate-900">{user.email}</strong>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Phone Number</span>
                <strong className="font-mono-num text-slate-900">{user.phone}</strong>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Account Status</span>
                <strong className="text-emerald-700">{user.status}</strong>
              </div>
            </div>
          </section>

          <section className="surface-card p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-950 mb-2">My Refer Code</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={user.referCode}
                  aria-label="My Refer Code"
                  className="input-atelier font-mono-num font-bold text-emerald-800 text-center"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="btn-primary px-4"
                >
                  {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-950 mb-2">New Member Refer Code Helper</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pastedCode}
                  onChange={(e) => setPastedCode(e.target.value)}
                  placeholder="Refer code paste করুন"
                  className="input-atelier font-mono-num"
                />
                <button
                  type="button"
                  onClick={handlePaste}
                  className="btn-obsidian px-4"
                >
                  <ClipboardPaste className="w-4 h-4" />
                  <span>Paste</span>
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right: Stats, 750 Commission, 20 Refer Gate & List */}
        <div className="lg:col-span-6 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="surface-card p-4 text-center">
              <p className="text-[11px] text-slate-500">Total Refer</p>
              <p className="text-xl font-bold text-slate-950 font-mono-num mt-1">{totalReferred}</p>
            </div>
            <div className="surface-card p-4 text-center">
              <p className="text-[11px] text-slate-500">Successful</p>
              <p className="text-xl font-bold text-emerald-700 font-mono-num mt-1">{totalReferred}</p>
            </div>
            <div className="surface-card p-4 text-center">
              <p className="text-[11px] text-slate-500">Per Refer</p>
              <p className="text-xl font-bold text-amber-700 font-mono-num mt-1">{commissionPerRefer} ৳</p>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-950">রেফার কমিশন বোনাস</h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                প্রতি সফল রেফারেল = {commissionPerRefer} টাকা
              </p>
            </div>
            <span className="text-lg font-bold text-emerald-800 font-mono-num shrink-0">
              {commissionPerRefer} ৳
            </span>
          </div>

          <div className="surface-vault p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-300">
                  {totalReferred >= 20 ? '২০ জন রেফার সম্পন্ন!' : '২০ জন রেফার স্পেশাল গিফট'}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  ২০ জন সফল রেফার সম্পন্ন করলে বিশেষ প্রমোশন ও লিডারশিপ পুরস্কার
                </p>
              </div>
            </div>
            <div className="text-sm font-bold text-amber-300 font-mono-num shrink-0">
              {giftProgress} / 20
            </div>
          </div>

          <section className="surface-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-950">আমার রেফারের তালিকা</h3>
              <span className="text-xs text-slate-500 font-mono-num">{totalReferred} members</span>
            </div>

            {referredUsers.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                এখনো কোনো রেফার করা হয়নি। আপনার কোডটি শেয়ার করুন!
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {referredUsers.map((ru) => (
                  <div key={ru.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{ru.name}</p>
                      <p className="text-xs text-slate-500 font-mono-num">{ru.id}</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 font-mono-num">
                      +{site.config.rates.referralSignupBonus} ৳
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
