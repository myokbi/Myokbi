import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  AdNetworkConfig,
  CustomTaskItem,
  DatabaseState,
  DistrictAgentItem,
  GitHubSyncConfig,
  GitHubSyncStatus,
  InternalCurrency,
  PublicUserProfile,
  ServerSecrets,
  SiteConfig,
  UiCopyConfig,
  UiThemeConfig,
  UserRecord,
} from './types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const GITHUB_CONFIG_FILE = path.join(DATA_DIR, '.github-config.json');
const SECRETS_FILE = path.join(DATA_DIR, '.server-secrets.json');

export const THIRTY_MINUTES_MS = 30 * 60 * 1000;

export const DISTRICT_AGENT_LIST = [
  { district: 'ঢাকা', agent: 'Tanvir Ahmed' },
  { district: 'ফরিদপুর', agent: 'Sabrina Sultana' },
  { district: 'গাজীপুর', agent: 'Mehedi Hasan' },
  { district: 'গোপালগঞ্জ', agent: 'Nusrat Jahan' },
  { district: 'কিশোরগঞ্জ', agent: 'Rakibul Islam' },
  { district: 'মাদারীপুর', agent: 'Farhana Yasmin' },
  { district: 'মানিকগঞ্জ', agent: 'Shariful Alam' },
  { district: 'মুন্সিগঞ্জ', agent: 'Sumaiya Akter' },
  { district: 'নারায়ণগঞ্জ', agent: 'Nazmul Huda' },
  { district: 'নরসিংদী', agent: 'Tania Akter' },
  { district: 'রাজবাড়ী', agent: 'Imran Hossain' },
  { district: 'শরীয়তপুর', agent: 'Mst. Lima Khatun' },
  { district: 'টাঙ্গাইল', agent: 'Ashraful Islam' },
  { district: 'বগুড়া', agent: 'Moniruzzaman' },
  { district: 'জয়পুরহাট', agent: 'Sadia Afrin' },
  { district: 'নওগাঁ', agent: 'Nazifa Tabassum' },
  { district: 'নাটোর', agent: 'Al-Amin Hossain' },
  { district: 'চাঁপাইনবাবগঞ্জ', agent: 'Fahmida Sultana' },
  { district: 'পাবনা', agent: 'Golam Rabbani' },
  { district: 'রাজশাহী', agent: 'Sanjida Akter' },
  { district: 'দিনাজপুর', agent: 'Monowar Hossain' },
  { district: 'গাইবান্ধা', agent: 'Roksana Parvin' },
  { district: 'কুড়িগ্রাম', agent: 'Habibur Rahman' },
  { district: 'লালমনিরহাট', agent: 'Jannatul Ferdous' },
  { district: 'নীলফামারী', agent: 'Mizanur Rahman' },
  { district: 'পঞ্চগড়', agent: 'Sharmin Akter' },
  { district: 'রংপুর', agent: 'Ariful Islam' },
  { district: 'ঠাকুরগাঁও', agent: 'Mahbuba Akter' },
  { district: 'বাগেরহাট', agent: 'Sheikh Faruk' },
  { district: 'চুয়াডাঙ্গা', agent: 'Rokeya Khatun' },
  { district: 'যশোর', agent: 'Sohel Rana' },
  { district: 'ঝিনাইদহ', agent: 'Nazma Khatun' },
  { district: 'খুলনা', agent: 'Imtiaz Ahmed' },
  { district: 'কুষ্টিয়া', agent: 'Anika Tabassum' },
  { district: 'মাগুরা', agent: 'Saiful Islam' },
  { district: 'মেহেরপুর', agent: 'Salma Sultana' },
  { district: 'নড়াইল', agent: 'Zahirul Islam' },
  { district: 'সাতক্ষীরা', agent: 'Mosammat Rina' },
  { district: 'বরগুনা', agent: 'Sohag Mia' },
  { district: 'বরিশাল', agent: 'Tanjina Akter' },
  { district: 'ভোলা', agent: 'Monir Hossain' },
  { district: 'ঝালকাঠি', agent: 'Priya Rani' },
  { district: 'পটুয়াখালী', agent: 'Kamrul Islam' },
  { district: 'পিরোজপুর', agent: 'Sabiha Sultana' },
  { district: 'বান্দরবান', agent: 'Mang Tho' },
  { district: 'ব্রাহ্মণবাড়িয়া', agent: 'Zobair Ahmed' },
  { district: 'চাঁদপুর', agent: 'Mehnaz Tabassum' },
  { district: 'চট্টগ্রাম', agent: 'Farhan Tanvir' },
  { district: 'কুমিল্লা', agent: 'Taslima Nasrin' },
  { district: 'কক্সবাজার', agent: 'Rashedul Islam' },
  { district: 'ফেনী', agent: 'Afroza Sultana' },
  { district: 'খাগড়াছড়ি', agent: 'Ujjal Tripura' },
  { district: 'লক্ষ্মীপুর', agent: 'Belal Hossain' },
  { district: 'নোয়াখালী', agent: 'Nazia Sultana' },
  { district: 'রাঙ্গামাটি', agent: 'Chakma Sujon' },
  { district: 'হবিগঞ্জ', agent: 'Shah Paran' },
  { district: 'মৌলভীবাজার', agent: 'Nazmun Nahar' },
  { district: 'সুনামগঞ্জ', agent: 'Badrul Alam' },
  { district: 'সিলেট', agent: 'Zahid Hasan' },
  { district: 'শেরপুর', agent: 'Shamima Nasrin' },
  { district: 'ময়মনসিংহ', agent: 'Nazmul Haque' },
  { district: 'নেত্রকোণা', agent: 'Moumita Sarker' },
];

