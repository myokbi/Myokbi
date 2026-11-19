import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import crypto from 'crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import {
  checkRemoteGitHubUpdate,
  listGitHubCommits,
  pullSnapshotFromGitHub,
  pushSnapshotToGitHub,
  testGitHubConnection,
} from './server/githubSync.ts';
import {
  buildGitHubStatus,
  DEFAULT_DISTRICT_AGENTS,
  DEFAULT_INTERNAL_CURRENCIES,
  DEFAULT_WORKSPACE_TASKS,
  DISTRICT_AGENT_LIST,
  generateInviteCode,
  hashPassword,
  loadDatabase,
  loadGitHubConfig,
  loadSecrets,
  normalizeDatabaseState,
  sanitizeUser,
  saveDatabase,
  saveGitHubConfig,
  saveSecrets,
  signSessionToken,
  THIRTY_MINUTES_MS,
  verifyPassword,
  verifySessionToken,
} from './server/store.ts';
import type {
  CustomTaskItem,
  DatabaseState,
  DistrictAgentItem,
  GitHubCommitRecord,
  GitHubSyncConfig,
  InternalCurrency,
  SiteConfig,
} from './server/types.ts';

const PORT = Number(process.env.PORT || 3000);
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || '';
const aiClient = geminiApiKey
  ? new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    })
  : null;

interface InviteSessionPayload {
  kind: 'invite';
  inviteId: string;
  role: 'member' | 'vip';
  exp: number;
}

interface AdminSessionPayload {
  kind: 'admin';
  exp: number;
}

interface UserSessionPayload {
  kind: 'user';
  userId: string;
  exp: number;
}

interface SSEClient {
  id: string;
  res: Response;
  isAdmin: boolean;
  userId: string | null;
}

let dbState: DatabaseState = loadDatabase();
let secrets = loadSecrets();
let ghConfig: GitHubSyncConfig = loadGitHubConfig();

const ghRuntime: {
  syncing: boolean;
  lastSyncAt: number | null;
  lastRemoteCheckAt: number | null;
  lastCommitSha: string | null;
  lastCommitUrl: string | null;
  lastKnownContentSha: string | null;
  lastEtag: string | null;
  lastError: string | null;
  recentCommits: GitHubCommitRecord[];
} = {
  syncing: false,
  lastSyncAt: null,
  lastRemoteCheckAt: null,
  lastCommitSha: null,
  lastCommitUrl: null,
  lastKnownContentSha: null,
  lastEtag: null,
  lastError: null,
  recentCommits: [],
};

const sseClients = new Map<string, SSEClient>();
const claimedAdWatchIds = new Set<string>();
let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;

interface AdWatchTokenPayload {
  kind: 'ad-watch';
  watchId: string;
  userId: string;
  adId: string;
  dashboardId: string;
  adKind: string;
  networkName: string;
  companyName: string;
  durationSeconds: number;
  rewardBdt: number;
  requireSmartlinkClick: boolean;
  startedAt: number;
  exp: number;
}

let smartlinkRotationCounter = 0;

