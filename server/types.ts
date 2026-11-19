export interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  referCode: string;
  referredBy: string;
  level: string;
  balance: number;
  depositBalance: number;
  todayEarn: number;
  completedTasks: number;
  referralBonus: number;
  status: 'Active' | 'Suspended';
  photoUrl: string;
  currencyHoldings?: Record<string, number>;
  createdAt: number;
}

export interface PublicUserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  referCode: string;
  referredBy: string;
  level: string;
  balance: number;
  depositBalance: number;
  todayEarn: number;
  completedTasks: number;
  referralBonus: number;
  status: 'Active' | 'Suspended';
  photoUrl: string;
  currencyHoldings?: Record<string, number>;
  createdAt: number;
}

export interface DepositRequest {
  id: string;
  userId: string;
  userName: string;
  gateway: 'bKash' | 'Nagad' | 'Rocket' | 'USDT';
  senderNumber: string;
  trxId: string;
  amount: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  timestamp: number;
  reviewedAt?: number;
}

export interface WithdrawRequest {
  id: string;
  userId: string;
  userName: string;
  type: 'standard' | 'agent';
  district?: string;
  agentName?: string;
  method: 'bKash' | 'Nagad' | 'Rocket';
  accountNumber: string;
  amount: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  timestamp: number;
  reviewedAt?: number;
}

export interface WorkSubmission {
  id: string;
  userId: string;
  userName: string;
  category: string;
  sheetUrl: string;
  notes: string;
  reward: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  timestamp: number;
  reviewedAt?: number;
}

export interface P2PTransaction {
  id: string;
  trxId: string;
  senderId: string;
  senderCode: string;
  recipientId: string;
  recipientCode: string;
  amount: number;
  serviceCharge: number;
  totalDeduction: number;
  timestamp: number;
}

export interface HelplineMessage {
  id: string;
  userId: string;
  userName: string;
  sender: 'User' | 'Agent' | 'Bot';
  topic: string;
  text: string;
  fileUrl?: string;
  timestamp: number;
}

export interface InviteLink {
  id: string;
  token: string;
  label: string;
  role: 'member' | 'vip';
  maxUses: number;
  usedCount: number;
  active: boolean;
  expiresAt: number | null;
  createdAt: number;
  lastUsedAt: number | null;
}

export interface BannerSlide {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
}

export interface LeaderboardChampion {
  rank: 1 | 2 | 3;
  maskedId: string;
  refers: number;
  prizeLabel: string;
  photoUrl: string;
}

export type AdDashboardId = 'video-dashboard' | 'direct-dashboard' | 'express-dashboard';
export type AdCampaignKind = 'video' | 'direct' | 'express';

export interface SmartlinkEntry {
  id: string;
  zoneName: string;
  placementName: string;
  placementId: string;
  url: string;
  dashboardId?: AdDashboardId;
  active: boolean;
}

export interface AdDashboardConfig {
  id: AdDashboardId;
  title: string;
  subtitle: string;
  adKind: AdCampaignKind;
  rewardBdt: number;
  durationSeconds: number;
  requireSmartlinkClick: boolean;
  allowSkip: boolean;
  rules: string[];
  active: boolean;
}

export interface VideoAdCampaign {
  id: string;
  dashboardId?: AdDashboardId;
  adKind?: AdCampaignKind;
  networkName: string;
  companyName: string;
  title: string;
  description: string;
  category: string;
  durationSeconds: number;
  rewardBdt: number;
  videoUrl: string;
  thirdPartyTagUrl?: string;
  zoneName?: string;
  placementName?: string;
  placementId?: string;
  accentHex: string;
  active: boolean;
}

export interface AdNetworkConfig {
  enabled: boolean;
  reward30sBdt: number;
  reward15sBdt: number;
  rewardOtherBdt?: number;
  adsterraZoneId: string;
  monetagZoneId: string;
  zoneName?: string;
  placementName?: string;
  placementId?: string;
  primarySmartlinkUrl?: string;
  smartlinks?: SmartlinkEntry[];
  dashboards?: AdDashboardConfig[];
  vastTagUrl: string;
  customScriptUrl: string;
  campaigns: VideoAdCampaign[];
}

export interface AdWatchLog {
  id: string;
  adId: string;
  networkName: string;
  companyName: string;
  userId: string;
  userName: string;
  durationSeconds: number;
  rewardBdt: number;
  timestamp: number;
}

