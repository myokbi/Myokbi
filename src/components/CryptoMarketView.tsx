import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiRequest } from '../lib/api';
import { resolveUiCopy } from '../lib/theme';
import type { InternalCurrency, MemberStateResponse } from '../types';

interface CryptoMarketViewProps {
  data: MemberStateResponse;
  onRefresh?: () => Promise<void>;
}

const FALLBACK_CURRENCIES: InternalCurrency[] = [
  {
    symbol: 'OKBI',
    name: 'Okbi Coin',
    description: 'Native Myokbi Network Reserve Token (Supply & Demand Driven)',
    priceBdt: 11000,
    basePriceBdt: 11000,
    liquidityPoolBdt: 250000,
    totalInvestedBdt: 0,
    change24hPct: 0,
    priceHistory: [10820, 10890, 10940, 10910, 10975, 11020, 10985, 11000],
    active: true,
  },
];

export default function CryptoMarketView({ data, onRefresh }: CryptoMarketViewProps) {
  const { user, site } = data;
  const copy = resolveUiCopy(site.config.copy);
  const usdRateBdt = site.config.rates.usdRateBdt || 122;

  const currencies = useMemo(() => {
    const list = data.internalCurrencies || [];
    return list.length > 0 ? list.filter((c) => c.active) : FALLBACK_CURRENCIES;
  }, [data.internalCurrencies]);

  const [selectedSymbol, setSelectedSymbol] = useState<string>('OKBI');
  const [tradeSide, setTradeSide] = useState<'BUY' | 'SELL'>('BUY');
  const [amountInput, setAmountInput] = useState<string>('500');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const selectedCurrency = useMemo(
    () => currencies.find((c) => c.symbol === selectedSymbol) || currencies[0],
    [currencies, selectedSymbol]
  );

  const holdings = user.currencyHoldings || {};
  const selectedHeldQty = Number(holdings[selectedCurrency.symbol] || 0);

  const portfolioBreakdown = useMemo(() => {
    return currencies.map((curr) => {
      const qty = Number(holdings[curr.symbol] || 0);
      const valueBdt = Number((qty * curr.priceBdt).toFixed(2));
      const valueUsd = Number((valueBdt / usdRateBdt).toFixed(2));
      return {
        ...curr,
        qty,
        valueBdt,
        valueUsd,
        priceUsd: Number((curr.priceBdt / usdRateBdt).toFixed(4)),
      };
    });
  }, [currencies, holdings, usdRateBdt]);

  const totalPortfolioBdt = useMemo(
    () => portfolioBreakdown.reduce((sum, item) => sum + item.valueBdt, 0),
    [portfolioBreakdown]
  );

  const mainUsd = user.balance / usdRateBdt;
  const portfolioUsd = totalPortfolioBdt / usdRateBdt;
  const totalNetWorthBdt = user.balance + totalPortfolioBdt;
  const totalNetWorthUsd = totalNetWorthBdt / usdRateBdt;

  const chartData = useMemo(() => {
    const history =
      selectedCurrency.priceHistory && selectedCurrency.priceHistory.length > 0
        ? selectedCurrency.priceHistory
        : [selectedCurrency.basePriceBdt, selectedCurrency.priceBdt];
    return history.map((price, idx) => ({
      tick: `#${idx + 1}`,
      priceBdt: Number(price.toFixed(2)),
      priceUsd: Number((price / usdRateBdt).toFixed(2)),
    }));
  }, [selectedCurrency, usdRateBdt]);

  const numericAmount = Number(amountInput || 0);
  const estimatedCoinOut =
    tradeSide === 'BUY' && selectedCurrency.priceBdt > 0
      ? numericAmount / selectedCurrency.priceBdt
      : numericAmount;
  const estimatedBdtOut =
    tradeSide === 'SELL' ? numericAmount * selectedCurrency.priceBdt : numericAmount;

  async function handleTrade(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFeedback({ type: 'err', text: 'Please enter a valid positive amount.' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<{
        ok: boolean;
        trade: { coinQty: number; bdtAmount: number; priceAfterBdt: number; symbol: string; side: 'BUY' | 'SELL' };
      }>('/api/market/trade', {
        method: 'POST',
        body: JSON.stringify({
          symbol: selectedCurrency.symbol,
          side: tradeSide,
          amount: numericAmount,
        }),
      });

      setFeedback({
        type: 'ok',
        text:
          res.trade.side === 'BUY'
            ? `Purchased ${res.trade.coinQty.toFixed(6)} ${res.trade.symbol} for ৳${res.trade.bdtAmount.toFixed(2)}. Live price adjusted to ৳${res.trade.priceAfterBdt.toLocaleString()}.`
            : `Sold ${res.trade.coinQty.toFixed(6)} ${res.trade.symbol} for ৳${res.trade.bdtAmount.toFixed(2)}. Credited to Main Balance.`,
      });
      await onRefresh?.();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Trade execution failed.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Accurate Market Value & Wallet Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-8 surface-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <p className="text-xs text-slate-500">{copy.totalNetWorthLabel}</p>
              <div className="flex items-baseline gap-3 mt-1">
                <p className="text-2xl sm:text-3xl font-bold font-mono-num text-slate-950">
                  ৳{totalNetWorthBdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-base sm:text-lg font-bold font-mono-num" style={{ color: 'var(--okb-primary)' }}>
                  ${totalNetWorthUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </p>
              </div>
            </div>
            <div className="text-right text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                <ShieldCheck className="w-4 h-4" />
                <span>{site.config.siteName} Internal Network Only</span>
              </span>
              <p className="text-[11px] text-slate-500 font-mono-num mt-0.5">
                Rate: $1.00 = ৳{usdRateBdt} BDT
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
            <div>
              <p className="text-[11px] text-slate-500">{copy.mainBalanceLabel}</p>
              <p className="text-sm font-bold text-slate-900 font-mono-num mt-0.5">৳{user.balance.toFixed(2)}</p>
              <p className="text-[11px] text-slate-500 font-mono-num">${mainUsd.toFixed(2)} USD</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">{copy.marketPortfolioLabel}</p>
              <p className="text-sm font-bold text-slate-900 font-mono-num mt-0.5">৳{totalPortfolioBdt.toFixed(2)}</p>
              <p className="text-[11px] text-slate-500 font-mono-num">${portfolioUsd.toFixed(2)} USD</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Your OKBI Held</p>
              <p className="text-sm font-bold text-amber-700 font-mono-num mt-0.5">
                {(holdings.OKBI || 0).toFixed(5)} OKBI
              </p>
              <p className="text-[11px] text-slate-500 font-mono-num">
                ৳{((holdings.OKBI || 0) * (currencies.find((c) => c.symbol === 'OKBI')?.priceBdt || 11000)).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Network Currencies</p>
              <p className="text-sm font-bold text-slate-900 font-mono-num mt-0.5">{currencies.length} Active</p>
              <p className="text-[11px] text-emerald-700">Live Supply/Demand</p>
            </div>
          </div>
        </section>

        <section className="lg:col-span-4 surface-vault p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold">
              Okbi Coin Live Rate
            </p>
            <p className="text-2xl font-bold font-mono-num mt-1">
              ৳{(currencies.find((c) => c.symbol === 'OKBI')?.priceBdt || 11000).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-300 font-mono-num mt-0.5">
              ${((currencies.find((c) => c.symbol === 'OKBI')?.priceBdt || 11000) / usdRateBdt).toFixed(2)} USD per OKBI
            </p>
          </div>
          <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
            Price moves automatically based on real member buys &amp; sells within the {site.config.siteName} network.
          </p>
        </section>
      </div>

      {/* Internal Network Currency Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {portfolioBreakdown.map((curr) => {
          const active = curr.symbol === selectedCurrency.symbol;
          const isUp = curr.change24hPct >= 0;
          return (
            <button
              key={curr.symbol}
              type="button"
              onClick={() => {
                setSelectedSymbol(curr.symbol);
                setFeedback(null);
              }}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                active
                  ? 'bg-[#0b1220] text-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                  : 'surface-card hover:border-emerald-500'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Coins className={`w-4 h-4 shrink-0 ${active ? 'text-amber-400' : 'text-emerald-700'}`} />
                  <span className="text-sm font-bold truncate">{curr.name}</span>
                </div>
                <span className={`text-[11px] font-bold font-mono-num ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                  {curr.symbol}
                </span>
              </div>

              <div>
                <p className="text-lg font-bold font-mono-num">
                  ৳{curr.priceBdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <div className="flex items-center justify-between text-[11px] font-mono-num mt-0.5">
                  <span className={active ? 'text-slate-300' : 'text-slate-500'}>
                    ${curr.priceUsd.toFixed(2)} USD
                  </span>
                  <span className={`font-semibold ${isUp ? 'text-emerald-500' : 'text-red-500'}`}>
                    {isUp ? '+' : ''}
                    {curr.change24hPct.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className={`pt-2 border-t text-[11px] font-mono-num flex justify-between ${active ? 'border-white/10 text-slate-300' : 'border-slate-100 text-slate-600'}`}>
                <span>Held: {curr.qty.toFixed(4)}</span>
                <span>৳{curr.valueBdt.toFixed(0)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Price Chart + Direct Buy/Sell Order Ticket */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Price History Chart */}
        <section className="lg:col-span-7 surface-card p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-950">
                {selectedCurrency.name} ({selectedCurrency.symbol}) / BDT
              </h3>
              <p className="text-xs text-slate-500">{selectedCurrency.description}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-slate-950 font-mono-num">
                ৳{selectedCurrency.priceBdt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p
                className={`inline-flex items-center gap-1 text-xs font-semibold font-mono-num ${
                  selectedCurrency.change24hPct >= 0 ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {selectedCurrency.change24hPct >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                <span>
                  ${(selectedCurrency.priceBdt / usdRateBdt).toFixed(2)} USD ({selectedCurrency.change24hPct >= 0 ? '+' : ''}
                  {selectedCurrency.change24hPct.toFixed(2)}%)
                </span>
              </p>
            </div>
          </div>

          <div className="w-full h-64 bg-[#0b1220] rounded-xl border border-slate-800 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="okbPriceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="tick" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                  tickFormatter={(v: number) => `৳${v.toLocaleString()}`}
                  width={68}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '10px',
                    fontSize: '12px',
                    color: '#f8fafc',
                  }}
                  formatter={(value: number) => [`৳${value.toLocaleString()} ($${(value / usdRateBdt).toFixed(2)})`, selectedCurrency.symbol]}
                />
                <Area
                  type="monotone"
                  dataKey="priceBdt"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#okbPriceFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Internal Network Buy / Sell Currency Form */}
        <section className="lg:col-span-5 surface-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-950">Trade {selectedCurrency.symbol}</h3>
            <span className="text-xs font-mono-num text-slate-500">
              Held: <strong className="text-slate-900">{selectedHeldQty.toFixed(6)}</strong> {selectedCurrency.symbol}
            </span>
          </div>

          <div className="segment-track grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setTradeSide('BUY');
                setAmountInput(user.balance >= 500 ? '500' : String(Math.max(10, Math.floor(user.balance))));
                setFeedback(null);
              }}
              className={`segment-btn ${tradeSide === 'BUY' ? 'segment-btn-active text-emerald-700' : 'segment-btn-idle'}`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>{copy.buyCoinBtnLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTradeSide('SELL');
                setAmountInput(selectedHeldQty > 0 ? String(selectedHeldQty) : '0.01');
                setFeedback(null);
              }}
              className={`segment-btn ${tradeSide === 'SELL' ? 'segment-btn-active text-amber-700' : 'segment-btn-idle'}`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>{copy.sellCoinBtnLabel}</span>
            </button>
          </div>

          <form onSubmit={handleTrade} className="space-y-3.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  {tradeSide === 'BUY' ? 'Invest Amount (BDT from Main Balance)' : `Sell Quantity (${selectedCurrency.symbol})`}
                </label>
                <span className="text-[11px] font-mono-num text-slate-500">
                  {tradeSide === 'BUY' ? `Avail: ৳${user.balance.toFixed(2)}` : `Avail: ${selectedHeldQty.toFixed(5)}`}
                </span>
              </div>
              <input
                type="number"
                step="any"
                min="0"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="input-atelier font-mono-num"
                required
              />

              {/* Quick Percentage Buttons */}
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                {[0.25, 0.5, 0.75, 1].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      if (tradeSide === 'BUY') {
                        setAmountInput(String(Number((user.balance * pct).toFixed(2))));
                      } else {
                        setAmountInput(String(Number((selectedHeldQty * pct).toFixed(6))));
                      }
                    }}
                    className="py-1.5 text-[11px] font-bold font-mono-num rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer"
                  >
                    {Math.round(pct * 100)}%
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs font-mono-num">
              <div className="flex justify-between text-slate-600">
                <span>{tradeSide === 'BUY' ? 'You Receive (Est.)' : 'Cashout Payout (Est.)'}</span>
                <strong className="text-slate-950">
                  {tradeSide === 'BUY'
                    ? `${estimatedCoinOut.toFixed(6)} ${selectedCurrency.symbol}`
                    : `৳${estimatedBdtOut.toFixed(2)}`}
                </strong>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>USD Value (@ ৳{usdRateBdt}/$)</span>
                <span>
                  $
                  {(
                    (tradeSide === 'BUY' ? numericAmount : estimatedBdtOut) / usdRateBdt
                  ).toFixed(2)}{' '}
                  USD
                </span>
              </div>
              <p className="text-[11px] font-sans text-slate-500 pt-1 border-t border-slate-200/80">
                {tradeSide === 'BUY'
                  ? 'Buying increases network demand and pushes this currency price upward.'
                  : 'Selling unlocks your BDT balance instantly and adjusts market price downward.'}
              </p>
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

            <button
              type="submit"
              disabled={submitting}
              className={tradeSide === 'BUY' ? 'btn-primary w-full' : 'btn-gold w-full'}
            >
              <Wallet className="w-4 h-4" />
              <span>
                {submitting
                  ? 'Processing Order...'
                  : tradeSide === 'BUY'
                  ? `${copy.buyCoinBtnLabel} (${selectedCurrency.symbol})`
                  : `${copy.sellCoinBtnLabel} (${selectedCurrency.symbol})`}
              </span>
            </button>
          </form>
        </section>
      </div>

      {/* Member Currency Trade History */}
      <section className="surface-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h3 className="text-sm font-bold text-slate-950">Your Internal Network Trades</h3>
            <p className="text-xs text-slate-500">All orders settled directly using your Myokbi wallet balance</p>
          </div>
          <span className="text-xs font-mono-num text-slate-500">
            {(data.cryptoTrades || []).length} trades
          </span>
        </div>

        {!data.cryptoTrades || data.cryptoTrades.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
            No currency purchases or sales yet. Use the trade panel above to invest in Okbi Coin or internal currencies.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.cryptoTrades.slice(0, 12).map((tr) => (
              <div key={tr.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-slate-900 font-mono-num">
                    <span className={tr.side === 'BUY' ? 'text-emerald-700' : 'text-amber-700'}>
                      {tr.side}
                    </span>{' '}
                    · {tr.coinQty.toFixed(6)} {tr.symbol}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono-num">
                    Rate ৳{tr.priceBdt.toLocaleString()} → ৳{tr.priceAfterBdt.toLocaleString()} ·{' '}
                    {new Date(tr.timestamp).toLocaleString()}
                  </p>
                </div>
                <div className="text-right font-mono-num">
                  <p className="font-bold text-slate-900">৳{tr.bdtAmount.toFixed(2)}</p>
                  <p className="text-[11px] text-slate-500">${tr.usdAmount.toFixed(2)} USD</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
