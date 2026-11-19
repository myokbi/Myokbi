import type { DatabaseState, GitHubCommitRecord, GitHubSyncConfig } from './types.ts';

interface GitHubRepoInfo {
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  permissions?: {
    push?: boolean;
    pull?: boolean;
    admin?: boolean;
  };
}

function buildHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Myokbi-Private-Server/1.0',
    'Content-Type': 'application/json',
  };
}

function encodePath(filePath: string): string {
  return filePath
    .replace(/^\/+/, '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export async function testGitHubConnection(cfg: GitHubSyncConfig): Promise<GitHubRepoInfo> {
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    throw new Error('GitHub owner, repository name, and access token are required.');
  }

  const url = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`;
  const res = await fetch(url, { headers: buildHeaders(cfg.token) });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub connection failed (${res.status}): ${parseGitHubError(errText)}`);
  }

  const data = (await res.json()) as {
    full_name: string;
    private: boolean;
    default_branch: string;
    html_url: string;
    permissions?: { push?: boolean; pull?: boolean; admin?: boolean };
  };

  return {
    fullName: data.full_name,
    private: data.private,
    defaultBranch: data.default_branch,
    htmlUrl: data.html_url,
    permissions: data.permissions,
  };
}

export async function pushSnapshotToGitHub(
  cfg: GitHubSyncConfig,
  state: DatabaseState,
  commitMessage: string
): Promise<{ sha: string; contentSha: string; htmlUrl: string; committedAt: number }> {
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    throw new Error('GitHub repository credentials are not configured.');
  }

  const cleanPath = encodePath(cfg.dataPath || 'server-data/myokbi-db.json');
  const branch = cfg.branch || 'main';
  const baseUrl = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${cleanPath}`;

  let existingSha: string | undefined;
  const getRes = await fetch(`${baseUrl}?ref=${encodeURIComponent(branch)}`, {
    headers: buildHeaders(cfg.token),
  });

  if (getRes.ok) {
    const existing = (await getRes.json()) as { sha?: string };
    existingSha = existing.sha;
  } else if (getRes.status !== 404) {
    const errText = await getRes.text();
    throw new Error(`Failed to inspect existing GitHub file (${getRes.status}): ${parseGitHubError(errText)}`);
  }

  const payloadSnapshot = {
    exportedBy: 'Myokbi-GitHub-Server',
    syncedAt: new Date().toISOString(),
    state,
  };
  const encodedContent = Buffer.from(JSON.stringify(payloadSnapshot, null, 2), 'utf8').toString('base64');

  const putBody: Record<string, string> = {
    message: commitMessage,
    content: encodedContent,
    branch,
  };
  if (existingSha) {
    putBody.sha = existingSha;
  }

  const putRes = await fetch(baseUrl, {
    method: 'PUT',
    headers: buildHeaders(cfg.token),
    body: JSON.stringify(putBody),
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`GitHub push failed (${putRes.status}): ${parseGitHubError(errText)}`);
  }

  const result = (await putRes.json()) as {
    commit?: { sha?: string; html_url?: string };
    content?: { sha?: string; html_url?: string };
  };

  return {
    sha: result.commit?.sha || result.content?.sha || '',
    contentSha: result.content?.sha || '',
    htmlUrl: result.commit?.html_url || result.content?.html_url || '',
    committedAt: Date.now(),
  };
}

export async function pullSnapshotFromGitHub(
  cfg: GitHubSyncConfig
): Promise<{ state: DatabaseState; contentSha: string; etag: string | null }> {
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    throw new Error('GitHub repository credentials are not configured.');
  }

  const cleanPath = encodePath(cfg.dataPath || 'server-data/myokbi-db.json');
  const branch = cfg.branch || 'main';
  const url = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${cleanPath}?ref=${encodeURIComponent(branch)}`;

  const res = await fetch(url, { headers: buildHeaders(cfg.token) });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub pull failed (${res.status}): ${parseGitHubError(errText)}`);
  }

  const data = (await res.json()) as { content?: string; sha?: string };
  if (!data.content) {
    throw new Error('GitHub file contains no content.');
  }

  const rawJson = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
  const parsed = JSON.parse(rawJson) as { state?: DatabaseState } | DatabaseState;
  const restored = 'state' in parsed && parsed.state ? parsed.state : (parsed as DatabaseState);

  if (!restored || typeof restored !== 'object' || !restored.config || !restored.users) {
    throw new Error('Invalid Myokbi snapshot structure in GitHub file.');
  }

  return {
    state: restored,
    contentSha: data.sha || '',
    etag: res.headers.get('etag'),
  };
}

export async function checkRemoteGitHubUpdate(
  cfg: GitHubSyncConfig,
  lastEtag: string | null,
  lastKnownContentSha: string | null
): Promise<{ changed: boolean; state?: DatabaseState; contentSha?: string; etag?: string | null }> {
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    return { changed: false };
  }

  const cleanPath = encodePath(cfg.dataPath || 'server-data/myokbi-db.json');
  const branch = cfg.branch || 'main';
  const url = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${cleanPath}?ref=${encodeURIComponent(branch)}`;

  const headers = buildHeaders(cfg.token);
  if (lastEtag) {
    headers['If-None-Match'] = lastEtag;
  }

  const res = await fetch(url, { headers });
  if (res.status === 304 || res.status === 404) {
    return { changed: false };
  }
  if (!res.ok) {
    throw new Error(`GitHub watcher check failed (${res.status})`);
  }

  const data = (await res.json()) as { content?: string; sha?: string };
  const newEtag = res.headers.get('etag');
  if (!data.sha || (lastKnownContentSha && data.sha === lastKnownContentSha)) {
    return { changed: false, contentSha: data.sha, etag: newEtag };
  }
  if (!data.content) {
    return { changed: false, contentSha: data.sha, etag: newEtag };
  }

  const rawJson = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
  const parsed = JSON.parse(rawJson) as { state?: DatabaseState } | DatabaseState;
  const restored = 'state' in parsed && parsed.state ? parsed.state : (parsed as DatabaseState);

  if (!restored || typeof restored !== 'object' || !restored.config || !restored.users) {
    return { changed: false, contentSha: data.sha, etag: newEtag };
  }

  return {
    changed: true,
    state: restored,
    contentSha: data.sha,
    etag: newEtag,
  };
}

export async function listGitHubCommits(cfg: GitHubSyncConfig): Promise<GitHubCommitRecord[]> {
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    return [];
  }

  const cleanPath = (cfg.dataPath || 'server-data/myokbi-db.json').replace(/^\/+/, '');
  const branch = cfg.branch || 'main';
  const url = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/commits?path=${encodeURIComponent(cleanPath)}&sha=${encodeURIComponent(branch)}&per_page=8`;

  const res = await fetch(url, { headers: buildHeaders(cfg.token) });
  if (!res.ok) {
    return [];
  }

  const list = (await res.json()) as Array<{
    sha: string;
    html_url: string;
    commit: {
      message: string;
      author?: { name?: string; date?: string };
    };
  }>;

  return list.map((item) => ({
    sha: item.sha.slice(0, 7),
    message: item.commit.message,
    author: item.commit.author?.name || 'GitHub Server',
    date: item.commit.author?.date || new Date().toISOString(),
    url: item.html_url,
  }));
}

function parseGitHubError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { message?: string };
    return parsed.message || raw;
  } catch {
    return raw;
  }
}
