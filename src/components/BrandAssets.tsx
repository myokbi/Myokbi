import React, { useState } from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';

export const MYOKBI_LOGO_URL = '/assets/aistudio/file_0000000085648208a707fdb273e7b1ab_b67c1c54.png';
export const HERO_BANNER_URL = '/src/assets/images/hero_myokbi_banner_1795024910513.jpg';
export const DEFAULT_AVATAR_URL = '/src/assets/images/avatar_member_default_1795024942538.jpg';

export function AvatarImage({
  src,
  alt,
  className = 'w-11 h-11 rounded-full object-cover',
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`${className} bg-emerald-50 text-emerald-900 flex items-center justify-center font-semibold border border-emerald-200 shrink-0`}
        aria-label={alt}
      >
        {alt.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} shrink-0`}
    />
  );
}

export function StatusText({ status }: { status: 'Pending' | 'Approved' | 'Rejected' | 'Active' | 'Suspended' }) {
  if (status === 'Approved' || status === 'Active') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{status}</span>
      </span>
    );
  }
  if (status === 'Rejected' || status === 'Suspended') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
        <XCircle className="w-3.5 h-3.5 shrink-0" />
        <span>{status}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>{status}</span>
    </span>
  );
}

export function GatewayMark({ gateway }: { gateway: 'bKash' | 'Nagad' | 'Rocket' | 'USDT' }) {
  const styles: Record<string, { bg: string; fg: string; abbr: string }> = {
    bKash: { bg: 'bg-rose-50 border-rose-200', fg: 'text-rose-700', abbr: 'bK' },
    Nagad: { bg: 'bg-orange-50 border-orange-200', fg: 'text-orange-700', abbr: 'Ng' },
    Rocket: { bg: 'bg-indigo-50 border-indigo-200', fg: 'text-indigo-700', abbr: 'Rk' },
    USDT: { bg: 'bg-emerald-50 border-emerald-200', fg: 'text-emerald-700', abbr: '₮' },
  };
  const cfg = styles[gateway] || styles.bKash;

  return (
    <div
      className={`w-10 h-10 rounded-xl border ${cfg.bg} ${cfg.fg} flex items-center justify-center font-bold text-xs shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]`}
    >
      {cfg.abbr}
    </div>
  );
}