export const DEFAULT_DISTRICT_AGENTS: DistrictAgentItem[] = DISTRICT_AGENT_LIST.map((item, idx) => ({
  id: `AGT-D${idx + 1}`,
  district: item.district,
  agent: item.agent,
  phone: `+880 17${String(10000000 + idx).slice(0, 8)}`,
  active: true,
}));

export const DEFAULT_WORKSPACE_TASKS: CustomTaskItem[] = [
  {
    id: 'TSK-DATA-ENTRY',
    category: 'Data Entry',
    title: 'গুগল শিট ডাটা এন্ট্রি (Google Sheet Data Entry)',
    description: 'দৈনিক ভেরিফায়েড গুগল শিট ফাইল ফিল-আপ ও সাবমিশন টাস্ক।',
    instructions: 'প্রদত্ত গুগল শিট লিংক ওপেন করে নির্ধারিত ডাটা এন্ট্রি সম্পূর্ণ করুন এবং আপনার শিটের শেয়ার লিংক সাবমিট করুন।',
    rewardBdt: 120,
    sheetUrl: 'https://docs.google.com/spreadsheets/d/sample',
    active: true,
    createdAt: Date.now() - 86400000 * 5,
  },
  {
    id: 'TSK-SEO-REVIEW',
    category: 'SEO',
    title: 'এসইও ও গুগল সার্চ ভেরিফিকেশন',
    description: 'টার্গেট কিওয়ার্ড দিয়ে সার্চ করে পেজ ট্রাফিক নিশ্চিত করুন।',
    instructions: 'গুগলে কিওয়ার্ড সার্চ করে ওয়েবসাইটে ১ মিনিট ভিজিট করুন এবং স্ক্রিনশট বা ভিজিট লিংক দিন।',
    rewardBdt: 80,
    active: true,
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'TSK-SOCIAL-SHARE',
    category: 'Social Marketing',
    title: 'সোশ্যাল মিডিয়া শেয়ার ও রিভিউ',
    description: 'ফেসবুক/টেলিগ্রাম গ্রুপে অফিশিয়াল পোস্ট শেয়ার ও রিঅ্যাকশন।',
    instructions: 'আমাদের অফিশিয়াল আপডেট আপনার সোশ্যাল মিডিয়া ওয়ালে শেয়ার করুন এবং পোস্ট লিংক প্রদান করুন।',
    rewardBdt: 50,
    active: true,
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'TSK-CAPTCHA-SOLVE',
    category: 'Captcha Join',
    title: 'সিকিউরিটি ক্যাপচা ভেরিফিকেশন',
    description: 'রিসার্চ ও সিকিউরিটি ক্যাপচা সলভিং এন্ট্রি।',
    instructions: 'টাস্ক বোর্ডে দেওয়া ডাটা ভেরিফিকেশন কোড সঠিকভাবে পূরণ করে সাবমিট করুন।',
    rewardBdt: 40,
    active: true,
    createdAt: Date.now() - 86400000 * 1,
  },
];