function extractSafeUrlOrScriptSrc(raw?: string): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  const scriptSrcMatch = value.match(/src\s*=\s*['"](https?:\/\/[^'"]+)['"]/i);
  if (scriptSrcMatch?.[1]) {
    return scriptSrcMatch[1].trim();
  }
  const urlMatch = value.match(/(https?:\/\/[^\s"'<>]+)/i);
  return urlMatch?.[1]?.trim() || value;
}

function parseSmartlinksInput(rawInput: string): Array<{
  zoneName: string;
  placementName: string;
  placementId: string;
  url: string;
}> {
  const lines = rawInput
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const parsed: Array<{ zoneName: string; placementName: string; placementId: string; url: string }> = [];

  for (const line of lines) {
    if (/zone name/i.test(line) && /placement id/i.test(line)) {
      continue;
    }

    const urlMatch = line.match(/(https?:\/\/[^\s"',<>]+)/i);
    if (!urlMatch?.[1]) continue;
    const url = urlMatch[1].trim();

    const csvCells = line
      .split(',')
      .map((cell) => cell.replace(/^["']|["']$/g, '').trim())
      .filter(Boolean);

    if (csvCells.length >= 4 && /^https?:\/\//i.test(csvCells[csvCells.length - 1])) {
      parsed.push({
        zoneName: csvCells[0] || 'smart-link',
        placementName: csvCells[1] || 'Smartlink',
        placementId: csvCells[2] || '',
        url: csvCells[csvCells.length - 1],
      });
    } else {
      parsed.push({
        zoneName: csvCells[0] && !/^https?:\/\//i.test(csvCells[0]) ? csvCells[0] : 'smartlink-zone',
        placementName: csvCells[1] && !/^https?:\/\//i.test(csvCells[1]) ? csvCells[1] : 'Direct Smartlink',
        placementId: csvCells[2] && !/^https?:\/\//i.test(csvCells[2]) ? csvCells[2] : '',
        url,
      });
    }
  }

  return parsed;
}

async function tryResolveVastMediaUrl(tagUrl?: string): Promise<string> {
  const url = String(tagUrl || '').trim();
  if (!url) return '';
  if (/\.(mp4|webm|m3u8)(\?|$)/i.test(url)) return url;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return '';
    const text = await res.text();
    const match = text.match(/<MediaFile[^>]*>(?:<!\[CDATA\[)?\s*(https?:\/\/[^<\s\]]+)/i);
    return match?.[1]?.trim() || '';
  } catch {
    return '';
  }
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    result[key] = val;
  }
  return result;
}

function getInviteSession(req: Request): InviteSessionPayload | null {
  const cookies = parseCookies(req);
  const token = (req.headers['x-private-token'] as string | undefined) || cookies.okb_invite;
  const decoded = verifySessionToken<InviteSessionPayload>(token, secrets.sessionSecret);
  if (!decoded || decoded.kind !== 'invite') return null;
  // Verify invite is still active unless it is an admin preview token
  if (decoded.inviteId !== 'admin-preview') {
    const inv = dbState.invites.find((i) => i.id === decoded.inviteId);
    if (!inv || !inv.active) return null;
    if (inv.expiresAt && Date.now() > inv.expiresAt) return null;
  }
  return decoded;
}

function getAdminSession(req: Request): AdminSessionPayload | null {
  const cookies = parseCookies(req);
  const token = (req.headers['x-admin-token'] as string | undefined) || cookies.okb_admin;
  const decoded = verifySessionToken<AdminSessionPayload>(token, secrets.sessionSecret);
  if (!decoded || decoded.kind !== 'admin') return null;
  return decoded;
}

function getUserSession(req: Request): UserSessionPayload | null {
  const cookies = parseCookies(req);
  const token = (req.headers['x-user-token'] as string | undefined) || cookies.okb_user;
  const decoded = verifySessionToken<UserSessionPayload>(token, secrets.sessionSecret);
  if (!decoded || decoded.kind !== 'user') return null;
  if (!dbState.users[decoded.userId]) return null;
  return decoded;
}

function broadcastEvent(event: string, payload: Record<string, unknown>): void {
  const serialized = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients.values()) {
    try {
      client.res.write(serialized);
    } catch {
      sseClients.delete(client.id);
    }
  }
}

function scheduleGitHubAutoSync(reason: string): void {
  if (!ghConfig.autoSync || !ghConfig.owner || !ghConfig.repo || !ghConfig.token) {
    return;
  }
  if (autoSyncTimer) {
    clearTimeout(autoSyncTimer);
  }
  autoSyncTimer = setTimeout(() => {
    void executeGitHubPush(`Auto-sync: ${reason}`);
  }, 2500);
}

async function executeGitHubPush(commitMessage: string): Promise<{ sha: string; htmlUrl: string; committedAt: number }> {
  ghRuntime.syncing = true;
  ghRuntime.lastError = null;
  broadcastEvent('github:status', { status: buildGitHubStatus(ghConfig, ghRuntime) });

  try {
    const res = await pushSnapshotToGitHub(ghConfig, dbState, commitMessage);
    ghRuntime.lastSyncAt = res.committedAt;
    ghRuntime.lastCommitSha = res.sha;
    ghRuntime.lastCommitUrl = res.htmlUrl;
    ghRuntime.lastKnownContentSha = res.contentSha || null;
    ghRuntime.lastEtag = null;
    ghRuntime.lastError = null;
    ghRuntime.recentCommits = await listGitHubCommits(ghConfig);
    return res;
  } catch (err) {
    ghRuntime.lastError = err instanceof Error ? err.message : 'Unknown GitHub sync error';
    throw err;
  } finally {
    ghRuntime.syncing = false;
    broadcastEvent('github:status', { status: buildGitHubStatus(ghConfig, ghRuntime) });
  }
}

async function pollGitHubLiveChanges(forceCheck = false): Promise<boolean> {
  if (!ghConfig.owner || !ghConfig.repo || !ghConfig.token) {
    return false;
  }
  if (!forceCheck && !ghConfig.liveWatch) {
    return false;
  }
  if (ghRuntime.syncing) {
    return false;
  }

  try {
    const result = await checkRemoteGitHubUpdate(
      ghConfig,
      forceCheck ? null : ghRuntime.lastEtag,
      forceCheck ? null : ghRuntime.lastKnownContentSha
    );
    ghRuntime.lastRemoteCheckAt = Date.now();
    if (result.etag !== undefined) {
      ghRuntime.lastEtag = result.etag ?? ghRuntime.lastEtag;
    }

    if (result.changed && result.state) {
      dbState = normalizeDatabaseState(result.state);
      saveDatabase(dbState);
      ghRuntime.lastSyncAt = Date.now();
      ghRuntime.lastKnownContentSha = result.contentSha || null;
      ghRuntime.lastError = null;
      ghRuntime.recentCommits = await listGitHubCommits(ghConfig);
      if (ghRuntime.recentCommits[0]) {
        ghRuntime.lastCommitSha = ghRuntime.recentCommits[0].sha;
        ghRuntime.lastCommitUrl = ghRuntime.recentCommits[0].url;
      }
      broadcastEvent('state:updated', { updatedAt: dbState.updatedAt, reason: 'github-live-sync' });
      broadcastEvent('config:updated', { updatedAt: dbState.updatedAt, reason: 'github-live-sync' });
      broadcastEvent('github:status', { status: buildGitHubStatus(ghConfig, ghRuntime) });
      return true;
    }

    ghRuntime.lastError = null;
    return false;
  } catch (err) {
    ghRuntime.lastError = err instanceof Error ? err.message : 'GitHub live watcher failed';
    broadcastEvent('github:status', { status: buildGitHubStatus(ghConfig, ghRuntime) });
    return false;
  }
}

async function syncFromGitHubStartup(): Promise<void> {
  if (!ghConfig.owner || !ghConfig.repo || !ghConfig.token) {
    return;
  }
  ghRuntime.syncing = true;
  try {
    const pulled = await pullSnapshotFromGitHub(ghConfig);
    dbState = normalizeDatabaseState(pulled.state);
    saveDatabase(dbState);
    ghRuntime.lastSyncAt = Date.now();
    ghRuntime.lastRemoteCheckAt = Date.now();
    ghRuntime.lastKnownContentSha = pulled.contentSha || null;
    ghRuntime.lastEtag = pulled.etag ?? null;
    ghRuntime.lastError = null;
    ghRuntime.recentCommits = await listGitHubCommits(ghConfig);
    if (ghRuntime.recentCommits[0]) {
      ghRuntime.lastCommitSha = ghRuntime.recentCommits[0].sha;
      ghRuntime.lastCommitUrl = ghRuntime.recentCommits[0].url;
    }
    broadcastEvent('state:updated', { updatedAt: dbState.updatedAt, reason: 'github-startup-pull' });
    broadcastEvent('config:updated', { updatedAt: dbState.updatedAt, reason: 'github-startup-pull' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('(404)')) {
      try {
        await executeGitHubPush('Initial Myokbi database snapshot');
      } catch (pushErr) {
        ghRuntime.lastError = pushErr instanceof Error ? pushErr.message : 'Initial GitHub push failed';
      }
    } else {
      ghRuntime.lastError = msg || 'GitHub startup sync failed';
    }
  } finally {
    ghRuntime.syncing = false;
    broadcastEvent('github:status', { status: buildGitHubStatus(ghConfig, ghRuntime) });
  }
}

function persistAndBroadcast(reason: string, event = 'state:updated'): void {
  saveDatabase(dbState);
  broadcastEvent(event, { updatedAt: dbState.updatedAt, reason });
  scheduleGitHubAutoSync(reason);
}

function purgeExpiredHelplineMessages(): boolean {
  const now = Date.now();
  const before = dbState.helplineMessages.length;
  dbState.helplineMessages = dbState.helplineMessages.filter((m) => now - m.timestamp <= THIRTY_MINUTES_MS);
  return dbState.helplineMessages.length !== before;
}

function requirePrivateAccess(req: Request, res: Response, next: NextFunction): void {
  if (!dbState.config.privateMode) {
    next();
    return;
  }
  if (getAdminSession(req) || getInviteSession(req)) {
    next();
    return;
  }
  res.status(403).json({
    error: 'Private portal access required. Please open this app using an authorized invite link.',
    code: 'PRIVATE_ACCESS_REQUIRED',
  });
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!getAdminSession(req)) {
    res.status(401).json({ error: 'Owner admin authentication required.', code: 'ADMIN_AUTH_REQUIRED' });
    return;
  }
  next();
}

function requireMember(req: Request, res: Response, next: NextFunction): void {
  const session = getUserSession(req);
  if (!session) {
    res.status(401).json({ error: 'Please sign in to your member account.', code: 'USER_AUTH_REQUIRED' });
    return;
  }
  const user = dbState.users[session.userId];
  if (!user || user.status === 'Suspended') {
    res.status(403).json({ error: 'Account unavailable or suspended.' });
    return;
  }
  next();
}

function computePoolMarketCapUsd(): number {
  let totalPoolBdt = 0;
  for (const u of Object.values(dbState.users)) {
    totalPoolBdt += Number(u.balance || 0);
  }
  const rate = dbState.config.rates.usdRateBdt || 122;
  return totalPoolBdt / rate + 1250000;
}

function buildPublicSitePayload() {
  return {
    config: dbState.config,
    poolMarketCapUsd: computePoolMarketCapUsd(),
    totalMembers: Object.keys(dbState.users).length,
  };
}

let cachedCryptoMarkets: { fetchedAt: number; items: unknown[] } | null = null;
const FALLBACK_MARKETS = [
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc', current_price: 91450.0, price_change_percentage_24h: 2.34 },
  { id: 'ethereum', name: 'Ethereum', symbol: 'eth', current_price: 3180.5, price_change_percentage_24h: 1.82 },
  { id: 'binancecoin', name: 'BNB', symbol: 'bnb', current_price: 628.4, price_change_percentage_24h: 0.94 },
  { id: 'solana', name: 'Solana', symbol: 'sol', current_price: 214.1, price_change_percentage_24h: 4.12 },
  { id: 'ripple', name: 'XRP', symbol: 'xrp', current_price: 1.12, price_change_percentage_24h: -0.65 },
  { id: 'dogecoin', name: 'Dogecoin', symbol: 'doge', current_price: 0.36, price_change_percentage_24h: 3.18 },
];

async function startServer() {
  const app = express();
  const uploadsDir = path.resolve(process.cwd(), 'data', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/ads', express.static(path.resolve(process.cwd(), 'public', 'ads')));
  app.use('/uploads', express.static(uploadsDir));
  app.use(
    express.json({
      limit: '12mb',
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );

  // Background 30-minute helpline cleanup
  setInterval(() => {
    if (purgeExpiredHelplineMessages()) {
      saveDatabase(dbState);
      broadcastEvent('chat:updated', { updatedAt: Date.now() });
    }
  }, 60_000);

  // Background real-time GitHub live watcher (15s ETag-cached poll)
  setInterval(() => {
    void pollGitHubLiveChanges(false);
  }, 15_000);

  // =========================================================================
  // 1. ACCESS GATE & ADMIN AUTH ROUTES
  // =========================================================================
  app.get('/api/access/status', (req, res) => {
    const inviteSession = getInviteSession(req);
    const adminSession = getAdminSession(req);
    const userSession = getUserSession(req);
    const hasAccess = !dbState.config.privateMode || Boolean(inviteSession || adminSession);

    res.json({
      privateMode: dbState.config.privateMode,
      maintenanceMode: dbState.config.maintenanceMode,
      hasInviteAccess: hasAccess,
      isAdmin: Boolean(adminSession),
      adminInitialized: Boolean(secrets.adminPasskeyHash),
      isLoggedInUser: Boolean(userSession),
      siteName: dbState.config.siteName,
      tagline: dbState.config.tagline,
      theme: dbState.config.theme,
    });
  });

  app.post('/api/access/verify-invite', (req, res) => {
    const rawToken = String((req.body as { token?: string })?.token || '').trim();
    if (!rawToken) {
      res.status(400).json({ error: 'Invite code is required.' });
      return;
    }

    // Extract token if user pasted a full URL like https://.../?invite=OKB-XXXX
    let extracted = rawToken;
    try {
      if (rawToken.includes('invite=')) {
        const parsedUrl = new URL(rawToken.startsWith('http') ? rawToken : `https://example.com/${rawToken}`);
        extracted = parsedUrl.searchParams.get('invite') || rawToken;
      }
    } catch {
      extracted = rawToken;
    }

    const invite = dbState.invites.find((i) => i.token.toLowerCase() === extracted.toLowerCase());
    if (!invite) {
      res.status(403).json({ error: 'Invalid private invite link or code.' });
      return;
    }
    if (!invite.active) {
      res.status(403).json({ error: 'This invite link has been revoked by the owner.' });
      return;
    }
    if (invite.expiresAt && Date.now() > invite.expiresAt) {
      res.status(403).json({ error: 'This invite link has expired.' });
      return;
    }
    if (invite.usedCount >= invite.maxUses) {
      res.status(403).json({ error: 'This invite link has reached its maximum usage limit.' });
      return;
    }

    invite.usedCount += 1;
    invite.lastUsedAt = Date.now();
    persistAndBroadcast('invite-used', 'admin:updated');

    const privateToken = signSessionToken(
      {
        kind: 'invite',
        inviteId: invite.id,
        role: invite.role,
        exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
      },
      secrets.sessionSecret
    );

    res.cookie('okb_invite', privateToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      ok: true,
      privateToken,
      label: invite.label,
      role: invite.role,
    });
  });

  app.post('/api/admin/setup', (req, res) => {
    if (secrets.adminPasskeyHash) {
      res.status(409).json({ error: 'Owner passkey is already configured. Please sign in.' });
      return;
    }
    const passkey = String((req.body as { passkey?: string })?.passkey || '').trim();
    if (passkey.length < 6) {
      res.status(400).json({ error: 'Owner passkey must be at least 6 characters.' });
      return;
    }

    secrets.adminPasskeyHash = hashPassword(passkey);
    saveSecrets(secrets);

    const adminToken = signSessionToken(
      { kind: 'admin', exp: Date.now() + 7 * 24 * 60 * 60 * 1000 },
      secrets.sessionSecret
    );
    const previewInviteToken = signSessionToken(
      { kind: 'invite', inviteId: 'admin-preview', role: 'vip', exp: Date.now() + 7 * 24 * 60 * 60 * 1000 },
      secrets.sessionSecret
    );

    res.cookie('okb_admin', adminToken, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.cookie('okb_invite', previewInviteToken, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json({ ok: true, adminToken, privateToken: previewInviteToken });
  });

  app.post('/api/admin/login', (req, res) => {
    if (!secrets.adminPasskeyHash) {
      res.status(400).json({ error: 'Owner passkey has not been initialized yet.' });
      return;
    }
    const passkey = String((req.body as { passkey?: string })?.passkey || '').trim();
    if (!verifyPassword(passkey, secrets.adminPasskeyHash)) {
      res.status(401).json({ error: 'Invalid Owner passkey.' });
      return;
    }

    const adminToken = signSessionToken(
      { kind: 'admin', exp: Date.now() + 7 * 24 * 60 * 60 * 1000 },
      secrets.sessionSecret
    );
    const previewInviteToken = signSessionToken(
      { kind: 'invite', inviteId: 'admin-preview', role: 'vip', exp: Date.now() + 7 * 24 * 60 * 60 * 1000 },
      secrets.sessionSecret
    );

    res.cookie('okb_admin', adminToken, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.cookie('okb_invite', previewInviteToken, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json({ ok: true, adminToken, privateToken: previewInviteToken });
  });

  app.post('/api/admin/logout', (_req, res) => {
    res.clearCookie('okb_admin', { path: '/' });
    res.json({ ok: true });
  });

  // =========================================================================
  // 2. REAL-TIME SSE STREAM (Direct GitHub & Server Live Sync)
  // =========================================================================
  app.get('/api/stream', (req, res) => {
    const queryPrivate = req.query.pt ? String(req.query.pt) : undefined;
    const queryAdmin = req.query.at ? String(req.query.at) : undefined;
    const queryUser = req.query.ut ? String(req.query.ut) : undefined;

    if (queryPrivate) req.headers['x-private-token'] = queryPrivate;
    if (queryAdmin) req.headers['x-admin-token'] = queryAdmin;
    if (queryUser) req.headers['x-user-token'] = queryUser;

    const adminSession = getAdminSession(req);
    const inviteSession = getInviteSession(req);

    if (dbState.config.privateMode && !adminSession && !inviteSession) {
      res.status(403).end();
      return;
    }

    const userSession = getUserSession(req);
    const clientId = crypto.randomUUID();

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    sseClients.set(clientId, {
      id: clientId,
      res,
      isAdmin: Boolean(adminSession),
      userId: userSession?.userId || null,
    });

    res.write(`event: connected\ndata: ${JSON.stringify({ clientId, updatedAt: dbState.updatedAt })}\n\n`);

    const keepAlive = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(keepAlive);
        sseClients.delete(clientId);
      }
    }, 25_000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(clientId);
    });
  });

  // =========================================================================
  // 3. PRIVATE PORTAL & MEMBER AUTH ROUTES
  // =========================================================================
  app.get('/api/site', requirePrivateAccess, (_req, res) => {
    res.json(buildPublicSitePayload());
  });

  app.get('/api/districts', requirePrivateAccess, (_req, res) => {
    const list = dbState.districtAgents && dbState.districtAgents.length > 0 ? dbState.districtAgents : DEFAULT_DISTRICT_AGENTS;
    res.json({ districts: list });
  });

  app.get('/api/tasks', requirePrivateAccess, (_req, res) => {
    const list = dbState.customTasks && dbState.customTasks.length > 0 ? dbState.customTasks : DEFAULT_WORKSPACE_TASKS;
    res.json({ tasks: list });
  });

  app.post('/api/auth/register', requirePrivateAccess, (req, res) => {
    const body = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      password?: string;
      referralCode?: string;
    };

    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    const password = String(body.password || '');
    const referralCode = String(body.referralCode || '').trim();

    if (!name || !email || !phone || password.length < 4) {
      res.status(400).json({ error: 'Name, email, phone, and password (min 4 chars) are required.' });
      return;
    }

    const duplicate = Object.values(dbState.users).find((u) => u.email.toLowerCase() === email);
    if (duplicate) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    let userId = `M${Math.floor(100000 + Math.random() * 900000)}`;
    while (dbState.users[userId]) {
      userId = `M${Math.floor(100000 + Math.random() * 900000)}`;
    }
    const referCode = `OKB-${userId}`;

    let validReferredBy = '';
    if (referralCode) {
      const inviter = Object.values(dbState.users).find(
        (u) => u.referCode.toLowerCase() === referralCode.toLowerCase() || u.id.toLowerCase() === referralCode.toLowerCase()
      );
      if (inviter) {
        validReferredBy = inviter.referCode;
        const bonus = dbState.config.rates.referralSignupBonus;
        inviter.referralBonus += bonus;
        inviter.balance += bonus;
      }
    }

    const newUser = {
      id: userId,
      name,
      email,
      phone,
      passwordHash: hashPassword(password),
      referCode,
      referredBy: validReferredBy,
      level: 'Data Entry / Member',
      balance: 0,
      depositBalance: 0,
      todayEarn: 0,
      completedTasks: 0,
      referralBonus: 0,
      status: 'Active' as const,
      photoUrl: '/src/assets/images/avatar_member_default_1795024942538.jpg',
      createdAt: Date.now(),
    };

    dbState.users[userId] = newUser;
    persistAndBroadcast(`member-registered:${userId}`);

    const userToken = signSessionToken(
      { kind: 'user', userId, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 },
      secrets.sessionSecret
    );
    res.cookie('okb_user', userToken, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 30 * 24 * 60 * 60 * 1000 });

    res.json({ ok: true, userToken, user: sanitizeUser(newUser) });
  });

  app.post('/api/auth/login', requirePrivateAccess, (req, res) => {
    const body = req.body as { email?: string; password?: string };
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    const matched = Object.values(dbState.users).find((u) => u.email.toLowerCase() === email);
    if (!matched || !verifyPassword(password, matched.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    if (matched.status === 'Suspended') {
      res.status(403).json({ error: 'This account has been suspended by the administrator.' });
      return;
    }

    const userToken = signSessionToken(
      { kind: 'user', userId: matched.id, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 },
      secrets.sessionSecret
    );
    res.cookie('okb_user', userToken, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 30 * 24 * 60 * 60 * 1000 });

    res.json({ ok: true, userToken, user: sanitizeUser(matched) });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie('okb_user', { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/member/state', requirePrivateAccess, requireMember, (req, res) => {
    const session = getUserSession(req)!;
    const user = dbState.users[session.userId];
    const now = Date.now();
    purgeExpiredHelplineMessages();

    const myDeposits = dbState.deposits.filter((d) => d.userId === user.id);
    const myWithdraws = dbState.withdraws.filter((w) => w.userId === user.id);
    const myWorks = dbState.workSubmissions.filter((w) => w.userId === user.id);
    const myP2P = dbState.p2pTransactions.filter((t) => t.senderId === user.id || t.recipientId === user.id);
    const myChats = dbState.helplineMessages.filter((m) => m.userId === user.id);
    const myAdWatches = dbState.adWatchLogs.filter((l) => l.userId === user.id);
    const activeTasks = (dbState.customTasks && dbState.customTasks.length > 0 ? dbState.customTasks : DEFAULT_WORKSPACE_TASKS).filter(
      (t) => t.active
    );
    const internalCurrencies =
      dbState.internalCurrencies && dbState.internalCurrencies.length > 0
        ? dbState.internalCurrencies
        : DEFAULT_INTERNAL_CURRENCIES;
    const myTrades = (dbState.cryptoTrades || []).filter((t) => t.userId === user.id);
    const referredUsers = Object.values(dbState.users)
      .filter((u) => u.referredBy === user.referCode || u.referredBy === user.id)
      .map((u) => ({
        id: u.id,
        name: u.name,
        level: u.level,
        createdAt: u.createdAt,
      }));

    res.json({
      user: sanitizeUser(user),
      site: buildPublicSitePayload(),
      deposits: myDeposits.slice().reverse(),
      withdraws: myWithdraws.slice().reverse(),
      workSubmissions: myWorks.slice().reverse(),
      p2pTransactions: myP2P.slice().reverse(),
      helplineMessages: myChats,
      adWatchLogs: myAdWatches.slice(-100).reverse(),
      customTasks: activeTasks,
      internalCurrencies: internalCurrencies.filter((c) => c.active),
      cryptoTrades: myTrades.slice(-50).reverse(),
      referredUsers,
      sevenDayFilterCutoff: now - SEVEN_DAYS_MS,
    });
  });

  // Member Photo Upload (saves hosted image file & links to ID card)
  app.post('/api/member/photo', requirePrivateAccess, requireMember, (req, res) => {
    const session = getUserSession(req)!;
    const user = dbState.users[session.userId];
    const body = req.body as { imageBase64?: string; photoUrl?: string };

    if (body.imageBase64 && body.imageBase64.startsWith('data:image/')) {
      const match = body.imageBase64.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
      if (!match) {
        res.status(400).json({ error: 'Only PNG, JPG, or WebP images are supported.' });
        return;
      }
      const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.length > 4 * 1024 * 1024) {
        res.status(400).json({ error: 'Image size must be under 4 MB.' });
        return;
      }
      const fileName = `avatar-${user.id}-${Date.now()}.${ext}`;
      const targetPath = path.join(uploadsDir, fileName);
      fs.writeFileSync(targetPath, buffer);
      user.photoUrl = `/uploads/${fileName}`;
      persistAndBroadcast(`photo-uploaded:${user.id}`);
      res.json({ ok: true, photoUrl: user.photoUrl, user: sanitizeUser(user) });
      return;
    }

    const url = String(body.photoUrl || '').trim();
    if (url && (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('/'))) {
      user.photoUrl = url;
      persistAndBroadcast(`photo-linked:${user.id}`);
      res.json({ ok: true, photoUrl: user.photoUrl, user: sanitizeUser(user) });
      return;
    }

    res.status(400).json({ error: 'Please select an image file or provide a valid photo URL.' });
  });

  // Internal Network Currency Buy / Sell (Dynamic Supply & Demand Pricing)
  app.post('/api/market/trade', requirePrivateAccess, requireMember, (req, res) => {
    const session = getUserSession(req)!;
    const user = dbState.users[session.userId];
    const body = req.body as { symbol?: string; side?: 'BUY' | 'SELL'; amount?: number };

    const symbol = String(body.symbol || '').trim().toUpperCase();
    const side = body.side === 'SELL' ? 'SELL' : body.side === 'BUY' ? 'BUY' : null;
    const amount = Number(body.amount || 0);

    if (!symbol || !side || !Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'Valid currency symbol, trade side (BUY/SELL), and positive amount are required.' });
      return;
    }

    if (!dbState.internalCurrencies || dbState.internalCurrencies.length === 0) {
      dbState.internalCurrencies = structuredClone(DEFAULT_INTERNAL_CURRENCIES);
    }
    const currency = dbState.internalCurrencies.find((c) => c.symbol.toUpperCase() === symbol && c.active);
    if (!currency) {
      res.status(404).json({ error: 'Selected currency is unavailable inside the Myokbi network.' });
      return;
    }

    const usdRateBdt = dbState.config.rates.usdRateBdt || 122;
    user.currencyHoldings = user.currencyHoldings || {};
    dbState.cryptoTrades = dbState.cryptoTrades || [];

    const currentPrice = Number(currency.priceBdt);

    if (side === 'BUY') {
      // amount is BDT invested from main balance
      const investBdt = Number(amount.toFixed(2));
      if (investBdt < 10) {
        res.status(400).json({ error: 'Minimum buy order is 10 BDT.' });
        return;
      }
      if (user.balance < investBdt) {
        res.status(400).json({ error: 'Insufficient Main Balance (BDT).' });
        return;
      }

      const coinQty = Number((investBdt / currentPrice).toFixed(6));
      user.balance = Number((user.balance - investBdt).toFixed(2));
      user.currencyHoldings[symbol] = Number(((user.currencyHoldings[symbol] || 0) + coinQty).toFixed(6));

      // Supply/demand price surge when users invest
      const pool = Math.max(50000, currency.liquidityPoolBdt || 250000);
      const impactRatio = symbol === 'USDX' ? 0 : Math.min(0.18, investBdt / pool);
      const newPrice = Number((currentPrice * (1 + impactRatio)).toFixed(2));

      currency.priceBdt = newPrice;
      currency.totalInvestedBdt = Number((currency.totalInvestedBdt + investBdt).toFixed(2));
      currency.change24hPct = Number((((newPrice - currency.basePriceBdt) / currency.basePriceBdt) * 100).toFixed(2));
      currency.priceHistory = [...(currency.priceHistory || [currency.basePriceBdt]), newPrice].slice(-40);

      const trade = {
        id: `TRD-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        userId: user.id,
        userName: user.name,
        symbol,
        side: 'BUY' as const,
        bdtAmount: investBdt,
        usdAmount: Number((investBdt / usdRateBdt).toFixed(2)),
        coinQty,
        priceBdt: currentPrice,
        priceAfterBdt: newPrice,
        timestamp: Date.now(),
      };
      dbState.cryptoTrades.push(trade);
      if (dbState.cryptoTrades.length > 2000) dbState.cryptoTrades = dbState.cryptoTrades.slice(-2000);

      persistAndBroadcast(`market-buy:${symbol}:${user.id}`);
      res.json({ ok: true, trade, currency, user: sanitizeUser(user) });
      return;
    }

    // SELL: amount is coin quantity
    const sellQty = Number(amount);
    const heldQty = Number(user.currencyHoldings[symbol] || 0);
    if (sellQty > heldQty + 1e-8) {
      res.status(400).json({ error: `Insufficient ${symbol} balance. Available: ${heldQty.toFixed(6)} ${symbol}.` });
      return;
    }

    const actualSellQty = Math.min(sellQty, heldQty);
    const payoutBdt = Number((actualSellQty * currentPrice).toFixed(2));
    if (payoutBdt < 1) {
      res.status(400).json({ error: 'Sell payout must be at least 1 BDT.' });
      return;
    }

    const remaining = Number((heldQty - actualSellQty).toFixed(6));
    if (remaining <= 0.000001) {
      delete user.currencyHoldings[symbol];
    } else {
      user.currencyHoldings[symbol] = remaining;
    }
    user.balance = Number((user.balance + payoutBdt).toFixed(2));

    // Supply/demand price drop when users sell
    const pool = Math.max(50000, currency.liquidityPoolBdt || 250000);
    const impactRatio = symbol === 'USDX' ? 0 : Math.min(0.18, payoutBdt / pool);
    const floorPrice = Number((currency.basePriceBdt * 0.25).toFixed(2));
    const newPrice = Math.max(floorPrice, Number((currentPrice * (1 - impactRatio)).toFixed(2)));

    currency.priceBdt = newPrice;
    currency.totalInvestedBdt = Math.max(0, Number((currency.totalInvestedBdt - payoutBdt).toFixed(2)));
    currency.change24hPct = Number((((newPrice - currency.basePriceBdt) / currency.basePriceBdt) * 100).toFixed(2));
    currency.priceHistory = [...(currency.priceHistory || [currency.basePriceBdt]), newPrice].slice(-40);

    const trade = {
      id: `TRD-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      userId: user.id,
      userName: user.name,
      symbol,
      side: 'SELL' as const,
      bdtAmount: payoutBdt,
      usdAmount: Number((payoutBdt / usdRateBdt).toFixed(2)),
      coinQty: Number(actualSellQty.toFixed(6)),
      priceBdt: currentPrice,
      priceAfterBdt: newPrice,
      timestamp: Date.now(),
    };
    dbState.cryptoTrades.push(trade);
    if (dbState.cryptoTrades.length > 2000) dbState.cryptoTrades = dbState.cryptoTrades.slice(-2000);

    persistAndBroadcast(`market-sell:${symbol}:${user.id}`);
    res.json({ ok: true, trade, currency, user: sanitizeUser(user) });
  });

  // =========================================================================
  // 4. MEMBER ACTION ENDPOINTS (Deposits, Withdraws, Agent, Work, P2P, Chat)
  // =========================================================================
  app.post('/api/deposits', requirePrivateAccess, requireMember, (req, res) => {
    const session = getUserSession(req)!;
    const user = dbState.users[session.userId];
    const body = req.body as {
      gateway?: 'bKash' | 'Nagad' | 'Rocket' | 'USDT';
      senderNumber?: string;
      trxId?: string;
      amount?: number;
    };

    const amount = Number(body.amount || 0);
    if (!body.gateway || !body.senderNumber || !body.trxId || amount < dbState.config.rates.minDeposit) {
      res.status(400).json({
        error: `Minimum deposit is ${dbState.config.rates.minDeposit} BDT and all fields are required.`,
      });
      return;
    }

    const record = {
      id: `DEP-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      userId: user.id,
      userName: user.name,
      gateway: body.gateway,
      senderNumber: String(body.senderNumber).trim(),
      trxId: String(body.trxId).trim(),
      amount,
      status: 'Pending' as const,
      timestamp: Date.now(),
    };

    dbState.deposits.push(record);
    persistAndBroadcast(`deposit-submitted:${record.id}`);
    res.json({ ok: true, deposit: record });
  });

  app.post('/api/withdraws', requirePrivateAccess, requireMember, (req, res) => {
    const session = getUserSession(req)!;
    const user = dbState.users[session.userId];
    const body = req.body as {
      type?: 'standard' | 'agent';
      district?: string;
      agentName?: string;
      method?: 'bKash' | 'Nagad' | 'Rocket';
      accountNumber?: string;
      amount?: number;
    };

    const type: 'agent' | 'standard' = body.type === 'agent' ? 'agent' : 'standard';
    const minAmount = type === 'agent' ? dbState.config.rates.minAgentWithdraw : dbState.config.rates.minWithdraw;
    const amount = Number(body.amount || 0);

    if (!body.method || !body.accountNumber || amount < minAmount) {
      res.status(400).json({ error: `Minimum withdrawal is ${minAmount} BDT and all fields are required.` });
      return;
    }
    if (type === 'agent' && (!body.district || !body.agentName)) {
      res.status(400).json({ error: 'Please select your district and assigned agent.' });
      return;
    }
    if (user.balance < amount) {
      res.status(400).json({ error: 'Insufficient Main Balance.' });
      return;
    }

    user.balance = Number((user.balance - amount).toFixed(2));

    const record = {
      id: `WIT-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      userId: user.id,
      userName: user.name,
      type,
      district: body.district,
      agentName: body.agentName,
      method: body.method,
      accountNumber: String(body.accountNumber).trim(),
      amount,
      status: 'Pending' as const,
      timestamp: Date.now(),
    };

    dbState.withdraws.push(record);
    persistAndBroadcast(`withdraw-submitted:${record.id}`);
    res.json({ ok: true, withdraw: record, balance: user.balance });
  });

  app.post('/api/work/submit', requirePrivateAccess, requireMember, (req, res) => {
    const session = getUserSession(req)!;
    const user = dbState.users[session.userId];
    const body = req.body as { taskId?: string; category?: string; sheetUrl?: string; notes?: string };

    const sheetUrl = String(body.sheetUrl || '').trim();
    if (!sheetUrl || (!sheetUrl.startsWith('http://') && !sheetUrl.startsWith('https://'))) {
      res.status(400).json({ error: 'Please provide a valid Google Sheet or task URL starting with https://.' });
      return;
    }

    const matchedTask = body.taskId
      ? (dbState.customTasks || DEFAULT_WORKSPACE_TASKS).find((t) => t.id === body.taskId)
      : undefined;

    const record = {
      id: `WRK-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      userId: user.id,
      userName: user.name,
      category: String(matchedTask?.title || body.category || 'Data Entry').trim(),
      sheetUrl,
      notes: String(body.notes || '').trim(),
      reward: matchedTask ? matchedTask.rewardBdt : dbState.config.rates.taskReward,
      status: 'Pending' as const,
      timestamp: Date.now(),
    };

    dbState.workSubmissions.push(record);
    persistAndBroadcast(`work-submitted:${record.id}`);
    res.json({ ok: true, submission: record });
  });

  app.post('/api/p2p/send', requirePrivateAccess, requireMember, (req, res) => {
    const session = getUserSession(req)!;
    const sender = dbState.users[session.userId];
    const body = req.body as { recipientCode?: string; amount?: number };

    const recipientCode = String(body.recipientCode || '').trim();
    const amount = Number(body.amount || 0);
    const { p2pMin, p2pMax, p2pFeePerThousand } = dbState.config.rates;

    if (amount < p2pMin || amount > p2pMax) {
      res.status(400).json({ error: `Transfer amount must be between ${p2pMin} and ${p2pMax} BDT.` });
      return;
    }

    const recipient = Object.values(dbState.users).find(
      (u) => u.referCode.toLowerCase() === recipientCode.toLowerCase() || u.id.toLowerCase() === recipientCode.toLowerCase()
    );

    if (!recipient) {
      res.status(404).json({ error: 'Invalid Recipient Referral Code. Member not found.' });
      return;
    }
    if (recipient.id === sender.id) {
      res.status(400).json({ error: 'You cannot send money to your own account.' });
      return;
    }

    const serviceCharge = Number(((amount / 1000) * p2pFeePerThousand).toFixed(2));
    const totalDeduction = Number((amount + serviceCharge).toFixed(2));

    if (sender.balance < totalDeduction) {
      res.status(400).json({
        error: `Insufficient Main Balance. Required (Amount + Charge): ${totalDeduction} BDT.`,
      });
      return;
    }

    sender.balance = Number((sender.balance - totalDeduction).toFixed(2));
    recipient.balance = Number((recipient.balance + amount).toFixed(2));

    const record = {
      id: `P2P-${Date.now()}`,
      trxId: `TRX-${Math.floor(10000000 + Math.random() * 90000000)}`,
      senderId: sender.id,
      senderCode: sender.referCode,
      recipientId: recipient.id,
      recipientCode: recipient.referCode,
      amount,
      serviceCharge,
      totalDeduction,
      timestamp: Date.now(),
    };

    dbState.p2pTransactions.push(record);
    persistAndBroadcast(`p2p:${record.trxId}`);
    res.json({ ok: true, transaction: record, balance: sender.balance });
  });

  app.post('/api/helpline/messages', requirePrivateAccess, requireMember, (req, res) => {
    const session = getUserSession(req)!;
    const user = dbState.users[session.userId];
    const body = req.body as { topic?: string; text?: string; fileUrl?: string };

    const text = String(body.text || '').trim();
    if (!text) {
      res.status(400).json({ error: 'Message text cannot be empty.' });
      return;
    }

    purgeExpiredHelplineMessages();
    const existingCount = dbState.helplineMessages.filter((m) => m.userId === user.id).length;

    const msg = {
      id: `MSG-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      userId: user.id,
      userName: user.name,
      sender: 'User' as const,
      topic: String(body.topic || 'General Support'),
      text,
      fileUrl: body.fileUrl,
      timestamp: Date.now(),
    };
    dbState.helplineMessages.push(msg);

    if (existingCount === 0) {
      dbState.helplineMessages.push({
        id: `BOT-${Date.now() + 1}`,
        userId: user.id,
        userName: user.name,
        sender: 'Bot',
        topic: msg.topic,
        text: 'ধন্যবাদ! আপনার বার্তাটি আমাদের সার্ভার সাপোর্ট টিমে পৌঁছেছে। খুব শীঘ্রই একজন প্রতিনিধি উত্তর দেবেন। (চ্যাট ৩০ মিনিট পর স্বয়ংক্রিয়ভাবে মুছে যাবে)',
        timestamp: Date.now() + 100,
      });
    }

    persistAndBroadcast(`helpline-message:${user.id}`, 'chat:updated');
    res.json({ ok: true, message: msg });
  });

  app.get('/api/crypto/markets', requirePrivateAccess, async (_req, res) => {
    if (cachedCryptoMarkets && Date.now() - cachedCryptoMarkets.fetchedAt < 30_000) {
      res.json({ markets: cachedCryptoMarkets.items, source: 'cache' });
      return;
    }

    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,binancecoin,solana,ripple,dogecoin&order=market_cap_desc&per_page=6&page=1&sparkline=false&price_change_percentage=24h'
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as unknown[];
      cachedCryptoMarkets = { fetchedAt: Date.now(), items: data };
      res.json({ markets: data, source: 'live' });
    } catch {
      res.json({ markets: FALLBACK_MARKETS, source: 'reference' });
    }
  });

  app.post('/api/search/grounding', requirePrivateAccess, requireMember, async (req, res) => {
    const rawQuery = String((req.body as { query?: string })?.query || '').trim();
    if (rawQuery.length < 2 || rawQuery.length > 300) {
      res.status(400).json({ error: 'Search query must be between 2 and 300 characters.' });
      return;
    }

    if (!aiClient) {
      res.status(503).json({
        error: 'Google Search grounding is unavailable because GEMINI_API_KEY is not configured on the server.',
      });
      return;
    }

    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Provide a concise, factual, up-to-date answer to this query for a workspace user: ${rawQuery}`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const answer = (response.text || '').trim();
      const metadata = response.candidates?.[0]?.groundingMetadata;
      const rawChunks = metadata?.groundingChunks || [];
      const seenUris = new Set<string>();
      const sources: Array<{ title: string; uri: string }> = [];

      for (const chunk of rawChunks) {
        const uri = chunk.web?.uri;
        if (uri && !seenUris.has(uri)) {
          seenUris.add(uri);
          sources.push({
            title: chunk.web?.title || uri,
            uri,
          });
        }
      }

      res.json({
        ok: true,
        answer: answer || 'No summary could be generated from web results.',
        sources: sources.slice(0, 6),
        searchQueries: metadata?.webSearchQueries || [],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google Search lookup failed.';
      res.status(500).json({ error: message });
    }
  });

  // =========================================================================
  // 4B. NON-SKIPPABLE VIDEO AD NETWORK ENDPOINTS (Unlimited Views)
  // =========================================================================
  app.post('/api/ads/start', requirePrivateAccess, requireMember, async (req, res) => {
    const session = getUserSession(req)!;
    const adConfig = dbState.config.adNetwork;
    if (!adConfig || !adConfig.enabled) {
      res.status(403).json({ error: 'Ad Network is currently paused by the owner.' });
      return;
    }

    const adId = String((req.body as { adId?: string })?.adId || '').trim();
    const campaign = adConfig.campaigns.find((c) => c.id === adId && c.active);
    if (!campaign) {
      res.status(404).json({ error: 'Selected ad campaign is unavailable.' });
      return;
    }

    const dashboardId = campaign.dashboardId || (campaign.adKind && campaign.adKind !== 'video' ? 'direct-dashboard' : 'video-dashboard');
    const dashboard = (adConfig.dashboards || []).find((d) => d.id === dashboardId);
    if (dashboard && !dashboard.active) {
      res.status(403).json({ error: 'এই অ্যাড ড্যাশবোর্ডটি বর্তমানে বন্ধ রয়েছে।' });
      return;
    }

    const adKind = campaign.adKind || dashboard?.adKind || 'video';
    const isVideoAd = adKind === 'video';
    const durationSeconds = Math.max(
      5,
      Number(campaign.durationSeconds || dashboard?.durationSeconds || (isVideoAd ? 30 : 10))
    );
    const ruleBaseReward = isVideoAd
      ? (dashboard?.rewardBdt ?? adConfig.reward30sBdt ?? 0.3)
      : (dashboard?.rewardBdt ?? adConfig.rewardOtherBdt ?? 0.1);
    const rewardBdt = Number((campaign.rewardBdt > 0 ? campaign.rewardBdt : ruleBaseReward).toFixed(2));
    const requireSmartlinkClick = dashboard?.requireSmartlinkClick ?? true;

    const watchId = `ADW-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const startedAt = Date.now();
    const watchToken = signSessionToken(
      {
        kind: 'ad-watch',
        watchId,
        userId: session.userId,
        adId: campaign.id,
        dashboardId,
        adKind,
        networkName: campaign.networkName,
        companyName: campaign.companyName,
        durationSeconds,
        rewardBdt,
        requireSmartlinkClick,
        startedAt,
        exp: startedAt + 10 * 60 * 1000,
      },
      secrets.sessionSecret
    );

    const activeSmartlinks = (adConfig.smartlinks || []).filter((s) => s.active && /^https?:\/\//i.test(s.url));
    const dashboardSmartlinks = activeSmartlinks.filter((s) => s.dashboardId === dashboardId);
    const pool = dashboardSmartlinks.length > 0 ? dashboardSmartlinks : activeSmartlinks;
    let selectedPoolEntry = null;
    if (pool.length > 0) {
      selectedPoolEntry = pool[smartlinkRotationCounter % pool.length];
      smartlinkRotationCounter += 1;
    }

    const resolvedSmartlinkUrl =
      campaign.thirdPartyTagUrl?.trim() ||
      selectedPoolEntry?.url ||
      adConfig.primarySmartlinkUrl?.trim() ||
      '';

    const placementMeta = {
      zoneName: campaign.zoneName || selectedPoolEntry?.zoneName || adConfig.zoneName || 'smart-link-3562738',
      placementName:
        campaign.placementName || selectedPoolEntry?.placementName || adConfig.placementName || 'Smartlink_1',
      placementId:
        campaign.placementId || selectedPoolEntry?.placementId || adConfig.placementId || '32355300',
    };

    let resolvedMediaUrl = campaign.videoUrl?.trim() || '';
    if (isVideoAd && !resolvedMediaUrl && (campaign.thirdPartyTagUrl || adConfig.vastTagUrl)) {
      resolvedMediaUrl = await tryResolveVastMediaUrl(campaign.thirdPartyTagUrl || adConfig.vastTagUrl);
    }
    if (isVideoAd && !resolvedMediaUrl) {
      resolvedMediaUrl = durationSeconds <= 15 ? '/ads/express-15s.mp4' : '/ads/adsterra-30s.mp4';
    }

    res.json({
      ok: true,
      watchToken,
      campaign,
      dashboardId,
      adKind,
      dashboardRules: dashboard?.rules || [],
      requireSmartlinkClick,
      allowSkip: dashboard?.allowSkip ?? false,
      resolvedMediaUrl,
      resolvedSmartlinkUrl,
      placementMeta,
      durationSeconds,
      rewardBdt,
      startedAt,
    });
  });

  app.post('/api/ads/claim', requirePrivateAccess, requireMember, (req, res) => {
    const session = getUserSession(req)!;
    const user = dbState.users[session.userId];
    const body = req.body as { watchToken?: string; smartlinkClicked?: boolean };
    const watchToken = String(body?.watchToken || '').trim();
    const payload = verifySessionToken<AdWatchTokenPayload>(watchToken, secrets.sessionSecret);

    if (!payload || payload.kind !== 'ad-watch' || payload.userId !== user.id) {
      res.status(400).json({ error: 'Invalid or expired ad watch session.' });
      return;
    }

    if (claimedAdWatchIds.has(payload.watchId) || dbState.adWatchLogs.some((l) => l.id === payload.watchId)) {
      res.status(409).json({ error: 'Reward for this ad view has already been claimed.' });
      return;
    }

    if (payload.requireSmartlinkClick && !body?.smartlinkClicked) {
      res.status(400).json({
        error: 'ড্যাশবোর্ডের রুলস অনুযায়ী বিজ্ঞাপনটি ওপেন করে নির্ধারিত সময় দেখতে হবে।',
      });
      return;
    }

    const elapsedMs = Date.now() - payload.startedAt;
    const minRequiredMs = (payload.durationSeconds - 1) * 1000;
    if (elapsedMs < minRequiredMs) {
      const remaining = Math.ceil((minRequiredMs - elapsedMs) / 1000);
      res.status(400).json({
        error: `অ্যাড স্কিপ করা যাবে না! অনুগ্রহ করে আরও ${remaining} সেকেন্ড দেখুন।`,
      });
      return;
    }

    claimedAdWatchIds.add(payload.watchId);
    const rewardBdt = Number(payload.rewardBdt.toFixed(2));
    user.balance = Number((user.balance + rewardBdt).toFixed(2));
    user.todayEarn = Number((user.todayEarn + rewardBdt).toFixed(2));

    const log = {
      id: payload.watchId,
      adId: payload.adId,
      networkName: payload.networkName,
      companyName: payload.companyName,
      userId: user.id,
      userName: user.name,
      durationSeconds: payload.durationSeconds,
      rewardBdt,
      timestamp: Date.now(),
    };
    dbState.adWatchLogs.push(log);
    if (dbState.adWatchLogs.length > 5000) {
      dbState.adWatchLogs = dbState.adWatchLogs.slice(-5000);
    }

    persistAndBroadcast(`ad-reward:${user.id}:${payload.adId}`);
    res.json({
      ok: true,
      rewardBdt,
      balance: user.balance,
      todayEarn: user.todayEarn,
      log,
    });
  });

  // =========================================================================
  // 5. OWNER / ADMIN WEBSITE & GITHUB SERVER MANAGEMENT DASHBOARD APIs
  // =========================================================================
  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    purgeExpiredHelplineMessages();
    const users = Object.values(dbState.users)
      .map(sanitizeUser)
      .sort((a, b) => b.createdAt - a.createdAt);

    const totalAdPayoutBdt = Number(
      dbState.adWatchLogs.reduce((sum, l) => sum + Number(l.rewardBdt || 0), 0).toFixed(2)
    );

    res.json({
      serverStats: {
        connectedClients: sseClients.size,
        totalUsers: users.length,
        totalBalanceBdt: users.reduce((sum, u) => sum + u.balance, 0),
        totalDepositBalanceBdt: users.reduce((sum, u) => sum + u.depositBalance, 0),
        pendingDeposits: dbState.deposits.filter((d) => d.status === 'Pending').length,
        pendingWithdraws: dbState.withdraws.filter((w) => w.status === 'Pending').length,
        pendingWork: dbState.workSubmissions.filter((w) => w.status === 'Pending').length,
        totalAdWatches: dbState.adWatchLogs.length,
        totalAdPayoutBdt,
        poolMarketCapUsd: computePoolMarketCapUsd(),
        uptimeSeconds: Math.floor(process.uptime()),
      },
      config: dbState.config,
      invites: dbState.invites.slice().reverse(),
      users,
      deposits: dbState.deposits.slice().reverse(),
      withdraws: dbState.withdraws.slice().reverse(),
      workSubmissions: dbState.workSubmissions.slice().reverse(),
      p2pTransactions: dbState.p2pTransactions.slice().reverse(),
      helplineMessages: dbState.helplineMessages,
      adWatchLogs: dbState.adWatchLogs.slice(-200).reverse(),
      github: buildGitHubStatus(ghConfig, ghRuntime),
      districtAgents: dbState.districtAgents && dbState.districtAgents.length > 0 ? dbState.districtAgents : DEFAULT_DISTRICT_AGENTS,
      customTasks: Array.isArray(dbState.customTasks) ? dbState.customTasks : DEFAULT_WORKSPACE_TASKS,
      internalCurrencies:
        dbState.internalCurrencies && dbState.internalCurrencies.length > 0
          ? dbState.internalCurrencies
          : DEFAULT_INTERNAL_CURRENCIES,
      cryptoTrades: (dbState.cryptoTrades || []).slice(-100).reverse(),
    });
  });

  app.put('/api/admin/config', requireAdmin, (req, res) => {
    const incoming = req.body as Partial<SiteConfig>;
    dbState.config = {
      ...dbState.config,
      ...incoming,
      notice: incoming.notice ? { ...dbState.config.notice, ...incoming.notice, updatedAt: Date.now() } : dbState.config.notice,
      adminNumbers: incoming.adminNumbers ? { ...dbState.config.adminNumbers, ...incoming.adminNumbers } : dbState.config.adminNumbers,
      rates: incoming.rates ? { ...dbState.config.rates, ...incoming.rates } : dbState.config.rates,
      theme: incoming.theme ? { ...dbState.config.theme, ...incoming.theme } : dbState.config.theme,
      copy: incoming.copy ? { ...dbState.config.copy, ...incoming.copy } : dbState.config.copy,
      adNetwork: incoming.adNetwork
        ? {
            ...dbState.config.adNetwork,
            ...incoming.adNetwork,
            customScriptUrl: extractSafeUrlOrScriptSrc(incoming.adNetwork.customScriptUrl),
            primarySmartlinkUrl: extractSafeUrlOrScriptSrc(
              incoming.adNetwork.primarySmartlinkUrl || dbState.config.adNetwork.primarySmartlinkUrl
            ),
            smartlinks: Array.isArray(incoming.adNetwork.smartlinks)
              ? incoming.adNetwork.smartlinks
              : dbState.config.adNetwork.smartlinks,
            dashboards: Array.isArray(incoming.adNetwork.dashboards)
              ? incoming.adNetwork.dashboards
              : dbState.config.adNetwork.dashboards,
            campaigns: Array.isArray(incoming.adNetwork.campaigns)
              ? incoming.adNetwork.campaigns
              : dbState.config.adNetwork.campaigns,
          }
        : dbState.config.adNetwork,
      banners: Array.isArray(incoming.banners) ? incoming.banners : dbState.config.banners,
      champions: Array.isArray(incoming.champions) ? incoming.champions : dbState.config.champions,
    };

    persistAndBroadcast('site-config-updated', 'config:updated');
    res.json({ ok: true, config: dbState.config });
  });

  // Internal Network Currencies Management (Admin)
  app.put('/api/admin/market', requireAdmin, (req, res) => {
    const body = req.body as { currencies?: InternalCurrency[]; usdRateBdt?: number };
    if (typeof body.usdRateBdt === 'number' && body.usdRateBdt > 0) {
      dbState.config.rates.usdRateBdt = body.usdRateBdt;
    }
    if (Array.isArray(body.currencies)) {
      dbState.internalCurrencies = body.currencies;
    }
    persistAndBroadcast('internal-market-updated', 'config:updated');
    res.json({
      ok: true,
      currencies: dbState.internalCurrencies,
      usdRateBdt: dbState.config.rates.usdRateBdt || 122,
    });
  });

  app.post('/api/admin/ads/smartlinks/import', requireAdmin, (req, res) => {
    const body = req.body as {
      rawText?: string;
      createCampaigns?: boolean;
      dashboardId?: 'video-dashboard' | 'direct-dashboard' | 'express-dashboard';
      durationSeconds?: number;
    };
    const entries = parseSmartlinksInput(String(body.rawText || ''));
    if (entries.length === 0) {
      res.status(400).json({
        error:
          'No valid https:// smartlink URL found. Paste either a direct https:// link or the CSV row from your ad network.',
      });
      return;
    }

    const targetDashboardId = body.dashboardId || 'video-dashboard';
    const isVideoDash = targetDashboardId === 'video-dashboard';
    const adKind =
      targetDashboardId === 'direct-dashboard'
        ? 'direct'
        : targetDashboardId === 'express-dashboard'
          ? 'express'
          : 'video';

    const existingLinks = dbState.config.adNetwork.smartlinks || [];
    const addedLinks: NonNullable<SiteConfig['adNetwork']['smartlinks']> = [];

    for (const entry of entries) {
      const cleanUrl = extractSafeUrlOrScriptSrc(entry.url);
      if (!/^https?:\/\//i.test(cleanUrl)) continue;
      const duplicate = existingLinks.find((s) => s.url === cleanUrl);
      if (!duplicate) {
        const sl = {
          id: `SL-${entry.placementId || crypto.randomBytes(3).toString('hex').toUpperCase()}`,
          zoneName: entry.zoneName,
          placementName: entry.placementName,
          placementId: entry.placementId,
          url: cleanUrl,
          dashboardId: targetDashboardId,
          active: true,
        };
        existingLinks.push(sl);
        addedLinks.push(sl);
      } else {
        duplicate.zoneName = entry.zoneName || duplicate.zoneName;
        duplicate.placementName = entry.placementName || duplicate.placementName;
        duplicate.placementId = entry.placementId || duplicate.placementId;
        duplicate.dashboardId = targetDashboardId;
        duplicate.active = true;
      }
    }

    const first = entries[0];
    dbState.config.adNetwork.smartlinks = existingLinks;
    dbState.config.adNetwork.primarySmartlinkUrl = first.url;
    dbState.config.adNetwork.zoneName = first.zoneName || dbState.config.adNetwork.zoneName;
    dbState.config.adNetwork.placementName = first.placementName || dbState.config.adNetwork.placementName;
    dbState.config.adNetwork.placementId = first.placementId || dbState.config.adNetwork.placementId;

    if (body.createCampaigns) {
      const durationSeconds = Number(body.durationSeconds || (isVideoDash ? 30 : 10));
      const rewardBdt = isVideoDash
        ? (dbState.config.adNetwork.reward30sBdt ?? 0.3)
        : (dbState.config.adNetwork.rewardOtherBdt ?? 0.1);
      for (const entry of entries) {
        const existingNums = dbState.config.adNetwork.campaigns
          .map((c) => Number(c.id.replace(/[^0-9]/g, '')))
          .filter((n) => Number.isFinite(n));
        const nextNum = Math.max(100, ...(existingNums.length ? existingNums : [100])) + 1;
        dbState.config.adNetwork.campaigns.push({
          id: `AD-${nextNum}`,
          dashboardId: targetDashboardId,
          adKind,
          networkName: `${entry.placementName || 'Smartlink'} · Adsterra`,
          companyName: entry.placementName || 'Adsterra Partner Network',
          title: `${entry.placementName || 'Smartlink'} · ${isVideoDash ? 'Video Ad' : 'Direct Offer'} (${durationSeconds}s)`,
          description: `Zone ${entry.zoneName} · Placement ID ${entry.placementId || 'Live'} · ${durationSeconds}s`,
          category: isVideoDash ? 'Video Ad (৩০ পয়সা)' : 'Other Ad (১০ পয়সা)',
          durationSeconds,
          rewardBdt,
          videoUrl: isVideoDash ? '/ads/adsterra-30s.mp4' : '',
          thirdPartyTagUrl: entry.url,
          zoneName: entry.zoneName,
          placementName: entry.placementName,
          placementId: entry.placementId,
          accentHex: isVideoDash ? '#059669' : '#0284c7',
          active: true,
        });
      }
    }

    persistAndBroadcast(`smartlinks-imported:${entries.length}`, 'config:updated');
    res.json({ ok: true, importedCount: entries.length, addedCount: addedLinks.length, adNetwork: dbState.config.adNetwork });
  });

  app.post('/api/admin/ads/campaigns', requireAdmin, (req, res) => {
    const body = req.body as {
      dashboardId?: 'video-dashboard' | 'direct-dashboard' | 'express-dashboard';
      adKind?: 'video' | 'direct' | 'express';
      networkName?: string;
      companyName?: string;
      title?: string;
      description?: string;
      category?: string;
      durationSeconds?: number;
      rewardBdt?: number;
      videoUrl?: string;
      thirdPartyTagUrl?: string;
      zoneName?: string;
      placementName?: string;
      placementId?: string;
      accentHex?: string;
    };

    const thirdPartyTagUrl = extractSafeUrlOrScriptSrc(body.thirdPartyTagUrl);
    const videoUrl = String(body.videoUrl || '').trim();
    const networkName = String(body.networkName || 'Adsterra High-CPM').trim();
    const companyName = String(body.companyName || (thirdPartyTagUrl ? `${networkName} Partner` : '')).trim();
    const title = String(body.title || (thirdPartyTagUrl ? `${networkName} Sponsored Spot` : '')).trim();
    if (!companyName && !thirdPartyTagUrl && !videoUrl) {
      res.status(400).json({ error: 'Please paste an Ad Link URL or enter a company name.' });
      return;
    }

    const dashboardId = body.dashboardId || 'video-dashboard';
    const adKind =
      body.adKind ||
      (dashboardId === 'direct-dashboard'
        ? 'direct'
        : dashboardId === 'express-dashboard'
          ? 'express'
          : 'video');
    const isVideoDash = adKind === 'video';
    const durationSeconds = Math.max(5, Number(body.durationSeconds || (isVideoDash ? 30 : 10)));
    const defaultReward = isVideoDash
      ? (dbState.config.adNetwork.reward30sBdt ?? 0.3)
      : (dbState.config.adNetwork.rewardOtherBdt ?? 0.1);
    const rewardBdt = Number((Number(body.rewardBdt) > 0 ? Number(body.rewardBdt) : defaultReward).toFixed(2));
    const existingNums = dbState.config.adNetwork.campaigns
      .map((c) => Number(c.id.replace(/[^0-9]/g, '')))
      .filter((n) => Number.isFinite(n));
    const nextNum = Math.max(100, ...(existingNums.length ? existingNums : [100])) + 1;
    const id = `AD-${nextNum}`;

    const campaign = {
      id,
      dashboardId,
      adKind,
      networkName,
      companyName: companyName || 'Adsterra Partner',
      title: title || 'Sponsored Ad & Direct Offer',
      description: String(body.description || `${networkName} · ${durationSeconds}s Non-Skippable`).trim(),
      category: String(body.category || (isVideoDash ? 'Video Ad (৩০ পয়সা)' : 'Other Ad (১০ পয়সা)')).trim(),
      durationSeconds,
      rewardBdt,
      videoUrl: videoUrl || (isVideoDash ? '/ads/adsterra-30s.mp4' : ''),
      thirdPartyTagUrl,
      zoneName: String(body.zoneName || '').trim() || undefined,
      placementName: String(body.placementName || '').trim() || undefined,
      placementId: String(body.placementId || '').trim() || undefined,
      accentHex: String(body.accentHex || (isVideoDash ? '#059669' : '#0284c7')).trim(),
      active: true,
    };

    if (thirdPartyTagUrl && /^https?:\/\//i.test(thirdPartyTagUrl)) {
      dbState.config.adNetwork.smartlinks = dbState.config.adNetwork.smartlinks || [];
      if (!dbState.config.adNetwork.smartlinks.some((s) => s.url === thirdPartyTagUrl)) {
        dbState.config.adNetwork.smartlinks.push({
          id: `SL-${nextNum}`,
          zoneName: campaign.zoneName || `campaign-${id.toLowerCase()}`,
          placementName: campaign.placementName || campaign.companyName,
          placementId: campaign.placementId || String(nextNum),
          url: thirdPartyTagUrl,
          dashboardId,
          active: true,
        });
      }
    }

    dbState.config.adNetwork.campaigns.push(campaign);
    persistAndBroadcast(`ad-campaign-added:${campaign.id}`, 'config:updated');
    res.json({ ok: true, campaign, adNetwork: dbState.config.adNetwork });
  });

  app.delete('/api/admin/ads/campaigns/:id', requireAdmin, (req, res) => {
    const before = dbState.config.adNetwork.campaigns.length;
    dbState.config.adNetwork.campaigns = dbState.config.adNetwork.campaigns.filter((c) => c.id !== req.params.id);
    if (dbState.config.adNetwork.campaigns.length === before) {
      res.status(404).json({ error: 'Ad campaign not found.' });
      return;
    }
    persistAndBroadcast(`ad-campaign-deleted:${req.params.id}`, 'config:updated');
    res.json({ ok: true, adNetwork: dbState.config.adNetwork });
  });

  app.post('/api/admin/invites', requireAdmin, (req, res) => {
    const body = req.body as {
      label?: string;
      role?: 'member' | 'vip';
      maxUses?: number;
      expiresInDays?: number | null;
      customCode?: string;
    };

    const token = body.customCode?.trim()
      ? body.customCode.trim().replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase()
      : generateInviteCode('OKB');

    if (dbState.invites.some((i) => i.token.toLowerCase() === token.toLowerCase())) {
      res.status(409).json({ error: 'An invite link with this code already exists.' });
      return;
    }

    const expiresAt = body.expiresInDays && Number(body.expiresInDays) > 0
      ? Date.now() + Number(body.expiresInDays) * 24 * 60 * 60 * 1000
      : null;

    const invite = {
      id: `inv-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      token,
      label: String(body.label || 'Private Member Access').trim(),
      role: body.role === 'vip' ? ('vip' as const) : ('member' as const),
      maxUses: Math.max(1, Number(body.maxUses || 25)),
      usedCount: 0,
      active: true,
      expiresAt,
      createdAt: Date.now(),
      lastUsedAt: null,
    };

    dbState.invites.push(invite);
    persistAndBroadcast(`invite-created:${invite.token}`, 'admin:updated');
    res.json({ ok: true, invite });
  });

  app.patch('/api/admin/invites/:id', requireAdmin, (req, res) => {
    const invite = dbState.invites.find((i) => i.id === req.params.id);
    if (!invite) {
      res.status(404).json({ error: 'Invite link not found.' });
      return;
    }
    const body = req.body as { active?: boolean; maxUses?: number; label?: string };
    if (typeof body.active === 'boolean') invite.active = body.active;
    if (typeof body.maxUses === 'number' && body.maxUses >= 1) invite.maxUses = body.maxUses;
    if (typeof body.label === 'string' && body.label.trim()) invite.label = body.label.trim();

    persistAndBroadcast(`invite-updated:${invite.token}`, 'admin:updated');
    res.json({ ok: true, invite });
  });

  app.delete('/api/admin/invites/:id', requireAdmin, (req, res) => {
    const before = dbState.invites.length;
    dbState.invites = dbState.invites.filter((i) => i.id !== req.params.id);
    if (dbState.invites.length === before) {
      res.status(404).json({ error: 'Invite link not found.' });
      return;
    }
    persistAndBroadcast(`invite-deleted:${req.params.id}`, 'admin:updated');
    res.json({ ok: true });
  });

  app.post('/api/admin/deposits/:id/review', requireAdmin, (req, res) => {
    const dep = dbState.deposits.find((d) => d.id === req.params.id);
    if (!dep) {
      res.status(404).json({ error: 'Deposit request not found.' });
      return;
    }
    if (dep.status !== 'Pending') {
      res.status(400).json({ error: 'Deposit request has already been reviewed.' });
      return;
    }

    const action = (req.body as { action?: 'Approved' | 'Rejected' })?.action;
    if (action !== 'Approved' && action !== 'Rejected') {
      res.status(400).json({ error: 'Action must be Approved or Rejected.' });
      return;
    }

    dep.status = action;
    dep.reviewedAt = Date.now();

    if (action === 'Approved') {
      const user = dbState.users[dep.userId];
      if (user) {
        user.depositBalance = Number((user.depositBalance + dep.amount).toFixed(2));
        user.balance = Number((user.balance + dep.amount).toFixed(2));
      }
    }

    persistAndBroadcast(`deposit-${action.toLowerCase()}:${dep.id}`);
    res.json({ ok: true, deposit: dep });
  });

  app.post('/api/admin/withdraws/:id/review', requireAdmin, (req, res) => {
    const wit = dbState.withdraws.find((w) => w.id === req.params.id);
    if (!wit) {
      res.status(404).json({ error: 'Withdraw request not found.' });
      return;
    }
    if (wit.status !== 'Pending') {
      res.status(400).json({ error: 'Withdraw request has already been reviewed.' });
      return;
    }

    const action = (req.body as { action?: 'Approved' | 'Rejected' })?.action;
    if (action !== 'Approved' && action !== 'Rejected') {
      res.status(400).json({ error: 'Action must be Approved or Rejected.' });
      return;
    }

    wit.status = action;
    wit.reviewedAt = Date.now();

    if (action === 'Rejected') {
      const user = dbState.users[wit.userId];
      if (user) {
        user.balance = Number((user.balance + wit.amount).toFixed(2));
      }
    }

    persistAndBroadcast(`withdraw-${action.toLowerCase()}:${wit.id}`);
    res.json({ ok: true, withdraw: wit });
  });

  app.post('/api/admin/work/:id/review', requireAdmin, (req, res) => {
    const sub = dbState.workSubmissions.find((w) => w.id === req.params.id);
    if (!sub) {
      res.status(404).json({ error: 'Work submission not found.' });
      return;
    }
    if (sub.status !== 'Pending') {
      res.status(400).json({ error: 'Work submission has already been reviewed.' });
      return;
    }

    const action = (req.body as { action?: 'Approved' | 'Rejected'; reward?: number })?.action;
    if (action !== 'Approved' && action !== 'Rejected') {
      res.status(400).json({ error: 'Action must be Approved or Rejected.' });
      return;
    }

    const rewardAmount = Number((req.body as { reward?: number })?.reward ?? sub.reward);
    sub.status = action;
    sub.reward = rewardAmount;
    sub.reviewedAt = Date.now();

    if (action === 'Approved') {
      const user = dbState.users[sub.userId];
      if (user) {
        user.balance = Number((user.balance + rewardAmount).toFixed(2));
        user.todayEarn = Number((user.todayEarn + rewardAmount).toFixed(2));
        user.completedTasks += 1;
      }
    }

    persistAndBroadcast(`work-${action.toLowerCase()}:${sub.id}`);
    res.json({ ok: true, submission: sub });
  });

  app.patch('/api/admin/users/:id', requireAdmin, (req, res) => {
    const user = dbState.users[req.params.id];
    if (!user) {
      res.status(404).json({ error: 'Member not found.' });
      return;
    }

    const body = req.body as {
      balance?: number;
      depositBalance?: number;
      todayEarn?: number;
      completedTasks?: number;
      referralBonus?: number;
      level?: string;
      status?: 'Active' | 'Suspended';
      photoUrl?: string;
      name?: string;
    };

    if (typeof body.balance === 'number') user.balance = Number(body.balance.toFixed(2));
    if (typeof body.depositBalance === 'number') user.depositBalance = Number(body.depositBalance.toFixed(2));
    if (typeof body.todayEarn === 'number') user.todayEarn = Number(body.todayEarn.toFixed(2));
    if (typeof body.completedTasks === 'number') user.completedTasks = Math.max(0, Math.floor(body.completedTasks));
    if (typeof body.referralBonus === 'number') user.referralBonus = Number(body.referralBonus.toFixed(2));
    if (typeof body.level === 'string' && body.level.trim()) user.level = body.level.trim();
    if (body.status === 'Active' || body.status === 'Suspended') user.status = body.status;
    if (typeof body.photoUrl === 'string' && body.photoUrl.trim()) user.photoUrl = body.photoUrl.trim();
    if (typeof body.name === 'string' && body.name.trim()) user.name = body.name.trim();

    persistAndBroadcast(`member-updated:${user.id}`);
    res.json({ ok: true, user: sanitizeUser(user) });
  });

  app.post('/api/admin/helpline/reply', requireAdmin, (req, res) => {
    const body = req.body as { userId?: string; text?: string };
    const userId = String(body.userId || '').trim();
    const text = String(body.text || '').trim();
    const user = dbState.users[userId];
    if (!user || !text) {
      res.status(400).json({ error: 'Valid userId and reply text are required.' });
      return;
    }

    const msg = {
      id: `AGT-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      userId: user.id,
      userName: user.name,
      sender: 'Agent' as const,
      topic: 'Support Agent Reply',
      text,
      timestamp: Date.now(),
    };
    dbState.helplineMessages.push(msg);
    persistAndBroadcast(`agent-reply:${user.id}`, 'chat:updated');
    res.json({ ok: true, message: msg });
  });

  app.post('/api/admin/passkey', requireAdmin, (req, res) => {
    const newPasskey = String((req.body as { newPasskey?: string })?.newPasskey || '').trim();
    if (newPasskey.length < 6) {
      res.status(400).json({ error: 'New passkey must be at least 6 characters.' });
      return;
    }
    secrets.adminPasskeyHash = hashPassword(newPasskey);
    saveSecrets(secrets);
    res.json({ ok: true });
  });

  // Realtime Database Export & Snapshot Backup (Firebase alternative)
  app.get('/api/admin/db/export', requireAdmin, (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="myokbi-db-${Date.now()}.json"`);
    res.send(JSON.stringify(dbState, null, 2));
  });

  // Realtime Database Import & Restore (Firebase alternative)
  app.post('/api/admin/db/import', requireAdmin, (req, res) => {
    try {
      const incoming = req.body as { state?: DatabaseState };
      if (!incoming || !incoming.state || typeof incoming.state !== 'object') {
        res.status(400).json({ error: 'Invalid database payload. Expected JSON object with state.' });
        return;
      }
      dbState = normalizeDatabaseState(incoming.state);
      dbState.updatedAt = Date.now();
      persistAndBroadcast('database-restored-from-import', 'state:updated');
      res.json({ ok: true, updatedAt: dbState.updatedAt });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Database import failed.' });
    }
  });

  // Generic Realtime Database Record Insert / Create
  app.post('/api/admin/db/record', requireAdmin, (req, res) => {
    const body = req.body as { collection?: string; record?: Record<string, any> };
    const collection = String(body.collection || '').trim();
    const record = body.record;
    if (!collection || !record || typeof record !== 'object') {
      res.status(400).json({ error: 'Valid collection and record are required.' });
      return;
    }
    const id = String(record.id || `${collection.slice(0, 3).toUpperCase()}-${Date.now()}`);
    record.id = id;

    if (collection === 'users') {
      if (!record.email || !record.name) {
        res.status(400).json({ error: 'User must have name and email.' });
        return;
      }
      const password = String(record.password || '123456');
      dbState.users[id] = {
        id,
        name: String(record.name),
        email: String(record.email).toLowerCase(),
        phone: String(record.phone || '01700000000'),
        passwordHash: hashPassword(password),
        referCode: String(record.referCode || `OKB-${id}`),
        referredBy: String(record.referredBy || ''),
        level: String(record.level || 'Data Entry / Member'),
        balance: Number(record.balance || 0),
        depositBalance: Number(record.depositBalance || 0),
        todayEarn: Number(record.todayEarn || 0),
        completedTasks: Number(record.completedTasks || 0),
        referralBonus: Number(record.referralBonus || 0),
        status: record.status === 'Suspended' ? 'Suspended' : 'Active',
        photoUrl: String(record.photoUrl || '/src/assets/images/avatar_member_default_1795024942538.jpg'),
        createdAt: Number(record.createdAt || Date.now()),
      };
    } else if (collection === 'deposits') {
      dbState.deposits.push(record as any);
    } else if (collection === 'withdraws') {
      dbState.withdraws.push(record as any);
    } else if (collection === 'workSubmissions') {
      dbState.workSubmissions.push(record as any);
    } else if (collection === 'p2pTransactions') {
      dbState.p2pTransactions.push(record as any);
    } else if (collection === 'invites') {
      dbState.invites.push(record as any);
    } else if (collection === 'districtAgents') {
      dbState.districtAgents = dbState.districtAgents || [];
      dbState.districtAgents.push(record as any);
    } else if (collection === 'customTasks') {
      dbState.customTasks = dbState.customTasks || [];
      dbState.customTasks.push(record as any);
    } else {
      res.status(400).json({ error: `Unsupported collection: ${collection}` });
      return;
    }

    persistAndBroadcast(`db-record-created:${collection}:${id}`);
    res.json({ ok: true, id, record });
  });

  // Generic Realtime Database Record Update
  app.patch('/api/admin/db/record/:collection/:id', requireAdmin, (req, res) => {
    const { collection, id } = req.params;
    const updates = req.body as Record<string, any>;
    if (!updates || typeof updates !== 'object') {
      res.status(400).json({ error: 'Valid update payload required.' });
      return;
    }

    if (collection === 'users') {
      const user = dbState.users[id];
      if (!user) return res.status(404).json({ error: 'User not found.' });
      Object.assign(user, updates);
      if (updates.password && typeof updates.password === 'string') {
        user.passwordHash = hashPassword(updates.password);
      }
    } else if (collection === 'deposits') {
      const item = dbState.deposits.find((d) => d.id === id);
      if (!item) return res.status(404).json({ error: 'Deposit not found.' });
      Object.assign(item, updates);
    } else if (collection === 'withdraws') {
      const item = dbState.withdraws.find((w) => w.id === id);
      if (!item) return res.status(404).json({ error: 'Withdrawal not found.' });
      Object.assign(item, updates);
    } else if (collection === 'workSubmissions') {
      const item = dbState.workSubmissions.find((w) => w.id === id);
      if (!item) return res.status(404).json({ error: 'Work not found.' });
      Object.assign(item, updates);
    } else if (collection === 'p2pTransactions') {
      const item = dbState.p2pTransactions.find((p) => p.id === id);
      if (!item) return res.status(404).json({ error: 'P2P record not found.' });
      Object.assign(item, updates);
    } else if (collection === 'invites') {
      const item = dbState.invites.find((i) => i.id === id);
      if (!item) return res.status(404).json({ error: 'Invite not found.' });
      Object.assign(item, updates);
    } else if (collection === 'districtAgents') {
      dbState.districtAgents = dbState.districtAgents || [];
      const item = dbState.districtAgents.find((a) => a.id === id);
      if (!item) return res.status(404).json({ error: 'District agent not found.' });
      Object.assign(item, updates);
    } else if (collection === 'customTasks') {
      dbState.customTasks = dbState.customTasks || [];
      const item = dbState.customTasks.find((t) => t.id === id);
      if (!item) return res.status(404).json({ error: 'Custom task not found.' });
      Object.assign(item, updates);
    } else {
      return res.status(400).json({ error: `Unsupported collection: ${collection}` });
    }

    persistAndBroadcast(`db-record-updated:${collection}:${id}`);
    res.json({ ok: true, id });
  });

  // Generic Realtime Database Record Delete
  app.delete('/api/admin/db/record/:collection/:id', requireAdmin, (req, res) => {
    const { collection, id } = req.params;
    if (collection === 'users') {
      if (!dbState.users[id]) return res.status(404).json({ error: 'User not found.' });
      delete dbState.users[id];
    } else if (collection === 'deposits') {
      dbState.deposits = dbState.deposits.filter((d) => d.id !== id);
    } else if (collection === 'withdraws') {
      dbState.withdraws = dbState.withdraws.filter((w) => w.id !== id);
    } else if (collection === 'workSubmissions') {
      dbState.workSubmissions = dbState.workSubmissions.filter((w) => w.id !== id);
    } else if (collection === 'p2pTransactions') {
      dbState.p2pTransactions = dbState.p2pTransactions.filter((p) => p.id !== id);
    } else if (collection === 'invites') {
      dbState.invites = dbState.invites.filter((i) => i.id !== id);
    } else if (collection === 'helplineMessages') {
      dbState.helplineMessages = dbState.helplineMessages.filter((m) => m.id !== id);
    } else if (collection === 'adWatchLogs') {
      dbState.adWatchLogs = dbState.adWatchLogs.filter((a) => a.id !== id);
    } else if (collection === 'districtAgents') {
      dbState.districtAgents = (dbState.districtAgents || []).filter((a) => a.id !== id);
    } else if (collection === 'customTasks') {
      dbState.customTasks = (dbState.customTasks || []).filter((t) => t.id !== id);
    } else {
      return res.status(400).json({ error: `Unsupported collection: ${collection}` });
    }

    persistAndBroadcast(`db-record-deleted:${collection}:${id}`);
    res.json({ ok: true, id });
  });

  // Real-time Push Broadcast to All Connected Clients
  app.post('/api/admin/broadcast', requireAdmin, (req, res) => {
    const body = req.body as { title?: string; message?: string; level?: 'info' | 'warning' | 'success' };
    const message = String(body.message || '').trim();
    if (!message) {
      res.status(400).json({ error: 'Broadcast message cannot be empty.' });
      return;
    }
    broadcastEvent('broadcast:message', {
      id: `BC-${Date.now()}`,
      title: String(body.title || 'System Notification').trim(),
      message,
      level: body.level || 'info',
      timestamp: Date.now(),
    });
    res.json({ ok: true });
  });

  // User Quick Balance Adjustment
  app.post('/api/admin/users/:id/adjust-balance', requireAdmin, (req, res) => {
    const user = dbState.users[req.params.id];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const body = req.body as { delta?: number; type?: 'balance' | 'depositBalance'; memo?: string };
    const delta = Number(body.delta || 0);
    const targetField = body.type === 'depositBalance' ? 'depositBalance' : 'balance';
    if (isNaN(delta) || delta === 0) {
      res.status(400).json({ error: 'A non-zero delta amount is required.' });
      return;
    }
    user[targetField] = Math.max(0, Number((user[targetField] + delta).toFixed(2)));
    persistAndBroadcast(`user-balance-adjusted:${user.id}`);
    res.json({ ok: true, user: sanitizeUser(user), delta, memo: body.memo });
  });

  // Batch Approvals for Deposits, Withdraws, and Work
  app.post('/api/admin/approvals/batch', requireAdmin, (req, res) => {
    const body = req.body as { type?: 'deposits' | 'withdraws' | 'work'; ids?: string[]; action?: 'Approved' | 'Rejected' };
    const { type, ids, action } = body;
    if (!type || !Array.isArray(ids) || (action !== 'Approved' && action !== 'Rejected')) {
      res.status(400).json({ error: 'Valid type, ids array, and action (Approved/Rejected) are required.' });
      return;
    }
    let processed = 0;
    if (type === 'deposits') {
      for (const id of ids) {
        const dep = dbState.deposits.find((d) => d.id === id && d.status === 'Pending');
        if (dep) {
          dep.status = action;
          dep.reviewedAt = Date.now();
          if (action === 'Approved') {
            const u = dbState.users[dep.userId];
            if (u) {
              u.depositBalance = Number((u.depositBalance + dep.amount).toFixed(2));
              u.balance = Number((u.balance + dep.amount).toFixed(2));
            }
          }
          processed++;
        }
      }
    } else if (type === 'withdraws') {
      for (const id of ids) {
        const wit = dbState.withdraws.find((w) => w.id === id && w.status === 'Pending');
        if (wit) {
          wit.status = action;
          wit.reviewedAt = Date.now();
          if (action === 'Rejected') {
            const u = dbState.users[wit.userId];
            if (u) u.balance = Number((u.balance + wit.amount).toFixed(2));
          }
          processed++;
        }
      }
    } else if (type === 'work') {
      for (const id of ids) {
        const wrk = dbState.workSubmissions.find((w) => w.id === id && w.status === 'Pending');
        if (wrk) {
          wrk.status = action;
          wrk.reviewedAt = Date.now();
          if (action === 'Approved') {
            const u = dbState.users[wrk.userId];
            if (u) {
              u.balance = Number((u.balance + wrk.reward).toFixed(2));
              u.todayEarn = Number((u.todayEarn + wrk.reward).toFixed(2));
              u.completedTasks += 1;
            }
          }
          processed++;
        }
      }
    }
    persistAndBroadcast(`batch-${type}-${action.toLowerCase()}:${processed}`);
    res.json({ ok: true, processed });
  });

  // District Agents Directory Management
  app.put('/api/admin/districts', requireAdmin, (req, res) => {
    const body = req.body as { districts?: DistrictAgentItem[] };
    if (!Array.isArray(body.districts)) {
      res.status(400).json({ error: 'districts must be an array.' });
      return;
    }
    dbState.districtAgents = body.districts;
    persistAndBroadcast('district-agents-updated', 'config:updated');
    res.json({ ok: true, districts: dbState.districtAgents });
  });

  // Custom Tasks & Work Offers Management
  app.put('/api/admin/tasks', requireAdmin, (req, res) => {
    const body = req.body as { tasks?: CustomTaskItem[] };
    if (!Array.isArray(body.tasks)) {
      res.status(400).json({ error: 'tasks must be an array.' });
      return;
    }
    dbState.customTasks = body.tasks;
    persistAndBroadcast('tasks-updated', 'config:updated');
    res.json({ ok: true, tasks: dbState.customTasks });
  });

  // =========================================================================
  // 6. GITHUB SERVER CONTROL ENDPOINTS
  // =========================================================================
  app.put('/api/admin/github/config', requireAdmin, (req, res) => {
    const body = req.body as Partial<GitHubSyncConfig>;
    ghConfig = {
      owner: String(body.owner ?? ghConfig.owner).trim(),
      repo: String(body.repo ?? ghConfig.repo).trim(),
      branch: String(body.branch ?? ghConfig.branch).trim() || 'main',
      dataPath: String(body.dataPath ?? ghConfig.dataPath).trim() || 'server-data/myokbi-db.json',
      autoSync: typeof body.autoSync === 'boolean' ? body.autoSync : ghConfig.autoSync,
      liveWatch: typeof body.liveWatch === 'boolean' ? body.liveWatch : ghConfig.liveWatch,
      token: body.token && body.token.trim() ? body.token.trim() : ghConfig.token,
    };
    saveGitHubConfig(ghConfig);
    ghRuntime.lastError = null;
    ghRuntime.lastEtag = null;
    broadcastEvent('github:status', { status: buildGitHubStatus(ghConfig, ghRuntime) });
    if (ghConfig.liveWatch && ghConfig.owner && ghConfig.repo && ghConfig.token) {
      void pollGitHubLiveChanges(false);
    }
    res.json({ ok: true, github: buildGitHubStatus(ghConfig, ghRuntime) });
  });

  app.post('/api/admin/github/test', requireAdmin, async (_req, res) => {
    try {
      const repoInfo = await testGitHubConnection(ghConfig);
      ghRuntime.recentCommits = await listGitHubCommits(ghConfig);
      ghRuntime.lastError = null;
      res.json({ ok: true, repo: repoInfo, github: buildGitHubStatus(ghConfig, ghRuntime) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'GitHub connection failed.';
      ghRuntime.lastError = message;
      res.status(400).json({ error: message, github: buildGitHubStatus(ghConfig, ghRuntime) });
    }
  });

  app.post('/api/admin/github/push', requireAdmin, async (req, res) => {
    const customMsg = String((req.body as { message?: string })?.message || '').trim();
    const commitMsg = customMsg || `Myokbi Server Sync (${new Date().toISOString()})`;
    try {
      const result = await executeGitHubPush(commitMsg);
      res.json({ ok: true, result, github: buildGitHubStatus(ghConfig, ghRuntime) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'GitHub push failed.';
      res.status(400).json({ error: message, github: buildGitHubStatus(ghConfig, ghRuntime) });
    }
  });

  app.post('/api/admin/github/pull', requireAdmin, async (_req, res) => {
    ghRuntime.syncing = true;
    try {
      const { state: restored, contentSha, etag } = await pullSnapshotFromGitHub(ghConfig);
      dbState = normalizeDatabaseState(restored);
      saveDatabase(dbState);
      ghRuntime.lastSyncAt = Date.now();
      ghRuntime.lastRemoteCheckAt = Date.now();
      ghRuntime.lastKnownContentSha = contentSha || null;
      ghRuntime.lastEtag = etag ?? null;
      ghRuntime.lastError = null;
      ghRuntime.recentCommits = await listGitHubCommits(ghConfig);
      if (ghRuntime.recentCommits[0]) {
        ghRuntime.lastCommitSha = ghRuntime.recentCommits[0].sha;
        ghRuntime.lastCommitUrl = ghRuntime.recentCommits[0].url;
      }
      broadcastEvent('state:updated', { updatedAt: dbState.updatedAt, reason: 'github-pull' });
      broadcastEvent('config:updated', { updatedAt: dbState.updatedAt, reason: 'github-pull' });
      res.json({ ok: true, updatedAt: dbState.updatedAt, github: buildGitHubStatus(ghConfig, ghRuntime) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'GitHub pull failed.';
      ghRuntime.lastError = message;
      res.status(400).json({ error: message, github: buildGitHubStatus(ghConfig, ghRuntime) });
    } finally {
      ghRuntime.syncing = false;
      broadcastEvent('github:status', { status: buildGitHubStatus(ghConfig, ghRuntime) });
    }
  });

  app.get('/api/admin/github/commits', requireAdmin, async (_req, res) => {
    const commits = await listGitHubCommits(ghConfig);
    ghRuntime.recentCommits = commits;
    res.json({ commits });
  });

  // Real-time GitHub Push Webhook (triggers immediate pull when repo is edited on GitHub)
  app.get('/api/github/webhook', (_req, res) => {
    res.json({
      ok: true,
      service: 'Myokbi GitHub Real-Time Webhook',
      configured: Boolean(ghConfig.owner && ghConfig.repo && ghConfig.token),
      branch: ghConfig.branch || 'main',
      dataPath: ghConfig.dataPath || 'server-data/myokbi-db.json',
      liveWatch: ghConfig.liveWatch,
    });
  });

  app.post('/api/github/webhook', async (req, res) => {
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
    if (webhookSecret) {
      const signature = String(req.headers['x-hub-signature-256'] || '');
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
      if (!signature || !rawBody) {
        res.status(401).json({ error: 'Missing GitHub webhook signature.' });
        return;
      }
      const expected = `sha256=${crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex')}`;
      const sigBuf = Buffer.from(signature, 'utf8');
      const expBuf = Buffer.from(expected, 'utf8');
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        res.status(401).json({ error: 'Invalid GitHub webhook signature.' });
        return;
      }
    }

    const ghEvent = String(req.headers['x-github-event'] || 'push');
    if (ghEvent === 'ping') {
      res.json({ ok: true, pong: true });
      return;
    }

    const body = req.body as { ref?: string } | undefined;
    const expectedRef = `refs/heads/${ghConfig.branch || 'main'}`;
    if (body?.ref && body.ref !== expectedRef) {
      res.json({ ok: true, skipped: true, reason: 'Branch mismatch' });
      return;
    }

    const synced = await pollGitHubLiveChanges(true);
    res.json({ ok: true, synced, updatedAt: dbState.updatedAt });
  });

  // =========================================================================
  // 7. VITE DEV MIDDLEWARE OR PRODUCTION STATIC SERVING
  // =========================================================================
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Myokbi Private Server running on http://0.0.0.0:${PORT}`);
    void syncFromGitHubStartup();
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
