import React, { useState } from 'react';
import type { MemberStateResponse } from '../types';
import { StatusText } from './BrandAssets';

type HistoryTab = 'deposit' | 'withdraw' | 'work' | 'ads' | 'p2p' | 'refer';

export default function HistoryView({ data }: { data: MemberStateResponse }) {
  const [tab, setTab] = useState<HistoryTab>('deposit');
  const cutoff = data.sevenDayFilterCutoff;

  const recentDeposits = data.deposits.filter((d) => d.timestamp >= cutoff);
  const recentWithdraws = data.withdraws.filter((w) => w.timestamp >= cutoff);
  const recentWorks = data.workSubmissions.filter((w) => w.timestamp >= cutoff);
  const recentAds = (data.adWatchLogs || []).filter((a) => a.timestamp >= cutoff);
  const recentP2P = data.p2pTransactions.filter((t) => t.timestamp >= cutoff);
  const recentRefers = data.referredUsers.filter((r) => r.createdAt >= cutoff);

  const tabs: Array<{ id: HistoryTab; label: string; count: number }> = [
    { id: 'deposit', label: 'Deposit', count: recentDeposits.length },
    { id: 'withdraw', label: 'Withdraw', count: recentWithdraws.length },
    { id: 'work', label: 'Work Tasks', count: recentWorks.length },
    { id: 'ads', label: 'Video Ads', count: recentAds.length },
    { id: 'p2p', label: 'P2P Transfer', count: recentP2P.length },
    { id: 'refer', label: 'Referral Log', count: recentRefers.length },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-700">
        এখানে বিগত ৭ দিনের সমস্ত ট্রানজেকশন ও কাজের বিবরণ রিয়েল-টাইম সার্ভার থেকে দেখানো হচ্ছে।
      </div>

      <div className="flex flex-wrap gap-1.5 p-1 bg-slate-200/75 border border-slate-200 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`segment-btn ${tab === t.id ? 'segment-btn-active' : 'segment-btn-idle'}`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <section className="surface-card p-5">
        {tab === 'deposit' && (
          recentDeposits.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No deposit history in last 7 days.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentDeposits.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.gateway} · <span className="font-mono-num">{item.amount} BDT</span>
                    </p>
                    <p className="text-xs text-slate-500 font-mono-num">
                      Trx: {item.trxId} · {new Date(item.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusText status={item.status} />
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'withdraw' && (
          recentWithdraws.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No withdraw history in last 7 days.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentWithdraws.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.method} · <span className="font-mono-num">{item.amount} BDT</span>
                    </p>
                    <p className="text-xs text-slate-500 font-mono-num">
                      Acc: {item.accountNumber} · {new Date(item.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusText status={item.status} />
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'work' && (
          recentWorks.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No work history in last 7 days.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentWorks.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={item.sheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-emerald-800 hover:underline truncate block"
                    >
                      {item.category} Sheet Task
                    </a>
                    <p className="text-xs text-slate-500 font-mono-num">
                      Reward: +{item.reward} BDT · {new Date(item.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusText status={item.status} />
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'ads' && (
          recentAds.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No video ad views in last 7 days.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentAds.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {item.adId} · {item.companyName} ({item.networkName})
                    </p>
                    <p className="text-xs text-slate-500 font-mono-num">
                      {item.durationSeconds}s Non-Skippable · {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-sm font-bold font-mono-num text-emerald-700 shrink-0">
                    +{Number(item.rewardBdt).toFixed(2)} BDT
                  </span>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'p2p' && (
          recentP2P.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No P2P transfers in last 7 days.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentP2P.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.senderCode} → {item.recipientCode}
                    </p>
                    <p className="text-xs text-slate-500 font-mono-num">
                      {item.trxId} · {new Date(item.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-sm font-bold font-mono-num text-slate-900">
                    {item.totalDeduction} BDT
                  </span>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'refer' && (
          recentRefers.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No referral logs in last 7 days.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentRefers.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500 font-mono-num">
                      {item.id} · {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 font-mono-num">
                    +{data.site.config.rates.referralSignupBonus} BDT
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </section>
    </div>
  );
}
