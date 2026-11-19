import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  Briefcase,
  Coins,
  CreditCard,
  Film,
  Layers,
  LineChart,
  ListChecks,
  Megaphone,
  Send,
  Share2,
  UserCheck,
  X,
} from 'lucide-react';
import { resolveUiCopy } from '../lib/theme';
import type { MemberPage, MemberStateResponse } from '../types';
import { HERO_BANNER_URL } from './BrandAssets';

interface DashboardHomeProps {
  data: MemberStateResponse;
  onNavigate: (page: MemberPage) => void;
}

export default function DashboardHome({ data, onNavigate }: DashboardHomeProps) {
  const { user, site } = data;
  const copy = resolveUiCopy(site.config.copy);
  const usdRateBdt = site.config.rates.usdRateBdt || 122;
  const banners = site.config.banners.length > 0 ? site.config.banners : [];
  const [activeSlide, setActiveSlide] = useState(0);
  const [dismissedNoticeAt, setDismissedNoticeAt] = useState<number | null>(null);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const showNotice =
    site.config.notice.active &&
    site.config.notice.text &&
    dismissedNoticeAt !== site.config.notice.updatedAt;

  // Accurate Market Value & Currency Portfolio Math
  const currencies = data.internalCurrencies || [];
  const okbiCoin = currencies.find((c) => c.symbol === 'OKBI');
  const holdings = user.currencyHoldings || {};

  const portfolioValueBdt = useMemo(() => {
    let total = 0;
    for (const [sym, qty] of Object.entries(holdings)) {
      const curr = currencies.find((c) => c.symbol === sym);
      if (curr && qty > 0) {
        total += qty * curr.priceBdt;
      }
    }
    return Number(total.toFixed(2));
  }, [holdings, currencies]);

  const mainBalanceUsd = user.balance / usdRateBdt;
  const portfolioValueUsd = portfolioValueBdt / usdRateBdt;
  const totalNetWorthBdt = user.balance + portfolioValueBdt;
  const totalNetWorthUsd = totalNetWorthBdt / usdRateBdt;

  const actionTiles: Array<{
    id: MemberPage;
    label: string;
    subtitle: string;
    icon: React.ReactNode;
    accent?: boolean;
  }> = [
    {
      id: 'ad-network',
      label: copy.adNetworkBtnLabel,
      subtitle: '৩টি ড্যাশবোর্ড · ৩০/১০ পয়সা',
      icon: <Layers className="w-5 h-5" />,
      accent: true,
    },
    {
      id: 'crypto',
      label: copy.marketBtnLabel,
      subtitle: `OKBI ৳${(okbiCoin?.priceBdt ?? 11000).toLocaleString()}`,
      icon: <LineChart className="w-5 h-5" />,
    },
    {
      id: 'work',
      label: copy.myJobsBtnLabel,
      subtitle: 'Sheet tasks & offers',
      icon: <Briefcase className="w-5 h-5" />,
    },
    {
      id: 'all-tasks',
      label: copy.tasksBtnLabel,
      subtitle: `${(data.customTasks || []).length} live tasks`,
      icon: <ListChecks className="w-5 h-5" />,
    },
    {
      id: 'refer',
      label: copy.referBtnLabel,
      subtitle: `${site.config.rates.referralCommission} ৳ bonus`,
      icon: <Share2 className="w-5 h-5" />,
    },
    {
      id: 'deposit-withdraw',
      label: copy.depositWithdrawBtnLabel,
      subtitle: 'Deposit & payout',
      icon: <CreditCard className="w-5 h-5" />,
    },
    {
      id: 'p2p',
      label: copy.p2pBtnLabel,
      subtitle: 'P2P transfer',
      icon: <Send className="w-5 h-5" />,
    },
  ];

  const currentBanner = banners[activeSlide] || {
    badge: 'OKB LIVE',
    title: copy.portalWelcomeTitle,
    subtitle: 'Explore your private Myokbi workspace and discover daily opportunities.',
  };

  return (
    <div className="space-y-6">
      {showNotice && (
        <div className="surface-card border-amber-300 px-4 py-3.5 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
              <Megaphone className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold" style={{ color: 'var(--okb-text)' }}>
                {site.config.notice.title}
              </p>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{site.config.notice.text}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissedNoticeAt(site.config.notice.updatedAt)}
            aria-label="Close Notice"
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hero Split + Market-Accurate User Balance Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <section
          aria-label="Workspace Showcase"
          className="lg:col-span-6 relative overflow-hidden border border-slate-800 min-h-[220px] flex flex-col justify-end surface-vault"
        >
          <img
            src={HERO_BANNER_URL}
            alt="Myokbi Workspace"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1220]/95 via-[#0b1220]/60 to-transparent" />
          <div className="relative z-10 p-5 sm:p-6 flex items-end justify-between gap-4">
            <div className="max-w-md">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                {currentBanner.badge}
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-white mt-1 text-balance">
                {activeSlide === 0 ? copy.portalWelcomeTitle : currentBanner.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-200 mt-1.5 leading-relaxed">
                {currentBanner.subtitle}
              </p>
            </div>

            {banners.length > 1 && (
              <div className="flex items-center gap-1.5 shrink-0 pb-1">
                {banners.map((slide, idx) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => setActiveSlide(idx)}
                    aria-label={`Show banner ${idx + 1}`}
                    className={`h-2.5 rounded-full transition-all cursor-pointer ${
                      idx === activeSlide ? 'w-7 bg-emerald-400' : 'w-2.5 bg-white/40 hover:bg-white/75'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Accurate Market Value & Currency Balance Card */}
        <section className="lg:col-span-6 surface-card p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{copy.totalNetWorthLabel}</span>
              <span className="font-mono-num font-semibold text-slate-700">
                {user.id} · {copy.usdRateLabel}
              </span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-2xl sm:text-3xl font-bold font-mono-num" style={{ color: 'var(--okb-text)' }}>
                ৳{totalNetWorthBdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-base sm:text-lg font-bold font-mono-num" style={{ color: 'var(--okb-primary)' }}>
                ${totalNetWorthUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </p>
            </div>

            {/* Accurate Breakdown: Cash Balance vs Held Currencies Portfolio */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 mt-4 border-t border-slate-100">
              <div>
                <p className="text-[11px] text-slate-500">{copy.mainBalanceLabel}</p>
                <p className="text-xs sm:text-sm font-bold text-slate-900 font-mono-num mt-0.5">
                  ৳{user.balance.toFixed(2)}
                </p>
                <p className="text-[10px] text-slate-500 font-mono-num">${mainBalanceUsd.toFixed(2)} USD</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">{copy.marketPortfolioLabel}</p>
                <p className="text-xs sm:text-sm font-bold text-slate-900 font-mono-num mt-0.5">
                  ৳{portfolioValueBdt.toFixed(2)}
                </p>
                <p className="text-[10px] text-slate-500 font-mono-num">${portfolioValueUsd.toFixed(2)} USD</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Today Earn</p>
                <p className="text-xs sm:text-sm font-bold text-emerald-700 font-mono-num mt-0.5">
                  +৳{user.todayEarn.toFixed(2)}
                </p>
                <p className="text-[10px] text-slate-500 font-mono-num">
                  Tasks: {user.completedTasks}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Okbi Coin (Live)</p>
                <p className="text-xs sm:text-sm font-bold text-amber-700 font-mono-num mt-0.5">
                  ৳{(okbiCoin?.priceBdt ?? 11000).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                </p>
                <p className="text-[10px] text-slate-500 font-mono-num">
                  ${((okbiCoin?.priceBdt ?? 11000) / usdRateBdt).toFixed(2)} USD
                </p>
              </div>
            </div>
          </div>

          {/* Clean Action Buttons (no Ad Network banner) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onNavigate('ad-network')}
              className="btn-primary btn-sm justify-between px-3"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Film className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{copy.adNetworkBtnLabel}</span>
              </span>
              <ArrowRight className="w-3 h-3 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('crypto')}
              className="btn-gold btn-sm justify-between px-3"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Coins className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Market</span>
              </span>
              <ArrowRight className="w-3 h-3 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('leader')}
              className="btn-secondary btn-sm justify-between px-3"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="truncate">{copy.workerListBtnLabel}</span>
              </span>
              <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('agent')}
              className="btn-obsidian btn-sm justify-between px-3"
            >
              <span className="flex items-center gap-1.5 truncate">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{copy.agentBtnLabel}</span>
              </span>
              <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
            </button>
          </div>
        </section>
      </div>

      {/* Workspace Module Buttons (No Ad Network Hero Banner Above) */}
      <section aria-label="Dashboard actions">
        <div className="flex items-center justify-between mb-3.5">
          <h3 className="text-sm font-bold" style={{ color: 'var(--okb-text)' }}>
            {copy.workspaceHeading}
          </h3>
          <span className="text-xs text-slate-500">{copy.workspaceSubheading}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">
          {actionTiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => onNavigate(tile.id)}
              style={{ borderRadius: 'var(--okb-card-radius)' }}
              className={`group min-h-[118px] p-4 border text-left flex flex-col justify-between transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.985] cursor-pointer ${
                tile.accent
                  ? 'surface-vault text-white hover:border-emerald-500 shadow-sm'
                  : 'surface-card text-slate-950 hover:border-emerald-500 hover:shadow-[0_6px_16px_-6px_rgba(5,150,105,0.18)]'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    tile.accent
                      ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                      : 'bg-slate-100 border border-slate-200/80 text-slate-800 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600'
                  }`}
                >
                  {tile.icon}
                </div>
                <ArrowUpRight
                  className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
                    tile.accent ? 'text-emerald-400' : 'text-slate-400 group-hover:text-emerald-600'
                  }`}
                />
              </div>
              <div className="mt-3">
                <p className={`text-sm font-bold leading-tight ${tile.accent ? 'text-white' : 'text-slate-950'}`}>
                  {tile.label}
                </p>
                <p className={`text-[11px] mt-0.5 truncate ${tile.accent ? 'text-slate-300' : 'text-slate-500'}`}>
                  {tile.subtitle}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
