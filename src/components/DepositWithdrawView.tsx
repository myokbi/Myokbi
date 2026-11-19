import React, { useState } from 'react';
import { ArrowRight, Check, CheckCircle2, Copy } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { MemberStateResponse } from '../types';
import { GatewayMark, StatusText } from './BrandAssets';

interface DepositWithdrawViewProps {
  data: MemberStateResponse;
  onRefresh: () => Promise<void>;
}

export default function DepositWithdrawView({ data, onRefresh }: DepositWithdrawViewProps) {
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [gateway, setGateway] = useState<'bKash' | 'Nagad' | 'Rocket' | 'USDT'>('bKash');
  const [senderNumber, setSenderNumber] = useState('');
  const [trxId, setTrxId] = useState('');
  const [depAmount, setDepAmount] = useState('');

  const [witMethod, setWitMethod] = useState<'bKash' | 'Nagad' | 'Rocket'>('bKash');
  const [witAccount, setWitAccount] = useState('');
  const [witAmount, setWitAmount] = useState('');

  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const receivingNumber = data.site.config.adminNumbers[gateway] || 'Not Configured';

  function handleCopyReceiving() {
    navigator.clipboard?.writeText(receivingNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setLoading(true);
    try {
      await apiRequest('/api/deposits', {
        method: 'POST',
        body: JSON.stringify({
          gateway,
          senderNumber,
          trxId,
          amount: Number(depAmount),
        }),
      });
      setSenderNumber('');
      setTrxId('');
      setDepAmount('');
      setFeedback({ type: 'ok', text: 'Deposit request submitted successfully! Waiting for admin approval.' });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Deposit submission failed.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setLoading(true);
    try {
      await apiRequest('/api/withdraws', {
        method: 'POST',
        body: JSON.stringify({
          type: 'standard',
          method: witMethod,
          accountNumber: witAccount,
          amount: Number(witAmount),
        }),
      });
      setWitAccount('');
      setWitAmount('');
      setFeedback({ type: 'ok', text: 'Withdrawal request submitted successfully!' });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Withdrawal failed.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Dual Balance Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="surface-vault p-5">
          <p className="text-xs text-slate-400">Main Balance</p>
          <p className="text-2xl font-bold text-emerald-400 font-mono-num mt-1">
            {data.user.balance.toFixed(2)} BDT
          </p>
        </div>
        <div className="surface-card p-5">
          <p className="text-xs text-slate-500">Deposit Balance</p>
          <p className="text-2xl font-bold text-slate-950 font-mono-num mt-1">
            {data.user.depositBalance.toFixed(2)} BDT
          </p>
        </div>
      </div>

      {/* Portal Switch */}
      <div className="segment-track grid-cols-2 max-w-md">
        <button
          type="button"
          onClick={() => {
            setTab('deposit');
            setFeedback(null);
          }}
          className={`segment-btn ${tab === 'deposit' ? 'segment-btn-active' : 'segment-btn-idle'}`}
        >
          Deposit Portal
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('withdraw');
            setFeedback(null);
          }}
          className={`segment-btn ${tab === 'withdraw' ? 'segment-btn-active' : 'segment-btn-idle'}`}
        >
          Withdraw Portal
        </button>
      </div>

      {tab === 'deposit' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-6 surface-card p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-950">Add Fund via Deposit</h3>

            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">Select Payment Method</p>
              <div className="grid grid-cols-4 gap-2.5">
                {(['bKash', 'Nagad', 'Rocket', 'USDT'] as const).map((gw) => {
                  const selected = gateway === gw;
                  return (
                    <button
                      key={gw}
                      type="button"
                      onClick={() => setGateway(gw)}
                      className={`relative min-h-[78px] p-2 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer active:scale-[0.98] ${
                        selected
                          ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-400'
                      }`}
                    >
                      {selected && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 absolute top-1.5 right-1.5" />
                      )}
                      <GatewayMark gateway={gw} />
                      <span className="text-[11px] font-bold text-slate-900">{gw}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] text-slate-500 font-semibold">{gateway} Receiving Address</p>
                <p className="text-sm font-bold text-slate-950 font-mono-num truncate">{receivingNumber}</p>
              </div>
              <button
                type="button"
                onClick={handleCopyReceiving}
                className={copied ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <form onSubmit={handleDeposit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Sender Number / Wallet</label>
                <input
                  type="text"
                  value={senderNumber}
                  onChange={(e) => setSenderNumber(e.target.value)}
                  placeholder="e.g. 017XXXXXXXX"
                  className="input-atelier"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Transaction ID (TrxID)</label>
                <input
                  type="text"
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value)}
                  placeholder="Enter valid TrxID"
                  className="input-atelier font-mono-num"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount (Min {data.site.config.rates.minDeposit} BDT)
                </label>
                <input
                  type="number"
                  min={data.site.config.rates.minDeposit}
                  value={depAmount}
                  onChange={(e) => setDepAmount(e.target.value)}
                  placeholder={`Min ${data.site.config.rates.minDeposit} BDT`}
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
                <span>{loading ? 'Submitting...' : 'Submit Deposit Request'}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>
          </section>

          <section className="lg:col-span-6 surface-card p-5 sm:p-6">
            <h3 className="text-base font-bold text-slate-950 mb-3">Deposit History &amp; Status</h3>
            {data.deposits.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No deposit history found.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.deposits.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.gateway} · <span className="font-mono-num">{item.amount} BDT</span>
                      </p>
                      <p className="text-xs text-slate-500 font-mono-num">Trx: {item.trxId}</p>
                    </div>
                    <StatusText status={item.status} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-6 surface-card p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-950">Request Withdrawal</h3>
            <form onSubmit={handleWithdraw} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Withdraw Method</label>
                <select
                  value={witMethod}
                  onChange={(e) => setWitMethod(e.target.value as 'bKash' | 'Nagad' | 'Rocket')}
                  className="input-atelier"
                >
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Number</label>
                <input
                  type="tel"
                  value={witAccount}
                  onChange={(e) => setWitAccount(e.target.value)}
                  placeholder="Your personal mobile banking number"
                  className="input-atelier font-mono-num"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount (Min {data.site.config.rates.minWithdraw} BDT)
                </label>
                <input
                  type="number"
                  min={data.site.config.rates.minWithdraw}
                  value={witAmount}
                  onChange={(e) => setWitAmount(e.target.value)}
                  placeholder={`Min ${data.site.config.rates.minWithdraw} BDT`}
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

              <button type="submit" disabled={loading} className="btn-obsidian w-full group">
                <span>{loading ? 'Submitting...' : 'Submit Withdraw Request'}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>
          </section>

          <section className="lg:col-span-6 surface-card p-5 sm:p-6">
            <h3 className="text-base font-bold text-slate-950 mb-3">Withdraw History &amp; Status</h3>
            {data.withdraws.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No withdraw history found.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.withdraws.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.method} · <span className="font-mono-num">{item.amount} BDT</span>
                      </p>
                      <p className="text-xs text-slate-500 font-mono-num">
                        Acc: {item.accountNumber}
                        {item.district ? ` · ${item.district}` : ''}
                      </p>
                    </div>
                    <StatusText status={item.status} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
