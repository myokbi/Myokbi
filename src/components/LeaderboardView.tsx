import React, { useEffect, useState } from 'react';
import { Award, Crown, Medal } from 'lucide-react';
import type { MemberStateResponse } from '../types';
import { AvatarImage } from './BrandAssets';

export default function LeaderboardView({ data }: { data: MemberStateResponse }) {
  const [meterValue, setMeterValue] = useState(data.site.config.baseReferralMeter || 18601);
  const [countdownText, setCountdownText] = useState('');

  useEffect(() => {
    function updateTick() {
      const now = new Date();
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const elapsedHours = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60));
      setMeterValue((data.site.config.baseReferralMeter || 18601) + elapsedHours);

      const daysLeft = 7 - (now.getDay() === 0 ? 7 : now.getDay());
      const hoursLeft = 23 - now.getHours();
      const minsLeft = 59 - now.getMinutes();
      setCountdownText(`সাপ্তাহিক ক্যাম্পেইন রোটেশন বাকি: ${daysLeft} দিন ${hoursLeft} ঘণ্টা ${minsLeft} মিনিট`);
    }

    updateTick();
    const timer = setInterval(updateTick, 60000);
    return () => clearInterval(timer);
  }, [data.site.config.baseReferralMeter]);

  const champions = data.site.config.champions;
  const first = champions.find((c) => c.rank === 1) || champions[0];
  const second = champions.find((c) => c.rank === 2) || champions[1];
  const third = champions.find((c) => c.rank === 3) || champions[2];

  const digits = meterValue.toString().padStart(5, '0').split('');

  return (
    <div className="space-y-6">
      {/* Live Referral Counter */}
      <section className="surface-vault p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
          লাইভ রেফারেল প্রোগ্রেস (২৪ ঘণ্টা)
        </p>
        <div className="inline-flex items-center gap-1.5 bg-slate-900 border border-emerald-500/40 rounded-xl px-4 py-2 mt-3">
          {digits.map((d, i) => (
            <span
              key={i}
              className="w-7 h-9 flex items-center justify-center rounded-md bg-[#0b1220] text-emerald-400 font-mono-num text-xl font-bold border border-slate-800"
            >
              {d}
            </span>
          ))}
        </div>
      </section>

      {/* Top 3 Champions Podium */}
      <section className="surface-vault p-6">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            <span>সাপ্তাহিক বিজয়ী</span>
          </h2>
          <p className="text-xs text-emerald-300 mt-1.5 font-medium">{countdownText}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          {/* 2nd Place */}
          {second && (
            <div className="order-2 sm:order-1 bg-slate-900 border border-amber-400/50 rounded-2xl p-5 text-center">
              <div className="flex items-center justify-center gap-1 text-amber-400 text-xs font-bold mb-3">
                <Medal className="w-4 h-4" />
                <span>২য় স্থান · Gold</span>
              </div>
              <AvatarImage
                src={second.photoUrl}
                alt={second.maskedId}
                className="w-16 h-16 rounded-full object-cover mx-auto border-2 border-amber-400 mb-3"
              />
              <p className="text-sm font-bold font-mono-num text-white">{second.maskedId}</p>
              <p className="text-xs text-slate-400 mt-0.5">{second.refers} জন সফল রেফার</p>
              <p className="mt-3 py-1.5 px-3 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-300 text-sm font-bold font-mono-num">
                {second.prizeLabel}
              </p>
            </div>
          )}

          {/* 1st Place */}
          {first && (
            <div className="order-1 sm:order-2 bg-slate-900 border-2 border-emerald-400 rounded-2xl p-6 text-center sm:-translate-y-2">
              <div className="flex items-center justify-center gap-1 text-emerald-400 text-xs font-bold mb-3">
                <Crown className="w-4 h-4" />
                <span>১ম স্থান · Diamond</span>
              </div>
              <AvatarImage
                src={first.photoUrl}
                alt={first.maskedId}
                className="w-20 h-20 rounded-full object-cover mx-auto border-2 border-emerald-400 mb-3"
              />
              <p className="text-base font-bold font-mono-num text-white">{first.maskedId}</p>
              <p className="text-xs text-emerald-300 mt-0.5">{first.refers} জন সফল রেফার</p>
              <p className="mt-3 py-2 px-3 rounded-lg bg-emerald-500/15 border border-emerald-400/50 text-emerald-300 text-base font-bold font-mono-num">
                {first.prizeLabel}
              </p>
            </div>
          )}

          {/* 3rd Place */}
          {third && (
            <div className="order-3 bg-slate-900 border border-slate-700 rounded-2xl p-5 text-center">
              <div className="flex items-center justify-center gap-1 text-slate-300 text-xs font-bold mb-3">
                <Award className="w-4 h-4" />
                <span>৩য় স্থান · Silver</span>
              </div>
              <AvatarImage
                src={third.photoUrl}
                alt={third.maskedId}
                className="w-14 h-14 rounded-full object-cover mx-auto border-2 border-slate-300 mb-3"
              />
              <p className="text-sm font-bold font-mono-num text-white">{third.maskedId}</p>
              <p className="text-xs text-slate-400 mt-0.5">{third.refers} জন সফল রেফার</p>
              <p className="mt-3 py-1.5 px-3 rounded-lg bg-slate-800 border border-slate-600 text-slate-200 text-sm font-bold font-mono-num">
                {third.prizeLabel}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Policy */}
      <section className="surface-card p-5">
        <h3 className="text-sm font-bold text-slate-950 mb-2">ক্যাম্পেইন ও পুরস্কারের নীতিমালা</h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          প্রতিটি সাপ্তাহিক ক্যাম্পেইনে সর্বোচ্চ রেফারকারী <strong className="text-slate-900">শীর্ষ ৩ জন বিজয়ী</strong>{' '}
          সরাসরি ডায়মন্ড, গোল্ড এবং সিলভার ক্যাটাগরিতে পুরস্কৃত হন। প্রতি ৭ দিন পর পর লিডারবোর্ড রিসেট হয় এবং স্বয়ংক্রিয়ভাবে নতুন বিজয়ীদের নাম ও ছবি অ্যাডমিন প্যানেল থেকে আপডেট করা হয়।
        </p>
      </section>
    </div>
  );
}
