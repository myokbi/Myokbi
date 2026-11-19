import React, { useEffect, useState } from 'react';
import { ArrowRight, MapPin, UserCheck } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { DistrictAgentItem, MemberStateResponse } from '../types';
import { StatusText } from './BrandAssets';

interface AgentWithdrawViewProps {
  data: MemberStateResponse;
  onRefresh: () => Promise<void>;
}

export default function AgentWithdrawView({ data, onRefresh }: AgentWithdrawViewProps) {
  const [districts, setDistricts] = useState<DistrictAgentItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<string>('');
  const [method, setMethod] = useState<'bKash' | 'Nagad' | 'Rocket'>('bKash');
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    apiRequest<{ districts: DistrictAgentItem[] }>('/api/districts')
      .then((res) => setDistricts(res.districts))
      .catch(() => {});
  }, []);

  const matchedAgent = selectedIndex !== '' ? districts[Number(selectedIndex)] : null;
  const agentWithdraws = data.withdraws.filter((w) => w.type === 'agent');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!matchedAgent) {
      setFeedback({ type: 'err', text: 'দয়া করে আপনার জেলা নির্বাচন করুন।' });
      return;
    }

    setFeedback(null);
    setLoading(true);
    try {
      await apiRequest('/api/withdraws', {
        method: 'POST',
        body: JSON.stringify({
          type: 'agent',
          district: matchedAgent.district,
          agentName: matchedAgent.agent,
          method,
          accountNumber,
          amount: Number(amount),
        }),
      });
      setSelectedIndex('');
      setAccountNumber('');
      setAmount('');
      setFeedback({
        type: 'ok',
        text: `সফলভাবে উইথড্র রিকোয়েস্ট সাবমিট হয়েছে! জেলা: ${matchedAgent.district}, এজেন্ট: ${matchedAgent.agent}`,
      });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'উইথড্র করতে সমস্যা হয়েছে।' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="surface-vault p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-400">এজেন্ট উইথড্র সেন্টার · আপনার মেইন ব্যালেন্স</p>
          <p className="text-2xl font-bold text-emerald-400 font-mono-num mt-1">
            {data.user.balance.toFixed(2)} ৳
          </p>
        </div>
        <span className="text-xs font-medium text-slate-300">
          ৬৪ জেলার অনুমোদিত এজেন্ট নেটওয়ার্ক ({districts.length} জেলা)
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 surface-card p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-950">এজেন্টের মাধ্যমে উইথড্র করুন</h3>
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                আপনার জেলা নির্বাচন করুন
              </label>
              <select
                value={selectedIndex}
                onChange={(e) => setSelectedIndex(e.target.value)}
                className="input-atelier"
                required
              >
                <option value="">জেলা সিলেক্ট করুন</option>
                {districts.map((item, idx) => (
                  <option key={item.district} value={idx}>
                    {item.district}
                  </option>
                ))}
              </select>
            </div>

            {matchedAgent && (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 border-b border-emerald-200 pb-1.5">
                  <UserCheck className="w-4 h-4" />
                  <span>নিযুক্ত এলাকার তথ্য</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> নির্বাচিত জেলা:
                  </span>
                  <strong className="text-slate-900">{matchedAgent.district}</strong>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">দায়িত্বরত এজেন্ট:</span>
                  <strong className="text-emerald-800">{matchedAgent.agent}</strong>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">উইথড্র মাধ্যম</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as 'bKash' | 'Nagad' | 'Rocket')}
                className="input-atelier"
              >
                <option value="bKash">বিকাশ (bKash)</option>
                <option value="Nagad">নগদ (Nagad)</option>
                <option value="Rocket">রকেট (Rocket)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                একাউন্ট নাম্বার (পেমেন্ট নম্বর)
              </label>
              <input
                type="tel"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="যেমন: 017xxxxxxxx"
                className="input-atelier font-mono-num"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                টাকার পরিমাণ (সর্বনিম্ন {data.site.config.rates.minAgentWithdraw} ৳)
              </label>
              <input
                type="number"
                min={data.site.config.rates.minAgentWithdraw}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`সর্বনিম্ন ${data.site.config.rates.minAgentWithdraw} ৳`}
                className="input-atelier font-mono-num"
                required
              />
            </div>

            {feedback && (
              <p
                className={`text-xs rounded-xl px-3.5 py-2.5 border ${
                  feedback.type === 'ok'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {feedback.text}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full group">
              <span>{loading ? 'প্রক্রিয়াধীন...' : 'উইথড্র কনফার্ম করুন'}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>
        </section>

        <section className="lg:col-span-6 surface-card p-5 sm:p-6">
          <h3 className="text-base font-bold text-slate-950 mb-3">আপনার এজেন্ট উইথড্র স্ট্যাটাস</h3>
          {agentWithdraws.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">কোনো এজেন্ট উইথড্র হিস্ট্রি নেই</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {agentWithdraws.map((w) => (
                <div key={w.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      <span className="font-mono-num">{w.amount} ৳</span> · {w.method}
                    </p>
                    <p className="text-xs text-slate-500">
                      জেলা: {w.district} · এজেন্ট: {w.agentName}
                    </p>
                  </div>
                  <StatusText status={w.status} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