function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function atomicWriteJson(filePath: string, data: unknown): void {
  ensureDataDir();
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

export function sanitizeUser(user: UserRecord): PublicUserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    referCode: user.referCode,
    referredBy: user.referredBy,
    level: user.level,
    balance: user.balance,
    depositBalance: user.depositBalance,
    todayEarn: user.todayEarn,
    completedTasks: user.completedTasks,
    referralBonus: user.referralBonus,
    status: user.status,
    photoUrl: user.photoUrl,
    currencyHoldings: user.currencyHoldings || {},
    createdAt: user.createdAt,
  };
}

export const DEFAULT_UI_THEME: UiThemeConfig = {
  primaryColor: '#059669',
  primaryTextColor: '#ffffff',
  accentColor: '#d97706',
  vaultColor: '#0b1220',
  sidebarTextColor: '#e2e8f0',
  pageBgColor: '#f3f5f8',
  cardBgColor: '#ffffff',
  cardBorderColor: '#e2e8f0',
  headingTextColor: '#0b1220',
  mutedTextColor: '#64748b',
  buttonRadiusPx: 12,
  cardRadiusPx: 16,
};

export const DEFAULT_UI_COPY: UiCopyConfig = {
  portalWelcomeTitle: 'Work. Earn. Grow.',
  mainBalanceLabel: 'Main Balance',
  usdRateLabel: '1 USD = 122 BDT',
  marketPortfolioLabel: 'Currency Portfolio Value',
  totalNetWorthLabel: 'Total Market Value',
  workspaceHeading: 'Workspace Modules',
  workspaceSubheading: 'Select a module to continue',
  workerListBtnLabel: 'Worker List',
  agentBtnLabel: 'Agent',
  adNetworkBtnLabel: 'অ্যাড নেটওয়ার্ক',
  tasksBtnLabel: 'All List',
  myJobsBtnLabel: 'My.Jobs',
  marketBtnLabel: 'Market & Okbi Coin',
  depositWithdrawBtnLabel: 'Withdraw',
  p2pBtnLabel: 'Send Main',
  referBtnLabel: 'Share & Refer',
  helplineBtnLabel: 'Helpline',
  historyBtnLabel: 'History',
  profileBtnLabel: 'ID Card & Photo',
  idCardHeaderTitle: 'MY OKBI ID CARD',
  submitWorkBtnLabel: 'Submit Google Sheet Work',
  buyCoinBtnLabel: 'Buy Currency',
  sellCoinBtnLabel: 'Sell Currency',
  footerAboutTitle: 'About Myokbi Platform',
  footerAboutText: 'Myokbi is a private digital earning and micro-task management ecosystem with internal asset exchange.',
};

export const DEFAULT_INTERNAL_CURRENCIES: InternalCurrency[] = [
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
  {
    symbol: 'USDX',
    name: 'Myokbi Dollar',
    description: 'Internal Network USD Asset pegged near 122 BDT',
    priceBdt: 122,
    basePriceBdt: 122,
    liquidityPoolBdt: 500000,
    totalInvestedBdt: 0,
    change24hPct: 0,
    priceHistory: [122, 122, 122.1, 121.95, 122, 122.05, 122, 122],
    active: true,
  },
  {
    symbol: 'MGT',
    name: 'Myokbi Gold Token',
    description: 'Internal Network Gold Reserve Credit',
    priceBdt: 5500,
    basePriceBdt: 5500,
    liquidityPoolBdt: 180000,
    totalInvestedBdt: 0,
    change24hPct: 0,
    priceHistory: [5440, 5465, 5480, 5470, 5495, 5510, 5490, 5500],
    active: true,
  },
  {
    symbol: 'SLV',
    name: 'Myokbi Silver Credit',
    description: 'Internal Network Silver Asset Unit',
    priceBdt: 1220,
    basePriceBdt: 1220,
    liquidityPoolBdt: 150000,
    totalInvestedBdt: 0,
    change24hPct: 0,
    priceHistory: [1205, 1210, 1214, 1212, 1218, 1222, 1219, 1220],
    active: true,
  },
];

