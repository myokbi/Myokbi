import React, { useState } from 'react';
import { ArrowRight, ArrowUpRight, Info } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { MemberStateResponse } from '../types';

interface P2PTransferViewProps {
  data: MemberStateResponse;
  onRefresh: () => Promise<void>;
}

export default function P2PTransferView({ data, onRefresh }: P2PTransferViewProps) {
  const [recipientCode, setRecipientCode] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const { p2pMin, p2pMax, p2pFeePerThousand } = data.site.config.rates;
  const numericAmount = Number(amount || 0);
  const computedFee = numericAmount > 0 ? (numericAmount / 1000) * p2pFeePerThousand : 0;
  const totalDeduction = numericAmount + computedFee;

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ ok: boolean; transaction: { trxId: string } }>('/api/p2p/send', {
        method: 'POST',
        body: JSON.stringify({ recipientCode, amount: numericAmount }),
      });
      setRecipientCode('');
      setAmount('');
      setFeedback({ type: 'ok', text: `Transfer Successful! TRX ID: ${res.transaction.trxId}` });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Transfer failed.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="surface-vault p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">Available Main Balance</p>
          <p className="text-2xl font-bold text-emerald-400 font-mono-num mt-1">
            {data.user.balance.toFixed(2)} BDT
          </p>
        </div>
        <div className="text-xs text-slate-300">
          Your Refer Code: <strong className="text-white font-mono-num">{data.user.referCode}</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 surface-card p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-950">Send Money to Member (P2P)</h3>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
            <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <p>
              সর্বনিম্ন <strong className="font-mono-num text-slate-950">{p2pMin.toLocaleString()}</strong> টাকা থেকে সর্বোচ্চ{' '}
              <strong className="font-mono-num text-slate-950">{p2pMax.toLocaleString()}</strong> টাকা পর্যন্ত পাঠানো যাবে। প্রতি হাজারে{' '}
              <strong className="font-mono-num text-slate-950">{p2pFeePerThousand} টাকা</strong> সার্ভিস চার্জ প্রযোজ্য।
            </p>
          </div>

          <form onSubmit={handleTransfer} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Recipient Referral Code
              </label>
              <input
                type="text"
                value={recipientCode}
                onChange={(e) => setRecipientCode(e.target.value)}
                placeholder="e.g. OKB-M123456"
                className="input-atelier font-mono-num"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (BDT)</label>
              <input
                type="number"
                min={p2pMin}
                max={p2pMax}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Min ${p2pMin} to Max ${p2pMax}`}
                className="input-atelier font-mono-num"
                required
              />
            </div>

            {numericAmount > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Service Charge:</span>
                  <span className="font-mono-num font-semibold">{computedFee.toFixed(2)} BDT</span>
                </div>
                <div className="flex justify-between text-slate-950 font-bold">
                  <span>Total Deduction:</span>
                  <span className="font-mono-num">{totalDeduction.toFixed(2)} BDT</span>
                </div>
              </div>
            )}

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
              <span>{loading ? 'Processing Transfer...' : 'Transfer Money Now'}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>
        </section>

        <section className="lg:col-span-6 surface-card p-5 sm:p-6">
          <h3 className="text-base font-bold text-slate-950 mb-3">P2P Transaction History</h3>
          {data.p2pTransactions.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No P2P transactions yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.p2pTransactions.map((trx) => {
                const isIncoming = trx.recipientId === data.user.id;
                return (
                  <div key={trx.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                        <ArrowUpRight
                          className={`w-3.5 h-3.5 ${isIncoming ? 'rotate-180 text-emerald-600' : 'text-red-600'}`}
                        />
                        <span>
                          {isIncoming ? `From ${trx.senderCode}` : `To ${trx.recipientCode}`}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500 font-mono-num">
                        {trx.trxId} · {new Date(trx.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-bold font-mono-num ${
                          isIncoming ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {isIncoming ? `+${trx.amount}` : `-${trx.totalDeduction}`} BDT
                      </p>
                      {!isIncoming && (
                        <p className="text-[11px] text-slate-500 font-mono-num">Fee: {trx.serviceCharge} BDT</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
