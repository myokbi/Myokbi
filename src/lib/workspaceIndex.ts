import type { MemberPage } from '../types';

export interface NavSearchItem {
  id: MemberPage;
  label: string;
  subtitle: string;
  keywords: string[];
}

export interface WorkspaceTaskItem {
  id: string;
  number: number;
  name: string;
  desc: string;
  targetPage: MemberPage;
  available: boolean;
  keywords: string[];
}

export const WORKSPACE_NAV_ITEMS: NavSearchItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    subtitle: 'Overview, earnings wallet & real-time stats',
    keywords: ['home', 'overview', 'balance', 'wallet', 'stats', 'notice', 'main'],
  },
  {
    id: 'ad-network',
    label: 'অ্যাড নেটওয়ার্ক (3 Dashboards)',
    subtitle: 'ভিডিও ৩০ পয়সা ও অন্যান্য এড ১০ পয়সা',
    keywords: ['ad network', 'smartlink', 'dashboard', 'ভিডিও এড', '৩০ পয়সা', '১০ পয়সা', 'অ্যাড নেটওয়ার্ক'],
  },
  {
    id: 'work',
    label: 'My.Jobs',
    subtitle: 'Submit Google Sheet data-entry work & track rewards',
    keywords: ['job', 'jobs', 'work', 'data entry', 'google sheet', 'submit', 'ডাটা এন্ট্রি'],
  },
  {
    id: 'video-ads',
    label: 'ভিডিও এড (Video Ads)',
    subtitle: 'Watch 15s/30s non-skippable video ads & earn instantly',
    keywords: ['video', 'ad', 'ads', 'watch', 'adsterra', 'monetag', 'reward', 'ভিডিও এড', 'বিজ্ঞাপন', '৩০ পয়সা'],
  },
  {
    id: 'all-tasks',
    label: 'All Tasks',
    subtitle: 'Browse all 8 platform task categories',
    keywords: ['tasks', 'categories', 'seo', 'marketing', 'captcha', 'git', 'all'],
  },
  {
    id: 'deposit-withdraw',
    label: 'Deposit / Withdraw',
    subtitle: 'bKash, Nagad, Rocket & USDT cash-in or payout',
    keywords: ['deposit', 'withdraw', 'bkash', 'nagad', 'rocket', 'usdt', 'cashout', 'money'],
  },
  {
    id: 'agent',
    label: '64-District Agent',
    subtitle: 'Fast local district agent settlement desk',
    keywords: ['agent', 'district', 'dhaka', 'chattogram', 'sylhet', '64', 'cashout'],
  },
  {
    id: 'p2p',
    label: 'P2P Send Money',
    subtitle: 'Instant member-to-member BDT transfer',
    keywords: ['p2p', 'send', 'transfer', 'peer', 'code', 'trx'],
  },
  {
    id: 'refer',
    label: 'Refer & Earn',
    subtitle: 'Invite links, referral bonuses & network growth',
    keywords: ['refer', 'referral', 'invite', 'bonus', 'team', 'commission'],
  },
  {
    id: 'crypto',
    label: 'OKB Pro Market',
    subtitle: 'Live BTC, ETH, BNB, SOL market telemetry',
    keywords: ['crypto', 'market', 'bitcoin', 'btc', 'eth', 'price', 'okb'],
  },
  {
    id: 'leader',
    label: 'Champions Hub',
    subtitle: 'Top referrer rankings & milestone rewards',
    keywords: ['leader', 'leaderboard', 'champions', 'rank', 'top', 'prize'],
  },
  {
    id: 'helpline',
    label: 'Live Helpline',
    subtitle: 'Direct agent support tickets & real-time chat',
    keywords: ['helpline', 'help', 'support', 'chat', 'ticket', 'issue'],
  },
  {
    id: 'history',
    label: 'History (7 Days)',
    subtitle: 'Deposits, payouts, work logs & P2P ledger',
    keywords: ['history', 'ledger', 'logs', 'transactions', '7 days', 'statement'],
  },
  {
    id: 'profile',
    label: 'My ID Card',
    subtitle: 'Verified member badge, status & refer code',
    keywords: ['profile', 'id card', 'account', 'badge', 'level', 'photo'],
  },
];

export const WORKSPACE_TASKS: WorkspaceTaskItem[] = [
  {
    id: 'data-entry',
    number: 1,
    name: 'ডাটা এন্ট্রি (Data Entry)',
    desc: 'গুগল শিট টাস্ক ও ডাটা এন্ট্রি কাজ',
    targetPage: 'work',
    available: true,
    keywords: ['data entry', 'google sheet', 'spreadsheet', 'my.jobs', 'ডাটা এন্ট্রি', 'গুগল শিট'],
  },
  {
    id: 'seo',
    number: 2,
    name: 'এসইও (SEO)',
    desc: 'ওয়েবসাইট অপ্টিমাইজেশন ও ট্রাফিক কাজ',
    targetPage: 'all-tasks',
    available: false,
    keywords: ['seo', 'search engine optimization', 'এসইও', 'traffic'],
  },
  {
    id: 'social-marketing',
    number: 3,
    name: 'সোশ্যাল মার্কেটিং',
    desc: 'সোশ্যাল মিডিয়া প্রমোশন ও শেয়ারিং',
    targetPage: 'all-tasks',
    available: false,
    keywords: ['social', 'marketing', 'share', 'সোশ্যাল', 'মার্কেটিং'],
  },
  {
    id: 'captcha-join',
    number: 4,
    name: 'ক্যাপচা জয়েন',
    desc: 'সিকিউরিটি ক্যাপচা সলভিং ও এন্ট্রি',
    targetPage: 'all-tasks',
    available: false,
    keywords: ['captcha', 'solve', 'ক্যাপচা'],
  },
  {
    id: 'traffic-analyze',
    number: 5,
    name: 'ট্রাফিক এনালাইজ',
    desc: 'কিওয়ার্ড ও ট্রাফিক ক্যাটাগরি',
    targetPage: 'all-tasks',
    available: false,
    keywords: ['traffic', 'analyze', 'analytics', 'keyword', 'ট্রাফিক'],
  },
  {
    id: 'email-marketing',
    number: 6,
    name: 'ইমেইল মার্কেটিং',
    desc: 'নিউজলেটার ও প্রমোশনাল ইমেইল সেন্ড',
    targetPage: 'all-tasks',
    available: false,
    keywords: ['email', 'newsletter', 'marketing', 'ইমেইল'],
  },
  {
    id: 'social-ad-manager',
    number: 7,
    name: 'সোশ্যাল মিডিয়া অ্যাড ম্যানেজার',
    desc: 'বিজ্ঞাপন ক্যাম্পেইন ও ম্যানেজমেন্ট',
    targetPage: 'all-tasks',
    available: false,
    keywords: ['ads', 'ad manager', 'campaign', 'অ্যাড'],
  },
  {
    id: 'git-create',
    number: 8,
    name: 'গিট তৈরি করা (Git Create)',
    desc: 'সোর্স কোড ও রিপোজিটরি ম্যানেজমেন্ট',
    targetPage: 'all-tasks',
    available: false,
    keywords: ['git', 'github', 'repo', 'code', 'গিট'],
  },
];