export function createDefaultSiteConfig(): SiteConfig {
  return {
    siteName: 'Myokbi',
    tagline: 'Work • Earn • Grow',
    privateMode: true,
    maintenanceMode: false,
    notice: {
      active: true,
      title: 'জরুরি নোটিশ',
      text: 'স্বাগতম! আপনার প্রাইভেট Myokbi সার্ভার এবং গিটহাব সিঙ্ক এখন সক্রিয় রয়েছে।',
      updatedAt: Date.now(),
    },
    banners: [
      {
        id: 'slide-1',
        badge: 'OKB LIVE',
        title: 'Work. Earn. Grow.',
        subtitle: 'Explore your private Myokbi workspace and discover daily data-entry opportunities.',
      },
      {
        id: 'slide-2',
        badge: 'REWARDS',
        title: 'Build Your Rewards',
        subtitle: 'Complete verified Google Sheet tasks and grow your account balance in real time.',
      },
      {
        id: 'slide-3',
        badge: 'MARKET',
        title: 'Explore OKB Pro Market',
        subtitle: 'Buy & sell Okbi Coin (11,000 ৳ base) and internal currencies from your balance.',
      },
    ],
    adminNumbers: {
      bKash: '01700000000',
      Nagad: '01800000000',
      Rocket: '01900000000',
      USDT: 'TMyokbiWalletTRC20Address',
    },
    rates: {
      minDeposit: 100,
      minWithdraw: 500,
      minAgentWithdraw: 500,
      taskReward: 120,
      referralSignupBonus: 10,
      referralCommission: 750,
      p2pMin: 1000,
      p2pMax: 100000,
      p2pFeePerThousand: 50,
      usdRateBdt: 122,
    },
    adNetwork: createDefaultAdNetworkConfig(),
    champions: [
      {
        rank: 1,
        maskedId: 'M102****88',
        refers: 100,
        prizeLabel: '১৮০,০০০ ৳',
        photoUrl: '/src/assets/images/avatar_member_default_1795024942538.jpg',
      },
      {
        rank: 2,
        maskedId: 'M102****34',
        refers: 55,
        prizeLabel: '১০০,০০০ ৳',
        photoUrl: '/src/assets/images/avatar_member_default_1795024942538.jpg',
      },
      {
        rank: 3,
        maskedId: 'M102****71',
        refers: 30,
        prizeLabel: '৬০,০০০ ৳',
        photoUrl: '/src/assets/images/avatar_member_default_1795024942538.jpg',
      },
    ],
    baseReferralMeter: 18601,
    theme: { ...DEFAULT_UI_THEME },
    copy: { ...DEFAULT_UI_COPY },
  };
}