export interface UiThemeConfig {
  primaryColor: string;
  primaryTextColor: string;
  accentColor: string;
  vaultColor: string;
  sidebarTextColor: string;
  pageBgColor: string;
  cardBgColor: string;
  cardBorderColor: string;
  headingTextColor: string;
  mutedTextColor: string;
  buttonRadiusPx: number;
  cardRadiusPx: number;
}

export interface UiCopyConfig {
  portalWelcomeTitle: string;
  mainBalanceLabel: string;
  usdRateLabel: string;
  marketPortfolioLabel: string;
  totalNetWorthLabel: string;
  workspaceHeading: string;
  workspaceSubheading: string;
  workerListBtnLabel: string;
  agentBtnLabel: string;
  adNetworkBtnLabel: string;
  tasksBtnLabel: string;
  myJobsBtnLabel: string;
  marketBtnLabel: string;
  depositWithdrawBtnLabel: string;
  p2pBtnLabel: string;
  referBtnLabel: string;
  helplineBtnLabel: string;
  historyBtnLabel: string;
  profileBtnLabel: string;
  idCardHeaderTitle: string;
  submitWorkBtnLabel: string;
  buyCoinBtnLabel: string;
  sellCoinBtnLabel: string;
  footerAboutTitle: string;
  footerAboutText: string;
}

export interface InternalCurrency {
  symbol: string;
  name: string;
  description: string;
  priceBdt: number;
  basePriceBdt: number;
  liquidityPoolBdt: number;
  totalInvestedBdt: number;
  change24hPct: number;
  priceHistory: number[];
  active: boolean;
}

export interface CryptoTradeRecord {
  id: string;
  userId: string;
  userName: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  bdtAmount: number;
  usdAmount: number;
  coinQty: number;
  priceBdt: number;
  priceAfterBdt: number;
  timestamp: number;
}

export interface SiteConfig {
  siteName: string;
  tagline: string;
  privateMode: boolean;
  maintenanceMode: boolean;
  notice: {
    active: boolean;
    title: string;
    text: string;
    updatedAt: number;
  };
  banners: BannerSlide[];
  adminNumbers: {
    bKash: string;
    Nagad: string;
    Rocket: string;
    USDT: string;
  };
  rates: {
    minDeposit: number;
    minWithdraw: number;
    minAgentWithdraw: number;
    taskReward: number;
    referralSignupBonus: number;
    referralCommission: number;
    p2pMin: number;
    p2pMax: number;
    p2pFeePerThousand: number;
    usdRateBdt?: number;
  };
  adNetwork: AdNetworkConfig;
  champions: LeaderboardChampion[];
  baseReferralMeter: number;
  theme?: UiThemeConfig;
  copy?: UiCopyConfig;
}

export interface GitHubSyncConfig {
  owner: string;
  repo: string;
  branch: string;
  dataPath: string;
  autoSync: boolean;
  liveWatch: boolean;
  token: string;
}

export interface GitHubCommitRecord {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export interface GitHubSyncStatus {
  configured: boolean;
  owner: string;
  repo: string;
  branch: string;
  dataPath: string;
  autoSync: boolean;
  liveWatch: boolean;
  tokenPreview: string;
  syncing: boolean;
  lastSyncAt: number | null;
  lastRemoteCheckAt: number | null;
  lastCommitSha: string | null;
  lastCommitUrl: string | null;
  lastError: string | null;
  recentCommits: GitHubCommitRecord[];
}

export interface DistrictAgentItem {
  id: string;
  district: string;
  agent: string;
  phone?: string;
  active: boolean;
}

export interface CustomTaskItem {
  id: string;
  category: string;
  title: string;
  description: string;
  instructions: string;
  rewardBdt: number;
  sheetUrl?: string;
  active: boolean;
  createdAt: number;
}

export interface DatabaseState {
  version: number;
  updatedAt: number;
  config: SiteConfig;
  invites: InviteLink[];
  users: Record<string, UserRecord>;
  deposits: DepositRequest[];
  withdraws: WithdrawRequest[];
  workSubmissions: WorkSubmission[];
  p2pTransactions: P2PTransaction[];
  helplineMessages: HelplineMessage[];
  adWatchLogs: AdWatchLog[];
  districtAgents?: DistrictAgentItem[];
  customTasks?: CustomTaskItem[];
  internalCurrencies?: InternalCurrency[];
  cryptoTrades?: CryptoTradeRecord[];
}

export interface ServerSecrets {
  sessionSecret: string;
  adminPasskeyHash: string | null;
}

