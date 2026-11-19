import type { UiCopyConfig, UiThemeConfig } from '../types';

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
  footerAboutText:
    'Myokbi is a private digital earning and micro-task management ecosystem with internal asset exchange.',
};

export function resolveUiCopy(copy?: Partial<UiCopyConfig>): UiCopyConfig {
  return {
    ...DEFAULT_UI_COPY,
    ...(copy || {}),
  };
}

export function resolveUiTheme(theme?: Partial<UiThemeConfig>): UiThemeConfig {
  return {
    ...DEFAULT_UI_THEME,
    ...(theme || {}),
  };
}

export function applyThemeVariables(theme?: Partial<UiThemeConfig>): void {
  const t = resolveUiTheme(theme);
  const root = document.documentElement;
  root.style.setProperty('--okb-primary', t.primaryColor);
  root.style.setProperty('--okb-primary-text', t.primaryTextColor);
  root.style.setProperty('--okb-accent', t.accentColor);
  root.style.setProperty('--okb-vault', t.vaultColor);
  root.style.setProperty('--okb-sidebar-text', t.sidebarTextColor);
  root.style.setProperty('--okb-bg', t.pageBgColor);
  root.style.setProperty('--okb-card', t.cardBgColor);
  root.style.setProperty('--okb-border', t.cardBorderColor);
  root.style.setProperty('--okb-text', t.headingTextColor);
  root.style.setProperty('--okb-muted', t.mutedTextColor);
  root.style.setProperty('--okb-btn-radius', `${Number(t.buttonRadiusPx || 12)}px`);
  root.style.setProperty('--okb-card-radius', `${Number(t.cardRadiusPx || 16)}px`);
}