export function createDefaultDatabase(): DatabaseState {
  const now = Date.now();
  return {
    version: 1,
    updatedAt: now,
    config: createDefaultSiteConfig(),
    invites: [
      {
        id: 'inv-initial',
        token: `OKB-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        label: 'Owner VIP Access Link',
        role: 'vip',
        maxUses: 100,
        usedCount: 0,
        active: true,
        expiresAt: null,
        createdAt: now,
        lastUsedAt: null,
      },
    ],
    users: {},
    deposits: [],
    withdraws: [],
    workSubmissions: [],
    p2pTransactions: [],
    helplineMessages: [],
    adWatchLogs: [],
    districtAgents: DEFAULT_DISTRICT_AGENTS,
    customTasks: DEFAULT_WORKSPACE_TASKS,
    internalCurrencies: structuredClone(DEFAULT_INTERNAL_CURRENCIES),
    cryptoTrades: [],
  };
}

export function createDefaultAdNetworkConfig(): AdNetworkConfig {
  const smartlink1 = 'https://auctionr.org/4/0a606d1b048f77bbea217fd6022adfb9';
  const smartlink2 = 'https://asiafilm.org/4/ba5f0cab7d2c9b6a8e58a39f6361c4ca';
  const smartlink3 = 'https://asiafilm.org/4/1b98a0e42e68ecdecd4bfcae771e7df4';

  return {
    enabled: true,
    reward30sBdt: 0.3,
    reward15sBdt: 0.15,
    rewardOtherBdt: 0.1,
    adsterraZoneId: '0a606d1b048f77bbea217fd6022adfb9',
    monetagZoneId: '32355300',
    zoneName: 'smart-link-3562738',
    placementName: 'Smartlink_1',
    placementId: '32355300',
    primarySmartlinkUrl: smartlink1,
    smartlinks: [
      {
        id: 'SL-32355300',
        zoneName: 'smart-link-3562738',
        placementName: 'Smartlink_1',
        placementId: '32355300',
        url: smartlink1,
        dashboardId: 'video-dashboard',
        active: true,
      },
      {
        id: 'SL-32355613',
        zoneName: 'smart-link-3562738',
        placementName: 'Smartlink_2',
        placementId: '32355613',
        url: smartlink2,
        dashboardId: 'direct-dashboard',
        active: true,
      },
      {
        id: 'SL-32355645',
        zoneName: 'smart-link-3562738',
        placementName: 'Smartlink_3',
        placementId: '32355645',
        url: smartlink3,
        dashboardId: 'express-dashboard',
        active: true,
      },
    ],
    dashboards: [
      {
        id: 'video-dashboard',
        title: 'ড্যাশবোর্ড ১: ভিডিও এড নেটওয়ার্ক',
        subtitle: 'প্রতিটি ৩০ সেকেন্ডের ভিডিও এডে সরাসরি ৩০ পয়সা (0.30 ৳) আয়',
        adKind: 'video',
        rewardBdt: 0.3,
        durationSeconds: 30,
        requireSmartlinkClick: true,
        allowSkip: false,
        rules: [
          'প্রতিটি ভিডিও এড অবশ্যই সম্পূর্ণ ৩০ সেকেন্ড দেখতে হবে — কোনো এড স্কিপ করা যাবে না।',
          'প্রতিটি সম্পূর্ণ ভিডিও এডের বিনিময়ে ৩০ পয়সা (0.30 ৳) সরাসরি মেইন একাউন্টে যোগ হবে।',
          'অ্যাড দেখার জন্য Smartlink_1 / লাইভ বিজ্ঞাপন ওপেন রেখে পুরো সময় অপেক্ষা করতে হবে।',
          'যত খুশি তত ভিডিও এড দেখা যাবে; সময় পূর্ণ না করে কেটে দিলে রিওয়ার্ড যুক্ত হবে না।',
        ],
        active: true,
      },
      {
        id: 'direct-dashboard',
        title: 'ড্যাশবোর্ড ২: ডাইরেক্ট স্মার্টলিংক ও অফার এড',
        subtitle: 'Smartlink_2 ও অন্যান্য ডাইরেক্ট এড ভিজিট করলে ১০ পয়সা (0.10 ৳) আয়',
        adKind: 'direct',
        rewardBdt: 0.1,
        durationSeconds: 10,
        requireSmartlinkClick: true,
        allowSkip: false,
        rules: [
          'ভিডিও ছাড়া অন্যান্য ডাইরেক্ট ও স্পনসর এডের জন্য প্রতিবার ১০ পয়সা (0.10 ৳) মেইন ব্যালেন্সে যোগ হবে।',
          'অ্যাড ওপেন বাটনে ক্লিক করে Smartlink বিজ্ঞাপন পেজে অন্তত ১০ সেকেন্ড অবস্থান করতে হবে।',
          'সময় পূর্ণ হওয়ার আগে ট্যাব কেটে দিলে বা স্কিপ করলে সার্ভার রিওয়ার্ড যোগ করবে না।',
          'এই ড্যাশবোর্ডে শুধুমাত্র সক্রিয় ও লাইভ থাকা অফার এডগুলোই শো করবে।',
        ],
        active: true,
      },
      {
        id: 'express-dashboard',
        title: 'ড্যাশবোর্ড ৩: এক্সপ্রেস, পপ ও ব্যানার এড',
        subtitle: 'Smartlink_3 ও এক্সপ্রেস স্পনসর এডে প্রতিবার ১০ পয়সা (0.10 ৳) আয়',
        adKind: 'express',
        rewardBdt: 0.1,
        durationSeconds: 10,
        requireSmartlinkClick: true,
        allowSkip: false,
        rules: [
          'এক্সপ্রেস, পপ-এড ও ব্যানার অ্যাড ভিজিটের বিনিময়ে প্রতিবার ১০ পয়সা (0.10 ৳) যোগ হবে।',
          'ক্লিক করার পর Smartlink_3 বিজ্ঞাপন পেজ সম্পূর্ণ লোড হওয়া পর্যন্ত ১০ সেকেন্ড অপেক্ষা করুন।',
          'সব এড এই ড্যাশবোর্ডের রুলস অনুযায়ী সার্ভার থেকে ভেরিফাই হয়ে অটোমেটিক পেমেন্ট হবে।',
          'যেকোনো সময় আনলিমিটেড এক্সপ্রেস অ্যাড দেখে আয় বাড়াতে পারবেন।',
        ],
        active: true,
      },
    ],
    vastTagUrl: '',
    customScriptUrl: '',
    campaigns: [
      {
        id: 'AD-101',
        dashboardId: 'video-dashboard',
        adKind: 'video',
        networkName: 'Smartlink_1 · Adsterra',
        companyName: 'Adsterra Partner Video',
        title: 'Smartlink_1 · 30s High-CPM Video Spot',
        description: 'Zone smart-link-3562738 · Placement ID 32355300 · 30s Non-Skippable Video',
        category: 'Video Ad (৩০ পয়সা)',
        durationSeconds: 30,
        rewardBdt: 0.3,
        videoUrl: '/ads/adsterra-30s.mp4',
        thirdPartyTagUrl: smartlink1,
        zoneName: 'smart-link-3562738',
        placementName: 'Smartlink_1',
        placementId: '32355300',
        accentHex: '#059669',
        active: true,
      },
      {
        id: 'AD-102',
        dashboardId: 'video-dashboard',
        adKind: 'video',
        networkName: 'Smartlink_2 · Video Stream',
        companyName: 'AsiaFilm Partner Showcase',
        title: 'Smartlink_2 · 30s E-Commerce Commercial Video',
        description: 'Zone smart-link-3562738 · Placement ID 32355613 · 30s Non-Skippable Video',
        category: 'Video Ad (৩০ পয়সা)',
        durationSeconds: 30,
        rewardBdt: 0.3,
        videoUrl: '/ads/partner-30s.mp4',
        thirdPartyTagUrl: smartlink2,
        zoneName: 'smart-link-3562738',
        placementName: 'Smartlink_2',
        placementId: '32355613',
        accentHex: '#0284c7',
        active: true,
      },
      {
        id: 'AD-103',
        dashboardId: 'video-dashboard',
        adKind: 'video',
        networkName: 'Smartlink_3 · Video Exchange',
        companyName: 'CyberQuest & Media Video',
        title: 'Smartlink_3 · 30s Gaming & App Promo Video',
        description: 'Zone smart-link-3562738 · Placement ID 32355645 · 30s Non-Skippable Video',
        category: 'Video Ad (৩০ পয়সা)',
        durationSeconds: 30,
        rewardBdt: 0.3,
        videoUrl: '/ads/gaming-30s.mp4',
        thirdPartyTagUrl: smartlink3,
        zoneName: 'smart-link-3562738',
        placementName: 'Smartlink_3',
        placementId: '32355645',
        accentHex: '#7c3aed',
        active: true,
      },
      {
        id: 'AD-201',
        dashboardId: 'direct-dashboard',
        adKind: 'direct',
        networkName: 'Smartlink_2 · Direct Offer',
        companyName: 'Smartlink_2 Direct Sponsor',
        title: 'Direct Sponsor Offer Page Visit (10s)',
        description: 'Zone smart-link-3562738 · Placement ID 32355613 · Other Ad (১০ পয়সা)',
        category: 'Direct Smartlink (১০ পয়সা)',
        durationSeconds: 10,
        rewardBdt: 0.1,
        videoUrl: '',
        thirdPartyTagUrl: smartlink2,
        zoneName: 'smart-link-3562738',
        placementName: 'Smartlink_2',
        placementId: '32355613',
        accentHex: '#0284c7',
        active: true,
      },
      {
        id: 'AD-202',
        dashboardId: 'direct-dashboard',
        adKind: 'direct',
        networkName: 'Smartlink_1 · Direct Offer',
        companyName: 'Auctionr Direct Sponsor',
        title: 'Global High-Converting Smartlink_1 Offer (10s)',
        description: 'Zone smart-link-3562738 · Placement ID 32355300 · Other Ad (১০ পয়সা)',
        category: 'Direct Smartlink (১০ পয়সা)',
        durationSeconds: 10,
        rewardBdt: 0.1,
        videoUrl: '',
        thirdPartyTagUrl: smartlink1,
        zoneName: 'smart-link-3562738',
        placementName: 'Smartlink_1',
        placementId: '32355300',
        accentHex: '#059669',
        active: true,
      },
      {
        id: 'AD-301',
        dashboardId: 'express-dashboard',
        adKind: 'express',
        networkName: 'Smartlink_3 · Express Pop',
        companyName: 'AsiaFilm Express Network',
        title: 'Express Smartlink_3 Banner & Pop Offer (10s)',
        description: 'Zone smart-link-3562738 · Placement ID 32355645 · Express Ad (১০ পয়সা)',
        category: 'Express / Pop Ad (১০ পয়সা)',
        durationSeconds: 10,
        rewardBdt: 0.1,
        videoUrl: '',
        thirdPartyTagUrl: smartlink3,
        zoneName: 'smart-link-3562738',
        placementName: 'Smartlink_3',
        placementId: '32355645',
        accentHex: '#d97706',
        active: true,
      },
      {
        id: 'AD-302',
        dashboardId: 'express-dashboard',
        adKind: 'express',
        networkName: 'Smartlink_2 · Express Banner',
        companyName: 'AsiaFilm Banner Exchange',
        title: 'Express Smartlink_2 Interactive Ad Spot (10s)',
        description: 'Zone smart-link-3562738 · Placement ID 32355613 · Express Ad (১০ পয়সা)',
        category: 'Express / Pop Ad (১০ পয়সা)',
        durationSeconds: 10,
        rewardBdt: 0.1,
        videoUrl: '',
        thirdPartyTagUrl: smartlink2,
        zoneName: 'smart-link-3562738',
        placementName: 'Smartlink_2',
        placementId: '32355613',
        accentHex: '#dc2626',
        active: true,
      },
    ],
  };
}

export function normalizeDatabaseState(raw: DatabaseState): DatabaseState {
  const defaults = createDefaultSiteConfig();
  const adDefaults = createDefaultAdNetworkConfig();
  const incomingAd = raw.config?.adNetwork;

  return {
    ...raw,
    config: {
      ...defaults,
      ...raw.config,
      rates: {
        ...defaults.rates,
        ...(raw.config?.rates || {}),
        usdRateBdt:
          typeof raw.config?.rates?.usdRateBdt === 'number' && raw.config.rates.usdRateBdt > 0
            ? raw.config.rates.usdRateBdt
            : 122,
      },
      theme: {
        ...DEFAULT_UI_THEME,
        ...(raw.config?.theme || {}),
      },
      copy: {
        ...DEFAULT_UI_COPY,
        ...(raw.config?.copy || {}),
      },
      adNetwork: incomingAd
        ? {
            ...adDefaults,
            ...incomingAd,
            rewardOtherBdt:
              typeof incomingAd.rewardOtherBdt === 'number'
                ? incomingAd.rewardOtherBdt
                : adDefaults.rewardOtherBdt,
            smartlinks:
              Array.isArray(incomingAd.smartlinks) && incomingAd.smartlinks.length > 0
                ? incomingAd.smartlinks
                : adDefaults.smartlinks,
            dashboards:
              Array.isArray(incomingAd.dashboards) && incomingAd.dashboards.length > 0
                ? incomingAd.dashboards
                : adDefaults.dashboards,
            campaigns:
              Array.isArray(incomingAd.campaigns) && incomingAd.campaigns.length > 0
                ? incomingAd.campaigns
                : adDefaults.campaigns,
          }
        : adDefaults,
    },
    invites: Array.isArray(raw.invites) ? raw.invites : [],
    deposits: Array.isArray(raw.deposits) ? raw.deposits : [],
    withdraws: Array.isArray(raw.withdraws) ? raw.withdraws : [],
    workSubmissions: Array.isArray(raw.workSubmissions) ? raw.workSubmissions : [],
    p2pTransactions: Array.isArray(raw.p2pTransactions) ? raw.p2pTransactions : [],
    helplineMessages: Array.isArray(raw.helplineMessages) ? raw.helplineMessages : [],
    adWatchLogs: Array.isArray(raw.adWatchLogs) ? raw.adWatchLogs : [],
    districtAgents: Array.isArray(raw.districtAgents) && raw.districtAgents.length > 0 ? raw.districtAgents : DEFAULT_DISTRICT_AGENTS,
    customTasks: Array.isArray(raw.customTasks) ? raw.customTasks : DEFAULT_WORKSPACE_TASKS,
    internalCurrencies:
      Array.isArray(raw.internalCurrencies) && raw.internalCurrencies.length > 0
        ? raw.internalCurrencies
        : structuredClone(DEFAULT_INTERNAL_CURRENCIES),
    cryptoTrades: Array.isArray(raw.cryptoTrades) ? raw.cryptoTrades : [],
  };
}

export function loadSecrets(): ServerSecrets {
  ensureDataDir();
  if (fs.existsSync(SECRETS_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8')) as ServerSecrets;
      if (parsed.sessionSecret) {
        return parsed;
      }
    } catch {
      // recreate below
    }
  }

  const envSecret = process.env.SESSION_SECRET?.trim();
  const envAdmin = process.env.ADMIN_ACCESS_KEY?.trim();

  const secrets: ServerSecrets = {
    sessionSecret: envSecret || crypto.randomBytes(32).toString('hex'),
    adminPasskeyHash: envAdmin ? hashPassword(envAdmin) : null,
  };
  atomicWriteJson(SECRETS_FILE, secrets);
  return secrets;
}

export function saveSecrets(secrets: ServerSecrets): void {
  atomicWriteJson(SECRETS_FILE, secrets);
}

export function loadDatabase(): DatabaseState {
  ensureDataDir();
  if (fs.existsSync(DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as DatabaseState;
      if (parsed && parsed.config && parsed.users) {
        return normalizeDatabaseState(parsed);
      }
    } catch {
      // fall through
    }
  }
  const fresh = createDefaultDatabase();
  atomicWriteJson(DB_FILE, fresh);
  return fresh;
}

export function saveDatabase(db: DatabaseState): void {
  db.updatedAt = Date.now();
  atomicWriteJson(DB_FILE, db);
}

export function loadGitHubConfig(): GitHubSyncConfig {
  ensureDataDir();
  const envCfg: GitHubSyncConfig = {
    owner: process.env.GITHUB_OWNER?.trim() || '',
    repo: process.env.GITHUB_REPO?.trim() || '',
    branch: process.env.GITHUB_BRANCH?.trim() || 'main',
    dataPath: process.env.GITHUB_DATA_PATH?.trim() || 'server-data/myokbi-db.json',
    autoSync: true,
    liveWatch: process.env.GITHUB_LIVE_WATCH !== 'false',
    token: process.env.GITHUB_TOKEN?.trim() || '',
  };

  if (fs.existsSync(GITHUB_CONFIG_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(GITHUB_CONFIG_FILE, 'utf8')) as Partial<GitHubSyncConfig>;
      return {
        owner: saved.owner ?? envCfg.owner,
        repo: saved.repo ?? envCfg.repo,
        branch: saved.branch || envCfg.branch,
        dataPath: saved.dataPath || envCfg.dataPath,
        autoSync: saved.autoSync ?? envCfg.autoSync,
        liveWatch: saved.liveWatch ?? envCfg.liveWatch,
        token: saved.token || envCfg.token,
      };
    } catch {
      return envCfg;
    }
  }
  return envCfg;
}

export function saveGitHubConfig(cfg: GitHubSyncConfig): void {
  atomicWriteJson(GITHUB_CONFIG_FILE, cfg);
}

export function maskToken(token: string): string {
  if (!token) return '';
  if (token.length <= 8) return '••••••••';
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

export function buildGitHubStatus(
  cfg: GitHubSyncConfig,
  runtime: {
    syncing: boolean;
    lastSyncAt: number | null;
    lastRemoteCheckAt: number | null;
    lastCommitSha: string | null;
    lastCommitUrl: string | null;
    lastError: string | null;
    recentCommits: GitHubSyncStatus['recentCommits'];
  }
): GitHubSyncStatus {
  return {
    configured: Boolean(cfg.owner && cfg.repo && cfg.token),
    owner: cfg.owner,
    repo: cfg.repo,
    branch: cfg.branch || 'main',
    dataPath: cfg.dataPath || 'server-data/myokbi-db.json',
    autoSync: cfg.autoSync,
    liveWatch: cfg.liveWatch,
    tokenPreview: maskToken(cfg.token),
    syncing: runtime.syncing,
    lastSyncAt: runtime.lastSyncAt,
    lastRemoteCheckAt: runtime.lastRemoteCheckAt,
    lastCommitSha: runtime.lastCommitSha,
    lastCommitUrl: runtime.lastCommitUrl,
    lastError: runtime.lastError,
    recentCommits: runtime.recentCommits,
  };
}

export function signSessionToken(
  payload: Record<string, unknown>,
  secret: string
): string {
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifySessionToken<T>(token: string | undefined, secret: string): T | null {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as T & { exp?: number };
    if (decoded.exp && Date.now() > decoded.exp) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function generateInviteCode(prefix = 'OKB'): string {
  return `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}
